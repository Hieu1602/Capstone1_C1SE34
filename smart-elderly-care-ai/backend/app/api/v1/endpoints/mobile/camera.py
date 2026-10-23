"""Proxy camera cố định; không nhận URL upstream/credential từ điện thoại."""
import os
import hmac
import re
import time
from uuid import UUID

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
from app.crud.crud_house import crud_house
from app.crud.crud_user import crud_user
from app.models.device import Device
from app.models.house import House
from app.models.user import User

router = APIRouter()


async def access(user: User, db: AsyncSession, manage: bool = False):
    try:
        device_id = UUID(os.environ.get("CAMERA_DEVICE_ID", ""))
    except ValueError:
        raise HTTPException(503, "Chưa cấu hình CAMERA_DEVICE_ID trên backend") from None
    device = await db.get(Device, device_id)
    if not device or device.device_type != "CAMERA" or not device.house_id:
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
    if token == "fake-jwt-token-demo":
        raise HTTPException(401, "Hãy đăng nhập để xem camera thật")
    return user


async def viewer(user: User = Depends(authenticated), db: AsyncSession = Depends(get_db)):
    return user, await access(user, db)


def configured_id():
    try:
        return UUID(os.environ.get("CAMERA_DEVICE_ID", ""))
    except ValueError:
        raise HTTPException(503, "Chưa cấu hình CAMERA_DEVICE_ID trên backend") from None


@router.get("/setup")
async def setup(_=Depends(authenticated), db: AsyncSession = Depends(get_db)):
    return {"paired": await db.get(Device, configured_id()) is not None}


class Pair(BaseModel):
    code: str = Field(min_length=16, max_length=128)


@router.post("/pair", status_code=201)
async def pair(body: Pair, user: User = Depends(authenticated), db: AsyncSession = Depends(get_db)):
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
    if not context[1][1]["can_manage_devices"]:
        raise HTTPException(403, "Bạn không có quyền điều khiển thiết bị")
    return context


def client():
    username = os.getenv("CAMERA_HTTP_USERNAME", "")
    password = os.getenv("CAMERA_HTTP_PASSWORD", "")
    if not username or not password:
        raise HTTPException(503, "Backend chưa có tài khoản dịch vụ camera")
    return httpx.AsyncClient(
        base_url=os.getenv("CAMERA_SERVICE_URL", "http://tapo-camera:8090"),
        auth=(username, password), timeout=httpx.Timeout(20, connect=5), trust_env=False,
    )


async def forward(path: str, payload=None):
    try:
        async with client() as upstream:
            response = await upstream.request("GET" if payload is None else "POST", path, json=payload)
            if response.status_code >= 400:
                code = response.status_code if response.status_code in (404, 409, 503) else 502
                raise HTTPException(code, "Camera chưa sẵn sàng hoặc không thực hiện được lệnh")
            return response.json()
    except httpx.HTTPError:
        raise HTTPException(503, "Không kết nối được dịch vụ camera") from None


@router.get("")
async def metadata(context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    _, (device, permissions) = context
    status = await forward("/status")
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
    return await forward("/ptz", body.model_dump())


@router.get("/privacy")
async def privacy(_=Depends(viewer)):
    return await forward("/privacy")


@router.post("/privacy")
async def set_privacy(body: Toggle, _=Depends(operator)):
    return await forward("/privacy", body.model_dump())


@router.get("/motion")
async def motion(_=Depends(viewer)):
    return await forward("/motion")


@router.post("/motion")
async def set_motion(body: Toggle, _=Depends(operator)):
    return await forward("/motion", body.model_dump())


@router.get("/recordings")
async def recordings(_=Depends(viewer)):
    return await forward("/recordings")


@router.post("/recordings", status_code=202)
async def record(body: Recording, _=Depends(operator)):
    return await forward("/recordings", body.model_dump())


def valid_resource(resource: str) -> bool:
    return resource in ("live.mjpg", "snapshot.jpg") or bool(re.fullmatch(r"recordings/[0-9a-f]{32}\.mp4", resource))


class MediaRequest(BaseModel):
    resource: str


@router.post("/ticket")
async def ticket(body: MediaRequest, context=Depends(viewer)):
    if not valid_resource(body.resource):
        raise HTTPException(400, "Tài nguyên không hợp lệ")
    user, (device, _) = context
    # Token chỉ mở đúng một tài nguyên trong 5 phút; không phải JWT đăng nhập.
    expires = int(time.time()) + 300
    token = jwt.encode({"sub": str(user.id), "type": "camera_media", "device": str(device.id),
                        "resource": body.resource, "exp": expires}, settings.SECRET_KEY,
                       algorithm=settings.ALGORITHM)
    return {"path": f"/camera/media/{body.resource}?ticket={token}", "expires_in": 300}


@router.get("/media/{resource:path}")
async def media(resource: str, ticket: str = Query(...), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(ticket, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "camera_media" or payload.get("resource") != resource or not valid_resource(resource):
            raise ValueError()
        user_id = UUID(payload["sub"])
        expires = int(payload["exp"])
    except (JWTError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Liên kết camera đã hết hạn hoặc không hợp lệ") from None
    user = await crud_user.get(db, user_id=user_id)
    if not user:
        raise HTTPException(401, "Tài khoản không tồn tại")
    device, _ = await access(user, db)
    if str(device.id) != payload.get("device"):
        raise HTTPException(403, "Camera đã thay đổi")
    upstream = client()
    try:
        response = await upstream.send(upstream.build_request("GET", "/" + resource), stream=True)
    except httpx.HTTPError:
        await upstream.aclose()
        raise HTTPException(503, "Không kết nối được camera") from None
    if response.status_code != 200:
        await response.aclose()
        await upstream.aclose()
        raise HTTPException(503, "Camera chưa có hình hoặc file chưa sẵn sàng")

    async def chunks():
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
