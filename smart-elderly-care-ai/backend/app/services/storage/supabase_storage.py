"""
supabase_storage.py
Dịch vụ tải lên ảnh chụp và video sự cố té ngã trực tiếp lên Supabase Storage Bucket.
"""

import logging
import os
from pathlib import Path
from typing import Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SupabaseStorageService:
    def __init__(self):
        self.supabase_url = (settings.SUPABASE_URL or os.getenv("SUPABASE_URL", "https://pdysvzyrsuawqvlifrlj.supabase.co")).rstrip("/")
        self.service_key = settings.SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.bucket = settings.SUPABASE_STORAGE_BUCKET_INCIDENTS or os.getenv("SUPABASE_STORAGE_BUCKET_INCIDENTS", "incidents")

    def get_public_url(self, file_name: str) -> str:
        return f"{self.supabase_url}/storage/v1/object/public/{self.bucket}/{file_name}"

    async def upload_file(
        self,
        file_path: str | Path,
        destination_name: Optional[str] = None,
        content_type: str = "video/mp4",
    ) -> Optional[str]:
        """Tải file cục bộ lên Supabase Storage và trả về Public CDN URL."""
        if not self.service_key:
            logger.warning("[SupabaseStorage] Chưa có SUPABASE_SERVICE_ROLE_KEY; bỏ qua cloud upload.")
            return None

        p = Path(file_path)
        if not p.is_file():
            logger.error("[SupabaseStorage] Không tìm thấy file: %s", file_path)
            return None

        target_name = destination_name or p.name
        upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{target_name}"

        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        try:
            with open(p, "rb") as f:
                content = f.read()

            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(upload_url, headers=headers, content=content)
                if res.status_code in (200, 201):
                    public_url = self.get_public_url(target_name)
                    logger.info("[SupabaseStorage] Đã tải lên Supabase Storage: %s -> %s", target_name, public_url)
                    return public_url
                else:
                    logger.error("[SupabaseStorage] Lỗi HTTP %d từ Supabase: %s", res.status_code, res.text)
                    return None
        except Exception as e:
            logger.error("[SupabaseStorage] Exception khi upload lên Supabase: %s", e)
            return None

    async def upload_bytes(
        self,
        data: bytes,
        destination_name: str,
        content_type: str = "image/jpeg",
    ) -> Optional[str]:
        """Tải dữ liệu byte (ảnh trong RAM) lên Supabase Storage."""
        if not self.service_key:
            return None

        upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{destination_name}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(upload_url, headers=headers, content=data)
                if res.status_code in (200, 201):
                    public_url = self.get_public_url(destination_name)
                    logger.info("[SupabaseStorage] Đã tải ảnh lên Supabase: %s", public_url)
                    return public_url
                else:
                    logger.error("[SupabaseStorage] Lỗi HTTP %d: %s", res.status_code, res.text)
                    return None
        except Exception as e:
            logger.error("[SupabaseStorage] Lỗi upload byte: %s", e)
            return None


supabase_storage = SupabaseStorageService()

