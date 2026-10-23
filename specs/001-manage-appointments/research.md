# Technical Research: Manage Appointments and Follow-up Visits (UC.0)

**Feature**: `001-manage-appointments` | **Date**: 2026-10-23

## Executive Summary

The existing appointment implementation relied on an in-memory mock store (`_APPOINTMENT_STORE` in `crud_doctor.py`), lacked database persistence, had no real notification scheduler, lacked recurrence logic, and offered no read-only view for family members. This research defines the architectural solutions to modernize the feature into an enterprise-grade, production-ready system complying with the **Smart Elderly Care AI Constitution (v1.0.0)**.

---

## 1. Database Architecture & Data Modeling

### Decision: Dedicated PostgreSQL Tables with Async SQLAlchemy 2.0
We replace the in-memory array with two normalized relational tables in PostgreSQL / TimescaleDB:
1. `appointments`: Stores core visit records, clinical instructions, status, and recurrence hierarchy.
2. `appointment_reminders`: Tracks automated reminder dispatch jobs (24h and 2h windows).

### Schema Design & Indexing
- **`appointments` table**:
  - `id`: UUID (Primary Key)
  - `doctor_id`: UUID (Foreign Key to `users.id`, Indexed)
  - `patient_id`: UUID (Foreign Key to `patients.id`, Indexed)
  - `house_id`: UUID (Foreign Key to `houses.id`, for family isolation)
  - `created_by`: UUID (Foreign Key to `users.id`)
  - `visit_type`: Enum (`CLINIC`, `HOME_VISIT`, `TELEHEALTH`)
  - `scheduled_at`: `TIMESTAMPTZ` (UTC)
  - `duration_minutes`: Integer (default: 30)
  - `location`: String (e.g. "Phòng khám Đa khoa", "Tại nhà bệnh nhân")
  - `clinical_notes`: Text (nullable)
  - `status`: Enum (`UPCOMING`, `COMPLETED`, `CANCELLED`)
  - `cancellation_reason`: Text (nullable, required if status is `CANCELLED`)
  - `recurrence_pattern`: Enum (`NONE`, `WEEKLY`, `MONTHLY`, `QUARTERLY`)
  - `recurrence_end_date`: `DATE` (nullable)
  - `parent_recurring_id`: UUID (nullable, self-referencing to parent series)
  - `created_at`, `updated_at`: `TIMESTAMPTZ`

- **Composite Indexes**:
  - `idx_appointments_doctor_time`: `(doctor_id, scheduled_at)` for conflict checks and doctor calendar queries.
  - `idx_appointments_patient_time`: `(patient_id, scheduled_at)` for patient schedule and conflict detection.
  - `idx_appointments_status_time`: `(status, scheduled_at)` for filtering active upcoming visits.

---

## 2. Schedule Conflict Detection

### Algorithm: Interval Overlap Verification
An appointment occupies the time window `[T_start, T_end)` where `T_end = T_start + duration_minutes`.
Before inserting or rescheduling, the query validates:
```sql
SELECT id FROM appointments
WHERE status = 'UPCOMING'
  AND (id != :current_appointment_id OR :current_appointment_id IS NULL)
  AND (doctor_id = :doctor_id OR patient_id = :patient_id)
  AND (
      (scheduled_at < :new_end_time) AND
      (scheduled_at + (duration_minutes || ' minutes')::interval > :new_start_time)
  );
```
If any records match, an `HTTP 409 Conflict` is returned with detail: `"Thời gian hẹn bị trùng với lịch khám khác của Bác sĩ hoặc Bệnh nhân."`

---

## 3. Automated Reminder Dispatch Engine

### Evaluation of Options:
1. *Celery / APScheduler*: Heavyweight, adds dependency overhead, requires additional broker orchestration.
2. *Asyncio Background Worker with Database State*: Lightweight, zero extra infrastructure, fully persistent, automatically runs within FastAPI lifespan.

### Decision: Persistent State Worker (`AppointmentSchedulerService`)
- When an appointment is scheduled/rescheduled, the system creates rows in `appointment_reminders`:
  - `reminder_type = 'BEFORE_24H'`: `scheduled_time = scheduled_at - INTERVAL '24 hours'`
  - `reminder_type = 'BEFORE_2H'`: `scheduled_time = scheduled_at - INTERVAL '2 hours'`
- **Rule for short-notice bookings**: If `scheduled_time < NOW()`, the record is marked `CANCELLED` (or omitted) so stale notifications are never triggered.
- A background worker wakes up every 60 seconds (using `asyncio.sleep(60)` inside FastAPI's lifespan task):
  ```sql
  SELECT * FROM appointment_reminders
  WHERE status = 'PENDING' AND scheduled_time <= NOW()
  FOR UPDATE SKIP LOCKED;
  ```
- For each due reminder:
  1. Gathers FCM device tokens for the assigned Doctor and registered Family Members of the patient's house.
  2. Sends multicast high-priority FCM notification via `firebase-admin`.
  3. Updates reminder status to `SENT` and records `sent_at = NOW()`.
- On appointment reschedule, cancellation, or completion:
  ```sql
  UPDATE appointment_reminders
  SET status = 'CANCELLED'
  WHERE appointment_id = :appointment_id AND status = 'PENDING';
  ```
  This guarantees **zero phantom notifications**.

---

## 4. Recurrence Series Generation Strategy

### Algorithm: Upfront Instance Generation with Bounded Horizon
To avoid complex runtime projection logic and allow individual rescheduling of recurring visits:
- When a doctor creates an appointment with `recurrence_pattern in ('WEEKLY', 'MONTHLY', 'QUARTERLY')`:
  - Maximum limit: 12 occurrences (or up to `recurrence_end_date`).
  - The first visit is created with `parent_recurring_id = NULL`.
  - For each subsequent interval ($k = 1..N$):
    - Compute `target_date = base_date + k * interval`.
    - Check conflicts for that specific slot. If a conflict occurs, report it clearly or adjust.
    - Insert child appointment with `parent_recurring_id = first_appointment.id`.
    - Schedule individual reminder records for each child instance.

---

## 5. Security & Multi-Role Access Control (RBAC)

- **Doctor Role (`doctor`)**:
  - Full CRUD on appointments where `doctor_id == current_user.id` or assigned to their care network.
  - Endpoints: `POST /api/v1/doctor/appointments`, `PUT /api/v1/doctor/appointments/{id}`, `DELETE /api/v1/doctor/appointments/{id}`.
- **Family / Caregiver Role (`family`, `caregiver`)**:
  - Read-only access to appointments for patients residing in their managed house (`house_id`).
  - Endpoints: `GET /api/v1/mobile/houses/{house_id}/appointments` or `GET /api/v1/mobile/patients/{patient_id}/appointments`.
  - Attempting mutation endpoints produces `403 Forbidden`.

---

## 6. Mobile Form UX Architecture & Technical Decisions

### 6.1 Patient Selection Architecture
- **Problem**: Previously used raw `TextInput` with placeholder `"VD: Cụ Nguyễn Văn An"`. This created severe data integrity issues: `patient_id` was decoupled from the typed name, risking incorrect patient ID association or backend 404/422 errors.
- **Decision**: Integrate a visual Patient Picker directly tied to the doctor's assigned patient roster (`doctorApi.getPatients()`).
  - Renders horizontal card pills showing Patient Avatar / Initial, Full Name, Age, and Room / House address.
  - Selecting a patient immediately binds the verified `patient_id` (UUID), pre-fills the patient's house address into `location`, and highlights the selected card with an active border (`#0284C7`) and checkmark icon.

### 6.2 Zero-Dependency Interactive DateTime Picker
- **Problem**: Free-text string input `"15/10/2026 - 08:30"` was error-prone, requiring doctors to remember exact syntax, and caused ISO parsing exceptions when sent to the backend. Adding native datetime picker packages might break Expo Go / web compatibility.
- **Decision**: Build a composite zero-native-dependency DateTime selector:
  1. **Quick Date Presets**: One-tap buttons for common follow-up intervals:
     - "Hôm nay" (Today)
     - "Ngày mai" (Tomorrow)
     - "3 ngày tới" (+3 Days)
     - "1 tuần tới" (+7 Days)
     - "1 tháng tới" (+30 Days)
  2. **Interactive Date Grid**: Dropdown calendar / date stepper allowing specific day/month/year selection.
  3. **Time Slot Selector**: Common clinical consultation hours presented as selectable chips:
     - Morning slots: `08:00`, `08:30`, `09:00`, `09:30`, `10:00`, `10:30`
     - Afternoon slots: `14:00`, `14:30`, `15:00`, `15:30`, `16:00`
  4. **Output Standardization**: Automatically converts the selected date and time to ISO-8601 string (`YYYY-MM-DDTHH:mm:ssZ`) for seamless Pydantic parsing.

### 6.3 Active Chip Highlighting & Modality Presets
- **Problem**: Chips for examination type were static without indicating the active selection, and visit modality (`HOME_VISIT`, `CLINIC`, `TELEHEALTH`) was absent from the UI.
- **Decision**:
  - Add consultation modality chips (`Khám tại nhà`, `Phòng khám`, `Tư vấn từ xa / Video`) that map directly to `VisitTypeEnum`.
  - Implement active chip states (`selected ? styles.activeChip : styles.inactiveChip`) with smooth visual transitions, icon indicators, and contrasting text colors.
  - Auto-suggest location based on modality (e.g. for `HOME_VISIT`, auto-fill with the selected patient's registered house address).

### 6.4 Sticky Modal Footer & SafeArea Layout
- **Problem**: Action buttons were inside the `ScrollView`, causing them to be cut off at the bottom or hidden beneath navigation gestures and small screens.
- **Decision**: Anchor the action buttons in a fixed sticky footer (`modalFooter`) positioned outside the `ScrollView`, with `useSafeAreaInsets` bottom padding and top border separator. This guarantees the "Hủy" and "Lưu lịch hẹn" actions remain 100% visible and accessible regardless of scroll position or keyboard visibility.
