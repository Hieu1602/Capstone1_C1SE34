# Tasks: Manage Appointments and Follow-up Visits (UC.0)

**Feature**: `001-manage-appointments` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize feature directory, contracts, and shared types across Backend and Mobile.

- [x] T001 Verify database connection and ensure PostgreSQL TimescaleDB is healthy in `smart-elderly-care-ai/docker-compose.yml`
- [x] T002 [P] Create appointment schemas and enum definitions in `smart-elderly-care-ai/backend/app/schemas/appointment.py`
- [x] T003 [P] Add TypeScript appointment interfaces and request types in `smart-elderly-care-ai/apps/mobile/src/services/api.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database tables, async CRUD base, and background scheduler infrastructure.

**⚠️ CRITICAL**: Must be complete before user stories can execute.

- [x] T004 Create SQLAlchemy models for `Appointment` and `AppointmentReminder` in `smart-elderly-care-ai/backend/app/models/appointment.py`
- [x] T005 Create database migration script / SQL DDL for `appointments` and `appointment_reminders` tables in `smart-elderly-care-ai/backend/database/scripts/schema.sql`
- [x] T006 Implement core database query methods and interval conflict checking in `smart-elderly-care-ai/backend/app/crud/crud_appointment.py`
- [x] T007 Implement background reminder service `AppointmentSchedulerService` in `smart-elderly-care-ai/backend/app/services/appointment_scheduler.py`
- [x] T008 Register scheduler background worker in FastAPI lifespan in `smart-elderly-care-ai/backend/app/main.py`

**Checkpoint**: Database tables created, async CRUD base and background worker ready.

---

## Phase 3: User Story 1 - Create and View Upcoming Appointments (Priority: P1) 🎯 MVP

**Goal**: Family Physicians can schedule new appointments with conflict validation; both Physicians and Family can view scheduled visits.

**Independent Test**: Log in as a Doctor, schedule a valid future visit for an active patient. Verify record is created in database, 24h & 2h reminder rows are queued, and the appointment appears in the "Sắp tới" (UPCOMING) tab on mobile.

### Tests for User Story 1
- [x] T009 [P] [US1] Write integration test for appointment creation and conflict rejection in `smart-elderly-care-ai/backend/tests/test_appointments.py`

### Implementation for User Story 1
- [x] T010 [US1] Implement `POST /api/v1/doctor/appointments` endpoint with conflict checking and reminder generation in `smart-elderly-care-ai/backend/app/api/v1/endpoints/mobile/doctor.py`
- [x] T011 [US1] Implement `GET /api/v1/doctor/appointments` endpoint with status and patient filtering in `smart-elderly-care-ai/backend/app/api/v1/endpoints/mobile/doctor.py`
- [x] T012 [P] [US1] Implement modular `AppointmentCard.tsx` component in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentCard.tsx`
- [x] T013 [P] [US1] Implement `AppointmentFormModal.tsx` for creating appointments with date/time pickers and validation in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentFormModal.tsx`
- [x] T014 [US1] Connect `DoctorAppointmentsScreen.tsx` to `doctorApi.getAppointments()` and `doctorApi.createAppointment()` in `smart-elderly-care-ai/apps/mobile/src/features/doctor/screens/DoctorAppointmentsScreen.tsx`

**Checkpoint**: User Story 1 functional — Doctors can create and inspect UPCOMING appointments. (MVP Ready)

---

## Phase 4: User Story 2 - Reschedule and Edit Upcoming Appointment (Priority: P2)

**Goal**: Family Physicians can edit appointment details or change date/time with automatic rescheduling of reminder jobs.

**Independent Test**: Select an UPCOMING appointment, update the time to a new valid future slot. Verify the record is updated, obsolete reminders are cancelled, and new reminders are scheduled.

### Tests for User Story 2
- [x] T015 [P] [US2] Write unit test for appointment rescheduling and reminder recreation in `smart-elderly-care-ai/backend/tests/test_appointments.py`

### Implementation for User Story 2
- [x] T016 [US2] Implement `PUT /api/v1/doctor/appointments/{id}` with conflict re-validation and reminder job recalculation in `smart-elderly-care-ai/backend/app/api/v1/endpoints/mobile/doctor.py`
- [x] T017 [US2] Support edit mode in `AppointmentFormModal.tsx` with pre-filled fields in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentFormModal.tsx`
- [x] T018 [US2] Wire "Chỉnh sửa / Dời lịch" action in `DoctorAppointmentsScreen.tsx` to call `doctorApi.updateAppointment()` in `smart-elderly-care-ai/apps/mobile/src/features/doctor/screens/DoctorAppointmentsScreen.tsx`

**Checkpoint**: User Stories 1 and 2 functional — Appointments can be created and rescheduled.

---

## Phase 5: User Story 3 - Confirm Appointment Completion (Priority: P3)

**Goal**: Family Physicians can mark an appointment as completed once the visit has occurred, dismissing any pending reminders.

**Independent Test**: Mark an UPCOMING appointment as completed. Verify status updates to `COMPLETED`, it moves to the "Đã khám" tab, and remaining reminder triggers are marked `CANCELLED`.

### Tests for User Story 3
- [x] T019 [P] [US3] Write test for marking appointment complete and verifying reminder dismissal in `smart-elderly-care-ai/backend/tests/test_appointments.py`

### Implementation for User Story 3
- [x] T020 [US3] Implement `POST /api/v1/doctor/appointments/{id}/complete` endpoint in `smart-elderly-care-ai/backend/app/api/v1/endpoints/mobile/doctor.py`
- [x] T021 [P] [US3] Implement `AppointmentCompleteModal.tsx` confirmation modal in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentCompleteModal.tsx`
- [x] T022 [US3] Connect "Xác nhận đã khám xong" button in `DoctorAppointmentsScreen.tsx` to completion endpoint in `smart-elderly-care-ai/apps/mobile/src/features/doctor/screens/DoctorAppointmentsScreen.tsx`

**Checkpoint**: User Stories 1, 2, and 3 functional — Full lifecycle through to visit completion.

---

## Phase 6: User Story 4 - Cancel Appointment with Justification (Priority: P4)

**Goal**: Family Physicians can cancel an appointment with a mandatory cancellation reason, notifying family and dismissing pending reminders.

**Independent Test**: Cancel an appointment with reason "Bệnh nhân nhập viện". Verify status changes to `CANCELLED`, it moves to the "Đã hủy" tab, reason is displayed, and reminders are dismissed.

### Tests for User Story 4
- [x] T023 [P] [US4] Write test for appointment cancellation with required reason in `smart-elderly-care-ai/backend/tests/test_appointments.py`

### Implementation for User Story 4
- [x] T024 [US4] Implement `POST /api/v1/doctor/appointments/{id}/cancel` endpoint validating mandatory reason in `smart-elderly-care-ai/backend/app/api/v1/endpoints/mobile/doctor.py`
- [x] T025 [P] [US4] Implement `AppointmentCancelModal.tsx` with required reason text input in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentCancelModal.tsx`
- [x] T026 [US4] Connect "Hủy lịch hẹn" action in `DoctorAppointmentsScreen.tsx` to cancellation endpoint in `smart-elderly-care-ai/apps/mobile/src/features/doctor/screens/DoctorAppointmentsScreen.tsx`

**Checkpoint**: User Stories 1 to 4 functional — Full single-visit lifecycle (Create, Edit, Complete, Cancel).

---

## Phase 7: User Story 5 - Schedule Recurring Routine Visits (Priority: P5)

**Goal**: Support recurring routine visits (`WEEKLY`, `MONTHLY`, `QUARTERLY`) up to 12 occurrences with bulk conflict validation.

**Independent Test**: Create a monthly recurring appointment with 3 occurrences. Verify 3 linked records are created in database, each with appropriate reminders and non-conflicting time slots.

### Implementation for User Story 5
- [x] T027 [US5] Implement recurrence series generator logic in `smart-elderly-care-ai/backend/app/crud/crud_appointment.py`
- [x] T028 [US5] Add recurrence selector UI (Không lặp, Hàng tuần, Hàng tháng, Hàng quý) and occurrence counter in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentFormModal.tsx`
- [x] T029 [US5] Display recurrence badges (e.g. "Định kỳ hàng tháng") on `AppointmentCard.tsx` in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentCard.tsx`

**Checkpoint**: Recurring appointments fully operational across Backend and Mobile.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Family read-only appointments view, audit logging, i18n translations, and end-to-end verification.

- [x] T030 Implement `GET /api/v1/mobile/patients/{patient_id}/appointments` for family read-only access in `smart-elderly-care-ai/backend/app/api/v1/endpoints/mobile/patients.py`
- [x] T031 [P] Implement `FamilyAppointmentsModal.tsx` (read-only view for caregivers/family) in `smart-elderly-care-ai/apps/mobile/src/features/dashboard/components/FamilyAppointmentsModal.tsx`
- [x] T032 [P] Add English and Vietnamese localization strings for appointment statuses, modals, and validation errors in `smart-elderly-care-ai/apps/mobile/src/i18n/english.ts`
- [x] T033 Record audit log entries on appointment actions (`CREATED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`) in `smart-elderly-care-ai/backend/app/crud/crud_appointment.py`
- [x] T034 Run end-to-end quickstart scenario verification per `specs/001-manage-appointments/quickstart.md`

---

## Phase 9: Appointment Form Modal UI/UX Overhaul & Patient Binding (Active Task)

**Purpose**: Modernize the Appointment Creation and Rescheduling modal (`AppointmentFormModal.tsx`) with an interactive Patient Picker, structured zero-dependency DateTimePicker, active chip feedback, and a sticky bottom footer.

- [x] T035 [P] Implement `PatientPicker` in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentFormModal.tsx` allowing one-tap selection from `patients: DoctorPatientCard[]`, displaying avatar initials, full name, age, and house/room with active border and checkmark.
- [x] T036 [P] Implement zero-dependency `DateTimePicker` in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentFormModal.tsx` with quick presets ("Hôm nay", "Ngày mai", "+3 ngày", "+1 tuần", "+1 tháng") and clinical time slot grid (`08:00` - `16:00`).
- [x] T037 [P] Implement active chip feedback for `examType` (Chuyên khoa/mục đích) and consultation modality chips (`Khám tại nhà`, `Phòng khám`, `Tư vấn từ xa / Video`) with location auto-suggestion in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentFormModal.tsx`.
- [x] T038 Convert modal action buttons ("Hủy", "Lưu lịch hẹn") into a fixed sticky footer outside `ScrollView` in `smart-elderly-care-ai/apps/mobile/src/features/doctor/components/AppointmentFormModal.tsx`, honoring `useSafeAreaInsets` bottom padding.
- [x] T039 Wire `DoctorAppointmentsScreen.tsx` to pass `patients` roster to `AppointmentFormModal.tsx`, bind selected `patientId`, and convert structured date-time into ISO-8601 UTC string upon submission in `smart-elderly-care-ai/apps/mobile/src/features/doctor/screens/DoctorAppointmentsScreen.tsx`.
- [x] T040 Verify mobile TypeScript compilation (`npx tsc --noEmit`), test modal behavior and appearance in both light and dark themes.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — **BLOCKS all user stories**.
- **Phase 3 (US1 - MVP)**: Depends on Phase 2 completion.
- **Phase 4 (US2 - Reschedule)**: Depends on Phase 3 completion.
- **Phase 5 (US3 - Complete)**: Depends on Phase 3 completion (can run parallel with US2).
- **Phase 6 (US4 - Cancel)**: Depends on Phase 3 completion (can run parallel with US2/US3).
- **Phase 7 (US5 - Recurrence)**: Depends on Phase 3 completion.
- **Phase 8 (Polish & Polish)**: Depends on all user story phases.

### Parallel Opportunities [P]
- T002 (Backend schemas) & T003 (Mobile types) can run in parallel.
- T012 (Card UI) & T013 (Form Modal UI) can run in parallel.
- T021 (Complete Modal) & T025 (Cancel Modal) can run in parallel.
- T031 (Family Modal) & T032 (i18n strings) can run in parallel.

---

## Implementation Strategy

### MVP First (Phases 1, 2, 3)
1. Complete Setup + Foundational (Database tables, CRUD, Scheduler).
2. Implement User Story 1 (Create & View appointments).
3. **Validate MVP**: Test appointment creation and list retrieval.

### Incremental Delivery (Phases 4 - 8)
1. Add User Story 2 (Reschedule) & User Story 3 (Complete).
2. Add User Story 4 (Cancel with reason) & User Story 5 (Recurrence).
3. Add Family Read-only view and final i18n polish.
