"""
Tests for the health check endpoint.
"""

from httpx import AsyncClient


class TestHealthCheck:
    """GET /api/health"""

    async def test_health_check(self, client: AsyncClient):
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
