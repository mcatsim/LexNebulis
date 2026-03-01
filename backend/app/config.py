from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_name: str = "LexNebulis"
    app_version: str = "1.0.0"
    environment: str = "production"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://lexnebulis:lexnebulis@db:5432/lexnebulis"

    # Auth
    secret_key: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 30

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_root_user: str = "lexnebulis"
    minio_root_password: str = "CHANGE_ME"
    minio_bucket: str = "lexnebulis-documents"
    minio_use_ssl: bool = False

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Encryption
    field_encryption_key: str = "CHANGE_ME"

    # Admin bootstrap
    first_admin_email: str = "admin@example.com"
    first_admin_password: str = "CHANGE_ME"

    # WebAuthn / FIDO2
    webauthn_rp_id: str = "localhost"
    webauthn_rp_name: str = "LexNebulis"
    webauthn_origin: str = "http://localhost"

    # SSO
    sso_redirect_uri: str = "http://localhost/api/sso/callback"

    # Payment Processing
    payment_success_url: str = "http://localhost/payment/success"
    payment_cancel_url: str = "http://localhost/payment/cancel"

    # Cloud Storage OAuth
    google_drive_client_id: str = ""
    google_drive_client_secret: str = ""
    dropbox_app_key: str = ""
    dropbox_app_secret: str = ""
    box_client_id: str = ""
    box_client_secret: str = ""
    onedrive_client_id: str = ""
    onedrive_client_secret: str = ""
    cloud_storage_oauth_redirect_uri: str = "http://localhost/api/cloud-storage/connections/callback"

    # CORS
    backend_cors_origins: list[str] = ["http://localhost", "http://localhost:5173"]

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
