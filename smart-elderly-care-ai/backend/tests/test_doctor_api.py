"""
test_doctor_api.py – Kiểm thử toàn bộ API phân hệ Bác sĩ gia đình (/api/v1/doctor).
"""

import sys
import httpx

if hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"


def run_doctor_tests():
    print(f"Connecting to {BASE_URL} to test Doctor endpoints...")
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Login with Doctor account (+84905111222)
    # password is 12345678 or password123
    r = client.post("/api/v1/auth/login", data={"username": "+84905111222", "password": "12345678"})
    if r.status_code != 200:
        r = client.post("/api/v1/auth/login", data={"username": "+84905111222", "password": "password123"})
    assert r.status_code == 200, f"Doctor login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 1. Doctor Login -> 200 OK (Token received)")

    # 2. Get assigned patients
    r = client.get("/api/v1/doctor/patients", headers=headers)
    assert r.status_code == 200, f"Doctor patients failed: {r.status_code} {r.text}"
    patients = r.json()
    assert len(patients) >= 1, "Expected at least 1 patient"
    p = patients[0]
    patient_id = p["id"]
    print(f"[PASS] 2. GET /api/v1/doctor/patients -> 200 OK (Found {len(patients)} patients, e.g. {p['name']})")

    # 3. Get patient detail
    r = client.get(f"/api/v1/doctor/patients/{patient_id}", headers=headers)
    assert r.status_code == 200, f"Patient detail failed: {r.status_code} {r.text}"
    detail = r.json()
    print(f"[PASS] 3. GET /api/v1/doctor/patients/{patient_id} -> 200 OK (BMI: {detail.get('bmi')})")

    # 4. Get patient prescriptions
    r = client.get(f"/api/v1/doctor/patients/{patient_id}/prescriptions", headers=headers)
    assert r.status_code == 200, f"Prescriptions failed: {r.status_code} {r.text}"
    rx_list = r.json()
    print(f"[PASS] 4. GET /api/v1/doctor/patients/{patient_id}/prescriptions -> 200 OK ({len(rx_list)} items)")

    # 5. Create new prescription
    new_rx = {
        "medication_name": "Panadol Extra 500mg",
        "dosage": "1 viên khi đau đầu",
        "frequency": "Khi cần, cách nhau ít nhất 6 tiếng",
        "schedule_times": ["14:00"],
        "instructions": "Uống sau ăn với nhiều nước.",
        "enable_speaker_reminder": True
    }
    r = client.post(f"/api/v1/doctor/patients/{patient_id}/prescriptions", json=new_rx, headers=headers)
    assert r.status_code == 201, f"Create prescription failed: {r.status_code} {r.text}"
    created_rx = r.json()
    print(f"[PASS] 5. POST /api/v1/doctor/patients/{patient_id}/prescriptions -> 201 Created (ID: {created_rx['id']})")

    # 6. Update medical record
    med_update = {
        "name": detail["name"],
        "doctor_notes": "Bác sĩ Minh đã tái khám định kỳ, các chỉ số huyết áp ổn định.",
        "next_appointment": "20/10/2026 - 09:00"
    }
    r = client.put(f"/api/v1/doctor/patients/{patient_id}/medical-record", json=med_update, headers=headers)
    assert r.status_code == 200, f"Update medical record failed: {r.status_code} {r.text}"
    print(f"[PASS] 6. PUT /api/v1/doctor/patients/{patient_id}/medical-record -> 200 OK")

    # 7. Get vitals analytics
    r = client.get(f"/api/v1/doctor/patients/{patient_id}/analytics?days=7", headers=headers)
    assert r.status_code == 200, f"Vitals analytics failed: {r.status_code} {r.text}"
    analytics = r.json()
    print(f"[PASS] 7. GET /api/v1/doctor/patients/{patient_id}/analytics -> 200 OK (Avg HR: {analytics.get('avg_heart_rate')}, Stability: {analytics.get('hr_stability_score')}%)")

    # 8. Update thresholds
    thresh_payload = {
        "hr_threshold_high": 115,
        "hr_threshold_low": 52,
        "spo2_threshold_low": 91
    }
    r = client.put(f"/api/v1/doctor/patients/{patient_id}/thresholds", json=thresh_payload, headers=headers)
    assert r.status_code == 200, f"Update thresholds failed: {r.status_code} {r.text}"
    print(f"[PASS] 8. PUT /api/v1/doctor/patients/{patient_id}/thresholds -> 200 OK")

    print("\n========================================================")
    print("[SUCCESS] ALL 8 DOCTOR ENDPOINTS PASSED WITH 100% SUCCESS!")
    print("========================================================")


if __name__ == "__main__":
    run_doctor_tests()
