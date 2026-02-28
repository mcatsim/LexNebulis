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
import json
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


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
        return f"{self.version}|{self.device_vendor}|{self.device_product}|{self.device_version}|{self.signature_id}|{self.name}|{self.severity}|{ext_str}"


class AuditEventJSON(BaseModel):
    """Structured JSON format for SIEM ingestion (Splunk, Elastic, etc.)."""
    timestamp: str
    event_id: str
    event_type: str
    action: str
    entity_type: str
    entity_id: str
    user_id: str | None
    user_email: str | None
    ip_address: str | None
    user_agent: str | None
    changes: dict | None
    integrity_hash: str
    previous_hash: str | None
    severity: str  # info, low, medium, high, critical
    outcome: str  # success, failure
    source: str = "lexnebulis"


class AuditEventSyslog(BaseModel):
    """RFC 5424 syslog format."""
    facility: int = 10  # security/authorization (authpriv)
    severity: int = 6   # informational
    hostname: str = "lexnebulis"
    app_name: str = "lexnebulis"
    proc_id: str = "-"
    msg_id: str
    structured_data: str
    message: str

    def to_syslog_string(self) -> str:
        pri = self.facility * 8 + self.severity
        return f"<{pri}>1 {self.structured_data} {self.hostname} {self.app_name} {self.proc_id} {self.msg_id} {self.message}"


# Severity mapping
ACTION_SEVERITY = {
    "login": "info",
    "login_failed": "medium",
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
    user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    changes_json: str | None,
    previous_hash: str | None,
) -> str:
    """Compute SHA-256 hash chain entry for nonrepudiation."""
    payload = f"{event_id}|{timestamp}|{user_id or ''}|{action}|{entity_type}|{entity_id}|{changes_json or ''}|{previous_hash or ''}"
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
        structured_data=f'[lexnebulis@0 eventId="{event.event_id}" action="{event.action}" entityType="{event.entity_type}" entityId="{event.entity_id}" userId="{event.user_id or "system"}" integrityHash="{event.integrity_hash}"]',
        message=f"User {event.user_email or 'system'} performed {event.action} on {event.entity_type} {event.entity_id}",
    )
