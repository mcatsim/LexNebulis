import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.calendar.models import CalendarEvent, EventStatus, EventType
from app.deadlines.models import (
    CourtRuleSet,
    DeadlineRule,
    GeneratedDeadline,
    MatterDeadlineConfig,
    OffsetType,
    StatuteOfLimitations,
    TriggerEvent,
)
from app.deadlines.schemas import (
    CourtRuleSetCreate,
    DeadlineRuleCreate,
    DeadlineRuleUpdate,
    StatuteOfLimitationsCreate,
    StatuteOfLimitationsUpdate,
    TriggerEventUpdate,
)

# ---------------------------------------------------------------------------
# Federal Civil Rules seed data
# ---------------------------------------------------------------------------

FEDERAL_CIVIL_RULES = [
    {
        "name": "Answer to Complaint",
        "trigger_event": "complaint_served",
        "offset_days": 21,
        "offset_type": "calendar_days",
    },
    {
        "name": "Answer to Complaint (US as defendant)",
        "trigger_event": "complaint_served",
        "offset_days": 60,
        "offset_type": "calendar_days",
    },
    {
        "name": "Motion to Dismiss (12(b))",
        "trigger_event": "complaint_served",
        "offset_days": 21,
        "offset_type": "calendar_days",
    },
    {
        "name": "Reply to Counterclaim",
        "trigger_event": "counterclaim_served",
        "offset_days": 21,
        "offset_type": "calendar_days",
    },
    {"name": "Response to Motion", "trigger_event": "motion_filed", "offset_days": 14, "offset_type": "calendar_days"},
    {
        "name": "Reply in Support of Motion",
        "trigger_event": "response_to_motion_filed",
        "offset_days": 7,
        "offset_type": "calendar_days",
    },
    {
        "name": "Initial Disclosures (FRCP 26(a)(1))",
        "trigger_event": "frcp_26f_conference",
        "offset_days": 14,
        "offset_type": "calendar_days",
    },
    {"name": "Discovery Cutoff", "trigger_event": "trial_date", "offset_days": -30, "offset_type": "calendar_days"},
    {"name": "Expert Reports Due", "trigger_event": "trial_date", "offset_days": -90, "offset_type": "calendar_days"},
    {
        "name": "Rebuttal Expert Reports",
        "trigger_event": "trial_date",
        "offset_days": -60,
        "offset_type": "calendar_days",
    },
    {
        "name": "Dispositive Motion Deadline",
        "trigger_event": "trial_date",
        "offset_days": -60,
        "offset_type": "calendar_days",
    },
    {"name": "Pretrial Conference", "trigger_event": "trial_date", "offset_days": -14, "offset_type": "calendar_days"},
    {
        "name": "Proposed Jury Instructions",
        "trigger_event": "trial_date",
        "offset_days": -7,
        "offset_type": "calendar_days",
    },
    {
        "name": "Notice of Appeal",
        "trigger_event": "judgment_entered",
        "offset_days": 30,
        "offset_type": "calendar_days",
    },
    {
        "name": "Motion for New Trial (FRCP 59)",
        "trigger_event": "judgment_entered",
        "offset_days": 28,
        "offset_type": "calendar_days",
    },
    {
        "name": "Motion to Alter Judgment (FRCP 59(e))",
        "trigger_event": "judgment_entered",
        "offset_days": 28,
        "offset_type": "calendar_days",
    },
]


# ---------------------------------------------------------------------------
# Date computation helpers
# ---------------------------------------------------------------------------


def compute_deadline_date(trigger_date: date, offset_days: int, offset_type: OffsetType) -> date:
    """Compute a deadline date from a trigger date and offset.

    For calendar_days: simple date arithmetic.
    For business_days: skip weekends (Mon-Fri only).
    If the computed date falls on a weekend, move to next Monday.
    """
    if offset_type == OffsetType.calendar_days:
        computed = trigger_date + timedelta(days=offset_days)
    else:
        # Business days calculation
        direction = 1 if offset_days >= 0 else -1
        remaining = abs(offset_days)
        current = trigger_date
        while remaining > 0:
            current += timedelta(days=direction)
            # weekday(): 0=Mon, 4=Fri, 5=Sat, 6=Sun
            if current.weekday() < 5:
                remaining -= 1
        computed = current

    # If computed date falls on weekend, move to next Monday
    if computed.weekday() == 5:  # Saturday
        computed += timedelta(days=2)
    elif computed.weekday() == 6:  # Sunday
        computed += timedelta(days=1)

    return computed


# ---------------------------------------------------------------------------
# Court Rule Sets
# ---------------------------------------------------------------------------


async def create_rule_set(db: AsyncSession, data: CourtRuleSetCreate, created_by: uuid.UUID) -> CourtRuleSet:
    rule_set = CourtRuleSet(
        name=data.name,
        jurisdiction=data.jurisdiction,
        court_type=data.court_type,
    )
    db.add(rule_set)
    await db.flush()
    await db.refresh(rule_set)
    return rule_set


async def get_rule_sets(
    db: AsyncSession,
    jurisdiction: Optional[str] = None,
    search: Optional[str] = None,
) -> list[CourtRuleSet]:
    query = select(CourtRuleSet).where(CourtRuleSet.is_active.is_(True))

    if jurisdiction:
        query = query.where(CourtRuleSet.jurisdiction.ilike(f"%{jurisdiction}%"))
    if search:
        query = query.where(CourtRuleSet.name.ilike(f"%{search}%"))

    query = query.order_by(CourtRuleSet.jurisdiction, CourtRuleSet.name)
    result = await db.execute(query)
    return result.scalars().all()


async def get_rule_set(db: AsyncSession, rule_set_id: uuid.UUID) -> Optional[CourtRuleSet]:
    result = await db.execute(
        select(CourtRuleSet).options(selectinload(CourtRuleSet.rules)).where(CourtRuleSet.id == rule_set_id)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Deadline Rules
# ---------------------------------------------------------------------------


async def create_deadline_rule(db: AsyncSession, data: DeadlineRuleCreate) -> DeadlineRule:
    rule = DeadlineRule(**data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


async def get_deadline_rule(db: AsyncSession, rule_id: uuid.UUID) -> Optional[DeadlineRule]:
    result = await db.execute(select(DeadlineRule).where(DeadlineRule.id == rule_id))
    return result.scalar_one_or_none()


async def update_deadline_rule(db: AsyncSession, rule: DeadlineRule, data: DeadlineRuleUpdate) -> DeadlineRule:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    await db.flush()
    await db.refresh(rule)
    return rule


async def delete_deadline_rule(db: AsyncSession, rule: DeadlineRule) -> None:
    await db.delete(rule)
    await db.flush()


# ---------------------------------------------------------------------------
# Matter Deadline Config (linking rule sets to matters)
# ---------------------------------------------------------------------------


async def apply_rule_set_to_matter(
    db: AsyncSession,
    matter_id: uuid.UUID,
    rule_set_id: uuid.UUID,
    created_by: uuid.UUID,
) -> MatterDeadlineConfig:
    # Check if already linked
    existing = await db.execute(
        select(MatterDeadlineConfig).where(
            and_(
                MatterDeadlineConfig.matter_id == matter_id,
                MatterDeadlineConfig.rule_set_id == rule_set_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        # Already linked — return existing
        result = await db.execute(
            select(MatterDeadlineConfig).where(
                and_(
                    MatterDeadlineConfig.matter_id == matter_id,
                    MatterDeadlineConfig.rule_set_id == rule_set_id,
                )
            )
        )
        return result.scalar_one()

    config = MatterDeadlineConfig(
        matter_id=matter_id,
        rule_set_id=rule_set_id,
        created_by=created_by,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


# ---------------------------------------------------------------------------
# Trigger Events & deadline generation
# ---------------------------------------------------------------------------


async def _get_rules_for_trigger(db: AsyncSession, matter_id: uuid.UUID, trigger_name: str) -> list[DeadlineRule]:
    """Find all active DeadlineRules that match a trigger_name for a matter's linked rule sets."""
    query = (
        select(DeadlineRule)
        .join(CourtRuleSet, DeadlineRule.rule_set_id == CourtRuleSet.id)
        .join(MatterDeadlineConfig, MatterDeadlineConfig.rule_set_id == CourtRuleSet.id)
        .where(
            and_(
                MatterDeadlineConfig.matter_id == matter_id,
                DeadlineRule.trigger_event == trigger_name,
                DeadlineRule.is_active.is_(True),
                CourtRuleSet.is_active.is_(True),
            )
        )
        .order_by(DeadlineRule.sort_order)
    )
    result = await db.execute(query)
    return result.scalars().all()


async def _get_matter_title(db: AsyncSession, matter_id: uuid.UUID) -> str:
    """Get a matter's display title for deadline event names."""
    from app.matters.models import Matter

    result = await db.execute(select(Matter.matter_number, Matter.title).where(Matter.id == matter_id))
    row = result.one_or_none()
    if row:
        return f"Matter #{row.matter_number}" if row.matter_number else row.title
    return str(matter_id)


async def _delete_generated_deadlines_for_trigger(db: AsyncSession, trigger_event_id: uuid.UUID) -> None:
    """Delete all generated deadlines and their calendar events for a trigger."""
    # First, get all calendar_event_ids to delete
    result = await db.execute(
        select(GeneratedDeadline.calendar_event_id).where(GeneratedDeadline.trigger_event_id == trigger_event_id)
    )
    event_ids = [row[0] for row in result.all()]

    if event_ids:
        # Delete generated deadline records
        await db.execute(delete(GeneratedDeadline).where(GeneratedDeadline.trigger_event_id == trigger_event_id))
        # Delete calendar events
        await db.execute(delete(CalendarEvent).where(CalendarEvent.id.in_(event_ids)))
        await db.flush()


async def _generate_deadlines_for_trigger(
    db: AsyncSession,
    trigger: TriggerEvent,
    created_by: Optional[uuid.UUID],
) -> list[GeneratedDeadline]:
    """Generate calendar events and GeneratedDeadline records for a trigger event."""
    rules = await _get_rules_for_trigger(db, trigger.matter_id, trigger.trigger_name)
    matter_label = await _get_matter_title(db, trigger.matter_id)

    generated = []
    for rule in rules:
        computed = compute_deadline_date(trigger.trigger_date, rule.offset_days, rule.offset_type)

        # Map rule's creates_event_type to EventType enum
        try:
            event_type = EventType(rule.creates_event_type)
        except ValueError:
            event_type = EventType.deadline

        event_title = f"{rule.name} — {matter_label}"

        # Create calendar event
        calendar_event = CalendarEvent(
            matter_id=trigger.matter_id,
            title=event_title,
            description=(
                f"Auto-generated from rule: {rule.name}."
                f" Trigger: {trigger.trigger_name}"
                f" on {trigger.trigger_date.isoformat()}."
            ),
            event_type=event_type,
            start_datetime=datetime(computed.year, computed.month, computed.day, tzinfo=timezone.utc),
            all_day=True,
            status=EventStatus.scheduled,
            created_by=created_by or trigger.created_by or uuid.uuid4(),
        )
        db.add(calendar_event)
        await db.flush()
        await db.refresh(calendar_event)

        # Create generated deadline record
        gen = GeneratedDeadline(
            calendar_event_id=calendar_event.id,
            trigger_event_id=trigger.id,
            deadline_rule_id=rule.id,
            matter_id=trigger.matter_id,
            computed_date=computed,
        )
        db.add(gen)
        await db.flush()
        generated.append(gen)

    return generated


async def set_trigger_event(
    db: AsyncSession,
    matter_id: uuid.UUID,
    trigger_name: str,
    trigger_date: date,
    created_by: uuid.UUID,
    notes: Optional[str] = None,
) -> tuple[TriggerEvent, list[GeneratedDeadline]]:
    """Create or update a trigger event. Recalculates all deadlines."""
    # Check if trigger already exists for this matter + trigger_name
    result = await db.execute(
        select(TriggerEvent).where(
            and_(
                TriggerEvent.matter_id == matter_id,
                TriggerEvent.trigger_name == trigger_name,
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Delete old generated deadlines
        await _delete_generated_deadlines_for_trigger(db, existing.id)
        # Update trigger
        existing.trigger_date = trigger_date
        existing.notes = notes
        await db.flush()
        await db.refresh(existing)
        trigger = existing
    else:
        trigger = TriggerEvent(
            matter_id=matter_id,
            trigger_name=trigger_name,
            trigger_date=trigger_date,
            notes=notes,
            created_by=created_by,
        )
        db.add(trigger)
        await db.flush()
        await db.refresh(trigger)

    # Generate new deadlines
    generated = await _generate_deadlines_for_trigger(db, trigger, created_by)
    return trigger, generated


async def update_trigger_event(
    db: AsyncSession,
    trigger: TriggerEvent,
    data: TriggerEventUpdate,
    created_by: uuid.UUID,
) -> tuple[TriggerEvent, list[GeneratedDeadline]]:
    """Update a trigger event and recalculate its deadlines."""
    # Delete old generated deadlines
    await _delete_generated_deadlines_for_trigger(db, trigger.id)

    # Update trigger fields
    if data.trigger_date is not None:
        trigger.trigger_date = data.trigger_date
    if data.notes is not None:
        trigger.notes = data.notes

    await db.flush()
    await db.refresh(trigger)

    # Regenerate
    generated = await _generate_deadlines_for_trigger(db, trigger, created_by)
    return trigger, generated


async def get_trigger_event(db: AsyncSession, trigger_id: uuid.UUID) -> Optional[TriggerEvent]:
    result = await db.execute(select(TriggerEvent).where(TriggerEvent.id == trigger_id))
    return result.scalar_one_or_none()


async def get_matter_trigger_events(db: AsyncSession, matter_id: uuid.UUID) -> list[TriggerEvent]:
    result = await db.execute(
        select(TriggerEvent).where(TriggerEvent.matter_id == matter_id).order_by(TriggerEvent.trigger_date)
    )
    return result.scalars().all()


async def delete_trigger_event(db: AsyncSession, trigger_event_id: uuid.UUID) -> None:
    """Delete a trigger event and all its generated deadlines/calendar events."""
    await _delete_generated_deadlines_for_trigger(db, trigger_event_id)
    result = await db.execute(select(TriggerEvent).where(TriggerEvent.id == trigger_event_id))
    trigger = result.scalar_one_or_none()
    if trigger:
        await db.delete(trigger)
        await db.flush()


# ---------------------------------------------------------------------------
# Matter Deadlines
# ---------------------------------------------------------------------------


async def get_matter_deadlines(db: AsyncSession, matter_id: uuid.UUID) -> list[dict]:
    """Get all generated deadlines for a matter with rule name and event title."""
    result = await db.execute(
        select(GeneratedDeadline)
        .options(selectinload(GeneratedDeadline.deadline_rule))
        .where(GeneratedDeadline.matter_id == matter_id)
        .order_by(GeneratedDeadline.computed_date)
    )
    deadlines = result.scalars().all()

    # Fetch calendar event titles
    if deadlines:
        event_ids = [d.calendar_event_id for d in deadlines]
        events_result = await db.execute(
            select(CalendarEvent.id, CalendarEvent.title).where(CalendarEvent.id.in_(event_ids))
        )
        event_titles = {row[0]: row[1] for row in events_result.all()}
    else:
        event_titles = {}

    items = []
    for d in deadlines:
        items.append(
            {
                "id": d.id,
                "calendar_event_id": d.calendar_event_id,
                "trigger_event_id": d.trigger_event_id,
                "deadline_rule_id": d.deadline_rule_id,
                "matter_id": d.matter_id,
                "computed_date": d.computed_date,
                "rule_name": d.deadline_rule.name if d.deadline_rule else None,
                "event_title": event_titles.get(d.calendar_event_id),
                "created_at": d.created_at,
            }
        )

    return items


# ---------------------------------------------------------------------------
# Statute of Limitations
# ---------------------------------------------------------------------------


async def create_statute_of_limitations(
    db: AsyncSession, data: StatuteOfLimitationsCreate, created_by: uuid.UUID
) -> StatuteOfLimitations:
    sol = StatuteOfLimitations(
        matter_id=data.matter_id,
        description=data.description,
        expiration_date=data.expiration_date,
        statute_reference=data.statute_reference,
        reminder_days=data.reminder_days if data.reminder_days else [90, 60, 30, 7, 1],
        created_by=created_by,
    )
    db.add(sol)
    await db.flush()
    await db.refresh(sol)
    return sol


async def get_statutes_of_limitations(db: AsyncSession, matter_id: uuid.UUID) -> list[StatuteOfLimitations]:
    result = await db.execute(
        select(StatuteOfLimitations)
        .where(StatuteOfLimitations.matter_id == matter_id)
        .order_by(StatuteOfLimitations.expiration_date)
    )
    return result.scalars().all()


async def get_statute_of_limitations(db: AsyncSession, sol_id: uuid.UUID) -> Optional[StatuteOfLimitations]:
    result = await db.execute(select(StatuteOfLimitations).where(StatuteOfLimitations.id == sol_id))
    return result.scalar_one_or_none()


async def update_statute_of_limitations(
    db: AsyncSession, sol: StatuteOfLimitations, data: StatuteOfLimitationsUpdate
) -> StatuteOfLimitations:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sol, field, value)
    await db.flush()
    await db.refresh(sol)
    return sol


async def delete_statute_of_limitations(db: AsyncSession, sol: StatuteOfLimitations) -> None:
    await db.delete(sol)
    await db.flush()


async def get_upcoming_sol_warnings(db: AsyncSession, days_ahead: int = 90) -> list[dict]:
    """Get statutes of limitations expiring within N days, with days_remaining calculated."""
    today = date.today()
    cutoff = today + timedelta(days=days_ahead)

    result = await db.execute(
        select(StatuteOfLimitations)
        .where(
            and_(
                StatuteOfLimitations.is_active.is_(True),
                StatuteOfLimitations.expiration_date <= cutoff,
                StatuteOfLimitations.expiration_date >= today,
            )
        )
        .order_by(StatuteOfLimitations.expiration_date)
    )
    sols = result.scalars().all()

    warnings = []
    for sol in sols:
        days_remaining = (sol.expiration_date - today).days
        warnings.append(
            {
                "id": sol.id,
                "matter_id": sol.matter_id,
                "description": sol.description,
                "expiration_date": sol.expiration_date,
                "statute_reference": sol.statute_reference,
                "reminder_days": sol.reminder_days,
                "is_active": sol.is_active,
                "days_remaining": days_remaining,
                "created_at": sol.created_at,
                "updated_at": sol.updated_at,
            }
        )

    return warnings


# ---------------------------------------------------------------------------
# Seed Federal Rules
# ---------------------------------------------------------------------------


async def seed_federal_rules(db: AsyncSession, created_by: uuid.UUID) -> CourtRuleSet:
    """Create or return the Federal Rules of Civil Procedure rule set with standard deadline rules."""
    # Check if it already exists
    result = await db.execute(
        select(CourtRuleSet).where(
            and_(
                CourtRuleSet.name == "Federal Rules of Civil Procedure",
                CourtRuleSet.jurisdiction == "Federal",
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    rule_set = CourtRuleSet(
        name="Federal Rules of Civil Procedure",
        jurisdiction="Federal",
        court_type="District",
    )
    db.add(rule_set)
    await db.flush()
    await db.refresh(rule_set)

    for idx, rule_data in enumerate(FEDERAL_CIVIL_RULES):
        rule = DeadlineRule(
            rule_set_id=rule_set.id,
            name=rule_data["name"],
            trigger_event=rule_data["trigger_event"],
            offset_days=rule_data["offset_days"],
            offset_type=OffsetType(rule_data["offset_type"]),
            creates_event_type="deadline",
            sort_order=idx,
        )
        db.add(rule)

    await db.flush()
    await db.refresh(rule_set)
    return rule_set
