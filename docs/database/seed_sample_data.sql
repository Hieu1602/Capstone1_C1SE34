-- =================================================================
-- SMART ELDERLY CARE AI (SECA) - DỮ LIỆU MẪU CHUẨN (SEED DATA)
-- Kịch bản: Người nhà đăng ký -> Tạo nhà -> Lắp thiết bị & Cụ già 
--           -> Chia sẻ cho người thân & Bác sĩ gia đình
-- =================================================================

-- 1. TẠO CÁC TÀI KHOẢN NGƯỜI DÙNG (MẬT KHẨU CHUNG: 12345678)
--    Mật khẩu bcrypt: $2b$12$gzojPtKekxkEyY5oiuJBtOAzf1rUGOi5WPHIRO.lR5hnMuoqp5age
INSERT INTO users (id, phone, full_name, hashed_password, role, is_active)
VALUES
    -- [1] Người nhà (Tài khoản chuẩn):
    ('640e3d97-b4e1-4b08-b2d3-d949a0eb075c', '+84905123456', 'Nguyễn Hữu Nghĩa', '$2b$12$gzojPtKekxkEyY5oiuJBtOAzf1rUGOi5WPHIRO.lR5hnMuoqp5age', 'user', TRUE),
    -- [2] Người thân trong gia đình (Tài khoản chuẩn):
    ('a1111111-b4e1-4b08-b2d3-d949a0eb075c', '+84905999888', 'Nguyễn Thị Lan', '$2b$12$gzojPtKekxkEyY5oiuJBtOAzf1rUGOi5WPHIRO.lR5hnMuoqp5age', 'user', TRUE),
    -- [3] Bác sĩ gia đình (Tài khoản chuẩn):
    ('b2222222-b4e1-4b08-b2d3-d949a0eb075c', '+84905111222', 'BS. Trần Văn Minh', '$2b$12$gzojPtKekxkEyY5oiuJBtOAzf1rUGOi5WPHIRO.lR5hnMuoqp5age', 'user', TRUE)
ON CONFLICT (phone) DO UPDATE 
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    hashed_password = EXCLUDED.hashed_password;

-- 2. TẠO CĂN NHÀ THÔNG MINH (CHỦ SỞ HỮU: NGUYỄN HỮU NGHĨA)
INSERT INTO houses (id, name, address, current_mode, owner_id)
VALUES (
    'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
    'Nhà của tôi',
    '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng',
    'HOME',
    '640e3d97-b4e1-4b08-b2d3-d949a0eb075c'
) ON CONFLICT (id) DO NOTHING;

-- 3. PHÂN QUYỀN CHIA SẺ CĂN NHÀ (HOUSE MEMBERS)
INSERT INTO house_members (id, house_id, user_id, role_in_house, permissions)
VALUES
    -- Nguyễn Hữu Nghĩa: Chủ sở hữu (OWNER) - Toàn quyền (ADMIN)
    ('d4444444-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', '640e3d97-b4e1-4b08-b2d3-d949a0eb075c', 'OWNER', 'ADMIN'),
    -- Nguyễn Thị Lan: Người thân gia đình (MEMBER) - Quyền chỉnh sửa cấu hình (EDIT)
    ('e5555555-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'a1111111-b4e1-4b08-b2d3-d949a0eb075c', 'MEMBER', 'EDIT'),
    -- Bác sĩ Trần Văn Minh: Bác sĩ theo dõi (DOCTOR) - Quyền xem sinh hiệu & camera (VIEW)
    ('f6666666-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'b2222222-b4e1-4b08-b2d3-d949a0eb075c', 'DOCTOR', 'VIEW')
ON CONFLICT (house_id, user_id) DO NOTHING;

-- 4. TẠO HỒ SƠ NGƯỜI CAO TUỔI CẦN GIÁM SÁT
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

-- 5. TẠO CÁC NHÓM PHÂN VÙNG / PHÒNG TRONG NHÀ
INSERT INTO device_groups (id, house_id, name, description, icon, color, sort_order)
VALUES
    ('a0000001-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Phòng khách', 'Khu vực sinh hoạt chung & giám sát té ngã AI', 'folder', '#7C3AED', 1),
    ('a0000002-b4e1-4b08-b2d3-d949a0eb075c', 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'Phòng ngủ', 'Khu vực nghỉ ngơi & theo dõi sinh hiệu ban đêm', 'folder', '#7C3AED', 2)
ON CONFLICT (house_id, name) DO NOTHING;

-- 6. TẠO CÁC THIẾT BỊ IOT THÔNG MINH
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

-- 7. CẤU HÌNH NGƯỠNG Y TẾ & THIẾT BỊ (DEVICE CONFIGS)
INSERT INTO device_configs (device_id, stream_url, resolution, is_sleep, is_ai_protect, has_two_way_audio, hr_threshold_high, hr_threshold_low, spo2_threshold_low, fall_impact_threshold, immobility_seconds)
VALUES
    -- Cấu hình Camera AI SECA_001
    ('d0000001-b4e1-4b08-b2d3-d949a0eb075c', 'http://10.0.2.2:8080', '2K', FALSE, TRUE, TRUE, 120, 50, 90, 2.5, 60),
    -- Cấu hình Vòng tay BLE_BAND_001
    ('d0000002-b4e1-4b08-b2d3-d949a0eb075c', NULL, '1080p', FALSE, TRUE, FALSE, 120, 50, 90, 2.5, 60)
ON CONFLICT (device_id) DO NOTHING;

-- 8. DỮ LIỆU SINH HIỆU THỜI GIAN THỰC (TIMESCALEDB HYPERTABLE)
INSERT INTO vital_signs (id, "time", device_id, heart_rate, spo2, skin_temp_max, person_count, fall_detected)
VALUES
    (gen_random_uuid(), NOW() - INTERVAL '10 minutes', 'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 76, 98, 36.5, 1, FALSE),
    (gen_random_uuid(), NOW() - INTERVAL '5 minutes',  'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 78, 97, 36.6, 1, FALSE),
    (gen_random_uuid(), NOW(),                        'd0000002-b4e1-4b08-b2d3-d949a0eb075c', 80, 98, 36.6, 1, FALSE);

-- 9. SỰ CỐ MẪU ĐÃ XÁC NHẬN (INCIDENTS)
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
