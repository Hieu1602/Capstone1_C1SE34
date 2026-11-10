"""sync_ec2_env.py – Tự động đồng bộ các cấu hình Supabase và eSMS vào file .env trên EC2."""
from pathlib import Path

env_file = Path(__file__).resolve().parent / ".env"

SUPABASE_URL = "postgresql+asyncpg://postgres.lwvoaznmrciezcwktmlg:seca1122cap1@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

REQUIRED_VARS = {
    "DATABASE_URL": SUPABASE_URL,
    "OTP_MODE": "esms",
    "ESMS_API_KEY": "33071FCC017F6B71E3CD85E57E9D42",
    "ESMS_SECRET_KEY": "FE6A70755A9DC8C802FCC389E5DDA9",
    "ESMS_SMS_TYPE": "2",
    "ESMS_BRANDNAME": "Baotrixemay",
    "ESMS_SANDBOX": "0",
}


def main():
    lines = []
    existing_keys = set()
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                stripped = line.strip()
                if "=" in stripped and not stripped.startswith("#"):
                    k = stripped.split("=", 1)[0].strip()
                    if k in REQUIRED_VARS:
                        lines.append(f"{k}={REQUIRED_VARS[k]}\n")
                        existing_keys.add(k)
                        continue
                lines.append(line)

    for k, v in REQUIRED_VARS.items():
        if k not in existing_keys:
            lines.append(f"{k}={v}\n")

    with open(env_file, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("✅ Đã đồng bộ cấu hình Supabase & eSMS vào .env thành công!")


if __name__ == "__main__":
    main()
