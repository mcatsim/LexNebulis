from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.clients.models import Client
from app.contacts.models import Contact
from app.database import get_db
from app.dependencies import get_current_user
from app.documents.models import Document
from app.matters.models import Matter

router = APIRouter()


@router.get("")
async def global_search(
    q: str = Query(min_length=2, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Global search across clients, matters, contacts, and documents using PostgreSQL full-text search."""
    results = []
    search_term = f"%{q}%"

    # Search clients
    client_result = await db.execute(
        select(Client)
        .where(
            or_(
                Client.first_name.ilike(search_term),
                Client.last_name.ilike(search_term),
                Client.organization_name.ilike(search_term),
                Client.email.ilike(search_term),
            )
        )
        .limit(limit)
    )
    for c in client_result.scalars().all():
        results.append(
            {
                "type": "client",
                "id": str(c.id),
                "title": c.display_name,
                "subtitle": c.email or "",
                "client_number": c.client_number,
            }
        )

    # Search matters
    matter_result = await db.execute(
        select(Matter)
        .where(
            or_(
                Matter.title.ilike(search_term),
                Matter.case_number.ilike(search_term),
                Matter.description.ilike(search_term),
            )
        )
        .limit(limit)
    )
    for m in matter_result.scalars().all():
        results.append(
            {
                "type": "matter",
                "id": str(m.id),
                "title": m.title,
                "subtitle": f"#{m.matter_number} - {m.status.value}",
                "matter_number": m.matter_number,
            }
        )

    # Search contacts
    contact_result = await db.execute(
        select(Contact)
        .where(
            or_(
                Contact.first_name.ilike(search_term),
                Contact.last_name.ilike(search_term),
                Contact.organization.ilike(search_term),
                Contact.email.ilike(search_term),
            )
        )
        .limit(limit)
    )
    for co in contact_result.scalars().all():
        results.append(
            {
                "type": "contact",
                "id": str(co.id),
                "title": co.full_name,
                "subtitle": co.organization or co.email or "",
            }
        )

    # Search documents
    doc_result = await db.execute(select(Document).where(Document.filename.ilike(search_term)).limit(limit))
    for d in doc_result.scalars().all():
        results.append(
            {
                "type": "document",
                "id": str(d.id),
                "title": d.filename,
                "subtitle": f"{d.size_bytes // 1024}KB",
            }
        )

    return {"query": q, "results": results[:limit]}
