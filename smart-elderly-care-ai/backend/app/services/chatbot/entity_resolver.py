# -*- coding: utf-8 -*-
"""
entity_resolver.py – Chuẩn hóa văn bản và So khớp mờ thực thể y tế (Medical Entity Resolver).
Vị trí: backend/app/services/chatbot/entity_resolver.py

Chức năng:
1. Chuẩn hóa lỗi gõ tiếng Việt (Telex, VNI), xử lý câu không dấu của người cao tuổi.
2. Quy chuẩn số & đơn vị ("spo 2" -> "spo2", "500 mg" -> "500mg", "0,5mg" -> "0.5mg").
3. Mở rộng chữ viết tắt y khoa ("HA" -> "Huyết áp", "SXH" -> "Sốt xuất huyết").
4. So khớp mờ (Fuzzy matching) tra cứu từ điển aliases.json cho tên thuốc, thiết bị y tế.
5. Chốt chặn an toàn lâm sàng: Thuốc nguy cơ cao (Aspirin, Nitroglycerin, Insulin, Warfarin)
   hoặc độ tin cậy trung bình (75 - 90 điểm) sẽ kích hoạt xác nhận lại (need_confirm).
"""
from __future__ import annotations

import difflib
import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

ALIASES_PATH = Path(__file__).resolve().parent / "data" / "medical_aliases.json"


def strip_accents(s: str) -> str:
    """Loại bỏ dấu tiếng Việt để so khớp câu gõ không dấu."""
    s = s.lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9\s]", " ", s)


def clean_normalized_text(text: str) -> str:
    """Chuẩn hóa ký tự, đơn vị và khoảng cách số."""
    s = text.lower().strip()
    # Quy chuẩn số thập phân: 0,5 mg -> 0.5mg
    s = re.sub(r"(\d+)\s*,\s*(\d+)", r"\1.\2", s)
    # Quy chuẩn SpO2: spo 2, sp o2 -> spo2
    s = re.sub(r"\bsp\s*o\s*2\b|\bspo\s*2\b", "spo2", s)
    # Quy chuẩn đơn vị đo liền số: 500 mg -> 500mg
    s = re.sub(r"(\d+(?:\.\d+)?)\s*(mg|g|ml|mcg|iu)\b", r"\1\2", s)
    return re.sub(r"\s+", " ", s).strip()


@dataclass
class ResolvedEntity:
    """Thực thể y tế đã nhận diện và chuẩn hóa."""
    canonical: str
    category: str
    matched_term: str
    score: float
    status: str  # 'EXACT' | 'HIGH_CONFIDENCE' | 'NEED_CONFIRM'
    high_risk: bool = False
    strength: Optional[str] = None
    confirmation_question: Optional[str] = None

    def build_prompt_clarification(self) -> str:
        """Tạo câu hỏi xác nhận thân thiện với người cao tuổi."""
        strength_str = f" {self.strength}" if self.strength else ""
        if self.high_risk and self.status == "NEED_CONFIRM":
            return (
                f"Lưu ý: Hệ thống nhận diện bạn có thể đang đề cập đến thuốc **{self.canonical}{strength_str}** "
                f"(thuộc nhóm thuốc cần chỉ định thận trọng từ bác sĩ). Xin hãy kiểm tra lại chính xác tên trên vỏ hộp thuốc."
            )
        if self.status == "NEED_CONFIRM":
            return f"Có phải bạn đang hỏi về **{self.canonical}{strength_str}** không?"
        return ""


class MedicalEntityResolver:
    """Bộ nhận diện và chuẩn hóa tên thuốc, thiết bị y tế thông minh."""

    def __init__(self, aliases_file: Path = ALIASES_PATH):
        self.aliases_file = aliases_file
        self.entries: List[Dict[str, Any]] = []
        # Index ánh xạ: normalized_alias -> (canonical, category, high_risk, original_alias)
        self.alias_index: Dict[str, Tuple[str, str, bool, str]] = {}
        self.abbreviations: Dict[str, str] = {
            "ha": "Huyết áp",
            "dh": "Đường huyết",
            "sxh": "Sốt xuất huyết",
            "nmct": "Nhồi máu cơ tim",
            "copd": "Bệnh phổi tắc nghẽn mạn tính (COPD)",
            "fast": "Dấu hiệu đột quỵ FAST",
            "para": "Paracetamol",
            "amlo": "Amlodipine",
            "ibu": "Ibuprofen",
        }
        self._load_dictionary()

    def _load_dictionary(self) -> None:
        """Tải từ điển aliases.json và tạo chỉ mục tra cứu O(1)."""
        if not self.aliases_file.exists():
            logger.warning("[EntityResolver] Không tìm thấy file từ điển: %s", self.aliases_file)
            return

        try:
            with open(self.aliases_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            all_items = []
            for item in data.get("drugs", []):
                item["type"] = "drug"
                all_items.append(item)
            for item in data.get("devices", []):
                item["type"] = "device"
                item["high_risk"] = False
                all_items.append(item)
            for item in data.get("medical_terms", []):
                item["type"] = "term"
                item["high_risk"] = False
                all_items.append(item)

            self.entries = all_items

            for entry in all_items:
                canon = entry["canonical"]
                cat = entry.get("category", "")
                is_high_risk = bool(entry.get("high_risk", False))
                # Chỉ mục canonical
                canon_norm = strip_accents(canon)
                self.alias_index[canon_norm] = (canon, cat, is_high_risk, canon)

                # Chỉ mục các alias
                for alias in entry.get("aliases", []):
                    alias_norm = strip_accents(alias)
                    self.alias_index[alias_norm] = (canon, cat, is_high_risk, alias)

            logger.info("[EntityResolver] Đã nạp %d mục từ điển y tế với %d aliases.", len(all_items), len(self.alias_index))
        except Exception as e:
            logger.error("[EntityResolver] Lỗi tải từ điển y tế: %s", e)

    def _extract_strength(self, text: str, match_pos: int, window: int = 25) -> Optional[str]:
        """Trích xuất hàm lượng (500mg, 81mg, 0.5mg) xung quanh vị trí tên thuốc."""
        start = max(0, match_pos - window)
        end = min(len(text), match_pos + window + 15)
        snippet = text[start:end]
        m = re.search(r"\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|iu))\b", snippet, re.IGNORECASE)
        if m:
            return m.group(1).replace(" ", "").lower()
        return None

    def resolve(self, text: str) -> List[ResolvedEntity]:
        """
        Phân tích câu người dùng, phát hiện và chuẩn hóa tên thuốc, dụng cụ y tế.
        Hỗ trợ lỗi gõ, bỏ dấu, viết tắt, và trích xuất hàm lượng.
        """
        if not text or not text.strip():
            return []

        cleaned_text = clean_normalized_text(text)
        unaccented_text = strip_accents(cleaned_text)
        words = unaccented_text.split()
        num_words = len(words)

        results: List[ResolvedEntity] = []
        found_canonicals: Set[str] = set()
        matched_indices: Set[int] = set()

        # PASS 1: Khớp chính xác hoàn toàn (Exact match & Abbreviations) theo thứ tự từ dài đến ngắn
        for n in range(min(4, num_words), 0, -1):
            for i in range(num_words - n + 1):
                idx_range = set(range(i, i + n))
                if idx_range & matched_indices:
                    continue

                gram = " ".join(words[i : i + n]).strip()
                if not gram:
                    continue

                # 1.1. Viết tắt đặc thù
                if gram in self.abbreviations:
                    canon = self.abbreviations[gram]
                    if canon not in found_canonicals:
                        found_canonicals.add(canon)
                        matched_indices.update(idx_range)
                        results.append(ResolvedEntity(
                            canonical=canon,
                            category="Thuật ngữ / Viết tắt y tế",
                            matched_term=gram,
                            score=100.0,
                            status="EXACT",
                            high_risk=False,
                            strength=None,
                        ))
                    continue

                # 1.2. Khớp chính xác hoàn toàn trong từ điển alias O(1)
                if gram in self.alias_index:
                    canon, cat, is_high_risk, orig = self.alias_index[gram]
                    if canon not in found_canonicals:
                        found_canonicals.add(canon)
                        matched_indices.update(idx_range)
                        strength = self._extract_strength(cleaned_text, cleaned_text.find(gram))
                        results.append(ResolvedEntity(
                            canonical=canon,
                            category=cat,
                            matched_term=gram,
                            score=100.0,
                            status="EXACT",
                            high_risk=is_high_risk,
                            strength=strength,
                        ))
                    continue

        # PASS 2: So khớp mờ (Fuzzy matching) trên các từ chưa được khớp chính xác
        for n in range(min(3, num_words), 0, -1):
            for i in range(num_words - n + 1):
                idx_range = set(range(i, i + n))
                if idx_range & matched_indices:
                    continue

                gram = " ".join(words[i : i + n]).strip()
                # Chốt chặn an toàn 1: Từ ngắn dưới 4 ký tự không chạy so khớp mờ
                if len(gram) < 4:
                    continue

                best_match = None
                best_score = 0.0

                for candidate, (c_canon, c_cat, is_high_risk, c_orig) in self.alias_index.items():
                    # Chốt chặn an toàn 2: Chênh lệch độ dài không quá 35%
                    if abs(len(candidate) - len(gram)) > max(2, int(len(gram) * 0.35)):
                        continue

                    # Điểm số SequenceMatcher
                    ratio = difflib.SequenceMatcher(None, gram, candidate).ratio() * 100.0
                    if ratio > best_score:
                        best_score = ratio
                        best_match = (c_canon, c_cat, is_high_risk, c_orig, candidate)

                if best_match and best_score >= 75.0:
                    c_canon, c_cat, is_high_risk, c_orig, cand_term = best_match
                    if c_canon in found_canonicals:
                        continue

                    if best_score >= 90.0 and not is_high_risk:
                        status = "HIGH_CONFIDENCE"
                        confirm_q = None
                    else:
                        status = "NEED_CONFIRM"
                        confirm_q = f"Có phải bạn đang hỏi về thuốc/dụng cụ **{c_canon}** không?"

                    found_canonicals.add(c_canon)
                    matched_indices.update(idx_range)
                    strength = self._extract_strength(cleaned_text, cleaned_text.find(gram))
                    entity = ResolvedEntity(
                        canonical=c_canon,
                        category=c_cat,
                        matched_term=gram,
                        score=round(best_score, 1),
                        status=status,
                        high_risk=is_high_risk,
                        strength=strength,
                        confirmation_question=confirm_q,
                    )
                    results.append(entity)

        return results

    def rewrite_and_enrich_query(self, query: str) -> Tuple[str, List[ResolvedEntity]]:
        """
        Viết lại câu hỏi truy vấn: Thay thế từ viết sai chính tả / viết tắt bằng tên chuẩn
        giúp BM25 Retriever và LLM đạt độ chính xác truy xuất cao nhất.
        """
        entities = self.resolve(query)
        if not entities:
            return query, []

        rewritten = query
        # Thay thế các từ đã nhận diện chính xác hoặc độ tin cậy cao
        for ent in entities:
            if ent.status in ("EXACT", "HIGH_CONFIDENCE"):
                pattern = re.compile(re.escape(ent.matched_term), re.IGNORECASE)
                replacement = ent.canonical + (f" {ent.strength}" if ent.strength and ent.strength not in query else "")
                rewritten = pattern.sub(replacement, rewritten, count=1)

        return rewritten, entities


_resolver_instance: Optional[MedicalEntityResolver] = None


def get_medical_entity_resolver() -> MedicalEntityResolver:
    """Singleton getter cho MedicalEntityResolver."""
    global _resolver_instance
    if _resolver_instance is None:
        _resolver_instance = MedicalEntityResolver()
    return _resolver_instance
