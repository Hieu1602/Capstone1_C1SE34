"""
test_backend_full.py – Kiểm thử toàn diện tất cả endpoints của Backend FastAPI.
"""

import sys
import httpx

if hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print(f"Connecting to {BASE_URL}...")
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Health check
    r = client.get("/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code} {r.text}"
    print("[PASS] 1. GET /health -> 200 OK")

    # 2. Login
    login_data = {"username": "+84905123456", "password": "password123"}
    # try 12345678 if password123 fails
    r = client.post("/api/v1/auth/login", data={"username": "+84905123456", "password": "password123"})
    if r.status_code != 200:
        r = client.post("/api/v1/auth/login", data={"username": "+84905123456", "password": "12345678"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token_info = r.json()
    token = token_info["access_token"]
    refresh_token = token_info["refresh_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 2. POST /api/v1/auth/login -> 200 OK (Token received)")

    # 3. Auth Refresh & Me
    r = client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200, f"Auth me failed: {r.status_code} {r.text}"
    r = client.get("/api/v1/users/me", headers=headers)
    assert r.status_code == 200, f"Users me failed: {r.status_code} {r.text}"
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200, f"Refresh token failed: {r.status_code} {r.text}"
    print("[PASS] 3. GET /auth/me, GET /users/me, POST /auth/refresh -> 200 OK")

    # 4. Houses
    r = client.get("/api/v1/houses/current", headers=headers)
    assert r.status_code == 200, f"Houses current failed: {r.status_code} {r.text}"
    house = r.json()
    print(f"[PASS] 4. GET /api/v1/houses/current -> 200 OK (House: {house.get('name')})")

    # 5. Device Groups
    r = client.get("/api/v1/device-groups", headers=headers)
    assert r.status_code == 200, f"Device groups failed: {r.status_code} {r.text}"
    groups = r.json()
    print(f"[PASS] 5. GET /api/v1/device-groups -> 200 OK (Found {len(groups)} groups)")

    # 6. Devices
    r = client.get("/api/v1/devices", headers=headers)
    assert r.status_code == 200, f"Devices failed: {r.status_code} {r.text}"
    devs = r.json()
    print(f"[PASS] 6. GET /api/v1/devices -> 200 OK (Found {len(devs)} devices)")

    # 7. Device by string serial
    r = client.get("/api/v1/devices/BLE_BAND_001", headers=headers)
    assert r.status_code == 200, f"Device BLE_BAND_001 failed: {r.status_code} {r.text}"
    r = client.get("/api/v1/devices/SECA_001", headers=headers)
    assert r.status_code == 200, f"Device SECA_001 failed: {r.status_code} {r.text}"
    print("[PASS] 7. GET /api/v1/devices/BLE_BAND_001 & SECA_001 -> 200 OK")

    # 8. System Mode
    r = client.get("/api/v1/system/mode", headers=headers)
    assert r.status_code == 200, f"System get mode failed: {r.status_code} {r.text}"
    r = client.put("/api/v1/system/mode", json={"mode": "HOME", "is_mute_alarm": False}, headers=headers)
    assert r.status_code == 200, f"System update mode failed: {r.status_code} {r.text}"
    print("[PASS] 8. GET & PUT /api/v1/system/mode -> 200 OK")

    # 9. Vitals Current
    r = client.get("/api/v1/vitals/current", headers=headers)
    assert r.status_code == 200, f"Vitals current failed: {r.status_code} {r.text}"
    v_cur = r.json()
    print(f"[PASS] 9. GET /api/v1/vitals/current -> 200 OK (HR: {v_cur.get('heart_rate')}, SpO2: {v_cur.get('spo2')})")

    # 10. Vitals Latest, History, Stats by String Serial
    r = client.get("/api/v1/vitals/BLE_BAND_001/latest", headers=headers)
    assert r.status_code == 200, f"Vitals latest failed: {r.status_code} {r.text}"
    r = client.get("/api/v1/vitals/BLE_BAND_001/history?limit=10", headers=headers)
    assert r.status_code == 200, f"Vitals history failed: {r.status_code} {r.text}"
    r = client.get("/api/v1/vitals/BLE_BAND_001/stats?hours=24", headers=headers)
    assert r.status_code == 200, f"Vitals stats failed: {r.status_code} {r.text}"
    print("[PASS] 10. GET /api/v1/vitals/BLE_BAND_001/(latest|history|stats) -> 200 OK")

    # 11. Ingest vital measurement
    vital_payload = {
        "device_id": "BLE_BAND_001",
        "heart_rate": 76,
        "spo2": 98,
        "skin_temp_max": 36.6,
        "blood_pressure_sys": 120,
        "blood_pressure_dia": 80,
        "steps": 2450,
        "fall_detected": False
    }
    r = client.post("/api/v1/vitals/BLE_BAND_001", json=vital_payload, headers=headers)
    assert r.status_code == 201, f"Ingest vital failed: {r.status_code} {r.text}"
    print("[PASS] 11. POST /api/v1/vitals/BLE_BAND_001 -> 201 Created")

    # 12. Notifications (Incidents Alias)
    r = client.get("/api/v1/notifications", headers=headers)
    assert r.status_code == 200, f"Notifications failed: {r.status_code} {r.text}"
    r = client.get("/api/v1/incidents", headers=headers)
    assert r.status_code == 200, f"Incidents failed: {r.status_code} {r.text}"
    print("[PASS] 12. GET /api/v1/notifications & /api/v1/incidents -> 200 OK")

    # 13. Reminders
    r = client.get("/api/v1/reminders/today", headers=headers)
    assert r.status_code == 200, f"Reminders today failed: {r.status_code} {r.text}"
    rems = r.json()
    print(f"[PASS] 13. GET /api/v1/reminders/today -> 200 OK ({len(rems)} reminders)")

    # 14. Patients & Medical Record
    r = client.get("/api/v1/patients/1/medical-record", headers=headers)
    assert r.status_code == 200, f"Patient medical record failed: {r.status_code} {r.text}"
    pat = r.json()
    print(f"[PASS] 14. GET /api/v1/patients/1/medical-record -> 200 OK (Patient: {pat.get('name')}, Conditions: {len(pat.get('conditions', []))})")

    print("\n========================================================")
    print("[SUCCESS] ALL 14 BACKEND ENDPOINT SUITES PASSED WITH 100% SUCCESS!")
    print("========================================================")

if __name__ == "__main__":
    run_tests()
