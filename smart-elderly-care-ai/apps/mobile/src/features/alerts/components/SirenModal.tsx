// ==============================================================================
// SirenModal.tsx – Hộp thoại Báo động Khẩn cấp Toàn màn hình (SOS Modal)
// ------------------------------------------------------------------------------
// Hệ thống giám sát người cao tuổi Smart Elderly Care AI (C1SE.34)
//
// Trách nhiệm của component:
// 1. Tự động hiển thị nổi bật trên tất cả các màn hình khi phát hiện sự cố CRITICAL
//    (như Cụ bị té ngã, Bất động thời gian dài, Tiếng la hét kêu cứu).
// 2. Kích hoạt chuỗi hiệu ứng cảnh giác cao:
//    - Hiệu ứng nhịp đập (Pulsing): Biểu tượng cảnh báo phóng to/thu nhỏ liên tục.
//    - Hiệu ứng rung lắc (Shaking): Toàn bộ hộp thoại rung lắc để thu hút sự chú ý.
//    - Rung phần cứng điện thoại (Haptic Vibration): Rung theo mã tín hiệu Morse SOS (... --- ...).
// 3. Cung cấp 2 lựa chọn hành động:
//    - "Xem chi tiết": Chuyển ngay đến màn hình sự cố xem video/clip bằng chứng.
//    - "Đã xử lý": Tắt còi báo động, dừng rung và đóng popup.
// ==============================================================================

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * SirenModalProps: Các thuộc tính đầu vào của SirenModal
 * @property {boolean}    visible       - Trạng thái hiển thị modal (true khi có cảnh báo khẩn).
 * @property {string}     alertType     - Loại cảnh báo (VD: FALL_DETECTED, ACOUSTIC_DISTRESS).
 * @property {string}     message       - Nội dung chi tiết về sự cố từ AI / cảm biến.
 * @property {() => void} onDismiss     - Hàm gọi lại khi bấm "Đã xử lý" (tắt còi, đóng modal).
 * @property {() => void} onViewDetails - Hàm gọi lại khi bấm "Xem chi tiết" (chuyển màn hình).
 */
interface SirenModalProps {
  visible: boolean;
  alertType: string;
  message: string;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export default function SirenModal({
  visible,
  alertType,
  message,
  onDismiss,
  onViewDetails,
}: SirenModalProps) {
  // Giá trị Animated cho hiệu ứng nhịp đập của biểu tượng cảnh báo (Scale từ 1.0 đến 1.15)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Giá trị Animated cho hiệu ứng rung lắc ngang của hộp thoại (TranslateX từ -8px đến +8px)
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ----------------------------------------------------------------------------
  // Vòng đời hiệu ứng: Bắt đầu khi visible = true, Dừng khi visible = false
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (visible) {
      // 1. Khởi chạy Animation nhịp đập lặp vô tận (Pulse loop)
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // 2. Khởi chạy Animation rung lắc khung cảnh báo (Shake loop)
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 8,  duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0,  duration: 80, useNativeDriver: true }),
        ])
      ).start();

      // 3. Kích hoạt motor rung phần cứng theo nhịp mã Morse khẩn cấp SOS (... --- ...)
      // Mảng: [nghỉ, rung, nghỉ, rung...] lặp lại tuần hoàn (repeat = true)
      Vibration.vibrate([
        100, 100, 100, 100, 100, 200,   // 3 nhịp ngắn: 'S' (...)
        300, 200, 300, 200, 300, 200,   // 3 nhịp dài:  'O' (---)
        100, 100, 100, 100, 100, 300,   // 3 nhịp ngắn: 'S' (...)
      ], true);
    } else {
      // Dừng toàn bộ animation và tắt rung ngay lập tức khi người dùng đóng modal
      pulseAnim.stopAnimation();
      shakeAnim.stopAnimation();
      Vibration.cancel();
    }

    // Cleanup: Đảm bảo dừng rung khi component bị unmount
    return () => {
      Vibration.cancel();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      {/* Lớp nền mờ tối phủ toàn màn hình */}
      <View style={styles.overlay}>
        {/* Khung chứa nội dung cảnh báo có hiệu ứng rung lắc ngang */}
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {/* Biểu tượng tam giác cảnh báo nguy kịch có hiệu ứng phóng to / thu nhỏ nhịp đập */}
          <Animated.View
            style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}
          >
            <Ionicons name="warning" size={56} color="#EF4444" />
          </Animated.View>

          {/* Tiêu đề báo động đỏ */}
          <Text style={styles.title}>🚨 KHẨN CẤP!</Text>
          {/* Tên loại sự cố (FALL_DETECTED / ACOUSTIC_DISTRESS...) */}
          <Text style={styles.alertType}>{alertType}</Text>
          {/* Chi tiết mô tả sự cố phát hiện được */}
          <Text style={styles.message}>{message}</Text>

          {/* Nút hành động chính: Xem chi tiết sự cố */}
          <TouchableOpacity style={styles.detailBtn} onPress={onViewDetails} activeOpacity={0.85}>
            <Ionicons name="eye" size={18} color="#FFF" />
            <Text style={styles.detailBtnText}>Xem chi tiết</Text>
          </TouchableOpacity>

          {/* Nút hành động phụ: Đã xử lý (Tắt còi báo động) */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.dismissBtnText}>Đã xử lý</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------------------
// Stylesheet
// ------------------------------------------------------------------------------
const styles = StyleSheet.create({
  // Nền tối phủ kín (85% opacity) để dồn sự tập trung cao nhất vào sự cố
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // Hộp thoại màu nền Slate tối, bo tròn góc với viền đỏ cảnh báo nổi bật
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
    gap: 12,
  },
  // Vòng tròn đỏ mờ bao quanh icon cảnh báo
  iconWrapper: {
    width: 100,
    height: 100,
    backgroundColor: '#EF444420',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title:     { color: '#EF4444', fontSize: 28, fontWeight: '900' },
  alertType: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message:   { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  // Nút Xem chi tiết màu xanh dương
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
    width: '100%',
    justifyContent: 'center',
    marginTop: 8,
  },
  detailBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  // Nút tắt còi viền tối tinh tế
  dismissBtn: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  dismissBtnText: { color: '#94A3B8', fontWeight: '600', fontSize: 15 },
});

