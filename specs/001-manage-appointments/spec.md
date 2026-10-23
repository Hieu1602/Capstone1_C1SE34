# Feature Specification: Manage Appointments and Follow-up Visits

**Feature Branch**: `001-manage-appointments`

**Created**: 2026-10-23

**Status**: Ready for Planning

**Input**: User description: "UC.0 Manage Appointments and Follow-up Visits. Cung cấp quy trình toàn diện cho Bác sĩ gia đình để tạo mới, tra cứu, dời lịch, hủy bỏ hoặc xác nhận hoàn thành các cuộc hẹn khám định kỳ và tái khám của người cao tuổi; tự động kích hoạt thông báo nhắc nhở trên thiết bị di động."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and View Upcoming Appointments (Priority: P1)

As a Family Physician, I want to create a new medical examination or follow-up appointment for an elderly patient with full visit details (patient name, consultation type, date/time, location/room, clinical notes/preparation guidelines), so that the patient and caregivers can track the care plan and the system can prepare reminders.

**Why this priority**: Core primary journey required for the appointment management lifecycle. Without the ability to create and inspect appointments, no other downstream action (reminders, rescheduling, completion) is possible.

**Independent Test**: Can be independently tested by logging in as an authorized Doctor, creating a valid appointment for an active patient, and verifying it appears in the "UPCOMING" list with all details intact. Family members can log in and view the appointment in read-only mode.

**Acceptance Scenarios**:

1. **Given** an authenticated Family Physician and an active patient, **When** the physician inputs valid appointment details (patient, visit type, future date & time, location, clinical notes) and confirms creation, **Then** the system validates no scheduling conflicts exist, persists the appointment with status `UPCOMING`, registers automatic push reminder jobs (24h and 2h before), and makes it visible to both the doctor and the patient's family.
2. **Given** a physician scheduling an appointment, **When** the selected date/time is in the past or conflicts with an existing appointment for the doctor or patient, **Then** the system rejects the submission with a clear localized error message and prevents record creation.
3. **Given** an authenticated Family Member, **When** they view the Appointments screen, **Then** they can see all scheduled, completed, and cancelled appointments in read-only mode, without edit, cancel, or create controls.

---

### User Story 2 - Reschedule and Edit Upcoming Appointment (Priority: P2)

As a Family Physician, I want to modify the appointment time, location, or notes when medical schedules or patient conditions change, so that the patient and caregivers are always updated with accurate information.

**Why this priority**: Medical schedules frequently change due to emergency cases or patient availability; rescheduling is crucial for schedule maintenance without needing to delete and recreate appointments.

**Independent Test**: Can be tested by selecting an existing `UPCOMING` appointment as the assigned doctor, updating the date/time to a new valid future slot, and verifying that the record is updated, the previous reminder triggers are cancelled, and new reminders are scheduled.

**Acceptance Scenarios**:

1. **Given** an existing appointment in `UPCOMING` status, **When** the assigned physician selects "Chỉnh sửa / Dời lịch", changes the date/time to a valid non-conflicting future slot, and saves changes, **Then** the system updates the record, cancels obsolete reminder jobs, schedules new reminders, and logs an audit record.
2. **Given** an appointment in `COMPLETED` or `CANCELLED` status, **When** a doctor views the appointment, **Then** editing and rescheduling options are disabled.

---

### User Story 3 - Confirm Appointment Completion (Priority: P3)

As a Family Physician, I want to mark an appointment as completed once the visit has taken place, so that the patient's medical history accurately reflects care delivery and outstanding reminders are dismissed.

**Why this priority**: Ensures data accuracy and prevents false reminder notifications after a visit has already been conducted.

**Independent Test**: Can be tested by taking an `UPCOMING` appointment, confirming completion as the attending doctor, and verifying status transitions to `COMPLETED` while reminder triggers are cleared.

**Acceptance Scenarios**:

1. **Given** an ongoing or past-due `UPCOMING` appointment, **When** the assigned physician taps "Xác nhận đã khám xong" and confirms the modal dialog, **Then** the appointment status updates to `COMPLETED`, remaining reminder triggers are cancelled, and the action is recorded in the Audit Log.

---

### User Story 4 - Cancel Appointment with Justification (Priority: P4)

As a Family Physician, I want to cancel a scheduled appointment with a mandatory cancellation reason, so that the family is informed of why the visit was cancelled and no invalid reminders are dispatched.

**Why this priority**: Essential for handling cancellations cleanly with full auditability and preventing unnecessary travel or alarms.

**Independent Test**: Can be tested by selecting an `UPCOMING` appointment, submitting cancellation with a reason string, and verifying status changes to `CANCELLED` with the reason recorded.

**Acceptance Scenarios**:

1. **Given** an `UPCOMING` appointment, **When** the physician clicks "Hủy lịch hẹn", provides a non-empty cancellation reason, and confirms, **Then** the appointment status transitions to `CANCELLED`, remaining reminders are dismissed, cancellation push notifications are dispatched to the family, and the action is logged.
2. **Given** a physician attempting to cancel, **When** the cancellation reason is left empty, **Then** the system blocks submission and prompts the user to provide a reason.

---

### User Story 5 - Schedule Recurring Routine Visits (Priority: P5)

As a Family Physician, I want to set up recurring routine visits (weekly, monthly, quarterly) for chronic care monitoring, so that elderly patients have a continuous long-term care plan without manually creating each visit individually.

**Why this priority**: Chronic elderly care requires regular follow-ups (e.g. monthly blood pressure and diabetes reviews). Automating recurring appointments significantly reduces administrative overhead.

**Independent Test**: Can be tested by creating an appointment with recurrence set to `MONTHLY` for 3 occurrences, verifying 3 distinct linked appointment records are generated, each with its own reminders and non-conflicting time slots.

**Acceptance Scenarios**:

1. **Given** a physician creating an appointment, **When** they select a recurrence frequency (`WEEKLY`, `MONTHLY`, `QUARTERLY`) and specify an occurrence count or end date, **Then** the system generates linked recurring appointment instances, checks each for scheduling conflicts, and schedules corresponding reminders.
2. **Given** a series of recurring appointments, **When** the physician modifies or cancels one instance, **Then** the system allows them to choose between updating "Chỉ lịch này (This visit only)" or "Lịch này và các lịch tiếp theo (This and all following visits)".

---

### Edge Cases

- **Exact Duplicate Schedule**: Two users attempting to book overlapping slots for the same patient or doctor concurrently; database lock or unique constraint must reject the collision cleanly.
- **Short Notice Appointments**: When an appointment is booked less than 24 hours (e.g. 5 hours) or less than 2 hours before the scheduled time, the system schedules only remaining applicable reminder triggers (e.g., skip the 24h trigger if booked 5h in advance, and schedule only the 2h trigger).
- **Timezone Inconsistencies**: Appointments stored in UTC with timezone offset; mobile client displays in local Vietnam time (Asia/Ho_Chi_Minh / UTC+7).
- **Network Loss during Booking**: Mobile client retries with an idempotency key to prevent creating duplicate appointments if network drops during confirmation.
- **Unauthorized Role Actions**: Family Members attempting to hit the POST/PUT/DELETE appointment endpoints directly via API must receive `403 Forbidden`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an appointment overview categorized by status tabs: Sắp tới (`UPCOMING`), Đã khám (`COMPLETED`), and Đã hủy (`CANCELLED`).
- **FR-002**: System MUST validate that new appointment date/time is strictly in the future relative to the current timestamp.
- **FR-003**: System MUST check for scheduling conflicts and prevent booking if the selected patient or doctor already has an overlapping appointment in the chosen time window.
- **FR-004**: System MUST capture essential appointment fields: Patient ID, Doctor ID, Visit Type (2 hình thức: Ở nhà bệnh nhân `HOME_VISIT` hoặc Phòng khám của bác sĩ `CLINIC`), Scheduled Start Time, Estimated Duration, Location/Room, Clinical Notes/Preparation Instructions, and Recurrence Settings.
- **FR-005**: System MUST automatically register push notification reminders via Firebase Cloud Messaging (FCM) at 24 hours and 2 hours prior to the scheduled start time.
- **FR-006**: System MUST cancel pending scheduled reminders whenever an appointment is rescheduled, completed, or cancelled.
- **FR-007**: System MUST enforce strict Role-Based Access Control (RBAC): Only authenticated Family Physicians assigned to the patient have permission to create, reschedule, cancel, or mark appointments as completed; Family Members and Caregivers have read-only access to view appointments.
- **FR-008**: System MUST deliver reminder notifications exclusively via Mobile Push Notifications (FCM) to the devices of the assigned doctor and family members.
- **FR-009**: System MUST support recurrence configuration: Appointments can be configured as a single visit or recurring (`WEEKLY`, `MONTHLY`, `QUARTERLY`) with an end date or max count (up to 12 occurrences).
- **FR-010**: System MUST record all appointment state mutations (creation, modification, cancellation, completion) in the system Audit Log.
- **FR-011**: Client application MUST allow physicians to select the target patient directly from their assigned patient roster (displaying patient name, avatar, age, and house/room) rather than typing raw text, strictly binding to the patient's verified `patient_id` (UUID).
- **FR-012**: Client application MUST provide structured date and time selection (quick preset date pills, interactive calendar, and time slot pills) and automatically format timestamps as ISO-8601 UTC to eliminate manual text typing syntax errors.
- **FR-013**: Consultation modality chips MUST support exactly 2 types: `HOME_VISIT` ("Ở nhà bệnh nhân") and `CLINIC` ("Phòng khám của bác sĩ"), displaying distinct active visual states when selected, and automatically suggesting location defaults (e.g. patient's house address for home visits).
- **FR-014**: The appointment creation and editing modal dialog MUST anchor action buttons ("Hủy", "Lưu lịch hẹn") in a fixed sticky footer outside the scrollable content area, honoring bottom safe-area insets to prevent buttons from being truncated or pushed offscreen.
- **FR-015**: When an appointment is scheduled, system MUST immediately dispatch instant FCM notifications to household members and queue voice reminders on the home Hub AI. Family members receive the appointment details to confirm availability. Upon visit completion by the doctor, updated vitals and clinical notes trigger an examination summary notification to the family.

### Key Entities

- **Appointment**: Represents a medical consultation or follow-up visit.
  - `id`: Unique identifier (UUID).
  - `patient_id`: Reference to the patient.
  - `doctor_id`: Reference to the assigned family physician.
  - `created_by`: ID of the creating doctor.
  - `visit_type`: Consultation modality (`HOME_VISIT`, `CLINIC`).
  - `scheduled_at`: Start timestamp (UTC).
  - `duration_minutes`: Estimated visit duration (default 30 mins).
  - `location`: Clinic address or home visit address.
  - `clinical_notes`: Clinical guidelines or patient preparation notes.
  - `status`: State enum (`UPCOMING`, `COMPLETED`, `CANCELLED`).
  - `cancellation_reason`: Text explanation if cancelled (required on cancellation).
  - `recurrence_pattern`: Recurrence rule enum (`NONE`, `WEEKLY`, `MONTHLY`, `QUARTERLY`).
  - `recurrence_end_date`: Optional expiration date for recurrence series.
  - `parent_recurring_id`: Optional UUID linking recurring occurrences to the parent series.
  - `created_at`, `updated_at`: Timestamps.

- **AppointmentReminder**: Tracks scheduled reminder jobs for each appointment.
  - `id`: Unique identifier (UUID).
  - `appointment_id`: Reference to the appointment.
  - `reminder_type`: Enum (`BEFORE_24H`, `BEFORE_2H`).
  - `scheduled_time`: Timestamp when reminder is due.
  - `status`: State enum (`PENDING`, `SENT`, `CANCELLED`).
  - `sent_at`: Timestamp when the FCM push was dispatched.

- **AuditLogEntry**: Records governance trace of state mutations.
  - `id`: Unique identifier.
  - `action`: Action string (e.g., `APPOINTMENT_CREATED`, `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_CANCELLED`, `APPOINTMENT_COMPLETED`).
  - `entity_name`: `Appointment`.
  - `entity_id`: UUID of the appointment.
  - `user_id`: Operator user ID.
  - `payload`: Snapshot of change data.
  - `timestamp`: Timestamp of action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Physicians can schedule a new single or recurring appointment in under 60 seconds with intuitive validation feedback.
- **SC-002**: 100% of conflicting or past-dated appointment requests are rejected with zero invalid database writes.
- **SC-003**: Automated FCM push reminders are dispatched within ±60 seconds of the planned 24-hour and 2-hour alert windows.
- **SC-004**: Zero phantom reminders are dispatched after an appointment has been cancelled, rescheduled, or marked as completed.
- **SC-005**: Appointment list retrieval and status filtering response time is under 200ms on mobile clients.
- **SC-006**: 100% of non-doctor modification attempts (e.g. from family accounts) are blocked with `403 Forbidden`.

## Assumptions

- Target users have authenticated access via JWT tokens containing user role (`doctor`, `family`, `admin`).
- Mobile app is running with notification permissions granted for Firebase Cloud Messaging (FCM).
- Patients are registered and active within the house/care unit prior to appointment creation.
- Timezone is standardized to UTC in the backend database and rendered in local device timezone (UTC+7 for Vietnam).
- The background scheduler service (e.g., Redis / APScheduler / Celery or asyncio background task) runs continuously to trigger FCM notifications at scheduled timestamps.
