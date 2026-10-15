# -*- coding: utf-8 -*-
"""
scratch_test_rag.py – Script kiểm thử kết nối RAG Chatbot Service.
"""
from __future__ import annotations

import asyncio
import io
import sys

# Thiết lập encoding UTF-8 an toàn với Type Checker
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding="utf-8")

from app.core.database import AsyncSessionFactory
from app.services.chatbot.rag_service import get_chatbot_rag_service


async def main() -> None:
    service = get_chatbot_rag_service()
    async with AsyncSessionFactory() as db:
        res = await service.ask(db, user_id=None, question="nhịp tim hiện tại của cụ là bao nhiêu")
        print("Engine:", res.get("engine"))
        print("Vitals:", res.get("vitals_snapshot"))


if __name__ == "__main__":
    asyncio.run(main())
