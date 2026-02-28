from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_name: str = "LegalForge"
    app_version: str = "1.0.0"
    environment: str = "production"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://legalforge:legalforge@db:5432/legalforge"

    # Auth
    secret_key: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 30

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_root_user: str = "legalforge"
    minio_root_password: str = "CHANGE_ME"
    minio_bucket: str = "legalforge-documents"
    minio_use_ssl: bool = False

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Encryption
    field_encryption_key: str = "CHANGE_ME"

    # Admin bootstrap
    first_admin_email: str = "admin@example.com"
    first_admin_password: str = "CHANGE_ME"

    # CORS
    backend_cors_origins: list[str] = ["http://localhost", "http://localhost:5173"]

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
