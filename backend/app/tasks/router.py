import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.tasks.models import TaskPriority, TaskStatus
from app.tasks.schemas import (
    ApplyWorkflowRequest,
    ChecklistItemCreate,
    ChecklistItemUpdate,
    DependencyCreate,
    TaskChecklistResponse,
    TaskCreate,
    TaskDependencyResponse,
    TaskResponse,
    TaskUpdate,
    WorkflowTemplateCreate,
    WorkflowTemplateResponse,
)
from app.tasks.service import (
    add_dependency,
    apply_workflow_template,
    create_checklist_item,
    create_task,
    create_workflow_template,
    delete_checklist_item,
    delete_task,
    delete_workflow_template,
    get_checklist_item,
    get_dependency,
    get_task,
    get_tasks,
    get_workflow_template,
    get_workflow_templates,
    remove_dependency,
    update_checklist_item,
    update_task,
)


# ── Task Router ───────────────────────────────────────────────────────

router = APIRouter()


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_new_task(
    data: TaskCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task = await create_task(db, data, current_user.id)
    await create_audit_log(
        db, current_user.id, "task", str(task.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return _task_to_response(task)


@router.get("", response_model=PaginatedResponse)
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    matter_id: Optional[uuid.UUID] = None,
    assigned_to: Optional[uuid.UUID] = None,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
):
    tasks, total = await get_tasks(db, page, page_size, matter_id, assigned_to, status, priority)
    items = [_task_to_response(t).model_dump() for t in tasks]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task_detail(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task = await get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _task_to_response(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_existing_task(
    task_id: uuid.UUID,
    data: TaskUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task = await get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    updated = await update_task(db, task, data)
    await create_audit_log(
        db, current_user.id, "task", str(task_id), "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return _task_to_response(updated)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_task(
    task_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task = await get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await delete_task(db, task)
    await create_audit_log(
        db, current_user.id, "task", str(task_id), "delete",
        ip_address=request.client.host if request.client else None,
    )


# ── Dependencies ──────────────────────────────────────────────────────

@router.post("/{task_id}/dependencies", response_model=TaskDependencyResponse, status_code=status.HTTP_201_CREATED)
async def add_task_dependency(
    task_id: uuid.UUID,
    data: DependencyCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    dep = await add_dependency(db, task_id, data.depends_on_id)
    await create_audit_log(
        db, current_user.id, "task_dependency", str(dep.id), "create",
        changes_json=json.dumps({"task_id": str(task_id), "depends_on_id": str(data.depends_on_id)}),
        ip_address=request.client.host if request.client else None,
    )
    return _dependency_to_response(dep)


@router.delete("/dependencies/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_task_dependency(
    dependency_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await remove_dependency(db, dependency_id)
    await create_audit_log(
        db, current_user.id, "task_dependency", str(dependency_id), "delete",
        ip_address=request.client.host if request.client else None,
    )


# ── Checklist ─────────────────────────────────────────────────────────

@router.post("/{task_id}/checklist", response_model=TaskChecklistResponse, status_code=status.HTTP_201_CREATED)
async def add_checklist_item(
    task_id: uuid.UUID,
    data: ChecklistItemCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    item = await create_checklist_item(db, task_id, data.title, data.sort_order)
    await create_audit_log(
        db, current_user.id, "task_checklist", str(item.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return item


@router.put("/checklist/{item_id}", response_model=TaskChecklistResponse)
async def update_checklist(
    item_id: uuid.UUID,
    data: ChecklistItemUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    item = await update_checklist_item(db, item_id, data.is_completed)
    await create_audit_log(
        db, current_user.id, "task_checklist", str(item_id), "update",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return item


@router.delete("/checklist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist(
    item_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await delete_checklist_item(db, item_id)
    await create_audit_log(
        db, current_user.id, "task_checklist", str(item_id), "delete",
        ip_address=request.client.host if request.client else None,
    )


# ── Workflow Router ───────────────────────────────────────────────────

workflow_router = APIRouter()


@workflow_router.get("", response_model=list[WorkflowTemplateResponse])
async def list_workflow_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    practice_area: Optional[str] = None,
):
    templates = await get_workflow_templates(db, practice_area)
    return templates


@workflow_router.post("", response_model=WorkflowTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_new_workflow_template(
    data: WorkflowTemplateCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    template = await create_workflow_template(db, data, current_user.id)
    await create_audit_log(
        db, current_user.id, "workflow_template", str(template.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return template


@workflow_router.get("/{template_id}", response_model=WorkflowTemplateResponse)
async def get_workflow_template_detail(
    template_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    template = await get_workflow_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow template not found")
    return template


@workflow_router.post("/{template_id}/apply", response_model=list[TaskResponse])
async def apply_template_to_matter(
    template_id: uuid.UUID,
    data: ApplyWorkflowRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    tasks = await apply_workflow_template(db, template_id, data.matter_id, current_user.id)
    await create_audit_log(
        db, current_user.id, "workflow_template", str(template_id), "apply",
        changes_json=json.dumps({"matter_id": str(data.matter_id), "tasks_created": len(tasks)}),
        ip_address=request.client.host if request.client else None,
    )
    return [_task_to_response(t) for t in tasks]


@workflow_router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_workflow_template(
    template_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    template = await get_workflow_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow template not found")

    await delete_workflow_template(db, template)
    await create_audit_log(
        db, current_user.id, "workflow_template", str(template_id), "delete",
        ip_address=request.client.host if request.client else None,
    )


# ── Response Helpers ──────────────────────────────────────────────────

def _task_to_response(task: "Task") -> TaskResponse:
    """Convert a Task ORM object to a TaskResponse with nested dependencies."""
    deps = []
    for dep in (task.dependencies or []):
        deps.append(TaskDependencyResponse(
            id=dep.id,
            task_id=dep.task_id,
            depends_on_id=dep.depends_on_id,
            depends_on_title=dep.depends_on.title if dep.depends_on else None,
        ))

    checklist = [
        TaskChecklistResponse.model_validate(item)
        for item in (task.checklist or [])
    ]

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        matter_id=task.matter_id,
        assigned_to=task.assigned_to,
        created_by=task.created_by,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        completed_at=task.completed_at,
        sort_order=task.sort_order,
        checklist=checklist,
        dependencies=deps,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _dependency_to_response(dep: "TaskDependency") -> TaskDependencyResponse:
    return TaskDependencyResponse(
        id=dep.id,
        task_id=dep.task_id,
        depends_on_id=dep.depends_on_id,
        depends_on_title=dep.depends_on.title if dep.depends_on else None,
    )
