-- =================================================================
-- SMART ELDERLY CARE AI (SECA) - DATABASE SCHEMA & RELATIONSHIPS
-- PostgreSQL 16 + TimescaleDB (Docker)
-- Đồ án tốt nghiệp: C1SE.34
-- Mô tả: CSDL đồng bộ 100% với Backend FastAPI (SQLAlchemy) & Mobile App
-- Đầy đủ các mối quan hệ (1 - 1, 1 - N, N - N) giữa các thực thể
-- =================================================================

-- PHẦN 1: KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- PHẦN 2: XÓA BẢNG CŨ THEO THỨ TỰ RÀNG BUỘC KHÓA NGOẠI (NẾU CẦN RESET)
DROP TABLE IF EXISTS vital_signs CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS device_configs CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS device_groups CASCADE;
DROP TABLE IF EXISTS elderly_profiles CASCADE;
DROP TABLE IF EXISTS house_members CASCADE;
DROP TABLE IF EXISTS houses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

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
    role VARCHAR(20) NOT NULL DEFAULT 'user',          -- 'user' (mặc định), 'admin' (quản trị hệ thống)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    fcm_token VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    current_mode VARCHAR(20) NOT NULL DEFAULT 'HOME',  -- 'HOME', 'AWAY', 'NIGHT'
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
    role_in_house VARCHAR(50) NOT NULL DEFAULT 'MEMBER', -- 'OWNER', 'ADMIN', 'MEMBER'
    permissions VARCHAR(50) NOT NULL DEFAULT 'VIEW',     -- 'ADMIN', 'EDIT', 'VIEW'
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
    gender VARCHAR(20),                                -- 'MALE', 'FEMALE', 'OTHER'
    medical_history TEXT,                              -- Tiền sử bệnh án (tim mạch, huyết áp...)
    emergency_contact_phone VARCHAR(20),               -- SĐT người thân khẩn cấp
    avatar_url VARCHAR(500),
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
    device_id VARCHAR(100) NOT NULL,                   -- Mã phần cứng duy nhất (VD: 'SECA_001', 'BLE_BAND_001')
    name VARCHAR(150) NOT NULL,
    sub_title VARCHAR(255),
    device_type VARCHAR(30) NOT NULL DEFAULT 'CAMERA', -- 'CAMERA', 'SMARTBAND', 'SENSOR'
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
--    MỐI QUAN HỆ:
--    - [devices] 1 -- 1 [device_configs]: Mỗi thiết bị có đúng một bộ cấu hình ngưỡng
-- -----------------------------------------------------------------
CREATE TABLE device_configs (
    device_id UUID NOT NULL,
    stream_url VARCHAR(500),
    resolution VARCHAR(20) NOT NULL DEFAULT '1080p',
    is_sleep BOOLEAN NOT NULL DEFAULT FALSE,
    is_ai_protect BOOLEAN NOT NULL DEFAULT TRUE,
    has_two_way_audio BOOLEAN NOT NULL DEFAULT TRUE,
    hr_threshold_high INT NOT NULL DEFAULT 120,       -- Ngưỡng nhịp tim cao (BPM)
    hr_threshold_low INT NOT NULL DEFAULT 50,         -- Ngưỡng nhịp tim thấp (BPM)
    spo2_threshold_low INT NOT NULL DEFAULT 90,       -- Ngưỡng SpO2 nguy hiểm (%)
    fall_impact_threshold DOUBLE PRECISION NOT NULL DEFAULT 2.5, -- Gia tốc va chạm té ngã (G)
    immobility_seconds INT NOT NULL DEFAULT 60,       -- Ngưỡng thời gian bất động (giây)
    mqtt_topic VARCHAR(150),
    extra_settings JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_device_configs PRIMARY KEY (device_id),
    -- Khóa ngoại quan hệ 1 - 1 với thiết bị:
    CONSTRAINT fk_device_configs_device FOREIGN KEY (device_id) 
        REFERENCES devices(id) ON DELETE CASCADE
);

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
    skin_temp_max DOUBLE PRECISION,                   -- Nhiệt độ da (°C)
    person_count INT,                                 -- Số người phát hiện qua Camera AI
    fall_detected BOOLEAN,                            -- Cờ phát hiện té ngã
    
    CONSTRAINT pk_vital_signs PRIMARY KEY (id, "time"),
    -- Khóa ngoại liên kết tới thiết bị:
    CONSTRAINT fk_vital_signs_device FOREIGN KEY (device_id) 
        REFERENCES devices(id) ON DELETE CASCADE
);

-- Kích hoạt TimescaleDB Hypertable phân vùng theo thời gian
SELECT create_hypertable('vital_signs', 'time', if_not_exists => TRUE);
CREATE INDEX ix_vital_signs_device_id ON vital_signs(device_id);
CREATE INDEX ix_vital_signs_time ON vital_signs("time" DESC);

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
    alert_level VARCHAR(20) NOT NULL DEFAULT 'HIGH',  -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
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
    ('640e3d97-b4e1-4b08-b2d3-d949a0eb075c', '+84905123456', 'Nguyễn Hữu Nghĩa', '$2b$12$gzojPtKekxkEyY5oiuJBtOAzf1rUGOi5WPHIRO.lR5hnMuoqp5age', 'user', TRUE),
    -- [2] Người thân trong gia đình (Được chia sẻ):
    ('a1111111-b4e1-4b08-b2d3-d949a0eb075c', '+84905999888', 'Nguyễn Thị Lan', '$2b$12$gzojPtKekxkEyY5oiuJBtOAzf1rUGOi5WPHIRO.lR5hnMuoqp5age', 'user', TRUE),
    -- [3] Bác sĩ gia đình (Được mời theo dõi y tế):
    ('b2222222-b4e1-4b08-b2d3-d949a0eb075c', '+84905111222', 'BS. Trần Văn Minh', '$2b$12$gzojPtKekxkEyY5oiuJBtOAzf1rUGOi5WPHIRO.lR5hnMuoqp5age', 'user', TRUE)
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
    ('a0000002-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Phòng ngủ', 'Khu vực nghỉ ngơi & theo dõi sinh hiệu ban đêm', 'folder', '#7C3AED', 2)
ON CONFLICT (house_id, name) DO NOTHING;

-- 6. Danh mục thiết bị IoT (devices)
INSERT INTO devices (id, device_id, name, sub_title, device_type, location, is_online, status_text, battery_level, owner_id, house_id, group_id, elderly_id)
VALUES
    -- Thiết bị 1: Camera AI an ninh (Phòng khách)
    (
        'd0000001-b4e1-4b08-b2d3-d949a0eb075c',
        'SECA_001',
        'SECA_001',
        'Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều',
        'CAMERA',
        'Phòng khách',
        TRUE,
        'Đang ghi hình',
        NULL,
        '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
        'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
        'a0000001-b4e1-4b08-b2d3-d949a0eb075c',
        NULL
    ),
    -- Thiết bị 2: Vòng đeo tay BLE Smartband (Gán trực tiếp cho cụ Nguyễn Văn An)
    (
        'd0000002-b4e1-4b08-b2d3-d949a0eb075c',
        'BLE_BAND_001',
        'Vòng đeo tay BLE Smartband',
        'Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập',
        'SMARTBAND',
        'Phòng ngủ',
        TRUE,
        'Pin 84% • Đang đeo',
        84,
        '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
        'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
        'a0000002-b4e1-4b08-b2d3-d949a0eb075c',
        'e0000000-b4e1-4b08-b2d3-d949a0eb075c'
    )
ON CONFLICT (device_id) DO NOTHING;

-- 7. Cấu hình ngưỡng cảnh báo thiết bị (device_configs - Quan hệ 1-1)
INSERT INTO device_configs (device_id, stream_url, resolution, is_sleep, is_ai_protect, has_two_way_audio, hr_threshold_high, hr_threshold_low, spo2_threshold_low, fall_impact_threshold, immobility_seconds)
VALUES
    ('d0000001-b4e1-4b08-b2d3-d949a0eb075c', 'http://10.0.2.2:8080', '2K', FALSE, TRUE, TRUE, 120, 50, 90, 2.5, 60),
    ('d0000002-b4e1-4b08-b2d3-d949a0eb075c', NULL, '1080p', FALSE, TRUE, FALSE, 120, 50, 90, 2.5, 60)
ON CONFLICT (device_id) DO NOTHING;

-- 8. Dữ liệu chuỗi thời gian sinh hiệu (vital_signs - Hypertable)
INSERT INTO vital_signs (id, "time", device_id, heart_rate, spo2, skin_temp_max, person_count, fall_detected)
VALUES
    (gen_random_uuid(), NOW() - INTERVAL '10 minutes', 'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 76, 98, 36.5, 1, FALSE),
    (gen_random_uuid(), NOW() - INTERVAL '5 minutes',  'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 78, 97, 36.6, 1, FALSE),
    (gen_random_uuid(), NOW(),                        'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 80, 98, 36.6, 1, FALSE);

-- 9. Nhật ký sự cố khẩn cấp (incidents)
INSERT INTO incidents (id, device_id, alert_type, alert_level, message, confidence, sources, is_acknowledged, acknowledged_by, acknowledged_at, notes)
VALUES (
    gen_random_uuid(),
    'd0000001-b4e1-4b08-b2d3-d949a0eb075c',
    'FALL_DETECTED',
    'HIGH',
    'Phát hiện người cao tuổi té ngã tại khu vực Phòng khách. Hệ thống đã tự động cảnh báo.',
    0.94,
    'FUSION',
    TRUE,
    '640e3d97-b4e1-4b08-b2d3-d949a0eb075c',
    NOW(),
    'Người nhà đã kiểm tra qua Camera, cụ đã được hỗ trợ đứng dậy an toàn.'
);
