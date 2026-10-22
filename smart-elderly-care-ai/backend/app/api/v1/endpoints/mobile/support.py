"""
support.py – API Tổng đài hỗ trợ kỹ thuật CSKH 24/7 và Hướng dẫn sử dụng & Giới thiệu đồ án.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.crud.crud_support import crud_support_ticket
from app.models.user import User
from app.schemas.support import (
    FAQItem,
    ProjectDocOut,
    SupportHotlineOut,
    SupportTicketCreate,
    SupportTicketOut,
    UserGuideSection,
)

router = APIRouter()

SUPPORT_HOTLINE_NUMBER = "0898230852"
SUPPORT_HOTLINE_NAME = "Tổng đài hỗ trợ kỹ thuật CSKH 24/7"


# ------------------------------------------------------------------------------
# 1. TỔNG ĐÀI HỖ TRỢ KỸ THUẬT CSKH 24/7
# ------------------------------------------------------------------------------
@router.get("/hotline", response_model=SupportHotlineOut, summary="Thông tin hotline CSKH 24/7")
async def get_support_hotline() -> SupportHotlineOut:
    """Trả về thông tin đường dây nóng kỹ thuật CSKH 24/7 (0898230852)."""
    return SupportHotlineOut(
        hotline_name=SUPPORT_HOTLINE_NAME,
        hotline_number=SUPPORT_HOTLINE_NUMBER,
        dial_uri=f"tel:{SUPPORT_HOTLINE_NUMBER}",
        operating_hours="24/7 (Cả ngày nghỉ và lễ Tết)",
        description="Tổng đài chuyên trách hỗ trợ thiết lập, kết nối camera AI, vòng đeo tay BLE và Edge Hub AI gia đình.",
        support_channels=[
            {"channel": "hotline", "title": "Gọi trực tiếp", "value": SUPPORT_HOTLINE_NUMBER, "uri": f"tel:{SUPPORT_HOTLINE_NUMBER}"},
            {"channel": "zalo", "title": "Zalo Hỗ trợ Kỹ thuật", "value": "0898230852", "uri": "https://zalo.me/0898230852"},
            {"channel": "email", "title": "Email Đồ án C1SE.34", "value": "support@elderlycare.ai.vn", "uri": "mailto:support@elderlycare.ai.vn"},
        ],
        support_topics=[
            "Hỗ trợ kết nối Camera AI phát hiện té ngã",
            "Hỗ trợ ghép nối Vòng đeo tay thông minh BLE (Nhịp tim, SpO2)",
            "Hỗ trợ cấu hình Edge Hub AI trung tâm",
            "Cấu hình ngưỡng cảnh báo sinh hiệu & Người nhận thông báo SOS",
            "Khắc phục sự cố thiết bị ngoại tuyến (Offline)",
        ],
    )


@router.post("/call", response_model=dict, summary="Ghi nhận yêu cầu gọi CSKH")
async def request_support_call(
    payload: SupportTicketCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Ghi nhận yêu cầu gọi hỗ trợ kỹ thuật CSKH 24/7 và trả về URI quay số điện thoại."""
    ticket = await crud_support_ticket.create_ticket(db, current_user, payload)
    return {
        "status": "accepted",
        "ticket_id": str(ticket.id),
        "hotline_name": SUPPORT_HOTLINE_NAME,
        "dial_number": SUPPORT_HOTLINE_NUMBER,
        "dial_uri": f"tel:{SUPPORT_HOTLINE_NUMBER}",
        "message": f"Đã ghi nhận yêu cầu hỗ trợ '{payload.topic}'. Ứng dụng sẽ kết nối cuộc gọi đến {SUPPORT_HOTLINE_NUMBER}.",
    }


@router.post("/tickets", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED, summary="Gửi phiếu yêu cầu hỗ trợ kỹ thuật")
async def create_support_ticket(
    payload: SupportTicketCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketOut:
    """Tạo phiếu yêu cầu hỗ trợ kỹ thuật kết nối thiết bị IoT / Camera / Hub AI."""
    ticket = await crud_support_ticket.create_ticket(db, current_user, payload)
    return SupportTicketOut(
        id=ticket.id,
        user_id=ticket.user_id,
        user_name=ticket.user_name,
        phone=ticket.phone,
        topic=ticket.topic,
        device_type=ticket.device_type,
        note=ticket.note,
        status=ticket.status,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("/tickets/me", response_model=List[SupportTicketOut], summary="Danh sách phiếu hỗ trợ của tôi")
async def get_my_support_tickets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[SupportTicketOut]:
    """Lấy danh sách các phiếu yêu cầu hỗ trợ đã gửi của tài khoản hiện tại."""
    tickets = await crud_support_ticket.get_by_user(db, current_user.id)
    return [
        SupportTicketOut(
            id=t.id,
            user_id=t.user_id,
            user_name=t.user_name,
            phone=t.phone,
            topic=t.topic,
            device_type=t.device_type,
            note=t.note,
            status=t.status,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tickets
    ]


# ------------------------------------------------------------------------------
# 2. HƯỚNG DẪN SỬ DỤNG & GIỚI THIỆU ĐỒ ÁN (TÀI LIỆU KỸ THUẬT)
# ------------------------------------------------------------------------------
@router.get("/documentation", response_model=ProjectDocOut, summary="Tài liệu kỹ thuật và hướng dẫn sử dụng")
async def get_project_documentation() -> ProjectDocOut:
    """Cung cấp toàn bộ tài liệu kỹ thuật, kiến trúc hệ thống C1SE.34 và cẩm nang hướng dẫn sử dụng."""
    user_guides = [
        UserGuideSection(
            id="smartband",
            title="Kết nối Vòng đeo tay thông minh (BLE Band)",
            icon="watch-outline",
            badge="BLE 5.0",
            description="Đo nhịp tim, nồng độ oxy trong máu (SpO2), bước chân và thân nhiệt theo thời gian thực.",
            steps=[
                "Bước 1: Bật Bluetooth trên điện thoại di động hoặc đặt vòng tay gần Edge Hub trong phạm vi 5 mét.",
                "Bước 2: Mở ứng dụng Smart Elderly Care AI, vào mục 'Thiết bị' -> Chọn dấu (+) 'Thêm thiết bị'.",
                "Bước 3: Chọn danh mục 'Vòng tay đo sinh hiệu', hệ thống sẽ tự động quét địa chỉ BLE (MAC).",
                "Bước 4: Chọn thiết bị (ví dụ: BLE_BAND_001) và nhấn 'Ghép nối' để hoàn tất.",
            ],
            tips=[
                "Đeo vòng vừa khít cổ tay người cao tuổi để cảm biến quang học đo chính xác nhất.",
                "Nếu không quét thấy, hãy cắm sạc vòng tay ít nhất 10 phút trước khi kết nối.",
            ],
        ),
        UserGuideSection(
            id="camera",
            title="Cài đặt Camera AI phát hiện té ngã",
            icon="videocam-outline",
            badge="AI Vision",
            description="Phát hiện sự cố té ngã thời gian thực qua thuật toán YOLOv8 Pose Estimation, không xâm phạm quyền riêng tư.",
            steps=[
                "Bước 1: Gắn camera quan sát ở vị trí trên cao (khuyến nghị từ 2.0m - 2.5m) bao quát khu vực sinh hoạt chính (phòng khách, hành lang, phòng ngủ).",
                "Bước 2: Kết nối camera vào cùng mạng WiFi/LAN với bộ Edge Hub AI.",
                "Bước 3: Trong ứng dụng, chọn 'Thêm Camera AI' và nhập luồng RTSP (hoặc quét mã QR trên thân camera).",
                "Bước 4: Kiểm tra khung nhận diện khớp xương (Pose Estimation) trên luồng hình ảnh thử nghiệm.",
            ],
            tips=[
                "Hệ thống Edge Hub chỉ xử lý khung xương AI cục bộ, tuyệt đối không gửi video thô lên Cloud để bảo vệ quyền riêng tư người nhà.",
                "Đảm bảo ánh sáng ban đêm đủ để cảm biến hồng ngoại của camera hoạt động tốt.",
            ],
        ),
        UserGuideSection(
            id="hub",
            title="Thiết lập bộ Hub AI trung tâm (Edge Hub)",
            icon="hardware-chip-outline",
            badge="Edge AI",
            description="Đầu não xử lý cục bộ: kết nối vòng tay BLE, nhận luồng RTSP Camera, suy luận AI và phát cảnh báo còi tại chỗ.",
            steps=[
                "Bước 1: Cắm adapter nguồn Type-C 5V/3A đi kèm vào Edge Hub.",
                "Bước 2: Dùng dây mạng LAN cắm trực tiếp vào Router WiFi gia đình (hoặc kết nối WiFi qua cổng cấu hình Access Point).",
                "Bước 3: Khi đèn LED xanh sáng liên tục, mở ứng dụng quét mã QR phía dưới đáy Edge Hub.",
                "Bước 4: Xác nhận gán Hub vào căn nhà của bạn trên ứng dụng di động.",
            ],
            tips=[
                "Đặt Edge Hub ở vị trí trung tâm trong nhà để phủ sóng Bluetooth tốt nhất tới mọi phòng.",
                "Khi mất mạng Internet, Edge Hub vẫn tự động hú còi báo động tại chỗ nếu phát hiện người cao tuổi té ngã.",
            ],
        ),
        UserGuideSection(
            id="vitals_threshold",
            title="Cấu hình Ngưỡng sinh hiệu & Cảnh báo SOS",
            icon="heart-outline",
            badge="Y tế thông minh",
            description="Thiết lập ngưỡng nhịp tim cao/thấp, SpO2 tối thiểu và phân quyền danh bạ người thân nhận cuộc gọi khẩn cấp.",
            steps=[
                "Bước 1: Vào mục 'Cài đặt' -> 'Ngưỡng sinh hiệu và thông báo'.",
                "Bước 2: Điều chỉnh giới hạn nhịp tim (mặc định: Dưới 60 bpm hoặc Trên 100 bpm sẽ báo động) và SpO2 (dưới 95%).",
                "Bước 3: Nhập danh bạ người thân ưu tiên nhận cuộc gọi và tin nhắn cảnh báo SOS khi xảy ra sự cố.",
                "Bước 4: Nhấn 'Lưu cấu hình' để đồng bộ ngưỡng xuống thiết bị phần cứng.",
            ],
            tips=[
                "Tham khảo ý kiến Bác sĩ gia đình để đặt ngưỡng sinh hiệu cá nhân hóa phù hợp với tiền sử bệnh nền của người cao tuổi.",
            ],
        ),
        UserGuideSection(
            id="chatbot_rag",
            title="Sử dụng Trợ lý AI Y tế (Medical Chatbot RAG)",
            icon="chatbubbles-outline",
            badge="Gemini AI",
            description="Tra cứu hướng dẫn sơ cứu khi té ngã, tương tác thuốc và giải đáp các câu hỏi chăm sóc sức khỏe người cao tuổi.",
            steps=[
                "Bước 1: Nhấn vào biểu tượng Chatbot AI trên thanh điều hướng hoặc màn hình chính.",
                "Bước 2: Đặt câu hỏi bằng tiếng Việt (ví dụ: 'Cách sơ cứu khi người già bị trượt ngã?', 'Người cao huyết áp nên ăn gì?').",
                "Bước 3: Nhận phản hồi chuyên môn kết hợp tài liệu y khoa từ mô hình AI đã qua huấn luyện.",
            ],
            tips=[
                "Trợ lý AI hỗ trợ tư vấn sơ cứu ban đầu, đối với các trường hợp khẩn cấp hãy nhấn nút SOS hoặc gọi cấp cứu 115 ngay lập tức.",
            ],
        ),
    ]

    return ProjectDocOut(
        project_name="Smart Elderly Care AI",
        project_code="C1SE.34",
        version="1.0.0",
        tagline="Hệ sinh thái IoT & AI Chăm sóc, Giám sát Sức khỏe Người cao tuổi Toàn diện",
        description=(
            "Đồ án tốt nghiệp C1SE.34 xây dựng giải pháp công nghệ toàn diện kết hợp trí tuệ nhân tạo (AI) "
            "và Internet vạn vật (IoT) nhằm hỗ trợ gia đình và bác sĩ theo dõi sức khỏe, tự động phát hiện té ngã "
            "thời gian thực và phát tín hiệu cấp cứu kịp thời cho người cao tuổi tại nhà."
        ),
        objectives=[
            "Giám sát liên tục các chỉ số sinh tồn (Nhịp tim, SpO2, Thân nhiệt, Huyết áp) qua thiết bị đeo BLE.",
            "Tự động phát hiện té ngã tức thời bằng mô hình thị giác máy tính AI (YOLOv8 Pose) chạy tại biên (Edge Computing).",
            "Bảo mật quyền riêng tư: Xử lý video tại chỗ, mã hóa dữ liệu hồ sơ bệnh án theo tiêu chuẩn AES-256.",
            "Hệ thống đa nền tảng: Mobile App React Native, Web Admin Portal quản trị hệ thống và Cloud Backend FastAPI.",
            "Trợ lý ảo y tế thông minh RAG hỗ trợ tư vấn sức khỏe người cao tuổi 24/7.",
        ],
        architecture={
            "edge_layer": {
                "title": "Tầng Biên (Edge Computing)",
                "components": ["Edge Hub AI", "YOLOv8 Pose Engine", "BLE Receiver", "RTSP Camera Streamer", "Còi hú báo động tại chỗ"],
            },
            "cloud_layer": {
                "title": "Tầng Đám Mây (Cloud Backend)",
                "components": ["FastAPI REST/WebSocket API", "TimescaleDB (Dữ liệu chuỗi thời gian sinh hiệu)", "PostgreSQL 16", "Redis Pub/Sub Cache", "EMQX MQTT Broker"],
            },
            "client_layer": {
                "title": "Tầng Ứng Dụng (Client Applications)",
                "components": ["Mobile App (React Native Expo - iOS & Android)", "Web Admin Portal (React + Vite)", "Dịch vụ thông báo đẩy Firebase Cloud Messaging (FCM)"],
            },
        },
        ai_models=[
            {"name": "YOLOv8-Pose", "role": "Phát hiện té ngã thời gian thực dựa trên 17 điểm khớp xương người", "runtime": "Edge Hub NPU/CPU"},
            {"name": "FaceNet / ArcFace", "role": "Nhận diện khuôn mặt người cao tuổi để phân biệt với người khác", "runtime": "Edge Hub"},
            {"name": "Gemini 2.0 Flash RAG", "role": "Hỏi đáp y tế chuyên sâu, tra cứu đơn thuốc và hướng dẫn sơ cứu", "runtime": "Cloud LLM"},
        ],
        iot_devices=[
            {"name": "Vòng tay đo sinh hiệu thông minh", "protocol": "Bluetooth Low Energy (BLE 5.0)", "sensors": "PPG Nhịp tim, SpO2, Cảm biến gia tốc 3 trục"},
            {"name": "Camera AI IP/WiFi", "protocol": "RTSP Streaming (H.264 / H.265)", "features": "Độ phân giải Full HD, Hồng ngoại nhìn đêm 10m"},
            {"name": "Edge Hub Trung tâm", "protocol": "MQTT / WiFi / Ethernet", "specs": "Bộ xử lý 4 nhân, hỗ trợ còi báo động 85dB và pin dự phòng"},
        ],
        user_guides=user_guides,
        hotline_info=SupportHotlineOut(
            hotline_name=SUPPORT_HOTLINE_NAME,
            hotline_number=SUPPORT_HOTLINE_NUMBER,
            dial_uri=f"tel:{SUPPORT_HOTLINE_NUMBER}",
            operating_hours="24/7",
            description="Hỗ trợ kỹ thuật kết nối camera AI, vòng tay thông minh và Edge Hub AI gia đình.",
            support_channels=[
                {"channel": "hotline", "title": "Gọi trực tiếp", "value": SUPPORT_HOTLINE_NUMBER, "uri": f"tel:{SUPPORT_HOTLINE_NUMBER}"},
                {"channel": "zalo", "title": "Zalo Hỗ trợ Kỹ thuật", "value": "0898230852", "uri": "https://zalo.me/0898230852"},
            ],
            support_topics=[
                "Hỗ trợ kết nối Camera AI",
                "Hỗ trợ ghép nối Vòng tay BLE",
                "Cài đặt Edge Hub AI",
            ],
        ),
    )


@router.get("/faq", response_model=List[FAQItem], summary="Các câu hỏi thường gặp")
async def get_frequently_asked_questions() -> List[FAQItem]:
    """Cung cấp danh mục câu hỏi và giải đáp sự cố kỹ thuật thường gặp."""
    return [
        FAQItem(
            category="Vòng tay thông minh",
            question="Tại sao vòng tay không đo được nhịp tim và SpO2?",
            answer="Hãy kiểm tra xem vòng tay có đeo quá lỏng không. Hãy lau sạch bề mặt cảm biến quang phía sau vòng và đảm bảo pin của vòng trên 20%.",
        ),
        FAQItem(
            category="Camera AI",
            question="Camera có theo dõi và ghi hình lén phòng riêng không?",
            answer="Không. Hệ thống xử lý hình ảnh trực tiếp tại thiết bị Edge Hub trong nhà bạn và chỉ trích xuất dữ liệu tọa độ khớp xương (Skeleton), không lưu video thô lên mạng Internet.",
        ),
        FAQItem(
            category="Edge Hub",
            question="Khi mất kết nối Internet (WiFi) thì hệ thống có báo động không?",
            answer="Có. Edge Hub hoạt động độc lập không cần Internet vẫn có thể phát hiện ngã và kích hoạt còi báo động tại nhà để người xung quanh biết.",
        ),
        FAQItem(
            category="Cảnh báo khẩn cấp",
            question="Làm thế nào để thêm số điện thoại người thân nhận cuộc gọi SOS?",
            answer="Chủ nhà có thể vào 'Quản lý căn nhà' -> 'Thành viên gia đình' để mời người thân tạo tài khoản và cài đặt ứng dụng.",
        ),
    ]

