"""
Enhanced audit logging with nonrepudiation and SIEM/SOAR export support.

Nonrepudiation features:
- Immutable audit log entries (no update/delete endpoints)
- SHA-256 hash chain linking each entry to the previous one
- User identity, IP address, and user-agent captured on every action
- Timestamps from database server (not client) to prevent manipulation
- Before/after snapshots of all changes

SIEM/SOAR export formats:
- CEF (Common Event Format) for ArcSight, QRadar, etc.
- JSON structured logs for Splunk, Elastic, etc.
- Syslog (RFC 5424) for generic SIEM ingestion
- Webhook push for real-time SOAR integration
"""

import hashlib
from typing import Optional

from pydantic import BaseModel


class AuditEventCEF(BaseModel):
    """Common Event Format (CEF) representation of an audit event."""

    version: str = "CEF:0"
    device_vendor: str = "LexNebulis"
    device_product: str = "LexNebulis"
    device_version: str = "1.0.0"
    signature_id: str
    name: str
    severity: int  # 0-10
    extensions: dict

    def to_cef_string(self) -> str:
        ext_str = " ".join(f"{k}={v}" for k, v in self.extensions.items())
        return (
            f"{self.version}|{self.device_vendor}|{self.device_product}"
            f"|{self.device_version}|{self.signature_id}"
            f"|{self.name}|{self.severity}|{ext_str}"
        )


class AuditEventJSON(BaseModel):
    """Structured JSON format for SIEM ingestion (Splunk, Elastic, etc.)."""

    timestamp: str
    event_id: str
    event_type: str
    action: str
    entity_type: str
    entity_id: str
    user_id: Optional[str]
    user_email: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    changes: Optional[dict]
    integrity_hash: str
    previous_hash: Optional[str]
    severity: str  # info, low, medium, high, critical
    outcome: str  # success, failure
    source: str = "lexnebulis"


class AuditEventSyslog(BaseModel):
    """RFC 5424 syslog format."""

    facility: int = 10  # security/authorization (authpriv)
    severity: int = 6  # informational
    hostname: str = "lexnebulis"
    app_name: str = "lexnebulis"
    proc_id: str = "-"
    msg_id: str
    structured_data: str
    message: str

    def to_syslog_string(self) -> str:
        pri = self.facility * 8 + self.severity
        return (
            f"<{pri}>1 {self.structured_data} {self.hostname}"
            f" {self.app_name} {self.proc_id}"
            f" {self.msg_id} {self.message}"
        )


# Severity mapping
ACTION_SEVERITY = {
    "login": "info",
    "login_failed": "medium",
    "login_2fa_pending": "info",
    "login_2fa_verified": "info",
    "login_2fa_recovery_code": "medium",
    "2fa_setup_initiated": "medium",
    "2fa_enabled": "high",
    "2fa_disabled": "high",
    "logout": "info",
    "create": "info",
    "update": "low",
    "delete": "medium",
    "password_change": "medium",
    "role_change": "high",
    "trust_disbursement": "high",
    "settings_change": "high",
    "backup": "info",
    "restore": "critical",
    "export": "medium",
    "sso_login": "info",
    "saml_login": "info",
    "saml_login_failed": "medium",
    "webauthn_registered": "high",
    "webauthn_removed": "high",
    "webauthn_login": "info",
    "webauthn_login_failed": "medium",
    "soar_disable_user": "critical",
    "soar_revoke_sessions": "high",
    "soar_lock_matter": "critical",
    "soar_force_logout_all": "critical",
}

CEF_SEVERITY = {
    "info": 1,
    "low": 3,
    "medium": 5,
    "high": 7,
    "critical": 9,
}


def compute_integrity_hash(
    event_id: str,
    timestamp: str,
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: str,
    changes_json: Optional[str],
    previous_hash: Optional[str],
) -> str:
    """Compute SHA-256 hash chain entry for nonrepudiation."""
    payload = (
        f"{event_id}|{timestamp}|{user_id or ''}|{action}"
        f"|{entity_type}|{entity_id}"
        f"|{changes_json or ''}|{previous_hash or ''}"
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def audit_to_cef(event: AuditEventJSON) -> AuditEventCEF:
    """Convert structured audit event to CEF format."""
    severity_level = CEF_SEVERITY.get(event.severity, 1)
    return AuditEventCEF(
        signature_id=f"LF-{event.action.upper()}-{event.entity_type.upper()}",
        name=f"{event.action} {event.entity_type}",
        severity=severity_level,
        extensions={
            "src": event.ip_address or "unknown",
            "suser": event.user_email or "system",
            "suid": event.user_id or "system",
            "act": event.action,
            "cs1": event.entity_type,
            "cs1Label": "entityType",
            "cs2": event.entity_id,
            "cs2Label": "entityId",
            "cs3": event.integrity_hash,
            "cs3Label": "integrityHash",
            "rt": event.timestamp,
            "outcome": event.outcome,
        },
    )


def audit_to_syslog(event: AuditEventJSON) -> AuditEventSyslog:
    """Convert structured audit event to syslog format."""
    syslog_severity = {"info": 6, "low": 5, "medium": 4, "high": 3, "critical": 2}
    return AuditEventSyslog(
        severity=syslog_severity.get(event.severity, 6),
        msg_id=f"LF-{event.action.upper()}",
        structured_data=(
            f'[lexnebulis@0 eventId="{event.event_id}"'
            f' action="{event.action}"'
            f' entityType="{event.entity_type}"'
            f' entityId="{event.entity_id}"'
            f' userId="{event.user_id or "system"}"'
            f' integrityHash="{event.integrity_hash}"]'
        ),
        message=(
            f"User {event.user_email or 'system'} performed {event.action} on {event.entity_type} {event.entity_id}"
        ),
    )


def enqueue_siem_push(audit_log_id: str) -> None:
    try:
        from app.common.celery_tasks import push_siem_event

        push_siem_event.delay(audit_log_id)
    except Exception:
        pass
