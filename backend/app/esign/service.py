import hashlib
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

from minio import Minio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.documents.models import Document
from app.esign.models import SignatureAuditEntry, SignatureRequest, SignatureRequestStatus, Signer, SignerStatus
from app.esign.schemas import CertificateOfCompletion, CertificateSignerInfo, SignatureRequestCreate

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
        if not _minio_client.bucket_exists(settings.minio_bucket):
            _minio_client.make_bucket(settings.minio_bucket)
    return _minio_client


async def create_signature_request(
    db: AsyncSession,
    data: SignatureRequestCreate,
    created_by: uuid.UUID,
) -> SignatureRequest:
    sig_request = SignatureRequest(
        document_id=data.document_id,
        matter_id=data.matter_id,
        created_by=created_by,
        title=data.title,
        message=data.message,
        expires_at=data.expires_at,
        status=SignatureRequestStatus.draft,
    )
    db.add(sig_request)
    await db.flush()

    for signer_data in data.signers:
        signer = Signer(
            signature_request_id=sig_request.id,
            name=signer_data.name,
            email=signer_data.email,
            role=signer_data.role,
            order=signer_data.order,
            access_token=uuid.uuid4().hex,
            status=SignerStatus.pending,
        )
        db.add(signer)

    # Create audit entry
    audit = SignatureAuditEntry(
        signature_request_id=sig_request.id,
        action="created",
        details=f"Signature request created with {len(data.signers)} signer(s)",
    )
    db.add(audit)

    await db.flush()
    await db.refresh(sig_request)
    return sig_request


async def send_signature_request(
    db: AsyncSession,
    request_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> SignatureRequest:
    result = await db.execute(select(SignatureRequest).where(SignatureRequest.id == request_id))
    sig_request = result.scalar_one_or_none()
    if sig_request is None:
        raise ValueError("Signature request not found")
    if sig_request.status != SignatureRequestStatus.draft:
        raise ValueError("Only draft requests can be sent")

    sig_request.status = SignatureRequestStatus.pending

    # Create audit entries for each signer
    for signer in sig_request.signers:
        audit = SignatureAuditEntry(
            signature_request_id=sig_request.id,
            signer_id=signer.id,
            action="sent",
            ip_address=ip_address,
            details=f"Signing request sent to {signer.email}",
        )
        db.add(audit)

    await db.flush()
    await db.refresh(sig_request)
    return sig_request


async def get_signing_page_info(
    db: AsyncSession,
    access_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[Signer, SignatureRequest, str]:
    result = await db.execute(select(Signer).where(Signer.access_token == access_token))
    signer = result.scalar_one_or_none()
    if signer is None:
        raise ValueError("Invalid access token")

    req_result = await db.execute(select(SignatureRequest).where(SignatureRequest.id == signer.signature_request_id))
    sig_request = req_result.scalar_one_or_none()
    if sig_request is None:
        raise ValueError("Signature request not found")

    # Check expiration
    if sig_request.expires_at and sig_request.expires_at < datetime.now(timezone.utc):
        sig_request.status = SignatureRequestStatus.expired
        audit = SignatureAuditEntry(
            signature_request_id=sig_request.id,
            action="expired",
            details="Signature request has expired",
        )
        db.add(audit)
        await db.flush()
        raise ValueError("Signature request has expired")

    if sig_request.status not in (SignatureRequestStatus.pending, SignatureRequestStatus.partially_signed):
        raise ValueError(f"Signature request is {sig_request.status.value}")

    # Create audit entry for viewing
    if signer.status == SignerStatus.pending:
        signer.status = SignerStatus.viewed
        audit = SignatureAuditEntry(
            signature_request_id=sig_request.id,
            signer_id=signer.id,
            action="viewed",
            ip_address=ip_address,
            user_agent=user_agent,
            details=f"{signer.name} viewed the document",
        )
        db.add(audit)
        await db.flush()

    # Get document download URL
    from app.documents.service import get_download_url

    doc_result = await db.execute(select(Document).where(Document.id == sig_request.document_id))
    document = doc_result.scalar_one_or_none()
    if document is None:
        raise ValueError("Document not found")

    download_url = get_download_url(document.storage_key)

    return signer, sig_request, download_url


async def sign_document(
    db: AsyncSession,
    access_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Signer:
    result = await db.execute(select(Signer).where(Signer.access_token == access_token))
    signer = result.scalar_one_or_none()
    if signer is None:
        raise ValueError("Invalid access token")

    req_result = await db.execute(select(SignatureRequest).where(SignatureRequest.id == signer.signature_request_id))
    sig_request = req_result.scalar_one_or_none()
    if sig_request is None:
        raise ValueError("Signature request not found")

    # Check expiration
    if sig_request.expires_at and sig_request.expires_at < datetime.now(timezone.utc):
        sig_request.status = SignatureRequestStatus.expired
        await db.flush()
        raise ValueError("Signature request has expired")

    if sig_request.status not in (SignatureRequestStatus.pending, SignatureRequestStatus.partially_signed):
        raise ValueError(f"Signature request is {sig_request.status.value}")

    if signer.status == SignerStatus.signed:
        raise ValueError("Already signed")
    if signer.status == SignerStatus.declined:
        raise ValueError("Signer has declined")

    # Record signature
    now = datetime.now(timezone.utc)
    signer.status = SignerStatus.signed
    signer.signed_at = now
    signer.signed_ip = ip_address
    signer.signed_user_agent = user_agent

    # Create audit entry
    audit = SignatureAuditEntry(
        signature_request_id=sig_request.id,
        signer_id=signer.id,
        action="signed",
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"{signer.name} signed the document",
    )
    db.add(audit)

    # Check if all signers have signed
    all_signers_result = await db.execute(select(Signer).where(Signer.signature_request_id == sig_request.id))
    all_signers = all_signers_result.scalars().all()
    all_signed = all(s.status == SignerStatus.signed or s.id == signer.id for s in all_signers)

    if all_signed:
        sig_request.status = SignatureRequestStatus.completed
        sig_request.completed_at = now

        # Generate certificate of completion
        await _generate_certificate(db, sig_request, all_signers)

        completed_audit = SignatureAuditEntry(
            signature_request_id=sig_request.id,
            action="completed",
            details="All signers have signed. Request completed.",
        )
        db.add(completed_audit)
    else:
        sig_request.status = SignatureRequestStatus.partially_signed

    await db.flush()
    await db.refresh(signer)
    return signer


async def decline_document(
    db: AsyncSession,
    access_token: str,
    reason: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Signer:
    result = await db.execute(select(Signer).where(Signer.access_token == access_token))
    signer = result.scalar_one_or_none()
    if signer is None:
        raise ValueError("Invalid access token")

    req_result = await db.execute(select(SignatureRequest).where(SignatureRequest.id == signer.signature_request_id))
    sig_request = req_result.scalar_one_or_none()
    if sig_request is None:
        raise ValueError("Signature request not found")

    if sig_request.status not in (SignatureRequestStatus.pending, SignatureRequestStatus.partially_signed):
        raise ValueError(f"Signature request is {sig_request.status.value}")

    if signer.status in (SignerStatus.signed, SignerStatus.declined):
        raise ValueError(f"Signer has already {signer.status.value}")

    # Record decline
    signer.status = SignerStatus.declined
    signer.decline_reason = reason

    # Cancel the entire request
    sig_request.status = SignatureRequestStatus.cancelled

    # Create audit entry
    audit = SignatureAuditEntry(
        signature_request_id=sig_request.id,
        signer_id=signer.id,
        action="declined",
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"{signer.name} declined to sign. Reason: {reason}",
    )
    db.add(audit)

    cancelled_audit = SignatureAuditEntry(
        signature_request_id=sig_request.id,
        action="cancelled",
        details="Request cancelled due to signer declining",
    )
    db.add(cancelled_audit)

    await db.flush()
    await db.refresh(signer)
    return signer


async def cancel_signature_request(
    db: AsyncSession,
    request_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> SignatureRequest:
    result = await db.execute(select(SignatureRequest).where(SignatureRequest.id == request_id))
    sig_request = result.scalar_one_or_none()
    if sig_request is None:
        raise ValueError("Signature request not found")
    if sig_request.status in (SignatureRequestStatus.completed, SignatureRequestStatus.cancelled):
        raise ValueError(f"Cannot cancel a {sig_request.status.value} request")

    sig_request.status = SignatureRequestStatus.cancelled

    audit = SignatureAuditEntry(
        signature_request_id=sig_request.id,
        action="cancelled",
        ip_address=ip_address,
        details="Signature request cancelled by creator",
    )
    db.add(audit)

    await db.flush()
    await db.refresh(sig_request)
    return sig_request


async def _generate_certificate(
    db: AsyncSession,
    sig_request: SignatureRequest,
    signers: list[Signer],
) -> None:
    # Get document for hash
    doc_result = await db.execute(select(Document).where(Document.id == sig_request.document_id))
    document = doc_result.scalar_one_or_none()

    document_hash = None
    if document:
        try:
            client = get_minio_client()
            response = client.get_object(settings.minio_bucket, document.storage_key)
            content = response.read()
            response.close()
            response.release_conn()
            document_hash = hashlib.sha256(content).hexdigest()
        except Exception:
            pass

    certificate = CertificateOfCompletion(
        request_title=sig_request.title,
        document_name=document.filename if document else "Unknown",
        signers=[
            CertificateSignerInfo(
                name=s.name,
                email=s.email,
                signed_at=s.signed_at.isoformat() if s.signed_at else None,
                ip_address=s.signed_ip,
            )
            for s in signers
        ],
        created_at=sig_request.created_at.isoformat(),
        completed_at=sig_request.completed_at.isoformat() if sig_request.completed_at else "",
        document_hash=document_hash,
    )

    cert_json = certificate.model_dump_json(indent=2)
    storage_key = f"esign/certificates/{sig_request.id}/certificate.json"

    client = get_minio_client()
    cert_bytes = cert_json.encode("utf-8")
    client.put_object(
        settings.minio_bucket,
        storage_key,
        BytesIO(cert_bytes),
        length=len(cert_bytes),
        content_type="application/json",
    )

    sig_request.certificate_storage_key = storage_key


async def get_signature_request(
    db: AsyncSession,
    request_id: uuid.UUID,
) -> Optional[SignatureRequest]:
    result = await db.execute(select(SignatureRequest).where(SignatureRequest.id == request_id))
    return result.scalar_one_or_none()


async def get_audit_trail(
    db: AsyncSession,
    request_id: uuid.UUID,
) -> list[SignatureAuditEntry]:
    result = await db.execute(
        select(SignatureAuditEntry)
        .where(SignatureAuditEntry.signature_request_id == request_id)
        .order_by(SignatureAuditEntry.timestamp.asc())
    )
    return result.scalars().all()


async def list_signature_requests(
    db: AsyncSession,
    matter_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[SignatureRequest], int]:
    query = select(SignatureRequest)
    count_query = select(func.count(SignatureRequest.id))

    if matter_id:
        query = query.where(SignatureRequest.matter_id == matter_id)
        count_query = count_query.where(SignatureRequest.matter_id == matter_id)

    if status:
        query = query.where(SignatureRequest.status == status)
        count_query = count_query.where(SignatureRequest.status == status)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(SignatureRequest.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


def get_certificate_download_url(storage_key: str) -> str:
    from datetime import timedelta

    client = get_minio_client()
    return client.presigned_get_object(settings.minio_bucket, storage_key, expires=timedelta(hours=1))
