"""
mobile package – Gom tất cả các endpoints phục vụ Ứng dụng di động (Mobile App).
Phục vụ người nhà, người chăm sóc, bác sĩ gia đình và người cao tuổi:
- auth: Đăng nhập OTP / Mật khẩu, profile me, tùy chọn ngôn ngữ & cỡ chữ
- houses: Quản lý căn nhà, chia sẻ quyền thành viên gia đình
- device_groups: Nhóm phân vùng / phòng (phòng khách, phòng ngủ)
- devices: Quản lý & ghép nối thiết bị IoT (Camera AI, Vòng tay BLE, Radar mmWave)
- vitals: Truy xuất dữ liệu chuỗi thời gian sinh hiệu (Nhịp tim, SpO2, Huyết áp)
- incidents: Cảnh báo sự cố khẩn cấp (té ngã, bất thường) & xác nhận
- reminders: Nhắc nhở uống thuốc định kỳ & lịch tái khám
- patients: Hồ sơ bệnh án & tiền sử y tế người cao tuổi
- doctor: Phân hệ bác sĩ theo dõi sức khỏe chuyên sâu
- reports: Báo cáo tổng hợp sức khỏe định kỳ
- chatbot: Trợ lý AI Y khoa RAG tư vấn sức khỏe
- emergency: Tín hiệu SOS khẩn cấp & danh bạ cứu trợ
"""

from app.api.v1.endpoints.mobile.auth import router as auth_router
from app.api.v1.endpoints.mobile.chatbot import router as chatbot_router
from app.api.v1.endpoints.mobile.device_groups import router as device_groups_router
from app.api.v1.endpoints.mobile.devices import router as devices_router
from app.api.v1.endpoints.mobile.doctor import router as doctor_router
from app.api.v1.endpoints.mobile.emergency import router as emergency_router
from app.api.v1.endpoints.mobile.houses import router as houses_router
from app.api.v1.endpoints.mobile.incidents import router as incidents_router
from app.api.v1.endpoints.mobile.patients import router as patients_router
from app.api.v1.endpoints.mobile.reminders import router as reminders_router
from app.api.v1.endpoints.mobile.reports import router as reports_router
from app.api.v1.endpoints.mobile.vitals import router as vitals_router

__all__ = [
    "auth_router",
    "chatbot_router",
    "device_groups_router",
    "devices_router",
    "doctor_router",
    "emergency_router",
    "houses_router",
    "incidents_router",
    "patients_router",
    "reminders_router",
    "reports_router",
    "vitals_router",
]

