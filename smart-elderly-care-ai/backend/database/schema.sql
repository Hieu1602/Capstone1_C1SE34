-- =================================================================
-- SMART ELDERLY CARE AI - COMPLETE DATABASE SCRIPT
-- PostgreSQL 16 + TimescaleDB (Docker)
-- Group: C1SE.34
-- =================================================================

-- PHẦN 1: XÓA BẢNG CŨ (ĐỂ TRÁNH XUNG ĐỘT)
DROP TABLE IF EXISTS EmergencyContacts CASCADE;
DROP TABLE IF EXISTS VoiceReminders CASCADE;
DROP TABLE IF EXISTS IncidentMedia CASCADE;
DROP TABLE IF EXISTS Incidents CASCADE;
DROP TABLE IF EXISTS VitalsData CASCADE;
DROP TABLE IF EXISTS DeviceSettings CASCADE;
DROP TABLE IF EXISTS CaregiverElderly CASCADE;
DROP TABLE IF EXISTS ElderlyProfiles CASCADE;
DROP TABLE IF EXISTS Users CASCADE;

-- PHẦN 2: KÍCH HOẠT TIMESCALEDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- PHẦN 3: TẠO CÁC BẢNG

-- Table 1: Users (Người dùng hệ thống: Người chăm sóc, Bác sĩ, Quản trị viên)
CREATE TABLE Users (
    UserID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    Email VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    FullName VARCHAR(100) NOT NULL,
    Phone VARCHAR(20) NOT NULL,
    Role VARCHAR(20) NOT NULL CHECK (Role IN ('Caregiver', 'Doctor', 'Admin')),
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_role ON Users(Role);

-- Table 2: ElderlyProfiles (Hồ sơ người cao tuổi cần giám sát)
CREATE TABLE ElderlyProfiles (
    ElderlyID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    DateOfBirth DATE,
    Gender VARCHAR(10) CHECK (Gender IN ('Male', 'Female', 'Other')),
    ResidentialAddress TEXT NOT NULL,
    HubDeviceID VARCHAR(50) NOT NULL UNIQUE,
    MedicalNotes TEXT,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: CaregiverElderly (Bảng liên kết Nhiều-Nhiều giữa Người chăm sóc và Người cao tuổi)
CREATE TABLE CaregiverElderly (
    MappingID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
    ElderlyID INT NOT NULL REFERENCES ElderlyProfiles(ElderlyID) ON DELETE CASCADE,
    Relationship VARCHAR(50) NOT NULL,
    IsPrimaryContact BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_caregiver_elderly_user ON CaregiverElderly(UserID);
CREATE INDEX idx_caregiver_elderly_elderly ON CaregiverElderly(ElderlyID);

-- Table 4: DeviceSettings (Cấu hình ngưỡng cảnh báo y tế riêng cho từng người)
CREATE TABLE DeviceSettings (
    SettingID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ElderlyID INT NOT NULL UNIQUE REFERENCES ElderlyProfiles(ElderlyID) ON DELETE CASCADE,
    HeartRateMin SMALLINT,
    HeartRateMax SMALLINT,
    SpO2Min DECIMAL(4,1),
    TempMax DECIMAL(4,1),
    ImmobilityThresholdSec INT,
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: VitalsData (Dữ liệu sinh hiệu dạng chuỗi thời gian - TIMESCALEDB HYPERTABLE)
CREATE TABLE VitalsData (
    RecordedAt TIMESTAMPTZ NOT NULL,
    ElderlyID INT NOT NULL REFERENCES ElderlyProfiles(ElderlyID) ON DELETE CASCADE,
    HeartRate SMALLINT,
    SpO2 DECIMAL(4,1) CHECK (SpO2 >= 0 AND SpO2 <= 100),
    BodyTemperature DECIMAL(4,1),
    IsWearingBand BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (RecordedAt, ElderlyID)
);

-- Chuyển thành Hypertable (phân vùng theo ngày)
SELECT create_hypertable('VitalsData', 'recordedat', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX idx_vitals_elderly_time ON VitalsData(ElderlyID, recordedat DESC);

-- Table 6: Incidents (Nhật ký sự cố & cảnh báo: Té ngã, Bất động, Sốt cao, Khó thở, SOS)
CREATE TABLE Incidents (
    IncidentID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ElderlyID INT NOT NULL REFERENCES ElderlyProfiles(ElderlyID) ON DELETE CASCADE,
    IncidentType VARCHAR(30) NOT NULL CHECK (IncidentType IN ('Fall', 'Immobility', 'HighFever', 'RespiratoryDistress', 'SOS')),
    SeverityLevel VARCHAR(20) NOT NULL CHECK (SeverityLevel IN ('RedAlert', 'YellowWarning')),
    IncidentTime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    SensorFusionDetails JSONB,
    IsSOSDialed BOOLEAN NOT NULL DEFAULT FALSE,
    Status VARCHAR(20) NOT NULL DEFAULT 'Triggered' CHECK (Status IN ('Triggered', 'Acknowledged', 'Resolved', 'FalseAlarm'))
);
CREATE INDEX idx_incidents_elderly ON Incidents(ElderlyID);
CREATE INDEX idx_incidents_time ON Incidents(IncidentTime);
CREATE INDEX idx_incidents_severity ON Incidents(SeverityLevel);

-- Table 7: IncidentMedia (Hình ảnh và video 5s ghi nhận thời điểm sự cố)
CREATE TABLE IncidentMedia (
    MediaID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    IncidentID INT NOT NULL REFERENCES Incidents(IncidentID) ON DELETE CASCADE,
    MediaType VARCHAR(20) NOT NULL CHECK (MediaType IN ('VideoClip5s', 'SnapshotImage')),
    MediaURL VARCHAR(500) NOT NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_incident_media_incident ON IncidentMedia(IncidentID);

-- Table 8: VoiceReminders (Lịch sử nhắc nhở giọng nói tự động từ Edge Hub)
CREATE TABLE VoiceReminders (
    ReminderID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ElderlyID INT NOT NULL REFERENCES ElderlyProfiles(ElderlyID) ON DELETE CASCADE,
    ReminderTime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    TriggerReason VARCHAR(100) NOT NULL,
    WasAcknowledged BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_voice_reminders_elderly ON VoiceReminders(ElderlyID);
CREATE INDEX idx_voice_reminders_time ON VoiceReminders(ReminderTime);

-- Table 9: EmergencyContacts (Danh bạ người liên hệ khẩn cấp khi có RedAlert)
CREATE TABLE EmergencyContacts (
    ContactID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ElderlyID INT NOT NULL REFERENCES ElderlyProfiles(ElderlyID) ON DELETE CASCADE,
    ContactName VARCHAR(100) NOT NULL,
    PhoneNumber VARCHAR(20) NOT NULL,
    PriorityOrder INT NOT NULL DEFAULT 1
);
CREATE INDEX idx_emergency_contacts_elderly ON EmergencyContacts(ElderlyID);
