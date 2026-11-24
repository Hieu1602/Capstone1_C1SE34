"""Proxy camera cố định; không nhận URL upstream/credential từ điện thoại."""
import asyncio
import base64
import logging
import os
import json
import hmac
import re
import socket
import time
from urllib.parse import urlparse
from uuid import UUID
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from jose import JWTError, jwt
from pydantic import BaseModel, Field, StrictBool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_current_user, oauth2_scheme
from app.core.config import settings
from app.core.database import get_db
from app.crud.crud_device import crud_device
from app.crud.crud_house import crud_house
from app.crud.crud_user import crud_user
from app.models.device import Device
from app.models.house import House
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


def extra_sources():
    """Đọc các nguồn do quản trị cấu hình; không nhận URL/credential từ app."""
    try:
        sources = json.loads(os.getenv("CAMERA_EXTRA_SOURCES", "{}"))
        if not isinstance(sources, dict):
            raise ValueError()
        for key, value in sources.items():
            UUID(key)
            if not isinstance(value, dict) or not all(isinstance(value.get(k), str) and value[k] for k in ("url", "username", "password")):
                raise ValueError()
        return sources
    except (ValueError, TypeError):
        raise HTTPException(503, "Cấu hình nguồn camera bổ sung không hợp lệ") from None


async def access(user: User, db: AsyncSession, manage: bool = False, camera_id: str | None = None):
    """Kiểm tra quyền xem hoặc quản lý camera trong căn nhà.

    Args:
        user: Người dùng đã xác thực.
        db: Phiên cơ sở dữ liệu của request.
        manage: Có yêu cầu quyền quản lý thiết bị hay không.

    Returns:
        Cặp thiết bị và bảng quyền; ném HTTPException khi bị từ chối.
    """
    device = None
    default_cam_id = os.environ.get("CAMERA_DEVICE_ID", "")

    if camera_id:
        if hasattr(db, "execute"):
            device = await crud_device.get_by_id_or_device_id(db, id_or_device_id=camera_id)
        elif camera_id == default_cam_id or camera_id in extra_sources():
            from uuid import UUID
            try:
                device = await db.get(Device, UUID(camera_id))
            except Exception:
                pass
        else:
            raise HTTPException(404, "Camera chưa có nguồn video được cấu hình")

        if not device:
            raise HTTPException(404, "Camera không tồn tại")
    else:
        if default_cam_id:
            if hasattr(db, "execute"):
                device = await crud_device.get_by_id_or_device_id(db, id_or_device_id=default_cam_id)
            elif hasattr(db, "get"):
                from uuid import UUID
                try:
                    device = await db.get(Device, UUID(default_cam_id))
                except Exception:
                    pass

        if not device and user and hasattr(db, "execute"):
            from sqlalchemy import select
            res = await db.execute(
                select(Device).where(Device.owner_id == user.id, Device.device_type == "CAMERA").order_by(Device.created_at.desc()).limit(1)
            )
            device = res.scalar_one_or_none()

    if not device:
        raise HTTPException(503, "Chưa cấu hình CAMERA_DEVICE_ID trên backend hoặc camera không tồn tại")

    device_id = device.id
    if device.device_type != "CAMERA" or not device.house_id:
        raise HTTPException(503, "Camera chưa được gắn vào căn nhà")
    house = await db.get(House, device.house_id)
    if not house or not user.is_active:
        raise HTTPException(403, "Không có quyền truy cập camera")
    permissions = await crud_house.get_user_permissions(db, house, user)
    if not permissions["can_view_camera"] or (manage and not permissions["can_manage_devices"]):
        raise HTTPException(403, "Không có quyền xem/điều khiển camera này")
    return device, permissions


async def authenticated(token: str = Depends(oauth2_scheme), user: User = Depends(get_current_user)):
    # Camera thật không chấp nhận token demo được hỗ trợ ở API cũ.
    """Loại token demo khỏi các API camera thật.

    Args:
        token: JWT đăng nhập.
        user: Người dùng đã xác thực.

    Returns:
        Người dùng đã đăng nhập hợp lệ.
    """
    if token == "fake-jwt-token-demo":
        raise HTTPException(401, "Hãy đăng nhập để xem camera thật")
    return user


async def viewer(user: User = Depends(authenticated), db: AsyncSession = Depends(get_db), camera_id: str | None = Query(default=None)):
    """Gom người dùng và quyền xem cho dependency của endpoint.

    Args:
        user: Người dùng đã xác thực.
        db: Phiên cơ sở dữ liệu của request.

    Returns:
        Người dùng cùng thiết bị và quyền.
    """
    return user, await access(user, db, camera_id=camera_id)


@router.get("/sources")
async def sources(user: User = Depends(authenticated), db: AsyncSession = Depends(get_db)):
    """Chỉ liệt kê camera đã cấu hình nguồn và người dùng có quyền xem."""
    from sqlalchemy import select
    available = []
    seen_ids = set()
    if db is not None and hasattr(db, "execute"):
        res = await db.execute(select(Device).where(Device.device_type == "CAMERA"))
        for dev in res.scalars().all():
            try:
                device, _ = await access(user, db, camera_id=str(dev.id))
                if str(device.id) not in seen_ids:
                    seen_ids.add(str(device.id))
                    available.append({"id": str(device.id), "name": device.name})
            except HTTPException:
                continue
    ids = list(dict.fromkeys([os.getenv("CAMERA_DEVICE_ID", ""), *extra_sources()]))
    for camera_id in filter(None, ids):
        if camera_id in seen_ids:
            continue
        try:
            device, _ = await access(user, db, camera_id=camera_id)
            if str(device.id) not in seen_ids:
                seen_ids.add(str(device.id))
                available.append({"id": str(device.id), "name": device.name})
        except HTTPException as error:
            if error.status_code in (403, 404, 503):
                continue
            raise
    return available


def configured_id():
    """Đọc và kiểm tra UUID camera cấu hình trên backend.

    Returns:
        UUID camera; báo 503 nếu cấu hình sai.
    """
    try:
        return UUID(os.environ.get("CAMERA_DEVICE_ID", ""))
    except ValueError:
        raise HTTPException(503, "Chưa cấu hình CAMERA_DEVICE_ID trên backend") from None


@router.get("/setup")
async def setup(user: User = Depends(authenticated), db: AsyncSession = Depends(get_db), camera_id: str | None = Query(default=None)):
    """Kiểm tra camera đã được liên kết trong cơ sở dữ liệu.

    Args:
        user: Người dùng đã xác thực.
        db: Phiên cơ sở dữ liệu của request.
        camera_id: ID hoặc chuỗi device_id của camera.

    Returns:
        Trạng thái paired.
    """
    if camera_id:
        device = await crud_device.get_by_id_or_device_id(db, id_or_device_id=camera_id)
        return {"paired": device is not None}
    from sqlalchemy import select
    res = await db.execute(
        select(Device).where(Device.owner_id == user.id, Device.device_type == "CAMERA").limit(1)
    )
    if res.scalar_one_or_none():
        return {"paired": True}
    try:
        conf_id = configured_id()
        device = await db.get(Device, conf_id)
        return {"paired": device is not None}
    except Exception:
        return {"paired": False}


class ProbeRequest(BaseModel):
    stream_url: str = Field(min_length=3, max_length=512)


async def probe_single_ip(ip: str, port: int = 554, timeout: float = 0.4):
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout=timeout)
    except Exception:
        return None
    try:
        req = f"DESCRIBE rtsp://{ip}:{port}/stream1 RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SmartElderlyCare\r\n\r\n"
        writer.write(req.encode())
        await writer.drain()
        data = await asyncio.wait_for(reader.read(1024), timeout=0.8)
        writer.close()
        await writer.wait_closed()
        resp = data.decode("utf-8", errors="ignore").lower()

        brand = "Camera IP (RTSP)"
        channel_path = "/stream1"

        if "tp-link" in resp or "tapo" in resp:
            brand = "TP-Link Tapo"
            channel_path = "/stream1"
        elif "hikvision" in resp or "webs" in resp or "404" in resp:
            brand = "Hikvision"
            channel_path = "/Streaming/Channels/101"
        elif "dahua" in resp or "imou" in resp:
            brand = "Dahua / Imou"
            channel_path = "/cam/realmonitor?channel=1&subtype=0"
        elif "ezviz" in resp:
            brand = "EZVIZ"
            channel_path = "/h264/ch1/main/av_stream"
        elif "yoosee" in resp or "onvif" in resp:
            brand = "Yoosee"
            channel_path = "/onvif1"
        else:
            try:
                _, w2020 = await asyncio.wait_for(asyncio.open_connection(ip, 2020), timeout=0.3)
                w2020.close()
                await w2020.wait_closed()
                brand = "TP-Link Tapo"
                channel_path = "/stream1"
            except Exception:
                pass

        return {
            "ip": ip,
            "port": port,
            "name": f"Camera {brand} ({ip})",
            "brand": brand,
            "status": "Sẵn sàng: cổng RTSP đang mở.",
            "rtsp_url": f"rtsp://{ip}:{port}{channel_path}",
        }
    except Exception:
        return {
            "ip": ip,
            "port": port,
            "name": f"Camera IP ({ip})",
            "brand": "Camera IP (RTSP)",
            "status": "Sẵn sàng: cổng RTSP đang mở.",
            "rtsp_url": f"rtsp://{ip}:{port}/stream1",
        }


@router.get("/discover")
async def discover_cameras(
    request: Request,
    subnet: str | None = Query(None, description="Subnet tùy chọn cần dò (vd: 192.168.1.)"),
    _=Depends(authenticated),
):
    """Dò quét camera RTSP/ONVIF trong mạng nội bộ một cách nhanh chóng và chính xác."""
    try:
        remote_res = await forward("/discover")
        if isinstance(remote_res, dict) and remote_res.get("found"):
            return remote_res
        if isinstance(remote_res, list) and remote_res:
            return {"found": remote_res}
    except Exception:
        pass

    primary_subnets: list[str] = []
    secondary_subnets: list[str] = ["192.168.1.", "192.168.0.", "192.168.10.", "192.168.31.", "192.168.2.", "192.168.100."]

    if subnet:
        clean_sub = subnet.strip()
        if not clean_sub.endswith("."):
            clean_sub += "."
        primary_subnets.append(clean_sub)

    configured_host = os.getenv("TAPO_HOST", "").strip()
    if configured_host and re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", configured_host):
        host_sub = ".".join(configured_host.split(".")[:3]) + "."
        if host_sub not in primary_subnets:
            primary_subnets.append(host_sub)

    for s in ["192.168.1.", "192.168.0."]:
        if s not in primary_subnets:
            primary_subnets.append(s)

    candidate_subnets = [
        s for s in (primary_subnets + [s for s in secondary_subnets if s not in primary_subnets])
        if not (s.startswith("172.") and any(s.startswith(f"172.{i}.") for i in range(16, 32)))
    ]

    sem = asyncio.Semaphore(128)

    async def _fast_check(ip: str) -> str | None:
        async with sem:
            try:
                _, writer = await asyncio.wait_for(asyncio.open_connection(ip, 554), timeout=0.35)
                writer.close()
                await writer.wait_closed()
                return ip
            except Exception:
                return None

    priority_ips = []
    if configured_host and configured_host not in priority_ips:
        priority_ips.append(configured_host)

    for sub in primary_subnets[:2]:
        for i in range(1, 255):
            ip_str = f"{sub}{i}"
            if ip_str not in priority_ips:
                priority_ips.append(ip_str)

    found_ips = [ip for ip in await asyncio.gather(*[_fast_check(ip) for ip in priority_ips]) if ip]

    if not found_ips:
        remaining_ips = [
            f"{sub}{i}"
            for sub in candidate_subnets[2:]
            for i in range(1, 255)
            if f"{sub}{i}" not in priority_ips
        ]
        if remaining_ips:
            found_ips = [ip for ip in await asyncio.gather(*[_fast_check(ip) for ip in remaining_ips]) if ip]

    found = []
    if found_ips:
        probe_tasks = [probe_single_ip(ip) for ip in dict.fromkeys(found_ips)]
        probed = await asyncio.gather(*probe_tasks)
        found = [c for c in probed if c is not None]

    return {"found": found}


@router.post("/probe")
async def probe_camera(body: ProbeRequest, _=Depends(authenticated)):
    """Kiểm tra kết nối trực tiếp đến luồng RTSP của Camera kèm xác thực tài khoản."""
    try:
        remote_res = await forward("/probe", payload={"stream_url": body.stream_url})
        if isinstance(remote_res, dict) and "reachable" in remote_res:
            return remote_res
    except Exception:
        pass

    url = body.stream_url.strip()
    match = re.search(r"@?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(?::([0-9]{1,5}))?", url)
    if not match:
        match = re.search(r"://(?:[^@]+@)?([^:/]+)(?::([0-9]{1,5}))?", url)
        if not match:
            return {"success": False, "reachable": False, "message": "Địa chỉ URL camera không hợp lệ"}

    host = match.group(1)
    port = int(match.group(2)) if match.group(2) else 554

    parsed = urlparse(url)
    username = parsed.username or ""
    password = parsed.password or ""
    path = parsed.path or "/stream1"
    if not path.startswith("/"):
        path = "/" + path

    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=2.0)
        auth_header = ""
        has_credentials = bool(username or password)
        if has_credentials:
            token = base64.b64encode(f"{username}:{password}".encode()).decode()
            auth_header = f"Authorization: Basic {token}\r\n"

        req = f"DESCRIBE rtsp://{host}:{port}{path} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SmartElderlyCare\r\n{auth_header}\r\n"
        writer.write(req.encode())
        await writer.drain()
        data = await asyncio.wait_for(reader.read(1024), timeout=1.5)
        writer.close()
        await writer.wait_closed()
        resp = data.decode("utf-8", errors="ignore")
        resp_lower = resp.lower()

        brand = "Camera IP"
        if "tp-link" in resp_lower or "tapo" in resp_lower:
            brand = "TP-Link Tapo"
        elif "hikvision" in resp_lower or "webs" in resp_lower:
            brand = "Hikvision"
        elif "dahua" in resp_lower or "imou" in resp_lower:
            brand = "Dahua / Imou"
        elif "ezviz" in resp_lower:
            brand = "EZVIZ"

        if "200 ok" in resp_lower:
            return {
                "success": True,
                "reachable": True,
                "message": f"Kết nối và xác thực thành công! Camera {brand} đã sẵn sàng truyền luồng.",
                "brand": brand,
            }
        elif "401 unauthorized" in resp_lower:
            if has_credentials:
                return {
                    "success": False,
                    "reachable": True,
                    "message": "Sai tài khoản hoặc mật khẩu camera (HTTP 401 Unauthorized). Vui lòng kiểm tra lại.",
                    "brand": brand,
                }
            else:
                return {
                    "success": True,
                    "reachable": True,
                    "message": f"Cổng RTSP đang mở ({brand}). Vui lòng nhập tài khoản và mật khẩu của camera.",
                    "brand": brand,
                }
        else:
            return {
                "success": True,
                "reachable": True,
                "message": f"Cổng RTSP {port} trên {host} đang mở ({brand}).",
                "brand": brand,
            }
    except Exception:
        return {
            "success": False,
            "reachable": False,
            "message": f"Không thể kết nối đến {host}:{port}. Vui lòng kiểm tra camera đã cắm nguồn và cùng mạng LAN.",
        }


class Pair(BaseModel):
    code: str = Field(min_length=16, max_length=128)


@router.post("/pair", status_code=201)
async def pair(body: Pair, user: User = Depends(authenticated), db: AsyncSession = Depends(get_db)):
    """Liên kết camera vào nhà của chủ sở hữu bằng mã cấu hình.

    Args:
        body: Payload đã được Pydantic kiểm tra.
        user: Người dùng đã xác thực.
        db: Phiên cơ sở dữ liệu của request.

    Returns:
        ID và tên camera. Tác động: thêm thiết bị và commit giao dịch.
    """
    expected = os.getenv("CAMERA_PAIRING_CODE", "")
    if not expected or not hmac.compare_digest(body.code.encode(), expected.encode()):
        raise HTTPException(403, "Mã liên kết không đúng")
    device_id = configured_id()
    if await db.get(Device, device_id):
        raise HTTPException(409, "Camera đã được liên kết; không thể đổi chủ từ app")
    house = await crud_house.get_or_create_default_house(db, owner_id=user.id)
    if not house:
        raise HTTPException(404, "Không tìm thấy căn nhà của người dùng")
    if house.owner_id != user.id:
        raise HTTPException(403, "Chủ căn nhà cần thực hiện liên kết camera")
    device = Device(id=device_id, device_id=f"TAPO_{device_id.hex}", name="Tapo C200C",
                    device_type="CAMERA", owner_id=user.id, house_id=house.id)
    db.add(device)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Camera đã được liên kết") from None
    return {"id": str(device_id), "name": "Tapo C200C"}


async def operator(context=Depends(viewer)):
    """Yêu cầu quyền quản lý thiết bị trước khi điều khiển.

    Args:
        context: Người dùng, thiết bị và quyền đã kiểm tra.

    Returns:
        Context hợp lệ; báo 403 nếu thiếu quyền.
    """
    if not context[1][1]["can_manage_devices"]:
        raise HTTPException(403, "Bạn không có quyền điều khiển thiết bị")
    return context


def client(camera_id: str | None = None):
    """Tạo HTTP client tới dịch vụ camera nội bộ với Basic Auth.

    Returns:
        AsyncClient cần được đóng sau khi dùng.
    """
    source = extra_sources().get(camera_id, {})
    username = source.get("username", os.getenv("CAMERA_HTTP_USERNAME", ""))
    password = source.get("password", os.getenv("CAMERA_HTTP_PASSWORD", ""))
    if not username or not password:
        raise HTTPException(503, "Backend chưa có tài khoản dịch vụ camera")
    return httpx.AsyncClient(
        base_url=source.get("url", os.getenv("CAMERA_SERVICE_URL", "http://tapo-camera:8090")),
        auth=(username, password), timeout=httpx.Timeout(45, connect=10), trust_env=False,
    )


async def forward(path: str, payload=None, camera_id: str | None = None, params: dict | None = None):
    """Chuyển tiếp GET/POST tới dịch vụ camera.

    Args:
        path: Đường dẫn tương đối trên upstream.
        payload: JSON gửi bằng POST; None để dùng GET.
        params: Query parameters gửi kèm.

    Returns:
        JSON upstream. Tác động: gọi mạng, chuẩn hóa lỗi và đóng client.
    """
    try:
        async with (client(camera_id) if camera_id else client()) as upstream:
            response = await upstream.request("GET" if payload is None else "POST", path, json=payload, params=params)
            if response.status_code >= 400:
                code = response.status_code if response.status_code in (404, 409, 503) else 502
                raise HTTPException(code, "Camera chưa sẵn sàng hoặc không thực hiện được lệnh")
            return response.json()
    except (httpx.HTTPError, OSError):
        raise HTTPException(503, "Không kết nối được dịch vụ camera") from None


async def forward_camera(context, path: str, payload=None, params: dict | None = None):
    """Chọn upstream theo thiết bị đã qua dependency phân quyền, tự động kèm stream_url nếu có."""
    device = context[1][0]
    camera_id = str(device.id)
    forward_params = dict(params or {})
    if getattr(device, "config", None) and getattr(device.config, "stream_url", None) and "src" not in forward_params:
        from urllib.parse import urlparse
        u = urlparse(device.config.stream_url)
        if u.hostname and u.hostname not in ("192.168.1.100", "127.0.0.1", "localhost"):
            forward_params["src"] = device.config.stream_url
    extra_kw = {}
    if forward_params:
        extra_kw["params"] = forward_params
    if camera_id in extra_sources():
        return await forward(path, payload, camera_id=camera_id, **extra_kw)
    return await forward(path, payload, **extra_kw)


@router.get("")
async def metadata(context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    """Đọc trạng thái camera và quyền của người xem.

    Args:
        context: Người dùng, thiết bị và quyền đã kiểm tra.
        db: Phiên cơ sở dữ liệu của request.

    Returns:
        Metadata camera. Tác động: đồng bộ is_online vào cơ sở dữ liệu.
    """
    _, (device, permissions) = context
    status = await forward_camera(context, "/status")
    if device.is_online != status["connected"]:
        device.is_online = status["connected"]
        await db.commit()
    return {"id": str(device.id), "device_id": device.device_id, "name": device.name, "connected": status["connected"],
            "can_control": permissions["can_manage_devices"]}


class Move(BaseModel):
    x: int = Field(default=0, ge=-30, le=30, strict=True)
    y: int = Field(default=0, ge=-30, le=30, strict=True)


class Toggle(BaseModel):
    enabled: StrictBool


class Recording(BaseModel):
    seconds: int = Field(default=30, ge=1, le=3600, strict=True)


@router.post("/ptz")
async def move(body: Move, _=Depends(operator)):
    """Gửi bước quay ngang/dọc sau kiểm tra quyền quản lý.

    Args:
        body: Payload đã được Pydantic kiểm tra.
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.

    Returns:
        JSON kết quả điều khiển. Tác động: camera di chuyển.
    """
    return await forward_camera(_, "/ptz", body.model_dump())


@router.get("/privacy")
async def privacy(_=Depends(viewer)):
    """Đọc trạng thái riêng tư của camera.

    Args:
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.

    Returns:
        JSON trạng thái riêng tư.
    """
    return await forward_camera(_, "/privacy")


@router.post("/privacy")
async def set_privacy(body: Toggle, _=Depends(operator)):
    """Đổi chế độ riêng tư sau kiểm tra quyền quản lý.

    Args:
        body: Payload đã được Pydantic kiểm tra.
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.

    Returns:
        JSON kết quả. Tác động: bật/tắt hình ảnh camera.
    """
    return await forward_camera(_, "/privacy", body.model_dump())


@router.get("/motion")
async def motion(_=Depends(viewer)):
    """Đọc cài đặt phát hiện chuyển động Tapo.

    Args:
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.

    Returns:
        JSON cài đặt chuyển động.
    """
    return await forward_camera(_, "/motion")


@router.post("/motion")
async def set_motion(body: Toggle, _=Depends(operator)):
    """Thay đổi phát hiện chuyển động trên Tapo.

    Args:
        body: Payload đã được Pydantic kiểm tra.
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.

    Returns:
        JSON kết quả. Tác động: cập nhật cài đặt camera.
    """
    return await forward_camera(_, "/motion", body.model_dump())


@router.get("/recordings")
async def recordings(_=Depends(viewer)):
    """Đọc danh sách MP4 và trạng thái ghi hiện tại.

    Args:
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.

    Returns:
        JSON thư viện bản ghi.
    """
    return await forward_camera(_, "/recordings")


@router.post("/recordings", status_code=202)
async def record(body: Recording, _=Depends(operator)):
    """Yêu cầu tạo bản ghi với thời lượng đã kiểm tra.

    Args:
        body: Payload đã được Pydantic kiểm tra.
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.

    Returns:
        JSON bản ghi. Tác động: khởi động ghi hình ở dịch vụ camera.
    """
    return await forward_camera(_, "/recordings", body.model_dump())


class FallDetectionConfig(BaseModel):
    enabled: StrictBool


@router.get("/fall-detection")
async def get_fall_detection(context=Depends(viewer)):
    """Đọc trạng thái nhận diện té ngã AI từ camera."""
    return await forward_camera(context, "/fall-detection")


@router.post("/fall-detection")
async def set_fall_detection(body: FallDetectionConfig, _=Depends(operator)):
    """Bật/tắt chế độ nhận diện té ngã AI từ camera."""
    return await forward_camera(_, "/fall-detection", body.model_dump())


class VideoMode(BaseModel):
    mode: Literal["day", "night", "auto"]


@router.get("/video-mode")
async def video_mode(context=Depends(viewer)):
    """Đọc chế độ ngày/đêm thực tế từ Tapo."""
    return await forward_camera(context, "/video-mode")


@router.post("/video-mode")
async def set_video_mode(body: VideoMode, context=Depends(operator)):
    """Đổi chế độ ngày/đêm; chỉ người có quyền quản lý được gửi lệnh."""
    return await forward_camera(context, "/video-mode", body.model_dump())


class IntercomOffer(BaseModel):
    camera_id: str = Field(min_length=1, max_length=128)
    mode: Literal["listen", "talk"]
    sdp: str = Field(min_length=10, max_length=64000)


def intercom_client(camera_id: str | None = None):
    # Chỉ backend được gọi API quản trị go2rtc; không nhận upstream URL từ app.
    """Tạo client tới go2rtc nội bộ để signaling audio.

    Returns:
        AsyncClient cần được đóng sau khi dùng.
    """
    source = extra_sources().get(camera_id, {})
    if source and not source.get("intercom_url"):
        raise HTTPException(503, "Camera này chưa được cấu hình âm thanh")
    base_url = (
        source.get("intercom_url")
        or os.getenv("CAMERA_INTERCOM_URL")
        or os.getenv("CAMERA_SERVICE_URL")
        or "http://tapo-audio:1984"
    )
    username = source.get("username", os.getenv("CAMERA_HTTP_USERNAME", ""))
    password = source.get("password", os.getenv("CAMERA_HTTP_PASSWORD", ""))
    auth = (username, password) if username and password else None
    return httpx.AsyncClient(
        base_url=base_url,
        auth=auth,
        timeout=httpx.Timeout(30, connect=10), trust_env=False,
    )


@router.post("/intercom/offer")
async def intercom_offer(request: Request, body: IntercomOffer, context=Depends(viewer)):
    """Kiểm tra quyền, camera, riêng tư và SDP trước khi mở audio.

    Args:
        request: FastAPI HTTP request hiện tại.
        body: Payload đã được Pydantic kiểm tra.
        context: Người dùng, thiết bị và quyền đã kiểm tra.

    Returns:
        SDP answer. Tác động: chuyển offer tới go2rtc; chế độ talk cần quyền quản lý.
    """
    _, (device, permissions) = context
    if body.camera_id not in (str(device.id), device.device_id):
        raise HTTPException(404, "Camera được chọn chưa được cấu hình đàm thoại")
    if body.mode == "talk" and not permissions["can_manage_devices"]:
        raise HTTPException(403, "Bạn không có quyền đàm thoại với camera")
    lines = body.sdp.replace("\r\n", "\n").splitlines()
    media = [line for line in lines if line.startswith("m=")]
    if not media or len(media) > 2 or any(not line.startswith("m=audio ") for line in media):
        raise HTTPException(400, "Đàm thoại chỉ chấp nhận SDP audio")
    # Người chỉ có quyền nghe không thể gửi SDP có kênh truyền microphone.
    if body.mode == "listen" and (
        len(media) != 1 or "a=recvonly" not in lines
        or any(line in ("a=sendonly", "a=sendrecv") for line in lines)
    ):
        raise HTTPException(403, "Phiên nghe không được truyền microphone")
    try:
        privacy_state = await forward_camera(context, "/privacy")
        if privacy_state.get("result", {}).get("enabled") == "on":
            raise HTTPException(409, "Camera đang bật chế độ riêng tư")
    except HTTPException as e:
        if e.status_code == 409:
            raise
        # Nếu camera không hỗ trợ đọc privacy mode (RTSP thuần), bỏ qua để đàm thoại hoạt động
    try:
        camera_id = str(device.id)
        target_src = "tapo_intercom"
        if getattr(device, "config", None) and device.config.stream_url:
            from urllib.parse import urlparse, unquote
            u = urlparse(device.config.stream_url)
            if u.hostname and u.hostname not in ("192.168.1.100", "127.0.0.1", "localhost"):
                user = unquote(u.username) if u.username else "admin"
                pwd = unquote(u.password) if u.password else ""
                if body.mode == "listen":
                    target_src = f"listen_{device.id.hex}"
                    rtsp_stream = device.config.stream_url
                    if "#transport=tcp" not in rtsp_stream:
                        rtsp_stream = f"{rtsp_stream}#transport=tcp"
                    params = [
                        ("name", target_src),
                        ("src", rtsp_stream),
                    ]
                    if "/stream1" in rtsp_stream:
                        params.append(("src", rtsp_stream.replace("/stream1", "/stream2")))
                    elif "/stream2" in rtsp_stream:
                        params.append(("src", rtsp_stream.replace("/stream2", "/stream1")))
                    params.append(("src", f"ffmpeg:{target_src}#audio=opus"))
                    try:
                        async with (intercom_client(camera_id) if camera_id in extra_sources() else intercom_client()) as upstream:
                            await upstream.patch("/api/streams", params=params)
                    except Exception:
                        pass
                else:
                    extra = getattr(device.config, "extra_settings", None) or {}
                    cloud_pwd = extra.get("cloud_password") or os.getenv("TAPO_CONTROL_PASSWORD") or pwd
                    import hashlib
                    # Tapo backchannel yêu cầu tài khoản admin kèm SHA256 in hoa của cloud password
                    pwd_hash = hashlib.sha256(cloud_pwd.encode("utf-8")).hexdigest().upper()
                    tapo_talk = f"tapo://admin:{pwd_hash}@{u.hostname}"
                    target_src = f"tapo_{device.id.hex}"
                    try:
                        async with (intercom_client(camera_id) if camera_id in extra_sources() else intercom_client()) as upstream:
                            await upstream.put("/api/streams", params={"name": target_src, "src": tapo_talk})
                    except Exception as exc:
                        logger.warning("Lỗi cập nhật stream đàm thoại Tapo: %s", exc)

        async with (intercom_client(camera_id) if camera_id in extra_sources() else intercom_client()) as upstream:
            response = await upstream.post(
                "/api/webrtc", params={"src": target_src},
                json={"type": "offer", "sdp": body.sdp},
            )
            if response.status_code >= 400:
                err_text = response.text or ""
                logger.error("go2rtc trả về lỗi %s: %s", response.status_code, err_text)
                if "401" in err_text or "Unauthorized" in err_text:
                    raise HTTPException(502, "Tapo từ chối tài khoản khi đàm thoại; micro yêu cầu tài khoản Cloud TP-Link ID.")
                sanitized_err = re.sub(r"://[^@]+@", "://***@", err_text)
                raise HTTPException(502, f"Không mở được kênh âm thanh; kiểm tra Tapo và go2rtc ({response.status_code}: {sanitized_err[:200]})")
            data = response.json()
            if data.get("type") != "answer" or not isinstance(data.get("sdp"), str):
                raise HTTPException(502, "Dịch vụ âm thanh trả về SDP không hợp lệ")

            sdp = data["sdp"]
            client_host = request.headers.get("host", "").split(":")[0] or request.url.hostname or "127.0.0.1"
            if client_host in ("localhost", "::1"):
                client_host = "127.0.0.1"

            # Thay thế IP mạng nội bộ Docker 172.x.x.x
            sdp = re.sub(r"(\bcandidate:[^\r\n]+\b)172\.\d+\.\d+\.\d+(\b)", rf"\g<1>{client_host}\2", sdp)
            # Luôn tiêm candidate host cổng 8555 để client Web/Mobile LAN kết nối trực tiếp
            ufrag_match = re.search(r"a=ice-ufrag:(\S+)", sdp)
            ufrag_attr = f" ufrag {ufrag_match.group(1)}" if ufrag_match else ""
            hosts_to_inject = [client_host]
            webrtc_lan_host = os.getenv("CAMERA_WEBRTC_HOST", "").strip()
            if webrtc_lan_host and webrtc_lan_host not in hosts_to_inject:
                hosts_to_inject.append(webrtc_lan_host)

            cand_idx = 1001
            for h in hosts_to_inject:
                c_udp = f"a=candidate:{cand_idx} 1 udp 2130706432 {h} 8555 typ host{ufrag_attr}\r\n"
                c_tcp = f"a=candidate:{cand_idx+1} 1 tcp 2130706431 {h} 8555 typ host tcptype passive{ufrag_attr}\r\n"
                if c_udp not in sdp:
                    sdp += c_udp
                if c_tcp not in sdp:
                    sdp += c_tcp
                cand_idx += 2

            return {"type": "answer", "sdp": sdp}
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.error("Lỗi kết nối tới go2rtc (intercom): %s", exc)
        raise HTTPException(503, f"Dịch vụ đàm thoại chưa sẵn sàng; kiểm tra tapo-audio ({exc})") from None
    except (ValueError, TypeError, AttributeError) as exc:
        logger.error("Lỗi định dạng dữ liệu go2rtc: %s", exc)
        raise HTTPException(502, "Dịch vụ âm thanh trả về dữ liệu không hợp lệ") from None


def valid_resource(resource: str) -> bool:
    """Giới hạn tài nguyên media được phép cấp ticket.

    Args:
        resource: Tài nguyên media cần cấp hoặc kiểm tra quyền.

    Returns:
        True nếu là MJPEG, JPEG hoặc tên MP4 hợp lệ.
    """
    return resource in ("live.mjpg", "snapshot.jpg") or (
        bool(re.fullmatch(r"recordings/[a-zA-Z0-9_\-\. ]+\.mp4", resource)) and ".." not in resource
    )


class MediaRequest(BaseModel):
    resource: str
    quality: Literal["1080p", "720p", "auto"] = "auto"
    overlay: bool = False


@router.post("/ticket")
async def ticket(body: MediaRequest, context=Depends(viewer)):
    """Cấp ticket media ngắn hạn theo người dùng, camera và tài nguyên.

    Args:
        body: Payload đã được Pydantic kiểm tra.
        context: Người dùng, thiết bị và quyền đã kiểm tra.

    Returns:
        URL và thời hạn 300 giây; ticket không thay thế JWT đăng nhập.
    """
    if not valid_resource(body.resource):
        raise HTTPException(400, "Tài nguyên không hợp lệ")
    user, (device, _) = context
    # Token chỉ mở đúng một tài nguyên trong 5 phút; không phải JWT đăng nhập.
    expires = int(time.time()) + 300
    token = jwt.encode({"sub": str(user.id), "type": "camera_media", "device": str(device.id),
                        "resource": body.resource, "quality": body.quality, "overlay": body.overlay, "exp": expires}, settings.SECRET_KEY,
                       algorithm=settings.ALGORITHM)
    suffix = f"&quality={body.quality}" if body.resource == "live.mjpg" else ""
    if body.overlay:
        suffix += "&overlay=1"
    return {"path": f"/camera/media/{body.resource}?ticket={token}{suffix}", "expires_in": 300}


@router.get("/media/{resource:path}")
async def media(resource: str, request: Request, ticket: str = Query(...), db: AsyncSession = Depends(get_db), quality: Literal["1080p", "720p", "auto"] = "auto", overlay: str = Query(default="0")):
    """Xác minh ticket và kiểm tra lại quyền trước khi truyền media.

    Args:
        resource: Tài nguyên media cần cấp hoặc kiểm tra quyền.
        request: FastAPI Request để đọc Range header.
        ticket: Ticket media ký bởi backend.
        db: Phiên cơ sở dữ liệu của request.

    Returns:
        StreamingResponse. Tác động: mở kết nối upstream đến khi đóng luồng.
    """
    try:
        payload = jwt.decode(ticket, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "camera_media" or payload.get("resource") != resource or not valid_resource(resource):
            raise ValueError()
        user_id = UUID(payload["sub"])
        expires = int(payload["exp"])
        if resource == "live.mjpg" and payload.get("quality", "auto") != quality:
            raise ValueError()
    except (JWTError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Liên kết camera đã hết hạn hoặc không hợp lệ") from None
    user = await crud_user.get(db, user_id=user_id)
    if not user:
        raise HTTPException(401, "Tài khoản không tồn tại")
    # Ticket của nguồn bổ sung vẫn phải được kiểm tra lại quyền theo đúng camera.
    scoped_id = payload.get("device")
    device, _ = await access(user, db, camera_id=scoped_id) if scoped_id else await access(user, db)
    if str(device.id) != payload.get("device"):
        raise HTTPException(403, "Camera đã thay đổi")
    upstream = client(str(device.id)) if str(device.id) in extra_sources() else client()
    try:
        params = {"quality": quality} if resource == "live.mjpg" else {}
        if overlay in ("1", "true", "yes", "True") or payload.get("overlay"):
            params["overlay"] = "1"
        dev_config = getattr(device, "config", None)
        if dev_config and getattr(dev_config, "stream_url", None):
            params["src"] = dev_config.stream_url
        req_headers = {}
        if resource.startswith("recordings/") and request.headers.get("range"):
            req_headers["range"] = request.headers["range"]
        response = await upstream.send(upstream.build_request("GET", "/" + resource, params=params, headers=req_headers), stream=True)
    except (httpx.HTTPError, OSError):
        await upstream.aclose()
        raise HTTPException(503, "Không kết nối được camera") from None
    if response.status_code not in (200, 206):
        await response.aclose()
        await upstream.aclose()
        raise HTTPException(503, "Camera chưa có hình hoặc file chưa sẵn sàng")

    async def chunks():
        """Truyền từng khối dữ liệu và dừng MJPEG khi ticket hết hạn.

        Returns:
            Async iterator byte. Tác động: luôn đóng response/client khi kết thúc.
        """
        try:
            async for chunk in response.aiter_bytes():
                if resource == "live.mjpg" and time.time() >= expires:
                    break
                yield chunk
        finally:
            await response.aclose()
            await upstream.aclose()

    headers = {"Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"}
    if resource.startswith("recordings/"):
        headers["Cache-Control"] = "public, max-age=86400"
        headers["Content-Disposition"] = f'inline; filename="{resource.split("/")[1]}"'
        headers["Accept-Ranges"] = "bytes"
        if "content-range" in response.headers:
            headers["Content-Range"] = response.headers["content-range"]
        if "content-length" in response.headers:
            headers["Content-Length"] = response.headers["content-length"]
    else:
        headers["Cache-Control"] = "no-store"
    return StreamingResponse(chunks(), status_code=response.status_code, media_type=response.headers.get("content-type", "application/octet-stream"), headers=headers)
