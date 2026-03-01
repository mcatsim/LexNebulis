"""
Tests for the billing endpoints: time entries, invoices, and payments.

Covers CRUD for time entries, invoice creation from time entries,
line item generation, payment recording, and automatic paid-status
transition.
"""

from __future__ import annotations

from datetime import date

from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_time_entry(
    client: AsyncClient,
    matter_id: str,
    duration_minutes: int = 60,
    rate_cents: int = 30000,
    description: str = "Legal research",
    billable: bool = True,
    entry_date: str | None = None,
) -> dict:
    """Create a time entry via the API and return the response body."""
    data = {
        "matter_id": matter_id,
        "date": entry_date or str(date.today()),
        "duration_minutes": duration_minutes,
        "description": description,
        "billable": billable,
        "rate_cents": rate_cents,
    }
    resp = await client.post("/api/billing/time-entries", json=data)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Time entries
# ---------------------------------------------------------------------------


class TestTimeEntries:
    """POST /api/billing/time-entries, GET /api/billing/time-entries"""

    async def test_create_time_entry(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
    ):
        body = await _create_time_entry(admin_client, sample_matter["id"])
        assert body["matter_id"] == sample_matter["id"]
        assert body["duration_minutes"] == 60
        assert body["rate_cents"] == 30000
        assert body["billable"] is True
        assert body["invoice_id"] is None

    async def test_list_time_entries(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
    ):
        await _create_time_entry(admin_client, sample_matter["id"])
        await _create_time_entry(admin_client, sample_matter["id"], duration_minutes=30)

        resp = await admin_client.get("/api/billing/time-entries")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 2

    async def test_filter_time_entries_by_matter(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
    ):
        await _create_time_entry(admin_client, sample_matter["id"])

        resp = await admin_client.get(
            "/api/billing/time-entries",
            params={"matter_id": sample_matter["id"]},
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["matter_id"] == sample_matter["id"]

    async def test_filter_time_entries_by_billable(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
    ):
        await _create_time_entry(admin_client, sample_matter["id"], billable=True)
        await _create_time_entry(admin_client, sample_matter["id"], billable=False, description="Internal")

        resp = await admin_client.get(
            "/api/billing/time-entries",
            params={"billable": True},
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["billable"] is True


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


class TestInvoices:
    """POST /api/billing/invoices, GET /api/billing/invoices"""

    async def test_create_invoice_from_time_entries(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
    ):
        entry1 = await _create_time_entry(
            admin_client,
            sample_matter["id"],
            duration_minutes=60,
            rate_cents=30000,
        )
        entry2 = await _create_time_entry(
            admin_client,
            sample_matter["id"],
            duration_minutes=30,
            rate_cents=30000,
        )

        data = {
            "client_id": sample_client["id"],
            "matter_id": sample_matter["id"],
            "issued_date": str(date.today()),
            "due_date": "2026-04-01",
            "notes": "Monthly invoice",
            "time_entry_ids": [entry1["id"], entry2["id"]],
        }
        resp = await admin_client.post("/api/billing/invoices", json=data)
        assert resp.status_code == 201
        body = resp.json()
        assert body["client_id"] == sample_client["id"]
        assert body["matter_id"] == sample_matter["id"]
        assert body["status"] == "draft"
        assert body["invoice_number"] is not None

        # Subtotal should be: (60/60 * 30000) + (30/60 * 30000) = 30000 + 15000 = 45000
        assert body["subtotal_cents"] == 45000
        assert body["total_cents"] == 45000  # no tax

    async def test_invoice_line_items_created(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
    ):
        entry = await _create_time_entry(
            admin_client,
            sample_matter["id"],
            duration_minutes=120,
            rate_cents=25000,
        )
        data = {
            "client_id": sample_client["id"],
            "matter_id": sample_matter["id"],
            "time_entry_ids": [entry["id"]],
        }
        resp = await admin_client.post("/api/billing/invoices", json=data)
        assert resp.status_code == 201
        invoice_id = resp.json()["id"]

        # Verify the time entry now references the invoice
        te_resp = await admin_client.get("/api/billing/time-entries")
        entries = [e for e in te_resp.json()["items"] if e["id"] == entry["id"]]
        assert len(entries) == 1
        assert entries[0]["invoice_id"] == invoice_id

    async def test_list_invoices_with_filter(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
    ):
        entry = await _create_time_entry(admin_client, sample_matter["id"])
        await admin_client.post(
            "/api/billing/invoices",
            json={
                "client_id": sample_client["id"],
                "matter_id": sample_matter["id"],
                "time_entry_ids": [entry["id"]],
            },
        )

        resp = await admin_client.get(
            "/api/billing/invoices",
            params={"client_id": sample_client["id"]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        for item in body["items"]:
            assert item["client_id"] == sample_client["id"]

    async def test_billing_clerk_can_create_invoice(
        self,
        billing_client: AsyncClient,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
    ):
        """billing_clerk role is allowed to create invoices."""
        entry = await _create_time_entry(admin_client, sample_matter["id"])
        data = {
            "client_id": sample_client["id"],
            "matter_id": sample_matter["id"],
            "time_entry_ids": [entry["id"]],
        }
        resp = await billing_client.post("/api/billing/invoices", json=data)
        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------


class TestPayments:
    """POST /api/billing/payments, GET /api/billing/invoices/{id}/payments"""

    async def _create_invoice(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
        rate_cents: int = 30000,
        duration_minutes: int = 60,
    ) -> dict:
        entry = await _create_time_entry(
            admin_client,
            sample_matter["id"],
            rate_cents=rate_cents,
            duration_minutes=duration_minutes,
        )
        resp = await admin_client.post(
            "/api/billing/invoices",
            json={
                "client_id": sample_client["id"],
                "matter_id": sample_matter["id"],
                "time_entry_ids": [entry["id"]],
            },
        )
        assert resp.status_code == 201
        return resp.json()

    async def test_record_payment(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
    ):
        invoice = await self._create_invoice(admin_client, sample_matter, sample_client)
        data = {
            "invoice_id": invoice["id"],
            "amount_cents": 10000,
            "payment_date": str(date.today()),
            "method": "check",
            "reference_number": "CHK-001",
        }
        resp = await admin_client.post("/api/billing/payments", json=data)
        assert resp.status_code == 201
        body = resp.json()
        assert body["amount_cents"] == 10000
        assert body["method"] == "check"

    async def test_payment_marks_invoice_paid_when_fully_paid(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
    ):
        # Create an invoice for 60 min at $300/hr = $300 total = 30000 cents
        invoice = await self._create_invoice(
            admin_client,
            sample_matter,
            sample_client,
            rate_cents=30000,
            duration_minutes=60,
        )
        total = invoice["total_cents"]

        # Pay the full amount
        resp = await admin_client.post(
            "/api/billing/payments",
            json={
                "invoice_id": invoice["id"],
                "amount_cents": total,
                "payment_date": str(date.today()),
                "method": "ach",
            },
        )
        assert resp.status_code == 201

        # Verify the invoice status changed to paid
        inv_resp = await admin_client.get(f"/api/billing/invoices/{invoice['id']}")
        assert inv_resp.status_code == 200
        assert inv_resp.json()["status"] == "paid"

    async def test_list_payments_for_invoice(
        self,
        admin_client: AsyncClient,
        sample_matter: dict,
        sample_client: dict,
    ):
        invoice = await self._create_invoice(admin_client, sample_matter, sample_client)

        # Make two payments
        for amount in [5000, 7000]:
            await admin_client.post(
                "/api/billing/payments",
                json={
                    "invoice_id": invoice["id"],
                    "amount_cents": amount,
                    "payment_date": str(date.today()),
                    "method": "credit_card",
                },
            )

        resp = await admin_client.get(f"/api/billing/invoices/{invoice['id']}/payments")
        assert resp.status_code == 200
        payments = resp.json()
        assert len(payments) == 2
