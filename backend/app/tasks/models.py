import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Task(UUIDBase, TimestampMixin):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    matter_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), nullable=False, default=TaskStatus.pending
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority), nullable=False, default=TaskPriority.medium
    )
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    matter = relationship("Matter", lazy="selectin")
    assignee = relationship("User", foreign_keys=[assigned_to], lazy="selectin")
    creator = relationship("User", foreign_keys=[created_by], lazy="selectin")
    checklist = relationship(
        "TaskChecklist", back_populates="task", lazy="selectin",
        cascade="all, delete-orphan", order_by="TaskChecklist.sort_order"
    )
    dependencies = relationship(
        "TaskDependency", back_populates="task", lazy="selectin",
        cascade="all, delete-orphan", foreign_keys="TaskDependency.task_id"
    )


class TaskDependency(UUIDBase):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_id", name="uq_task_dependency"),
    )

    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    depends_on_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    task = relationship("Task", foreign_keys=[task_id], back_populates="dependencies")
    depends_on = relationship("Task", foreign_keys=[depends_on_id], lazy="selectin")


class TaskChecklist(UUIDBase):
    __tablename__ = "task_checklists"

    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="checklist")


class WorkflowTemplate(UUIDBase, TimestampMixin):
    __tablename__ = "workflow_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    practice_area: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    creator = relationship("User", lazy="selectin")
    steps = relationship(
        "WorkflowTemplateStep", back_populates="workflow_template", lazy="selectin",
        cascade="all, delete-orphan", order_by="WorkflowTemplateStep.sort_order"
    )


class WorkflowTemplateStep(UUIDBase):
    __tablename__ = "workflow_template_steps"

    workflow_template_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    relative_due_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    depends_on_step_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    workflow_template = relationship("WorkflowTemplate", back_populates="steps")
