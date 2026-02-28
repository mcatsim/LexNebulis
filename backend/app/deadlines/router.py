import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.database import get_db
from app.deadlines.schemas import (
    CourtRuleSetCreate,
    CourtRuleSetResponse,
    DeadlineRuleCreate,
    DeadlineRuleResponse,
    DeadlineRuleUpdate,
    GeneratedDeadlineResponse,
    MatterDeadlineConfigCreate,
    MatterDeadlineConfigResponse,
    SOLWarningResponse,
    StatuteOfLimitationsCreate,
    StatuteOfLimitationsResponse,
    StatuteOfLimitationsUpdate,
    TriggerEventCreate,
    TriggerEventResponse,
    TriggerEventUpdate,
)
from app.deadlines.service import (
    apply_rule_set_to_matter,
    create_deadline_rule,
    create_rule_set,
    create_statute_of_limitations,
    delete_deadline_rule,
    delete_statute_of_limitations,
    delete_trigger_event,
    get_deadline_rule,
    get_matter_deadlines,
    get_matter_trigger_events,
    get_rule_set,
    get_rule_sets,
    get_statute_of_limitations,
    get_statutes_of_limitations,
    get_trigger_event,
    get_upcoming_sol_warnings,
    seed_federal_rules,
    set_trigger_event,
    update_deadline_rule,
    update_statute_of_limitations,
    update_trigger_event,
)
from app.dependencies import get_current_user, require_roles

router = APIRouter()


# ---------------------------------------------------------------------------
# Court Rule Sets
# ---------------------------------------------------------------------------


@router.get("/rules", response_model=list[CourtRuleSetResponse])
async def list_rule_sets(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    jurisdiction: Optional[str] = None,
    search: Optional[str] = None,
):
    rule_sets = await get_rule_sets(db, jurisdiction=jurisdiction, search=search)
    return [CourtRuleSetResponse.model_validate(rs) for rs in rule_sets]


@router.post("/rules", response_model=CourtRuleSetResponse, status_code=status.HTTP_201_CREATED)
async def create_new_rule_set(
    data: CourtRuleSetCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    rule_set = await create_rule_set(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "court_rule_set",
        str(rule_set.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return CourtRuleSetResponse.model_validate(rule_set)


@router.get("/rules/{rule_set_id}", response_model=CourtRuleSetResponse)
async def get_rule_set_detail(
    rule_set_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    rule_set = await get_rule_set(db, rule_set_id)
    if rule_set is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")
    return CourtRuleSetResponse.model_validate(rule_set)


@router.post("/rules/{rule_set_id}/rules", response_model=DeadlineRuleResponse, status_code=status.HTTP_201_CREATED)
async def add_deadline_rule(
    rule_set_id: uuid.UUID,
    data: DeadlineRuleCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    # Verify rule set exists
    rule_set = await get_rule_set(db, rule_set_id)
    if rule_set is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule set not found")

    # Override rule_set_id from path
    data.rule_set_id = rule_set_id
    rule = await create_deadline_rule(db, data)
    await create_audit_log(
        db,
        current_user.id,
        "deadline_rule",
        str(rule.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return DeadlineRuleResponse.model_validate(rule)


@router.put("/rules/rules/{rule_id}", response_model=DeadlineRuleResponse)
async def update_existing_deadline_rule(
    rule_id: uuid.UUID,
    data: DeadlineRuleUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    rule = await get_deadline_rule(db, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline rule not found")

    updated = await update_deadline_rule(db, rule, data)
    await create_audit_log(
        db,
        current_user.id,
        "deadline_rule",
        str(rule_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return DeadlineRuleResponse.model_validate(updated)


@router.delete("/rules/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_deadline_rule(
    rule_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    rule = await get_deadline_rule(db, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline rule not found")

    await delete_deadline_rule(db, rule)
    await create_audit_log(
        db,
        current_user.id,
        "deadline_rule",
        str(rule_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.post("/rules/seed-federal", response_model=CourtRuleSetResponse, status_code=status.HTTP_201_CREATED)
async def seed_federal_civil_rules(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    rule_set = await seed_federal_rules(db, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "court_rule_set",
        str(rule_set.id),
        "seed",
        changes_json=json.dumps({"action": "seed_federal_rules"}),
        ip_address=request.client.host if request.client else None,
    )
    return CourtRuleSetResponse.model_validate(rule_set)


# ---------------------------------------------------------------------------
# Matter Deadlines
# ---------------------------------------------------------------------------


@router.post(
    "/matters/{matter_id}/apply-rules",
    response_model=MatterDeadlineConfigResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply_rules_to_matter(
    matter_id: uuid.UUID,
    data: MatterDeadlineConfigCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    config = await apply_rule_set_to_matter(db, matter_id, data.rule_set_id, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "matter_deadline_config",
        str(config.id),
        "create",
        changes_json=json.dumps({"matter_id": str(matter_id), "rule_set_id": str(data.rule_set_id)}),
        ip_address=request.client.host if request.client else None,
    )
    return MatterDeadlineConfigResponse.model_validate(config)


@router.post("/matters/{matter_id}/triggers", response_model=TriggerEventResponse, status_code=status.HTTP_201_CREATED)
async def create_trigger_event(
    matter_id: uuid.UUID,
    data: TriggerEventCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    trigger, generated = await set_trigger_event(
        db, matter_id, data.trigger_name, data.trigger_date, current_user.id, data.notes
    )
    await create_audit_log(
        db,
        current_user.id,
        "trigger_event",
        str(trigger.id),
        "create",
        changes_json=json.dumps(
            {
                "trigger_name": data.trigger_name,
                "trigger_date": data.trigger_date.isoformat(),
                "deadlines_generated": len(generated),
            }
        ),
        ip_address=request.client.host if request.client else None,
    )
    return TriggerEventResponse.model_validate(trigger)


@router.get("/matters/{matter_id}/triggers", response_model=list[TriggerEventResponse])
async def list_trigger_events(
    matter_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    triggers = await get_matter_trigger_events(db, matter_id)
    return [TriggerEventResponse.model_validate(t) for t in triggers]


@router.put("/triggers/{trigger_id}", response_model=TriggerEventResponse)
async def update_existing_trigger(
    trigger_id: uuid.UUID,
    data: TriggerEventUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    trigger = await get_trigger_event(db, trigger_id)
    if trigger is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger event not found")

    updated, generated = await update_trigger_event(db, trigger, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "trigger_event",
        str(trigger_id),
        "update",
        changes_json=json.dumps(
            {
                "changes": data.model_dump(exclude_unset=True),
                "deadlines_regenerated": len(generated),
            },
            default=str,
        ),
        ip_address=request.client.host if request.client else None,
    )
    return TriggerEventResponse.model_validate(updated)


@router.delete("/triggers/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_trigger(
    trigger_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    trigger = await get_trigger_event(db, trigger_id)
    if trigger is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger event not found")

    await delete_trigger_event(db, trigger_id)
    await create_audit_log(
        db,
        current_user.id,
        "trigger_event",
        str(trigger_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.get("/matters/{matter_id}/deadlines", response_model=list[GeneratedDeadlineResponse])
async def list_matter_deadlines(
    matter_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    deadlines = await get_matter_deadlines(db, matter_id)
    return [GeneratedDeadlineResponse.model_validate(d) for d in deadlines]


# ---------------------------------------------------------------------------
# Statute of Limitations
# ---------------------------------------------------------------------------


@router.get("/sol/warnings", response_model=list[SOLWarningResponse])
async def list_sol_warnings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days_ahead: int = 90,
):
    warnings = await get_upcoming_sol_warnings(db, days_ahead)
    return [SOLWarningResponse.model_validate(w) for w in warnings]


@router.post("/sol", response_model=StatuteOfLimitationsResponse, status_code=status.HTTP_201_CREATED)
async def create_sol_entry(
    data: StatuteOfLimitationsCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    sol = await create_statute_of_limitations(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "statute_of_limitations",
        str(sol.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return StatuteOfLimitationsResponse.model_validate(sol)


@router.get("/sol/{matter_id}", response_model=list[StatuteOfLimitationsResponse])
async def list_sol_entries(
    matter_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    sols = await get_statutes_of_limitations(db, matter_id)
    today = __import__("datetime").date.today()
    results = []
    for sol in sols:
        resp = StatuteOfLimitationsResponse.model_validate(sol)
        resp.days_remaining = (sol.expiration_date - today).days
        results.append(resp)
    return results


@router.put("/sol/{sol_id}", response_model=StatuteOfLimitationsResponse)
async def update_sol_entry(
    sol_id: uuid.UUID,
    data: StatuteOfLimitationsUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    sol = await get_statute_of_limitations(db, sol_id)
    if sol is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statute of limitations not found")

    updated = await update_statute_of_limitations(db, sol, data)
    await create_audit_log(
        db,
        current_user.id,
        "statute_of_limitations",
        str(sol_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return StatuteOfLimitationsResponse.model_validate(updated)


@router.delete("/sol/{sol_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sol_entry(
    sol_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    sol = await get_statute_of_limitations(db, sol_id)
    if sol is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statute of limitations not found")

    await delete_statute_of_limitations(db, sol)
    await create_audit_log(
        db,
        current_user.id,
        "statute_of_limitations",
        str(sol_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )
