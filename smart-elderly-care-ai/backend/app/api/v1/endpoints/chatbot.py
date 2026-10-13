# -*- coding: utf-8 -*-
"""
chatbot.py – Endpoint API Trợ lý AI SmartCare (RAG + Lịch sử hội thoại DB).
Vị trí: backend/app/api/v1/endpoints/chatbot.py

Endpoints:
  POST /chatbot/chat               – Gửi câu hỏi (auto tạo session nếu chưa có)
  GET  /chatbot/sessions           – Lấy danh sách phiên chat của user
  POST /chatbot/sessions           – Tạo phiên chat mới rỗng
  GET  /chatbot/sessions/{id}      – Lấy chi tiết 1 phiên + toàn bộ tin nhắn
  DELETE /chatbot/sessions/{id}    – Xoá phiên chat
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.core.i18n import get_request_language
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.services.chatbot.rag_service import get_chatbot_rag_service

router = APIRouter()


# =============================================================================
# SCHEMAS (Pydantic)
# =============================================================================

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Nội dung câu hỏi")
    session_id: Optional[UUID] = Field(
        None, description="UUID phiên chat hiện tại (None = tự tạo phiên mới)"
    )
    house_id: Optional[UUID] = Field(None, description="Context căn nhà cần hỏi")
    model_name: Optional[str] = Field("SmartCare Flash 1", description="Mô hình AI")
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
    session_id: Optional[UUID] = None          # Trả về để frontend lưu lại


class MessageOut(BaseModel):
    id: UUID
    sender: str                                # 'user' | 'ai'
    text: str
    is_error: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: UUID
    title: str
    model_name: str
    house_id: Optional[UUID]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    messages: List[MessageOut] = []

    class Config:
        from_attributes = True


class SessionCreateRequest(BaseModel):
    title: Optional[str] = "Cuộc trò chuyện"
    house_id: Optional[UUID] = None
    model_name: Optional[str] = "SmartCare Flash 1"


# =============================================================================
# HELPER – Tạo hoặc tìm ChatSession
# =============================================================================

async def _get_or_create_session(
    db: AsyncSession,
    user_id: UUID,
    session_id: Optional[UUID],
    house_id: Optional[UUID],
    model_name: str,
    first_message: str,
) -> ChatSession:
    """Tìm session có sẵn hoặc tự tạo mới, auto-set title từ câu hỏi đầu."""
    if session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy phiên chat.",
            )
        return session

    # Tạo phiên mới – title = 30 ký tự đầu câu hỏi (giống frontend)
    title = (first_message[:30] + "...") if len(first_message) > 30 else first_message
    new_session = ChatSession(
        user_id=user_id,
        house_id=house_id,
        title=title,
        model_name=model_name,
    )
    db.add(new_session)
    await db.flush()  # Lấy ID ngay mà chưa commit
    return new_session


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/health")
async def chatbot_health():
    """Kiểm tra tình trạng RAG Service."""
    service = get_chatbot_rag_service()
    chunks_count = len(service.retriever.chunks)
    return {
        "chatbot_engine": "ready",
        "mode": "native_backend",
        "medical_knowledge_chunks": chunks_count,
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(
    http_request: Request,
    request: ChatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Gửi câu hỏi → Trợ lý AI SmartCare (RAG).
    - Tự động lưu tin nhắn vào DB nếu user đã đăng nhập.
    - Tự tạo session mới nếu session_id = None.
    - Trả về session_id để frontend cập nhật state.
    """
    try:
        service = get_chatbot_rag_service()
        user_id = current_user.id if current_user else None
        language = get_request_language(
            http_request,
            current_user.preferred_language if current_user else None,
        )

        res = await service.ask(
            db=db,
            user_id=user_id,
            question=request.message,
            language=language,
        )

        # Lưu lịch sử nếu user đã đăng nhập
        session_id_out: Optional[UUID] = None
        if current_user:
            session = await _get_or_create_session(
                db=db,
                user_id=current_user.id,
                session_id=request.session_id,
                house_id=request.house_id,
                model_name=request.model_name or "SmartCare Flash 1",
                first_message=request.message,
            )
            session_id_out = session.id

            # Lưu tin nhắn user
            db.add(ChatMessage(
                session_id=session.id,
                sender="user",
                text=request.message,
                is_error=False,
            ))
            # Lưu phản hồi AI
            db.add(ChatMessage(
                session_id=session.id,
                sender="ai",
                text=res.get("answer", ""),
                is_error=False,
            ))
            # Cập nhật updated_at của session
            session.updated_at = datetime.now(timezone.utc)
            await db.commit()

        return ChatResponse(
            status="success",
            question=request.message,
            answer=res.get("answer", ""),
            sources=res.get("sources", []),
            engine=res.get("engine", ""),
            timestamp=res.get("timestamp", ""),
            vitals_snapshot=res.get("vitals_snapshot"),
            disclaimer=res.get("disclaimer"),
            session_id=session_id_out,
        )

    except HTTPException:
        raise
    except Exception as e:
        detail = (
            f"Failed to process the question: {e}"
            if http_request.state.language == "en"
            else f"Lỗi xử lý câu hỏi: {e}"
        )
        raise HTTPException(status_code=500, detail=detail) from e


@router.get("/sessions", response_model=List[SessionOut])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách tất cả phiên chat của user hiện tại.
    Thay thế useState<HistoryChat[]> trong AIAssistantScreen.
    """
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return sessions


@router.post("/sessions", response_model=SessionOut, status_code=201)
async def create_session(
    body: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo phiên chat mới rỗng (dùng khi bấm nút 'Cuộc trò chuyện mới')."""
    session = ChatSession(
        user_id=current_user.id,
        house_id=body.house_id,
        title=body.title or "Cuộc trò chuyện",
        model_name=body.model_name or "SmartCare Flash 1",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session_detail(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết 1 phiên chat + toàn bộ tin nhắn (dùng khi mở lại hội thoại từ sidebar)."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiên chat.",
        )
    return session


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xoá phiên chat và toàn bộ tin nhắn bên trong (CASCADE)."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiên chat.",
        )
    await db.delete(session)
    await db.commit()
