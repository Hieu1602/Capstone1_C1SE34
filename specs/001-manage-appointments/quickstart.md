# Quickstart & Verification Guide: Manage Appointments and Follow-up Visits (UC.0)

**Feature**: `001-manage-appointments` | **Date**: 2026-10-23

This guide provides step-by-step instructions for running, testing, and validating the Appointments feature across Backend and Mobile.

---

## 1. Prerequisites

1. Docker & Docker Compose running (TimescaleDB, Redis, EMQX, Backend).
2. Node.js 18+ and Expo CLI installed for Mobile app testing.
3. Valid Doctor and Family user accounts created in the system.

---

## 2. Backend Migration & Setup

### 2.1 Apply Database Migration
Ensure the `appointments` and `appointment_reminders` tables are migrated:
```bash
cd smart-elderly-care-ai/backend
alembic upgrade head
```

### 2.2 Verify Background Scheduler
The `AppointmentSchedulerService` starts automatically with FastAPI's lifespan:
```bash
docker-compose logs -f backend | grep "AppointmentSchedulerService"
```
You should see: `[INFO] AppointmentSchedulerService started. Polling interval: 60s.`

---

## 3. API Verification (via cURL or Swagger UI)

Access Swagger UI at `http://localhost:8000/docs`.

### Step 1: Create a New Appointment as Doctor
```bash
curl -X POST http://localhost:8000/api/v1/doctor/appointments \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "<PATIENT_UUID>",
    "scheduled_at": "2026-10-25T09:00:00Z",
    "duration_minutes": 30,
    "visit_type": "HOME_VISIT",
    "location": "Tại nhà bệnh nhân (123 Lê Duẩn, Đà Nẵng)",
    "clinical_notes": "Kiểm tra huyết áp và điều chỉnh liều Amlodipine.",
    "recurrence_pattern": "MONTHLY",
    "recurrence_occurrences": 3
  }'
```
**Expected Response**: `HTTP 201 Created` with `created_count: 3` and `scheduled_reminders_count: 6` (2 reminders per occurrence).

### Step 2: Test Conflict Detection
Attempt to create another appointment for the same patient overlapping that slot (`2026-10-25T09:15:00Z`):
```bash
curl -X POST http://localhost:8000/api/v1/doctor/appointments \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "<PATIENT_UUID>",
    "scheduled_at": "2026-10-25T09:15:00Z",
    "location": "Phòng khám"
  }'
```
**Expected Response**: `HTTP 409 Conflict` with `"Thời gian hẹn bị trùng với lịch khám khác của Bác sĩ hoặc Bệnh nhân."`

### Step 3: Reschedule an Appointment
```bash
curl -X PUT http://localhost:8000/api/v1/doctor/appointments/<APPOINTMENT_ID> \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduled_at": "2026-10-26T10:00:00Z",
    "clinical_notes": "Dời lịch do bác sĩ có ca phẫu thuật đột xuất."
  }'
```
**Expected Response**: `HTTP 200 OK` with updated `scheduled_at`. Reminders table should show old reminders `CANCELLED` and new reminders `PENDING`.

### Step 4: Confirm Completion
```bash
curl -X POST http://localhost:8000/api/v1/doctor/appointments/<APPOINTMENT_ID>/complete \
  -H "Authorization: Bearer <DOCTOR_TOKEN>"
```
**Expected Response**: `HTTP 200 OK` with `status: "COMPLETED"`.

### Step 5: Cancel an Appointment
```bash
curl -X POST http://localhost:8000/api/v1/doctor/appointments/<APPOINTMENT_ID>/cancel \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cancellation_reason": "Bệnh nhân chuyển viện theo dõi chuyên khoa tim mạch."
  }'
```
**Expected Response**: `HTTP 200 OK` with `status: "CANCELLED"`.

### Step 6: Verify Read-Only Access for Family
```bash
curl -X GET http://localhost:8000/api/v1/mobile/patients/<PATIENT_UUID>/appointments \
  -H "Authorization: Bearer <FAMILY_TOKEN>"
```
**Expected Response**: `HTTP 200 OK` with the list of appointments.

---

## 4. Mobile UI Verification

1. Start Expo dev server:
   ```bash
   cd smart-elderly-care-ai/apps/mobile
   npm start
   ```
2. Log in as **Doctor**:
   - Navigate to the **Lịch Khám** tab in `DoctorTabNavigator`.
   - Verify 3 filter tabs: **Sắp tới (UPCOMING)**, **Đã khám (COMPLETED)**, **Đã hủy (CANCELLED)**.
   - Tap **"Tạo lịch khám mới"** (or "+ Đặt lịch mới"):
     - **Patient Selector**: Select an elderly patient from the horizontal card list. Verify patient name, age, and room/house display correctly and active card is highlighted with blue border and checkmark.
     - **Date & Time Picker**: Tap quick date presets ("Hôm nay", "Ngày mai", "+3 ngày", "+1 tuần"). Tap a clinical time slot chip ("08:30", "09:00", "14:30"). Verify timestamp auto-formats.
     - **Modality & Purpose**: Tap modality chip (`Khám tại nhà`, `Phòng khám`, `Tư vấn từ xa / Video`). Verify location auto-populates. Tap an exam purpose chip (`Tái khám tim mạch`, `Xét nghiệm máu`) and observe active chip highlighting.
     - **Recurrence & Voice Speaker**: Toggle recurrence (`Hàng tháng`, 3 lần lặp) and voice speaker switch.
     - **Sticky Action Footer**: Scroll down the form — confirm "Hủy" and "Lưu lịch hẹn" remain sticky at the bottom and are not cut off. Tap **"Lưu lịch hẹn"**.
   - Verify cards render with full details and action buttons (**Dời lịch**, **Xác nhận đã khám**, **Hủy hẹn**).
   - Test cancel modal: ensure confirmation button is disabled until cancellation reason is entered.
3. Log in as **Family Member**:
   - Open patient detail / care section.
   - View scheduled appointments: verify action buttons (Edit, Cancel, Create) are not rendered; read-only badges and details are displayed.

