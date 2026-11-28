import asyncio

from app.crud.crud_incident import crud_incident


def test_acknowledge_all_without_user_is_noop():
    # Không có user -> không được xác nhận hàng loạt (trước đây xác nhận mọi cảnh báo của mọi gia đình)
    assert asyncio.run(crud_incident.acknowledge_all(db=None, current_user_id=None)) == 0
