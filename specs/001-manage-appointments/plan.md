# Implementation Plan: Manage Appointments and Follow-up Visits (UC.0)

**Branch**: `001-manage-appointments` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-manage-appointments/spec.md`

## Summary

Re-architect and modernize the Appointment and Follow-up Visit management capability (Use Case ID: UC.0). Replace the previous in-memory mock store with persistent PostgreSQL/TimescaleDB tables, introduce robust conflict detection, implement an automated background reminder worker (24h & 2h before visits via Firebase Cloud Messaging), add recurring appointment generation (`WEEKLY`, `MONTHLY`, `QUARTERLY`), and enforce strict Role-Based Access Control (Doctor CRUD, Family read-only).

---

## Technical Context

**Language/Version**: Python 3.11+ (Cloud Backend) & TypeScript 5.3+ / React Native 0.86 (Mobile App)

**Primary Dependencies**:
- Backend: FastAPI 0.111, SQLAlchemy 2.0 (asyncio + asyncpg), Alembic, Pydantic v2, `firebase-admin`
- Mobile: React Native 0.86, Expo 57, React Navigation 6, Zustand, Axios, i18next

**Storage**: PostgreSQL 16 with TimescaleDB extension (`appointments`, `appointment_reminders`, `audit_logs`)

**Testing**: `pytest` for backend unit/integration tests; `tsc --noEmit` and `eslint` for mobile static analysis

**Target Platform**: Android & iOS (via Expo React Native) and Linux Cloud Container (Docker Compose)

**Project Type**: Mobile Application + Asynchronous Cloud REST API

**Performance Goals**:
- Conflict checking and appointment creation response time < 150ms
- Push notification reminder trigger accuracy within ±60s of the planned window
- Appointment list retrieval < 100ms

**Constraints**:
- Strict multi-tenancy & patient data privacy (RBAC enforced on all endpoints)
- Zero phantom notifications when appointments are cancelled, rescheduled, or marked complete
- No scheduling in the past

**Scale/Scope**:
- Multi-house support with recurring visit generation (up to 12 occurrences per series)
- 2 mobile screens/modals updated (Doctor view with actions, Family view in read-only)

---

## Constitution Check

*GATE: Evaluated against Smart Elderly Care AI Constitution (v1.0.0). All gates PASS.*

| Principle | Compliance Status | Implementation Evidence |
|-----------|-------------------|--------------------------|
| **I. Modular Architecture & Service Boundaries** | **PASS** | Clean separation between `apps/mobile` and `backend`. Communication strictly adheres to REST contract `/api/v1/doctor/appointments` and `/api/v1/mobile/patients/{id}/appointments`. Mobile components modularized under `features/doctor/components/appointments/`. |
| **II. Async-First & Resilient Real-Time Communication** | **PASS** | Backend endpoints use `async`/`await` with SQLAlchemy 2.0 AsyncSession. `AppointmentSchedulerService` runs in the background within FastAPI's lifespan loop, dispatching high-priority FCM notifications. |
| **III. Data Integrity & Time-Series Optimization** | **PASS** | Database tables `appointments` and `appointment_reminders` are managed via Alembic migrations in TimescaleDB/PostgreSQL. Full schema validation with Pydantic v2. |
| **IV. Edge Autonomy & Edge-Cloud Synergy** | **PASS** | Central appointment schedule is stored in Cloud Backend; home visit flags can be published to the patient's Edge Hub via MQTT if smart speaker announcements are enabled. |
| **V. Security, Privacy & Role-Based Access Control** | **PASS** | Strict RBAC enforced: Doctors only can modify appointments; Family/Caregiver roles have strictly read-only access. Auditing recorded in `audit_logs`. |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-appointments/
├── spec.md              # Feature specification & requirements
├── plan.md              # This file (implementation plan)
├── research.md          # Technical research & architectural decisions
├── data-model.md        # Relational schema, ERD, and Pydantic models
├── quickstart.md        # Step-by-step developer and testing guide
├── contracts/           # OpenAPI 3.0 specification
│   └── appointments-api.yaml
└── checklists/
    └── requirements.md  # Quality verification checklist
```

### Source Code (Concrete layout for this feature)

```text
smart-elderly-care-ai/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   ├── mobile/
│   │   │   │   ├── doctor.py           # Updated doctor appointment CRUD endpoints
│   │   │   │   └── patients.py         # Added family read-only appointments endpoint
│   │   ├── crud/
│   │   │   └── crud_appointment.py     # SQLAlchemy async CRUD operations & conflict check
│   │   ├── models/
│   │   │   └── appointment.py          # SQLAlchemy models (Appointment, AppointmentReminder)
│   │   ├── schemas/
│   │   │   └── appointment.py          # Pydantic v2 schemas (Create, Update, Cancel, Response)
│   │   ├── services/
│   │   │   └── appointment_scheduler.py# Background worker for 24h & 2h FCM reminder dispatch
│   │   └── main.py                     # Register scheduler in lifespan
│   └── database/
│       └── scripts/schema.sql          # SQL DDL for appointments & appointment_reminders
│
└── apps/mobile/
    └── src/
        ├── services/
        │   └── api.ts                  # Updated doctorApi & patientApi appointment methods
        ├── features/
        │   └── doctor/
        │       ├── screens/
        │       │   └── DoctorAppointmentsScreen.tsx  # Enhanced appointments screen with tabs & patient binding
        │       └── components/appointments/
        │           ├── AppointmentCard.tsx            # Appointment card with status badge & actions
        │           ├── AppointmentFormModal.tsx       # Overhauled modal: Patient Picker, DateTimePicker, Active Chips, Sticky Footer
        │           ├── AppointmentCancelModal.tsx     # Cancel modal with mandatory reason input
        │           └── AppointmentCompleteModal.tsx   # Completion confirmation dialog
        └── features/dashboard/
            └── components/
                └── FamilyAppointmentsModal.tsx        # Read-only appointments view for family
```

**Structure Decision**: The feature spans two sub-projects (`backend` and `apps/mobile`) following the modular multi-app architecture defined in the project constitution.

---

## UI/UX Redesign Specifications for Appointment Creation (`AppointmentFormModal.tsx`)

### 1. Patient Picker Component
- **Input**: `patients: DoctorPatientCard[]` passed from `DoctorAppointmentsScreen.tsx`.
- **UI Element**: Horizontal scrollable list or interactive selector of patient cards displaying:
  - Patient initials / avatar badge.
  - Full Name (e.g., "Cụ Nguyễn Văn An").
  - Age & Room / House info (e.g., "78 tuổi • Căn hộ 201").
- **Behavior**: Tapping a patient updates `patientId`, `patientName`, and automatically defaults `location` to the patient's house address. Active patient card displays a primary cyan/blue border (`#0284C7`), subtle background tint, and a checkmark badge.

### 2. Structured DateTime Picker Component
- **Problem Solved**: Replaces raw text typing (`"15/10/2026 - 08:30"`) with a reliable, zero-dependency interactive picker.
- **Sub-components**:
  - **Quick Date Chips**: One-tap buttons for `Hôm nay`, `Ngày mai`, `+3 ngày`, `+1 tuần`, `+1 tháng`.
  - **Date Selector**: Day / Month / Year stepper controls or interactive date picker sheet.
  - **Consultation Time Slot Grid**: Selectable chips for standard medical slots (`08:00`, `08:30`, `09:00`, `09:30`, `10:00`, `14:00`, `14:30`, `15:00`, `15:30`, `16:00`).
  - **Timestamp Standardization**: Translates selected date and slot into an ISO 8601 string (`YYYY-MM-DDTHH:mm:00Z`), guaranteeing zero Pydantic validation failures.

### 3. Consultation Modality (Chỉ 2 loại) & Active Exam Type Chips
- **Visit Modality Chips (2 loại chính thức)**:
  - `Ở nhà bệnh nhân` (`HOME_VISIT`)
  - `Phòng khám của bác sĩ` (`CLINIC`)
- **Active State Styling**: Selected chip transitions from muted border/surface to solid blue background (`#0284C7`) with white text and active icon indicator.
- **Location Presets**:
  - Khi chọn `Ở nhà bệnh nhân`: Tự động điền địa chỉ nhà đăng ký của cụ (`Tại nhà: [Địa chỉ nhà cụ]`).
  - Khi chọn `Phòng khám của bác sĩ`: Tự động điền địa chỉ phòng khám bác sĩ (`Phòng khám Bác sĩ Gia đình (123 Hải Phòng, Đà Nẵng)`).

### 4. Sticky Modal Action Footer
- **Problem Solved**: Eliminates cut-off buttons caused by scrolling inside modal dialogs.
- **UI Structure**: Actions container placed as a sibling to `ScrollView` at the bottom of the modal card.
- **Styling**: Elevated border top, `paddingBottom` honoring `useSafeAreaInsets().bottom`, containing "Hủy" (secondary outline) and "Xác nhận tạo lịch" / "Cập nhật lịch khám" (primary solid with loading spinner).

### 5. Notification, Family Confirmation & Post-Confirmation Lifecycle
1. **Tạo lịch khám & Bắn thông báo**:
   - Khi bác sĩ bấm *"Xác nhận tạo lịch"*, hệ thống lưu lịch hẹn và tự động phát lệnh FCM Push Notification tới tất cả thiết bị của Người thân / Chủ nhà liên kết với cụ.
   - Nếu bật loa thông minh, hệ thống gửi lệnh qua MQTT tới Hub Orange Pi 5 để phát loa giọng nói tiếng Việt tại nhà cụ.
2. **Xác nhận từ Người thân (Family Confirmation)**:
   - Người thân nhận thông báo trên điện thoại và mở thẻ lịch hẹn để xác nhận khả năng đón tiếp (cho khám tại nhà) hoặc đưa đón (cho khám tại phòng khám).
   - Bấm **"Đồng ý / Xác nhận"**: Trạng thái chuyển sang `UPCOMING (Đã xác nhận)`, bác sĩ nhận được phản hồi xác nhận.
   - Bấm **"Yêu cầu đổi giờ"**: Người thân gửi lý do và đề xuất khung giờ khác nếu cụ bận hoặc gia đình vắng nhà.
3. **Kích hoạt lịch nhắc nhở (Reminders Trigger)**:
   - Hệ thống tự động đặt 2 mốc nhắc nhở: **Trước 24h** và **Trước 2h** (FCM + Loa Hub AI).
4. **Tiến hành khám & Hoàn thành**:
   - Bác sĩ thăm khám theo lịch đã hẹn, cập nhật sinh hiệu, đơn thuốc.
   - Bác sĩ bấm **"Xác nhận đã khám xong"**, trạng thái chuyển sang `COMPLETED`, tự động hủy các mốc nhắc nhở còn lại và gửi thông báo tóm tắt kết quả khám cho gia đình.

---

## Complexity Tracking

*No constitutional violations. Complexity is strictly contained within standard service layers.*

| Element | Why Needed | Simpler Alternative Rejected Because |
|---------|------------|--------------------------------------|
| `AppointmentReminder` table | Tracks discrete reminder events (24h, 2h) | Simple cron checking appointment table directly would re-scan large datasets and risk sending duplicate reminders upon server restarts. |
| Background Asyncio Worker | Dispatches due FCM notifications autonomously | Celery/Redis Queue adds heavy operational overhead for a 60-second polling cadence that easily fits inside FastAPI lifespan. |
| Custom Zero-Dependency DateTime Selector | Eliminates manual string parsing errors | Native datetime picker libraries (`@react-native-community/datetimepicker`) require native rebuilds that risk breaking Expo Go on cross-platform setups. |

