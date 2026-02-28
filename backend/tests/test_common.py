"""
Tests for common utility modules.

Covers encryption/decryption roundtrip, pagination helper, and
the compute_integrity_hash function.
"""

import hashlib

import pytest

from app.common.audit import (
    ACTION_SEVERITY,
    AuditEventJSON,
    audit_to_cef,
    audit_to_syslog,
    compute_integrity_hash,
)
from app.common.encryption import decrypt_field, encrypt_field
from app.common.pagination import PaginatedResponse, PaginationParams


# ---------------------------------------------------------------------------
# Encryption
# ---------------------------------------------------------------------------

class TestEncryption:
    """encrypt_field / decrypt_field roundtrip."""

    def test_encrypt_decrypt_roundtrip(self):
        plaintext = "1234567890"
        ciphertext = encrypt_field(plaintext)
        assert ciphertext != plaintext
        assert decrypt_field(ciphertext) == plaintext

    def test_encrypt_empty_string(self):
        """Empty string should pass through unchanged."""
        assert encrypt_field("") == ""
        assert decrypt_field("") == ""

    def test_encrypt_special_characters(self):
        special = "ABCabc!@#$%^&*()_+-=[]{}|;':\",./<>?"
        encrypted = encrypt_field(special)
        assert decrypt_field(encrypted) == special

    def test_encrypt_unicode(self):
        text = "Legal opinion regarding clause"
        encrypted = encrypt_field(text)
        assert decrypt_field(encrypted) == text

    def test_different_plaintexts_produce_different_ciphertexts(self):
        c1 = encrypt_field("account-111")
        c2 = encrypt_field("account-222")
        assert c1 != c2


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class TestPaginationParams:
    """PaginationParams model."""

    def test_default_values(self):
        p = PaginationParams()
        assert p.page == 1
        assert p.page_size == 25

    def test_offset_calculation(self):
        p = PaginationParams(page=3, page_size=10)
        assert p.offset == 20

    def test_offset_page_one(self):
        p = PaginationParams(page=1, page_size=50)
        assert p.offset == 0

    def test_page_must_be_positive(self):
        with pytest.raises(Exception):
            PaginationParams(page=0, page_size=25)


class TestPaginatedResponse:
    """PaginatedResponse.create() factory method."""

    def test_create_with_items(self):
        resp = PaginatedResponse.create(
            items=[{"id": 1}, {"id": 2}], total=10, page=1, page_size=2,
        )
        assert resp.total == 10
        assert resp.page == 1
        assert resp.page_size == 2
        assert resp.total_pages == 5
        assert len(resp.items) == 2

    def test_create_empty(self):
        resp = PaginatedResponse.create(items=[], total=0, page=1, page_size=25)
        assert resp.total == 0
        assert resp.total_pages == 0

    def test_total_pages_ceiling(self):
        resp = PaginatedResponse.create(items=[], total=11, page=1, page_size=5)
        assert resp.total_pages == 3  # ceil(11/5)

    def test_total_pages_exact_division(self):
        resp = PaginatedResponse.create(items=[], total=20, page=1, page_size=10)
        assert resp.total_pages == 2


# ---------------------------------------------------------------------------
# Integrity hash
# ---------------------------------------------------------------------------

class TestComputeIntegrityHash:
    """compute_integrity_hash produces consistent SHA-256 digests."""

    def test_consistent_hash(self):
        h1 = compute_integrity_hash("id1", "2025-01-01", "user1", "create", "client", "c1", None, None)
        h2 = compute_integrity_hash("id1", "2025-01-01", "user1", "create", "client", "c1", None, None)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex digest length

    def test_different_inputs_produce_different_hash(self):
        h1 = compute_integrity_hash("id1", "2025-01-01", "user1", "create", "client", "c1", None, None)
        h2 = compute_integrity_hash("id2", "2025-01-01", "user1", "create", "client", "c1", None, None)
        assert h1 != h2

    def test_hash_includes_previous_hash(self):
        """Changing the previous_hash changes the output."""
        h1 = compute_integrity_hash("id1", "2025-01-01", "user1", "create", "client", "c1", None, None)
        h2 = compute_integrity_hash("id1", "2025-01-01", "user1", "create", "client", "c1", None, "abcdef")
        assert h1 != h2

    def test_hash_format_is_sha256(self):
        """The hash should match a manually computed SHA-256."""
        event_id = "test-id"
        ts = "2025-06-15T12:00:00"
        user_id = "user-uuid"
        action = "create"
        entity_type = "client"
        entity_id = "client-uuid"
        changes = None
        prev = None
        payload = f"{event_id}|{ts}|{user_id}|{action}|{entity_type}|{entity_id}||"
        expected = hashlib.sha256(payload.encode()).hexdigest()
        result = compute_integrity_hash(event_id, ts, user_id, action, entity_type, entity_id, changes, prev)
        assert result == expected

    def test_none_user_id(self):
        """None user_id should produce a valid hash (system actions)."""
        h = compute_integrity_hash("id1", "2025-01-01", None, "create", "system", "s1", None, None)
        assert len(h) == 64


# ---------------------------------------------------------------------------
# Audit format helpers
# ---------------------------------------------------------------------------

class TestAuditFormatHelpers:
    """audit_to_cef and audit_to_syslog converters."""

    def _sample_event(self) -> AuditEventJSON:
        return AuditEventJSON(
            timestamp="2025-06-15T12:00:00",
            event_id="evt-001",
            event_type="client.create",
            action="create",
            entity_type="client",
            entity_id="c-001",
            user_id="u-001",
            user_email="admin@test.com",
            ip_address="127.0.0.1",
            user_agent="TestAgent/1.0",
            changes={"name": "Test"},
            integrity_hash="abc123",
            previous_hash=None,
            severity="info",
            outcome="success",
        )

    def test_audit_to_cef(self):
        event = self._sample_event()
        cef = audit_to_cef(event)
        cef_str = cef.to_cef_string()
        assert cef_str.startswith("CEF:0|")
        assert "LegalForge" in cef_str
        assert "create" in cef_str

    def test_audit_to_syslog(self):
        event = self._sample_event()
        syslog = audit_to_syslog(event)
        syslog_str = syslog.to_syslog_string()
        assert "legalforge" in syslog_str
        assert "create" in syslog_str.lower()

    def test_action_severity_mapping(self):
        """Verify known actions have expected severities."""
        assert ACTION_SEVERITY["login"] == "info"
        assert ACTION_SEVERITY["delete"] == "medium"
        assert ACTION_SEVERITY["trust_disbursement"] == "high"
        assert ACTION_SEVERITY["restore"] == "critical"
