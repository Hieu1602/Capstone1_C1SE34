#!/usr/bin/env bash
set -e

# ==============================================================================
# Script: update_camera_url.sh
# Muc dich: Cap nhat CAMERA_SERVICE_URL tren EC2 va restart backend tu dong
# Cach dung:
#   1. ./update_camera_url.sh https://xxx.trycloudflare.com
#   2. Hoac chay khong tham so: ./update_camera_url.sh
# ==============================================================================

NEW_URL="$1"

if [ -z "$NEW_URL" ]; then
    read -rp "Nhap URL Cloudflare moi (vi du: https://xyz.trycloudflare.com): " NEW_URL
fi

# Chuan hoa URL: xoa ky tu xuong dong, khoang trang va dau gach cheo o cuoi
NEW_URL=$(echo "$NEW_URL" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/\/$//')

if [ -z "$NEW_URL" ]; then
    echo "[!] Loi: URL khong duoc de trong!"
    exit 1
fi

# Tu dong them https:// neu chua co
if [[ ! "$NEW_URL" =~ ^https?:// ]]; then
    NEW_URL="https://$NEW_URL"
fi

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
fi

# Cap nhat hoac chen CAMERA_SERVICE_URL vao .env
if grep -q "^CAMERA_SERVICE_URL=" "$ENV_FILE"; then
    sed -i "s|^CAMERA_SERVICE_URL=.*|CAMERA_SERVICE_URL=$NEW_URL|" "$ENV_FILE"
else
    echo "CAMERA_SERVICE_URL=$NEW_URL" >> "$ENV_FILE"
fi

echo "[OK] Da luu cau hinh: CAMERA_SERVICE_URL=$NEW_URL"

# Restart lai backend
echo "[*] Dang khoi dong lai container backend..."
if docker compose version >/dev/null 2>&1; then
    docker compose restart backend
elif which docker-compose >/dev/null 2>&1; then
    docker-compose restart backend
else
    echo "[!] Khong tim thay lenh docker compose. Vui long restart backend thu cong."
fi

echo "[DONE] Hoan tat! Backend da ket noi toi Cloudflare tunnel moi."
