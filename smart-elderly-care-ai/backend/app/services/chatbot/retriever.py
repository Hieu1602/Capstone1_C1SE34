# -*- coding: utf-8 -*-
"""
retriever.py – Module trích xuất tri thức y khoa lão khoa đa định dạng (PDF, DOCX, TXT, MD).
Vị trí: backend/app/services/chatbot/retriever.py

Đặc điểm:
- Tích hợp DocumentLoader hỗ trợ đa định dạng tài liệu (PDF, DOCX, TXT, Markdown).
- Thuật toán BM25 / TF-IDF Vector Space tối ưu cho tiếng Việt và thuật ngữ y khoa.
- Tự động quét cả thư mục 'data/medical_docs' và 'data/'.
- Cung cấp cơ chế đánh giá độ tương quan (Relevance Scoring) phục vụ Hybrid Intent Routing.
- Hỗ trợ reload_index() tức thì khi có tài liệu mới được bổ sung.
"""

from __future__ import annotations

import logging
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from app.services.chatbot.document_loader import DocumentLoader, default_document_loader

logger = logging.getLogger(__name__)

CHATBOT_DIR = Path(__file__).resolve().parent
DOCS_DIR = CHATBOT_DIR / "data" / "medical_docs"
DATA_DIR = CHATBOT_DIR / "data"


def _tokenize(text: str) -> List[str]:
    """Tách từ tiếng Việt và tạo unigram + bigram để tăng độ chính xác tìm kiếm RAG."""
    words = re.findall(r"\w+", text.lower())
    tokens = list(words)
    for i in range(len(words) - 1):
        tokens.append(f"{words[i]}_{words[i+1]}")
    return tokens


class MedicalRetriever:
    """
    Bộ chỉ mục và truy xuất tài liệu cẩm nang y tế cho người cao tuổi.
    Hỗ trợ nạp đa định dạng tài liệu và tìm kiếm ngữ nghĩa theo thuật toán BM25/TF-IDF.
    """

    def __init__(self, docs_dir: Path = DOCS_DIR, loader: Optional[DocumentLoader] = None):
        self.docs_dir = docs_dir
        self.loader = loader or default_document_loader
        self.chunks: List[Dict[str, Any]] = []
        self.chunk_tokens: List[List[str]] = []
        self.chunk_tf: List[Dict[str, float]] = []
        self.idf: Dict[str, float] = {}
        self.avg_dl: float = 0.0
        self._is_indexed = False
        self._build_index()

    def reload_index(self) -> int:
        """Nạp lại toàn bộ tài liệu và xây dựng lại chỉ mục tìm kiếm."""
        self.chunks.clear()
        self.chunk_tokens.clear()
        self.chunk_tf.clear()
        self.idf.clear()
        self._is_indexed = False
        self._build_index()
        return len(self.chunks)

    def _build_index(self) -> None:
        """Đọc toàn bộ file tài liệu đa định dạng (PDF, DOCX, TXT, MD) và tạo TF-IDF/BM25 index."""
        # Đảm bảo thư mục medical_docs tồn tại
        self.docs_dir.mkdir(parents=True, exist_ok=True)

        # 1. Nạp toàn bộ tài liệu đa định dạng từ thư mục medical_docs
        all_chunks = self.loader.load_directory(self.docs_dir, recursive=True)

        if not all_chunks:
            logger.warning("[Retriever] Không tìm thấy đoạn văn bản y tế nào để lập chỉ mục trong %s", self.docs_dir)
            self._is_indexed = False
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

            term_counts = Counter(tokens)
            t_len = max(len(tokens), 1)
            tf_dict = {term: count / t_len for term, count in term_counts.items()}
            self.chunk_tf.append(tf_dict)

            for term in set(tokens):
                doc_freq[term] += 1

        self.avg_dl = total_tokens / max(num_docs, 1)

        # Tính IDF: math.log((N - n + 0.5) / (n + 0.5) + 1)
        for term, df in doc_freq.items():
            self.idf[term] = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)

        self._is_indexed = True
        logger.info(
            "[Retriever] Đã lập chỉ mục thành công %d đoạn tri thức y tế đa định dạng (PDF, DOCX, TXT, MD).",
            len(self.chunks),
        )

    def search(self, query: str, top_k: int = 3, threshold: float = 3.0) -> List[Dict[str, Any]]:
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

        for i in range(len(self.chunks)):
            doc_len = len(self.chunk_tokens[i])
            len_norm = 1.0 - b + b * (doc_len / max(self.avg_dl, 1.0))
            score = 0.0

            tf_dict = self.chunk_tf[i]
            for q_term in q_tokens:
                if q_term in tf_dict:
                    idf_val = self.idf.get(q_term, 0.0)
                    tf_val = tf_dict[q_term] * doc_len
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
                    "chunk_id": chunk.get("chunk_id", ""),
                    "source": chunk["source"],
                    "text": chunk["text"],
                    "score": round(sc, 3),
                })

        return results

    def has_relevant_docs(self, query: str, threshold: float = 5.0) -> bool:
        """
        Kiểm tra xem câu hỏi có đoạn tài liệu tương ứng đạt độ tương quan tin cậy hay không.
        Dùng cho Intent Router để phân biệt câu hỏi trong tài liệu vs ngoài tài liệu.
        """
        results = self.search(query=query, top_k=1, threshold=threshold)
        return len(results) > 0


_retriever_instance: Optional[MedicalRetriever] = None


def get_medical_retriever() -> MedicalRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = MedicalRetriever()
    return _retriever_instance
