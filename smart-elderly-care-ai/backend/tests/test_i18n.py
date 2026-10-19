import io

from typing import Any

from openpyxl import load_workbook
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.i18n import normalize_language, translate_payload, translate_text
from app.main import localize_api_messages
from app.services.chatbot.rag_service import ChatbotRAGService
from app.services.reports.report_service import report_service


def test_normalize_language_supports_locale_tags_and_defaults_to_vietnamese():
    assert normalize_language("en-US,en;q=0.9") == "en"
    assert normalize_language("VI-vn") == "vi"
    assert normalize_language("fr-FR") == "vi"
    assert normalize_language(None) == "vi"


def test_backend_messages_translate_in_both_directions():
    assert translate_text("Mã xác minh đã được gửi.", "en") == "Verification code sent."
    assert translate_text("Verification code sent.", "vi") == "Mã xác minh đã được gửi."


def test_payload_translation_only_changes_message_fields():
    payload = {
        "message": "Mã xác minh đã được gửi.",
        "patient_name": "Mã xác minh đã được gửi.",
        "detail": "Không tìm thấy phiên chat.",
    }

    translated = translate_payload(payload, "en")

    assert translated == {
        "message": "Verification code sent.",
        "patient_name": "Mã xác minh đã được gửi.",
        "detail": "Chat session not found.",
    }


def test_api_message_middleware_uses_accept_language():
    app = FastAPI()
    app.middleware("http")(localize_api_messages)

    @app.get("/sample")
    async def sample():
        return {
            "message": "Mã xác minh đã được gửi.",
            "user_data": "Mã xác minh đã được gửi.",
        }

    with TestClient(app) as client:
        response = client.get("/sample", headers={"Accept-Language": "en"})

    assert response.json() == {
        "message": "Verification code sent.",
        "user_data": "Mã xác minh đã được gửi.",
    }


def test_report_excel_uses_requested_language():
    report = report_service.generate_excel("device-1", [], [], language="en")
    workbook: Any = load_workbook(io.BytesIO(report))
    vital_sheet: Any = workbook["Vital Signs"]
    incident_sheet: Any = workbook["Incidents"]
    assert vital_sheet["A1"].value == "ID"
    assert vital_sheet["B1"].value == "Time"
    assert incident_sheet["C1"].value == "Alert type"


def test_offline_chatbot_fallback_responds_in_english():
    answer = ChatbotRAGService._generate_english_fallback(
        question="What is the heart rate?",
        heart_rate=72,
        spo2=98,
        temperature=36.7,
        fall_detected=False,
        battery=85,
        incidents=[],
        patient={},
    )

    assert "Latest vital signs" in answer
    assert "72 BPM" in answer
    assert "Báo cáo" not in answer
