"""
Tests for the client CRUD endpoints.

Covers create (individual + organization), list with pagination/search,
get by ID, update, and admin-only delete.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import ClientFactory, OrganizationClientFactory


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class TestCreateClient:
    """POST /api/clients"""

    async def test_create_individual_client(self, admin_client: AsyncClient):
        data = ClientFactory()
        resp = await admin_client.post("/api/clients", json=data)
        assert resp.status_code == 201
        body = resp.json()
        assert body["client_type"] == "individual"
        assert body["first_name"] == data["first_name"]
        assert body["last_name"] == data["last_name"]
        assert body["email"] == data["email"]
        assert "id" in body
        assert "client_number" in body

    async def test_create_organization_client(self, admin_client: AsyncClient):
        data = OrganizationClientFactory()
        resp = await admin_client.post("/api/clients", json=data)
        assert resp.status_code == 201
        body = resp.json()
        assert body["client_type"] == "organization"
        assert body["organization_name"] == data["organization_name"]

    async def test_create_client_requires_auth(self, client: AsyncClient):
        data = ClientFactory()
        resp = await client.post("/api/clients", json=data)
        assert resp.status_code in (401, 403)

    async def test_attorney_can_create_client(self, attorney_client: AsyncClient):
        data = ClientFactory()
        resp = await attorney_client.post("/api/clients", json=data)
        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

class TestListClients:
    """GET /api/clients"""

    async def test_list_clients_with_pagination(self, admin_client: AsyncClient):
        # Create 3 clients
        for _ in range(3):
            await admin_client.post("/api/clients", json=ClientFactory())

        resp = await admin_client.get("/api/clients", params={"page": 1, "page_size": 2})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 3
        assert len(body["items"]) == 2
        assert body["page"] == 1
        assert body["page_size"] == 2

    async def test_list_clients_with_search(self, admin_client: AsyncClient):
        # Create a client with a known name
        unique_name = "Xylophonist"
        data = ClientFactory(first_name=unique_name)
        await admin_client.post("/api/clients", json=data)

        resp = await admin_client.get("/api/clients", params={"search": unique_name})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        found_names = [item["first_name"] for item in body["items"]]
        assert unique_name in found_names

    async def test_list_clients_with_status_filter(self, admin_client: AsyncClient):
        # Create an inactive client
        data = ClientFactory(status="inactive")
        await admin_client.post("/api/clients", json=data)

        resp = await admin_client.get("/api/clients", params={"status": "inactive"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        for item in body["items"]:
            assert item["status"] == "inactive"


# ---------------------------------------------------------------------------
# Get by ID
# ---------------------------------------------------------------------------

class TestGetClient:
    """GET /api/clients/{client_id}"""

    async def test_get_client_by_id(self, admin_client: AsyncClient, sample_client: dict):
        resp = await admin_client.get(f"/api/clients/{sample_client['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_client["id"]

    async def test_get_nonexistent_client(self, admin_client: AsyncClient):
        import uuid
        fake_id = str(uuid.uuid4())
        resp = await admin_client.get(f"/api/clients/{fake_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

class TestUpdateClient:
    """PUT /api/clients/{client_id}"""

    async def test_update_client(self, admin_client: AsyncClient, sample_client: dict):
        resp = await admin_client.put(
            f"/api/clients/{sample_client['id']}",
            json={"first_name": "Updated", "notes": "Updated notes"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["first_name"] == "Updated"
        assert body["notes"] == "Updated notes"

    async def test_update_client_status(self, admin_client: AsyncClient, sample_client: dict):
        resp = await admin_client.put(
            f"/api/clients/{sample_client['id']}",
            json={"status": "archived"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"


# ---------------------------------------------------------------------------
# Delete (admin only)
# ---------------------------------------------------------------------------

class TestDeleteClient:
    """DELETE /api/clients/{client_id}"""

    async def test_admin_can_delete_client(self, admin_client: AsyncClient):
        data = ClientFactory()
        create_resp = await admin_client.post("/api/clients", json=data)
        client_id = create_resp.json()["id"]

        resp = await admin_client.delete(f"/api/clients/{client_id}")
        assert resp.status_code == 204

        # Verify it's gone
        get_resp = await admin_client.get(f"/api/clients/{client_id}")
        assert get_resp.status_code == 404

    async def test_attorney_cannot_delete_client(self, attorney_client: AsyncClient, sample_client: dict):
        resp = await attorney_client.delete(f"/api/clients/{sample_client['id']}")
        assert resp.status_code == 403

    async def test_billing_clerk_cannot_delete_client(self, billing_client: AsyncClient, sample_client: dict):
        resp = await billing_client.delete(f"/api/clients/{sample_client['id']}")
        assert resp.status_code == 403
