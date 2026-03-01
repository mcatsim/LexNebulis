from typing import Optional

from pydantic import BaseModel, model_validator


class SiemConfigCreate(BaseModel):
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    syslog_host: Optional[str] = None
    syslog_port: Optional[int] = 514
    syslog_protocol: str = "udp"
    syslog_tls_ca_cert: Optional[str] = None
    realtime_enabled: bool = False
    realtime_format: str = "json"

    model_config = {"from_attributes": True}


class SiemConfigUpdate(BaseModel):
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    syslog_host: Optional[str] = None
    syslog_port: Optional[int] = None
    syslog_protocol: Optional[str] = None
    syslog_tls_ca_cert: Optional[str] = None
    realtime_enabled: Optional[bool] = None
    realtime_format: Optional[str] = None

    model_config = {"from_attributes": True}


class SiemConfigResponse(BaseModel):
    id: str
    webhook_url: Optional[str] = None
    webhook_secret_masked: Optional[str] = None
    syslog_host: Optional[str] = None
    syslog_port: Optional[int] = None
    syslog_protocol: str
    syslog_tls_ca_cert: Optional[str] = None
    realtime_enabled: bool
    realtime_format: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def mask_secret(cls, values):
        if isinstance(values, dict):
            return values
        return values


class SoarActionResponse(BaseModel):
    success: bool
    message: str
    action: str
