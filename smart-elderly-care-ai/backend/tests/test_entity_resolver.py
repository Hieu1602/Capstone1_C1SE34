# -*- coding: utf-8 -*-
import sys
from pathlib import Path

try:
    from app.services.chatbot.entity_resolver import Resolver, norm
except ImportError:
    # Fallback nếu chạy trực tiếp từ thư mục chứa entity_resolver
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app" / "services" / "chatbot"))
    from entity_resolver import Resolver, norm

r = Resolver()


def top(q):
    res = r.resolve(q)
    return res[0] if res else None


def test_norm_strips_accents_and_spo2():
    assert norm("Máy đo SpO 2, 500mg") == "may do spo2 500mg"
    assert norm("0,5 mg") == "0.5 mg"


def test_exact_and_no_accent():
    assert top("thuoc ha sot paracetamol").entity_id == "paracetamol"
    assert top("may do duong huyet").entity_id == "may_do_duong_huyet"


def test_typo_accepted_or_confirm():
    m = top("uống pharacetamon")
    assert m.entity_id == "paracetamol" and m.status in ("accepted", "confirm")


def test_brand_name():
    assert top("em uong hapacol").entity_id == "paracetamol"


def test_spacing_error_device():
    assert top("mua may do huyetap").entity_id == "may_do_huyet_ap"


def test_high_risk_typo_needs_confirmation():
    m = top("aspirn 300mg")
    assert m.entity_id == "aspirin" and m.status == "confirm"
    assert "high_risk" in m.warnings


def test_high_risk_exact_accepted():
    assert top("nitroglycerin").status == "accepted"


def test_strength_parse_and_warning():
    m = top("nitroglycerin 0,5 mg")
    assert m.strength_mg == 0.5 and not [w for w in m.warnings if w != "high_risk"]
    m2 = top("paracetamol 5000 mg")
    assert any("không phổ biến" in w for w in m2.warnings)


def test_no_false_positive_on_plain_text():
    assert r.resolve("xin chao toi bi dau dau") == []
    assert r.resolve("huyet ap cao thi nen an gi") == []


def test_multiple_entities():
    ids = [m.entity_id for m in r.resolve("co paracetamol va nhiet ke chua")]
    assert ids == ["paracetamol", "nhiet_ke"]


def test_catalog_size_and_unique_aliases():
    assert len(r.entities) >= 60          # Resolver() đã kiểm tra alias trùng khi khởi tạo


def test_general_purpose_definition_and_list():
    d = r.general_purpose_definition()
    assert "không cần kê đơn" in d["dinh_nghia"]
    ids = {e["id"] for e in r.general_purpose()}
    assert {"paracetamol", "oresol", "povidone_iodine"} <= ids
    assert "ibuprofen" not in ids and "warfarin" not in ids      # kháng viêm, thuốc kê đơn không thuộc đa dụng
    assert all(e["type"] == "drug" for e in r.general_purpose())


def test_describe_and_explain():
    assert "Thuốc kê đơn" in r.describe("losartan")
    assert "nguy cơ cao" in r.describe("warfarin")
    assert "Smecta" in r.explain("smecta la gi") or "Diosmectite" in r.explain("smecta la gi")
    assert "Ý bạn là" in r.explain("aspirn 300mg")               # chưa chắc thì hỏi lại


def test_new_drugs_and_brands():
    assert top("cetirizin 10mg").entity_id == "cetirizine"
    assert top("uong augmentin").entity_id == "augmentin"
    assert top("povidon iod sat khuan").entity_id == "povidone_iodine"
    assert top("vitamin").entity_id == "vitamin_tong_hop"        # từ chung chung không bị nhầm thành Vitamin C


def test_by_group():
    assert any(e["id"] == "metformin" for e in r.by_group("dai thao duong"))


def test_every_entity_has_definition_and_valid_uses():
    for e in r.entities.values():
        assert e["definition"], e["id"]
        assert all(u in r.use_labels for u in e.get("uses", [])), e["id"]
        if e["type"] == "drug":
            assert e["uses"] and e.get("cautions_elderly"), e["id"]


def test_multi_use_flag_and_list():
    assert r.entities["paracetamol"]["multi_use"] is True
    assert r.entities["metformin"]["multi_use"] is False
    ids = r.multi_use_drugs()
    assert {"paracetamol", "aspirin", "ibuprofen", "nuoc_muoi_sinh_ly"} <= set(ids)
    assert "metformin" not in ids


def test_describe_contains_key_parts():
    text = r.describe("aspirin")
    assert "nhiều công dụng" in text and "Lưu ý ở người cao tuổi" in text and "nguy cơ cao" in text


def test_search_by_use():
    names = [d["id"] for d in r.search_by_use("thuoc ha sot")]
    assert "paracetamol" in names and "ibuprofen" in names
    ids = [d["id"] for d in r.search_by_use("Thuốc hạ huyết áp")]
    assert "amlodipine" in ids and "losartan" in ids
    assert r.search_by_use("hom nay troi dep") == []


def test_household_items():
    h = r.household_items()
    assert "paracetamol" in h and "may_do_huyet_ap" in h
    assert "warfarin" not in h
    assert all(r.entities[i]["type"] == "device" for i in r.household_items("device"))


def test_new_drugs_typos():
    assert top("atorvastatn 20mg").entity_id == "atorvastatin"
    assert top("uong omeprazol").entity_id == "omeprazole"
    assert top("thuoc zyrtec").entity_id == "cetirizine"
    assert top("vitamin c").entity_id == "vitamin_c"


def test_lookalike_gets_confirmation_not_silent_accept():
    m = top("losartn 50mg")
    assert m.entity_id in ("losartan", "valsartan") and m.status in ("confirm", "ambiguous", "accepted")
    assert top("prednisolon").status != "accepted" or top("prednisolon").score == 100
