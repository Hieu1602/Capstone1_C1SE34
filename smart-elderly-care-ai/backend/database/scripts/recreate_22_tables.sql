-- =================================================================
-- SMART ELDERLY CARE AI (SECA) - FULL DDL RECREATE 22 TABLES
-- PostgreSQL 16 / 17 (Khớp 100% với 22 bảng & 283 cột thực tế)
-- =================================================================

-- PHẦN 1: EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB không khả dụng trên instance này; bảng vital_signs sẽ chạy ở dạng PostgreSQL chuẩn.';
END $$;

-- PHẦN 2: XÓA 22 BẢNG CŨ THEO THỨ TỰ PHỤ THUỘC (CASCADE)
DROP TABLE IF EXISTS "system_incidents" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "security_policies" CASCADE;
DROP TABLE IF EXISTS "system_notifications" CASCADE;
DROP TABLE IF EXISTS "support_tickets" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "chat_sessions" CASCADE;
DROP TABLE IF EXISTS "prescriptions" CASCADE;
DROP TABLE IF EXISTS "appointment_reminders" CASCADE;
DROP TABLE IF EXISTS "appointments" CASCADE;
DROP TABLE IF EXISTS "camera_recordings" CASCADE;
DROP TABLE IF EXISTS "incidents" CASCADE;
DROP TABLE IF EXISTS "vital_signs" CASCADE;
DROP TABLE IF EXISTS "device_configs" CASCADE;
DROP TABLE IF EXISTS "devices" CASCADE;
DROP TABLE IF EXISTS "device_groups" CASCADE;
DROP TABLE IF EXISTS "elderly_profiles" CASCADE;
DROP TABLE IF EXISTS "house_members" CASCADE;
DROP TABLE IF EXISTS "houses" CASCADE;
DROP TABLE IF EXISTS "user_login_histories" CASCADE;
DROP TABLE IF EXISTS "user_terminals" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- =================================================================
-- PHẦN 3: TẠO 22 BẢNG (DDL)
-- =================================================================

-- 1. Bảng users (29 cột)
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "hashed_password" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NULL,
    "avatar_url" TEXT NULL,
    "role" VARCHAR(20) NOT NULL,
    "preferred_language" VARCHAR(5) NOT NULL DEFAULT 'vi'::character varying,
    "font_size_mode" VARCHAR(20) NOT NULL DEFAULT 'system'::character varying,
    "custom_font_scale" INTEGER NOT NULL DEFAULT 2,
    "vibration_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "alert_sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "critical_alert_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cchn_number" VARCHAR(50) NULL,
    "specialty" VARCHAR(255) NULL,
    "workplace" VARCHAR(255) NULL,
    "is_active" BOOLEAN NOT NULL,
    "fcm_token" VARCHAR(500) NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "last_login_at" TIMESTAMPTZ NULL,
    "two_factor_enabled" BOOLEAN NULL DEFAULT false,
    "email" VARCHAR(255) NULL,
    "status" VARCHAR(30) NULL DEFAULT 'active'::character varying,
    "lock_reason" TEXT NULL,
    "locked_at" TIMESTAMPTZ NULL,
    "locked_by" UUID NULL,
    "lock_until" TIMESTAMPTZ NULL,
    "token_version" INTEGER NULL DEFAULT 1,
    CONSTRAINT "pk_users" PRIMARY KEY ("id")
);

-- 2. Bảng user_terminals (11 cột)
CREATE TABLE "user_terminals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_name" VARCHAR(255) NOT NULL,
    "device_type" VARCHAR(50) NOT NULL,
    "os" VARCHAR(100) NULL,
    "browser" VARCHAR(100) NULL,
    "ip_address" VARCHAR(50) NOT NULL,
    "location" VARCHAR(255) NULL,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_user_terminals" PRIMARY KEY ("id")
);

-- 3. Bảng user_login_histories (9 cột)
CREATE TABLE "user_login_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(50) NOT NULL,
    "location" VARCHAR(255) NULL,
    "login_time" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "login_method" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "user_agent" VARCHAR(500) NULL,
    CONSTRAINT "pk_user_login_histories" PRIMARY KEY ("id")
);

-- 4. Bảng houses (7 cột)
CREATE TABLE "houses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(300) NULL,
    "current_mode" VARCHAR(20) NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_houses" PRIMARY KEY ("id")
);

-- 5. Bảng house_members (12 cột)
CREATE TABLE "house_members" (
    "id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_in_house" VARCHAR(50) NOT NULL,
    "permissions" VARCHAR(50) NOT NULL,
    "can_view_health" BOOLEAN NOT NULL DEFAULT true,
    "can_view_camera" BOOLEAN NOT NULL DEFAULT true,
    "can_handle_emergency" BOOLEAN NOT NULL DEFAULT true,
    "can_manage_devices" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_records" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'::character varying,
    CONSTRAINT "pk_house_members" PRIMARY KEY ("id"),
    CONSTRAINT "uq_house_member" UNIQUE ("house_id", "user_id")
);

-- 6. Bảng elderly_profiles (19 cột)
CREATE TABLE "elderly_profiles" (
    "id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "birth_year" INTEGER NULL,
    "gender" VARCHAR(20) NULL,
    "medical_history" TEXT NULL,
    "conditions_json" TEXT NULL,
    "blood_type" VARCHAR(10) NULL,
    "height_cm" INTEGER NULL,
    "weight_kg" INTEGER NULL,
    "drug_allergies" TEXT NULL,
    "food_allergies" TEXT NULL,
    "dietary_notes" TEXT NULL,
    "emergency_contact_phone" VARCHAR(20) NULL,
    "avatar_url" VARCHAR(500) NULL,
    "face_embedding" TEXT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "doctor_id" UUID NULL,
    CONSTRAINT "pk_elderly_profiles" PRIMARY KEY ("id")
);

-- 7. Bảng device_groups (9 cột)
CREATE TABLE "device_groups" (
    "id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NULL,
    "icon" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_device_groups" PRIMARY KEY ("id"),
    CONSTRAINT "uq_device_group_house_name" UNIQUE ("house_id", "name")
);

-- 8. Bảng devices (19 cột)
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "device_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "sub_title" VARCHAR(255) NULL,
    "device_type" VARCHAR(30) NOT NULL,
    "location" VARCHAR(255) NULL,
    "is_online" BOOLEAN NOT NULL,
    "status_text" VARCHAR(150) NULL,
    "battery_level" SMALLINT NULL,
    "mac_address" VARCHAR(50) NULL,
    "ip_address" VARCHAR(45) NULL,
    "firmware_version" VARCHAR(50) NULL,
    "last_heartbeat" TIMESTAMPTZ NULL,
    "owner_id" UUID NOT NULL,
    "house_id" UUID NULL,
    "group_id" UUID NULL,
    "elderly_id" UUID NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_devices" PRIMARY KEY ("id")
);

-- 9. Bảng device_configs (21 cột)
CREATE TABLE "device_configs" (
    "device_id" UUID NOT NULL,
    "stream_url" VARCHAR(500) NULL,
    "resolution" VARCHAR(20) NOT NULL,
    "is_sleep" BOOLEAN NOT NULL,
    "is_ai_protect" BOOLEAN NOT NULL,
    "has_two_way_audio" BOOLEAN NOT NULL,
    "hr_threshold_high" INTEGER NOT NULL,
    "hr_threshold_low" INTEGER NOT NULL,
    "spo2_threshold_low" INTEGER NOT NULL,
    "bp_systolic_high" INTEGER NOT NULL,
    "bp_systolic_low" INTEGER NOT NULL,
    "bp_diastolic_high" INTEGER NOT NULL,
    "bp_diastolic_low" INTEGER NOT NULL,
    "fall_impact_threshold" DOUBLE PRECISION NOT NULL,
    "immobility_seconds" INTEGER NOT NULL,
    "mqtt_topic" VARCHAR(150) NULL,
    "is_custom_thresholds" BOOLEAN NOT NULL,
    "configured_by_user_id" UUID NULL,
    "configured_by_role" VARCHAR(20) NULL,
    "extra_settings" JSONB NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_device_configs" PRIMARY KEY ("device_id")
);

-- 10. Bảng vital_signs (12 cột)
CREATE TABLE "vital_signs" (
    "id" UUID NOT NULL,
    "time" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "device_id" UUID NOT NULL,
    "heart_rate" INTEGER NULL,
    "spo2" INTEGER NULL,
    "bp_systolic" INTEGER NULL,
    "bp_diastolic" INTEGER NULL,
    "skin_temp_max" DOUBLE PRECISION NULL,
    "person_count" INTEGER NULL,
    "fall_detected" BOOLEAN NULL,
    "elderly_id" UUID NULL,
    "recorded_at" TIMESTAMPTZ NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pk_vital_signs" PRIMARY KEY ("id", "time")
);

-- 11. Bảng incidents (14 cột)
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "alert_type" VARCHAR(50) NOT NULL,
    "alert_level" VARCHAR(20) NOT NULL,
    "message" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NULL,
    "sources" VARCHAR(255) NULL,
    "video_clip_url" VARCHAR(1000) NULL,
    "thumbnail_url" VARCHAR(1000) NULL,
    "is_acknowledged" BOOLEAN NOT NULL,
    "acknowledged_by" UUID NULL,
    "acknowledged_at" TIMESTAMPTZ NULL,
    "notes" TEXT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_incidents" PRIMARY KEY ("id")
);

-- 12. Bảng camera_recordings (8 cột)
CREATE TABLE "camera_recordings" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "incident_id" UUID NULL,
    CONSTRAINT "pk_camera_recordings" PRIMARY KEY ("id"),
    CONSTRAINT "uq_camera_recordings_object_key" UNIQUE ("object_key")
);

-- 13. Bảng appointments (20 cột)
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NULL,
    "patient_id" UUID NOT NULL,
    "house_id" UUID NULL,
    "created_by" UUID NULL,
    "visit_type" VARCHAR(30) NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "clinical_notes" TEXT NULL,
    "status" VARCHAR(20) NOT NULL,
    "cancellation_reason" TEXT NULL,
    "recurrence_pattern" VARCHAR(20) NOT NULL,
    "recurrence_end_date" TIMESTAMPTZ NULL,
    "parent_recurring_id" UUID NULL,
    "enable_speaker_reminder" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "elderly_id" UUID NULL,
    "recorded_at" TIMESTAMPTZ NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pk_appointments" PRIMARY KEY ("id")
);

-- 14. Bảng appointment_reminders (7 cột)
CREATE TABLE "appointment_reminders" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "reminder_type" VARCHAR(20) NOT NULL,
    "scheduled_time" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "sent_at" TIMESTAMPTZ NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_appointment_reminders" PRIMARY KEY ("id")
);

-- 15. Bảng prescriptions (18 cột)
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NULL,
    "doctor_name" VARCHAR(150) NULL,
    "diagnosis" VARCHAR(255) NOT NULL,
    "general_notes" TEXT NULL,
    "medication_name" VARCHAR(255) NOT NULL,
    "dosage" VARCHAR(100) NOT NULL,
    "quantity" VARCHAR(50) NULL,
    "frequency" VARCHAR(100) NOT NULL,
    "schedule_times_json" TEXT NOT NULL,
    "instructions" TEXT NULL,
    "start_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "end_date" TIMESTAMPTZ NULL,
    "status" VARCHAR(20) NOT NULL,
    "enable_speaker_reminder" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- 16. Bảng chat_sessions (8 cột)
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "house_id" UUID NULL,
    "title" VARCHAR(200) NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_chat_sessions" PRIMARY KEY ("id")
);

-- 17. Bảng chat_messages (6 cột)
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sender" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "is_error" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_chat_messages" PRIMARY KEY ("id")
);

-- 18. Bảng support_tickets (10 cột)
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID NULL,
    "user_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "device_type" VARCHAR(50) NOT NULL,
    "note" TEXT NULL,
    "status" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pk_support_tickets" PRIMARY KEY ("id")
);

-- 19. Bảng system_notifications (16 cột)
CREATE TABLE "system_notifications" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "target_audience" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "scheduled_at" TIMESTAMPTZ NULL,
    "published_at" TIMESTAMPTZ NULL,
    "revoked_at" TIMESTAMPTZ NULL,
    "revoke_reason" TEXT NULL,
    "delivered_count" INTEGER NOT NULL,
    "read_count" INTEGER NOT NULL,
    "created_by" UUID NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "expires_at" TIMESTAMPTZ NULL,
    CONSTRAINT "pk_system_notifications" PRIMARY KEY ("id")
);

-- 20. Bảng security_policies (7 cột)
CREATE TABLE "security_policies" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NULL,
    "category" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "value" VARCHAR(100) NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pk_security_policies" PRIMARY KEY ("id")
);

-- 21. Bảng audit_logs (14 cột)
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" VARCHAR(150) NOT NULL,
    "user_name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'low'::character varying,
    "details" TEXT NOT NULL,
    "admin_id" UUID NULL,
    "action" VARCHAR(100) NULL,
    "target_type" VARCHAR(50) NULL,
    "target_id" VARCHAR(100) NULL,
    "reason" TEXT NULL,
    "old_value" TEXT NULL,
    "new_value" TEXT NULL,
    CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id")
);

-- 22. Bảng system_incidents (7 cột)
CREATE TABLE "system_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "service" VARCHAR(100) NOT NULL,
    "incident_type" VARCHAR(20) NOT NULL DEFAULT 'WARNING'::character varying,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ NULL,
    CONSTRAINT "pk_system_incidents" PRIMARY KEY ("id")
);

-- =================================================================
-- PHẦN 4: RÀNG BUỘC KHÓA NGOẠI (FOREIGN KEYS)
-- =================================================================
ALTER TABLE "user_terminals" ADD CONSTRAINT "user_terminals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_login_histories" ADD CONSTRAINT "user_login_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "houses" ADD CONSTRAINT "houses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "house_members" ADD CONSTRAINT "house_members_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "house_members" ADD CONSTRAINT "house_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "elderly_profiles" ADD CONSTRAINT "elderly_profiles_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "elderly_profiles" ADD CONSTRAINT "elderly_profiles_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "device_groups" ADD CONSTRAINT "device_groups_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "devices" ADD CONSTRAINT "devices_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "devices" ADD CONSTRAINT "devices_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "device_groups"("id") ON DELETE SET NULL;
ALTER TABLE "devices" ADD CONSTRAINT "devices_elderly_id_fkey" FOREIGN KEY ("elderly_id") REFERENCES "elderly_profiles"("id") ON DELETE SET NULL;

ALTER TABLE "device_configs" ADD CONSTRAINT "device_configs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE;
ALTER TABLE "device_configs" ADD CONSTRAINT "device_configs_configured_by_user_id_fkey" FOREIGN KEY ("configured_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE;
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_elderly_id_fkey" FOREIGN KEY ("elderly_id") REFERENCES "elderly_profiles"("id") ON DELETE CASCADE;

ALTER TABLE "incidents" ADD CONSTRAINT "incidents_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE NO ACTION;

ALTER TABLE "camera_recordings" ADD CONSTRAINT "fk_camera_recordings_device_id" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_parent_recurring_id_fkey" FOREIGN KEY ("parent_recurring_id") REFERENCES "appointments"("id") ON DELETE SET NULL;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_elderly_id_fkey" FOREIGN KEY ("elderly_id") REFERENCES "elderly_profiles"("id") ON DELETE CASCADE;
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "elderly_profiles"("id") ON DELETE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE SET NULL;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE;

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;

-- =================================================================
-- PHẦN 5: CHỈ MỤC (INDEXES)
-- =================================================================
CREATE UNIQUE INDEX "ix_users_phone" ON "users" USING btree ("phone");

CREATE INDEX "ix_user_terminals_user_id" ON "user_terminals" USING btree ("user_id");
CREATE INDEX "ix_user_terminals_last_active" ON "user_terminals" USING btree ("last_active_at" DESC);

CREATE INDEX "ix_user_login_histories_user_id" ON "user_login_histories" USING btree ("user_id");
CREATE INDEX "ix_user_login_histories_login_time" ON "user_login_histories" USING btree ("login_time");

CREATE INDEX "ix_house_members_house_id" ON "house_members" USING btree ("house_id");
CREATE INDEX "ix_house_members_user_id" ON "house_members" USING btree ("user_id");

CREATE INDEX "ix_elderly_profiles_house_id" ON "elderly_profiles" USING btree ("house_id");
CREATE INDEX "ix_elderly_profiles_doctor_id" ON "elderly_profiles" USING btree ("doctor_id");

CREATE INDEX "ix_device_groups_house_id" ON "device_groups" USING btree ("house_id");

CREATE UNIQUE INDEX "ix_devices_device_id" ON "devices" USING btree ("device_id");
CREATE INDEX "ix_devices_device_type" ON "devices" USING btree ("device_type");
CREATE INDEX "ix_devices_elderly_id" ON "devices" USING btree ("elderly_id");
CREATE INDEX "ix_devices_group_id" ON "devices" USING btree ("group_id");
CREATE INDEX "ix_devices_house_id" ON "devices" USING btree ("house_id");
CREATE INDEX "ix_devices_last_heartbeat" ON "devices" USING btree ("last_heartbeat");
CREATE INDEX "ix_devices_owner_id" ON "devices" USING btree ("owner_id");

CREATE INDEX "ix_device_configs_configured_by_user_id" ON "device_configs" USING btree ("configured_by_user_id");

CREATE INDEX "ix_vital_signs_device_id" ON "vital_signs" USING btree ("device_id");
CREATE INDEX "ix_vital_signs_elderly_id" ON "vital_signs" USING btree ("elderly_id");
CREATE INDEX "ix_vital_signs_time" ON "vital_signs" USING btree ("time");
CREATE INDEX "ix_vital_signs_time_desc" ON "vital_signs" USING btree ("time" DESC);
CREATE INDEX "ix_vital_signs_device_time_desc" ON "vital_signs" USING btree ("device_id", "time" DESC);
CREATE INDEX "ix_vital_signs_recorded_at_desc" ON "vital_signs" USING btree ("recorded_at" DESC NULLS LAST);

CREATE INDEX "ix_incidents_created_at" ON "incidents" USING btree ("created_at");
CREATE INDEX "ix_incidents_device_id" ON "incidents" USING btree ("device_id");

CREATE INDEX "ix_camera_recordings_incident_id" ON "camera_recordings" USING btree ("incident_id");
CREATE INDEX "ix_camera_recordings_timeline" ON "camera_recordings" USING btree ("device_id", "started_at", "id");

CREATE INDEX "ix_appointments_doctor_id" ON "appointments" USING btree ("doctor_id");
CREATE INDEX "ix_appointments_elderly_id" ON "appointments" USING btree ("elderly_id");
CREATE INDEX "ix_appointments_house_id" ON "appointments" USING btree ("house_id");
CREATE INDEX "ix_appointments_parent_recurring_id" ON "appointments" USING btree ("parent_recurring_id");
CREATE INDEX "ix_appointments_patient_id" ON "appointments" USING btree ("patient_id");
CREATE INDEX "ix_appointments_doctor_time" ON "appointments" USING btree ("doctor_id", "scheduled_at");
CREATE INDEX "ix_appointments_patient_time" ON "appointments" USING btree ("patient_id", "scheduled_at");
CREATE INDEX "ix_appointments_scheduled_at" ON "appointments" USING btree ("scheduled_at");
CREATE INDEX "ix_appointments_scheduled_at_desc" ON "appointments" USING btree ("scheduled_at" DESC);
CREATE INDEX "ix_appointments_recorded_at_desc" ON "appointments" USING btree ("recorded_at" DESC NULLS LAST);
CREATE INDEX "ix_appointments_doctor_recorded" ON "appointments" USING btree ("doctor_id", "recorded_at" DESC NULLS LAST);
CREATE INDEX "ix_appointments_status" ON "appointments" USING btree ("status");

CREATE INDEX "ix_appointment_reminders_appointment_id" ON "appointment_reminders" USING btree ("appointment_id");
CREATE INDEX "ix_appointment_reminders_scheduled_time" ON "appointment_reminders" USING btree ("scheduled_time");
CREATE INDEX "ix_appointment_reminders_status" ON "appointment_reminders" USING btree ("status");
CREATE INDEX "ix_reminders_appointment_id" ON "appointment_reminders" USING btree ("appointment_id");
CREATE INDEX "ix_reminders_status_time" ON "appointment_reminders" USING btree ("status", "scheduled_time");

CREATE INDEX "ix_prescriptions_dates" ON "prescriptions" USING btree ("start_date", "end_date");
CREATE INDEX "ix_prescriptions_doctor_id" ON "prescriptions" USING btree ("doctor_id");
CREATE INDEX "ix_prescriptions_patient_id" ON "prescriptions" USING btree ("patient_id");
CREATE INDEX "ix_prescriptions_status" ON "prescriptions" USING btree ("status");

CREATE INDEX "ix_chat_sessions_created_at" ON "chat_sessions" USING btree ("created_at");
CREATE INDEX "ix_chat_sessions_user_id" ON "chat_sessions" USING btree ("user_id");
CREATE INDEX "ix_chat_messages_created_at" ON "chat_messages" USING btree ("created_at");
CREATE INDEX "ix_chat_messages_session_id" ON "chat_messages" USING btree ("session_id");

CREATE INDEX "ix_system_notifications_created_at" ON "system_notifications" USING btree ("created_at");
CREATE INDEX "ix_system_notifications_status" ON "system_notifications" USING btree ("status");

CREATE INDEX "ix_audit_logs_event" ON "audit_logs" USING btree ("event");
CREATE INDEX "ix_audit_logs_ip" ON "audit_logs" USING btree ("ip_address");
CREATE INDEX "ix_audit_logs_severity" ON "audit_logs" USING btree ("severity");
CREATE INDEX "ix_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp" DESC);

CREATE INDEX "ix_system_incidents_timestamp" ON "system_incidents" USING btree ("timestamp" DESC);

-- =================================================================
-- PHẦN 6: TIMESCALEDB HYPERTABLE (TÙY CHỌN NẾU POSTGRES CÓ EXTENSION)
-- =================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('vital_signs', 'time', if_not_exists => TRUE);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Bỏ qua create_hypertable vì TimescaleDB chưa sẵn sàng.';
END $$;
