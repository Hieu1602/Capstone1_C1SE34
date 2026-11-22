package com.c1se34.smartelderlycare

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class SmartCareBackgroundService : Service() {

    private var isRunning = false
    private var serverBaseUrl: String = "http://192.168.10.248:8000/api/v1"
    private var authToken: String? = null
    private var workerThread: Thread? = null
    private var lastNotifiedIncidentId: String? = null

    companion object {
        const val SERVICE_CHANNEL_ID = "smartcare_service_monitor_channel"
        const val SERVICE_CHANNEL_NAME = "Dịch vụ bảo vệ người cao tuổi trong nền"
        const val SERVICE_NOTIFICATION_ID = 999
        const val ALERT_CHANNEL_ID = "emergency_alerts_v5"
        const val ALERT_CHANNEL_NAME = "Cảnh báo khẩn cấp SmartCare AI"
        private const val PREFS_NAME = "smartcare_bg_prefs"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_SERVER_URL = "server_url"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val customUrl = intent?.getStringExtra("SERVER_URL")
        val token = intent?.getStringExtra("AUTH_TOKEN")
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        if (!customUrl.isNullOrBlank()) {
            serverBaseUrl = customUrl.trim().removeSuffix("/")
            prefs.edit().putString(KEY_SERVER_URL, serverBaseUrl).apply()
        } else {
            val savedUrl = prefs.getString(KEY_SERVER_URL, null)
            if (!savedUrl.isNullOrBlank()) {
                serverBaseUrl = savedUrl
            }
        }

        if (!token.isNullOrBlank()) {
            authToken = token
            prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
        } else if (authToken.isNullOrBlank()) {
            authToken = prefs.getString(KEY_AUTH_TOKEN, null)
        }

        // Chạy dưới dạng Foreground Service để duy trì trong nền ngay cả khi thoát app
        val serviceNotification = buildServiceNotification()
        startForeground(SERVICE_NOTIFICATION_ID, serviceNotification)

        if (!isRunning) {
            isRunning = true
            startMonitoringLoop()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        workerThread?.interrupt()
        workerThread = null
        super.onDestroy()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. Kênh thường trực chạy nền (yên lặng, không rung)
            val serviceChannel = NotificationChannel(
                SERVICE_CHANNEL_ID,
                SERVICE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Hệ thống SmartCare AI duy trì giám sát người cao tuổi liên tục trong nền"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(serviceChannel)

            // 2. Kênh thông báo thông thường (Lịch khám, Tin nhắn, Cập nhật bệnh án, Pin cạn -> Ting ting nhẹ nhàng)
            val normalSoundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)
            val normalAudioAttributes = android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .build()
            val normalChannel = NotificationChannel(
                NativeNotificationModule.CHANNEL_ID,
                NativeNotificationModule.CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo thông thường: lịch khám, tin nhắn, pin cạn"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200, 100, 200)
                setSound(normalSoundUri, normalAudioAttributes)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(normalChannel)

            // 3. Kênh cảnh báo khẩn cấp (rung mạnh, chuông to, nổi bật trên màn hình)
            val soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
                ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                .build()

            val alertChannel = NotificationChannel(
                NativeNotificationModule.EMERGENCY_CHANNEL_ID,
                NativeNotificationModule.EMERGENCY_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Cảnh báo sự cố té ngã, nhịp tim bất thường và nguy cấp"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 400, 1000, 400, 1000, 800)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                try {
                    setBypassDnd(true)
                } catch (_: Exception) {}
            }
            notificationManager.createNotificationChannel(alertChannel)
        }
    }

    private fun buildServiceNotification(): android.app.Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val iconRes = try {
            val id = resources.getIdentifier("ic_notification", "drawable", packageName)
            if (id != 0) id else android.R.drawable.ic_dialog_alert
        } catch (_: Exception) {
            android.R.drawable.ic_dialog_alert
        }

        return NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle("SmartCare AI đang bảo vệ người cao tuổi")
            .setContentText("Hệ thống giám sát sinh tồn & sự cố té ngã 24/7 đang hoạt động trong nền")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(false) // Cho phép người dùng vuốt xóa thông báo trên thanh trạng thái
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun startMonitoringLoop() {
        workerThread = thread(name = "SmartCare-Monitor-Thread", isDaemon = true) {
            while (isRunning) {
                try {
                    pollLatestIncidents()
                } catch (e: Exception) {
                    // Tránh crash nếu mạng tạm thời mất kết nối
                }

                try {
                    Thread.sleep(3500)
                } catch (ie: InterruptedException) {
                    break
                }
            }
        }
    }

    private fun pollLatestIncidents() {
        val token = authToken ?: getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_AUTH_TOKEN, null)
        // Không thăm dò nếu chưa đăng nhập để chống báo động chéo dữ liệu đa gia đình
        if (token.isNullOrBlank()) {
            return
        }

        val endpoint = if (serverBaseUrl.endsWith("/api/v1")) {
            "$serverBaseUrl/incidents?limit=3"
        } else {
            "$serverBaseUrl/api/v1/incidents?limit=3"
        }

        var conn: HttpURLConnection? = null
        try {
            val url = URL(endpoint)
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 4000
                readTimeout = 4000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }

            if (conn.responseCode == 401) {
                authToken = null
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().remove(KEY_AUTH_TOKEN).apply()
                return
            }

            if (conn.responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8"))
                val responseText = reader.readText()
                reader.close()

                val incidents = JSONArray(responseText)
                if (incidents.length() > 0) {
                    val latest = incidents.getJSONObject(0)
                    val id = latest.optString("id")
                    val isAck = latest.optBoolean("is_acknowledged", false)
                    val alertType = latest.optString("alert_type", "")
                    val alertLevel = latest.optString("alert_level", "HIGH")
                    val message = latest.optString("message", "Phát hiện sự cố mới")

                    val isEmergency = alertType in listOf(
                        "FALL_DETECTED",
                        "AI_FALL_DETECTED",
                        "CRITICAL_TRIAD",
                        "CARDIO_COLLAPSE",
                        "EXERTION_HYPOXIA",
                        "FEVER_TACHYCARDIA",
                        "HIGH_HEART_RATE",
                        "LOW_HEART_RATE",
                        "SUDDEN_HR_SPIKE",
                        "SUDDEN_HR_DROP",
                        "LOW_SPO2",
                        "HIGH_FEVER"
                    ) || alertLevel == "CRITICAL"

                    // Nếu sự cố đã được xử lý (trên web, app hoặc người dùng bấm Đã xử lý)
                    // -> Ngay lập tức ngắt chuông, dừng rung và xóa thông báo (0ms)
                    if (isAck) {
                        NativeNotificationModule.stopAlarm(this)
                    } else if (id != lastNotifiedIncidentId && id.isNotBlank()) {
                        lastNotifiedIncidentId = id
                        val contactPhone = latest.optString("emergency_contact_phone", "").takeIf { it.isNotBlank() }
                            ?: NativeNotificationModule.DEFAULT_EMERGENCY_PHONE
                        if (isEmergency) {
                            triggerHighPriorityAlarm(id, alertType, alertLevel, message, contactPhone)
                        } else {
                            triggerRoutineNotification(id, alertType, message)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // Lỗi mạng bình thường khi đang ngắt kết nối
        } finally {
            conn?.disconnect()
        }
    }

    private fun triggerHighPriorityAlarm(
        incidentId: String,
        alertType: String,
        alertLevel: String,
        message: String,
        emergencyPhone: String = NativeNotificationModule.DEFAULT_EMERGENCY_PHONE
    ) {
        val title = when {
            alertType == "FALL_DETECTED" -> "🚨 PHÁT HIỆN SỰ CỐ TÉ NGÃ KHẨN CẤP!"
            alertType == "CRITICAL_TRIAD" -> "🔥 BÁO ĐỘNG ĐỎ: TAM CHỨNG NGUY KỊCH!"
            alertType == "EXERTION_HYPOXIA" -> "🚨 CẢNH BÁO QUÁ TẢI TIM PHỔI & TỤT OXY!"
            alertType == "FEVER_TACHYCARDIA" -> "🌡️ CẢNH BÁO: SỐT CAO KÈM TIM NHANH!"
            alertType == "HIGH_HEART_RATE" -> "💓 CẢNH BÁO: NHỊP TIM TĂNG CAO BẤT THƯỜNG!"
            alertType == "LOW_HEART_RATE" -> "⚠️ CẢNH BÁO: NHỊP TIM TỤT QUÁ THẤP!"
            alertType == "LOW_SPO2" -> "🫁 NGUY CẤP: NỒNG ĐỘ OXY MÁU (SpO₂) TỤT SÂU!"
            alertType == "LOW_BATTERY" -> "🪫 PIN ĐỒNG HỒ SẮP HẾT (DƯỚI 20%)!"
            else -> "🚨 CẢNH BÁO SỨC KHỎE NGƯỜI CAO TUỔI!"
        }

        val iconRes = try {
            val id = resources.getIdentifier("ic_notification", "drawable", packageName)
            if (id != 0) id else android.R.drawable.ic_dialog_alert
        } catch (_: Exception) {
            android.R.drawable.ic_dialog_alert
        }

        val notifId = ((System.currentTimeMillis() % 1000000L).toInt() + 2000).let { if (it < 0) -it else it }
        val reqCode = (System.currentTimeMillis() % 100000L).toInt().let { if (it < 0) -it else it }
        NativeNotificationModule.registerActiveNotification(notifId)

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("OPEN_INCIDENT_ID", incidentId)
            putExtra("OPEN_INCIDENT_TYPE", alertType)
            putExtra("STOP_ALARM", true)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            reqCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // DeleteIntent khi người dùng vuốt xóa thông báo cảnh báo -> Dừng rung & chuông
        val dismissIntent = Intent(this, AlarmDismissReceiver::class.java).apply {
            action = "com.c1se34.smartelderlycare.ACTION_DISMISS_ALARM"
        }
        val deletePendingIntent = PendingIntent.getBroadcast(
            this,
            reqCode + 1,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // ActionIntent khi người dùng bấm trực tiếp nút "ĐÃ XỬ LÝ (TẮT CHUÔNG)" trên thanh thông báo
        val ackIntent = Intent(this, AlarmDismissReceiver::class.java).apply {
            action = "com.c1se34.smartelderlycare.ACTION_ACKNOWLEDGE_ALARM"
            putExtra("INCIDENT_ID", incidentId)
            putExtra("NOTIFICATION_ID", notifId)
        }
        val ackPendingIntent = PendingIntent.getBroadcast(
            this,
            reqCode + 2,
            ackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
            ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(this, NativeNotificationModule.EMERGENCY_CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(soundUri)
            .setAutoCancel(true)
            .setOngoing(false) // Không ghim thông báo cảnh báo, cho phép xóa
            .setContentIntent(pendingIntent)
            .setDeleteIntent(deletePendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "ĐÃ XỬ LÝ (TẮT CHUÔNG)",
                ackPendingIntent
            )

        try {
            notification.setFullScreenIntent(pendingIntent, true)
            notificationManager.notify(notifId, notification.build())
        } catch (se: SecurityException) {
            notification.setFullScreenIntent(null, false)
            notificationManager.notify(notifId, notification.build())
        }

        // Kích hoạt chuông báo động và rung phần cứng tập trung qua NativeNotificationModule
        // Sau 30s reo chuông mà không ai xử lý -> Tự động gọi điện thoại khẩn cấp (không cần mở app)
        NativeNotificationModule.triggerAlarm(
            context = this,
            isCritical = true,
            emergencyPhone = emergencyPhone,
            autoCallDelayMs = NativeNotificationModule.DEFAULT_AUTO_CALL_DELAY_MS
        )
    }

    private fun triggerRoutineNotification(
        incidentId: String,
        alertType: String,
        message: String
    ) {
        val title = when {
            alertType == "APPOINTMENT_SCHEDULED" -> "🗓️ LỊCH KHÁM MỚI TỪ BÁC SĨ"
            alertType == "APPOINTMENT_REQUESTED" -> "🗓️ YÊU CẦU LỊCH KHÁM TỪ GIA ĐÌNH"
            alertType == "APPOINTMENT_CONFIRMED" -> "🗓️ GIA ĐÌNH ĐÃ XÁC NHẬN LỊCH KHÁM"
            alertType == "APPOINTMENT_CANCELLED" -> "🗓️ LỊCH KHÁM ĐÃ BỊ HỦY"
            alertType == "MEDICAL_RECORD_UPDATED" -> "📋 HỒ SƠ BỆNH ÁN ĐƯỢC CẬP NHẬT"
            alertType == "DEVICE_BATTERY_DEAD" -> "🪫 VÒNG ĐEO TAY ĐÃ CẠN PIN (0%)"
            alertType == "LOW_BATTERY" -> "🔋 CẢNH BÁO PIN ĐỒNG HỒ YẾU"
            alertType.startsWith("HOUSE_") -> "🏠 THÔNG BÁO GIA ĐÌNH"
            else -> "🔔 THÔNG BÁO TỪ SMARTCARE AI"
        }

        val iconRes = try {
            val id = resources.getIdentifier("ic_notification", "drawable", packageName)
            if (id != 0) id else android.R.drawable.ic_dialog_alert
        } catch (_: Exception) {
            android.R.drawable.ic_dialog_alert
        }

        val notifId = ((System.currentTimeMillis() % 1000000L).toInt() + 3000).let { if (it < 0) -it else it }
        val reqCode = (System.currentTimeMillis() % 100000L).toInt().let { if (it < 0) -it else it }

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("OPEN_INCIDENT_ID", incidentId)
            putExtra("OPEN_INCIDENT_TYPE", alertType)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            reqCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Dùng âm thanh chuông ting ting thông báo thông thường của điện thoại
        val soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(this, NativeNotificationModule.CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(soundUri)
            .setAutoCancel(true)
            .setOngoing(false)
            .setContentIntent(pendingIntent)

        notificationManager.notify(notifId, notification.build())
        // KHÔNG gọi NativeNotificationModule.triggerAlarm -> Không hú còi, không rung liên tục
    }
}
