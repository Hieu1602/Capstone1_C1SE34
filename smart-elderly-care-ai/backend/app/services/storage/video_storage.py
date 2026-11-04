"""S3 client shared by metadata verification and private playback signing."""
import os
from functools import lru_cache

import boto3
from botocore.config import Config


def bucket():
    return os.getenv("VIDEO_S3_BUCKET", "elderly-care-incidents-c1se34")


@lru_cache(maxsize=1)
def client():
    region = os.getenv("VIDEO_S3_REGION", "ap-southeast-2")
    cfg = Config(
        signature_version="s3v4",
        connect_timeout=5,
        read_timeout=10,
        retries={"mode": "standard", "total_max_attempts": 3},
    )
    endpoint_url = os.getenv("AWS_S3_ENDPOINT") or os.getenv("S3_ENDPOINT_URL")
    if endpoint_url and not endpoint_url.startswith("http"):
        endpoint_url = f"https://{endpoint_url}"

    # 1. Thử dùng profile AWS (mặc định elderly-care theo cấu hình camera)
    profile = os.getenv("AWS_PROFILE") or os.getenv("VIDEO_AWS_PROFILE") or "elderly-care"
    try:
        session = boto3.Session(profile_name=profile)
        if session.get_credentials():
            return session.client("s3", region_name=region, endpoint_url=endpoint_url, config=cfg)
    except Exception:
        pass

    # 2. Thử dùng credentials từ biến môi trường nếu có
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    session_token = os.getenv("AWS_SESSION_TOKEN")
    if access_key and secret_key:
        return boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=session_token,
            endpoint_url=endpoint_url,
            config=cfg,
        )

    # 3. Chuỗi xác thực mặc định của boto3 (IAM role / default profile)
    return boto3.client("s3", region_name=region, endpoint_url=endpoint_url, config=cfg)
