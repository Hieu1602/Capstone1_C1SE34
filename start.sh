#!/bin/bash
# ==============================================================================
# SMART ELDERLY CARE AI - SCRIPT KHỞI ĐỘNG DỰ ÁN TRÊN MACOS / LINUX (C1SE.34)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_DIR="$SCRIPT_DIR/smart-elderly-care-ai"
BACKEND_DIR="$AI_DIR/backend"
MOBILE_DIR="$AI_DIR/apps/mobile"
WEB_DIR="$AI_DIR/apps/web"

# Màu hiển thị terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_menu() {
    clear
    echo -e "${CYAN}========================================================================${NC}"
    echo -e "${YELLOW}   [+] SMART ELDERLY CARE AI - KHỞI ĐỘNG HỆ THỐNG (macOS / Linux)     ${NC}"
    echo -e "${CYAN}========================================================================${NC}"
    echo ""
    echo -e "  ${GREEN}1.${NC} Khởi động Cloud Backend FastAPI (Port 8000)"
    echo -e "  ${GREEN}2.${NC} Khởi động Mobile App Expo Web (Port 8081)"
    echo -e "  ${GREEN}3.${NC} Khởi động Web Admin Portal (Port 5173)"
    echo -e "  ${GREEN}4.${NC} Khởi động Hạ tầng Docker (PostgreSQL 5433, Redis 6379, EMQX 1883)"
    echo -e "  ${GREEN}5.${NC} Khởi động CẢ HAI: Backend + Mobile App"
    echo -e "  ${RED}0.${NC} Thoát"
    echo ""
    echo -n "Vui lòng chọn (0-5): "
}

start_backend() {
    echo -e "\n${CYAN}>>> Đang khởi động Backend FastAPI (Port 8000)...${NC}"
    cd "$BACKEND_DIR"
    if [ -f ".venv/bin/uvicorn" ]; then
        ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    elif [ -f ".venv/bin/python" ]; then
        ./.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    else
        uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    fi
}

start_mobile() {
    echo -e "\n${CYAN}>>> Đang khởi động Mobile App Expo (Port 8081)...${NC}"
    cd "$MOBILE_DIR"
    npx expo start --web -c
}

start_web() {
    echo -e "\n${CYAN}>>> Đang khởi động Web Admin Portal (Port 5173)...${NC}"
    cd "$WEB_DIR"
    npm run dev
}

start_docker() {
    echo -e "\n${CYAN}>>> Đang khởi động Docker Services...${NC}"
    cd "$AI_DIR"
    docker compose up -d timescaledb redis emqx
    echo -e "${GREEN}✓ Docker containers đã sẵn sàng!${NC}"
}

start_both() {
    echo -e "\n${CYAN}>>> Đang khởi động Backend và Mobile App song song...${NC}"
    
    # Chạy backend ở background hoặc mở tab mới trên macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && if [ -f .venv/bin/uvicorn ]; then ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload; else uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload; fi\""
        osascript -e "tell application \"Terminal\" to do script \"cd '$MOBILE_DIR' && npx expo start --web -c\""
        echo -e "${GREEN}✓ Đã mở 2 cửa sổ Terminal riêng cho Backend và Mobile App!${NC}"
    else
        trap 'kill $(jobs -p)' EXIT
        (cd "$BACKEND_DIR" && ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
        (cd "$MOBILE_DIR" && npx expo start --web -c)
    fi
}

# Nếu có tham số dòng lệnh truyền vào: ./start.sh backend | mobile | web | docker | all
case "$1" in
    backend)
        start_backend
        ;;
    mobile)
        start_mobile
        ;;
    web)
        start_web
        ;;
    docker)
        start_docker
        ;;
    all)
        start_both
        ;;
    *)
        show_menu
        read choice
        case "$choice" in
            1) start_backend ;;
            2) start_mobile ;;
            3) start_web ;;
            4) start_docker ;;
            5) start_both ;;
            0) exit 0 ;;
            *) echo -e "${RED}Lựa chọn không hợp lệ!${NC}"; exit 1 ;;
        esac
        ;;
esac

