import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.accounting.models import AccountType, ExportFormat


# Chart of Accounts
class ChartOfAccountsCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    account_type: AccountType
    parent_code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    quickbooks_account_name: Optional[str] = None
    xero_account_code: Optional[str] = None


class ChartOfAccountsUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    account_type: Optional[AccountType] = None
    parent_code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    quickbooks_account_name: Optional[str] = None
    xero_account_code: Optional[str] = None


class ChartOfAccountsResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    account_type: AccountType
    parent_code: Optional[str]
    description: Optional[str]
    is_active: bool
    quickbooks_account_name: Optional[str]
    xero_account_code: Optional[str]
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Account Mappings
class AccountMappingCreate(BaseModel):
    source_type: str = Field(min_length=1, max_length=100)
    account_id: uuid.UUID
    description: Optional[str] = None
    is_default: bool = False


class AccountMappingUpdate(BaseModel):
    source_type: Optional[str] = Field(default=None, min_length=1, max_length=100)
    account_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None


class AccountMappingResponse(BaseModel):
    id: uuid.UUID
    source_type: str
    account_id: uuid.UUID
    description: Optional[str]
    is_default: bool
    created_at: datetime
    account_name: Optional[str] = None
    account_code: Optional[str] = None

    model_config = {"from_attributes": True}


# Export
class ExportRequest(BaseModel):
    format: ExportFormat
    export_type: str = Field(min_length=1, max_length=100)
    start_date: date
    end_date: date


class ExportHistoryResponse(BaseModel):
    id: uuid.UUID
    export_format: ExportFormat
    export_type: str
    start_date: date
    end_date: date
    record_count: int
    file_name: Optional[str]
    storage_key: Optional[str]
    exported_by: uuid.UUID
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ExportPreviewRow(BaseModel):
    values: dict[str, str]


class ExportPreview(BaseModel):
    row_count: int
    total_amount_cents: int
    sample_rows: list[ExportPreviewRow]
    export_type: str
    format: ExportFormat


# Seed
class SeedAccountsRequest(BaseModel):
    template: str = Field(default="law_firm_default", pattern="^(law_firm_default|minimal)$")
