# -*- coding: utf-8 -*-
"""
llm_client.py – Client kết nối đa mô hình LLM (Google Gemini & OpenAI ChatGPT) với cơ chế tự động Fallback.
Vị trí: backend/app/services/chatbot/llm_client.py
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class MultiModelLLMClient:
    """
    Client kết nối đa nền tảng Cloud LLM qua giao thức chuẩn OpenAI-Compatible REST API.
    Hỗ trợ đồng thời:
    - Google Gemini (qua endpoint /v1beta/openai)
    - OpenAI ChatGPT (GPT-4o, GPT-4o-mini)
    - DeepSeek / Local LLM (Ollama, vLLM)
    """

    FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gpt-4o-mini", "gemini-2.0-flash"]

    def __init__(self):
        self.enabled = getattr(settings, "ENABLE_EXTERNAL_LLM", True)
        
        # 1. Cấu hình mô hình chính / Google Gemini
        self.api_key = (getattr(settings, "LLM_API_KEY", "") or os.getenv("LLM_API_KEY", "")).strip()
        self.base_url = (getattr(settings, "LLM_BASE_URL", "") or os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")).rstrip("/")
        self.model = (getattr(settings, "LLM_MODEL", "") or os.getenv("LLM_MODEL", "gemini-2.0-flash")).strip()

        # 2. Cấu hình riêng cho OpenAI ChatGPT
        self.openai_api_key = (getattr(settings, "OPENAI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")).strip()
        self.openai_base_url = (getattr(settings, "OPENAI_BASE_URL", "") or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")).rstrip("/")
        self.openai_model = (getattr(settings, "OPENAI_MODEL", "") or os.getenv("OPENAI_MODEL", "gpt-4o-mini")).strip()
        self._openai_quota_exhausted = False

    def is_configured(self) -> bool:
        """Kiểm tra xem API key chính (Gemini hoặc bất kỳ key nào) đã sẵn sàng hay chưa."""
        if not self.enabled:
            return False
        if not self.api_key or self.api_key in ["", "sk-your_api_key_here", "CHANGE_ME"]:
            return self.is_openai_configured()
        return True

    def is_openai_configured(self) -> bool:
        """Kiểm tra xem API key của OpenAI (ChatGPT) đã được cấu hình và còn quota hay không."""
        if not self.enabled or getattr(self, "_openai_quota_exhausted", False):
            return False
        if not self.openai_api_key or self.openai_api_key in ["", "sk-your_api_key_here", "CHANGE_ME"]:
            return False
        return True

    def _sanitize_response(self, text: str) -> Optional[str]:
        """Kiểm tra và làm sạch phản hồi từ LLM, chống rò rỉ prompt và câu cụt lửng."""
        if not text or not isinstance(text, str) or len(text.strip()) < 20:
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
            "[DRAFT RESPONSE FROM AI 1 TO AUDIT]",
            "[BẢN THẢO CÂU TRẢ LỜI TỪ AI 1 CẦN THẨM ĐỊNH]",
        ]
        for marker in leak_markers:
            if marker in clean:
                logger.warning("Phát hiện rò rỉ prompt trong phản hồi LLM: %s", clean[:100])
                if clean.startswith(marker):
                    return None

        # Kiểm tra câu bị cắt dở dang ở cuối
        words = clean.split()
        last_word = re.sub(r"[^\w]", "", words[-1]).lower() if words else ""
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
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        candidate_models: Optional[List[str]] = None,
    ) -> Optional[Tuple[str, str]]:
        """
        Gửi yêu cầu tới LLM.
        Hỗ trợ truyền riêng provider (OpenAI hoặc Gemini) hoặc tự động dùng mô hình mặc định.
        """
        active_key = (api_key or self.api_key).strip()
        active_base = (base_url or self.base_url).rstrip("/")
        active_model = (model or self.model).strip()

        # Nếu key chính rỗng nhưng có key OpenAI, tự động đổi sang OpenAI
        if (not active_key or active_key in ["", "sk-your_api_key_here", "CHANGE_ME"]) and self.is_openai_configured():
            active_key = self.openai_api_key
            active_base = self.openai_base_url
            active_model = self.openai_model
            candidate_models = [self.openai_model, "gpt-4o-mini", "gpt-4o"]

        if not self.enabled or not active_key or active_key in ["", "sk-your_api_key_here", "CHANGE_ME"]:
            return None

        endpoint = f"{active_base}/chat/completions" if not active_base.endswith("/chat/completions") else active_base
        headers = {
            "Authorization": f"Bearer {active_key}",
            "Content-Type": "application/json",
        }

        if candidate_models is None:
            models_to_try = [active_model]
            if "generativelanguage" in active_base:
                for fb in ["gemini-2.0-flash", "gemini-3.1-flash-lite", "gemini-1.5-flash"]:
                    if fb not in models_to_try:
                        models_to_try.append(fb)
            elif "openai.com" in active_base:
                for fb in ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]:
                    if fb not in models_to_try:
                        models_to_try.append(fb)
        else:
            models_to_try = list(candidate_models)

        async with httpx.AsyncClient(timeout=20.0) as client:
            for current_model in models_to_try:
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
                            raw_content = choices[0].get("message", {}).get("content") or ""
                            sanitized = self._sanitize_response(raw_content)
                            if sanitized:
                                return sanitized, current_model
                            logger.warning("Phản hồi từ model %s không vượt qua kiểm định làm sạch.", current_model)
                    elif resp.status_code in [401, 403]:
                        logger.warning("LLM API xác thực thất bại (status %d): API key không hợp lệ hoặc hết hạn.", resp.status_code)
                        break
                    elif resp.status_code == 429:
                        logger.warning("Mô hình %s chạm giới hạn tần suất (Rate limit 429)...", current_model)
                        if "insufficient_quota" in resp.text or "quota" in resp.text.lower():
                            logger.warning("Tài khoản hết hạn mức Quota (429 Insufficient Quota), chuyển ngay sang Gemini.")
                            if "openai.com" in active_base:
                                self._openai_quota_exhausted = True
                            break
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

        # Nếu mô hình chính (Gemini) thất bại toàn bộ và có cấu hình OpenAI, thử fallback chéo sang OpenAI
        if not api_key and self.is_openai_configured() and "openai.com" not in active_base:
            logger.info("Gemini gặp sự cố, kích hoạt Fallback chéo sang ChatGPT (OpenAI: %s)...", self.openai_model)
            return await self.generate_response(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=self.openai_api_key,
                base_url=self.openai_base_url,
                model=self.openai_model,
                candidate_models=[self.openai_model, "gpt-4o-mini", "gpt-4o"],
            )

        return None

    async def generate_critic_response(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1000,
    ) -> Optional[Tuple[str, str]]:
        """
        Gọi mô hình AI 2 (Medical Critic / Thẩm định lâm sàng).
        Ưu tiên sử dụng ChatGPT (OpenAI) để tạo tính kiểm tra chéo độc lập với AI 1 (Gemini).
        Nếu chưa cấu hình OPENAI_API_KEY, tự động dùng mô hình Gemini chính.
        """
        if self.is_openai_configured():
            logger.info("AI 2 (Medical Critic) đang thẩm định độc lập bằng ChatGPT (OpenAI: %s)...", self.openai_model)
            res = await self.generate_response(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=self.openai_api_key,
                base_url=self.openai_base_url,
                model=self.openai_model,
                candidate_models=[self.openai_model, "gpt-4o-mini", "gpt-4o"],
            )
            if res:
                return res
            logger.warning("ChatGPT (OpenAI) phản hồi thất bại hoặc hết quota, fallback sang Gemini cho AI 2.")

        # Fallback về key chung / Gemini
        return await self.generate_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
