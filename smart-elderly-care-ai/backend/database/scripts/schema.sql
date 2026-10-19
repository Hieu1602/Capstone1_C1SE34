-- =================================================================
-- SMART ELDERLY CARE AI (SECA) - DATABASE SCHEMA & RELATIONSHIPS
-- PostgreSQL 16 + TimescaleDB (Docker)
-- Đồ án tốt nghiệp: C1SE.34
-- Mô tả: CSDL đồng bộ 100% với Backend FastAPI (SQLAlchemy) & Mobile App
-- Đầy đủ các mối quan hệ (1 - 1, 1 - N, N - N) giữa các thực thể
-- =================================================================

-- PHẦN 1: KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Kích hoạt TimescaleDB (nếu server có cài đặt TimescaleDB, nếu không có sẽ bỏ qua an toàn):
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB extension khong co san tren may chu PostgreSQL nay, he thong se dung bang chuan PostgreSQL.';
END $$;

-- PHẦN 2: XÓA BẢNG CŨ THEO THỨ TỰ RÀNG BUỘC KHÓA NGOẠI (NẾU CẦN RESET)
DROP TABLE IF EXISTS vital_signs CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS device_configs CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS device_groups CASCADE;
DROP TABLE IF EXISTS elderly_profiles CASCADE;
DROP TABLE IF EXISTS house_members CASCADE;
DROP TABLE IF EXISTS houses CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS system_incidents CASCADE;
DROP TABLE IF EXISTS system_notifications CASCADE;
DROP TABLE IF EXISTS security_policies CASCADE;

-- =================================================================
-- PHẦN 3: ĐỊNH NGHĨA CÁC BẢNG & MỐI QUAN HỆ RÀNG BUỘC (FOREIGN KEYS)
-- =================================================================

-- -----------------------------------------------------------------
-- 1. Bảng users: Tài khoản người dùng (Người chăm sóc, Bác sĩ, Admin)
--    ĐĂNG NHẬP DUY NHẤT: Bằng SỐ ĐIỆN THOẠI (phone) + Mật khẩu
-- -----------------------------------------------------------------
CREATE TABLE users (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,                        -- SỐ ĐIỆN THOẠI ĐĂNG NHẬP CHÍNH
    full_name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'caregiver', 'doctor', 'admin')),  -- 'user', 'caregiver', 'doctor', 'admin'
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'vi', -- Ngôn ngữ hiển thị ('vi', 'en')
    font_size_mode VARCHAR(20) NOT NULL DEFAULT 'system', -- Cỡ chữ ('system', 'custom')
    custom_font_scale INT NOT NULL DEFAULT 2,          -- Tỷ lệ phóng to chữ
    vibration_enabled BOOLEAN NOT NULL DEFAULT TRUE,   -- Rung thông báo SOS
    avatar_url VARCHAR(500),                           -- Ảnh đại diện người dùng
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    fcm_token VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_phone UNIQUE (phone)
);
CREATE UNIQUE INDEX ix_users_phone ON users(phone);

-- -----------------------------------------------------------------
-- 2. Bảng houses: Căn nhà thông minh / Không gian giám sát
--    MỐI QUAN HỆ:
--    - [users] 1 -- n [houses]: Một người dùng có thể sở hữu nhiều căn nhà
-- -----------------------------------------------------------------
CREATE TABLE houses (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    address VARCHAR(300),
    current_mode VARCHAR(20) NOT NULL DEFAULT 'HOME' CHECK (current_mode IN ('HOME', 'AWAY', 'NIGHT', 'DISARM', 'ALARM', 'PRIVACY')),  -- Chế độ an ninh đồng bộ Mobile App
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_houses PRIMARY KEY (id),
    -- Khóa ngoại liên kết tới bảng users:
    CONSTRAINT fk_houses_owner FOREIGN KEY (owner_id) 
        REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX ix_houses_owner_id ON houses(owner_id);

-- -----------------------------------------------------------------
-- 3. Bảng house_members: BẢNG TRUNG GIAN QUAN HỆ NHIỀU - NHIỀU (N - N)
--    MỐI QUAN HỆ:
--    - [users] n -- n [houses]: Nhiều người chăm sóc có thể cùng quản lý nhiều căn nhà
-- -----------------------------------------------------------------
CREATE TABLE house_members (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    house_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role_in_house VARCHAR(50) NOT NULL DEFAULT 'OWNER' CHECK (role_in_house IN ('OWNER', 'CAREGIVER', 'DOCTOR', 'RELATIVE')), -- 'OWNER', 'CAREGIVER', 'DOCTOR', 'RELATIVE'
    permissions VARCHAR(50) NOT NULL DEFAULT 'VIEW' CHECK (permissions IN ('ADMIN', 'EDIT', 'VIEW', 'OPERATOR')),     -- 'ADMIN', 'EDIT', 'VIEW', 'OPERATOR'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_house_members PRIMARY KEY (id),
    CONSTRAINT uq_house_member UNIQUE (house_id, user_id),
    
    -- Khóa ngoại liên kết tới bảng houses & users:
    CONSTRAINT fk_house_members_house FOREIGN KEY (house_id) 
        REFERENCES houses(id) ON DELETE CASCADE,
    CONSTRAINT fk_house_members_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_house_members_house_id ON house_members(house_id);
CREATE INDEX ix_house_members_user_id ON house_members(user_id);

-- -----------------------------------------------------------------
-- 4. Bảng elderly_profiles: Hồ sơ người cao tuổi được chăm sóc
--    MỐI QUAN HỆ:
--    - [houses] 1 -- n [elderly_profiles]: Một căn nhà có thể có nhiều người cao tuổi sống chung
-- -----------------------------------------------------------------
CREATE TABLE elderly_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    house_id UUID NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    birth_year INT,
    gender VARCHAR(20) CHECK (gender IN ('MALE', 'FEMALE')),        -- 'MALE', 'FEMALE'
    medical_history TEXT,                              -- Tiền sử bệnh án (tim mạch, huyết áp...)
    emergency_contact_phone VARCHAR(20),               -- SĐT người thân khẩn cấp
    avatar_url VARCHAR(500),
    face_embedding TEXT,                               -- Vector 128-D nhận diện khuôn mặt AI
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_elderly_profiles PRIMARY KEY (id),
    -- Khóa ngoại liên kết tới căn nhà:
    CONSTRAINT fk_elderly_profiles_house FOREIGN KEY (house_id) 
        REFERENCES houses(id) ON DELETE CASCADE
);
CREATE INDEX ix_elderly_profiles_house_id ON elderly_profiles(house_id);

-- -----------------------------------------------------------------
-- 5. Bảng device_groups: Nhóm phân vùng / Phòng (Phòng khách, Phòng ngủ...)
--    MỐI QUAN HỆ:
--    - [houses] 1 -- n [device_groups]: Một căn nhà được chia thành nhiều phòng/khu vực
-- -----------------------------------------------------------------
CREATE TABLE device_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    house_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    icon VARCHAR(50) NOT NULL DEFAULT 'folder',
    color VARCHAR(20) NOT NULL DEFAULT '#7C3AED',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_device_groups PRIMARY KEY (id),
    CONSTRAINT uq_device_group_house_name UNIQUE (house_id, name),
    -- Khóa ngoại liên kết tới căn nhà:
    CONSTRAINT fk_device_groups_house FOREIGN KEY (house_id) 
        REFERENCES houses(id) ON DELETE CASCADE
);
CREATE INDEX ix_device_groups_house_id ON device_groups(house_id);

-- -----------------------------------------------------------------
-- 6. Bảng devices: Danh mục thiết bị IoT (Camera AI, Smartband BLE...)
--    MỐI QUAN HỆ:
--    - [users] 1 -- n [devices]: Người dùng sở hữu thiết bị
--    - [houses] 1 -- n [devices]: Căn nhà lắp đặt thiết bị
--    - [device_groups] 1 -- n [devices]: Thiết bị lắp tại phòng cụ thể
--    - [elderly_profiles] 1 -- n [devices]: Thiết bị đeo gán trực tiếp cho người cao tuổi
-- -----------------------------------------------------------------
CREATE TABLE devices (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) NOT NULL,                   -- Mã phần cứng duy nhất (VD: 'SECA_001', 'BLE_BAND_001', 'HUB_001')
    name VARCHAR(150) NOT NULL,
    sub_title VARCHAR(255),
    device_type VARCHAR(30) NOT NULL DEFAULT 'CAMERA' CHECK (device_type IN ('CAMERA', 'SMARTBAND', 'SENSOR', 'EDGE_HUB')), -- 'CAMERA', 'SMARTBAND', 'SENSOR', 'EDGE_HUB'
    location VARCHAR(100),
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    status_text VARCHAR(150),
    battery_level SMALLINT,
    mac_address VARCHAR(50),
    ip_address VARCHAR(45),
    firmware_version VARCHAR(50),
    last_heartbeat TIMESTAMPTZ,
    owner_id UUID NOT NULL,
    house_id UUID,
    group_id UUID,
    elderly_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_devices PRIMARY KEY (id),
    CONSTRAINT uq_devices_device_id UNIQUE (device_id),
    
    -- Các Khóa ngoại liên kết:
    CONSTRAINT fk_devices_owner FOREIGN KEY (owner_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_devices_house FOREIGN KEY (house_id) 
        REFERENCES houses(id) ON DELETE CASCADE,
    CONSTRAINT fk_devices_group FOREIGN KEY (group_id) 
        REFERENCES device_groups(id) ON DELETE SET NULL,
    CONSTRAINT fk_devices_elderly FOREIGN KEY (elderly_id) 
        REFERENCES elderly_profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX ix_devices_device_id ON devices(device_id);
CREATE INDEX ix_devices_device_type ON devices(device_type);
CREATE INDEX ix_devices_owner_id ON devices(owner_id);
CREATE INDEX ix_devices_house_id ON devices(house_id);
CREATE INDEX ix_devices_group_id ON devices(group_id);
CREATE INDEX ix_devices_elderly_id ON devices(elderly_id);

-- -----------------------------------------------------------------
-- 7. Bảng device_configs: Cấu hình chi tiết & ngưỡng y tế cho thiết bị
-- -----------------------------------------------------------------
-- 7. Bảng device_configs: CẤU HÌNH THIẾT BỊ & THAM SỐ THUẬT TOÁN (Quan hệ 1 - 1)
--    MỐI QUAN HỆ:
--    - [devices] 1 -- 1 [device_configs]: Mỗi thiết bị có đúng một bộ cấu hình ngưỡng
--    - [users] 1 -- n [device_configs]: Chủ nhà hoặc Bác sĩ trực tiếp thiết lập ngưỡng chỉ số
-- -----------------------------------------------------------------
CREATE TABLE device_configs (
    device_id UUID NOT NULL,
    stream_url VARCHAR(500),
    resolution VARCHAR(20) NOT NULL DEFAULT '1080p',
    is_sleep BOOLEAN NOT NULL DEFAULT FALSE,
    is_ai_protect BOOLEAN NOT NULL DEFAULT TRUE,
    has_two_way_audio BOOLEAN NOT NULL DEFAULT TRUE,

    -- Cấu hình ngưỡng sinh hiệu nhịp tim & SpO2
    hr_threshold_high INT NOT NULL DEFAULT 120,       -- Ngưỡng nhịp tim cao (BPM)
    hr_threshold_low INT NOT NULL DEFAULT 50,         -- Ngưỡng nhịp tim thấp (BPM)
    spo2_threshold_low INT NOT NULL DEFAULT 90,       -- Ngưỡng SpO2 nguy hiểm (%)

    -- Cấu hình ngưỡng huyết áp (Blood Pressure: Tâm thu / Tâm trương)
    bp_systolic_high INT NOT NULL DEFAULT 140,        -- Ngưỡng huyết áp tâm thu cao (cảnh báo tăng huyết áp, mmHg)
    bp_systolic_low INT NOT NULL DEFAULT 90,          -- Ngưỡng huyết áp tâm thu thấp (cảnh báo hạ huyết áp, mmHg)
    bp_diastolic_high INT NOT NULL DEFAULT 90,        -- Ngưỡng huyết áp tâm trương cao (mmHg)
    bp_diastolic_low INT NOT NULL DEFAULT 60,         -- Ngưỡng huyết áp tâm trương thấp (mmHg)

    -- Cấu hình ngưỡng an toàn & phát hiện té ngã
    fall_impact_threshold DOUBLE PRECISION NOT NULL DEFAULT 2.5, -- Gia tốc va chạm té ngã (G)
    immobility_seconds INT NOT NULL DEFAULT 60,       -- Ngưỡng thời gian bất động (giây)

    -- Phân quyền & Quản lý thiết lập (Chủ nhà hoặc Bác sĩ tự set up)
    is_custom_thresholds BOOLEAN NOT NULL DEFAULT FALSE, -- FALSE: Mặc định y tế; TRUE: Do chủ nhà/bác sĩ tự tùy chỉnh riêng
    configured_by_user_id UUID,                       -- ID người thực hiện thiết lập (Chủ nhà hoặc Bác sĩ)
    configured_by_role VARCHAR(20) CHECK (configured_by_role IN ('OWNER', 'DOCTOR', 'SYSTEM')) DEFAULT 'SYSTEM', -- Vai trò người thiết lập

    mqtt_topic VARCHAR(150),
    extra_settings JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_device_configs PRIMARY KEY (device_id),
    -- Khóa ngoại quan hệ 1 - 1 với thiết bị:
    CONSTRAINT fk_device_configs_device FOREIGN KEY (device_id) 
        REFERENCES devices(id) ON DELETE CASCADE,
    -- Khóa ngoại liên kết tới người thực hiện cấu hình (users):
    CONSTRAINT fk_device_configs_configured_by FOREIGN KEY (configured_by_user_id) 
        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_device_configs_configured_by ON device_configs(configured_by_user_id);

-- -----------------------------------------------------------------
-- 8. Bảng vital_signs: Dữ liệu chuỗi thời gian (TimescaleDB Hypertable)
--    MỐI QUAN HỆ:
--    - [devices] 1 -- n [vital_signs]: Thiết bị đo và đẩy liên tục dữ liệu sinh hiệu
-- -----------------------------------------------------------------
CREATE TABLE vital_signs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    "time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_id UUID NOT NULL,
    heart_rate INT,                                   -- Nhịp tim (bpm)
    spo2 INT,                                         -- Nồng độ oxy trong máu (%)
    bp_systolic INT,                                  -- Huyết áp tâm thu đo được (mmHg)
    bp_diastolic INT,                                 -- Huyết áp tâm trương đo được (mmHg)
    skin_temp_max DOUBLE PRECISION,                   -- Nhiệt độ da (°C)
    person_count INT,                                 -- Số người phát hiện qua Camera AI
    fall_detected BOOLEAN,                            -- Cờ phát hiện té ngã
    
    CONSTRAINT pk_vital_signs PRIMARY KEY (id, "time"),
    -- Khóa ngoại liên kết tới thiết bị:
    CONSTRAINT fk_vital_signs_device FOREIGN KEY (device_id) 
        REFERENCES devices(id) ON DELETE CASCADE
);

-- Kích hoạt TimescaleDB Hypertable phân vùng theo thời gian (nếu máy chủ có cài đặt TimescaleDB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('vital_signs', 'time', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Bỏ qua tạo hypertable vì TimescaleDB chưa được kích hoạt trên database này.';
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_vital_signs_device_id ON vital_signs(device_id);
CREATE INDEX IF NOT EXISTS ix_vital_signs_time ON vital_signs("time" DESC);

-- -----------------------------------------------------------------
-- 9. Bảng incidents: Nhật ký sự cố & cảnh báo khẩn cấp (SOS, Té ngã...)
--    MỐI QUAN HỆ:
--    - [devices] 1 -- n [incidents]: Thiết bị ghi nhận các sự cố khẩn cấp
--    - [users] 1 -- n [incidents]: Người dùng/bác sĩ xử lý và xác nhận sự cố
-- -----------------------------------------------------------------
CREATE TABLE incidents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,                  -- 'FALL_DETECTED', 'LOW_SPO2', 'HIGH_HR', 'IMMOBILITY', 'SOS'
    alert_level VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (alert_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),  -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    message TEXT NOT NULL,
    confidence DOUBLE PRECISION,                      -- Độ tin cậy thuật toán AI (0.0 -> 1.0)
    sources VARCHAR(255),                             -- Nguồn phát hiện ('VISION', 'SENSOR', 'FUSION')
    video_clip_url VARCHAR(1000),                     -- Đường dẫn clip 5s ghi nhận sự cố (MinIO)
    thumbnail_url VARCHAR(1000),                      -- Ảnh chụp bằng chứng lúc xảy ra sự cố
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,   -- Đã xác nhận cảnh báo hay chưa
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_incidents PRIMARY KEY (id),
    -- Các Khóa ngoại liên kết:
    CONSTRAINT fk_incidents_device FOREIGN KEY (device_id) 
        REFERENCES devices(id) ON DELETE CASCADE,
    CONSTRAINT fk_incidents_acknowledged_by FOREIGN KEY (acknowledged_by) 
        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_incidents_device_id ON incidents(device_id);
CREATE INDEX ix_incidents_created_at ON incidents(created_at DESC);

-- -----------------------------------------------------------------
-- 10. Bảng chat_sessions: Phiên hội thoại AI Assistant
--     MỐI QUAN HỆ:
--     - [users] 1 -- n [chat_sessions]: Một người dùng có nhiều phiên chat
--     - [houses] 1 -- n [chat_sessions]: Chat gắn với căn nhà (context người cao tuổi)
-- -----------------------------------------------------------------
CREATE TABLE chat_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    house_id UUID,                                    -- Context căn nhà được hỏi (óptíonal)
    title VARCHAR(200) NOT NULL DEFAULT 'Cuộc trò chuyện', -- Tiêu đề tự động tạo từ tin nhắn đầu
    model_name VARCHAR(100) NOT NULL DEFAULT 'SmartCare Flash 1', -- Mô hình AI đã dùng
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_chat_sessions PRIMARY KEY (id),
    CONSTRAINT fk_chat_sessions_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_sessions_house FOREIGN KEY (house_id)
        REFERENCES houses(id) ON DELETE SET NULL
);
CREATE INDEX ix_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX ix_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- -----------------------------------------------------------------
-- 11. Bảng chat_messages: Từng tin nhắn trong phiên hội thoại
--     MỐI QUAN HỆ:
--     - [chat_sessions] 1 -- n [chat_messages]: Một phiên có nhiều tin nhắn
-- -----------------------------------------------------------------
CREATE TABLE chat_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')), -- 'user' | 'ai'
    text TEXT NOT NULL,
    is_error BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_chat_messages PRIMARY KEY (id),
    CONSTRAINT fk_chat_messages_session FOREIGN KEY (session_id)
        REFERENCES chat_sessions(id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX ix_chat_messages_created_at ON chat_messages(created_at ASC);

-- =================================================================
-- PHẦN 4: DỮ LIỆU KHỞI TẠO MẪU (SEED DATA CHO HỆ THỐNG)
-- Kịch bản nghiệp vụ:
--   1. Người nhà (+84905123456) đăng ký tài khoản -> Tạo căn nhà (Chủ nhà: OWNER / ADMIN)
--   2. Tạo hồ sơ cụ Nguyễn Văn An, phân chia phòng, lắp đặt Camera AI & Vòng tay BLE
--   3. Chia sẻ quyền căn nhà cho con gái (+84905999888 - CAREGIVER) và Bác sĩ (+84905111222 - DOCTOR)
-- MẬT KHẨU CHUNG TẤT CẢ TÀI KHOẢN: 12345678
-- =================================================================

-- 1. Tài khoản người dùng (users)
INSERT INTO users (id, phone, full_name, hashed_password, role, is_active)
VALUES
    -- [1] Người nhà chính (Chủ sở hữu hệ thống):
    ('640e3d97-b4e1-4b08-b2d3-d949a0eb075c', '+84905123456', 'Nguyễn Hữu Nghĩa', '$2b$12$1bF.zEJ8SB2Q5ZuWhA.Be.UYmqcaKR3EnUbQI/O42r10T0tDhL9EO', 'user', TRUE),
    -- [2] Người thân trong gia đình được uỷ quyền (Secondary Caregiver):
    ('a1111111-b4e1-4b08-b2d3-d949a0eb075c', '+84905999888', 'Nguyễn Thị Lan', '$2b$12$1bF.zEJ8SB2Q5ZuWhA.Be.UYmqcaKR3EnUbQI/O42r10T0tDhL9EO', 'user', TRUE),
    -- [3] Bác sĩ gia đình (Family Physician):
    ('b2222222-b4e1-4b08-b2d3-d949a0eb075c', '+84905111222', 'BS. Trần Văn Minh', '$2b$12$1bF.zEJ8SB2Q5ZuWhA.Be.UYmqcaKR3EnUbQI/O42r10T0tDhL9EO', 'user', TRUE),
    -- [4] Quản trị hệ thống (System Administrator):
    ('c9999999-b4e1-4b08-b2d3-d949a0eb075c', '+84900000000', 'System Admin', '$2b$12$1bF.zEJ8SB2Q5ZuWhA.Be.UYmqcaKR3EnUbQI/O42r10T0tDhL9EO', 'admin', TRUE)
ON CONFLICT (phone) DO UPDATE 
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    hashed_password = EXCLUDED.hashed_password;

-- 2. Căn nhà thông minh (houses)
INSERT INTO houses (id, name, address, current_mode, owner_id)
VALUES (
    'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
    'Nhà của tôi',
    '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng',
    'HOME',
    '640e3d97-b4e1-4b08-b2d3-d949a0eb075c'
) ON CONFLICT (id) DO NOTHING;

-- 3. Phân quyền chia sẻ căn nhà (house_members - Quan hệ N-N)
INSERT INTO house_members (id, house_id, user_id, role_in_house, permissions)
VALUES
    -- Nguyễn Hữu Nghĩa: Chủ sở hữu (OWNER) - Toàn quyền (ADMIN)
    ('d4444444-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', '640e3d97-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER', 'ADMIN'),
    -- Nguyễn Thị Lan: Người thân gia đình (CAREGIVER) - Quyền chỉnh sửa cấu hình (EDIT)
    ('e5555555-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'a1111111-b4e1-4b08-b2d3-d949a0eb075c', 'CAREGIVER', 'EDIT'),
    -- Bác sĩ Trần Văn Minh: Bác sĩ theo dõi (DOCTOR) - Quyền xem sinh hiệu & camera (VIEW)
    ('f6666666-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'b2222222-b4e1-4b08-b2d3-d949a0eb075c', 'DOCTOR', 'VIEW')
ON CONFLICT (house_id, user_id) DO NOTHING;

-- 4. Hồ sơ người cao tuổi (elderly_profiles)
INSERT INTO elderly_profiles (id, house_id, full_name, birth_year, gender, medical_history, emergency_contact_phone)
VALUES (
    'e0000000-b4e1-4b08-b2d3-d949a0eb075c',
    'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
    'Cụ Nguyễn Văn An',
    1948,
    'MALE',
    'Tiền sử tăng huyết áp độ 2, thiếu máu cơ tim cục bộ, loãng xương, rối loạn tiền đình.',
    '+84905123456'
) ON CONFLICT (id) DO NOTHING;

-- 5. Khu vực / Phòng trong nhà (device_groups)
INSERT INTO device_groups (id, house_id, name, description, icon, color, sort_order)
VALUES
    ('a0000001-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Phòng khách', 'Khu vực sinh hoạt chung & giám sát té ngã AI', 'folder', '#7C3AED', 1),
    ('a0000002-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Phòng ngủ', 'Khu vực nghỉ ngơi & theo dõi sinh hiệu ban đêm', 'folder', '#7C3AED', 2),
    ('a0000003-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Phòng bếp', 'Khu vực ăn uống & lối đi', 'folder', '#7C3AED', 3),
    ('a0000004-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Nhà vệ sinh', 'Khu vực nguy cơ té ngã trơn trượt - Cảm biến Radar mmWave riêng tư', 'folder', '#7C3AED', 4)
ON CONFLICT (house_id, name) DO NOTHING;

-- 6. Danh mục thiết bị IoT (devices)
INSERT INTO devices (id, device_id, name, sub_title, device_type, location, is_online, status_text, battery_level, mac_address, ip_address, owner_id, house_id, group_id, elderly_id)
VALUES
    -- Thiết bị 1: Camera AI an ninh góc rộng (Phòng khách)
    (
        'd0000001-b4e1-4b08-b2d3-d949a0eb075c',
        'SECA_001',
        'Camera AI An Ninh SECA_001',
        'Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều',
        'CAMERA',
        'Phòng khách',
        TRUE,
        'Đang ghi hình & Giám sát AI',
        NULL,
        'AA:BB:CC:DD:EE:01',
        '192.168.1.100',
        '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
        'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
        'a0000001-b4e1-4b08-b2d3-d949a0eb075c',
        NULL
    ),
    -- Thiết bị 2: Vòng đeo tay BLE Smartband (Phòng ngủ - Gán trực tiếp cho cụ Nguyễn Văn An)
    (
        'd0000002-b4e1-4b08-b2d3-d949a0eb075c',
        'BLE_BAND_001',
        'Vòng đeo tay BLE Smartband',
        'Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập',
        'SMARTBAND',
        'Phòng ngủ',
        TRUE,
        'Pin 84% • Đang đeo trên tay cụ An',
        84,
        'AA:BB:CC:DD:EE:02',
        NULL,
        '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
        'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
        'a0000002-b4e1-4b08-b2d3-d949a0eb075c',
        'e0000000-b4e1-4b08-b2d3-d949a0eb075c'
    ),
    -- Thiết bị 3: Edge Hub AI - Orange Pi 5 (Phòng khách)
    (
        'd0000003-b4e1-4b08-b2d3-d949a0eb075c',
        'HUB_OPI5_001',
        'Edge Hub AI (Orange Pi 5)',
        'Bộ xử lý biên AI tại chỗ (RK3588 • NPU 6 TOPS)',
        'EDGE_HUB',
        'Phòng khách',
        TRUE,
        'NPU 38% • Nhiệt độ 48°C • FPS 30',
        NULL,
        'AA:BB:CC:DD:EE:03',
        '192.168.1.10',
        '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
        'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
        'a0000001-b4e1-4b08-b2d3-d949a0eb075c',
        NULL
    ),
    -- Thiết bị 4: Camera AI Bếp & Lối Đi (Phòng bếp)
    (
        'd0000004-b4e1-4b08-b2d3-d949a0eb075c',
        'SECA_002',
        'Camera AI Bếp & Lối Đi SECA_002',
        'Camera góc rộng 2K • Phát hiện té ngã & ngã bất động',
        'CAMERA',
        'Phòng bếp',
        TRUE,
        'Đang ghi hình & Giám sát AI',
        NULL,
        'AA:BB:CC:DD:EE:04',
        '192.168.1.102',
        '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
        'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
        'a0000003-b4e1-4b08-b2d3-d949a0eb075c',
        NULL
    ),
    -- Thiết bị 5: Cảm biến Radar mmWave / Nhiệt (Nhà vệ sinh)
    (
        'd0000005-b4e1-4b08-b2d3-d949a0eb075c',
        'SENSOR_RADAR_001',
        'Cảm biến Radar mmWave WC',
        'Radar 60GHz bảo vệ riêng tư tuyệt đối (Không dùng Camera)',
        'SENSOR',
        'Nhà vệ sinh',
        TRUE,
        'Bình thường • An toàn',
        95,
        'AA:BB:CC:DD:EE:05',
        '192.168.1.105',
        '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
        'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
        'a0000004-b4e1-4b08-b2d3-d949a0eb075c',
        NULL
    )
ON CONFLICT (device_id) DO NOTHING;

-- 7. Cấu hình ngưỡng cảnh báo thiết bị (device_configs - Quan hệ 1-1)
INSERT INTO device_configs (
    device_id, stream_url, resolution, is_sleep, is_ai_protect, has_two_way_audio,
    hr_threshold_high, hr_threshold_low, spo2_threshold_low,
    bp_systolic_high, bp_systolic_low, bp_diastolic_high, bp_diastolic_low,
    fall_impact_threshold, immobility_seconds,
    is_custom_thresholds, configured_by_user_id, configured_by_role
)
VALUES
    -- Cấu hình Camera AI SECA_001
    ('d0000001-b4e1-4b08-b2d3-d949a0eb075c', 'http://10.0.2.2:8080', '2K', FALSE, TRUE, TRUE, 120, 50, 90, 140, 90, 90, 60, 2.5, 60, FALSE, '640e3d97-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER'),
    -- Cấu hình Vòng tay BLE_BAND_001 (Bác sĩ Trần Văn Minh thiết lập chuyên sâu cho cụ An)
    ('d0000002-b4e1-4b08-b2d3-d949a0eb075c', NULL, '1080p', FALSE, TRUE, FALSE, 115, 55, 92, 135, 95, 85, 60, 2.5, 45, TRUE, 'b2222222-b4e1-4b08-b2d3-d949a0eb075c', 'DOCTOR'),
    -- Cấu hình Edge Hub AI HUB_OPI5_001
    ('d0000003-b4e1-4b08-b2d3-d949a0eb075c', NULL, '1080p', FALSE, TRUE, FALSE, 120, 50, 90, 140, 90, 90, 60, 2.5, 30, FALSE, '640e3d97-b4e1-4b08-b2d3-d949a0eb075c', 'SYSTEM'),
    -- Cấu hình Camera AI SECA_002 (Bếp)
    ('d0000004-b4e1-4b08-b2d3-d949a0eb075c', 'http://10.0.2.2:8081', '2K', FALSE, TRUE, TRUE, 120, 50, 90, 140, 90, 90, 60, 2.5, 60, FALSE, '640e3d97-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER'),
    -- Cấu hình Cảm biến Radar mmWave SENSOR_RADAR_001 (Nhà vệ sinh)
    ('d0000005-b4e1-4b08-b2d3-d949a0eb075c', NULL, '1080p', FALSE, TRUE, FALSE, 120, 50, 90, 140, 90, 90, 60, 2.0, 30, FALSE, '640e3d97-b4e1-4b08-b2d3-d949a0eb075c', 'SYSTEM')
ON CONFLICT (device_id) DO NOTHING;

-- 8. Dữ liệu chuỗi thời gian sinh hiệu (vital_signs - Hypertable)
-- Dữ liệu sinh hiệu thực tế sẽ được đẩy liên tục từ Vòng đeo tay BLE & IoT Edge Hub qua API POST /vitals hoặc MQTT.
-- (Đã xóa bỏ mock data mẫu 76/78/80 bpm để hệ thống phản ánh trung thực dữ liệu đo thời gian thực).
-- INSERT INTO vital_signs (id, "time", device_id, heart_rate, spo2, bp_systolic, bp_diastolic, skin_temp_max, person_count, fall_detected)
-- VALUES
--     (gen_random_uuid(), NOW() - INTERVAL '10 minutes', 'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 76, 98, 122, 80, 36.5, 1, FALSE),
--     (gen_random_uuid(), NOW() - INTERVAL '5 minutes',  'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 78, 97, 125, 82, 36.6, 1, FALSE),
--     (gen_random_uuid(), NOW(),                        'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 80, 98, 128, 83, 36.6, 1, FALSE);

-- 9. Nhật ký sự cố khẩn cấp (incidents)
-- INSERT INTO incidents (id, device_id, alert_type, alert_level, message, confidence, sources, is_acknowledged, acknowledged_by, acknowledged_at, notes)
-- VALUES (
--     gen_random_uuid(),
--     'd0000001-b4e1-4b08-b2d3-d949a0eb075c',
--     'FALL_DETECTED',
--     'HIGH',
--     'Phát hiện người cao tuổi té ngã tại khu vực Phòng khách. Hệ thống đã tự động cảnh báo.',
--     0.94,
--     'FUSION',
--     TRUE,
--     '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
--     NOW(),
--     'Người nhà đã kiểm tra qua Camera, cụ đã được hỗ trợ đứng dậy an toàn.'
-- );

-- -----------------------------------------------------------------
-- 10. Bảng security_policies: Quản lý chính sách bảo mật hệ thống
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_policies (
    id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    value VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_security_policies PRIMARY KEY (id)
);

INSERT INTO security_policies (id, name, description, category, enabled, value)
VALUES
    ('pol-1', 'Xác thực đa yếu tố (2FA / OTP)', 'Bắt buộc xác thực OTP số điện thoại khi đăng nhập tài khoản Bác sĩ và Quản trị viên.', 'authentication', TRUE, NULL),
    ('pol-2', 'Mật khẩu độ phức tạp cao', 'Yêu cầu mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.', 'authentication', TRUE, NULL),
    ('pol-3', 'Thời gian hết hạn phiên làm việc (JWT Access Token)', 'Tự động thu hồi phiên làm việc sau thời gian không hoạt động để bảo vệ dữ liệu y tế.', 'session', TRUE, '24 giờ'),
    ('pol-4', 'Khóa tài khoản sau 5 lần đăng nhập sai', 'Tự động tạm khóa tài khoản trong 15 phút nếu phát hiện tấn công Brute-force.', 'access_control', TRUE, '5 lần'),
    ('pol-5', 'Mã hóa dữ liệu nhạy cảm (At-Rest & In-Transit)', 'Toàn bộ sinh hiệu, hình ảnh khuôn mặt được mã hóa bằng AES-256 và TLS 1.3.', 'data_protection', TRUE, NULL),
    ('pol-6', 'Giới hạn IP Whitelist cho cổng Admin', 'Chỉ cho phép truy cập trang quản trị từ các dải IP nội bộ hoặc VPN y tế đã xác thực.', 'access_control', FALSE, '192.168.1.0/24')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    enabled = EXCLUDED.enabled,
    value = EXCLUDED.value;

-- -----------------------------------------------------------------
-- 11. Bảng audit_logs: Nhật ký kiểm toán bảo mật & vận hành hệ thống
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event VARCHAR(150) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details TEXT NOT NULL,
    CONSTRAINT pk_audit_logs PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp ON audit_logs(timestamp DESC);

INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
VALUES
    ('ĐĂNG NHẬP THÀNH CÔNG', 'Admin123 (Root Admin)', '127.0.0.1', 'low', 'Đăng nhập trang quản trị thành công qua JWT Bearer token.'),
    ('THAY ĐỔI CẤU HÌNH THIẾT BỊ', 'BS. Trần Văn Minh', '192.168.1.15', 'medium', 'Cập nhật ngưỡng cảnh báo SpO2 < 90% cho cụ Nguyễn Văn An.'),
    ('CẢNH BÁO ĐĂNG NHẬP THẤT BẠI', '+84905999888', '115.79.138.90', 'high', 'Nhập sai mật khẩu lần thứ 3. Hệ thống gửi cảnh báo SMS OTP.'),
    ('TỰ ĐỘNG THU HỒI TOKEN HẾT HẠN', 'System Cron', 'localhost:8000', 'low', 'Dọn sạch 14 refresh token đã hết hạn trong Redis cache.'),
    ('PHÁT HIỆN TRUY CẬP TRÁI PHÉP', 'Anonymous', '45.154.255.88', 'critical', 'Quét cổng bất thường vào endpoint /api/v1/auth/login. Đã chặn IP tự động.');

-- -----------------------------------------------------------------
-- 12. Bảng system_incidents: Giám sát sự cố vận hành hệ thống & ứng dụng
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_incidents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    service VARCHAR(100) NOT NULL,
    incident_type VARCHAR(20) NOT NULL DEFAULT 'WARNING' CHECK (incident_type IN ('WARNING', 'ERROR', 'CRITICAL')),
    message TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT pk_system_incidents PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_system_incidents_timestamp ON system_incidents(timestamp DESC);

INSERT INTO system_incidents (service, incident_type, message, resolved)
VALUES
    ('EMQX Broker', 'WARNING', 'Thiết bị SENSOR_RADAR_001 gửi bản tin heartbeat trễ 45s so với chu kỳ.', TRUE),
    ('FastAPI Core', 'ERROR', 'Truy vấn bảng users trả về mã 404 cho user_id tạm thời. Đã tự phục hồi.', TRUE),
    ('PostgreSQL DB', 'CRITICAL', 'Khóa kết nối trên cổng 5433 được phát hiện và đã chuyển mạch an toàn sang cổng 5432.', TRUE);

-- -----------------------------------------------------------------
-- 13. Bảng system_notifications: Quản lý thông báo toàn hệ thống (Web Admin)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'system_maintenance', 'emergency', 'health_tip', 'feature_update')),
    target_audience VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'caregivers', 'doctors', 'elderly')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'revoked')),
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    read_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_system_notifications PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_system_notifications_status ON system_notifications(status);
CREATE INDEX IF NOT EXISTS ix_system_notifications_created_at ON system_notifications(created_at DESC);

INSERT INTO system_notifications (title, body, type, target_audience, status, published_at, delivered_count, read_count)
VALUES
    ('Bảo trì nâng cấp hệ thống định kỳ', 'Hệ thống Smart Elderly Care AI sẽ tiến hành tối ưu hóa kết nối IoT và sao lưu cơ sở dữ liệu từ 01:00 đến 03:00 ngày 18/10/2026. Trong thời gian này, các tính năng báo cáo có thể bị chậm nhẹ.', 'system_maintenance', 'all', 'published', CURRENT_TIMESTAMP - INTERVAL '1 day', 152, 128),
    ('Khuyến cáo sức khỏe mùa giao mùa', 'Nhiệt độ thay đổi đột ngột có thể ảnh hưởng đến huyết áp của người cao tuổi. Gia đình vui lòng kiểm tra thiết bị đo sinh hiệu phòng ngủ và duy trì nhiệt độ phòng 26-28 độ C.', 'health_tip', 'caregivers', 'published', CURRENT_TIMESTAMP - INTERVAL '5 hours', 89, 74),
    ('Cập nhật tính năng trợ lý AI Y khoa', 'Phiên bản mới của Chatbot y khoa đã được tích hợp mô hình phân tích triệu chứng chuyên sâu dành cho bác sĩ gia đình và người chăm sóc.', 'feature_update', 'all', 'scheduled', NULL, 0, 0);
