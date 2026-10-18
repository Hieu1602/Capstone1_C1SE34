# -*- coding: utf-8 -*-
"""
llm_client.py – Client kết nối đa mô hình LLM (Gemini, OpenAI, DeepSeek, Ollama) với cơ chế tự động Fallback.
Vị trí: backend/app/services/chatbot/llm_client.py
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class MultiModelLLMClient:
    """
    Client kết nối đa nền tảng Cloud LLM qua giao thức chuẩn OpenAI-Compatible REST API.
    Tương thích 100% với:
    - Google Gemini (qua endpoint /v1beta/openai)
    - OpenAI (GPT-4o, GPT-4o-mini)
    - DeepSeek (deepseek-chat)
    - Local LLM (Ollama, vLLM, LMStudio)
    """

    FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gpt-4o-mini", "deepseek-chat"]

    def __init__(self):
        self.enabled = getattr(settings, "ENABLE_EXTERNAL_LLM", True)
        self.api_key = (getattr(settings, "LLM_API_KEY", "") or os.getenv("LLM_API_KEY", "")).strip()
        self.base_url = (getattr(settings, "LLM_BASE_URL", "") or os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")).rstrip("/")
        self.model = (getattr(settings, "LLM_MODEL", "") or os.getenv("LLM_MODEL", "gemini-1.5-flash")).strip()

    def is_configured(self) -> bool:
        """Kiểm tra xem API key và cấu hình LLM đã sẵn sàng hay chưa."""
        if not self.enabled:
            return False
        if not self.api_key or self.api_key in ["", "sk-your_api_key_here", "CHANGE_ME"]:
            return False
        return True

    def _sanitize_response(self, text: str) -> Optional[str]:
        """Kiểm tra và làm sạch phản hồi từ LLM, chống rò rỉ prompt và câu cụt lửng."""
        if not text or len(text.strip()) < 20:
            return None

        clean = text.strip()

        # Kiểm tra rò rỉ prompt hệ thống
        leak_markers = [
            "[CLINICAL CONTEXT]",
            "[HỒ SƠ NGƯỜI CAO TUỔI]",
            "[RETRIEVED GERIATRIC GUIDELINES]",
            "NGUYÊN TẮC HOẠT ĐỘNG BẮT BUỘC",
            "MANDATORY CLINICAL PRINCIPLES",
            "SYSTEM INSTRUCTION",
        ]
        for marker in leak_markers:
            if marker in clean:
                logger.warning("Phát hiện rò rỉ prompt trong phản hồi LLM: %s", clean[:100])
                # Cắt bỏ phần rò rỉ nếu nằm ở đầu hoặc từ chối nếu bị nhiễm nặng
                if clean.startswith(marker):
                    return None

        # Kiểm tra câu bị cắt dở dang ở cuối
        last_word = clean.split()[-1].lower() if clean.split() else ""
        if last_word in ["các", "và", "nhưng", "là", "của", "được", "trong", "thì", "hoặc"]:
            logger.warning("Phát hiện câu trả lời LLM bị ngắt cụt lửng: %s", clean[-50:])
            return None

        return clean

    async def generate_response(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1200,
    ) -> Optional[Tuple[str, str]]:
        """
        Gửi yêu cầu tới LLM.
        Nếu mô hình chính gặp lỗi (404, quota, timeout), tự động thử các mô hình fallback.
        Trả về Tuple: (câu_trả_lời, tên_mô_hình_đã_dùng) hoặc None nếu toàn bộ thất bại.
        """
        if not self.is_configured():
            return None

        endpoint = f"{self.base_url}/chat/completions" if not self.base_url.endswith("/chat/completions") else self.base_url
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Danh sách mô hình sẽ thử lần lượt: [Mô hình chính, các mô hình fallback]
        candidate_models = [self.model]
        for fb in self.FALLBACK_MODELS:
            if fb not in candidate_models:
                candidate_models.append(fb)

        async with httpx.AsyncClient(timeout=12.0) as client:
            for current_model in candidate_models:
                payload: Dict[str, Any] = {
                    "model": current_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }

                try:
                    resp = await client.post(endpoint, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get("choices", [])
                        if choices:
                            raw_content = choices[0].get("message", {}).get("content", "")
                            sanitized = self._sanitize_response(raw_content)
                            if sanitized:
                                return sanitized, current_model
                            logger.warning("Phản hồi từ model %s không vượt qua kiểm định làm sạch.", current_model)
                    elif resp.status_code in [401, 403]:
                        logger.warning("LLM API xác thực thất bại (status %d): API key không hợp lệ hoặc hết hạn.", resp.status_code)
                        # Sai key thì không cần thử tiếp các model khác
                        break
                    elif resp.status_code == 429:
                        logger.warning("Mô hình %s chạm giới hạn tần suất (Rate limit 429), thử mô hình tiếp theo...", current_model)
                        continue
                    else:
                        logger.warning(
                            "Mô hình %s trả về mã lỗi %d: %s. Đang thử model tiếp theo...",
                            current_model,
                            resp.status_code,
                            resp.text[:120],
                        )
                except httpx.TimeoutException:
                    logger.warning("Hết thời gian chờ (Timeout) khi gọi model %s.", current_model)
                except Exception as e:
                    logger.warning("Lỗi ngoại lệ khi gọi LLM model %s: %s", current_model, e)

        return None
