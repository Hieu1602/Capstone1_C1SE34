package com.c1se34.smartelderlycare

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Receiver lắng nghe khi người dùng:
 * 1. Vuốt xóa thông báo cảnh báo từ thanh trạng thái Android (ACTION_DISMISS_ALARM).
 * 2. Bấm nút hành động "ĐÃ XỬ LÝ (TẮT CHUÔNG)" trực tiếp trên thanh thông báo (ACTION_ACKNOWLEDGE_ALARM).
 * 
 * Hành vi:
 * - Dừng ngay lập tức âm thanh chuông báo động và ngắt rung phần cứng (0ms).
 * - Xóa sạch thông báo cảnh báo khẩn cấp khỏi thanh thông báo hệ thống.
 * - Gửi yêu cầu xác nhận đã xử lý lên máy chủ backend nếu có incidentId.
 */
class AlarmDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: ""
        Log.d("AlarmDismissReceiver", "Nhận sự kiện: $action -> Tắt ngay lập tức chuông báo và ngắt rung.")

        // 1. Tắt chuông báo động và ngắt rung liên tục ngay lập tức (0ms)
        NativeNotificationModule.stopAlarm(context)

        // 2. Nếu người dùng bấm trực tiếp nút "ĐÃ XỬ LÝ (TẮT CHUÔNG)" trên thanh thông báo
        val incidentId = intent?.getStringExtra("INCIDENT_ID")
        if (action == "com.c1se34.smartelderlycare.ACTION_ACKNOWLEDGE_ALARM" && !incidentId.isNullOrBlank()) {
            thread(name = "AlarmDismiss-Ack-Thread", isDaemon = true) {
                try {
                    val serverBaseUrl = "http://16.178.128.42:8000/api/v1"
                    val url = URL("$serverBaseUrl/incidents/$incidentId/acknowledge")
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 3500
                        readTimeout = 3500
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("Accept", "application/json")
                    }
                    val jsonPayload = """{"note":"Đã xử lý và tắt chuông trực tiếp từ thanh thông báo điện thoại","operator_name":"Người nhà"}"""
                    conn.outputStream.use { os ->
                        os.write(jsonPayload.toByteArray(Charsets.UTF_8))
                    }
                    val code = conn.responseCode
                    Log.d("AlarmDismissReceiver", "Đã đánh dấu xử lý sự cố $incidentId lên server thành công (HTTP $code)")
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.w("AlarmDismissReceiver", "Không thể gửi acknowledge tới server: ${e.message}")
                }
            }
        }
    }
}
