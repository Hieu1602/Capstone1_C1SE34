# apps/backend/database.py
# Cấu hình kết nối PostgreSQL và quản lý Session với SQLAlchemy

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# URL kết nối cơ sở dữ liệu PostgreSQL (cổng 5435 theo thông số yêu cầu)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5435/elderly_care",
)

# Tạo SQLAlchemy Engine với connection pooling và auto-reconnect
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Factory tạo database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class cho các model ORM
Base = declarative_base()

# FastAPI Dependency để cung cấp DB session theo từng request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
