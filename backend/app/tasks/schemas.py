import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.tasks.models import TaskPriority, TaskStatus


# ── Checklist Schemas ─────────────────────────────────────────────────

class ChecklistItemCreate(BaseModel):
    title: str = Field(max_length=500)
    sort_order: int = 0


class ChecklistItemUpdate(BaseModel):
    is_completed: bool


class TaskChecklistResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    is_completed: bool
    completed_at: Optional[datetime]
    sort_order: int

    model_config = {"from_attributes": True}


# ── Dependency Schemas ────────────────────────────────────────────────

class DependencyCreate(BaseModel):
    depends_on_id: uuid.UUID


class TaskDependencyResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    depends_on_id: uuid.UUID
    depends_on_title: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Task Schemas ──────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str = Field(max_length=500)
    description: Optional[str] = None
    matter_id: Optional[uuid.UUID] = None
    assigned_to: Optional[uuid.UUID] = None
    priority: TaskPriority = TaskPriority.medium
    due_date: Optional[date] = None
    checklist_items: Optional[list[ChecklistItemCreate]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[date] = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str]
    matter_id: Optional[uuid.UUID]
    assigned_to: Optional[uuid.UUID]
    created_by: uuid.UUID
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[date]
    completed_at: Optional[datetime]
    sort_order: int
    checklist: list[TaskChecklistResponse] = []
    dependencies: list[TaskDependencyResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Workflow Template Schemas ─────────────────────────────────────────

class WorkflowTemplateStepCreate(BaseModel):
    title: str = Field(max_length=500)
    description: Optional[str] = None
    assigned_role: Optional[str] = Field(default=None, max_length=50)
    relative_due_days: Optional[int] = None
    sort_order: int = 0
    depends_on_step_order: Optional[int] = None


class WorkflowTemplateStepResponse(BaseModel):
    id: uuid.UUID
    workflow_template_id: uuid.UUID
    title: str
    description: Optional[str]
    assigned_role: Optional[str]
    relative_due_days: Optional[int]
    sort_order: int
    depends_on_step_order: Optional[int]

    model_config = {"from_attributes": True}


class WorkflowTemplateCreate(BaseModel):
    name: str = Field(max_length=255)
    description: Optional[str] = None
    practice_area: Optional[str] = Field(default=None, max_length=100)
    steps: list[WorkflowTemplateStepCreate] = []


class WorkflowTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    practice_area: Optional[str]
    is_active: bool
    steps: list[WorkflowTemplateStepResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApplyWorkflowRequest(BaseModel):
    matter_id: uuid.UUID
