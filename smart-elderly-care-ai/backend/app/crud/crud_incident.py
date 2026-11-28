"""
crud_incident.py – CRUD / Repository cho Incident model.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID
import json
import re

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
        is_doctor_chart = False
        if current_user_id:
            from app.models.user import User
            from app.models.house import House, HouseMember
            from app.models.device import Device

            user = await db.get(User, current_user_id)
            is_doctor_chart = (target_role == "doctor_analytics") and (
                user is not None and user.role == "doctor"
            )
            is_doctor = (not is_doctor_chart) and (
                (target_role == "doctor") or (user is not None and user.role == "doctor")
            )

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

        # Lọc chống Alert Fatigue cho Bác sĩ (Doctor Portal) & biểu đồ lâm sàng
        if is_doctor or is_doctor_chart:
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

        appointment_invite_types = [
            "APPOINTMENT_SCHEDULED", "APPOINTMENT_CONFIRMED",
            "APPOINTMENT_CANCELLED", "APPOINTMENT_RESCHEDULED",
            "HOUSE_INVITE_PENDING", "DOCTOR_ASSIGNED", "INVITATION"
        ]

        if is_doctor_chart:
            # Chế độ thống kê biểu đồ bác sĩ: bỏ sự kiện lịch/đơn thuốc/cấu hình, giữ đủ cảnh báo y tế (HIGH + CRITICAL)
            excluded_non_clinical = appointment_invite_types + [
                "PRESCRIPTION_CREATED",
                "MEDICAL_RECORD_UPDATED",
                "DEVICE_CONFIG_UPDATED",
            ]
            query = query.where(Incident.alert_type.not_in(excluded_non_clinical))
            query = query.where(
                and_(
                    ~Incident.message.ilike("%lịch khám%"),
                    ~Incident.message.ilike("%lời mời%"),
                    ~Incident.message.ilike("%tái khám%"),
                    ~Incident.message.ilike("%hẹn khám%"),
                )
            )
            result = await db.execute(query.offset(offset).limit(limit))
            return list(result.scalars().all())

        if is_doctor:
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

            doctor_allowed = or_(
                Incident.alert_level == "CRITICAL",
                Incident.alert_type.in_(critical_types),
                Incident.alert_type.in_(appointment_invite_types),
                Incident.alert_type == "DEVICE_CONFIG_UPDATED",
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
        await self._hydrate_doctor_incident_context(db, top_incidents, appointment_invite_types)
        return top_incidents

    async def _hydrate_doctor_incident_context(
        self,
        db: AsyncSession,
        incidents: List[Incident],
        appointment_invite_types: List[str],
    ) -> None:
        """Bổ sung elderly_id, patient_name và snapshot sinh hiệu (HR/SpO2) tại thời điểm phát hiện."""
        if not incidents:
            return
        try:
            from app.models.device import Device, DeviceType
            from app.models.elderly_profile import ElderlyProfile
            from app.models.vital_sign import VitalSign
            from app.services.redis import redis_service

            dev_ids = {inc.device_id for inc in incidents if getattr(inc, "device_id", None)}
            if not dev_ids:
                return

            dev_rows = (
                await db.execute(
                    select(Device.id, Device.elderly_id, Device.house_id, Device.device_type).where(
                        Device.id.in_(list(dev_ids))
                    )
                )
            ).all()
            dev_info = {row[0]: {"elderly_id": row[1], "house_id": row[2], "device_type": row[3]} for row in dev_rows}
            house_ids = {info["house_id"] for info in dev_info.values() if info.get("house_id")}

            elderly_by_id: dict[UUID, dict] = {}
            elderly_by_house: dict[UUID, list[dict]] = {}
            if house_ids:
                ep_rows = (
                    await db.execute(
                        select(ElderlyProfile.id, ElderlyProfile.house_id, ElderlyProfile.full_name).where(
                            ElderlyProfile.house_id.in_(list(house_ids))
                        )
                    )
                ).all()
                for ep_id, h_id, full_name in ep_rows:
                    rec = {"id": ep_id, "house_id": h_id, "full_name": (full_name or "").strip()}
                    elderly_by_id[ep_id] = rec
                    elderly_by_house.setdefault(h_id, []).append(rec)

            # Tìm toàn bộ Smartband trong các căn nhà liên quan để lấy đúng sinh hiệu vòng đeo tay khi Camera báo té ngã
            band_by_elderly: dict[UUID, list[UUID]] = {}
            band_by_house: dict[UUID, list[UUID]] = {}
            if house_ids:
                band_rows = (
                    await db.execute(
                        select(Device.id, Device.elderly_id, Device.house_id).where(
                            Device.house_id.in_(list(house_ids)),
                            Device.device_type == DeviceType.SMARTBAND,
                        )
                    )
                ).all()
                for b_id, b_ep_id, b_house_id in band_rows:
                    if b_ep_id:
                        band_by_elderly.setdefault(b_ep_id, []).append(b_id)
                    if b_house_id:
                        band_by_house.setdefault(b_house_id, []).append(b_id)

            clinical_items: list[tuple[Incident, list[UUID]]] = []
            all_vital_dev_ids: set[UUID] = set()
            min_ts: Optional[datetime] = None
            max_ts: Optional[datetime] = None

            for inc in incidents:
                info = dev_info.get(inc.device_id, {})
                h_id = info.get("house_id")
                ep_id = getattr(inc, "elderly_id", None) or info.get("elderly_id")

                if not ep_id and inc.notes:
                    m_pat = re.search(r"PATIENT:([0-9a-fA-F-]{36})", inc.notes)
                    if m_pat:
                        try:
                            ep_id = UUID(m_pat.group(1))
                        except ValueError:
                            pass

                if not ep_id and h_id and inc.message:
                    msg_lower = inc.message.lower()
                    candidates = sorted(
                        elderly_by_house.get(h_id, []),
                        key=lambda x: len(x["full_name"]),
                        reverse=True,
                    )
                    for ep in candidates:
                        if ep["full_name"] and ep["full_name"].lower() in msg_lower:
                            ep_id = ep["id"]
                            break

                if ep_id:
                    setattr(inc, "elderly_id", ep_id)
                    ep_rec = elderly_by_id.get(ep_id)
                    if ep_rec and ep_rec["full_name"]:
                        setattr(inc, "patient_name", ep_rec["full_name"])

                is_clinical = (
                    inc.alert_type not in appointment_invite_types
                    and inc.alert_type != "DEVICE_CONFIG_UPDATED"
                )
                if not is_clinical:
                    continue

                raw_text = f"{inc.message or ''} {inc.notes or ''}"
                m_hr = re.search(r"(\d{2,3})\s*(?:bpm|nhịp/phút)", raw_text, re.IGNORECASE)
                m_spo2 = re.search(
                    r"(?:spo2|oxy)[:\s]*(\d{2,3})\s*%|(\d{2,3})\s*%\s*(?:spo2|oxy)",
                    raw_text,
                    re.IGNORECASE,
                )
                if m_hr:
                    setattr(inc, "heart_rate", int(m_hr.group(1)))
                if m_spo2:
                    val_s = m_spo2.group(1) or m_spo2.group(2)
                    if val_s:
                        setattr(inc, "spo2", int(val_s))

                if getattr(inc, "heart_rate", None) is not None and getattr(inc, "spo2", None) is not None:
                    continue

                cand_devs: list[UUID] = []
                if ep_id and band_by_elderly.get(ep_id):
                    cand_devs.extend(band_by_elderly[ep_id])
                if info.get("device_type") == DeviceType.SMARTBAND and inc.device_id not in cand_devs:
                    cand_devs.append(inc.device_id)
                if h_id and band_by_house.get(h_id):
                    for d_id in band_by_house[h_id]:
                        if d_id not in cand_devs:
                            cand_devs.append(d_id)

                if cand_devs and inc.created_at:
                    clinical_items.append((inc, cand_devs))
                    all_vital_dev_ids.update(cand_devs)
                    t_start = inc.created_at - timedelta(minutes=30)
                    t_end = inc.created_at + timedelta(minutes=2)
                    min_ts = t_start if min_ts is None or t_start < min_ts else min_ts
                    max_ts = t_end if max_ts is None or t_end > max_ts else max_ts

            if clinical_items and all_vital_dev_ids and min_ts and max_ts:
                vs_rows = (
                    await db.execute(
                        select(VitalSign.device_id, VitalSign.time, VitalSign.heart_rate, VitalSign.spo2)
                        .where(
                            VitalSign.device_id.in_(list(all_vital_dev_ids)),
                            VitalSign.time >= min_ts,
                            VitalSign.time <= max_ts,
                        )
                        .order_by(VitalSign.time.desc())
                        .limit(300)
                    )
                ).all()
                vs_by_dev: dict[UUID, list[tuple[datetime, Optional[int], Optional[int]]]] = {}
                for v_dev, v_time, v_hr, v_spo2 in vs_rows:
                    vs_by_dev.setdefault(v_dev, []).append((v_time, v_hr, v_spo2))

                now_utc = datetime.now(timezone.utc)
                for inc, cand_devs in clinical_items:
                    inc_t = inc.created_at
                    if inc_t.tzinfo is None:
                        inc_t = inc_t.replace(tzinfo=timezone.utc)
                    best_hr = getattr(inc, "heart_rate", None)
                    best_spo2 = getattr(inc, "spo2", None)
                    best_diff: Optional[float] = None
                    t_lo = inc_t - timedelta(minutes=30)
                    t_hi = inc_t + timedelta(minutes=2)

                    for d_id in cand_devs:
                        for v_time, v_hr, v_spo2 in vs_by_dev.get(d_id, []):
                            vt = v_time if v_time.tzinfo else v_time.replace(tzinfo=timezone.utc)
                            if not (t_lo <= vt <= t_hi):
                                continue
                            if (v_hr is None or v_hr <= 0) and (v_spo2 is None or v_spo2 <= 0):
                                continue
                            diff = abs((inc_t - vt).total_seconds())
                            if best_diff is None or diff < best_diff:
                                best_diff = diff
                                if best_hr is None and v_hr and v_hr > 0:
                                    best_hr = int(v_hr)
                                if best_spo2 is None and v_spo2 and v_spo2 > 0:
                                    best_spo2 = int(v_spo2)

                    if (best_hr is None or best_spo2 is None) and abs((now_utc - inc_t).total_seconds()) <= 180:
                        for d_id in cand_devs:
                            cached_vs = await redis_service.get_latest_vitals(str(d_id))
                            if cached_vs and cached_vs.get("bracelet_connected") is not False:
                                if best_hr is None and cached_vs.get("heart_rate"):
                                    best_hr = int(cached_vs["heart_rate"])
                                if best_spo2 is None and cached_vs.get("spo2"):
                                    best_spo2 = int(cached_vs["spo2"])
                                if best_hr is not None and best_spo2 is not None:
                                    break

                    if best_hr is not None:
                        setattr(inc, "heart_rate", best_hr)
                    if best_spo2 is not None:
                        setattr(inc, "spo2", best_spo2)
        except Exception:
            pass

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
        exclude_levels: Optional[tuple] = None,
    ) -> int:
        from datetime import datetime, timezone
        from sqlalchemy import update
        # Không biết người gọi là ai thì tuyệt đối không xác nhận hàng loạt (tránh tắt cảnh báo của mọi gia đình)
        if not current_user_id:
            return 0
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
        if exclude_levels:
            stmt = stmt.where(Incident.alert_level.notin_(exclude_levels))
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
