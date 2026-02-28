import json
import uuid
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuditLog, SystemSetting, User
from app.auth.service import create_audit_log
from app.common.audit import AuditEventJSON, audit_to_cef, audit_to_syslog
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import require_roles

router = APIRouter()


# --- Audit Log Viewer ---

@router.get("/audit-logs", response_model=PaginatedResponse)
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
    page: int = 1,
    page_size: int = 50,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    severity: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)
    if severity:
        query = query.where(AuditLog.severity == severity)
        count_query = count_query.where(AuditLog.severity == severity)
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
        count_query = count_query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
        count_query = count_query.where(AuditLog.timestamp <= end_date)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(page_size))
    logs = result.scalars().all()

    items = [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "user_email": log.user_email,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "action": log.action,
            "changes_json": log.changes_json,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "outcome": log.outcome,
            "severity": log.severity,
            "integrity_hash": log.integrity_hash,
            "previous_hash": log.previous_hash,
            "timestamp": log.timestamp.isoformat(),
        }
        for log in logs
    ]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


# --- Audit Log Integrity Verification ---

@router.get("/audit-logs/verify-chain")
async def verify_audit_chain(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
    limit: int = Query(default=1000, ge=1, le=10000),
):
    """Verify the integrity hash chain of audit log entries.

    Checks that no entries have been tampered with by recomputing
    and comparing integrity hashes sequentially.
    """
    from app.common.audit import compute_integrity_hash

    result = await db.execute(
        select(AuditLog).order_by(AuditLog.timestamp.asc()).limit(limit)
    )
    logs = result.scalars().all()

    if not logs:
        return {"status": "empty", "verified": 0, "errors": []}

    errors = []
    for i, log in enumerate(logs):
        expected_previous = logs[i - 1].integrity_hash if i > 0 else None

        if log.previous_hash != expected_previous:
            errors.append({
                "entry_id": str(log.id),
                "position": i,
                "error": "previous_hash mismatch",
                "expected": expected_previous,
                "actual": log.previous_hash,
            })

        # Ensure timezone-aware timestamp for consistent hash (SQLite strips tzinfo)
        ts = log.timestamp
        if ts.tzinfo is None:
            from datetime import timezone
            ts = ts.replace(tzinfo=timezone.utc)
        recomputed = compute_integrity_hash(
            str(log.id), ts.isoformat(), str(log.user_id) if log.user_id else None,
            log.action, log.entity_type, log.entity_id, log.changes_json, log.previous_hash,
        )
        if recomputed != log.integrity_hash:
            errors.append({
                "entry_id": str(log.id),
                "position": i,
                "error": "integrity_hash mismatch (possible tampering)",
                "expected": recomputed,
                "actual": log.integrity_hash,
            })

    return {
        "status": "valid" if not errors else "invalid",
        "verified": len(logs),
        "errors": errors,
    }


# --- SIEM/SOAR Export Endpoints ---

@router.get("/audit-logs/export/json")
async def export_audit_json(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(default=1000, ge=1, le=10000),
):
    """Export audit logs as structured JSON for SIEM ingestion (Splunk, Elastic, etc.)."""
    query = select(AuditLog).order_by(AuditLog.timestamp.asc())
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
    query = query.limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    events = []
    for log in logs:
        event = AuditEventJSON(
            timestamp=log.timestamp.isoformat(),
            event_id=str(log.id),
            event_type=f"{log.entity_type}.{log.action}",
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            user_id=str(log.user_id) if log.user_id else None,
            user_email=log.user_email,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            changes=json.loads(log.changes_json) if log.changes_json else None,
            integrity_hash=log.integrity_hash,
            previous_hash=log.previous_hash,
            severity=log.severity,
            outcome=log.outcome,
        )
        events.append(event.model_dump())

    await create_audit_log(db, admin.id, "audit_log", "export", "export",
                           changes_json=json.dumps({"format": "json", "count": len(events)}),
                           user_email=admin.email)

    return {"format": "json", "count": len(events), "events": events}


@router.get("/audit-logs/export/cef")
async def export_audit_cef(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(default=1000, ge=1, le=10000),
):
    """Export audit logs as CEF (Common Event Format) for ArcSight, QRadar, etc."""
    query = select(AuditLog).order_by(AuditLog.timestamp.asc())
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
    query = query.limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    lines = []
    for log in logs:
        event = AuditEventJSON(
            timestamp=log.timestamp.isoformat(),
            event_id=str(log.id),
            event_type=f"{log.entity_type}.{log.action}",
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            user_id=str(log.user_id) if log.user_id else None,
            user_email=log.user_email,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            changes=json.loads(log.changes_json) if log.changes_json else None,
            integrity_hash=log.integrity_hash,
            previous_hash=log.previous_hash,
            severity=log.severity,
            outcome=log.outcome,
        )
        cef = audit_to_cef(event)
        lines.append(cef.to_cef_string())

    content = "\n".join(lines)
    await create_audit_log(db, admin.id, "audit_log", "export", "export",
                           changes_json=json.dumps({"format": "cef", "count": len(lines)}),
                           user_email=admin.email)

    return StreamingResponse(
        iter([content]),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=lexnebulis-audit-cef.log"},
    )


@router.get("/audit-logs/export/syslog")
async def export_audit_syslog(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(default=1000, ge=1, le=10000),
):
    """Export audit logs as RFC 5424 syslog for generic SIEM ingestion."""
    query = select(AuditLog).order_by(AuditLog.timestamp.asc())
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)
    query = query.limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    lines = []
    for log in logs:
        event = AuditEventJSON(
            timestamp=log.timestamp.isoformat(),
            event_id=str(log.id),
            event_type=f"{log.entity_type}.{log.action}",
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            user_id=str(log.user_id) if log.user_id else None,
            user_email=log.user_email,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            changes=json.loads(log.changes_json) if log.changes_json else None,
            integrity_hash=log.integrity_hash,
            previous_hash=log.previous_hash,
            severity=log.severity,
            outcome=log.outcome,
        )
        syslog = audit_to_syslog(event)
        lines.append(syslog.to_syslog_string())

    content = "\n".join(lines)
    await create_audit_log(db, admin.id, "audit_log", "export", "export",
                           changes_json=json.dumps({"format": "syslog", "count": len(lines)}),
                           user_email=admin.email)

    return StreamingResponse(
        iter([content]),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=lexnebulis-audit-syslog.log"},
    )


# --- SOAR Webhook Configuration ---

@router.post("/audit-logs/webhook/test")
async def test_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """Test the configured SIEM/SOAR webhook by sending a test event."""
    import httpx

    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "siem_webhook_url"))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No webhook URL configured. Set 'siem_webhook_url' in system settings.")

    test_event = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_id": "test-event",
        "event_type": "system.webhook_test",
        "action": "webhook_test",
        "entity_type": "system",
        "entity_id": "test",
        "user_id": str(admin.id),
        "user_email": admin.email,
        "severity": "info",
        "outcome": "success",
        "source": "lexnebulis",
        "message": "Webhook connectivity test from LexNebulis",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(setting.value, json=test_event)
        return {"status": "sent", "response_status": resp.status_code}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# --- System Settings ---

@router.get("/settings")
async def list_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.key))
    settings = result.scalars().all()
    return [{"key": s.key, "value": s.value, "updated_at": s.updated_at.isoformat()} for s in settings]


@router.put("/settings/{key}")
async def update_setting(
    key: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    body = await request.json()
    value = body.get("value")
    if value is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Value is required")

    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()

    old_value = setting.value if setting else None

    if setting:
        setting.value = str(value)
        setting.updated_by = admin.id
    else:
        setting = SystemSetting(key=key, value=str(value), updated_by=admin.id)
        db.add(setting)

    await create_audit_log(
        db, admin.id, "system_setting", key, "settings_change",
        changes_json=json.dumps({"old": old_value, "new": str(value)}),
        ip_address=request.client.host if request.client else None,
        user_email=admin.email,
    )
    await db.flush()
    return {"key": key, "value": str(value)}
