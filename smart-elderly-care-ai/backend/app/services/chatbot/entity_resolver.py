# -*- coding: utf-8 -*-
"""Nhận diện tên thuốc / dụng cụ y tế bị gõ sai, không dấu, viết tắt.

Quy trình: chuẩn hóa -> so khớp mờ trên danh mục -> quyết định theo độ tin cậy
(chấp nhận / hỏi lại / không nhận ra) -> (tùy chọn) nhờ LLM chọn trong danh sách ứng viên.
Chỉ dùng cho nhận diện tên, không đưa ra liều thuốc.
"""
from __future__ import annotations

import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)

ACCEPT = 90          # từ mức này trở lên: tự chấp nhận (trừ thuốc nguy cơ cao)
CONFIRM = 78         # từ mức này đến ACCEPT: hỏi lại người dùng
AMBIGUOUS_GAP = 4    # hai thực thể khác nhau cách nhau <= 4 điểm: coi là mơ hồ
MIN_LEN_FUZZY = 5    # khóa ngắn hơn 5 ký tự (bỏ khoảng trắng) chỉ nhận khớp tuyệt đối
LEN_RATIO = 0.80     # độ dài hai chuỗi phải gần nhau, tránh khớp một phần
MAX_WINDOW = 5       # số từ tối đa của một tên

UNIT_TO_MG = {"mg": 1.0, "g": 1000.0, "mcg": 0.001}
STRENGTH_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b")


def norm(text: str) -> str:
    """Chữ thường, bỏ dấu, gộp 'spo 2' -> 'spo2', giữ số thập phân."""
    s = text.lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"(?<=\d),(?=\d)", ".", s)
    s = re.sub(r"[^a-z0-9.]", " ", s)
    s = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", s)
    s = re.sub(r"\bsp\s*o\s*2\b", "spo2", s)
    return re.sub(r"\s+", " ", s).strip()


# Alias tương thích hàm cũ
strip_accents = norm
clean_normalized_text = norm


@dataclass
class Match:
    span: str
    entity_id: str
    canonical: str
    type: str
    score: float
    status: str                      # accepted | confirm | ambiguous | none
    strength_mg: float | None = None
    warnings: list[str] = field(default_factory=list)
    alternatives: list[tuple[str, float]] = field(default_factory=list)

    def question(self) -> str | None:
        if self.status == "accepted":
            return None
        if self.status == "ambiguous":
            names = ", ".join(a[0] for a in self.alternatives)
            return f"Bạn đang nói đến loại nào: {self.canonical} hay {names}?"
        extra = " Đây là thuốc cần dùng đúng chỉ định, vui lòng kiểm tra lại trên hộp thuốc." if self._high() else ""
        return f"Ý bạn là {self.canonical} đúng không?{extra}"

    def _high(self) -> bool:
        return "high_risk" in self.warnings


@dataclass
class ResolvedEntity:
    """Thực thể y tế chuẩn hóa (Tương thích ngược với hệ thống RAG hiện tại)."""
    canonical: str
    category: str
    matched_term: str
    score: float
    status: str  # 'EXACT' | 'HIGH_CONFIDENCE' | 'NEED_CONFIRM'
    high_risk: bool = False
    strength: Optional[str] = None
    confirmation_question: Optional[str] = None


class Resolver:
    def __init__(self, path: str | Path | None = None):
        if path:
            path = Path(path)
        else:
            candidates = [
                Path(__file__).with_name("aliases.json"),
                Path(__file__).parent / "data" / "medical_aliases.json",
                Path(__file__).parent / "data" / "aliases.json",
            ]
            path = next((p for p in candidates if p.exists()), candidates[0])

        data = json.loads(path.read_text(encoding="utf-8"))
        self.definitions = data.get("definitions", {})
        self.entities = {e["id"]: e for e in data["entities"]}
        self.meta = data.get("meta", {})
        self.use_labels = data.get("uses", {})
        self.keys: dict[str, str] = {}          # alias đã chuẩn hóa, bỏ khoảng trắng -> entity id
        for e in self.entities.values():
            for a in [e["canonical"], *e["aliases"]]:
                k = norm(a).replace(" ", "")
                if self.keys.get(k, e["id"]) != e["id"]:
                    raise ValueError(f"Alias trùng giữa {self.keys[k]} và {e['id']}: {a!r}")
                self.keys[k] = e["id"]
        self.key_list = list(self.keys)

    # ---- tra cứu danh mục, định nghĩa, công dụng ----
    def general_purpose_definition(self) -> dict:
        """Định nghĩa 'thuốc đa dụng' (dùng cho nhiều tình huống, thường không cần kê đơn)."""
        return self.definitions.get("thuoc_da_dung", {})

    def general_purpose(self, include_devices: bool = False) -> list[dict]:
        """Thuốc đa dụng trong tủ thuốc gia đình."""
        return [e for e in self.entities.values()
                if e.get("general_purpose") and (include_devices or e["type"] == "drug")]

    def household_items(self, type: str | None = None) -> list[str]:
        """Id thuốc và dụng cụ thường có trong tủ thuốc gia đình."""
        return [e["id"] for e in self.entities.values()
                if e.get("household") and (type is None or e["type"] == type)]

    def multi_use_drugs(self) -> list[str]:
        """Thuốc có nhiều công dụng (>= 2), ví dụ paracetamol, aspirin."""
        return [e["id"] for e in self.entities.values() if e["type"] == "drug" and e.get("multi_use")]

    def by_group(self, group: str) -> list[dict]:
        """Tìm theo nhóm thuốc hoặc công dụng, ví dụ 'dai thao duong', 'statin'."""
        g = norm(group)
        out = []
        for e in self.entities.values():
            labels = [self.use_labels[u]["label"] for u in e.get("uses", [])]
            if g in norm(" ".join([e.get("group", ""), *labels])):
                out.append(e)
        return out

    def groups(self) -> list[str]:
        return sorted({e.get("group", "") for e in self.entities.values()})

    def define(self, entity_id: str) -> dict:
        """Toàn bộ thông tin của một thực thể (định nghĩa, nhóm, công dụng, lưu ý)."""
        e = dict(self.entities[entity_id])
        e["uses_labels"] = [self.use_labels[u]["label"] for u in e.get("uses", [])]
        return e

    def describe(self, entity_id: str) -> str:
        """Đoạn tiếng Việt mô tả một thuốc hoặc dụng cụ, để bot trả lời."""
        e = self.define(entity_id)
        if e["type"] == "device":
            kind = "Dụng cụ y tế"
        elif e.get("rx"):
            kind = "Thuốc kê đơn"
        elif e.get("general_purpose"):
            kind = "Thuốc đa dụng, thường không cần kê đơn"
        else:
            kind = "Thuốc cần hỏi ý kiến bác sĩ hoặc dược sĩ"
        lines = [f"{e['canonical']} ({e.get('group', '')})", f"Loại: {kind}", f"Định nghĩa: {e['definition']}"]
        if e["uses_labels"]:
            lines.append("Công dụng: " + "; ".join(e["uses_labels"]) + ".")
        if e.get("multi_use"):
            lines.append("Thuốc có nhiều công dụng. " + (e.get("multi_use_note")
                         or "Công dụng phụ thuộc liều và chỉ định của bác sĩ."))
        if e.get("cautions_elderly"):
            lines.append(f"Lưu ý ở người cao tuổi: {e['cautions_elderly']}")
        if e.get("risk") == "high":
            lines.append("Đây là thuốc nguy cơ cao: kiểm tra kỹ tên, hàm lượng và hỏi bác sĩ hoặc dược sĩ.")
        if self.meta.get("disclaimer"):
            lines.append(self.meta["disclaimer"])
        return "\n".join(lines)

    def explain(self, text: str) -> str:
        """Nhận diện tên trong câu rồi trả về định nghĩa; hỏi lại nếu chưa chắc."""
        out = []
        for m in self.resolve(text):
            q = m.question()
            out.append(q if q else self.describe(m.entity_id))
        return "\n\n".join(out) or "Mình chưa nhận ra tên thuốc hoặc dụng cụ nào trong câu này. Bạn có thể gõ lại hoặc chụp ảnh hộp thuốc."

    def search_by_use(self, text: str, limit: int = 10) -> list[dict]:
        """Tìm thuốc theo công dụng nói bằng lời ('thuốc hạ sốt', 'thuoc ha huyet ap')."""
        toks = norm(text).split()
        hit = set()
        for uid, lab in self.use_labels.items():
            for syn in lab["synonyms"]:
                sn = norm(syn)
                k = len(sn.split())
                for i in range(len(toks) - k + 1):
                    w = " ".join(toks[i:i + k])
                    if w == sn or (len(sn) >= 8 and fuzz.ratio(w, sn) >= 90):
                        hit.add(uid)
        out = []
        for e in self.entities.values():
            matched = hit & set(e.get("uses", []))
            if e["type"] == "drug" and matched:
                out.append({"id": e["id"], "canonical": e["canonical"], "risk": e.get("risk"),
                            "multi_use": e["multi_use"],
                            "matched_uses": [self.use_labels[u]["label"] for u in sorted(matched)]})
        out.sort(key=lambda d: (-len(d["matched_uses"]), d["risk"] == "high", d["canonical"]))
        return out[:limit]

    # ---- tìm ứng viên cho một đoạn văn bản ----
    def _score_window(self, key: str) -> list[tuple[str, float]]:
        """Trả về (entity_id, điểm) tốt nhất cho mỗi thực thể."""
        if key in self.keys:
            return [(self.keys[key], 100.0)]
        if len(key) < MIN_LEN_FUZZY:
            return []
        best: dict[str, float] = {}
        for cand, score, _ in process.extract(key, self.key_list, scorer=fuzz.ratio, limit=6, score_cutoff=CONFIRM):
            if min(len(key), len(cand)) / max(len(key), len(cand)) < LEN_RATIO:
                continue
            eid = self.keys[cand]
            best[eid] = max(best.get(eid, 0.0), score)
        return sorted(best.items(), key=lambda x: -x[1])

    def candidates(self, text: str, k: int = 5) -> list[tuple[str, float]]:
        """Ứng viên cho cả câu (dùng cho bước LLM)."""
        return sorted({m.entity_id: m.score for m in self.resolve(text, include_low=True)}.items(),
                      key=lambda x: -x[1])[:k]

    def resolve(self, text: str, include_low: bool = False) -> list[Match]:
        n = norm(text)
        toks = [(m.group(), m.start(), m.end()) for m in re.finditer(r"[a-z0-9]+(?:\.[0-9]+)?", n)]
        found = []   # (score, length, i, j, [(eid, score), ...])
        for i in range(len(toks)):
            for j in range(i + 1, min(i + MAX_WINDOW, len(toks)) + 1):
                key = "".join(t[0] for t in toks[i:j])
                if key.isdigit():
                    continue
                cands = self._score_window(key)
                if cands:
                    found.append((cands[0][1], j - i, i, j, cands))
        # chọn không chồng lấn: điểm cao trước, cụm dài trước
        found.sort(key=lambda x: (-x[0], -x[1], x[2]))
        used: set[int] = set()
        chosen = []
        for score, ln, i, j, cands in found:
            if used & set(range(i, j)):
                continue
            used |= set(range(i, j))
            chosen.append((i, j, cands))
        chosen.sort()
        matches = []
        for idx, (i, j, cands) in enumerate(chosen):
            eid, score = cands[0]
            e = self.entities[eid]
            m = Match(span=n[toks[i][1]:toks[j - 1][2]], entity_id=eid, canonical=e["canonical"],
                      type=e["type"], score=score, status="accepted")
            if e.get("risk") == "high":
                m.warnings.append("high_risk")
            # trạng thái theo độ tin cậy
            if len(cands) > 1 and cands[0][1] - cands[1][1] <= AMBIGUOUS_GAP:
                m.status = "ambiguous"
                m.alternatives = [(self.entities[c[0]]["canonical"], c[1]) for c in cands[1:3]]
            elif score < CONFIRM:
                m.status = "none"
            elif score < ACCEPT or (e.get("risk") == "high" and score < 100):
                m.status = "confirm"
            # hàm lượng ngay sau tên thuốc
            nxt = toks[chosen[idx + 1][0]][1] if idx + 1 < len(chosen) else len(n)
            sm = STRENGTH_RE.search(n, toks[j - 1][2], nxt)
            if sm and e["type"] == "drug":
                mg = float(sm.group(1)) * UNIT_TO_MG[sm.group(2)]
                m.strength_mg = mg
                allowed = e.get("strengths_mg")
                if allowed and mg not in allowed:
                    m.warnings.append(f"Hàm lượng {sm.group(1)} {sm.group(2)} không phổ biến với {e['canonical']}; "
                                      "hãy kiểm tra lại trên hộp thuốc.")
            if m.status != "none" or include_low:
                matches.append(m)
        return matches


# ---- bước LLM tùy chọn: chỉ được chọn trong danh sách ứng viên ----
def llm_pick(resolver: Resolver, text: str, cands: list[tuple[str, float]], model: str | None = None) -> str | None:
    import os
    import anthropic

    allowed = {c[0] for c in cands}
    options = "\n".join(f"- {eid}: {resolver.entities[eid]['canonical']}" for eid in allowed)
    prompt = (
        "Người dùng gõ câu sau (có thể sai chính tả): \n"
        f"\"{text}\"\n\nChỉ được chọn MỘT id trong danh sách dưới đây hoặc trả về null nếu không chắc.\n"
        f"{options}\n\nTrả về JSON duy nhất dạng {{\"id\": \"...\"}} hoặc {{\"id\": null}}."
    )
    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=model or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
        max_tokens=100, messages=[{"role": "user", "content": prompt}],
    )
    try:
        out = json.loads(re.search(r"\{.*\}", resp.content[0].text, re.S).group())
    except Exception:
        return None
    return out.get("id") if out.get("id") in allowed else None   # ép chọn trong danh sách


class MedicalEntityResolver:
    """Wrapper tương thích ngược cho kiến trúc RAG hiện tại của hệ thống SmartCare."""

    def __init__(self, path: Optional[Path] = None):
        self.resolver = Resolver(path=path)

    def rewrite_and_enrich_query(self, query: str) -> Tuple[str, List[ResolvedEntity]]:
        """Chuẩn hóa câu hỏi và trích xuất thực thể y tế."""
        matches = self.resolver.resolve(query)
        resolved_entities: List[ResolvedEntity] = []
        rewritten = query

        for m in matches:
            re_status = "EXACT" if m.status == "accepted" and m.score == 100 else (
                "NEED_CONFIRM" if m.status == "confirm" else "HIGH_CONFIDENCE"
            )
            cat = "DRUG" if m.type == "drug" else "DEVICE"
            strength_str = f"{m.strength_mg}mg" if m.strength_mg is not None else None
            q_text = m.question()

            entity = ResolvedEntity(
                canonical=m.canonical,
                category=cat,
                matched_term=m.span,
                score=m.score,
                status=re_status,
                high_risk="high_risk" in m.warnings,
                strength=strength_str,
                confirmation_question=q_text,
            )
            resolved_entities.append(entity)

            # Thay thế từ gõ sai bằng tên chuẩn trong câu truy vấn nếu tự tin
            if m.status in ("accepted", "confirm") and m.canonical.lower() not in rewritten.lower():
                pattern = re.compile(re.escape(m.span), re.IGNORECASE)
                rewritten = pattern.sub(m.canonical, rewritten, count=1)

        return rewritten.strip(), resolved_entities


_global_medical_resolver: Optional[MedicalEntityResolver] = None


def get_medical_entity_resolver() -> MedicalEntityResolver:
    """Singleton getter cho MedicalEntityResolver."""
    global _global_medical_resolver
    if _global_medical_resolver is None:
        _global_medical_resolver = MedicalEntityResolver()
    return _global_medical_resolver
