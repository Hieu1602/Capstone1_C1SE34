"""
crud_incident.py – CRUD / Repository cho Incident model.
"""

from typing import List, Optional
from uuid import UUID
import json

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.incident import Incident


class CRUDIncident:

    async def create_from_edge(self, db: AsyncSession, data: dict) -> Incident:
        event_id = UUID(data["id"]) if data.get("id") else None
        if event_id:
            existing = await self.get(db, event_id)
            if existing:
                return existing
        payload = {key: data[key] for key in ("device_id", "alert_type", "alert_level", "message", "confidence", "video_clip_url", "thumbnail_url", "notes") if key in data}
        if "device_id" in payload and not isinstance(payload["device_id"], UUID):
            try:
                payload["device_id"] = UUID(str(payload["device_id"]))
            except (ValueError, TypeError):
                pass
        if event_id:
            payload["id"] = event_id
        payload["sources"] = json.dumps(data.get("sources", []))
        if not payload.get("video_clip_url") and data.get("video_url"):
            payload["video_clip_url"] = data["video_url"]
        return await self.create(db, payload)

    async def get(self, db: AsyncSession, incident_id: UUID) -> Optional[Incident]:
        result = await db.execute(
            select(Incident).options(selectinload(Incident.acknowledged_user)).where(Incident.id == incident_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        device_id: Optional[UUID] = None,
        alert_level: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        current_user_id: Optional[UUID] = None,
        target_role: Optional[str] = None,
    ) -> List[Incident]:
        query = select(Incident).options(selectinload(Incident.acknowledged_user)).order_by(Incident.created_at.desc())
        if device_id:
            query = query.where(Incident.device_id == device_id)
        if alert_level:
            query = query.where(Incident.alert_level == alert_level)

        is_doctor = False
        if current_user_id:
            from app.models.user import User
            from app.models.house import House, HouseMember
            from app.models.device import Device

            user = await db.get(User, current_user_id)
            is_doctor = (target_role == "doctor") or (user is not None and user.role == "doctor")

            if user and user.role == "admin":
                # Admin cấp hệ thống: có thể giám sát toàn bộ
                pass
            else:
                # Tìm danh sách nhà mà người dùng sở hữu hoặc là thành viên ACTIVE
                member_house_subq = select(HouseMember.house_id).where(
                    HouseMember.user_id == current_user_id,
                    HouseMember.status == "ACTIVE",
                )
                user_houses_query = select(House.id).where(
                    or_(
                        House.owner_id == current_user_id,
                        House.id.in_(member_house_subq),
                    )
                )
                user_house_ids_res = await db.execute(user_houses_query)
                user_house_ids = [row[0] for row in user_house_ids_res.fetchall()]

                if not user_house_ids:
                    # Tài khoản mới chưa liên kết nhà: CHỈ nhận thông báo gửi trực tiếp cho mình
                    query = query.where(
                        or_(
                            Incident.notes == f"USER:{current_user_id}",
                            Incident.notes.startswith(f"USER:{current_user_id}"),
                            Incident.notes.contains(f"USER:{current_user_id}"),
                        )
                    )
                else:
                    # Lấy danh sách thiết bị thuộc các nhà của người dùng
                    dev_res = await db.execute(select(Device.id).where(Device.house_id.in_(user_house_ids)))
                    user_device_ids = [row[0] for row in dev_res.fetchall()]

                    conditions = [
                        Incident.notes == f"USER:{current_user_id}",
                        Incident.notes.startswith(f"USER:{current_user_id}"),
                        Incident.notes.contains(f"USER:{current_user_id}"),
                    ]
                    if user_device_ids:
                        conditions.append(
                            and_(
                                Incident.device_id.in_(user_device_ids),
                                Incident.alert_type != "HOUSE_INVITE_PENDING",
                                or_(
                                    Incident.notes.is_(None),
                                    and_(
                                        ~Incident.notes.startswith("USER:"),
                                        ~Incident.notes.contains("USER:"),
                                    ),
                                    Incident.notes == f"USER:{current_user_id}",
                                    Incident.notes.startswith(f"USER:{current_user_id}"),
                                    Incident.notes.contains(f"USER:{current_user_id}"),
                                ),
                            )
                        )
                    query = query.where(or_(*conditions))
        else:
            # Khách chưa đăng nhập: Chỉ cho phép truy vấn khi có device_id cụ thể (Edge Hub/Device)
            if not device_id:
                return []
            query = query.where(
                or_(
                    Incident.notes.is_(None),
                    and_(
                        ~Incident.notes.startswith("USER:"),
                        ~Incident.notes.contains("USER:"),
                    ),
                )
            )

        # Lọc chống Alert Fatigue cho Bác sĩ (Doctor Portal)
        if is_doctor:
            # 1. Ẩn toàn bộ sự kiện vận hành thiết bị & kết nối
            excluded_device_alerts = [
                "BATTERY_LOW", "BATTERY_CRITICAL", "BATTERY_DRAIN",
                "DEVICE_OFFLINE", "DEVICE_DISCONNECTED", "DEVICE_ONLINE",
                "DEVICE_CHARGING", "CHARGER_CONNECTED", "BLE_DISCONNECTED", "SENSOR_OFFLINE"
            ]
            query = query.where(Incident.alert_type.not_in(excluded_device_alerts))
            query = query.where(
                and_(
                    ~Incident.message.ilike("%pin yếu%"),
                    ~Incident.message.ilike("%đã cắm sạc%"),
                    ~Incident.message.ilike("%rút sạc%"),
                    ~Incident.message.ilike("%mất kết nối%"),
                    ~Incident.message.ilike("%ngắt kết nối%"),
                    ~Incident.message.ilike("%ngoại tuyến%"),
                    ~Incident.message.ilike("%mất tín hiệu%"),
                )
            )

            # 2. Chống tự làm phiền (No Self-Notification khi bác sĩ tự cập nhật)
            if current_user_id:
                query = query.where(
                    or_(
                        Incident.notes.is_(None),
                        and_(
                            ~Incident.notes.contains(f"BY_DOCTOR:{current_user_id}"),
                            ~Incident.notes.contains(f"DOCTOR_UPDATED:{current_user_id}"),
                            ~Incident.notes.contains(f"BY:{current_user_id}"),
                        )
                    )
                )

            # 3. Phân tuyến chỉ lấy 2 nhóm: Cảnh báo nguy cấp (CRITICAL) HOẶC Lịch khám / Lời mời
            critical_types = [
                "FALL_DETECTED", "SOS_BUTTON", "SOS", "EMERGENCY_BUTTON",
                "CRITICAL_TRIAD", "TRIAD_FEVER_TACHYCARDIA_HYPOXIA",
                "LOW_SPO2", "LOW_SPO2_CRITICAL", "EXERTION_HYPOXIA",
                "CARDIO_COLLAPSE", "HIGH_HEART_RATE_CRITICAL", "HIGH_FEVER"
            ]
            appointment_invite_types = [
                "APPOINTMENT_SCHEDULED", "APPOINTMENT_CONFIRMED",
                "APPOINTMENT_CANCELLED", "APPOINTMENT_RESCHEDULED",
                "HOUSE_INVITE_PENDING", "DOCTOR_ASSIGNED", "INVITATION"
            ]

            doctor_allowed = or_(
                Incident.alert_level == "CRITICAL",
                Incident.alert_type.in_(critical_types),
                Incident.alert_type.in_(appointment_invite_types),
                Incident.message.ilike("%lịch khám%"),
                Incident.message.ilike("%lời mời%"),
                Incident.message.ilike("%tái khám%"),
                Incident.message.ilike("%hẹn khám%"),
            )
            query = query.where(doctor_allowed)

        # Nếu là Bác sĩ: truy vấn dôi dư một ít để thực hiện gom nhóm Cooldown 15-30 phút
        fetch_limit = limit * 3 if is_doctor else limit
        query = query.offset(offset).limit(fetch_limit)

        result = await db.execute(query)
        raw_incidents = list(result.scalars().all())

        if not is_doctor:
            return raw_incidents

        # Cooldown 15–30 phút & Gom nhóm các cảnh báo lặp lại liên tiếp cho Bác sĩ
        from datetime import timedelta
        grouped_incidents: List[Incident] = []
        # Key: (device_id, alert_type) -> list of incidents
        for inc in raw_incidents:
            is_critical = (inc.alert_level == "CRITICAL" or inc.alert_type in [
                "FALL_DETECTED", "SOS_BUTTON", "LOW_SPO2", "EXERTION_HYPOXIA", "CARDIO_COLLAPSE"
            ])
            if not is_critical:
                setattr(inc, "repeat_count", 1)
                setattr(inc, "repeat_badge", None)
                grouped_incidents.append(inc)
                continue

            # Kiểm tra xem đã có cảnh báo cùng loại trong 20 phút trước đó chưa
            merged = False
            for existing in grouped_incidents:
                if (
                    str(existing.device_id) == str(inc.device_id) and
                    existing.alert_type == inc.alert_type and
                    existing.created_at and inc.created_at
                ):
                    time_diff = abs((existing.created_at - inc.created_at).total_seconds())
                    if time_diff <= 1200:  # 20 phút (nằm trong khoảng Cooldown 15-30 phút)
                        current_repeats = getattr(existing, "repeat_count", 1) + 1
                        setattr(existing, "repeat_count", current_repeats)
                        setattr(existing, "repeat_badge", f"Lặp lại {current_repeats} lần trong 15 phút qua")
                        merged = True
                        break

            if not merged:
                setattr(inc, "repeat_count", 1)
                setattr(inc, "repeat_badge", None)
                grouped_incidents.append(inc)

        top_incidents = grouped_incidents[:limit]
        # Bổ sung elderly_id từ Device để Web/App nhận diện đúng bệnh nhân kể cả khi notes bị ghi đè
        try:
            dev_ids = {inc.device_id for inc in top_incidents if getattr(inc, "device_id", None)}
            if dev_ids:
                from app.models.device import Device

                dev_rows = await db.execute(select(Device.id, Device.elderly_id).where(Device.id.in_(list(dev_ids))))
                dev_map = {row[0]: row[1] for row in dev_rows.fetchall() if row[1] is not None}
                for inc in top_incidents:
                    if not getattr(inc, "elderly_id", None):
                        setattr(inc, "elderly_id", dev_map.get(inc.device_id))
        except Exception:
            pass
        return top_incidents

    async def create(self, db: AsyncSession, data: dict) -> Incident:
        obj = Incident(**data)
        db.add(obj)
        await db.flush()
        try:
            from app.services.redis import redis_service
            await redis_service.invalidate_incidents_cache()
        except Exception:
            pass
        return obj

    async def acknowledge(
        self,
        db: AsyncSession,
        incident_id: UUID,
        notes: Optional[str] = None,
        acknowledged_by: Optional[UUID] = None,
    ) -> Optional[Incident]:
        incident = await self.get(db, incident_id)
        if not incident:
            return None
        from datetime import datetime, timezone
        incident.is_acknowledged = True
        existing_notes = incident.notes or ""
        import re
        preserved_tags = []
        user_tag_match = re.search(r'(USER:[0-9a-fA-F-]+)', existing_notes)
        apt_tag_match = re.search(r'(APT:[0-9a-fA-F-]+)', existing_notes)
        patient_tag_match = re.search(r'(PATIENT:[0-9a-fA-F-]+)', existing_notes)
        if user_tag_match:
            preserved_tags.append(user_tag_match.group(1))
        if apt_tag_match:
            preserved_tags.append(apt_tag_match.group(1))
        if patient_tag_match:
            preserved_tags.append(patient_tag_match.group(1))
        if "APPOINTMENT_REQUESTED" in existing_notes:
            preserved_tags.append("APPOINTMENT_REQUESTED")
        if notes:
            missing = [tag for tag in preserved_tags if tag not in notes]
            incident.notes = f"{'|'.join(missing)} | {notes}" if missing else notes
        incident.acknowledged_at = datetime.now(timezone.utc)
        if acknowledged_by:
            incident.acknowledged_by = acknowledged_by
        await db.flush()
        await db.commit()
        return await self.get(db, incident_id)

    async def reopen(
        self,
        db: AsyncSession,
        incident_id: UUID,
        notes: Optional[str] = "Chưa an toàn - Cần tiếp tục hỗ trợ",
    ) -> Optional[Incident]:
        incident = await self.get(db, incident_id)
        if not incident:
            return None
        incident.is_acknowledged = False
        incident.notes = notes
        incident.acknowledged_at = None
        incident.acknowledged_by = None
        await db.flush()
        await db.commit()
        return await self.get(db, incident_id)

    async def acknowledge_all(
        self,
        db: AsyncSession,
        current_user_id: Optional[UUID] = None,
    ) -> int:
        from datetime import datetime, timezone
        from sqlalchemy import update
        stmt = (
            update(Incident)
            .where(
                Incident.is_acknowledged.is_(False),
                Incident.alert_type != "HOUSE_INVITE_PENDING",
            )
            .values(
                is_acknowledged=True,
                acknowledged_at=datetime.now(timezone.utc),
                acknowledged_by=current_user_id,
            )
        )
        if current_user_id:
            from app.models.user import User
            from app.models.house import House, HouseMember
            from app.models.device import Device

            user = await db.get(User, current_user_id)
            if user and user.role == "admin":
                pass
            else:
                member_house_subq = select(HouseMember.house_id).where(HouseMember.user_id == current_user_id)
                user_houses_query = select(House.id).where(
                    or_(
                        House.owner_id == current_user_id,
                        House.id.in_(member_house_subq),
                    )
                )
                user_house_ids_res = await db.execute(user_houses_query)
                user_house_ids = [row[0] for row in user_house_ids_res.fetchall()]

                if not user_house_ids:
                    stmt = stmt.where(Incident.notes.contains(f"USER:{current_user_id}"))
                else:
                    dev_res = await db.execute(select(Device.id).where(Device.house_id.in_(user_house_ids)))
                    user_device_ids = [row[0] for row in dev_res.fetchall()]

                    conditions = [Incident.notes.contains(f"USER:{current_user_id}")]
                    if user_device_ids:
                        conditions.append(
                            and_(
                                Incident.device_id.in_(user_device_ids),
                                or_(
                                    Incident.notes.is_(None),
                                    ~Incident.notes.contains("USER:"),
                                    Incident.notes.contains(f"USER:{current_user_id}"),
                                ),
                            )
                        )
                    stmt = stmt.where(or_(*conditions))
        result = await db.execute(stmt)
        await db.flush()
        return getattr(result, "rowcount", 0) or 0


crud_incident = CRUDIncident()
