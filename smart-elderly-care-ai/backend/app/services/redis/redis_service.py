"""
redis_service.py
Dịch vụ Quản lý Bộ nhớ đệm (Cache) & Truyền tin thời gian thực qua Redis.
Thuộc hệ thống: Smart Elderly Care AI (Nhóm C1SE.34).

================================================================================
MỤC ĐÍCH & KIẾN TRÚC SỬ DỤNG REDIS TRONG DỰ ÁN:
--------------------------------------------------------------------------------
1. In-Memory Cache (Bộ nhớ đệm siêu tốc):
   - Thay vì mỗi lần ứng dụng Mobile hoặc Web mở lên phải chạy SQL query quét bảng
     'vital_signs' trong TimescaleDB, Backend sẽ lấy ngay từ Redis (độ trễ < 1ms).
   - Key: device:{device_id}:vitals -> Lưu JSON chỉ số sinh hiệu mới nhất.

2. Heartbeat & Online Status (Trạng thái thiết bị thời gian thực):
   - Cơ chế TTL (Time-To-Live): Thiết bị Edge Hub gửi heartbeat định kỳ mỗi 15-30 giây.
   - Key: device:{device_id}:status với TTL = 60s. Nếu quá 60s không có tin hiệu,
     Key tự động biến mất -> Hệ thống tự động xác định thiết bị Mất kết nối (Offline).
   - Set: devices:online_set -> Lưu tập hợp các device_id đang hoạt động.

3. Emergency Alerts Buffer (Hàng đợi cảnh báo khẩn cấp):
   - Danh sách các sự cố té ngã hoặc cảnh báo sinh hiệu bất thường gần nhất.
   - Key: alerts:recent (List kiểu FIFO/LIFO, giới hạn 50 sự cố mới nhất).

4. Pub/Sub (Publish/Subscribe):
   - Hỗ trợ truyền thông điệp giữa các worker FastAPI hoặc các tiến trình nền.
   - Channel: channel:telemetry:{device_id}, channel:alerts
================================================================================
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

from redis.asyncio import Redis

from app.core.database import get_redis

logger = logging.getLogger(__name__)


class RedisService:
    """
    Lớp dịch vụ trung tâm tương tác với Redis cho toàn bộ Backend.
    Tất cả các hàm đều là bất đồng bộ (async/await) để đạt hiệu năng tối đa.
    """

    def __init__(self):
        # Thời gian sống mặc định (TTL) tính bằng giây
        self.TTL_VITALS_CACHE = 86400       # 24 giờ cho bản tin sinh hiệu mới nhất
        self.TTL_DEVICE_HEARTBEAT = 60      # 60 giây (quá thời gian này coi như thiết bị offline)
        self.MAX_RECENT_ALERTS = 50        # Giữ tối đa 50 cảnh báo gần nhất trong RAM

    async def _client(self) -> Redis:
        """Lấy Redis connection instance từ connection pool chung."""
        return await get_redis()

    # ==========================================================================
    # 1. QUẢN LÝ CHỈ SỐ SINH HIỆU TỨC THỜI (LATEST VITALS CACHE)
    # ==========================================================================

    async def set_latest_vitals(self, device_id: str, data: Dict[str, Any]) -> bool:
        """
        Lưu chỉ số sinh hiệu mới nhất của một thiết bị vào Redis Cache.
        
        Args:
            device_id: Mã định danh thiết bị (ví dụ: 'hub-livingroom-01')
            data: Dictionary chứa nhịp tim, SpO2, nhiệt độ, cảnh báo...
            
        Key lưu trữ:
            device:{device_id}:vitals (chuỗi JSON)
        """
        try:
            r = await self._client()
            key = f"device:{device_id}:vitals"
            
            # Bổ sung thời gian cập nhật vào payload
            payload = dict(data)
            payload["cached_at"] = time.time()
            payload["cached_at_iso"] = time.strftime("%Y-%m-%d %H:%M:%S")

            # Chuyển thành JSON string và lưu vào Redis kèm hạn sử dụng (TTL)
            json_str = json.dumps(payload, ensure_ascii=False)
            await r.set(key, json_str, ex=self.TTL_VITALS_CACHE)

            # Đồng thời cập nhật trạng thái thiết bị là ONLINE
            await self.set_device_heartbeat(device_id)

            logger.debug("[Redis] Đã cache vitals cho device=%s", device_id)
            return True
        except Exception as exc:
            logger.error("[Redis] Lỗi khi set_latest_vitals (device=%s): %s", device_id, exc)
            return False

    async def get_latest_vitals(self, device_id: str) -> Optional[Dict[str, Any]]:
        """
        Lấy nhanh chỉ số sinh hiệu mới nhất từ Redis Cache.
        Độ trễ trung bình < 1ms, không chạm vào đĩa cứng của TimescaleDB.
        
        Returns:
            Dict dữ liệu nếu tìm thấy trong cache, hoặc None nếu cache miss.
        """
        try:
            r = await self._client()
            key = f"device:{device_id}:vitals"
            cached = await r.get(key)
            if cached:
                return json.loads(cached)
            return None
        except Exception as exc:
            logger.error("[Redis] Lỗi khi get_latest_vitals (device=%s): %s", device_id, exc)
            return None

    # ==========================================================================
    # 2. THEO DÕI TRẠNG THÁI ONLINE / OFFLINE (HEARTBEAT & LIVENESS)
    # ==========================================================================

    async def set_device_heartbeat(self, device_id: str) -> bool:
        """
        Ghi nhận nhịp tim thiết bị (Heartbeat).
        Mỗi khi nhận tín hiệu từ Edge Hub, gia hạn thêm TTL 60 giây.
        """
        try:
            r = await self._client()
            status_key = f"device:{device_id}:status"
            
            # Ghi nhận trạng thái ONLINE có thời hạn 60s
            await r.set(status_key, "ONLINE", ex=self.TTL_DEVICE_HEARTBEAT)

            # Đưa device_id vào tập hợp danh sách các thiết bị đang online
            await r.sadd("devices:online_set", device_id)

            # Ghi lại mốc thời gian nhận heartbeat cuối cùng
            await r.hset("devices:last_seen", device_id, time.strftime("%Y-%m-%d %H:%M:%S"))
            return True
        except Exception as exc:
            logger.error("[Redis] Lỗi khi set_device_heartbeat (device=%s): %s", device_id, exc)
            return False

    async def is_device_online(self, device_id: str) -> bool:
        """
        Kiểm tra xem thiết bị hiện tại có đang hoạt động (Online) hay không.
        Nếu key hết hạn (TTL = 0) nghĩa là thiết bị đã ngắt kết nối.
        """
        try:
            r = await self._client()
            status_key = f"device:{device_id}:status"
            val = await r.get(status_key)
            return val == "ONLINE"
        except Exception as exc:
            logger.error("[Redis] Lỗi khi is_device_online (device=%s): %s", device_id, exc)
            return False

    async def get_online_devices(self) -> List[str]:
        """
        Lấy danh sách tất cả các device_id đang thực sự Online.
        Hàm sẽ tự động dọn dẹp các thiết bị đã hết hạn khỏi set.
        """
        try:
            r = await self._client()
            all_devices = await r.smembers("devices:online_set")
            active_devices = []

            for dev in all_devices:
                dev_id: str = dev.decode("utf-8") if isinstance(dev, bytes) else dev
                # Kiểm tra xem key status còn sống không
                if await self.is_device_online(dev_id):
                    active_devices.append(dev_id)
                else:
                    # Nếu key đã mất, dọn sạch khỏi set
                    await r.srem("devices:online_set", dev_id)

            return active_devices
        except Exception as exc:
            logger.error("[Redis] Lỗi khi get_online_devices: %s", exc)
            return []

    # ==========================================================================
    # 3. HÀNG ĐỢI SỰ CỐ & CẢNH BÁO KHẨN CẤP (RECENT ALERTS)
    # ==========================================================================

    async def push_recent_alert(self, alert_data: Dict[str, Any]) -> bool:
        """
        Đẩy một cảnh báo mới (té ngã, nhịp tim nguy hiểm...) vào đầu danh sách Redis.
        Giới hạn danh sách tối đa MAX_RECENT_ALERTS phần tử để tránh tràn RAM.
        
        Key lưu trữ:
            alerts:recent (List kiểu Redis)
        """
        try:
            r = await self._client()
            key = "alerts:recent"
            
            payload = dict(alert_data)
            if "timestamp" not in payload:
                payload["timestamp"] = time.time()
                payload["time_str"] = time.strftime("%Y-%m-%d %H:%M:%S")

            json_str = json.dumps(payload, ensure_ascii=False)
            
            # LPUSH: Đẩy vào đầu danh sách (mới nhất nằm trên cùng)
            await r.lpush(key, json_str)

            # LTRIM: Chỉ giữ lại 50 tin mới nhất (cắt bỏ tin cũ từ index 50 trở đi)
            await r.ltrim(key, 0, self.MAX_RECENT_ALERTS - 1)

            logger.info("[Redis] Đã lưu cảnh báo khẩn cấp vào Redis list: %s", payload.get("alert_type"))
            return True
        except Exception as exc:
            logger.error("[Redis] Lỗi khi push_recent_alert: %s", exc)
            return False

    async def get_recent_alerts(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Lấy danh sách các sự cố khẩn cấp gần nhất từ Redis RAM.
        
        Args:
            limit: Số lượng bản ghi cần lấy (mặc định 10, tối đa 50)
        """
        try:
            r = await self._client()
            key = "alerts:recent"
            # LRANGE: Lấy từ index 0 đến limit - 1
            raw_list = await r.lrange(key, 0, min(limit, self.MAX_RECENT_ALERTS) - 1)
            
            results = []
            for item in raw_list:
                try:
                    results.append(json.loads(item))
                except Exception:
                    continue
            return results
        except Exception as exc:
            logger.error("[Redis] Lỗi khi get_recent_alerts: %s", exc)
            return []

    # ==========================================================================
    # 4. TRUYỀN TIN PUB/SUB (PUBLISH / SUBSCRIBE)
    # ==========================================================================

    async def publish_vital_update(self, device_id: str, data: Dict[str, Any]) -> int:
        """
        Phát bản tin sinh hiệu tới kênh Pub/Sub.
        Tất cả các worker Backend đang lắng nghe kênh này sẽ nhận được data.
        
        Channel: channel:vitals:{device_id}
        """
        try:
            r = await self._client()
            channel = f"channel:vitals:{device_id}"
            message = json.dumps(data, ensure_ascii=False)
            receivers_count = await r.publish(channel, message)
            return receivers_count
        except Exception as exc:
            logger.error("[Redis] Lỗi khi publish_vital_update: %s", exc)
            return 0

    # ==========================================================================
    # 5. THỐNG KÊ HỆ THỐNG & NẠP DỮ LIỆU MẪU (METRICS & SEED DATA)
    # ==========================================================================

    async def get_system_stats(self) -> Dict[str, Any]:
        """
        Lấy thông tin chẩn đoán kỹ thuật từ Redis Server:
        - Số lượng keys đang lưu
        - Dung lượng RAM đang chiếm dụng
        - Uptime và số kết nối
        """
        try:
            r = await self._client()
            info = await r.info()
            dbsize = await r.dbsize()
            online_devs = await self.get_online_devices()

            return {
                "status": "connected",
                "total_keys": dbsize,
                "used_memory_human": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "uptime_in_days": info.get("uptime_in_days", 0),
                "redis_version": info.get("redis_version", "N/A"),
                "online_devices_count": len(online_devs),
                "online_devices": online_devs,
            }
        except Exception as exc:
            logger.error("[Redis] Lỗi khi get_system_stats: %s", exc)
            return {"status": "error", "detail": str(exc)}

    async def seed_sample_data(self) -> Dict[str, Any]:
        """
        Nạp sẵn bộ dữ liệu mẫu sinh động vào Redis:
        1. Thiết bị 'hub-livingroom-01' (Phòng khách - Chỉ số bình thường).
        2. Thiết bị 'hub-bedroom-02' (Phòng ngủ - Cảnh báo nhịp tim cao).
        3. 2 sự cố khẩn cấp mẫu trong danh sách 'alerts:recent'.
        
        => Giúp kiểm tra ngay trên tiện ích 'Redis for VS Code' và Mobile App!
        """
        try:
            # 1. Dữ liệu thiết bị 1: Phòng khách (Bình thường)
            dev1 = "hub-livingroom-01"
            vitals1 = {
                "device_id": dev1,
                "location": "Phòng khách - Tầng 1",
                "elderly_name": "Cụ Nguyễn Văn An (78 tuổi)",
                "heart_rate": 74,
                "spo2": 98,
                "skin_temp_max": 36.5,
                "person_count": 1,
                "fall_detected": False,
                "status_text": "Sinh hiệu ổn định",
            }
            await self.set_latest_vitals(dev1, vitals1)

            # 2. Dữ liệu thiết bị 2: Phòng ngủ (Nhịp tim tăng nhẹ)
            dev2 = "hub-bedroom-02"
            vitals2 = {
                "device_id": dev2,
                "location": "Phòng ngủ - Tầng 2",
                "elderly_name": "Cụ Trần Thị Mai (75 tuổi)",
                "heart_rate": 96,
                "spo2": 96,
                "skin_temp_max": 37.1,
                "person_count": 1,
                "fall_detected": False,
                "status_text": "Cần theo dõi nhịp tim",
            }
            await self.set_latest_vitals(dev2, vitals2)

            # 3. Nạp cảnh báo mẫu
            alert1 = {
                "id": "alert-demo-001",
                "device_id": dev1,
                "location": "Phòng khách",
                "alert_type": "FALL_DETECTED",
                "alert_level": "CRITICAL",
                "message": "Phát hiện té ngã tại khu vực ghế sofa!",
                "confidence": 0.94,
                "is_acknowledged": False,
            }
            await self.push_recent_alert(alert1)

            alert2 = {
                "id": "alert-demo-002",
                "device_id": dev2,
                "location": "Phòng ngủ",
                "alert_type": "HIGH_HEART_RATE",
                "alert_level": "WARNING",
                "message": "Nhịp tim đo được 96 bpm (Vượt ngưỡng 90 bpm)",
                "confidence": 0.98,
                "is_acknowledged": True,
            }
            await self.push_recent_alert(alert2)

            return {
                "success": True,
                "message": "Đã nạp thành công dữ liệu mẫu vào Redis!",
                "devices_seeded": [dev1, dev2],
                "alerts_seeded": 2,
            }
        except Exception as exc:
            logger.error("[Redis] Lỗi khi seed_sample_data: %s", exc)
            return {"success": False, "detail": str(exc)}


# Khởi tạo singleton instance sử dụng xuyên suốt ứng dụng
redis_service = RedisService()
