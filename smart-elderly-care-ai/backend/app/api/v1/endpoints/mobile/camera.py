"""Proxy camera cố định; không nhận URL upstream/credential từ điện thoại."""
import os
import json
import hmac
import re
import time
from uuid import UUID
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
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
    if camera_id:
        device = await crud_device.get_by_id_or_device_id(db, id_or_device_id=camera_id)

    if not device:
        default_cam_id = os.environ.get("CAMERA_DEVICE_ID", "")
        if default_cam_id:
            device = await crud_device.get_by_id_or_device_id(db, id_or_device_id=default_cam_id)

    if not device:
        raise HTTPException(503, "Chưa cấu hình CAMERA_DEVICE_ID trên backend hoặc camera không tồn tại")

    device_id = device.id
    if camera_id and str(device_id) != os.getenv("CAMERA_DEVICE_ID") and str(device_id) not in extra_sources():
        raise HTTPException(404, "Camera chưa có nguồn video được cấu hình")
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
    available = []
    ids = list(dict.fromkeys([os.getenv("CAMERA_DEVICE_ID", ""), *extra_sources()]))
    for camera_id in filter(None, ids):
        try:
            device, _ = await access(user, db, camera_id=camera_id)
        except HTTPException as error:
            if error.status_code in (403, 404, 503):
                continue
            raise
        available.append({"id": str(device.id), "name": device.name})
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
async def setup(_=Depends(authenticated), db: AsyncSession = Depends(get_db), camera_id: str | None = Query(default=None)):
    """Kiểm tra camera đã được liên kết trong cơ sở dữ liệu.

    Args:
        _: Dependency đã kiểm tra đăng nhập hoặc quyền cho endpoint.
        db: Phiên cơ sở dữ liệu của request.
        camera_id: ID hoặc chuỗi device_id của camera.

    Returns:
        Trạng thái paired.
    """
    if camera_id:
        device = await crud_device.get_by_id_or_device_id(db, id_or_device_id=camera_id)
        return {"paired": device is not None}
    try:
        conf_id = configured_id()
        device = await db.get(Device, conf_id)
        return {"paired": device is not None}
    except Exception:
        return {"paired": False}


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
        auth=(username, password), timeout=httpx.Timeout(20, connect=5), trust_env=False,
    )


async def forward(path: str, payload=None, camera_id: str | None = None):
    """Chuyển tiếp GET/POST tới dịch vụ camera cố định.

    Args:
        path: Đường dẫn tương đối trên upstream cố định.
        payload: JSON gửi bằng POST; None để dùng GET.

    Returns:
        JSON upstream. Tác động: gọi mạng, chuẩn hóa lỗi và đóng client.
    """
    try:
        async with (client(camera_id) if camera_id else client()) as upstream:
            response = await upstream.request("GET" if payload is None else "POST", path, json=payload)
            if response.status_code >= 400:
                code = response.status_code if response.status_code in (404, 409, 503) else 502
                raise HTTPException(code, "Camera chưa sẵn sàng hoặc không thực hiện được lệnh")
            return response.json()
    except httpx.HTTPError:
        raise HTTPException(503, "Không kết nối được dịch vụ camera") from None


async def forward_camera(context, path: str, payload=None):
    """Chọn upstream theo thiết bị đã qua dependency phân quyền, không theo URL từ app."""
    camera_id = str(context[1][0].id)
    if camera_id in extra_sources():
        return await forward(path, payload, camera_id=camera_id)
    return await forward(path) if payload is None else await forward(path, payload)


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
    return httpx.AsyncClient(
        base_url=source.get("intercom_url", os.getenv("CAMERA_INTERCOM_URL", "http://tapo-audio:1984")),
        timeout=httpx.Timeout(20, connect=5), trust_env=False,
    )


@router.post("/intercom/offer")
async def intercom_offer(body: IntercomOffer, context=Depends(viewer)):
    """Kiểm tra quyền, camera, riêng tư và SDP trước khi mở audio.

    Args:
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
    privacy_state = await forward_camera(context, "/privacy")
    if privacy_state.get("result", {}).get("enabled") == "on":
        raise HTTPException(409, "Camera đang bật chế độ riêng tư")
    try:
        camera_id = str(device.id)
        async with (intercom_client(camera_id) if camera_id in extra_sources() else intercom_client()) as upstream:
            response = await upstream.post(
                "/api/webrtc", params={"src": "tapo_intercom"},
                json={"type": "offer", "sdp": body.sdp},
            )
            if response.status_code >= 400:
                raise HTTPException(502, "Không mở được kênh âm thanh; kiểm tra Tapo, tài khoản cloud và go2rtc")
            data = response.json()
            if data.get("type") != "answer" or not isinstance(data.get("sdp"), str):
                raise HTTPException(502, "Dịch vụ âm thanh trả về SDP không hợp lệ")
            return {"type": "answer", "sdp": data["sdp"]}
    except httpx.HTTPError:
        raise HTTPException(503, "Dịch vụ đàm thoại chưa sẵn sàng; kiểm tra tapo-audio") from None
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(502, "Dịch vụ âm thanh trả về dữ liệu không hợp lệ") from None


def valid_resource(resource: str) -> bool:
    """Giới hạn tài nguyên media được phép cấp ticket.

    Args:
        resource: Tài nguyên media cần cấp hoặc kiểm tra quyền.

    Returns:
        True nếu là MJPEG, JPEG hoặc tên MP4 hợp lệ.
    """
    return resource in ("live.mjpg", "snapshot.jpg") or bool(re.fullmatch(r"recordings/[0-9a-f]{32}\.mp4", resource))


class MediaRequest(BaseModel):
    resource: str
    quality: Literal["1080p", "720p", "auto"] = "auto"


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
                        "resource": body.resource, "quality": body.quality, "exp": expires}, settings.SECRET_KEY,
                       algorithm=settings.ALGORITHM)
    suffix = f"&quality={body.quality}" if body.resource == "live.mjpg" else ""
    return {"path": f"/camera/media/{body.resource}?ticket={token}{suffix}", "expires_in": 300}


@router.get("/media/{resource:path}")
async def media(resource: str, ticket: str = Query(...), db: AsyncSession = Depends(get_db), quality: Literal["1080p", "720p", "auto"] = "auto"):
    """Xác minh ticket và kiểm tra lại quyền trước khi truyền media.

    Args:
        resource: Tài nguyên media cần cấp hoặc kiểm tra quyền.
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
    device, _ = await access(user, db, camera_id=scoped_id) if scoped_id in extra_sources() else await access(user, db)
    if str(device.id) != payload.get("device"):
        raise HTTPException(403, "Camera đã thay đổi")
    upstream = client(str(device.id)) if str(device.id) in extra_sources() else client()
    try:
        params = {"quality": quality} if resource == "live.mjpg" else None
        response = await upstream.send(upstream.build_request("GET", "/" + resource, params=params), stream=True)
    except httpx.HTTPError:
        await upstream.aclose()
        raise HTTPException(503, "Không kết nối được camera") from None
    if response.status_code != 200:
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

    headers = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
               "X-Content-Type-Options": "nosniff"}
    if resource.startswith("recordings/"):
        headers["Content-Disposition"] = f'attachment; filename="{resource.split("/")[1]}"'
    return StreamingResponse(chunks(), media_type=response.headers.get("content-type", "application/octet-stream"), headers=headers)
