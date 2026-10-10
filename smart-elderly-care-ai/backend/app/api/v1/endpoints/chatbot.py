# -*- coding: utf-8 -*-
"""
chatbot.py – Endpoint API Trợ lý AI Bác sĩ Y tế Người cao tuổi (Native RAG).
Chạy trực tiếp 100% trong Backend FastAPI (Port 8000), không cần service ngoài.
Vị trí: backend/app/api/v1/endpoints/chatbot.py
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models.user import User
from app.services.chatbot.rag_service import get_chatbot_rag_service

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Nội dung câu hỏi của người dùng")
    context_window: Optional[int] = 8


class ChatResponse(BaseModel):
    status: str = "success"
    question: str
    answer: str
    sources: List[str] = []
    engine: str = ""
    timestamp: str = ""
    vitals_snapshot: Optional[Dict[str, Any]] = None
    disclaimer: Optional[str] = None


@router.get("/health")
async def chatbot_health():
    """Kiểm tra tình trạng sẵn sàng của Chatbot RAG Service."""
    service = get_chatbot_rag_service()
    chunks_count = len(service.retriever.chunks)
    return {
        "chatbot_engine": "ready",
        "mode": "native_backend",
        "medical_knowledge_chunks": chunks_count,
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Gửi câu hỏi → Trợ lý AI y tế SmartCare:
    - Truy xuất trực tiếp sinh hiệu (nhịp tim, SpO2, té ngã) từ DB của người dùng.
    - Truy xuất cẩm nang y tế lão khoa (sơ cứu ngã, thuốc, chế độ dinh dưỡng).
    - Tổng hợp câu trả lời y tế chuẩn xác và an toàn.
    """
    try:
        service = get_chatbot_rag_service()
        user_id = current_user.id if current_user else None
        res = await service.ask(
            db=db,
            user_id=user_id,
            question=request.message,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý câu hỏi: {str(e)}")
