# -*- coding: utf-8 -*-
"""
chatbot.py – Endpoint API Trợ lý AI SmartCare (UC.0 – Chatbot AI).
Vị trí: backend/app/api/v1/endpoints/mobile/chatbot.py

Use Case UC.0 Compliance:
  Pre-conditions : Người dùng đã đăng nhập (get_current_user bắt buộc trên mọi endpoint nhạy cảm).
  Post-conditions: Câu hỏi & phản hồi lưu vào ChatSession/ChatMessage; sources, vitals, disclaimer
                   trả về minh bạch.
  Business Rules :
    BR-1  Mọi câu trả lời liên quan bệnh lý đều đính kèm disclaimer tiêu chuẩn.
    BR-2  Chỉ đưa sinh hiệu/hồ sơ bệnh án khi user đã đăng nhập và có quyền hợp lệ.
    BR-3  Tiêu đề phiên = 30 ký tự đầu câu hỏi đầu tiên + "..." (auto-truncate).
    BR-4  Xoá session → xoá toàn bộ tin nhắn (Cascading Delete – ON DELETE CASCADE ở DB).
    BR-5  AI không kê đơn thuốc mới hoặc thay đổi liều thuốc đã được bác sĩ chỉ định.

Endpoints:
  POST   /chatbot/chat                – Gửi câu hỏi (auto tạo session nếu chưa có)   [Main Flow]
  GET    /chatbot/health              – Kiểm tra trạng thái RAG Service
  GET    /chatbot/sessions            – Danh sách phiên chat (Sub-stream 3)
  POST   /chatbot/sessions            – Tạo phiên chat mới rỗng (Sub-stream 2)
  GET    /chatbot/sessions/{id}       – Chi tiết 1 phiên + toàn bộ tin nhắn (Sub-stream 3)
  DELETE /chatbot/sessions/{id}       – Xoá phiên chat (BR-4)
  POST   /chatbot/transcribe-audio    – Chuyển giọng nói → văn bản (Sub-stream 1)
"""

import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

try:
    import speech_recognition as sr
except ImportError:
    sr = None

try:
    from pydub import AudioSegment
except ImportError:
    AudioSegment = None

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.core.i18n import get_request_language
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.services.chatbot.rag_service import get_chatbot_rag_service

router = APIRouter()


# =============================================================================
# SUGGESTED QUESTIONS (UC.0 – Step 2: Hiển thị câu hỏi gợi ý ban đầu)
# =============================================================================

SUGGESTED_QUESTIONS_VI: List[str] = [
    "Kiểm tra sinh hiệu hiện tại của người thân",
    "Sơ cứu khi người cao tuổi bị té ngã như thế nào?",
    "Chế độ dinh dưỡng phù hợp cho người bị tiểu đường",
    "Dấu hiệu nhận biết đột quỵ (FAST) là gì?",
    "Cách phòng ngừa loét tì đè cho người nằm lâu",
    "Nhịp tim bao nhiêu là bình thường với người cao tuổi?",
]

SUGGESTED_QUESTIONS_EN: List[str] = [
    "Check current vital signs of my elderly relative",
    "How to perform first aid when an elderly person falls?",
    "What diet is suitable for elderly with diabetes?",
    "What are the signs of stroke (FAST)?",
    "How to prevent pressure ulcers in bedridden elderly?",
    "What is a normal heart rate for elderly people?",
]


# =============================================================================
# SCHEMAS (Pydantic)
# =============================================================================

class ChatRequest(BaseModel):
    """UC.0 Main Flow – Step 3: Người dùng gửi câu hỏi."""
    message: str = Field(..., min_length=1, description="Nội dung câu hỏi (không được để trống)")
    session_id: Optional[UUID] = Field(
        None, description="UUID phiên chat hiện tại (None = tự động tạo phiên mới)"
    )
    house_id: Optional[UUID] = Field(None, description="Context căn nhà liên quan")
    model_name: Optional[str] = Field("SmartCare Flash 1", description="Tên mô hình AI hiển thị")
    context_window: Optional[int] = Field(8, description="Số tin nhắn gần nhất đưa vào ngữ cảnh")


class ChatResponse(BaseModel):
    """UC.0 Main Flow – Step 7: Câu trả lời AI kèm nguồn và khuyến cáo."""
    status: str = "success"
    question: str
    answer: str
    sources: List[str] = []
    engine: str = ""
    timestamp: str = ""
    vitals_snapshot: Optional[Dict[str, Any]] = None
    disclaimer: Optional[str] = None           # BR-1: Khuyến cáo y tế bắt buộc
    session_id: Optional[UUID] = None           # Frontend dùng để cập nhật state
    suggested_questions: List[str] = []         # UC.0 Step 2: Câu hỏi gợi ý cho cuộc chat mới


class MessageOut(BaseModel):
    """Một tin nhắn trong phiên hội thoại."""
    id: UUID
    sender: str                                # 'user' | 'ai'
    text: str
    is_error: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    """Phên hội thoại đầy đủ (dùng cho chi tiết – Sub-stream 3 Step 2)."""
    id: UUID
    title: str                                 # BR-3: 30 ký tự đầu câu hỏi đầu tiên
    model_name: str
    house_id: Optional[UUID]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0                     # Số tin nhắn để hiển thị trên sidebar
    messages: List[MessageOut] = []

    class Config:
        from_attributes = True


class SessionCreateRequest(BaseModel):
    """UC.0 Sub-stream 2: Tạo phiên chat mới rỗng."""
    title: Optional[str] = "Cuộc trò chuyện mới"
    house_id: Optional[UUID] = None
    model_name: Optional[str] = "SmartCare Flash 1"


class SessionListItem(BaseModel):
    """Phên tóm gọn cho sidebar (không bao gồm toàn bộ messages để giảm tải)."""
    id: UUID
    title: str
    model_name: str
    is_active: bool
    message_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
    """
    Tìm session có sẵn hoặc tạo mới.
    BR-3: Tiêu đề phiên = 30 ký tự đầu câu hỏi đầu tiên (+ "..." nếu bị cắt).
    """
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
                detail="Không tìm thấy phiên chat hoặc bạn không có quyền truy cập phiên này.",
            )
        # Cập nhật title nếu session vẫn là tên mặc định (phiên vừa tạo rỗng) – BR-3
        if session.title in ("Cuộc trò chuyện mới", "Cuộc trò chuyện") and not session.messages:
            session.title = _build_session_title(first_message)
        return session

    # Tạo phiên mới – BR-3: title từ 30 ký tự đầu câu hỏi
    new_session = ChatSession(
        user_id=user_id,
        house_id=house_id,
        title=_build_session_title(first_message),
        model_name=model_name,
    )
    db.add(new_session)
    await db.flush()  # Lấy ID ngay mà chưa commit
    return new_session


def _build_session_title(first_message: str) -> str:
    """BR-3: Tiêu đề phiên = 30 ký tự đầu câu hỏi đầu tiên."""
    stripped = first_message.strip()
    if len(stripped) > 30:
        return stripped[:30] + "..."
    return stripped


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/health")
async def chatbot_health():
    """
    Kiểm tra tình trạng RAG Service và kho tri thức y khoa.
    Frontend dùng để xác nhận Pre-condition: 'Dịch vụ Chatbot API đang hoạt động bình thường'.
    """
    service = get_chatbot_rag_service()
    chunks_count = len(service.retriever.chunks)
    llm_ready = service.llm_client.is_configured()
    return {
        "chatbot_engine": "ready",
        "mode": "native_backend",
        "medical_knowledge_chunks": chunks_count,
        "llm_configured": llm_ready,
        "suggested_questions": SUGGESTED_QUESTIONS_VI,
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(
    http_request: Request,
    request: ChatRequest,
    current_user: User = Depends(get_current_user),   # UC Pre-condition: phải đăng nhập
    db: AsyncSession = Depends(get_db),
):
    """
    UC.0 Main Flow – Gửi câu hỏi và nhận phản hồi từ Trợ lý AI SmartCare.

    Steps 3-8:
      3. Kiểm tra câu hỏi không rỗng (validator min_length=1).
      4. Trả về field 'question' (frontend hiển thị tin nhắn của user).
      5. Frontend hiển thị trạng thái loading khi chờ response.
      6. RAG trích xuất sinh hiệu (TimescaleDB) + cẩm nang y tế.
      7. Trả về câu trả lời + sources + vitals_snapshot + disclaimer (BR-1).
      8. Lưu vào ChatSession / ChatMessage (Post-condition).
    """
    try:
        service = get_chatbot_rag_service()
        # BR-2: get_current_user đảm bảo chỉ đưa sinh hiệu của user đã xác thực
        language = get_request_language(
            http_request,
            current_user.preferred_language,
        )

        res = await service.ask(
            db=db,
            user_id=current_user.id,
            question=request.message,
            language=language,
        )

        # Step 8: Lưu lịch sử hội thoại vào DB (Post-condition)
        session = await _get_or_create_session(
            db=db,
            user_id=current_user.id,
            session_id=request.session_id,
            house_id=request.house_id,
            model_name=request.model_name or "SmartCare Flash 1",
            first_message=request.message,
        )

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
        session.updated_at = datetime.now(timezone.utc)
        await db.commit()

        suggested = SUGGESTED_QUESTIONS_EN if language == "en" else SUGGESTED_QUESTIONS_VI

        return ChatResponse(
            status="success",
            question=request.message,
            answer=res.get("answer", ""),
            sources=res.get("sources", []),
            engine=res.get("engine", ""),
            timestamp=res.get("timestamp", ""),
            vitals_snapshot=res.get("vitals_snapshot"),
            disclaimer=res.get("disclaimer"),           # BR-1
            session_id=session.id,
            suggested_questions=suggested,
        )

    except HTTPException:
        raise
    except Exception as e:
        # Exception Stream 3: AI Server Connection Error
        logger.exception("Lỗi xử lý câu hỏi chatbot: %s", e)
        lang = getattr(getattr(http_request, "state", None), "language", "vi")
        detail = (
            "Server connection error. Please try again later."
            if lang == "en"
            else "Mất kết nối tới máy chủ AI. Vui lòng thử lại sau."
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail) from e


@router.get("/sessions", response_model=List[SessionListItem])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    UC.0 Sub-stream 3 – Step 1: Danh sách phiên chat của user (dành cho Sidebar).
    Trả về dạng tóm gọn (không kèm messages) để giảm tải.
    """
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        SessionListItem(
            id=s.id,
            title=s.title,
            model_name=s.model_name,
            is_active=s.is_active,
            message_count=len(s.messages),
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in sessions
    ]


@router.post("/sessions", response_model=SessionOut, status_code=201)
async def create_session(
    body: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """UC.0 Sub-stream 2 – Tạo phiên chat mới rỗng khi bấm 'Cuộc trò chuyện mới'."""
    session = ChatSession(
        user_id=current_user.id,
        house_id=body.house_id,
        title=body.title or "Cuộc trò chuyện mới",
        model_name=body.model_name or "SmartCare Flash 1",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionOut(
        id=session.id,
        title=session.title,
        model_name=session.model_name,
        house_id=session.house_id,
        is_active=session.is_active,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=0,
        messages=[],
    )


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session_detail(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """UC.0 Sub-stream 3 – Step 2: Chi tiết phiên chat + toàn bộ tin nhắn."""
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
            detail="Không tìm thấy phiên chat hoặc bạn không có quyền truy cập.",
        )
    messages_out = [
        MessageOut(
            id=m.id, sender=m.sender, text=m.text,
            is_error=m.is_error, created_at=m.created_at,
        )
        for m in session.messages
    ]
    return SessionOut(
        id=session.id,
        title=session.title,
        model_name=session.model_name,
        house_id=session.house_id,
        is_active=session.is_active,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(messages_out),
        messages=messages_out,
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    BR-4: Xoá phiên chat và toàn bộ tin nhắn bên trong.
    Cascading Delete được thực hiện tự động (ưu tiên ON DELETE CASCADE ở DB).
    """
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
            detail="Không tìm thấy phiên chat hoặc bạn không có quyền xoá.",
        )
    await db.delete(session)
    await db.commit()


# =============================================================================
# VOICE TRANSCRIPTION (UC.0 Sub-stream 1 – Hỏi bằng giọng nói)
# =============================================================================

@router.post("/transcribe-audio")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),   # Pre-condition: phải đăng nhập
):
    """
    UC.0 Sub-stream 1 – Nhận file ghi âm (WAV/M4A/WebM), chuyển đổi thành văn bản tiếng Việt.

    Exception Stream 2: Không nhận diện được giọng nói → trả về message chuẩn theo UC.
    """
    if sr is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tính năng nhận diện giọng nói chưa sẵn sàng. Vui lòng nhập câu hỏi bằng bàn phím.",
        )
    try:
        content = await file.read()
        if not content:
            # Exception Stream 2: File âm thanh rỗng
            return {
                "status": "error",
                "message": "Không nhận diện được giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.",
            }

        r: Any = sr.Recognizer()
        audio_buf = io.BytesIO(content)
        audio_data = None

        # Thử 1: Đọc trực tiếp định dạng WAV
        try:
            with sr.AudioFile(audio_buf) as source:
                audio_data = r.record(source)
        except Exception:
            # Thử 2: Chuyển đổi bằng pydub nếu client gửi định dạng m4a/aac/webm
            if AudioSegment is None:
                return {
                    "status": "error",
                    "message": "Không nhận diện được giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.",
                }
            try:
                audio_buf.seek(0)
                audio_segment_cls: Any = AudioSegment
                seg = audio_segment_cls.from_file(audio_buf)
                wav_io = io.BytesIO()
                seg.export(wav_io, format="wav")
                wav_io.seek(0)
                with sr.AudioFile(wav_io) as source:
                    audio_data = r.record(source)
            except Exception as conv_err:
                logger.warning("Không thể chuyển đổi file âm thanh: %s", conv_err)
                return {
                    "status": "error",
                    "message": "Không nhận diện được giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.",
                }

        if not audio_data:
            return {
                "status": "error",
                "message": "Không nhận diện được giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.",
            }

        # Nhận diện giọng nói tiếng Việt bằng Google Web Speech API
        text = str(r.recognize_google(audio_data, language="vi-VN"))
        return {
            "status": "success",
            "text": text,
        }
    except sr.UnknownValueError:
        # Exception Stream 2: Không có tiếng hoặc môi trường quá ồn
        return {
            "status": "error",
            "message": "Không nhận diện được giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.",
        }
    except sr.RequestError as e:
        logger.warning("Dịch vụ nhận diện giọng nói gián đoạn: %s", e)
        return {
            "status": "error",
            "message": "Dịch vụ nhận diện giọng nói tạm thời gián đoạn. Vui lòng thử lại hoặc nhập bằng bàn phím.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Lỗi xử lý file giọng nói: %s", e)
        return {
            "status": "error",
            "message": "Không nhận diện được giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.",
        }

