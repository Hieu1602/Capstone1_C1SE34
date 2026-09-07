"""
object_storage.py
Upload clip 5s / ảnh lên Cloud Object Storage (MinIO / AWS S3).
"""

import io
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class ObjectStorageService:
    """
    MinIO / S3 compatible object storage client.

    Usage:
        storage = ObjectStorageService()
        url = storage.upload_file(file_path, object_name)
    """

    def __init__(self):
        from app.core.config import settings
        self.endpoint   = settings.MINIO_ENDPOINT
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.bucket     = settings.MINIO_BUCKET_INCIDENTS
        self.secure     = settings.MINIO_SECURE
        self._client    = None

    def initialize(self) -> None:
        """Khởi tạo MinIO client và đảm bảo bucket tồn tại."""
        try:
            from minio import Minio  # type: ignore
            self._client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure,
            )
            if not self._client.bucket_exists(self.bucket):
                self._client.make_bucket(self.bucket)
                logger.info("[Storage] Bucket tạo mới: %s", self.bucket)
            logger.info("[Storage] MinIO initialized: %s", self.endpoint)
        except ImportError:
            logger.warning("[Storage] minio-py chưa cài. Storage disabled.")
        except Exception as exc:  # noqa: BLE001
            logger.error("[Storage] Khởi tạo thất bại: %s", exc)

    def upload_file(
        self,
        file_path: str,
        object_name: Optional[str] = None,
        content_type: str = "video/mp4",
    ) -> Optional[str]:
        """
        Upload file lên MinIO bucket.

        Args:
            file_path: Đường dẫn file local
            object_name: Tên object trong bucket (mặc định là tên file)
            content_type: MIME type

        Returns:
            Public URL của object, hoặc None nếu lỗi
        """
        if self._client is None:
            return None

        path = Path(file_path)
        if not path.exists():
            logger.error("[Storage] File không tồn tại: %s", file_path)
            return None

        obj_name = object_name or path.name

        try:
            self._client.fput_object(
                self.bucket,
                obj_name,
                str(file_path),
                content_type=content_type,
            )
            url = f"{'https' if self.secure else 'http'}://{self.endpoint}/{self.bucket}/{obj_name}"
            logger.info("[Storage] Đã upload: %s → %s", file_path, url)
            return url
        except Exception as exc:  # noqa: BLE001
            logger.error("[Storage] Upload thất bại: %s", exc)
            return None

    def upload_bytes(
        self,
        data: bytes,
        object_name: str,
        content_type: str = "image/jpeg",
    ) -> Optional[str]:
        """
        Upload bytes trực tiếp (ảnh thumbnail từ memory).

        Returns:
            Public URL của object, hoặc None nếu lỗi
        """
        if self._client is None:
            return None

        try:
            self._client.put_object(
                self.bucket,
                object_name,
                io.BytesIO(data),
                length=len(data),
                content_type=content_type,
            )
            url = f"{'https' if self.secure else 'http'}://{self.endpoint}/{self.bucket}/{object_name}"
            return url
        except Exception as exc:  # noqa: BLE001
            logger.error("[Storage] Upload bytes thất bại: %s", exc)
            return None

    def get_presigned_url(
        self,
        object_name: str,
        expires_seconds: int = 3600,
    ) -> Optional[str]:
        """Tạo presigned URL tạm thời cho download."""
        if self._client is None:
            return None

        from datetime import timedelta

        try:
            url = self._client.presigned_get_object(
                self.bucket, object_name,
                expires=timedelta(seconds=expires_seconds),
            )
            return url
        except Exception as exc:  # noqa: BLE001
            logger.error("[Storage] Presigned URL thất bại: %s", exc)
            return None
