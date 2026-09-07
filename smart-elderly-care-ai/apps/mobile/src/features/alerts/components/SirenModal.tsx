// SirenModal.tsx
// Modal cảnh báo khẩn cấp – Hiển thị còi SOS khi nhận alert CRITICAL

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

interface SirenModalProps {
  visible: boolean;
  alertType: string;
  message: string;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export default function SirenModal({
  visible, alertType, message, onDismiss, onViewDetails,
}: SirenModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // Shake animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 8,  duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0,  duration: 80, useNativeDriver: true }),
        ])
      ).start();

      // Vibration SOS pattern (. . . - - - . . .)
      Vibration.vibrate([
        100, 100, 100, 100, 100, 200,
        300, 200, 300, 200, 300, 200,
        100, 100, 100, 100, 100, 300,
      ], true);
    } else {
      pulseAnim.stopAnimation();
      shakeAnim.stopAnimation();
      Vibration.cancel();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {/* Pulsing icon */}
          <Animated.View
            style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}
          >
            <Ionicons name="warning" size={56} color="#EF4444" />
          </Animated.View>

          <Text style={styles.title}>🚨 KHẨN CẤP!</Text>
          <Text style={styles.alertType}>{alertType}</Text>
          <Text style={styles.message}>{message}</Text>

          {/* Actions */}
          <TouchableOpacity style={styles.detailBtn} onPress={onViewDetails}>
            <Ionicons name="eye" size={18} color="#FFF" />
            <Text style={styles.detailBtnText}>Xem chi tiết</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Đã xử lý</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
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
