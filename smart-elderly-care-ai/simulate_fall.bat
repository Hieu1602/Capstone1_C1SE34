@echo off
chcp 65001 >nul
echo =========================================================
echo  KÍCH HOẠT GIẢ LẬP CẢNH BÁO TÉ NGÃ (FALL_DETECTED)
echo =========================================================

docker exec elderly_care_backend python -c "import paho.mqtt.client as mqtt, json, uuid, time; c = mqtt.Client('sim-' + uuid.uuid4().hex[:6]); c.username_pw_set('backend', 'mqtt_secure_pass_123'); c.connect('emqx', 1883, 60); dev = '077c83fd-1331-45bd-97b4-c42a37de0db5'; p = {'id': str(uuid.uuid4()), 'device_id': dev, 'alert_type': 'FALL_DETECTED', 'alert_level': 'CRITICAL', 'confidence': 0.98, 'timestamp': time.time(), 'message': '🚨 CẢNH BÁO TÉ NGÃ KHẨN CẤP: Phát hiện người cao tuổi té ngã trong phòng khách!', 'sources': ['camera']}; c.publish('care/' + dev + '/alert', json.dumps(p), qos=1); c.disconnect(); print('>> Đã gửi cảnh báo té ngã vào hệ thống thành công!')"

pause
