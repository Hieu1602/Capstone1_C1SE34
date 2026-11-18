package com.c1se34.smartelderlycare

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NativeNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NativeNotificationModule"

    companion object {
        private const val TAG = "NativeNotificationModule"
        private const val CHANNEL_ID = "smartcare_alert_v4"
        private const val EMERGENCY_CHANNEL_ID = "emergency_alerts_v4"
        private const val CHANNEL_NAME = "Thông báo cảnh báo SmartCare AI"
        private const val EMERGENCY_CHANNEL_NAME = "Cảnh báo khẩn cấp SmartCare AI"

        private var activeVibrator: Vibrator? = null
        private var activeRingtone: Ringtone? = null
        private var stopAlarmRunnable: Runnable? = null
        private val mainHandler = Handler(Looper.getMainLooper())

        /**
         * Dừng toàn bộ rung liên tục và chuông báo động (gọi khi người dùng chạm, vuốt xóa hoặc bấm Đã hiểu)
         */
        @JvmStatic
        fun stopAlarm(context: Context) {
            try {
                activeVibrator?.cancel()
                activeVibrator = null
                activeRingtone?.stop()
                activeRingtone = null
                stopAlarmRunnable?.let { mainHandler.removeCallbacks(it) }
                stopAlarmRunnable = null
                Log.d(TAG, "Đã tắt rung liên tục và dừng chuông báo động thành công.")
            } catch (e: Exception) {
                Log.e(TAG, "Lỗi khi dừng báo động: ${e.message}")
            }
        }
    }

    private fun createChannelsIfNeeded(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()

            // 1. Kênh thông báo thông thường
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Thông báo cảnh báo sự cố sức khỏe, té ngã và lịch khám người cao tuổi"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 500, 250, 500)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                    setSound(soundUri, audioAttributes)
                    setShowBadge(true)
                }
                manager.createNotificationChannel(channel)
                Log.d(TAG, "Đã tạo kênh thông báo: $CHANNEL_ID")
            }

            // 2. Kênh cảnh báo khẩn cấp (cho FCM và sự cố đe dọa tính mạng)
            if (manager.getNotificationChannel(EMERGENCY_CHANNEL_ID) == null) {
                val emergencyChannel = NotificationChannel(
                    EMERGENCY_CHANNEL_ID,
                    EMERGENCY_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Cảnh báo khẩn cấp: nhịp tim bất thường, té ngã, tụt oxy và suy hô hấp"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 1000, 400, 1000, 400, 1000, 800)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                    setSound(soundUri, audioAttributes)
                    setShowBadge(true)
                    try {
                        setBypassDnd(true)
                    } catch (_: Exception) {}
                }
                manager.createNotificationChannel(emergencyChannel)
                Log.d(TAG, "Đã tạo kênh khẩn cấp: $EMERGENCY_CHANNEL_ID")
            }
        }
    }

    @ReactMethod
    fun openNotificationSettings() {
        try {
            val intent = Intent().apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    action = android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
                } else {
                    action = "android.settings.APP_NOTIFICATION_SETTINGS"
                    putExtra("app_package", reactContext.packageName)
                    putExtra("app_uid", reactContext.applicationInfo.uid)
                }
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
            Log.d(TAG, "Đã mở trang cài đặt thông báo cho ứng dụng.")
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi mở trang cài đặt thông báo: ${e.message}")
        }
    }

    @ReactMethod
    fun areNotificationsEnabled(promise: Promise) {
        try {
            val manager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                promise.resolve(manager.areNotificationsEnabled())
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun triggerEmergencyAlarm(title: String, message: String, isCritical: Boolean) {
        showNotificationInternal(title, message, isEmergency = true, isCritical = isCritical)
    }

    @ReactMethod
    fun showNotification(title: String, message: String) {
        val isEmergency = title.contains("🚨") || title.contains("💓") || title.contains("KHẨN CẤP") ||
                title.contains("BÁO ĐỘNG") || title.contains("NGUY CẤP") || title.contains("TÉ NGÃ") ||
                title.contains("NHỊP TIM") || title.contains("OXY")
        showNotificationInternal(title, message, isEmergency = isEmergency, isCritical = isEmergency)
    }

    @ReactMethod
    fun stopAlarm() {
        stopAlarm(reactContext)
    }

    private fun showNotificationInternal(
        title: String,
        message: String,
        isEmergency: Boolean,
        isCritical: Boolean
    ) {
        try {
            val manager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            createChannelsIfNeeded(manager)

            // Kiểm tra quyền trên Android 13+ (POST_NOTIFICATIONS)
            if (Build.VERSION.SDK_INT >= 33) {
                val hasPermission = ContextCompat.checkSelfPermission(
                    reactContext,
                    "android.permission.POST_NOTIFICATIONS"
                ) == PackageManager.PERMISSION_GRANTED
                if (!hasPermission) {
                    Log.w(TAG, "POST_NOTIFICATIONS chưa được cấp quyền! Không thể hiển thị trên thanh thông báo.")
                }
            }

            // Icon thông báo: Ưu tiên R.drawable.ic_notification, fallback sang icon hệ thống
            val iconRes = try {
                val resId = reactContext.resources.getIdentifier("ic_notification", "drawable", reactContext.packageName)
                if (resId != 0) resId else android.R.drawable.ic_dialog_alert
            } catch (_: Exception) {
                android.R.drawable.ic_dialog_alert
            }

            // ID thông báo và Request Code luôn là số nguyên dương hợp lệ
            val notifId = ((System.currentTimeMillis() % 1000000L).toInt() + 1000).let { if (it < 0) -it else it }
            val reqCode = (System.currentTimeMillis() % 100000L).toInt().let { if (it < 0) -it else it }

            // Intent khi người dùng bấm vào thông báo -> Mở app và dừng chuông/rung
            val intent = Intent(reactContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("STOP_ALARM", true)
            }
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                reqCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )

            // DeleteIntent khi người dùng vuốt xóa thông báo -> Tự động dừng rung liên tục & chuông
            val dismissIntent = Intent(reactContext, AlarmDismissReceiver::class.java).apply {
                action = "com.c1se34.smartelderlycare.ACTION_DISMISS_ALARM"
            }
            val deletePendingIntent = PendingIntent.getBroadcast(
                reactContext,
                reqCode + 1,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val chosenChannelId = if (isEmergency) EMERGENCY_CHANNEL_ID else CHANNEL_ID

            val builder = NotificationCompat.Builder(reactContext, chosenChannelId)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setSound(soundUri)
                .setAutoCancel(true)
                .setOngoing(false) // CHO PHÉP NGƯỜI DÙNG VUỐT XÓA THÔNG BÁO BẤT KỲ LÚC NÀO
                .setContentIntent(pendingIntent)
                .setDeleteIntent(deletePendingIntent)

            // Hiển thị trực tiếp lên thanh thông báo hệ thống (Notification Drawer / Status Bar)
            try {
                if (isEmergency) {
                    builder.setFullScreenIntent(pendingIntent, true)
                }
                manager.notify(notifId, builder.build())
                Log.d(TAG, "Đã gửi thông báo thành công lên thanh trạng thái: $title (ID: $notifId)")
            } catch (se: SecurityException) {
                // Trên Android 14+ nếu chưa có quyền đặc biệt USE_FULL_SCREEN_INTENT, fallback gửi thông báo tiêu chuẩn
                Log.w(TAG, "Không có quyền fullScreenIntent trên Android 14, gửi lại thông báo tiêu chuẩn: ${se.message}")
                builder.setFullScreenIntent(null, false)
                manager.notify(notifId, builder.build())
            }

            if (isEmergency) {
                // 1. Phát âm thanh chuông báo động
                try {
                    activeRingtone?.stop()
                    val ringtone = RingtoneManager.getRingtone(reactContext, soundUri)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        ringtone.audioAttributes = AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .build()
                    }
                    ringtone.play()
                    activeRingtone = ringtone
                } catch (e: Exception) {
                    Log.e(TAG, "Lỗi phát âm thanh chuông: ${e.message}")
                }

                // 2. Rung liên tục (Continuous Vibration) cho đến khi người nhà chạm vào hoặc vuốt xóa
                try {
                    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        val vibratorManager =
                            reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                        vibratorManager?.defaultVibrator
                    } else {
                        @Suppress("DEPRECATION")
                        reactContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    }

                    val pattern = longArrayOf(0, 1000, 400, 1000, 400, 1000, 800)
                    // repeatIndex = 0 -> Rung lặp lại liên tục cho người nhà nhận biết ngay lập tức
                    val repeatIndex = if (isCritical) 0 else -1

                    vibrator?.cancel()
                    val effect = VibrationEffect.createWaveform(pattern, repeatIndex)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        val vibAttrs = VibrationAttributes.Builder()
                            .setUsage(VibrationAttributes.USAGE_ALARM)
                            .build()
                        vibrator?.vibrate(effect, vibAttrs)
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val alarmAudioAttrs = AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .build()
                        @Suppress("DEPRECATION")
                        vibrator?.vibrate(effect, alarmAudioAttrs)
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator?.vibrate(pattern, repeatIndex)
                    }
                    activeVibrator = vibrator

                    // Tự động dừng rung sau 45s để bảo vệ pin máy nếu người nhà không có mặt
                    stopAlarmRunnable?.let { mainHandler.removeCallbacks(it) }
                    stopAlarmRunnable = Runnable {
                        stopAlarm(reactContext)
                    }
                    mainHandler.postDelayed(stopAlarmRunnable!!, 45000)
                } catch (e: Exception) {
                    Log.e(TAG, "Lỗi kích hoạt rung: ${e.message}")
                }
            } else {
                triggerVibration()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi khi gửi thông báo: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startBackgroundMonitor(serverUrl: String) {
        try {
            val intent = Intent(reactContext, SmartCareBackgroundService::class.java).apply {
                putExtra("SERVER_URL", serverUrl)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi khởi chạy background service: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopBackgroundMonitor() {
        try {
            val intent = Intent(reactContext, SmartCareBackgroundService::class.java)
            reactContext.stopService(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi dừng background service: ${e.message}", e)
        }
    }

    @ReactMethod
    fun triggerVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager =
                    reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 500, 250, 500), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = reactContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(
                        VibrationEffect.createWaveform(longArrayOf(0, 500, 250, 500), -1)
                    )
                } else {
                    vibrator?.vibrate(longArrayOf(0, 500, 250, 500), -1)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi rung: ${e.message}", e)
        }
    }

    @ReactMethod
    fun openZalo(text: String?, promise: Promise) {
        try {
            val pm = reactContext.packageManager

            // 1. Nếu có nội dung text, ưu tiên mở Intent ACTION_SEND chỉ định đích danh Zalo
            if (!text.isNullOrBlank()) {
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                    `package` = "com.zing.zalo"
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                if (shareIntent.resolveActivity(pm) != null) {
                    reactContext.startActivity(shareIntent)
                    Log.d(TAG, "Đã mở Zalo để chia sẻ tin nhắn trực tiếp")
                    promise.resolve(true)
                    return
                }
            }

            // 2. Mở trực tiếp ứng dụng Zalo bằng LaunchIntent của package com.zing.zalo
            val launchIntent = pm.getLaunchIntentForPackage("com.zing.zalo")
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(launchIntent)
                Log.d(TAG, "Đã mở ứng dụng Zalo thành công")
                promise.resolve(true)
                return
            }

            Log.w(TAG, "Không tìm thấy ứng dụng Zalo trên thiết bị")
            promise.resolve(false)
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi mở Zalo: ${e.message}", e)
            promise.resolve(false)
        }
    }

    /**
     * Thực hiện cuộc gọi khẩn cấp trực tiếp qua Intent.ACTION_CALL nếu đã được cấp quyền CALL_PHONE.
     * Nếu chưa có quyền, fallback sang ACTION_DIAL để mở trình quay số an toàn.
     */
    @ReactMethod
    fun placeEmergencyCall(phone: String, promise: Promise) {
        try {
            val sanitized = phone.trim()
            if (sanitized.isEmpty()) {
                promise.resolve("INVALID")
                return
            }
            val telUri = Uri.parse("tel:$sanitized")
            val hasCallPermission = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.CALL_PHONE
            ) == PackageManager.PERMISSION_GRANTED

            val intent = Intent(
                if (hasCallPermission) Intent.ACTION_CALL else Intent.ACTION_DIAL,
                telUri
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            val mode = if (hasCallPermission) "CALLED" else "DIALED"
            Log.d(TAG, "placeEmergencyCall($sanitized) -> $mode")
            promise.resolve(mode)
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi placeEmergencyCall: ${e.message}", e)
            promise.resolve("ERROR")
        }
    }
}
