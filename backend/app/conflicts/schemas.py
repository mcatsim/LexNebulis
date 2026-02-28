import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.conflicts.models import ConflictStatus, MatchResolution, MatchType


class ConflictCheckCreate(BaseModel):
    search_name: str = Field(min_length=1, max_length=255)
    search_organization: Optional[str] = Field(default=None, max_length=255)
    matter_id: Optional[uuid.UUID] = None


class ConflictMatchResponse(BaseModel):
    id: uuid.UUID
    conflict_check_id: uuid.UUID
    matched_entity_type: str
    matched_entity_id: uuid.UUID
    matched_name: str
    match_type: MatchType
    match_score: float
    relationship_context: Optional[str]
    resolution: MatchResolution
    resolved_by: Optional[uuid.UUID]
    resolved_at: Optional[datetime]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class ConflictCheckResponse(BaseModel):
    id: uuid.UUID
    checked_by: uuid.UUID
    search_name: str
    search_organization: Optional[str]
    matter_id: Optional[uuid.UUID]
    status: ConflictStatus
    notes: Optional[str]
    matches: list[ConflictMatchResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ConflictCheckListResponse(BaseModel):
    id: uuid.UUID
    checked_by: uuid.UUID
    search_name: str
    search_organization: Optional[str]
    matter_id: Optional[uuid.UUID]
    status: ConflictStatus
    notes: Optional[str]
    match_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ConflictMatchResolve(BaseModel):
    resolution: MatchResolution
    notes: Optional[str] = None


class EthicalWallCreate(BaseModel):
    matter_id: uuid.UUID
    user_id: uuid.UUID
    reason: str = Field(min_length=1)


class EthicalWallResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    user_id: uuid.UUID
    reason: str
    created_by: uuid.UUID
    created_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}
