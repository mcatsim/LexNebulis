import uuid
from datetime import datetime, timezone
from typing import Optional

import jellyfish
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clients.models import Client
from app.conflicts.models import (
    ConflictCheck,
    ConflictMatch,
    ConflictStatus,
    EthicalWall,
    MatchResolution,
    MatchType,
)
from app.conflicts.schemas import ConflictCheckCreate, ConflictMatchResolve, EthicalWallCreate
from app.contacts.models import Contact
from app.matters.models import Matter, MatterContact


def _normalize(name: str) -> str:
    """Strip whitespace and lowercase a name for comparison."""
    return name.strip().lower()


def _compute_name_score(search: str, candidate: str) -> tuple[float, MatchType]:
    """Compare two names and return the best (score, match_type) pair.

    Returns the highest-scoring match found among the supported algorithms.
    """
    search_norm = _normalize(search)
    candidate_norm = _normalize(candidate)

    if not search_norm or not candidate_norm:
        return 0.0, MatchType.fuzzy

    # Exact match (case-insensitive)
    if search_norm == candidate_norm:
        return 1.0, MatchType.exact

    # Contains / partial match
    if search_norm in candidate_norm or candidate_norm in search_norm:
        return 0.7, MatchType.fuzzy

    # Phonetic matching via soundex and metaphone
    best_phonetic = 0.0
    try:
        if jellyfish.soundex(search_norm) == jellyfish.soundex(candidate_norm):
            best_phonetic = 0.6
        if jellyfish.metaphone(search_norm) == jellyfish.metaphone(candidate_norm):
            best_phonetic = max(best_phonetic, 0.6)
    except Exception:
        pass

    if best_phonetic > 0:
        return best_phonetic, MatchType.phonetic

    return 0.0, MatchType.fuzzy


def _compute_email_score(search_email: str, candidate_email: str) -> float:
    """Compare two email addresses; returns 0.9 for case-insensitive match."""
    if not search_email or not candidate_email:
        return 0.0
    if search_email.strip().lower() == candidate_email.strip().lower():
        return 0.9
    return 0.0


async def run_conflict_check(
    db: AsyncSession,
    data: ConflictCheckCreate,
    checked_by: uuid.UUID,
) -> ConflictCheck:
    """Run a full conflict-of-interest check across clients, contacts, and matter parties."""

    search_name = _normalize(data.search_name)
    search_org = _normalize(data.search_organization) if data.search_organization else None

    matches: list[dict] = []

    # ── Search Clients ────────────────────────────────────────────────
    client_result = await db.execute(select(Client))
    clients = client_result.scalars().all()

    for client in clients:
        best_score = 0.0
        best_type = MatchType.fuzzy
        matched_name = ""

        # Check full name (first + last)
        full_name = f"{client.first_name or ''} {client.last_name or ''}".strip()
        if full_name:
            score, mtype = _compute_name_score(data.search_name, full_name)
            if score > best_score:
                best_score, best_type, matched_name = score, mtype, full_name

        # Check organization name
        if client.organization_name:
            score, mtype = _compute_name_score(data.search_name, client.organization_name)
            if score > best_score:
                best_score, best_type, matched_name = score, mtype, client.organization_name

        # Check organization search against organization name
        if search_org and client.organization_name:
            score, mtype = _compute_name_score(data.search_organization, client.organization_name)
            if score > best_score:
                best_score, best_type, matched_name = score, mtype, client.organization_name

        # Check email
        if client.email:
            # We only do email matching if the search_name looks like an email
            email_score = _compute_email_score(data.search_name, client.email)
            if email_score > best_score:
                best_score = email_score
                best_type = MatchType.email
                matched_name = client.email

        if best_score > 0.4:
            matches.append({
                "matched_entity_type": "client",
                "matched_entity_id": client.id,
                "matched_name": matched_name,
                "match_type": best_type,
                "match_score": best_score,
                "relationship_context": f"Client #{client.client_number}" if client.client_number else "Client",
            })

    # ── Search Contacts ───────────────────────────────────────────────
    contact_result = await db.execute(select(Contact))
    contacts = contact_result.scalars().all()

    for contact in contacts:
        best_score = 0.0
        best_type = MatchType.fuzzy
        matched_name = ""

        full_name = f"{contact.first_name} {contact.last_name}".strip()
        if full_name:
            score, mtype = _compute_name_score(data.search_name, full_name)
            if score > best_score:
                best_score, best_type, matched_name = score, mtype, full_name

        # Check organization
        if contact.organization:
            score, mtype = _compute_name_score(data.search_name, contact.organization)
            if score > best_score:
                best_score, best_type, matched_name = score, mtype, contact.organization

        if search_org and contact.organization:
            score, mtype = _compute_name_score(data.search_organization, contact.organization)
            if score > best_score:
                best_score, best_type, matched_name = score, mtype, contact.organization

        # Check email
        if contact.email:
            email_score = _compute_email_score(data.search_name, contact.email)
            if email_score > best_score:
                best_score = email_score
                best_type = MatchType.email
                matched_name = contact.email

        if best_score > 0.4:
            matches.append({
                "matched_entity_type": "contact",
                "matched_entity_id": contact.id,
                "matched_name": matched_name,
                "match_type": best_type,
                "match_score": best_score,
                "relationship_context": f"Contact ({contact.role.value})",
            })

    # ── Search Matter Contacts (opposing parties) ─────────────────────
    mc_result = await db.execute(
        select(MatterContact).options(
            selectinload(MatterContact.contact),
            selectinload(MatterContact.matter),
        )
    )
    matter_contacts = mc_result.scalars().all()

    # Deduplicate: skip contacts we already matched above by tracking entity IDs
    matched_contact_ids = {m["matched_entity_id"] for m in matches if m["matched_entity_type"] == "contact"}

    for mc in matter_contacts:
        if mc.contact is None:
            continue
        contact = mc.contact
        if contact.id in matched_contact_ids:
            # Already matched as a contact; update context if this gives us matter info
            for existing in matches:
                if existing["matched_entity_id"] == contact.id and existing["matched_entity_type"] == "contact":
                    matter_title = mc.matter.title if mc.matter else "Unknown"
                    case_num = mc.matter.case_number if mc.matter else None
                    context = f"{mc.relationship_type} on Matter: {matter_title}"
                    if case_num:
                        context += f" (#{case_num})"
                    existing["relationship_context"] = context
            continue

        full_name = f"{contact.first_name} {contact.last_name}".strip()
        score, mtype = _compute_name_score(data.search_name, full_name)

        if score > 0.4:
            matter_title = mc.matter.title if mc.matter else "Unknown"
            case_num = mc.matter.case_number if mc.matter else None
            context = f"{mc.relationship_type} on Matter: {matter_title}"
            if case_num:
                context += f" (#{case_num})"

            matches.append({
                "matched_entity_type": "matter_party",
                "matched_entity_id": contact.id,
                "matched_name": full_name,
                "match_type": mtype,
                "match_score": score,
                "relationship_context": context,
            })
            matched_contact_ids.add(contact.id)

    # ── Determine overall status ──────────────────────────────────────
    if not matches:
        overall_status = ConflictStatus.clear
    else:
        max_score = max(m["match_score"] for m in matches)
        if max_score >= 0.9:
            overall_status = ConflictStatus.confirmed_conflict
        else:
            overall_status = ConflictStatus.potential_conflict

    # ── Persist ───────────────────────────────────────────────────────
    conflict_check = ConflictCheck(
        checked_by=checked_by,
        search_name=data.search_name,
        search_organization=data.search_organization,
        matter_id=data.matter_id,
        status=overall_status,
    )
    db.add(conflict_check)
    await db.flush()

    for match_data in matches:
        match_record = ConflictMatch(
            conflict_check_id=conflict_check.id,
            **match_data,
        )
        db.add(match_record)
    await db.flush()

    await db.refresh(conflict_check)
    return conflict_check


async def get_conflict_checks(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    matter_id: Optional[uuid.UUID] = None,
    status: Optional[ConflictStatus] = None,
) -> tuple[list[ConflictCheck], int]:
    """List past conflict checks with pagination."""
    query = select(ConflictCheck)
    count_query = select(func.count(ConflictCheck.id))

    if matter_id:
        query = query.where(ConflictCheck.matter_id == matter_id)
        count_query = count_query.where(ConflictCheck.matter_id == matter_id)

    if status:
        query = query.where(ConflictCheck.status == status)
        count_query = count_query.where(ConflictCheck.status == status)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(ConflictCheck.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_conflict_check(db: AsyncSession, check_id: uuid.UUID) -> Optional[ConflictCheck]:
    """Get a single conflict check with its matches."""
    result = await db.execute(select(ConflictCheck).where(ConflictCheck.id == check_id))
    return result.scalar_one_or_none()


async def resolve_match(
    db: AsyncSession,
    match_id: uuid.UUID,
    data: ConflictMatchResolve,
    resolved_by: uuid.UUID,
) -> Optional[ConflictMatch]:
    """Resolve a conflict match with a disposition."""
    result = await db.execute(select(ConflictMatch).where(ConflictMatch.id == match_id))
    match = result.scalar_one_or_none()
    if match is None:
        return None

    match.resolution = data.resolution
    match.resolved_by = resolved_by
    match.resolved_at = datetime.now(timezone.utc)
    match.notes = data.notes

    await db.flush()
    await db.refresh(match)
    return match


async def create_ethical_wall(
    db: AsyncSession,
    data: EthicalWallCreate,
    created_by: uuid.UUID,
) -> EthicalWall:
    """Create an ethical wall restricting a user from a matter."""
    wall = EthicalWall(
        matter_id=data.matter_id,
        user_id=data.user_id,
        reason=data.reason,
        created_by=created_by,
    )
    db.add(wall)
    await db.flush()
    await db.refresh(wall)
    return wall


async def get_ethical_walls(
    db: AsyncSession,
    matter_id: uuid.UUID,
) -> list[EthicalWall]:
    """Get all ethical walls for a specific matter."""
    result = await db.execute(
        select(EthicalWall).where(
            EthicalWall.matter_id == matter_id,
            EthicalWall.is_active == True,  # noqa: E712
        ).order_by(EthicalWall.created_at.desc())
    )
    return result.scalars().all()


async def check_ethical_wall(
    db: AsyncSession,
    matter_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """Check if a user is walled off from a matter. Returns True if walled."""
    result = await db.execute(
        select(func.count(EthicalWall.id)).where(
            EthicalWall.matter_id == matter_id,
            EthicalWall.user_id == user_id,
            EthicalWall.is_active == True,  # noqa: E712
        )
    )
    return result.scalar_one() > 0


async def remove_ethical_wall(
    db: AsyncSession,
    wall_id: uuid.UUID,
) -> Optional[EthicalWall]:
    """Deactivate an ethical wall (soft delete)."""
    result = await db.execute(select(EthicalWall).where(EthicalWall.id == wall_id))
    wall = result.scalar_one_or_none()
    if wall is None:
        return None

    wall.is_active = False
    await db.flush()
    await db.refresh(wall)
    return wall
