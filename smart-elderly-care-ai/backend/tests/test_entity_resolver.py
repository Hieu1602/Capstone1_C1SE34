# -*- coding: utf-8 -*-
"""
test_entity_resolver.py – Unit test kiểm tra Bộ chuẩn hóa và So khớp mờ Thực thể y tế.
"""
from app.services.chatbot.entity_resolver import (
    MedicalEntityResolver,
    strip_accents,
    clean_normalized_text,
    get_medical_entity_resolver,
)


def test_clean_normalized_text():
    # Chuẩn hóa SpO2
    assert clean_normalized_text("kiem tra may do spo 2") == "kiem tra may do spo2"
    assert clean_normalized_text("sp o2 cua cu") == "spo2 cua cu"
    # Chuẩn hóa số thập phân và đơn vị
    assert clean_normalized_text("uong 0,5 mg thuoc") == "uong 0.5mg thuoc"
    assert clean_normalized_text("vien 500 mg") == "vien 500mg"


def test_strip_accents():
    assert strip_accents("Thuốc hạ huyết áp") == "thuoc ha huyet ap"
    assert strip_accents("Đo đường huyết") == "do duong huyet"


def test_exact_drug_and_brand_aliases():
    resolver = get_medical_entity_resolver()

    # Biệt dược Panadol, Hapacol, Efferalgan quy về Paracetamol
    res1 = resolver.resolve("uống 1 viên panadol extra")
    assert any(e.canonical == "Paracetamol" for e in res1)

    res2 = resolver.resolve("cho cụ uống hapacol 500mg")
    assert any(e.canonical == "Paracetamol" and e.strength == "500mg" for e in res2)


def test_fuzzy_matching_typos():
    resolver = get_medical_entity_resolver()

    # Sai chính tả Telex/VNI: pharacetamon -> Paracetamol
    res = resolver.resolve("uong pharacetamon 500mg bi sot")
    assert len(res) > 0
    paracetamol = next((e for e in res if e.canonical == "Paracetamol"), None)
    assert paracetamol is not None
    assert paracetamol.score >= 80.0
    assert paracetamol.strength == "500mg"

    # Sai chính tả Amlodipine: amlodipin / amlo
    res_amlo = resolver.resolve("thuoc ha huyet ap amlodipin 5mg")
    assert any(e.canonical == "Amlodipine" and e.strength == "5mg" for e in res_amlo)


def test_medical_device_normalization():
    resolver = get_medical_entity_resolver()

    # Máy đo SpO2 từ cách gọi dân gian
    res1 = resolver.resolve("dung may kep ngon tay do oxy")
    assert any(e.canonical == "Máy đo SpO2" for e in res1)

    # Máy đo huyết áp bắp tay
    res2 = resolver.resolve("may do huyetap omron")
    assert any(e.canonical == "Máy đo huyết áp" for e in res2)


def test_high_risk_drug_guard():
    resolver = get_medical_entity_resolver()

    # Aspirin viết sai chính tả 'aspirn' (không có trong từ điển alias)
    res = resolver.resolve("cu dang uong aspirn 81mg")
    aspirin = next((e for e in res if e.canonical == "Aspirin"), None)
    assert aspirin is not None
    assert aspirin.high_risk is True
    # Do viết sai nên phải có cờ cần xác nhận (NEED_CONFIRM)
    assert aspirin.status == "NEED_CONFIRM"
    assert aspirin.confirmation_question is not None


def test_abbreviation_expansion():
    resolver = get_medical_entity_resolver()

    # Viết tắt 'HA' -> Huyết áp, 'SXH' -> Sốt xuất huyết
    res = resolver.resolve("kiem tra chi so ha cua cu xem co bi sxh khong")
    canonicals = {e.canonical for e in res}
    assert "Huyết áp" in canonicals
    assert "Sốt xuất huyết" in canonicals


def test_query_rewriting():
    resolver = get_medical_entity_resolver()

    rewritten, entities = resolver.rewrite_and_enrich_query("uong pharacetamon 500mg")
    assert "Paracetamol" in rewritten


if __name__ == "__main__":
    test_clean_normalized_text()
    test_strip_accents()
    test_exact_drug_and_brand_aliases()
    test_fuzzy_matching_typos()
    test_medical_device_normalization()
    test_high_risk_drug_guard()
    test_abbreviation_expansion()
    test_query_rewriting()
    print("🎉 ALL 8 MEDICAL ENTITY RESOLVER TESTS PASSED 100%!")
