import base64

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import settings

_fernet = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"legalforge-field-encryption",
            iterations=100_000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(settings.field_encryption_key.encode()))
        _fernet = Fernet(key)
    return _fernet


def encrypt_field(value: str) -> str:
    if not value:
        return value
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_field(value: str) -> str:
    if not value:
        return value
    return _get_fernet().decrypt(value.encode()).decode()
