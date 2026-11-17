package com.c1se34.smartelderlycare

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
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
        private const val CHANNEL_ID = "smartcare_alert_v2"
        private const val CHANNEL_NAME = "Thông báo cảnh báo SmartCare AI"
    }

    private fun createChannelIfNeeded(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val existing = manager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .build()

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
    fun showNotification(title: String, message: String) {
        try {
            val manager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            createChannelIfNeeded(manager)

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

            val intent = Intent(reactContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                System.currentTimeMillis().toInt(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val builder = NotificationCompat.Builder(reactContext, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setSound(soundUri)
                .setVibrate(longArrayOf(0, 500, 250, 500))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)

            manager.notify(System.currentTimeMillis().toInt(), builder.build())
            Log.d(TAG, "Đã gửi thông báo thành công lên thanh trạng thái: $title")

            // Kích hoạt rung trực tiếp
            triggerVibration()
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
}
