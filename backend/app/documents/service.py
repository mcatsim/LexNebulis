import uuid
from io import BytesIO
from typing import Optional

from minio import Minio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.documents.models import Document

_minio_client = None


def get_minio_client() -> Minio:
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=settings.minio_use_ssl,
        )
        # Ensure bucket exists
        if not _minio_client.bucket_exists(settings.minio_bucket):
            _minio_client.make_bucket(settings.minio_bucket)
    return _minio_client


async def get_documents(
    db: AsyncSession,
    matter_id: Optional[uuid.UUID] = None,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
) -> tuple[list[Document], int]:
    query = select(Document)
    count_query = select(func.count(Document.id))

    if matter_id:
        query = query.where(Document.matter_id == matter_id)
        count_query = count_query.where(Document.matter_id == matter_id)

    if search:
        query = query.where(Document.filename.ilike(f"%{search}%"))
        count_query = count_query.where(Document.filename.ilike(f"%{search}%"))

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Document.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_document(db: AsyncSession, document_id: uuid.UUID) -> Optional[Document]:
    result = await db.execute(select(Document).where(Document.id == document_id))
    return result.scalar_one_or_none()


async def upload_document(
    db: AsyncSession,
    matter_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    filename: str,
    content: bytes,
    mime_type: str,
    description: Optional[str] = None,
    tags: Optional[list] = None,
    parent_document_id: Optional[uuid.UUID] = None,
) -> Document:
    storage_key = f"{matter_id}/{uuid.uuid4()}/{filename}"

    # Upload to MinIO
    client = get_minio_client()
    client.put_object(
        settings.minio_bucket,
        storage_key,
        BytesIO(content),
        length=len(content),
        content_type=mime_type,
    )

    # Determine version
    version = 1
    if parent_document_id:
        parent_result = await db.execute(select(Document).where(Document.id == parent_document_id))
        parent = parent_result.scalar_one_or_none()
        if parent:
            version = parent.version + 1

    doc = Document(
        matter_id=matter_id,
        uploaded_by=uploaded_by,
        filename=filename,
        storage_key=storage_key,
        mime_type=mime_type,
        size_bytes=len(content),
        version=version,
        parent_document_id=parent_document_id,
        tags_json=tags,
        description=description,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return doc


def get_download_url(storage_key: str, expires_hours: int = 1) -> str:
    from datetime import timedelta
    client = get_minio_client()
    return client.presigned_get_object(settings.minio_bucket, storage_key, expires=timedelta(hours=expires_hours))


async def delete_document(db: AsyncSession, document: Document) -> None:
    # Delete from MinIO
    client = get_minio_client()
    try:
        client.remove_object(settings.minio_bucket, document.storage_key)
    except Exception:
        pass  # File may already be deleted
    await db.delete(document)
    await db.flush()
