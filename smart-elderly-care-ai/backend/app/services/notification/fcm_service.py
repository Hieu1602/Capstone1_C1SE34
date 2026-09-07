"""
fcm_service.py
Firebase Cloud Messaging – Gửi push notification khẩn cấp đến Mobile App.

Sử dụng firebase-admin SDK với service account credentials.
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class FCMService:
    """
    Gửi push notification qua Firebase Cloud Messaging.

    Usage:
        fcm = FCMService()
        fcm.initialize()
        await fcm.send_alert(tokens, title, body, data)
    """

    def __init__(self):
        self._initialized = False
        self._app = None

    def initialize(self, service_account_path: str) -> None:
        """Khởi tạo Firebase Admin SDK."""
        try:
            import firebase_admin  # type: ignore
            from firebase_admin import credentials

            if not firebase_admin._apps:
                cred = credentials.Certificate(service_account_path)
                self._app = firebase_admin.initialize_app(cred)

            self._initialized = True
            logger.info("[FCM] Firebase Admin SDK initialized.")
        except ImportError:
            logger.warning("[FCM] firebase-admin chưa cài. FCM disabled.")
        except Exception as exc:  # noqa: BLE001
            logger.error("[FCM] Initialization failed: %s", exc)

    def send_alert(
        self,
        fcm_tokens: List[str],
        title: str,
        body: str,
        data: Optional[dict] = None,
        priority: str = "high",
    ) -> dict:
        """
        Gửi push notification đến danh sách FCM tokens.

        Args:
            fcm_tokens: Danh sách device FCM tokens
            title: Tiêu đề thông báo
            body: Nội dung thông báo
            data: Dữ liệu phụ gửi kèm (payload)
            priority: "high" cho alert khẩn cấp (ghi đè silent mode)

        Returns:
            Dict với success_count và failure_count
        """
        if not self._initialized:
            logger.warning("[FCM] Chưa initialized. Bỏ qua push notification.")
            return {"success_count": 0, "failure_count": len(fcm_tokens)}

        try:
            from firebase_admin import messaging  # type: ignore

            notification = messaging.Notification(title=title, body=body)

            # Android config: high priority để ghi đè silent/DND mode
            android_config = messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    title=title,
                    body=body,
                    sound="alert_siren",  # Custom sound trong app
                    channel_id="emergency_alerts",
                    priority="max",
                    visibility="PUBLIC",
                ),
            )

            # APNS config cho iOS
            apns_config = messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(title=title, body=body),
                        sound=messaging.CriticalSound(name="alert_siren.wav", critical=1, volume=1.0),
                        badge=1,
                    )
                ),
            )

            messages = [
                messaging.Message(
                    notification=notification,
                    android=android_config,
                    apns=apns_config,
                    data={k: str(v) for k, v in (data or {}).items()},
                    token=token,
                )
                for token in fcm_tokens
                if token
            ]

            if not messages:
                return {"success_count": 0, "failure_count": 0}

            response = messaging.send_each(messages)
            logger.info(
                "[FCM] Sent %d notifications. Success=%d, Failed=%d",
                len(messages),
                response.success_count,
                response.failure_count,
            )
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
            }

        except Exception as exc:  # noqa: BLE001
            logger.error("[FCM] Lỗi gửi notification: %s", exc)
            return {"success_count": 0, "failure_count": len(fcm_tokens)}
