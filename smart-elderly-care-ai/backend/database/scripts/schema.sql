-- =================================================================
-- SMART ELDERLY CARE AI (SECA) - DATABASE SCHEMA & FULL SEED DATA
-- PostgreSQL 16 + TimescaleDB (Docker Local) & Supabase Cloud PG17
-- Đồng bộ tự động từ Supabase lúc: 2026-10-23 16:33:37
-- =================================================================

-- PHẦN 1: KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB khong co san, he thong se dung bang chuan PostgreSQL.';
END $$;

-- PHẦN 2: XÓA CÁC BẢNG CŨ THEO THỨ TỰ RÀNG BUỘC (CASCADE)
DROP TABLE IF EXISTS "user_login_histories" CASCADE;
DROP TABLE IF EXISTS "user_terminals" CASCADE;
DROP TABLE IF EXISTS "system_notifications" CASCADE;
DROP TABLE IF EXISTS "system_incidents" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "support_tickets" CASCADE;
DROP TABLE IF EXISTS "security_policies" CASCADE;
DROP TABLE IF EXISTS "appointment_reminders" CASCADE;
DROP TABLE IF EXISTS "appointments" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "chat_sessions" CASCADE;
DROP TABLE IF EXISTS "incidents" CASCADE;
DROP TABLE IF EXISTS "vital_signs" CASCADE;
DROP TABLE IF EXISTS "device_configs" CASCADE;
DROP TABLE IF EXISTS "devices" CASCADE;
DROP TABLE IF EXISTS "device_groups" CASCADE;
DROP TABLE IF EXISTS "elderly_profiles" CASCADE;
DROP TABLE IF EXISTS "house_members" CASCADE;
DROP TABLE IF EXISTS "houses" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- PHẦN 3: TẠO CÁC BẢNG (DDL)

-- Bảng users
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
    CONSTRAINT pk_users PRIMARY KEY (id)
);

-- Bảng houses
CREATE TABLE "houses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(300) NULL,
    "current_mode" VARCHAR(20) NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_houses PRIMARY KEY (id)
);

-- Bảng house_members
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
    CONSTRAINT pk_house_members PRIMARY KEY (id),
    CONSTRAINT uq_house_member UNIQUE (house_id, user_id)
);

-- Bảng elderly_profiles
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
    CONSTRAINT pk_elderly_profiles PRIMARY KEY (id)
);

-- Bảng device_groups
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
    CONSTRAINT pk_device_groups PRIMARY KEY (id),
    CONSTRAINT uq_device_group_house_name UNIQUE (house_id, name)
);

-- Bảng devices
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
    CONSTRAINT pk_devices PRIMARY KEY (id)
);

-- Bảng device_configs
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
    CONSTRAINT pk_device_configs PRIMARY KEY (device_id)
);

-- Bảng vital_signs
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
    CONSTRAINT pk_vital_signs PRIMARY KEY (id, "time")
);

-- Bảng incidents
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
    CONSTRAINT pk_incidents PRIMARY KEY (id)
);

-- Bảng chat_sessions
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "house_id" UUID NULL,
    "title" VARCHAR(200) NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_chat_sessions PRIMARY KEY (id)
);

-- Bảng chat_messages
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sender" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "is_error" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_chat_messages PRIMARY KEY (id)
);

-- Bảng appointments
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
    CONSTRAINT pk_appointments PRIMARY KEY (id)
);

-- Bảng appointment_reminders
CREATE TABLE "appointment_reminders" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "reminder_type" VARCHAR(20) NOT NULL,
    "scheduled_time" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "sent_at" TIMESTAMPTZ NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_appointment_reminders PRIMARY KEY (id)
);

-- Bảng security_policies
CREATE TABLE "security_policies" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NULL,
    "category" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "value" VARCHAR(100) NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_security_policies PRIMARY KEY (id)
);

-- Bảng support_tickets
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
    CONSTRAINT pk_support_tickets PRIMARY KEY (id)
);

-- Bảng audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" VARCHAR(150) NOT NULL,
    "user_name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'low'::character varying,
    "details" TEXT NOT NULL,
    CONSTRAINT pk_audit_logs PRIMARY KEY (id)
);

-- Bảng system_incidents
CREATE TABLE "system_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "service" VARCHAR(100) NOT NULL,
    "incident_type" VARCHAR(20) NOT NULL DEFAULT 'WARNING'::character varying,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ NULL,
    CONSTRAINT pk_system_incidents PRIMARY KEY (id)
);

-- Bảng system_notifications
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
    CONSTRAINT pk_system_notifications PRIMARY KEY (id)
);

-- Bảng user_terminals
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
    CONSTRAINT pk_user_terminals PRIMARY KEY (id)
);

-- Bảng user_login_histories
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
    CONSTRAINT pk_user_login_histories PRIMARY KEY (id)
);

-- =================================================================
-- PHẦN 4: RÀNG BUỘC KHÓA NGOẠI (FOREIGN KEYS)
-- =================================================================
ALTER TABLE "houses" ADD CONSTRAINT "houses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "house_members" ADD CONSTRAINT "house_members_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "house_members" ADD CONSTRAINT "house_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "elderly_profiles" ADD CONSTRAINT "elderly_profiles_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "device_groups" ADD CONSTRAINT "device_groups_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "devices" ADD CONSTRAINT "devices_elderly_id_fkey" FOREIGN KEY ("elderly_id") REFERENCES "elderly_profiles"("id") ON DELETE SET NULL;
ALTER TABLE "devices" ADD CONSTRAINT "devices_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "device_groups"("id") ON DELETE SET NULL;
ALTER TABLE "devices" ADD CONSTRAINT "devices_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "device_configs" ADD CONSTRAINT "device_configs_configured_by_user_id_fkey" FOREIGN KEY ("configured_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "device_configs" ADD CONSTRAINT "device_configs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE;
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE NO ACTION;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE NO ACTION;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE NO ACTION;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE SET NULL;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_parent_recurring_id_fkey" FOREIGN KEY ("parent_recurring_id") REFERENCES "appointments"("id") ON DELETE SET NULL;
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "user_terminals" ADD CONSTRAINT "user_terminals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_login_histories" ADD CONSTRAINT "user_login_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- =================================================================
-- PHẦN 5: CHỈ MỤC (INDEXES)
-- =================================================================
CREATE UNIQUE INDEX ix_users_phone ON public.users USING btree (phone);
CREATE INDEX ix_house_members_house_id ON public.house_members USING btree (house_id);
CREATE INDEX ix_house_members_user_id ON public.house_members USING btree (user_id);
CREATE INDEX ix_elderly_profiles_house_id ON public.elderly_profiles USING btree (house_id);
CREATE INDEX ix_device_groups_house_id ON public.device_groups USING btree (house_id);
CREATE UNIQUE INDEX ix_devices_device_id ON public.devices USING btree (device_id);
CREATE INDEX ix_devices_device_type ON public.devices USING btree (device_type);
CREATE INDEX ix_devices_elderly_id ON public.devices USING btree (elderly_id);
CREATE INDEX ix_devices_group_id ON public.devices USING btree (group_id);
CREATE INDEX ix_devices_house_id ON public.devices USING btree (house_id);
CREATE INDEX ix_devices_last_heartbeat ON public.devices USING btree (last_heartbeat);
CREATE INDEX ix_devices_owner_id ON public.devices USING btree (owner_id);
CREATE INDEX ix_device_configs_configured_by_user_id ON public.device_configs USING btree (configured_by_user_id);
CREATE INDEX ix_vital_signs_device_id ON public.vital_signs USING btree (device_id);
CREATE INDEX ix_vital_signs_time ON public.vital_signs USING btree ("time");
CREATE INDEX ix_incidents_created_at ON public.incidents USING btree (created_at);
CREATE INDEX ix_incidents_device_id ON public.incidents USING btree (device_id);
CREATE INDEX ix_chat_sessions_created_at ON public.chat_sessions USING btree (created_at);
CREATE INDEX ix_chat_sessions_user_id ON public.chat_sessions USING btree (user_id);
CREATE INDEX ix_chat_messages_created_at ON public.chat_messages USING btree (created_at);
CREATE INDEX ix_chat_messages_session_id ON public.chat_messages USING btree (session_id);
CREATE INDEX ix_appointments_doctor_id ON public.appointments USING btree (doctor_id);
CREATE INDEX ix_appointments_doctor_time ON public.appointments USING btree (doctor_id, scheduled_at);
CREATE INDEX ix_appointments_house_id ON public.appointments USING btree (house_id);
CREATE INDEX ix_appointments_parent_recurring_id ON public.appointments USING btree (parent_recurring_id);
CREATE INDEX ix_appointments_patient_id ON public.appointments USING btree (patient_id);
CREATE INDEX ix_appointments_patient_time ON public.appointments USING btree (patient_id, scheduled_at);
CREATE INDEX ix_appointments_scheduled_at ON public.appointments USING btree (scheduled_at);
CREATE INDEX ix_appointments_status ON public.appointments USING btree (status);
CREATE INDEX ix_appointment_reminders_appointment_id ON public.appointment_reminders USING btree (appointment_id);
CREATE INDEX ix_appointment_reminders_scheduled_time ON public.appointment_reminders USING btree (scheduled_time);
CREATE INDEX ix_appointment_reminders_status ON public.appointment_reminders USING btree (status);
CREATE INDEX ix_reminders_appointment_id ON public.appointment_reminders USING btree (appointment_id);
CREATE INDEX ix_reminders_status_time ON public.appointment_reminders USING btree (status, scheduled_time);
CREATE INDEX ix_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp" DESC);
CREATE INDEX ix_system_incidents_timestamp ON public.system_incidents USING btree ("timestamp" DESC);
CREATE INDEX ix_system_notifications_created_at ON public.system_notifications USING btree (created_at);
CREATE INDEX ix_system_notifications_status ON public.system_notifications USING btree (status);
CREATE INDEX ix_user_terminals_last_active ON public.user_terminals USING btree (last_active_at DESC);
CREATE INDEX ix_user_terminals_user_id ON public.user_terminals USING btree (user_id);
CREATE INDEX ix_user_login_histories_login_time ON public.user_login_histories USING btree (login_time);
CREATE INDEX ix_user_login_histories_user_id ON public.user_login_histories USING btree (user_id);

-- =================================================================
-- PHẦN 6: TIMESCALEDB HYPERTABLE CHO VITAL_SIGNS
-- =================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('vital_signs', 'time', if_not_exists => TRUE);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Bo qua tao hypertable vi TimescaleDB chua san sang.';
END $$;

-- =================================================================
-- PHẦN 7: DỮ LIỆU ĐỒNG BỘ TỪ SUPABASE (SEED DATA TỪ A ĐẾN Z)
-- =================================================================

-- Dữ liệu bảng users (3 rows)
INSERT INTO "users" ("id", "full_name", "hashed_password", "phone", "avatar_url", "role", "preferred_language", "font_size_mode", "custom_font_scale", "vibration_enabled", "notifications_enabled", "alert_sound_enabled", "critical_alert_enabled", "cchn_number", "specialty", "workplace", "is_active", "fcm_token", "created_at", "updated_at", "last_login_at") VALUES ('677b6120-442c-4e71-b91c-9c12174dedd5', 'System Admin', '$2b$12$c/67QKtag.5RPjrKqLrIw.zYENE/bQSwzl55b4evN3X4AovZgJO/S', '+84900000000', NULL, 'admin', 'vi', 'system', 2, TRUE, TRUE, TRUE, TRUE, NULL, NULL, NULL, TRUE, NULL, '2026-10-23T03:55:02.980091+00:00', '2026-10-23T03:55:02.980091+00:00', '2026-10-23T04:11:51.730636+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "users" ("id", "full_name", "hashed_password", "phone", "avatar_url", "role", "preferred_language", "font_size_mode", "custom_font_scale", "vibration_enabled", "notifications_enabled", "alert_sound_enabled", "critical_alert_enabled", "cchn_number", "specialty", "workplace", "is_active", "fcm_token", "created_at", "updated_at", "last_login_at") VALUES ('b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'BS. Trần Văn Minh', '$2b$12$gocoFFULa6fGZBZtoim6PeM40ovLZqi0fO04/V.Am2/DGg9OkX2NW', '+84905111222', NULL, 'doctor', 'vi', 'system', 2, TRUE, TRUE, TRUE, TRUE, NULL, NULL, NULL, TRUE, NULL, '2026-10-23T03:15:17.771792+00:00', '2026-10-23T03:15:17.771792+00:00', '2026-10-23T06:04:42.473815+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "users" ("id", "full_name", "hashed_password", "phone", "avatar_url", "role", "preferred_language", "font_size_mode", "custom_font_scale", "vibration_enabled", "notifications_enabled", "alert_sound_enabled", "critical_alert_enabled", "cchn_number", "specialty", "workplace", "is_active", "fcm_token", "created_at", "updated_at", "last_login_at") VALUES ('25e71534-db36-410f-bfb8-cbc9295f82be', 'Nguyễn Hữu Nghĩa', '$2b$12$SknoBhCfg4K0O6yR5iJj7Ow1zG1wwB7oC8uO9u5MQNgI/lJdhB.Nm', '+84905123456', NULL, 'user', 'vi', 'system', 2, TRUE, TRUE, TRUE, TRUE, NULL, NULL, NULL, TRUE, NULL, '2026-10-23T03:55:02.980091+00:00', '2026-10-23T03:55:02.980091+00:00', '2026-10-23T06:05:56.302608+00:00') ON CONFLICT DO NOTHING;

-- Dữ liệu bảng houses (8 rows)
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('2239ddcc-5473-46d0-9bf0-084c211d9160', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', '2026-10-23T04:10:07.520546+00:00', '2026-10-23T04:10:07.520546+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('e7953cde-8292-44e2-a753-7c3fa17a87a7', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', '2026-10-23T04:10:07.530028+00:00', '2026-10-23T04:10:07.530028+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('2a2cd98b-6656-4e1f-a89a-bfd044687629', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', '2026-10-23T04:10:07.756746+00:00', '2026-10-23T04:10:07.756746+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('a2f4d940-0a33-42b1-a47c-a3e9f317f5fd', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', '2026-10-23T04:10:07.800097+00:00', '2026-10-23T04:10:07.800097+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('a424398f-369d-469b-8c75-c57be679732a', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', '25e71534-db36-410f-bfb8-cbc9295f82be', '2026-10-23T04:10:43.896084+00:00', '2026-10-23T04:10:43.896084+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('2562e0d0-2962-438c-bbcd-93ce971bd41a', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', '25e71534-db36-410f-bfb8-cbc9295f82be', '2026-10-23T04:10:43.917114+00:00', '2026-10-23T04:10:43.917114+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('e5a36553-8451-45cc-a0ed-eac8429fbcac', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', '25e71534-db36-410f-bfb8-cbc9295f82be', '2026-10-23T04:10:43.898521+00:00', '2026-10-23T04:10:43.898521+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "houses" ("id", "name", "address", "current_mode", "owner_id", "created_at", "updated_at") VALUES ('dcac5012-ce8b-45c0-9ab6-50a65b9a7c68', 'Nhà của tôi', '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng', 'HOME', '25e71534-db36-410f-bfb8-cbc9295f82be', '2026-10-23T04:10:44.343840+00:00', '2026-10-23T04:10:44.343840+00:00') ON CONFLICT DO NOTHING;

-- Dữ liệu bảng house_members (8 rows)
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('c4644f79-32ec-4f1b-ba17-8ffc3181b61e', '2239ddcc-5473-46d0-9bf0-084c211d9160', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:07.520546+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('36e0a8db-e0e0-4ec2-bb98-a0be26d9fdee', 'e7953cde-8292-44e2-a753-7c3fa17a87a7', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:07.530028+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('be47cc75-0b04-41fc-b548-decaa6269426', '2a2cd98b-6656-4e1f-a89a-bfd044687629', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:07.756746+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('c3387b87-918b-474a-8495-0ac6d6f37f1d', 'a2f4d940-0a33-42b1-a47c-a3e9f317f5fd', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:07.800097+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('d8071a48-03a1-4c90-aa3f-9224156e2307', 'a424398f-369d-469b-8c75-c57be679732a', '25e71534-db36-410f-bfb8-cbc9295f82be', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:43.896084+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('037a4581-7eec-4cb3-8cad-95627884c1dc', '2562e0d0-2962-438c-bbcd-93ce971bd41a', '25e71534-db36-410f-bfb8-cbc9295f82be', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:43.917114+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('493436be-30c8-4934-91d5-8d71c467ad45', 'dcac5012-ce8b-45c0-9ab6-50a65b9a7c68', '25e71534-db36-410f-bfb8-cbc9295f82be', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:44.343840+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "house_members" ("id", "house_id", "user_id", "role_in_house", "permissions", "can_view_health", "can_view_camera", "can_handle_emergency", "can_manage_devices", "can_manage_records", "joined_at") VALUES ('f2752ef2-9949-4d3d-9402-a794590bb60f', 'e5a36553-8451-45cc-a0ed-eac8429fbcac', '25e71534-db36-410f-bfb8-cbc9295f82be', 'OWNER', 'ADMIN', TRUE, TRUE, TRUE, TRUE, TRUE, '2026-10-23T04:10:43.898521+00:00') ON CONFLICT DO NOTHING;

-- Dữ liệu bảng elderly_profiles (1 rows)
INSERT INTO "elderly_profiles" ("id", "house_id", "full_name", "birth_year", "gender", "medical_history", "conditions_json", "blood_type", "height_cm", "weight_kg", "drug_allergies", "food_allergies", "dietary_notes", "emergency_contact_phone", "avatar_url", "face_embedding", "created_at", "updated_at") VALUES ('c6738848-6303-44db-8e0c-ad214c815c81', 'a424398f-369d-469b-8c75-c57be679732a', '', NULL, NULL, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', NULL, NULL, '2026-10-23T04:15:49.595421+00:00', '2026-10-23T04:15:49.595421+00:00') ON CONFLICT DO NOTHING;

-- Dữ liệu bảng audit_logs (6 rows)
INSERT INTO "audit_logs" ("id", "timestamp", "event", "user_name", "ip_address", "severity", "details") VALUES ('a226b250-cc70-4fd5-93a9-2e8e1641b00c', '2026-10-23T04:10:06.747540+00:00', 'ĐĂNG NHẬP THÀNH CÔNG', 'BS. Trần Văn Minh (doctor)', '127.0.0.1', 'low', 'Đăng nhập thành công qua Mozilla/5.0 (Windows NT 10.0; Win64; x64.') ON CONFLICT DO NOTHING;
INSERT INTO "audit_logs" ("id", "timestamp", "event", "user_name", "ip_address", "severity", "details") VALUES ('5b85c280-9a29-48eb-b312-e7e12c7d4a8b', '2026-10-23T04:10:43.095567+00:00', 'ĐĂNG NHẬP THÀNH CÔNG', 'Nguyễn Hữu Nghĩa (user)', '127.0.0.1', 'low', 'Đăng nhập thành công qua Mozilla/5.0 (Windows NT 10.0; Win64; x64.') ON CONFLICT DO NOTHING;
INSERT INTO "audit_logs" ("id", "timestamp", "event", "user_name", "ip_address", "severity", "details") VALUES ('4fb8a002-b49c-49f0-a85c-70d91bb44b44', '2026-10-23T04:11:53.472864+00:00', 'ĐĂNG NHẬP THÀNH CÔNG', 'System Admin (admin)', '127.0.0.1', 'low', 'Đăng nhập thành công qua Mozilla/5.0 (Windows NT 10.0; Win64; x64.') ON CONFLICT DO NOTHING;
INSERT INTO "audit_logs" ("id", "timestamp", "event", "user_name", "ip_address", "severity", "details") VALUES ('927a46e8-9463-44d8-84d6-142d07a448df', '2026-10-23T06:04:44.619777+00:00', 'ĐĂNG NHẬP THÀNH CÔNG', 'BS. Trần Văn Minh (doctor)', '127.0.0.1', 'low', 'Đăng nhập thành công qua Mozilla/5.0 (Windows NT 10.0; Win64; x64.') ON CONFLICT DO NOTHING;
INSERT INTO "audit_logs" ("id", "timestamp", "event", "user_name", "ip_address", "severity", "details") VALUES ('bc8681a3-272b-40a1-9ee6-4c320e869829', '2026-10-23T06:05:58.455320+00:00', 'ĐĂNG NHẬP THÀNH CÔNG', 'Nguyễn Hữu Nghĩa (user)', '127.0.0.1', 'low', 'Đăng nhập thành công qua Mozilla/5.0 (Windows NT 10.0; Win64; x64.') ON CONFLICT DO NOTHING;
INSERT INTO "audit_logs" ("id", "timestamp", "event", "user_name", "ip_address", "severity", "details") VALUES ('4029a076-cdcf-4697-a6f4-aa77ba82ea58', '2026-10-23T06:52:31.815841+00:00', 'TẠO THÔNG BÁO HỆ THỐNG', '+84900000000', '127.0.0.1', 'medium', 'Tạo thông báo ''Bảo trì '' trạng thái [published] cho nhóm [all].') ON CONFLICT DO NOTHING;

-- Dữ liệu bảng system_notifications (1 rows)
INSERT INTO "system_notifications" ("id", "title", "body", "type", "target_audience", "status", "scheduled_at", "published_at", "revoked_at", "revoke_reason", "delivered_count", "read_count", "created_by", "created_at", "updated_at", "expires_at") VALUES ('a794a1a7-f820-49d6-827d-0ef7baefe999', 'Bảo trì ', 'Hệ thống sẽ bảo trì sau 30 phút nữa. Vui lòng truy cập sau khi cập nhập.', 'system_maintenance', 'all', 'published', NULL, '2026-10-23T06:52:30.919489+00:00', NULL, NULL, 3, 0, '677b6120-442c-4e71-b91c-9c12174dedd5', '2026-10-23T06:52:31.815841+00:00', '2026-10-23T06:52:31.815841+00:00', NULL) ON CONFLICT DO NOTHING;

-- Dữ liệu bảng user_terminals (3 rows)
INSERT INTO "user_terminals" ("id", "user_id", "device_name", "device_type", "os", "browser", "ip_address", "location", "last_active_at", "is_active", "created_at") VALUES ('0e6fc54c-99f7-41ff-9748-42c8ad9550f8', '677b6120-442c-4e71-b91c-9c12174dedd5', 'Microsoft Edge (Windows 11)', 'desktop', 'Windows 11', 'Microsoft Edge', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T04:11:51.341741+00:00', TRUE, '2026-10-23T04:11:51.346321+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "user_terminals" ("id", "user_id", "device_name", "device_type", "os", "browser", "ip_address", "location", "last_active_at", "is_active", "created_at") VALUES ('91bea68b-50c9-4070-9fe5-35acab7104a0', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Microsoft Edge (Windows 11)', 'desktop', 'Windows 11', 'Microsoft Edge', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T06:04:41.914380+00:00', TRUE, '2026-10-23T04:10:04.207045+00:00') ON CONFLICT DO NOTHING;
INSERT INTO "user_terminals" ("id", "user_id", "device_name", "device_type", "os", "browser", "ip_address", "location", "last_active_at", "is_active", "created_at") VALUES ('005ab5ef-0422-4b16-9b90-a12349865cfc', '25e71534-db36-410f-bfb8-cbc9295f82be', 'Microsoft Edge (Windows 11)', 'desktop', 'Windows 11', 'Microsoft Edge', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T06:05:55.689214+00:00', TRUE, '2026-10-23T04:10:41.020367+00:00') ON CONFLICT DO NOTHING;

-- Dữ liệu bảng user_login_histories (5 rows)
INSERT INTO "user_login_histories" ("id", "user_id", "device_name", "ip_address", "location", "login_time", "login_method", "status", "user_agent") VALUES ('faab0904-17c6-47b2-a604-a6affd23c257', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Microsoft Edge (Windows 11)', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T04:10:03.935118+00:00', 'Mật khẩu', 'success', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0') ON CONFLICT DO NOTHING;
INSERT INTO "user_login_histories" ("id", "user_id", "device_name", "ip_address", "location", "login_time", "login_method", "status", "user_agent") VALUES ('23e19ae4-8af6-4282-9428-4359f56dc435', '25e71534-db36-410f-bfb8-cbc9295f82be', 'Microsoft Edge (Windows 11)', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T04:10:40.846213+00:00', 'Mật khẩu', 'success', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0') ON CONFLICT DO NOTHING;
INSERT INTO "user_login_histories" ("id", "user_id", "device_name", "ip_address", "location", "login_time", "login_method", "status", "user_agent") VALUES ('2d714e32-f739-4e50-a62f-2eaa94643aff', '677b6120-442c-4e71-b91c-9c12174dedd5', 'Microsoft Edge (Windows 11)', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T04:11:51.184593+00:00', 'Mật khẩu', 'success', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0') ON CONFLICT DO NOTHING;
INSERT INTO "user_login_histories" ("id", "user_id", "device_name", "ip_address", "location", "login_time", "login_method", "status", "user_agent") VALUES ('4b29b0fa-1884-4b4a-b2b4-e14fa36cb8ac', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Microsoft Edge (Windows 11)', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T06:04:41.614719+00:00', 'Mật khẩu', 'success', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0') ON CONFLICT DO NOTHING;
INSERT INTO "user_login_histories" ("id", "user_id", "device_name", "ip_address", "location", "login_time", "login_method", "status", "user_agent") VALUES ('2a8a4d19-e9b4-47c1-8ebb-213e0c307e27', '25e71534-db36-410f-bfb8-cbc9295f82be', 'Microsoft Edge (Windows 11)', '127.0.0.1', 'Đà Nẵng, Việt Nam (Mạng cục bộ)', '2026-10-23T06:05:55.278932+00:00', 'Mật khẩu', 'success', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0') ON CONFLICT DO NOTHING;