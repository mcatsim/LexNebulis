from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ScimName(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    given_name: str = Field(alias="givenName")
    family_name: str = Field(alias="familyName")


class ScimEmail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    value: str
    primary: bool = True
    type: str = "work"


class ScimEnterpriseUser(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    department: Optional[str] = None


class ScimUser(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemas: List[str] = [
        "urn:ietf:params:scim:schemas:core:2.0:User",
        "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
    ]
    id: str
    external_id: Optional[str] = Field(None, alias="externalId")
    user_name: str = Field(alias="userName")
    name: ScimName
    emails: List[ScimEmail]
    active: bool
    roles: Optional[List[Dict[str, str]]] = None
    enterprise_user: Optional[ScimEnterpriseUser] = Field(
        None,
        alias="urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
    )
    meta: Dict[str, str]


class ScimListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemas: List[str] = ["urn:ietf:params:scim:api:messages:2.0:ListResponse"]
    total_results: int = Field(alias="totalResults")
    start_index: int = Field(alias="startIndex")
    items_per_page: int = Field(alias="itemsPerPage")
    resources: List[ScimUser] = Field(alias="Resources")


class ScimError(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemas: List[str] = ["urn:ietf:params:scim:api:messages:2.0:Error"]
    status: str
    detail: str
    scim_type: Optional[str] = Field(None, alias="scimType")


class ScimPatchOp(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemas: List[str] = ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
    operations: List[Dict] = Field(alias="Operations")


class ScimBearerTokenCreate(BaseModel):
    description: str
    expires_in_days: Optional[int] = None


class ScimBearerTokenResponse(BaseModel):
    id: str
    description: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    is_active: bool


class ScimBearerTokenCreateResponse(ScimBearerTokenResponse):
    token: str
