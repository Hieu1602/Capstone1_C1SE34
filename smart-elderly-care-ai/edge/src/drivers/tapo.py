"""Cấu hình RTSP và điều khiển Tapo; không ghi credential vào log."""
import os
import threading
from urllib.parse import quote


def rtsp_url() -> str:
    """Tạo URL RTSP từ Camera Account, khác tài khoản cloud.

    Returns:
        URL có credential đã encode; không ghi URL này vào log.
    """
    host = os.environ.get("TAPO_HOST", "").strip()
    user = os.environ.get("TAPO_USERNAME", "")
    password = os.environ.get("TAPO_PASSWORD", "")
    stream = os.getenv("TAPO_STREAM", "stream1")
    if not host or any(c in host for c in "/@ :?#"):
        raise ValueError("TAPO_HOST phải là IPv4 hoặc hostname không kèm cổng")
    if not user or not password or stream not in ("stream1", "stream2"):
        raise ValueError("Thiếu Camera Account hoặc TAPO_STREAM không hợp lệ")
    # Encode từng credential để @, :, / trong mật khẩu không phá URL.
    return f"rtsp://{quote(user, safe='')}:{quote(password, safe='')}@{host}:554/{stream}"


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
            target_host = self.host or os.environ.get("TAPO_HOST", "")
            target_user = self.user or os.getenv("TAPO_CONTROL_USERNAME") or os.environ.get("TAPO_USERNAME", "")
            target_pass = self.password or os.getenv("TAPO_CONTROL_PASSWORD") or os.environ.get("TAPO_PASSWORD", "")
            try:
                if self._client is None:
                    from pytapo import Tapo
                    self._client = Tapo(
                        target_host,
                        target_user,
                        target_pass,
                        cloudPassword=os.getenv("TAPO_CLOUD_PASSWORD", ""),
                        printDebugInformation=False,
                    )
                return getattr(self._client, method)(*args)
            except Exception:
                self._client = None
                if method == "moveMotor" and len(args) >= 2:
                    return onvif_move(target_host, target_user, target_pass, args[0], args[1])
                raise
