from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.billing.router import router as billing_router
from app.calendar.router import router as calendar_router
from app.clients.router import router as clients_router
from app.config import settings
from app.conflicts.router import router as conflicts_router
from app.contacts.router import router as contacts_router
from app.deadlines.router import router as deadlines_router
from app.documents.router import router as documents_router
from app.matters.router import router as matters_router
from app.middleware import CorrelationIDMiddleware
from app.portal.router import client_router as portal_client_router
from app.portal.router import staff_router as portal_staff_router
from app.search.router import router as search_router
from app.tasks.router import router as tasks_router
from app.tasks.router import workflow_router
from app.templates.router import router as templates_router
from app.trust.router import router as trust_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: bootstrap admin user if needed
    from app.auth.service import bootstrap_admin

    await bootstrap_admin()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(CorrelationIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(clients_router, prefix="/api/clients", tags=["Clients"])
app.include_router(contacts_router, prefix="/api/contacts", tags=["Contacts"])
app.include_router(matters_router, prefix="/api/matters", tags=["Matters"])
app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
app.include_router(calendar_router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])
app.include_router(trust_router, prefix="/api/trust", tags=["Trust"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(search_router, prefix="/api/search", tags=["Search"])
app.include_router(conflicts_router, prefix="/api/conflicts", tags=["Conflicts"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(workflow_router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(templates_router, prefix="/api/templates", tags=["Templates"])
app.include_router(portal_staff_router, prefix="/api/portal", tags=["Portal (Staff)"])
app.include_router(portal_client_router, prefix="/api/portal", tags=["Portal (Client)"])
app.include_router(deadlines_router, prefix="/api/deadlines", tags=["Deadlines"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": settings.app_version}
