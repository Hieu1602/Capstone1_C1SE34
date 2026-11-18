import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEscalationStore } from '../store/useEscalationStore';
import { useAlertStore } from '../store/useAlertStore';
import { useAuthStore } from '../store/useAuthStore';
import { useVitalStore } from '../store/useVitalStore';
import { BASE_URL, incidentsApi } from '../services/api';
import { dialEmergencyNumber, EMERGENCY_TEST_PHONE, requestEmergencyCallPermission } from '../services/emergency';

const resolveMediaUrl = (raw?: string | null): string | null => {
  if (!raw || !raw.trim()) return null;
  const clean = raw.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
    return clean;
  }
  const base = BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${base}${clean.startsWith('/') ? clean : `/${clean}`}`;
};

export const CriticalEscalationModal: React.FC = () => {
  const { activeEscalation, autoCallEnabled, markEscalated, clearEscalation } = useEscalationStore();
  const [secondsLeft, setSecondsLeft] = useState<number>(45);
  const [hasAutoCalled, setHasAutoCalled] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activeEscalation) {
      setHasAutoCalled(false);
      return;
    }
    setSecondsLeft(activeEscalation.delaySeconds || 45);
    setHasAutoCalled(false);
  }, [activeEscalation?.incidentId]);

  useEffect(() => {
    if (!activeEscalation) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 550, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeEscalation, pulseAnim]);

  // Xin quyền CALL_PHONE sớm khi modal mở trên Android để không bị popup chặn lúc t = 0
  useEffect(() => {
    if (activeEscalation && autoCallEnabled) {
      void requestEmergencyCallPermission();
    }
  }, [activeEscalation, autoCallEnabled]);

  // Bộ đếm ngược an toàn mỗi 1 giây
  useEffect(() => {
    if (!activeEscalation || !autoCallEnabled) return;
    if (hasAutoCalled) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeEscalation?.incidentId, autoCallEnabled, hasAutoCalled]);

  // Tự động kích hoạt gọi số khẩn cấp khi đếm ngược về 0 HOẶC khi nhận tín hiệu ESCALATED từ server
  useEffect(() => {
    if (!activeEscalation || !autoCallEnabled) return;
    const isTimeToCall = secondsLeft === 0 || activeEscalation.status === 'ESCALATED';
    if (isTimeToCall && !hasAutoCalled) {
      setHasAutoCalled(true);
      if (activeEscalation.status !== 'ESCALATED') {
        markEscalated(activeEscalation.incidentId);
      }
      // Gửi API báo server đã tự động kích hoạt gọi cấp cứu
      incidentsApi
        .escalate(
          activeEscalation.incidentId,
          'Hệ thống đã tự động kích hoạt gọi số khẩn cấp sau khi hết thời gian chờ'
        )
        .catch(() => {});
      // Tự động gọi qua Native ACTION_CALL trên Android APK (fallback tel: trên Web/iOS)
      void dialEmergencyNumber(EMERGENCY_TEST_PHONE).catch(() => {});
    }
  }, [secondsLeft, activeEscalation?.status, activeEscalation?.incidentId, autoCallEnabled, hasAutoCalled, markEscalated]);

  if (!activeEscalation) {
    return null;
  }

  const snapshotUri = resolveMediaUrl(activeEscalation.thumbnailUrl);

  const handleCallNow = async () => {
    setHasAutoCalled(true);
    markEscalated(activeEscalation.incidentId);
    incidentsApi
      .escalate(activeEscalation.incidentId, 'Người dùng đã nhấn Gọi ngay 115')
      .catch(() => {});
    try {
      await dialEmergencyNumber(EMERGENCY_TEST_PHONE);
    } catch {}
  };

  const handleCancelAndSupport = async () => {
    setIsCancelling(true);
    const handlerName = useAuthStore.getState().userName || 'Người nhà';
    try {
      await useAlertStore
        .getState()
        .acknowledgeIncident(
          activeEscalation.incidentId,
          'Tôi đã hỗ trợ / Hủy báo động khẩn cấp',
          handlerName
        );
    } catch {}
    useVitalStore.getState().setVitals({ fall_detected: false, acoustic_status: 'Bình thường' });
    useVitalStore.getState().setSirenActive(false);
    useAlertStore.getState().setSirenActive(false);
    setIsCancelling(false);
    clearEscalation(activeEscalation.incidentId);
  };

  const isEscalatedState =
    activeEscalation.status === 'ESCALATED' || (autoCallEnabled && secondsLeft === 0);

  return (
    <Modal
      visible={Boolean(activeEscalation)}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Huy hiệu cảnh báo khẩn cấp */}
          <View style={styles.topBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.topBadgeText}>CẢNH BÁO KHẨN CẤP • AUTO-ESCALATION SOS</Text>
          </View>

          {/* Vòng tròn Icon & Đồng hồ đếm ngược */}
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="warning" size={44} color="#FFFFFF" />
            {autoCallEnabled && !isEscalatedState && (
              <Text style={styles.countdownNumber}>{secondsLeft}s</Text>
            )}
          </Animated.View>

          <Text style={styles.mainTitle}>
            {activeEscalation.alertType.includes('FALL')
              ? 'PHÁT HIỆN TÉ NGÃ KHẨN CẤP!'
              : 'BÁO ĐỘNG ĐỎ SINH HIỆU!'}
          </Text>

          <Text style={styles.countdownText}>
            {!autoCallEnabled
              ? 'Đang chờ người nhà xác nhận hỗ trợ tại chỗ'
              : isEscalatedState
                ? `Đang tự động quay số khẩn cấp (${EMERGENCY_TEST_PHONE})...`
                : `Tự động gọi khẩn cấp (${EMERGENCY_TEST_PHONE}) sau ${secondsLeft}s...`}
          </Text>

          {/* Khối thông tin bệnh nhân & vị trí */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-circle-outline" size={20} color="#FECACA" />
              <Text style={styles.infoLabel}>Bệnh nhân:</Text>
              <Text style={styles.infoValue}>{activeEscalation.patientName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#FECACA" />
              <Text style={styles.infoLabel}>Vị trí:</Text>
              <Text style={styles.infoValue}>{activeEscalation.location}</Text>
            </View>
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{activeEscalation.message}</Text>
            </View>

            {snapshotUri && (
              <View style={styles.snapshotWrap}>
                <Image source={{ uri: snapshotUri }} style={styles.snapshotImage} resizeMode="cover" />
                <View style={styles.snapshotCaption}>
                  <Ionicons name="videocam" size={13} color="#FFFFFF" />
                  <Text style={styles.snapshotCaptionText}>Khung hình camera lúc phát hiện sự cố</Text>
                </View>
              </View>
            )}
          </View>

          {/* 2 Nút thao tác lớn */}
          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={styles.callNowBtn}
              activeOpacity={0.85}
              onPress={handleCallNow}
            >
              <Ionicons name="call" size={22} color="#DC2626" />
              <Text style={styles.callNowText}>Gọi ngay 115</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.85}
              onPress={handleCancelAndSupport}
              disabled={isCancelling}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
              <Text style={styles.cancelBtnText}>
                {isCancelling ? 'Đang xác nhận...' : 'Tôi đã hỗ trợ / Hủy báo động'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#991B1B',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.35)',
    marginBottom: 22,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FDE047',
    marginRight: 8,
  },
  topBadgeText: {
    color: '#FEF2F2',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pulseCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#DC2626',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  countdownText: {
    color: '#FEF08A',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 22,
  },
  infoCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.25)',
    marginBottom: 24,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  messageBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginTop: 2,
  },
  messageText: {
    color: '#FEF2F2',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  snapshotWrap: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: '#000',
  },
  snapshotImage: {
    width: '100%',
    height: 160,
  },
  snapshotCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  snapshotCaptionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  actionsWrap: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
  },
  callNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  callNowText: {
    color: '#DC2626',
    fontSize: 17,
    fontWeight: '900',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    paddingVertical: 15,
    borderRadius: 18,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
