"""Cấu hình RTSP và điều khiển Tapo; không ghi credential vào log."""
import concurrent.futures
import logging
import os
import re
import socket
import threading
from urllib.parse import quote

logger = logging.getLogger(__name__)


def is_port_open(host: str, port: int = 443, timeout: float = 0.5) -> bool:
    """Kiểm tra nhanh cổng mạng có đang mở hay không."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        return s.connect_ex((host, port)) == 0
    except Exception:
        return False
    finally:
        s.close()


def discover_tapo_host(timeout: float = 0.35) -> str | None:
    """Tự động quét mạng LAN tìm địa chỉ IP của camera Tapo khi không có hoặc mất kết nối IP cũ."""
    # 1. Kiểm tra nhanh nếu IP hiện tại đang phản hồi cổng 554 RTSP
    current_host = os.environ.get("TAPO_HOST", "").strip()
    if current_host and not any(c in current_host for c in "/@ :?#"):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.2)
        try:
            if s.connect_ex((current_host, 554)) == 0:
                return current_host
        except Exception:
            pass
        finally:
            s.close()

    # 2. Xây dựng dải IP cần quét: ưu tiên 192.168.1.x và 192.168.0.x
    primary_subnets = ["192.168.1.", "192.168.0."]
    if current_host and re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", current_host):
        cur_sub = ".".join(current_host.split(".")[:3]) + "."
        if cur_sub not in primary_subnets:
            primary_subnets.insert(0, cur_sub)

    secondary_subnets = ["192.168.10.", "192.168.31.", "192.168.2.", "192.168.100."]

    def _check_port(ip: str) -> str | None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        try:
            if sock.connect_ex((ip, 554)) == 0:
                return ip
        except Exception:
            pass
        finally:
            sock.close()
        return None

    def _is_tapo(ip: str) -> bool:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.8)
        try:
            sock.connect((ip, 554))
            sock.sendall(f"DESCRIBE rtsp://{ip}:554/stream1 RTSP/1.0\r\nCSeq: 1\r\n\r\n".encode())
            resp = sock.recv(512).decode("utf-8", errors="ignore").lower()
            if "tp-link" in resp or "tapo" in resp:
                return True
        except Exception:
            pass
        finally:
            sock.close()
        # Fallback kiểm tra cổng ONVIF / Tapo port 2020
        sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock2.settimeout(0.4)
        try:
            if sock2.connect_ex((ip, 2020)) == 0:
                return True
        except Exception:
            pass
        finally:
            sock2.close()
        return False

    def _scan_subnets(subnets: list[str]) -> str | None:
        ips = [f"{sub}{i}" for sub in subnets for i in range(1, 255)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=64) as ex:
            results = list(ex.map(_check_port, ips))
        candidates = [ip for ip in results if ip]
        for ip in candidates:
            if _is_tapo(ip):
                return ip
        return None

    found = _scan_subnets(primary_subnets)
    if not found:
        found = _scan_subnets(secondary_subnets)

    if found:
        logger.info("Auto-Discovery: Đã tự động phát hiện camera Tapo tại IP: %s", found)
        os.environ["TAPO_HOST"] = found
        return found

    return None


def rtsp_url(host: str | None = None) -> str:
    """Tạo URL RTSP từ Camera Account, tự động phát hiện IP nếu chưa có.

    Returns:
        URL có credential đã encode; không ghi URL này vào log.
    """
    target_host = (host or os.environ.get("TAPO_HOST", "")).strip()
    if not target_host:
        target_host = discover_tapo_host() or ""

    user = os.environ.get("TAPO_USERNAME", "")
    password = os.environ.get("TAPO_PASSWORD", "")
    stream = os.getenv("TAPO_STREAM", "stream1")
    if not target_host or any(c in target_host for c in "/@ :?#"):
        raise ValueError("TAPO_HOST phải là IPv4 hoặc hostname không kèm cổng")
    if not user or not password or stream not in ("stream1", "stream2"):
        raise ValueError("Thiếu Camera Account hoặc TAPO_STREAM không hợp lệ")
    # Encode từng credential để @, :, / trong mật khẩu không phá URL.
    return f"rtsp://{quote(user, safe='')}:{quote(password, safe='')}@{target_host}:554/{stream}"


def onvif_move(host: str, user: str, password: str, x: int, y: int, duration: float = 0.35) -> dict:
    """Điều khiển PTZ qua ONVIF ContinuousMove (cổng 2020) với tài khoản camera cục bộ."""
    import base64
    import datetime
    import hashlib
    import time
    import urllib.request

    def ws_auth(u: str, p: str):
        now = datetime.datetime.now(datetime.timezone.utc)
        created = now.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        nonce = os.urandom(16)
        sha1 = hashlib.sha1()
        sha1.update(nonce + created.encode('utf-8') + p.encode('utf-8'))
        digest = base64.b64encode(sha1.digest()).decode('utf-8')
        nonce_b64 = base64.b64encode(nonce).decode('utf-8')
        return (
            f'<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">'
            f'<wsse:UsernameToken><wsse:Username>{u}</wsse:Username>'
            f'<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</wsse:Password>'
            f'<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</wsse:Nonce>'
            f'<wsu:Created>{created}</wsu:Created></wsse:UsernameToken></wsse:Security>'
        )

    vx = max(-1.0, min(1.0, x / 10.0))
    vy = max(-1.0, min(1.0, y / 10.0))
    url = f"http://{host}:2020/onvif/service"

    soap_move = (
        f'<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">'
        f'<s:Header>{ws_auth(user, password)}</s:Header><s:Body>'
        f'<ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl"><ProfileToken>profile_1</ProfileToken>'
        f'<Velocity><PanTilt x="{vx}" y="{vy}" xmlns="http://www.onvif.org/ver10/schema"/></Velocity></ContinuousMove>'
        f'</s:Body></s:Envelope>'
    )
    req = urllib.request.Request(
        url,
        data=soap_move.encode('utf-8'),
        headers={'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver20/ptz/wsdl/ContinuousMove"'}
    )
    with urllib.request.urlopen(req, timeout=5):
        pass

    time.sleep(duration)

    soap_stop = (
        f'<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">'
        f'<s:Header>{ws_auth(user, password)}</s:Header><s:Body>'
        f'<Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl"><ProfileToken>profile_1</ProfileToken><PanTilt>true</PanTilt></Stop>'
        f'</s:Body></s:Envelope>'
    )
    req_stop = urllib.request.Request(
        url,
        data=soap_stop.encode('utf-8'),
        headers={'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver20/ptz/wsdl/Stop"'}
    )
    with urllib.request.urlopen(req_stop, timeout=5):
        pass

    return {"status": "ok", "method": "onvif"}


class TapoControl:
    """Khởi tạo lười: lỗi điều khiển không làm mất luồng RTSP."""
    def __init__(self, host: str | None = None, user: str | None = None, password: str | None = None):
        """Chuẩn bị client khởi tạo lười và khóa tuần tự lệnh.

        Returns:
            Không có. Chưa kết nối tới Tapo.
        """
        self.host = host
        self.user = user
        self.password = password
        self._client = None
        self._lock = threading.Lock()

    def call(self, method: str, *args):
        # pytapo đồng bộ và tái sử dụng session; tuần tự hóa các lệnh.
        """Gọi pytapo dưới khóa; tự động fallback sang ONVIF khi TPAP yêu cầu tài khoản cloud."""
        with self._lock:
            target_host = self.host or os.environ.get("TAPO_HOST", "").strip()
            if not target_host or not is_port_open(target_host, 443, timeout=0.5):
                discovered = discover_tapo_host()
                if discovered:
                    target_host = discovered
            target_user = os.getenv("TAPO_CONTROL_USERNAME") or self.user or os.environ.get("TAPO_USERNAME", "")
            target_pass = os.getenv("TAPO_CONTROL_PASSWORD") or self.password or os.environ.get("TAPO_PASSWORD", "")
            try:
                if self._client is None:
                    from pytapo import Tapo
                    self._client = Tapo(
                        target_host,
                        target_user,
                        target_pass,
                        cloudPassword=os.getenv("TAPO_CLOUD_PASSWORD") or target_pass,
                        printDebugInformation=False,
                    )
                return getattr(self._client, method)(*args)
            except Exception:
                self._client = None
                if method == "moveMotor" and len(args) >= 2:
                    return onvif_move(target_host, target_user, target_pass, args[0], args[1])
                raise

    def get_client(self):
        """Khởi tạo và trả về client pytapo với cloudPassword để trích xuất thẻ nhớ."""
        with self._lock:
            if self._client is None:
                target_host = self.host or os.environ.get("TAPO_HOST", "").strip()
                if not target_host or not is_port_open(target_host, 443, timeout=0.5):
                    discovered = discover_tapo_host()
                    if discovered:
                        target_host = discovered
                target_user = os.getenv("TAPO_CONTROL_USERNAME") or self.user or os.environ.get("TAPO_USERNAME", "")
                target_pass = os.getenv("TAPO_CONTROL_PASSWORD") or self.password or os.environ.get("TAPO_PASSWORD", "")
                from pytapo import Tapo
                self._client = Tapo(
                    target_host,
                    target_user,
                    target_pass,
                    cloudPassword=os.getenv("TAPO_CLOUD_PASSWORD") or target_pass,
                    printDebugInformation=False,
                )
            return self._client
