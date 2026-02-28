"""
Tests for the audit logging system.

Covers automatic audit-log creation on entity operations,
integrity hash chain verification, and SIEM export formats
(CEF, JSON, Syslog).
"""

import json
import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.auth.models import User
from tests.conftest import ClientFactory


# ---------------------------------------------------------------------------
# Audit log creation
# ---------------------------------------------------------------------------

class TestAuditLogCreation:
    """Verify that CRUD operations create audit log entries."""

    async def test_audit_log_created_on_client_create(
        self, admin_client: AsyncClient, admin_user: User,
    ):
        """Creating a client should produce an audit log entry."""
        data = ClientFactory()
        resp = await admin_client.post("/api/clients", json=data)
        assert resp.status_code == 201

        # Query audit logs for entity_type=client, action=create
        logs_resp = await admin_client.get(
            "/api/admin/audit-logs",
            params={"entity_type": "client", "action": "create"},
        )
        assert logs_resp.status_code == 200
        body = logs_resp.json()
        assert body["total"] >= 1
        # Latest entry should reference the created client
        latest = body["items"][0]
        assert latest["entity_type"] == "client"
        assert latest["action"] == "create"
        assert latest["integrity_hash"] is not None

    async def test_audit_log_created_on_login(self, client: AsyncClient):
        """Login generates an audit log entry."""
        from tests.conftest import _create_test_user
        from app.auth.models import UserRole

        await _create_test_user(
            email="audit-login@test.com",
            password="AuditPass123!",
            role=UserRole.admin,
        )
        login_resp = await client.post("/api/auth/login", json={
            "email": "audit-login@test.com",
            "password": "AuditPass123!",
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        logs_resp = await client.get(
            "/api/admin/audit-logs",
            params={"action": "login"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert logs_resp.status_code == 200
        assert logs_resp.json()["total"] >= 1


# ---------------------------------------------------------------------------
# Hash chain integrity
# ---------------------------------------------------------------------------

class TestAuditHashChain:
    """Verify the SHA-256 integrity hash chain."""

    async def test_hash_chain_integrity(
        self, admin_client: AsyncClient,
    ):
        """After creating several entities, the hash chain should verify."""
        # Create a few entities to build the chain
        for _ in range(3):
            await admin_client.post("/api/clients", json=ClientFactory())

        resp = await admin_client.get(
            "/api/admin/audit-logs/verify-chain", params={"limit": 100},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] in ("valid", "empty")
        assert body["errors"] == []

    async def test_first_entry_has_no_previous_hash(
        self, admin_client: AsyncClient,
    ):
        """The very first audit entry should have previous_hash = null."""
        # Create something to generate an audit log
        await admin_client.post("/api/clients", json=ClientFactory())

        logs_resp = await admin_client.get(
            "/api/admin/audit-logs", params={"page_size": 50},
        )
        body = logs_resp.json()
        # Sort ascending by timestamp to find the first entry
        items = sorted(body["items"], key=lambda x: x["timestamp"])
        if items:
            assert items[0]["previous_hash"] is None


# ---------------------------------------------------------------------------
# SIEM export: CEF
# ---------------------------------------------------------------------------

class TestCEFExport:
    """GET /api/admin/audit-logs/export/cef"""

    async def test_cef_export(self, admin_client: AsyncClient):
        # Generate at least one audit entry
        await admin_client.post("/api/clients", json=ClientFactory())

        resp = await admin_client.get("/api/admin/audit-logs/export/cef")
        assert resp.status_code == 200
        content = resp.text
        # CEF lines start with "CEF:0|"
        assert "CEF:0|" in content
        assert "LegalForge" in content


# ---------------------------------------------------------------------------
# SIEM export: JSON
# ---------------------------------------------------------------------------

class TestJSONExport:
    """GET /api/admin/audit-logs/export/json"""

    async def test_json_export(self, admin_client: AsyncClient):
        await admin_client.post("/api/clients", json=ClientFactory())

        resp = await admin_client.get("/api/admin/audit-logs/export/json")
        assert resp.status_code == 200
        body = resp.json()
        assert body["format"] == "json"
        assert body["count"] >= 1
        assert len(body["events"]) >= 1

        event = body["events"][0]
        assert "timestamp" in event
        assert "event_id" in event
        assert "action" in event
        assert "integrity_hash" in event
        assert event["source"] == "legalforge"


# ---------------------------------------------------------------------------
# SIEM export: Syslog
# ---------------------------------------------------------------------------

class TestSyslogExport:
    """GET /api/admin/audit-logs/export/syslog"""

    async def test_syslog_export(self, admin_client: AsyncClient):
        await admin_client.post("/api/clients", json=ClientFactory())

        resp = await admin_client.get("/api/admin/audit-logs/export/syslog")
        assert resp.status_code == 200
        content = resp.text
        # Syslog lines start with a PRI value in angle brackets
        assert "<" in content
        assert "legalforge" in content


# ---------------------------------------------------------------------------
# Chain verification endpoint
# ---------------------------------------------------------------------------

class TestChainVerification:
    """GET /api/admin/audit-logs/verify-chain"""

    async def test_verify_chain_on_empty_db(self, admin_client: AsyncClient):
        """Empty audit log should return status=empty."""
        resp = await admin_client.get("/api/admin/audit-logs/verify-chain")
        assert resp.status_code == 200
        body = resp.json()
        # Could be "empty" or "valid" depending on whether login audit was created
        assert body["status"] in ("empty", "valid")

    async def test_verify_chain_requires_admin(self, attorney_client: AsyncClient):
        resp = await attorney_client.get("/api/admin/audit-logs/verify-chain")
        assert resp.status_code == 403
