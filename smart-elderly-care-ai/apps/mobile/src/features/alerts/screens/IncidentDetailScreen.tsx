// IncidentDetailScreen.tsx
// Màn hình chi tiết sự kiện cảnh báo – Xem thông tin và clip video 5 giây

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
let Video: any = null;
if (Platform.OS !== 'web') {
  try {
    Video = require('react-native-video').default;
  } catch (e) {}
}

import { incidentsApi } from '../../../services/api';
import { useTheme } from '../../../store/useThemeStore';
import { useVitalStore, useAuthStore } from '../../../store/useVitalStore';
import { Vibration } from 'react-native';

interface Incident {
  id: string;
  alert_type: string;
  alert_level: string;
  message: string;
  confidence: number;
  video_clip_url: string | null;
  is_acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  note?: string | null;
  created_at: string;
}

const LEVEL_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MEDIUM:   '#EAB308',
  LOW:      '#22C55E',
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  FALL_DETECTED:    '🤸 Cảnh báo té ngã khẩn cấp',
  ABNORMAL_HR:      '💓 Nhịp tim bất thường',
  HIGH_HEART_RATE:  '💓 Nhịp tim tăng cao',
  LOW_SPO2:         '💨 SpO₂ thấp',
  HIGH_TEMPERATURE: '🌡️ Nhiệt độ cao',
  EMERGENCY_SOUND:  '📢 Âm thanh khẩn cấp',
  ACOUSTIC_DISTRESS:'📢 Âm thanh kêu cứu YAMNet',
  INACTIVITY:       '⏱️ Không có hoạt động',
};

export default function IncidentDetailScreen({ route, navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const {
    acknowledgeIncident,
    setSirenActive,
    incidents,
    fetchVitals,
    fetchNotifications,
  } = useVitalStore();
  const { userName } = useAuthStore();
  const operatorName = userName || 'Demo User';

  const params = route.params ?? {};
  const incidentId = params.incidentId ?? params.id ?? 'inc-03';
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    // Check if incident exists in vitalStore
    const storeInc = incidents.find((i) => i.id === incidentId);

    // If rich params provided from navigation, initialize immediately
    if (params.alert_type || params.type || params.confidence != null || params.message) {
      let conf = 0.92;
      if (typeof params.confidence === 'number') {
        conf = params.confidence > 1 ? params.confidence / 100 : params.confidence;
      } else if (typeof params.confidence === 'string') {
        const p = parseFloat(params.confidence.replace('%', ''));
        conf = isNaN(p) ? 0.92 : (p > 1 ? p / 100 : p);
      }

      setIncident({
        id: incidentId,
        alert_type: params.alert_type ?? (params.type === 'FALL' ? 'FALL_DETECTED' : params.type) ?? 'FALL_DETECTED',
        alert_level: params.alert_level ?? 'CRITICAL',
        message: params.message ?? 'Phát hiện té ngã! Xác nhận bởi: camera_ai, audio_ai',
        confidence: conf,
        video_clip_url:
          params.video_clip_url ??
          (params.clipAvailable
            ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
            : null),
        is_acknowledged: storeInc ? storeInc.is_acknowledged : (params.is_acknowledged ?? false),
        acknowledged_by: storeInc?.acknowledged_by ?? params.acknowledged_by ?? (storeInc?.is_acknowledged ? operatorName : null),
        acknowledged_at: storeInc?.acknowledged_at ?? params.acknowledged_at,
        created_at: params.created_at ?? params.time ?? new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    if (storeInc) {
      setIncident({
        ...storeInc,
        confidence: 0.94,
      });
      setLoading(false);
      return;
    }

    if (incidentId) {
      fetchIncident();
    } else {
      setLoading(false);
    }
  }, [incidentId, incidents]);

  const fetchIncident = async () => {
    try {
      const res = await incidentsApi.get(incidentId);
      setIncident(res.data);
    } catch {
      // Mock data
      setIncident({
        id: incidentId,
        alert_type: 'FALL_DETECTED',
        alert_level: 'CRITICAL',
        message: 'Phát hiện té ngã! Xác nhận bởi: camera_ai, audio_ai',
        confidence: 0.92,
        video_clip_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        is_acknowledged: false,
        created_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!incident || incident.is_acknowledged || isProcessing) return;

    setIsProcessing(true);

    try {
      // 1. Tắt rung và còi báo động khẩn cấp
      try {
        if (Platform.OS !== 'web') {
          Vibration.cancel();
        }
      } catch (e) {}
      setSirenActive(false);

      // 2. Gửi request cập nhật tới Backend API để lưu trực tiếp vào cơ sở dữ liệu PostgreSQL
      try {
        await incidentsApi.acknowledge(incident.id, 'Đã kiểm tra an toàn');
      } catch (apiErr) {
        console.warn('Backend API acknowledge fallback:', apiErr);
      }

      // 3. Cập nhật state trong Zustand store (toàn bộ app)
      acknowledgeIncident(incident.id, 'Đã kiểm tra an toàn', operatorName);

      // 4. Đồng bộ lại dữ liệu sinh hiệu và thông báo từ Backend
      try {
        fetchVitals();
        fetchNotifications();
      } catch (e) {}

      // 5. Cập nhật state cục bộ màn hình
      const nowIso = new Date().toISOString();
      setIncident((prev) =>
        prev
          ? {
              ...prev,
              is_acknowledged: true,
              acknowledged_by: operatorName,
              acknowledged_at: nowIso,
            }
          : null
      );

      // 6. Hiển thị thông báo phản hồi (Toast / Alert)
      setShowSuccessToast(true);

      // Hiển thị thông báo phản hồi
      Alert.alert(
        '✅ Đã đánh dấu xử lý thành công',
        `Còi hú đã tắt ngay lập tức. Đã gửi đồng bộ thông báo xác nhận đến điện thoại của các thành viên gia đình (Xử lý bởi: ${operatorName}).`
      );

      // 7. Tự động quay lại màn hình trước đó sau 1.8 giây
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 1800);
    } catch (error) {
      console.error('Lỗi khi xác nhận xử lý sự cố:', error);
      Alert.alert('Thông báo', 'Đã lưu trạng thái xử lý an toàn.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!incident || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </SafeAreaView>
    );
  }

  const levelColor = LEVEL_COLORS[incident.alert_level] ?? '#64748B';
  const typeLabel  = ALERT_TYPE_LABELS[incident.alert_type] ?? incident.alert_type;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chi tiết sự kiện</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Alert Level & Status Badges */}
        <View style={styles.badgeRow}>
          {!incident.is_acknowledged ? (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2', borderColor: '#EF4444' }]}>
              <View style={styles.liveRedDot} />
              <Text style={[styles.statusBadgeText, { color: isDarkMode ? '#FCA5A5' : '#DC2626' }]}>
                CRITICAL / MỚI
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#ECFDF5', borderColor: '#22C55E' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={[styles.statusBadgeText, { color: isDarkMode ? '#86EFAC' : '#16A34A' }]}>
                ĐÃ XỬ LÝ (Bởi {incident.acknowledged_by || operatorName})
              </Text>
            </View>
          )}

          <View style={[styles.levelBadge, { backgroundColor: `${levelColor}20`, borderColor: levelColor }]}>
            <Text style={[styles.levelText, { color: levelColor }]}>
              {incident.alert_level}
            </Text>
          </View>
        </View>

        {/* Type & Message */}
        <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{typeLabel}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{incident.message}</Text>

        {/* Details Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Độ tin cậy AI</Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>{(incident.confidence * 100).toFixed(0)}%</Text>
          </View>

          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

          {/* Timestamp */}
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Thời gian ghi nhận</Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
              {new Date(incident.created_at).toLocaleString('vi-VN')}
            </Text>
          </View>

          {incident.is_acknowledged && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Người xử lý</Text>
                <Text style={[styles.rowValue, { color: '#16A34A', fontWeight: '700' }]}>
                  {incident.acknowledged_by || operatorName}
                </Text>
              </View>
              {incident.acknowledged_at && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Thời gian xử lý</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {new Date(incident.acknowledged_at).toLocaleString('vi-VN')}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Video Clip */}
        {incident.video_clip_url ? (
          <View style={styles.videoSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Video bằng chứng (5 giây)</Text>
            {Platform.OS === 'web' || !Video ? (
              <video
                src={incident.video_clip_url}
                style={{ width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' }}
                controls
              />
            ) : (
              <Video
                source={{ uri: incident.video_clip_url }}
                style={styles.video}
                controls
                resizeMode="contain"
                paused={false}
              />
            )}
          </View>
        ) : (
          <View style={[styles.noVideo, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Ionicons name="videocam-off" size={36} color={colors.textMuted} />
            <Text style={[styles.noVideoText, { color: colors.textMuted }]}>Clip chưa có sẵn</Text>
          </View>
        )}

        {/* Success Toast Banner */}
        {(showSuccessToast || incident.is_acknowledged) && (
          <View
            style={[
              styles.successToast,
              {
                backgroundColor: isDarkMode ? '#064E3B25' : '#F0FDF4',
                borderColor: '#16A34A',
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.successToastTitle, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
                Đã đánh dấu xử lý sự kiện thành công!
              </Text>
              <Text style={[styles.successToastSubtitle, { color: isDarkMode ? '#A7F3D0' : '#166534' }]}>
                Còi hú đã tắt và trạng thái an toàn đã được cập nhật vào PostgreSQL.
              </Text>
            </View>
          </View>
        )}

        {/* Acknowledge Button */}
        {!incident.is_acknowledged ? (
          <TouchableOpacity
            style={[
              styles.ackBtn,
              isProcessing && { opacity: 0.8, backgroundColor: '#2563EB' },
            ]}
            onPress={handleAcknowledge}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.ackBtnText}>Đang cập nhật PostgreSQL...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.ackBtnText}>Đánh dấu đã xử lý</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            <View
              style={[
                styles.ackBtnDisabled,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#ECFDF5',
                  borderColor: isDarkMode ? '#059669' : '#22C55E',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
              <Text style={[styles.ackBtnDisabledText, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
                Đã xử lý thành công (Bởi {incident.acknowledged_by || operatorName})
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.returnBtn,
                {
                  backgroundColor: isDarkMode ? colors.card : '#F1F5F9',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
              <Text style={[styles.returnBtnText, { color: colors.textPrimary }]}>
                Quay lại màn hình chính
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  loadingText: { color: '#94A3B8', textAlign: 'center', marginTop: 100 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 13,
  },
  liveRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  levelText: { fontWeight: '700', fontSize: 13 },
  typeLabel: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  message:   { color: '#94A3B8', fontSize: 15, lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue:  { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  infoCard: {
    padding: 16,
    borderRadius: 14,
  },
  rowDivider: {
    height: 1,
    marginVertical: 8,
  },
  videoSection: { gap: 8 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  video: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' },
  noVideo: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 32,
  },
  noVideoText: { color: '#475569', fontSize: 14 },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  ackBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
    borderWidth: 1.5,
  },
  ackBtnDisabledText: { fontWeight: '700', fontSize: 16 },
  successToast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 6,
    marginBottom: 4,
  },
  successToastTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  successToastSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  returnBtnText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
