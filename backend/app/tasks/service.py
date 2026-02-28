import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.tasks.models import (
    Task,
    TaskChecklist,
    TaskDependency,
    TaskPriority,
    TaskStatus,
    WorkflowTemplate,
    WorkflowTemplateStep,
)
from app.tasks.schemas import (
    TaskCreate,
    TaskUpdate,
    WorkflowTemplateCreate,
)

# ── Task CRUD ─────────────────────────────────────────────────────────


async def create_task(db: AsyncSession, data: TaskCreate, created_by: uuid.UUID) -> Task:
    task = Task(
        title=data.title,
        description=data.description,
        matter_id=data.matter_id,
        assigned_to=data.assigned_to,
        created_by=created_by,
        priority=data.priority,
        due_date=data.due_date,
        status=TaskStatus.pending,
    )
    db.add(task)
    await db.flush()

    # Create checklist items if provided
    if data.checklist_items:
        for item in data.checklist_items:
            checklist_item = TaskChecklist(
                task_id=task.id,
                title=item.title,
                sort_order=item.sort_order,
            )
            db.add(checklist_item)
        await db.flush()

    await db.refresh(task)
    return task


async def get_tasks(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    matter_id: Optional[uuid.UUID] = None,
    assigned_to: Optional[uuid.UUID] = None,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
) -> tuple[list[Task], int]:
    query = select(Task)
    count_query = select(func.count(Task.id))

    if matter_id:
        query = query.where(Task.matter_id == matter_id)
        count_query = count_query.where(Task.matter_id == matter_id)
    if assigned_to:
        query = query.where(Task.assigned_to == assigned_to)
        count_query = count_query.where(Task.assigned_to == assigned_to)
    if status:
        query = query.where(Task.status == status)
        count_query = count_query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
        count_query = count_query.where(Task.priority == priority)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(Task.sort_order.asc(), Task.created_at.desc()).offset(offset).limit(page_size)
    )
    return result.scalars().all(), total


async def get_task(db: AsyncSession, task_id: uuid.UUID) -> Optional[Task]:
    result = await db.execute(select(Task).where(Task.id == task_id))
    return result.scalar_one_or_none()


async def update_task(db: AsyncSession, task: Task, data: TaskUpdate) -> Task:
    update_data = data.model_dump(exclude_unset=True)

    # If status changes to completed, set completed_at
    if "status" in update_data:
        if update_data["status"] == TaskStatus.completed and task.status != TaskStatus.completed:
            task.completed_at = datetime.now(timezone.utc)
        elif update_data["status"] != TaskStatus.completed:
            task.completed_at = None

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.flush()
    await db.refresh(task)
    return task


async def delete_task(db: AsyncSession, task: Task) -> None:
    await db.delete(task)
    await db.flush()


# ── Task Dependencies ─────────────────────────────────────────────────


async def _has_circular_dependency(db: AsyncSession, task_id: uuid.UUID, depends_on_id: uuid.UUID) -> bool:
    """Check if adding this dependency would create a circular reference."""
    # If task_id == depends_on_id, that's a self-reference
    if task_id == depends_on_id:
        return True

    # BFS to check if depends_on_id eventually depends on task_id
    visited = set()
    queue = [depends_on_id]

    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)

        result = await db.execute(select(TaskDependency.depends_on_id).where(TaskDependency.task_id == current))
        for (dep_id,) in result.all():
            if dep_id == task_id:
                return True
            queue.append(dep_id)

    return False


async def add_dependency(db: AsyncSession, task_id: uuid.UUID, depends_on_id: uuid.UUID) -> TaskDependency:
    # Validate both tasks exist
    task = await get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    depends_on = await get_task(db, depends_on_id)
    if depends_on is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency task not found")

    # Check for circular dependency
    if await _has_circular_dependency(db, task_id, depends_on_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Adding this dependency would create a circular reference",
        )

    # Check if dependency already exists
    existing = await db.execute(
        select(TaskDependency).where(
            TaskDependency.task_id == task_id,
            TaskDependency.depends_on_id == depends_on_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This dependency already exists",
        )

    dep = TaskDependency(task_id=task_id, depends_on_id=depends_on_id)
    db.add(dep)
    await db.flush()
    await db.refresh(dep)
    return dep


async def get_dependency(db: AsyncSession, dependency_id: uuid.UUID) -> Optional[TaskDependency]:
    result = await db.execute(select(TaskDependency).where(TaskDependency.id == dependency_id))
    return result.scalar_one_or_none()


async def remove_dependency(db: AsyncSession, dependency_id: uuid.UUID) -> None:
    dep = await get_dependency(db, dependency_id)
    if dep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")
    await db.delete(dep)
    await db.flush()


# ── Task Checklist ────────────────────────────────────────────────────


async def create_checklist_item(db: AsyncSession, task_id: uuid.UUID, title: str, sort_order: int = 0) -> TaskChecklist:
    task = await get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    item = TaskChecklist(task_id=task_id, title=title, sort_order=sort_order)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def get_checklist_item(db: AsyncSession, item_id: uuid.UUID) -> Optional[TaskChecklist]:
    result = await db.execute(select(TaskChecklist).where(TaskChecklist.id == item_id))
    return result.scalar_one_or_none()


async def update_checklist_item(db: AsyncSession, item_id: uuid.UUID, is_completed: bool) -> TaskChecklist:
    item = await get_checklist_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found")

    item.is_completed = is_completed
    if is_completed:
        item.completed_at = datetime.now(timezone.utc)
    else:
        item.completed_at = None

    await db.flush()
    await db.refresh(item)
    return item


async def delete_checklist_item(db: AsyncSession, item_id: uuid.UUID) -> None:
    item = await get_checklist_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found")
    await db.delete(item)
    await db.flush()


# ── Workflow Templates ────────────────────────────────────────────────


async def create_workflow_template(
    db: AsyncSession, data: WorkflowTemplateCreate, created_by: uuid.UUID
) -> WorkflowTemplate:
    template = WorkflowTemplate(
        name=data.name,
        description=data.description,
        practice_area=data.practice_area,
        created_by=created_by,
    )
    db.add(template)
    await db.flush()

    for step_data in data.steps:
        step = WorkflowTemplateStep(
            workflow_template_id=template.id,
            title=step_data.title,
            description=step_data.description,
            assigned_role=step_data.assigned_role,
            relative_due_days=step_data.relative_due_days,
            sort_order=step_data.sort_order,
            depends_on_step_order=step_data.depends_on_step_order,
        )
        db.add(step)

    await db.flush()
    await db.refresh(template)
    return template


async def get_workflow_templates(db: AsyncSession, practice_area: Optional[str] = None) -> list[WorkflowTemplate]:
    query = select(WorkflowTemplate).where(WorkflowTemplate.is_active == True)  # noqa: E712
    if practice_area:
        query = query.where(WorkflowTemplate.practice_area == practice_area)
    query = query.order_by(WorkflowTemplate.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


async def get_workflow_template(db: AsyncSession, template_id: uuid.UUID) -> Optional[WorkflowTemplate]:
    result = await db.execute(select(WorkflowTemplate).where(WorkflowTemplate.id == template_id))
    return result.scalar_one_or_none()


async def delete_workflow_template(db: AsyncSession, template: WorkflowTemplate) -> None:
    await db.delete(template)
    await db.flush()


async def apply_workflow_template(
    db: AsyncSession,
    template_id: uuid.UUID,
    matter_id: uuid.UUID,
    created_by: uuid.UUID,
) -> list[Task]:
    template = await get_workflow_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow template not found")

    # Map sort_order -> created task for dependency linking
    step_to_task: dict[int, Task] = {}
    created_tasks: list[Task] = []

    today = date.today()

    for step in sorted(template.steps, key=lambda s: s.sort_order):
        due_date = None
        if step.relative_due_days is not None:
            due_date = today + timedelta(days=step.relative_due_days)

        task = Task(
            title=step.title,
            description=step.description,
            matter_id=matter_id,
            created_by=created_by,
            status=TaskStatus.pending,
            priority=TaskPriority.medium,
            due_date=due_date,
            sort_order=step.sort_order,
        )
        db.add(task)
        await db.flush()

        step_to_task[step.sort_order] = task
        created_tasks.append(task)

    # Create dependencies based on depends_on_step_order
    for step in template.steps:
        if step.depends_on_step_order is not None and step.depends_on_step_order in step_to_task:
            task = step_to_task[step.sort_order]
            depends_on_task = step_to_task[step.depends_on_step_order]
            dep = TaskDependency(task_id=task.id, depends_on_id=depends_on_task.id)
            db.add(dep)

    await db.flush()

    # Refresh all tasks to include relationships
    for task in created_tasks:
        await db.refresh(task)

    return created_tasks
