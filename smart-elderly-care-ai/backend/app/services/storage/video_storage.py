"""S3 client shared by metadata verification and private playback signing."""
import os
from functools import lru_cache

import boto3
from botocore.config import Config


def bucket():
    return os.getenv("VIDEO_S3_BUCKET", "elderly-care-incidents-c1se34")


@lru_cache(maxsize=1)
def client():
    return boto3.client("s3", region_name=os.getenv("VIDEO_S3_REGION", "ap-southeast-2"),
                        config=Config(signature_version="s3v4", connect_timeout=5, read_timeout=10,
                                      retries={"mode": "standard", "total_max_attempts": 3}))
