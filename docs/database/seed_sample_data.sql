-- =================================================================
-- SMART ELDERLY CARE AI - SEED DATA FOR TESTING
-- Group: C1SE.34
-- =================================================================

-- 1. Insert Users mẫu
INSERT INTO Users (Email, PasswordHash, FullName, Phone, Role)
VALUES 
('admin@elderlycare.ai', '$2b$12$e80yq9gC8t0qf.q2r...dummyhash', 'Nguyễn Quản Trị', '0901234567', 'Admin'),
('caregiver1@gmail.com', '$2b$12$e80yq9gC8t0qf.q2r...dummyhash', 'Trần Thị Chăm Sóc', '0912345678', 'Caregiver'),
('dr.nam@hospital.vn', '$2b$12$e80yq9gC8t0qf.q2r...dummyhash', 'BS. Lê Văn Nam', '0923456789', 'Doctor');

-- 2. Insert Hồ sơ người cao tuổi mẫu
INSERT INTO ElderlyProfiles (FullName, DateOfBirth, Gender, ResidentialAddress, HubDeviceID, MedicalNotes)
VALUES 
('Cụ Nguyễn Văn An', '1945-05-12', 'Male', '123 Nguyễn Văn Linh, Q. Hải Châu, Đà Nẵng', 'HUB-OPI5-001', 'Tiền sử tăng huyết áp, rối loạn tiền đình, đi lại chậm.'),
('Cụ Lê Thị Bình', '1950-10-20', 'Female', '456 Lê Duẩn, Q. Thanh Khê, Đà Nẵng', 'HUB-OPI5-002', 'Bệnh tim mạch nhẹ, hay quên uống thuốc.');

-- 3. Phân quyền Người chăm sóc theo dõi Người cao tuổi
INSERT INTO CaregiverElderly (UserID, ElderlyID, Relationship, IsPrimaryContact)
VALUES 
(2, 1, 'Con gái', TRUE),
(2, 2, 'Điều dưỡng viên', TRUE),
(3, 1, 'Bác sĩ phụ trách', FALSE);

-- 4. Cấu hình ngưỡng cảnh báo cho thiết bị
INSERT INTO DeviceSettings (ElderlyID, HeartRateMin, HeartRateMax, SpO2Min, TempMax, ImmobilityThresholdSec)
VALUES 
(1, 55, 110, 93.0, 38.0, 60),
(2, 60, 105, 94.0, 37.8, 90);

-- 5. Người liên hệ khẩn cấp
INSERT INTO EmergencyContacts (ElderlyID, ContactName, PhoneNumber, PriorityOrder)
VALUES 
(1, 'Trần Thị Chăm Sóc (Con gái)', '0912345678', 1),
(1, 'Trung tâm Cấp cứu 115', '115', 2),
(2, 'Nguyễn Văn Con (Con trai)', '0988776655', 1);

-- 6. Dữ liệu sinh hiệu mẫu (VitalsData - TimescaleDB)
INSERT INTO VitalsData (RecordedAt, ElderlyID, HeartRate, SpO2, BodyTemperature, IsWearingBand)
VALUES 
(CURRENT_TIMESTAMP - INTERVAL '10 minutes', 1, 75, 98.0, 36.8, TRUE),
(CURRENT_TIMESTAMP - INTERVAL '5 minutes', 1, 78, 97.5, 36.9, TRUE),
(CURRENT_TIMESTAMP - INTERVAL '1 minute', 1, 115, 91.0, 38.2, TRUE),
(CURRENT_TIMESTAMP - INTERVAL '1 minute', 2, 72, 98.5, 36.5, TRUE);

-- 7. Sự cố mẫu (Incidents)
INSERT INTO Incidents (ElderlyID, IncidentType, SeverityLevel, IncidentTime, SensorFusionDetails, IsSOSDialed, Status)
VALUES 
(1, 'Fall', 'RedAlert', CURRENT_TIMESTAMP - INTERVAL '1 minute', 
 '{"yolo_pose": {"fall_confidence": 0.94, "state": "lying_floor"}, "yamnet": {"audio_class": "Thud/Scream", "prob": 0.88}, "thermal_amg8833": {"body_temp_c": 37.1, "floor_temp_diff": 8.5}}'::jsonb, 
 TRUE, 'Triggered');

-- 8. File Media đính kèm sự cố
INSERT INTO IncidentMedia (IncidentID, MediaType, MediaURL)
VALUES 
(1, 'SnapshotImage', 'http://localhost:9000/elderly-incidents/2026/09/incident_1_snapshot.jpg'),
(1, 'VideoClip5s', 'http://localhost:9000/elderly-incidents/2026/09/incident_1_5s_clip.mp4');

-- 9. Lịch sử nhắc nhở giọng nói
INSERT INTO VoiceReminders (ElderlyID, ReminderTime, TriggerReason, WasAcknowledged)
VALUES 
(1, CURRENT_TIMESTAMP - INTERVAL '2 hours', 'Đã đến giờ uống thuốc huyết áp buổi sáng', TRUE),
(2, CURRENT_TIMESTAMP - INTERVAL '1 hour', 'Đã 2 tiếng chưa phát hiện vận động, vui lòng uống nước', FALSE);
