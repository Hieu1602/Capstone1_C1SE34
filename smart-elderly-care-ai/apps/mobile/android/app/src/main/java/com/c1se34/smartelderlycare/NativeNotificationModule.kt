package com.c1se34.smartelderlycare

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
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
        const val CHANNEL_ID = "smartcare_normal_v6"
        const val EMERGENCY_CHANNEL_ID = "emergency_alerts_v6"
        const val CHANNEL_NAME = "Thông báo thường SmartCare AI (Ting ting)"
        const val EMERGENCY_CHANNEL_NAME = "Cảnh báo khẩn cấp SmartCare AI"
        const val DEFAULT_EMERGENCY_PHONE = "0898230852"
        const val DEFAULT_AUTO_CALL_DELAY_MS = 30000L // 30s reo chuông khẩn cấp trước khi tự động quay số

        private var activeVibrator: Vibrator? = null
        private var activeRingtone: Ringtone? = null
        private var activeMediaPlayer: MediaPlayer? = null
        private var stopAlarmRunnable: Runnable? = null
        private var previousAlarmVolume: Int = -1
        private val mainHandler = Handler(Looper.getMainLooper())
        private val activeNotificationIds = java.util.concurrent.ConcurrentHashMap.newKeySet<Int>()

        @JvmStatic
        fun registerActiveNotification(id: Int) {
            activeNotificationIds.add(id)
        }

        /**
         * Phát tiếng chuông "ting ting" thông báo tiêu chuẩn của hệ thống Android.
         * Dành cho tất cả các thông báo thường (Lịch khám, Đơn thuốc, Cập nhật bệnh án, Gia đình, Pin, Hệ thống).
         */
        @JvmStatic
        fun playTingTingSound(context: Context) {
            mainHandler.post {
                try {
                    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                        ?: return@post
                    val ringtone = RingtoneManager.getRingtone(context.applicationContext, soundUri)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        ringtone?.audioAttributes = AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .build()
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        ringtone?.isLooping = false
                    }
                    ringtone?.play()
                } catch (e: Exception) {
                    Log.w(TAG, "Không thể phát âm thanh ting ting: ${e.message}")
                }
            }
        }

        /**
         * Phát chuông báo động và kích hoạt rung liên tục cho thông báo khẩn cấp.
         * Nếu người dùng không xử lý (không tắt chuông) sau khi chuông reo xong (30s),
         * hệ thống sẽ TỰ ĐỘNG GỌI ĐIỆN THOẠI KHẨN CẤP ngay lập tức mà không cần chạm vào app.
         */
        @JvmStatic
        fun triggerAlarm(
            context: Context,
            isCritical: Boolean,
            emergencyPhone: String = DEFAULT_EMERGENCY_PHONE,
            autoCallDelayMs: Long = DEFAULT_AUTO_CALL_DELAY_MS
        ) {
            mainHandler.post {
                try {
                    // Dừng chuông và rung cũ nếu có
                    try {
                        activeMediaPlayer?.stop()
                        activeMediaPlayer?.release()
                    } catch (_: Exception) {}
                    activeMediaPlayer = null

                    activeRingtone?.stop()
                    activeRingtone = null
                    activeVibrator?.cancel()
                    activeVibrator = null
                    stopAlarmRunnable?.let { mainHandler.removeCallbacks(it) }
                    stopAlarmRunnable = null

                    // Đánh thức CPU và màn hình để đếm giờ và gọi điện kể cả khi điện thoại tắt màn hình / khóa phím
                    try {
                        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                        val wakeLock = pm?.newWakeLock(
                            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                            "smartcare:emergency_alarm_wakelock"
                        )
                        wakeLock?.acquire(autoCallDelayMs + 5000L)
                    } catch (_: Exception) {}

                    // Đảm bảo âm lượng luồng báo thức khẩn cấp (STREAM_ALARM) luôn đủ lớn kể cả khi máy đang để im lặng/rung hoặc thanh âm lượng bị kéo nhỏ
                    if (isCritical) {
                        try {
                            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                            if (audioManager != null) {
                                val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                                val curVol = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)
                                if (previousAlarmVolume == -1) {
                                    previousAlarmVolume = curVol
                                }
                                val targetVol = (maxVol * 0.85).toInt().coerceAtLeast(1)
                                if (curVol < targetVol) {
                                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, targetVol, 0)
                                    Log.d(TAG, "Đã tự động nâng âm lượng STREAM_ALARM từ $curVol lên $targetVol/$maxVol để báo động khẩn cấp.")
                                }
                            }
                        } catch (ae: Exception) {
                            Log.w(TAG, "Không thể điều chỉnh STREAM_ALARM: ${ae.message}")
                        }
                    }

                    // 1. Phát âm thanh chuông báo động (Ưu tiên MediaPlayer để lặp liên tục ở âm lượng tối đa)
                    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

                    try {
                        val player = MediaPlayer().apply {
                            setAudioAttributes(
                                AudioAttributes.Builder()
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .setUsage(AudioAttributes.USAGE_ALARM)
                                    .build()
                            )
                            setDataSource(context.applicationContext, soundUri)
                            isLooping = isCritical
                            setVolume(1.0f, 1.0f)
                            prepare()
                            start()
                        }
                        activeMediaPlayer = player
                    } catch (mpErr: Exception) {
                        Log.w(TAG, "MediaPlayer khởi tạo lỗi, fallback sang Ringtone: ${mpErr.message}")
                        val ringtone = RingtoneManager.getRingtone(context.applicationContext, soundUri)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            ringtone.audioAttributes = AudioAttributes.Builder()
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .build()
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            ringtone.isLooping = isCritical
                        }
                        ringtone.play()
                        activeRingtone = ringtone
                    }

                    // 2. Rung phần cứng điện thoại (Continuous Vibration nếu khẩn cấp)
                    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        val vibratorManager =
                            context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                        vibratorManager?.defaultVibrator
                    } else {
                        @Suppress("DEPRECATION")
                        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    }

                    val pattern = longArrayOf(0, 1000, 400, 1000, 400, 1000, 800)
                    val repeatIndex = if (isCritical) 0 else -1

                    vibrator?.cancel()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val effect = VibrationEffect.createWaveform(pattern, repeatIndex)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            val vibAttrs = VibrationAttributes.Builder()
                                .setUsage(VibrationAttributes.USAGE_ALARM)
                                .build()
                            vibrator?.vibrate(effect, vibAttrs)
                        } else {
                            val alarmAudioAttrs = AudioAttributes.Builder()
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .build()
                            @Suppress("DEPRECATION")
                            vibrator?.vibrate(effect, alarmAudioAttrs)
                        }
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator?.vibrate(pattern, repeatIndex)
                    }
                    activeVibrator = vibrator

                    // 3. TỰ ĐỘNG GỌI ĐIỆN THOẠI KHẨN CẤP NẾU REO XONG CHUÔNG MÀ KHÔNG AI XỬ LÝ (TẮT CHUÔNG)
                    if (isCritical) {
                        stopAlarmRunnable = Runnable {
                            Log.w(TAG, "[AutoCall] Đã reo xong chuông sau ${autoCallDelayMs / 1000}s nhưng người dùng không bấm tắt chuông -> Tự động gọi khẩn cấp ngay tới $emergencyPhone (không cần nhấn vào app)!")
                            // Tắt chuông và rung để giải phóng luồng thoại cho cuộc gọi
                            stopAlarm(context)
                            // Tự động gọi trực tiếp qua ACTION_CALL / ACTION_DIAL
                            performEmergencyCall(context, emergencyPhone)
                        }
                        mainHandler.postDelayed(stopAlarmRunnable!!, autoCallDelayMs)
                        Log.d(TAG, "Đã kích hoạt còi hú và hẹn giờ tự động gọi điện sau ${autoCallDelayMs / 1000}s nếu không xử lý tắt chuông.")
                    } else {
                        // Thông báo thường tự dừng chuông sau 15s
                        stopAlarmRunnable = Runnable {
                            stopAlarm(context)
                        }
                        mainHandler.postDelayed(stopAlarmRunnable!!, 15000L)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Lỗi kích hoạt báo động: ${e.message}")
                }
            }
        }

        /**
         * Dừng toàn bộ rung liên tục, chuông báo động và xóa thông báo cảnh báo khỏi thanh thông báo hệ thống (0ms)
         */
        @JvmStatic
        fun stopAlarm(context: Context) {
            mainHandler.post {
                try {
                    activeVibrator?.cancel()
                    activeVibrator = null

                    try {
                        activeMediaPlayer?.stop()
                        activeMediaPlayer?.release()
                    } catch (_: Exception) {}
                    activeMediaPlayer = null

                    activeRingtone?.stop()
                    activeRingtone = null
                    stopAlarmRunnable?.let { mainHandler.removeCallbacks(it) }
                    stopAlarmRunnable = null

                    // Khôi phục lại mức âm lượng báo thức ban đầu của người dùng
                    if (previousAlarmVolume != -1) {
                        try {
                            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                            audioManager?.setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0)
                            Log.d(TAG, "Đã khôi phục âm lượng STREAM_ALARM về $previousAlarmVolume.")
                        } catch (_: Exception) {}
                        previousAlarmVolume = -1
                    }

                    // Xóa tất cả thông báo cảnh báo khẩn cấp đang hiển thị trên thanh thông báo
                    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                    if (manager != null) {
                        for (id in activeNotificationIds) {
                            try {
                                manager.cancel(id)
                            } catch (_: Exception) {}
                        }
                        activeNotificationIds.clear()
                    }
                    Log.d(TAG, "Đã tắt rung liên tục, dừng chuông báo động và dọn sạch thông báo cảnh báo (0ms).")
                } catch (e: Exception) {
                    Log.e(TAG, "Lỗi khi dừng báo động: ${e.message}")
                }
            }
        }

        /**
         * Thực hiện quay số khẩn cấp tự động trực tiếp trên tầng Native Android.
         * Ưu tiên dùng ACTION_CALL nếu đã được cấp quyền CALL_PHONE (tự động bấm gọi luôn không cần tương tác).
         * Fallback sang ACTION_DIAL nếu chưa được cấp quyền gọi trực tiếp.
         */
        @JvmStatic
        fun performEmergencyCall(context: Context, phone: String = DEFAULT_EMERGENCY_PHONE): String {
            return try {
                val sanitized = phone.trim().ifEmpty { DEFAULT_EMERGENCY_PHONE }
                val telUri = Uri.parse("tel:$sanitized")
                val hasCallPermission = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.CALL_PHONE
                ) == PackageManager.PERMISSION_GRANTED

                if (hasCallPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    try {
                        val telecomManager =
                            context.getSystemService(Context.TELECOM_SERVICE) as? android.telecom.TelecomManager
                        if (telecomManager != null) {
                            telecomManager.placeCall(telUri, android.os.Bundle())
                            Log.d(TAG, "performEmergencyCall($sanitized) thành công qua TelecomManager.placeCall")
                            return "CALLED"
                        }
                    } catch (te: Exception) {
                        Log.w(TAG, "TelecomManager.placeCall lỗi, fallback sang startActivity: ${te.message}")
                    }
                }

                val intent = Intent(
                    if (hasCallPermission) Intent.ACTION_CALL else Intent.ACTION_DIAL,
                    telUri
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                val mode = if (hasCallPermission) "CALLED" else "DIALED"
                Log.d(TAG, "performEmergencyCall($sanitized) thành công qua mode: $mode")
                mode
            } catch (e: Exception) {
                Log.e(TAG, "Lỗi performEmergencyCall: ${e.message}", e)
                "ERROR"
            }
        }
    }

    private fun createChannelsIfNeeded(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // 1. Kênh thông báo thông thường (Lịch khám, Tin nhắn, Cập nhật bệnh án -> Chuông ting ting nhẹ nhàng)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val normalSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val normalAudioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build()

                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Thông báo thông thường: lịch khám, tin nhắn, cập nhật hồ sơ bệnh án"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 200, 100, 200)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                    setSound(normalSoundUri, normalAudioAttributes)
                    setShowBadge(true)
                }
                manager.createNotificationChannel(channel)
                Log.d(TAG, "Đã tạo kênh thông báo thường: $CHANNEL_ID")
            }

            // 2. Kênh cảnh báo khẩn cấp (Té ngã, Nhịp tim bất thường, Nguy kịch -> Chuông báo động to và rung mạnh)
            if (manager.getNotificationChannel(EMERGENCY_CHANNEL_ID) == null) {
                val emergencySoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

                val emergencyAudioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()

                val emergencyChannel = NotificationChannel(
                    EMERGENCY_CHANNEL_ID,
                    EMERGENCY_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Cảnh báo khẩn cấp: nhịp tim bất thường, té ngã, tụt oxy và nguy kịch"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 1000, 400, 1000, 400, 1000, 800)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                    setSound(emergencySoundUri, emergencyAudioAttributes)
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
        showNotificationInternal(
            title = title,
            message = message,
            isEmergency = true,
            isCritical = isCritical,
            emergencyPhone = DEFAULT_EMERGENCY_PHONE,
            autoCallDelayMs = DEFAULT_AUTO_CALL_DELAY_MS
        )
    }

    @ReactMethod
    fun triggerEmergencyAlarmWithConfig(
        title: String,
        message: String,
        isCritical: Boolean,
        emergencyPhone: String,
        autoCallSeconds: Double
    ) {
        val phone = if (emergencyPhone.isNotBlank()) emergencyPhone.trim() else DEFAULT_EMERGENCY_PHONE
        val delayMs = if (autoCallSeconds > 0) (autoCallSeconds * 1000).toLong() else DEFAULT_AUTO_CALL_DELAY_MS
        showNotificationInternal(
            title = title,
            message = message,
            isEmergency = true,
            isCritical = isCritical,
            emergencyPhone = phone,
            autoCallDelayMs = delayMs
        )
    }

    @ReactMethod
    fun showNotification(title: String, message: String) {
        // Thông báo thông thường (Lịch khám, Tin nhắn, Cập nhật bệnh án): Không hú còi, không rung liên tục
        showNotificationInternal(
            title = title,
            message = message,
            isEmergency = false,
            isCritical = false,
            emergencyPhone = DEFAULT_EMERGENCY_PHONE,
            autoCallDelayMs = DEFAULT_AUTO_CALL_DELAY_MS
        )
    }

    @ReactMethod
    fun stopAlarm() {
        stopAlarm(reactContext)
    }

    @ReactMethod
    fun tryClaimIncidentNotification(incidentId: String, promise: Promise) {
        try {
            val claimed = SmartCareBackgroundService.tryClaimIncidentNotification(reactContext, incidentId)
            promise.resolve(claimed)
        } catch (e: Exception) {
            Log.w(TAG, "tryClaimIncidentNotification error: ${e.message}")
            promise.resolve(true)
        }
    }

    private fun showNotificationInternal(
        title: String,
        message: String,
        isEmergency: Boolean,
        isCritical: Boolean,
        emergencyPhone: String = DEFAULT_EMERGENCY_PHONE,
        autoCallDelayMs: Long = DEFAULT_AUTO_CALL_DELAY_MS
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
            if (isEmergency) {
                registerActiveNotification(notifId)
            }

            // Intent khi người dùng bấm vào thông báo -> Mở app để xem modal đếm ngược (không tự ý hủy bộ đếm 30s)
            val intent = Intent(reactContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                reqCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )

            // Âm thanh: Báo động nguy hiểm dùng TYPE_ALARM; Thông báo thường dùng TYPE_NOTIFICATION (ting ting)
            val soundUri = if (isEmergency) {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            } else {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }

            val chosenChannelId = if (isEmergency) EMERGENCY_CHANNEL_ID else CHANNEL_ID

            val builder = NotificationCompat.Builder(reactContext, chosenChannelId)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(if (isEmergency) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
                .setCategory(if (isEmergency) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setSound(soundUri)
                .setAutoCancel(true)
                .setOngoing(false) // Cho phép vuốt xóa bất kỳ lúc nào
                .setContentIntent(pendingIntent)

            // CHỈ THÊM DELETE_INTENT VÀ NÚT "ĐÃ XỬ LÝ (TẮT CHUÔNG)" NẾU LÀ BÁO ĐỘNG NGUY HIỂM KHẨN CẤP
            if (isEmergency) {
                val dismissIntent = Intent(reactContext, AlarmDismissReceiver::class.java).apply {
                    action = "com.c1se34.smartelderlycare.ACTION_DISMISS_ALARM"
                }
                val deletePendingIntent = PendingIntent.getBroadcast(
                    reactContext,
                    reqCode + 1,
                    dismissIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )
                builder.setDeleteIntent(deletePendingIntent)

                val ackIntent = Intent(reactContext, AlarmDismissReceiver::class.java).apply {
                    action = "com.c1se34.smartelderlycare.ACTION_ACKNOWLEDGE_ALARM"
                    putExtra("NOTIFICATION_ID", notifId)
                }
                val ackPendingIntent = PendingIntent.getBroadcast(
                    reactContext,
                    reqCode + 2,
                    ackIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )
                builder.addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    "ĐÃ XỬ LÝ (TẮT CHUÔNG)",
                    ackPendingIntent
                )
            }

            // Hiển thị trực tiếp lên thanh thông báo hệ thống (Notification Drawer / Status Bar)
            try {
                if (isEmergency) {
                    builder.setFullScreenIntent(pendingIntent, true)
                }
                manager.notify(notifId, builder.build())
                Log.d(TAG, "Đã gửi thông báo lên thanh thông báo Android: $title (ID: $notifId, isEmergency: $isEmergency)")
            } catch (se: SecurityException) {
                // Trên Android 14+ nếu chưa có quyền đặc biệt USE_FULL_SCREEN_INTENT, fallback gửi thông báo tiêu chuẩn
                Log.w(TAG, "Không có quyền fullScreenIntent trên Android 14, gửi lại thông báo tiêu chuẩn: ${se.message}")
                builder.setFullScreenIntent(null, false)
                manager.notify(notifId, builder.build())
            }

            // CHỈ PHÁT CHUÔNG BÁO ĐỘNG VÀ RUNG LIÊN TỤC NẾU LÀ CẢNH BÁO NGUY HIỂM KHẨN CẤP
            // Tất cả các thông báo còn lại đều lên thanh thông báo Android kèm tiếng "ting ting" nhẹ nhàng
            if (isEmergency) {
                triggerAlarm(reactContext, isCritical = isCritical, emergencyPhone = emergencyPhone, autoCallDelayMs = autoCallDelayMs)
            } else {
                playTingTingSound(reactContext)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi khi gửi thông báo: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startBackgroundMonitor(serverUrl: String) {
        startBackgroundMonitorWithToken(serverUrl, null)
    }

    @ReactMethod
    fun startBackgroundMonitorWithToken(serverUrl: String, authToken: String?) {
        try {
            val intent = Intent(reactContext, SmartCareBackgroundService::class.java).apply {
                putExtra("SERVER_URL", serverUrl)
                if (!authToken.isNullOrBlank()) {
                    putExtra("AUTH_TOKEN", authToken)
                }
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
        val mode = performEmergencyCall(reactContext, phone)
        promise.resolve(mode)
    }
}
