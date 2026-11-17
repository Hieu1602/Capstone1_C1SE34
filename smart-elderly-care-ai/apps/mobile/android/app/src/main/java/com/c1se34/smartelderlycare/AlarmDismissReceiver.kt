package com.c1se34.smartelderlycare

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receiver lắng nghe khi người dùng vuốt xóa thông báo khẩn cấp từ thanh thông báo điện thoại.
 * Tự động ngắt rung liên tục và dừng chuông báo động.
 */
class AlarmDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        Log.d("AlarmDismissReceiver", "Người dùng đã xóa/gạt thông báo -> Dừng rung liên tục và chuông.")
        NativeNotificationModule.stopAlarm(context)
    }
}
