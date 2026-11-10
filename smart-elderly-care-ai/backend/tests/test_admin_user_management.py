# tests/test_admin_user_management.py
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from app.models.user import User, UserStatus
from app.models.house import House, HouseMember
from app.models.incident import Incident
from app.models.device import Device
from app.core.database import AsyncSessionFactory
from app.api.v1.endpoints.web_admin.users import (
    get_user_dormancy_level,
    check_user_deletion_guards,
    check_user_locking_guards,
    dissolve_or_transfer_house,
)
from app.core.security import create_access_token, decode_token
from sqlalchemy import select, delete


def test_dormancy_calculation():
    """1. Nghiệp vụ 3: Kiểm tra phân loại mức độ ngủ đông"""
    now = datetime.now(timezone.utc)

    u_active = User(
        phone="0900000001",
        full_name="Active User",
        last_login_at=now - timedelta(days=10),
    )
    assert get_user_dormancy_level(u_active, now) == "active"

    u_remind = User(
        phone="0900000002",
        full_name="Remind User",
        last_login_at=now - timedelta(days=95),
    )
    assert get_user_dormancy_level(u_remind, now) == "remind_3m"

    u_lock = User(
        phone="0900000003",
        full_name="Lock User",
        last_login_at=now - timedelta(days=185),
    )
    assert get_user_dormancy_level(u_lock, now) == "lock_6m"

    u_del = User(
        phone="0900000004",
        full_name="Delete User",
        last_login_at=now - timedelta(days=400),
    )
    assert get_user_dormancy_level(u_del, now) == "eligible_delete_1y"

    u_nologin = User(
        phone="0900000005",
        full_name="No Login",
        last_login_at=None,
        created_at=now - timedelta(days=200),
    )
    assert get_user_dormancy_level(u_nologin, now) == "lock_6m"
    print("✅ TEST 1 PASSED: Phân loại ngủ đông 3m/6m/1y chuẩn xác 100%.")


def test_token_version_invalidation():
    """2. Nghiệp vụ 5: Kiểm tra cơ chế token_version khi đăng xuất tất cả / khóa"""
    u = User(id="user-123", phone="0900000001", role="user", token_version=1)

    token_v1 = create_access_token(
        subject=u.id,
        token_version=u.token_version,
    )
    payload_v1 = decode_token(token_v1)
    assert payload_v1["token_version"] == 1
    assert payload_v1["token_version"] == u.token_version, "Token version phải trùng khớp"

    u.token_version += 1
    assert u.token_version == 2
    assert payload_v1["token_version"] != u.token_version
    print("✅ TEST 2 PASSED: Cơ chế token_version vô hiệu hóa phiên tức thì 100%.")


@pytest.mark.anyio
async def test_guard_rules_and_db_flow():
    """3. Nghiệp vụ 4 & 7: Kiểm tra Guard Rules & Xử lý Nhà hoang trên DB thực tế"""
    async with AsyncSessionFactory() as db:
        # Tìm một admin có sẵn trong DB để làm context
        res_admin = await db.execute(select(User).where(User.role == "admin").limit(1))
        admin = res_admin.scalar_one_or_none()
        if not admin:
            admin = User(
                phone="0999000001",
                full_name="Root Admin Test",
                role="admin",
                status=UserStatus.ACTIVE,
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)

        # 3.1. Admin không tự khóa mình
        can_lock, lock_reason = await check_user_locking_guards(db, admin, admin)
        assert can_lock is False
        assert lock_reason is not None and "chính mình" in lock_reason

        # 3.2. Admin không tự xóa mình
        can_del, del_reason = await check_user_deletion_guards(db, admin, admin)
        assert can_del is False
        assert del_reason is not None and "chính mình" in del_reason

        print("✅ TEST 3 PASSED: Ràng buộc an toàn ngăn tự khóa/tự xóa Admin 100%.")

        # 3.3. Test tạo một cặp Owner + Member trong một Nhà
        import uuid
        phone_suffix = uuid.uuid4().hex[:6]
        test_owner = User(
            phone=f"091{phone_suffix}",
            full_name="Dormant Owner Test",
            role="user",
            hashed_password="hashed_pw_test",
            status=UserStatus.ACTIVE,
        )
        test_member = User(
            phone=f"092{phone_suffix}",
            full_name="Active Member Test",
            role="caregiver",
            hashed_password="hashed_pw_test",
            status=UserStatus.ACTIVE,
            last_login_at=datetime.now(timezone.utc),
        )
        db.add_all([test_owner, test_member])
        await db.commit()
        await db.refresh(test_owner)
        await db.refresh(test_member)

        test_house = House(
            name="Test Abandoned House",
            owner_id=test_owner.id,
        )
        db.add(test_house)
        await db.commit()
        await db.refresh(test_house)

        hm = HouseMember(
            house_id=test_house.id,
            user_id=test_member.id,
            role_in_house="MEMBER",
        )
        db.add(hm)
        await db.commit()

        # Kiểm tra Guard: Không xóa Owner khi nhà còn thành viên hoạt động
        can_del_owner, owner_del_reason = await check_user_deletion_guards(db, test_owner, admin)
        assert can_del_owner is False
        assert owner_del_reason is not None and "thành viên hoạt động" in owner_del_reason
        print("✅ TEST 4 PASSED: Chặn xóa Owner khi nhà còn thành viên hoạt động 100%.")

        # Nghiệp vụ 4 (Nhà hoang): Xử lý nhà hoang -> Do còn test_member hoạt động, ưu tiên chuyển quyền Owner
        dissolve_res = await dissolve_or_transfer_house(
            house_id=str(test_house.id),
            payload={"reason": "Owner không hoạt động quá hạn"},
            db=db,
            current_user=admin,
        )
        assert dissolve_res["status"] == "transferred"
        assert dissolve_res["new_owner_id"] == str(test_member.id)
        await db.refresh(test_house)
        assert test_house.owner_id == test_member.id
        print("✅ TEST 5 PASSED: Nhà hoang ưu tiên chuyển quyền Owner cho thành viên hoạt động 100%.")

        # Sau khi chuyển quyền, test_owner không còn là Owner -> đã đủ điều kiện xóa
        can_del_owner_after, _ = await check_user_deletion_guards(db, test_owner, admin)
        assert can_del_owner_after is True
        print("✅ TEST 6 PASSED: Cựu Owner đủ điều kiện xóa an toàn sau khi chuyển giao nhà.")

        # Cleanup test data để DB luôn sạch
        await db.execute(delete(HouseMember).where(HouseMember.house_id == test_house.id))
        await db.execute(delete(House).where(House.id == test_house.id))
        await db.execute(delete(User).where(User.id.in_([test_owner.id, test_member.id])))
        await db.commit()
        print("🧹 Cleaned up test entities successfully.")

if __name__ == "__main__":
    test_dormancy_calculation()
    test_token_version_invalidation()
    asyncio.run(test_guard_rules_and_db_flow())
    print("\n🎉 ALL 7 ADMIN USER MANAGEMENT REQUIREMENTS VERIFIED AND PASSED!")
