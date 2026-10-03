# -*- coding: utf-8 -*-
"""
retriever.py – Module trích xuất tri thức y khoa lão khoa (Pure Python + Zero External Dependencies).
Vị trí: backend/app/services/chatbot/retriever.py

Hoạt động 100% độc lập, không yêu cầu numpy hay scikit-learn.
Tương thích với mọi môi trường Python (.venv, Docker, Minimal CPU).
Độ trễ truy xuất < 2ms, tiết kiệm RAM tuyệt đối.
"""

from __future__ import annotations

import logging
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

DOCS_DIR = Path(__file__).resolve().parent / "data" / "medical_docs"


def _tokenize(text: str) -> List[str]:
    """Tách từ tiếng Việt / tiếng Anh đơn giản thành các token thường."""
    return re.findall(r"\w+", text.lower())


class MedicalRetriever:
    """
    Bộ chỉ mục và truy xuất tài liệu cẩm nang y tế cho người cao tuổi.
    Thuật toán: BM25 / TF-IDF Vector Space Model viết bằng Pure Python.
    """

    def __init__(self, docs_dir: Path = DOCS_DIR):
        self.docs_dir = docs_dir
        self.chunks: List[Dict[str, Any]] = []
        self.chunk_tokens: List[List[str]] = []
        self.chunk_tf: List[Dict[str, float]] = []
        self.idf: Dict[str, float] = {}
        self.avg_dl: float = 0.0
        self._is_indexed = False
        self._build_index()

    def _split_into_chunks(self, text: str, source_name: str, max_chunk_len: int = 500) -> List[Dict[str, Any]]:
        """Chia nhỏ tài liệu thành các đoạn văn mạch lạc theo dấu ngắt đoạn."""
        raw_paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks = []
        current_chunk = []
        current_len = 0

        for p in raw_paragraphs:
            p_len = len(p)
            if current_len + p_len > max_chunk_len and current_chunk:
                combined_text = "\n".join(current_chunk)
                if len(combined_text) >= 50:
                    chunks.append({
                        "source": source_name,
                        "text": combined_text,
                    })
                current_chunk = [p]
                current_len = p_len
            else:
                current_chunk.append(p)
                current_len += p_len

        if current_chunk:
            combined_text = "\n".join(current_chunk)
            if len(combined_text) >= 50:
                chunks.append({
                    "source": source_name,
                    "text": combined_text,
                })

        return chunks

    def _build_index(self):
        """Đọc toàn bộ file trong thư mục docs_dir và tạo TF-IDF index."""
        if not self.docs_dir.exists():
            logger.warning("Thư mục cẩm nang y tế không tồn tại: %s", self.docs_dir)
            return

        all_chunks: List[Dict[str, Any]] = []
        doc_files = list(self.docs_dir.glob("*.txt"))

        for file_path in doc_files:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                chunks = self._split_into_chunks(content, file_path.name)
                all_chunks.extend(chunks)
            except Exception as e:
                logger.error("Lỗi khi đọc file tài liệu %s: %s", file_path.name, e)

        if not all_chunks:
            logger.warning("Không tìm thấy đoạn văn bản y tế nào để lập chỉ mục.")
            return

        self.chunks = all_chunks
        num_docs = len(all_chunks)

        # Tính toán TF và Document Frequency (DF)
        doc_freq: Counter[str] = Counter()
        total_tokens = 0

        for chunk in all_chunks:
            tokens = _tokenize(chunk["text"])
            self.chunk_tokens.append(tokens)
            total_tokens += len(tokens)

            # Đếm số lần xuất hiện của từng từ trong đoạn (TF)
            term_counts = Counter(tokens)
            t_len = max(len(tokens), 1)
            tf_dict = {term: count / t_len for term, count in term_counts.items()}
            self.chunk_tf.append(tf_dict)

            # Ghi nhận từ xuất hiện trong văn bản này cho DF
            for term in set(tokens):
                doc_freq[term] += 1

        self.avg_dl = total_tokens / max(num_docs, 1)

        # Tính IDF: math.log((N - n + 0.5) / (n + 0.5) + 1)
        for term, df in doc_freq.items():
            self.idf[term] = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)

        self._is_indexed = True
        logger.info(
            "Đã lập chỉ mục thành công %d đoạn tri thức y tế từ %d tài liệu (Pure Python).",
            len(self.chunks),
            len(doc_files),
        )

    def search(self, query: str, top_k: int = 3, threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Tìm kiếm các đoạn tri thức y khoa liên quan nhất đến câu hỏi bằng BM25 / TF-IDF.
        Trả về danh sách dict gồm: text, source, score.
        """
        if not self._is_indexed or not self.chunks:
            return []

        q_tokens = _tokenize(query)
        if not q_tokens:
            return []

        scores: List[float] = [0.0] * len(self.chunks)

        # Chấm điểm BM25 cho từng chunk
        k1 = 1.5
        b = 0.75

        for i, chunk in enumerate(self.chunks):
            doc_len = len(self.chunk_tokens[i])
            len_norm = 1.0 - b + b * (doc_len / max(self.avg_dl, 1.0))
            score = 0.0

            tf_dict = self.chunk_tf[i]
            for q_term in q_tokens:
                if q_term in tf_dict:
                    idf_val = self.idf.get(q_term, 0.0)
                    tf_val = tf_dict[q_term] * doc_len  # số lần xuất hiện
                    term_score = idf_val * (tf_val * (k1 + 1)) / (tf_val + k1 * len_norm)
                    score += term_score

            scores[i] = score

        # Lấy top_k kết quả
        ranked_indices = sorted(range(len(scores)), key=lambda idx: scores[idx], reverse=True)[:top_k]

        results = []
        for idx in ranked_indices:
            sc = scores[idx]
            if sc > threshold:
                chunk = self.chunks[idx]
                results.append({
                    "source": chunk["source"],
                    "text": chunk["text"],
                    "score": round(sc, 3),
                })

        return results


_retriever_instance: Optional[MedicalRetriever] = None


def get_medical_retriever() -> MedicalRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = MedicalRetriever()
    return _retriever_instance
