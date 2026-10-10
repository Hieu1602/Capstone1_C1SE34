# apps/backend/seed_enrich.py
# Module nạp thêm dữ liệu thật vào database PostgreSQL:
# 1. Lịch sử đo nhịp tim 24 giờ qua (15 mốc đo trải đều)
# 2. Thêm 3 loại thuốc uống phân bổ sáng - trưa - tối
# 3. Thêm 3 thông báo cảnh báo khẩn cấp & an ninh thực tế

from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models

def seed_rich_data(db: Session = None) -> Dict[str, Any]:
    """
    Nạp dữ liệu thực tế vào database PostgreSQL cho bệnh nhân cụ Nguyễn Văn An (id=1):
    - 15 mốc đo nhịp tim & sinh hiệu trong 24 giờ qua
    - 3 loại thuốc uống phân bổ (Sáng - Trưa - Tối)
    - 3 thông báo cảnh báo phong phú (Té ngã, Nhịp tim cao, Âm thanh kêu cứu)
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # 1. Đảm bảo bệnh nhân id=1 tồn tại
        patient = db.query(models.Patient).filter(models.Patient.id == 1).first()
        if not patient:
            patient = models.Patient(
                id=1,
                full_name="Nguyễn Văn An",
                birth_year="1948",
                gender="Nam",
                blood_type="O+",
                height_cm=165,
                weight_kg=62,
                emergency_contact="0909 888 777 (Con trai - Nguyễn Văn Bình)",
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)

        now = datetime.utcnow()

        # 2. Nạp mốc đo nhịp tim & sinh hiệu trải dài qua Hôm nay, Hôm qua và 2-3 ngày gần nhất
        daily_schedule = [
            # (hour, minute, base_hr, spo2, temp, activity, sound)
            (3, 0, 62, 98, 36.4, "Ngủ sâu ban đêm", "Yên tĩnh"),
            (6, 0, 71, 98, 36.6, "Thức giấc buổi sáng", "Bình thường"),
            (7, 15, 82, 99, 36.9, "Tập dưỡng sinh buổi sáng", "Bình thường"),
            (8, 30, 75, 98, 36.7, "Ăn sáng & uống thuốc", "Bình thường"),
            (9, 45, 73, 98, 36.8, "Đọc sách, tưới cây", "Bình thường"),
            (11, 30, 78, 97, 36.8, "Chuẩn bị ăn trưa", "Bình thường"),
            (12, 45, 66, 98, 36.5, "Nghỉ trưa", "Yên tĩnh"),
            (14, 15, 70, 98, 36.6, "Thức dậy uống nước ấm", "Bình thường"),
            (15, 30, 76, 99, 36.8, "Uống trà chiều", "Bình thường"),
            (17, 0, 81, 97, 36.9, "Đi bộ nhẹ quanh sân", "Bình thường"),
            (18, 30, 77, 98, 36.8, "Ăn tối & uống thuốc", "Bình thường"),
            (19, 45, 74, 98, 36.7, "Xem tivi phòng khách", "Bình thường"),
            (21, 0, 72, 98, 36.7, "Sinh hoạt cùng gia đình", "Bình thường"),
            (22, 15, 68, 98, 36.6, "Chuẩn bị đi ngủ", "Yên tĩnh"),
            (23, 30, 64, 97, 36.4, "Ngủ say", "Yên tĩnh"),
        ]

        added_vitals = []
        for day_offset in [0, 1, 2, 3]:
            target_date = (now - timedelta(days=day_offset)).date()
            for (h, m, base_hr, spo2, temp, act, snd) in daily_schedule:
                rec_time = datetime(target_date.year, target_date.month, target_date.day, h, m, 0)
                # Nếu là ngày hôm nay và mốc đo trong tương lai thì bỏ qua
                if rec_time > now + timedelta(minutes=5):
                    continue

                # Tạo dao động nhẹ giữa các ngày để dữ liệu nhìn chân thực
                variation = (day_offset * 3 + h) % 5 - 2
                final_hr = base_hr + variation
                final_spo2 = min(99, max(95, spo2 + ((day_offset + m) % 3 - 1)))
                final_temp = round(temp + ((day_offset + h) % 3 * 0.1), 1)

                exist = db.query(models.VitalSign).filter(
                    models.VitalSign.patient_id == patient.id,
                    models.VitalSign.recorded_at >= rec_time - timedelta(minutes=15),
                    models.VitalSign.recorded_at <= rec_time + timedelta(minutes=15),
                ).first()

                if not exist:
                    v = models.VitalSign(
                        patient_id=patient.id,
                        heart_rate=final_hr,
                        spo2=final_spo2,
                        body_temp=final_temp,
                        activity_state=act,
                        sound_state=snd,
                        fall_detected_count=0,
                        recorded_at=rec_time,
                    )
                    db.add(v)
                    added_vitals.append(v)

        # 3. Thêm 3 loại thuốc uống phân bổ trong ngày (Sáng, Trưa, Tối)
        new_medications_data = [
            {
                "name": "Coversyl Plus 5mg/1.25mg (Huyết áp & Tim)",
                "dosage": "1 viên sau ăn sáng",
                "instruction": "Uống cùng 1 cốc nước ấm, kiểm soát huyết áp nền buổi sáng",
                "reminder_time": "07:00",
                "session": "MORNING",
                "is_taken": True,
            },
            {
                "name": "Glucosamine Sulfate 1500mg (Bổ khớp)",
                "dosage": "1 viên sau bữa trưa",
                "instruction": "Hỗ trợ thoái hóa khớp gối hai bên, uống sau khi ăn no 15 phút",
                "reminder_time": "12:00",
                "session": "NOON",
                "is_taken": True,
            },
            {
                "name": "Atorvastatin 20mg (Hạ mỡ máu)",
                "dosage": "1 viên trước khi đi ngủ",
                "instruction": "Ổn định mảng xơ vữa động mạch, uống vào buổi tối lúc 21:00",
                "reminder_time": "21:00",
                "session": "EVENING",
                "is_taken": False,
            },
        ]

        added_meds = []
        for m_data in new_medications_data:
            existing_med = db.query(models.Medication).filter(
                models.Medication.patient_id == patient.id,
                models.Medication.name == m_data["name"]
            ).first()
            if not existing_med:
                med = models.Medication(
                    patient_id=patient.id,
                    name=m_data["name"],
                    dosage=m_data["dosage"],
                    instruction=m_data["instruction"],
                    reminder_time=m_data["reminder_time"],
                    session=m_data["session"],
                    is_taken=m_data["is_taken"],
                    created_at=now,
                )
                db.add(med)
                added_meds.append(med)

        # 4. Thêm 3 thông báo cảnh báo phong phú và trực quan
        new_notifications_data = [
            {
                "type": "FALL_DETECTED",
                "title": "Cảnh báo ngã trượt sàn ướt (YOLO-Pose AI)",
                "description": "🚨 AI phát hiện người cao tuổi mất thăng bằng và ngã ngồi xuống sàn khu vực nhà tắm. Đã tự động kích hoạt còi báo Hub và trích xuất clip 5s.",
                "alert_level": "CRITICAL",
                "confidence": 0.95,
                "video_clip_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=300&q=80",
                "is_new": True,
                "is_resolved": False,
                "created_at": now - timedelta(minutes=15),
            },
            {
                "type": "HIGH_HEART_RATE",
                "title": "Cảnh báo nhịp tim bất thường: 115 bpm",
                "description": "Vòng đeo tay BLE Smartband ghi nhận nhịp tim cụ Nguyễn Văn An tăng vọt lên 115 bpm trong trạng thái ngồi nghỉ (Vượt ngưỡng cài đặt 100 bpm).",
                "alert_level": "HIGH",
                "confidence": 0.97,
                "video_clip_url": None,
                "thumbnail_url": "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=300&q=80",
                "is_new": True,
                "is_resolved": False,
                "created_at": now - timedelta(hours=1, minutes=20),
            },
            {
                "type": "ACOUSTIC_DISTRESS",
                "title": "Phát hiện âm thanh rên đau tại phòng ngủ (YAMNet AI)",
                "description": "Cảm biến âm thanh AI thu nhận tiếng rên đau ngắt quãng lúc rạng sáng. Bác sĩ điều trị đã liên hệ kiểm tra và xác nhận an toàn.",
                "alert_level": "HIGH",
                "confidence": 0.89,
                "video_clip_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=300&q=80",
                "is_new": False,
                "is_resolved": True,
                "resolved_by": "BSCKII. Nguyễn Văn Minh",
                "resolved_at": now - timedelta(hours=8),
                "created_at": now - timedelta(hours=10),
            },
        ]

        added_notifs = []
        for n_data in new_notifications_data:
            existing_notif = db.query(models.Notification).filter(
                models.Notification.patient_id == patient.id,
                models.Notification.title == n_data["title"]
            ).first()
            if not existing_notif:
                notif = models.Notification(
                    patient_id=patient.id,
                    type=n_data["type"],
                    title=n_data["title"],
                    description=n_data["description"],
                    alert_level=n_data["alert_level"],
                    confidence=n_data["confidence"],
                    video_clip_url=n_data["video_clip_url"],
                    thumbnail_url=n_data["thumbnail_url"],
                    is_new=n_data["is_new"],
                    is_resolved=n_data["is_resolved"],
                    resolved_by=n_data.get("resolved_by"),
                    resolved_at=n_data.get("resolved_at"),
                    created_at=n_data["created_at"],
                )
                db.add(notif)
                added_notifs.append(notif)

        db.commit()

        total_vitals = db.query(models.VitalSign).filter(models.VitalSign.patient_id == patient.id).count()
        total_meds = db.query(models.Medication).filter(models.Medication.patient_id == patient.id).count()
        total_notifs = db.query(models.Notification).filter(models.Notification.patient_id == patient.id).count()

        result = {
            "status": "success",
            "message": "Đã nạp bổ sung thành công dữ liệu thực tế vào PostgreSQL!",
            "details": {
                "added_vitals_count": len(added_vitals),
                "total_vitals_count": total_vitals,
                "added_medications_count": len(added_meds),
                "total_medications_count": total_meds,
                "added_notifications_count": len(added_notifs),
                "total_notifications_count": total_notifs,
            }
        }
        print(f"[SUCCESS] {result['message']} - Chi tiết: {result['details']}")
        return result

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Lỗi nạp dữ liệu: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    seed_rich_data()
