package com.c1se34.smartelderlycare

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
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
    private var serverBaseUrl: String = "http://16.178.128.42:8000/api/v1"
    private var workerThread: Thread? = null
    private var lastNotifiedIncidentId: String? = null

    companion object {
        const val SERVICE_CHANNEL_ID = "smartcare_service_monitor_channel"
        const val SERVICE_CHANNEL_NAME = "Dịch vụ bảo vệ người cao tuổi trong nền"
        const val ALERT_CHANNEL_ID = "smartcare_emergency_alert_channel"
        const val ALERT_CHANNEL_NAME = "Cảnh báo khẩn cấp SmartCare AI"
        const val SERVICE_NOTIFICATION_ID = 999
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val customUrl = intent?.getStringExtra("SERVER_URL")
        if (!customUrl.isNullOrBlank()) {
            serverBaseUrl = customUrl.trim().removeSuffix("/")
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

            // Kênh thường trực chạy nền (yên lặng, không rung)
            val serviceChannel = NotificationChannel(
                SERVICE_CHANNEL_ID,
                SERVICE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Hệ thống SmartCare AI duy trì giám sát người cao tuổi liên tục trong nền"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(serviceChannel)

            // Kênh cảnh báo khẩn cấp (rung mạnh, chuông to, nổi bật trên màn hình)
            val alertChannel = NotificationChannel(
                ALERT_CHANNEL_ID,
                ALERT_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Cảnh báo sự cố té ngã, nhịp tim bất thường và nguy cấp"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
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

        return NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("SmartCare AI đang bảo vệ người cao tuổi")
            .setContentText("Hệ thống giám sát sinh tồn & sự cố té ngã 24/7 đang hoạt động trong nền")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
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

                    // Nếu có sự cố mới chưa xử lý và khác sự cố đã báo gần nhất
                    if (!isAck && id != lastNotifiedIncidentId && id.isNotBlank()) {
                        lastNotifiedIncidentId = id
                        triggerHighPriorityAlarm(id, alertType, alertLevel, message)
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
        message: String
    ) {
        val title = when {
            alertType == "FALL_DETECTED" -> "🚨 PHÁT HIỆN SỰ CỐ TÉ NGÃ KHẨN CẤP!"
            alertType == "CRITICAL_TRIAD" -> "🔥 BÁO ĐỘNG ĐỎ: TAM CHỨNG NGUY KỊCH!"
            alertType == "EXERTION_HYPOXIA" -> "🚨 CẢNH BÁO QUÁ TẢI TIM PHỔI & TỤT OXY!"
            alertType == "FEVER_TACHYCARDIA" -> "🌡️ CẢNH BÁO: SỐT CAO KÈM TIM NHANH!"
            alertType == "HIGH_HEART_RATE" -> "💓 CẢNH BÁO: NHỊP TIM TĂNG CAO BẤT THƯỜNG!"
            alertType == "LOW_HEART_RATE" -> "⚠️ CẢNH BÁO: NHỊP TIM TỤT QUÁ THẤP!"
            alertType == "LOW_SPO2" -> "🫁 NGUY CẤP: NỒNG ĐỘ OXY MÁU (SpO₂) TỤT SÂU!"
            alertType == "DEVICE_BATTERY_DEAD" -> "⛔ VÒNG ĐEO TAY ĐÃ CẠN PIN (0%)!"
            alertType == "LOW_BATTERY" -> "🪫 PIN ĐỒNG HỒ SẮP HẾT (DƯỚI 20%)!"
            else -> "🚨 CẢNH BÁO SỨC KHỎE NGƯỜI CAO TUỔI!"
        }

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("OPEN_INCIDENT_ID", incidentId)
            putExtra("OPEN_INCIDENT_TYPE", alertType)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)

        // Rung mạnh điện thoại ngay cả khi tắt màn hình
        triggerAlarmVibration()
    }

    private fun triggerAlarmVibration() {
        try {
            val pattern = longArrayOf(0, 800, 400, 800, 400, 800)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager =
                    getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createWaveform(pattern, -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(
                        VibrationEffect.createWaveform(pattern, -1)
                    )
                } else {
                    vibrator?.vibrate(pattern, -1)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
