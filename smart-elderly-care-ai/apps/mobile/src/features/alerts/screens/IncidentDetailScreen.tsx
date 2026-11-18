// ==============================================================================
// TỆP: IncidentDetailScreen.tsx
// PHÂN HỆ: Màn hình Chi tiết Sự cố Khẩn cấp & Bằng chứng Video Clip 5 giây
// TÁC GIẢ: Phan Nguyễn Giáng My
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { incidentsApi, BASE_URL } from '../../../services/api';
import { useTheme } from '../../../store/useThemeStore';
import { useAlertStore, useAuthStore } from '../../../store';
import { useVitalStore } from '../../../store/useVitalStore';
import type { Incident } from '../../../store/useAlertStore';
import { IncidentEvidenceViewer } from '../components/IncidentEvidenceViewer';
import { IncidentConfirmModal } from '../components/IncidentConfirmModal';

const ALERT_TYPE_LABELS: Record<string, string> = {
  FALL_DETECTED: '🤸 Cảnh báo té ngã khẩn cấp',
  ABNORMAL_HR: '💓 Nhịp tim bất thường',
  HIGH_HEART_RATE: '💓 Nhịp tim tăng cao',
  LOW_SPO2: '💨 SpO₂ thấp',
  HIGH_TEMPERATURE: '🌡️ Nhiệt độ cao',
  EMERGENCY_SOUND: '📢 Âm thanh khẩn cấp',
  ACOUSTIC_DISTRESS: '📢 Âm thanh kêu cứu YAMNet',
  INACTIVITY: '⏱️ Không có hoạt động',
};

const getHandlerDisplayName = (
  inc: Incident | null,
  currentUserName?: string | null,
  currentUserId?: string | number | null
): string => {
  if (!inc) return 'Người phụ trách';
  if (inc.acknowledged_by_name?.trim()) return inc.acknowledged_by_name;
  const raw = inc.acknowledged_by;
  if (!raw || String(raw).trim() === '') return 'Người phụ trách';
  const rawStr = String(raw).trim();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawStr);
  if (isUUID) {
    if (currentUserId && rawStr.toLowerCase() === String(currentUserId).toLowerCase() && currentUserName) {
      return currentUserName;
    }
    return 'Bác sĩ / Người phụ trách';
  }
  return rawStr;
};

const resolveMediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('file://')) {
    return url;
  }
  const origin = (BASE_URL || '').replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function IncidentDetailScreen({ route, navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const { acknowledgeIncident, reopenIncident, setSirenActive, incidents, fetchNotifications } = useAlertStore();
  const { userName, userId } = useAuthStore();
  const operatorName = userName || 'Người chăm sóc';

  const params = route.params ?? {};
  const incidentId = params.incidentId ?? params.id;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<'ACK' | 'REOPEN' | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<'ACKED' | 'REOPENED' | 'ERROR' | null>(null);
  const [imgError, setImgError] = useState(false);
  const [viewMode, setViewMode] = useState<'ai_box' | 'video'>('ai_box');

  const handlerDisplayName = getHandlerDisplayName(incident, userName, userId);

  const fetchIncident = async () => {
    try {
      const res = await incidentsApi.get(incidentId);
      setIncident(res.data || null);
    } catch (err) {
      console.warn('Lỗi khi tải chi tiết sự cố từ backend API:', err);
      setIncident(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setImgError(false);
    if (!incidentId) { setLoading(false); return; }
    const storeInc = incidents.find((i) => i.id === incidentId);

    if (params.alert_type || params.type || params.confidence != null || params.message) {
      let conf: number | undefined;
      if (typeof params.confidence === 'number') {
        conf = params.confidence > 1 ? params.confidence / 100 : params.confidence;
      } else if (typeof params.confidence === 'string') {
        const p = parseFloat(params.confidence.replace('%', ''));
        conf = isNaN(p) ? undefined : (p > 1 ? p / 100 : p);
      }

      const mediaThumb = params.thumbnail_url ?? storeInc?.thumbnail_url ?? null;
      const mediaVideo = params.video_clip_url ?? storeInc?.video_clip_url ?? null;

      setIncident({
        id: incidentId,
        device_id: params.device_id ?? storeInc?.device_id,
        alert_type: params.alert_type ?? (params.type === 'FALL' ? 'FALL_DETECTED' : params.type) ?? 'FALL_DETECTED',
        alert_level: params.alert_level ?? 'CRITICAL',
        message: params.message ?? 'Cảnh báo khẩn cấp ghi nhận từ hệ thống cảm biến.',
        confidence: conf,
        video_clip_url: mediaVideo,
        thumbnail_url: mediaThumb,
        is_acknowledged: storeInc ? storeInc.is_acknowledged : (params.is_acknowledged ?? false),
        acknowledged_by: storeInc?.acknowledged_by ?? params.acknowledged_by ?? null,
        acknowledged_by_name: storeInc?.acknowledged_by_name ?? params.acknowledged_by_name ?? null,
        acknowledged_at: storeInc?.acknowledged_at ?? params.acknowledged_at,
        created_at: params.created_at ?? params.time ?? new Date().toISOString(),
      });
      setLoading(false);
      if (!mediaThumb || !mediaVideo) fetchIncident();
      return;
    }

    if (storeInc) { setIncident(storeInc); setLoading(false); return; }
    fetchIncident();
  }, [incidentId, incidents]);

  // Optimistic UI (0ms): Đóng modal & cập nhật trạng thái tức thì, gọi API đồng bộ ngầm ở nền
  const performAcknowledge = async () => {
    if (!incident || incident.is_acknowledged) return;
    const prevSnapshot = { ...incident };
    setConfirmModal(null);

    try { if (Platform.OS !== 'web') Vibration.cancel(); } catch {}
    setSirenActive(false);
    try { useVitalStore.getState().setVitals({ fall_detected: false, acoustic_status: 'Bình thường' }); } catch {}

    const nowIso = new Date().toISOString();
    setIncident((prev) => prev ? {
      ...prev,
      is_acknowledged: true,
      acknowledged_by: operatorName,
      acknowledged_by_name: operatorName,
      acknowledged_at: nowIso,
    } : null);
    setFeedbackBanner('ACKED');
    acknowledgeIncident(incident.id, 'Đã kiểm tra an toàn', operatorName);

    try {
      await incidentsApi.acknowledge(incident.id, 'Đã kiểm tra an toàn');
      try { fetchNotifications(); } catch {}
    } catch (apiErr) {
      console.warn('Backend API acknowledge failed, rolling back:', apiErr);
      setIncident(prevSnapshot);
      setFeedbackBanner('ERROR');
    }
  };

  // Optimistic UI (0ms): Đóng modal & kích hoạt lại cảnh báo tức thì, đồng bộ API ngầm ở nền
  const performReopen = async () => {
    if (!incident || !incident.is_acknowledged) return;
    const prevSnapshot = { ...incident };
    setConfirmModal(null);

    setIncident((prev) => prev ? {
      ...prev,
      is_acknowledged: false,
      acknowledged_by: undefined,
      acknowledged_by_name: undefined,
      acknowledged_at: undefined,
    } : null);
    setFeedbackBanner('REOPENED');
    reopenIncident(incident.id, 'Chưa an toàn - Người nhà đã mở lại cảnh báo khẩn cấp');

    if (incident.alert_level === 'CRITICAL' || incident.alert_type === 'FALL_DETECTED') {
      setSirenActive(true);
      try { useVitalStore.getState().setVitals({ fall_detected: incident.alert_type === 'FALL_DETECTED' }); } catch {}
    }

    try {
      await incidentsApi.reopen(incident.id, 'Chưa an toàn - Người nhà đã mở lại cảnh báo khẩn cấp');
      try { fetchNotifications(); } catch {}
    } catch (apiErr) {
      console.warn('Backend API reopen failed, rolling back:', apiErr);
      setIncident(prevSnapshot);
      setFeedbackBanner('ERROR');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>Đang tải chi tiết sự cố...</Text>
      </SafeAreaView>
    );
  }

  if (!incident) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={54} color="#94A3B8" />
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>Không tìm thấy sự cố</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          Sự cố có thể đã được xử lý xong hoặc không tồn tại trong hệ thống.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.notFoundBtn}>
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const typeLabel = ALERT_TYPE_LABELS[incident.alert_type] ?? incident.alert_type;
  const videoUrl = resolveMediaUrl(incident.video_clip_url);
  const evidenceImg = imgError ? null : resolveMediaUrl(incident.thumbnail_url);

  const activeFeedbackKey: 'ACKED' | 'REOPENED' | 'ERROR' | null =
    feedbackBanner === 'ERROR'
      ? 'ERROR'
      : feedbackBanner === 'ACKED' || incident.is_acknowledged
      ? 'ACKED'
      : feedbackBanner === 'REOPENED'
      ? 'REOPENED'
      : null;

  const feedbackConfig = activeFeedbackKey
    ? {
        ACKED: {
          bg: isDarkMode ? '#064E3B25' : '#F0FDF4',
          border: '#16A34A',
          icon: 'checkmark-circle' as const,
          iconColor: '#16A34A',
          titleColor: isDarkMode ? '#86EFAC' : '#15803D',
          subColor: isDarkMode ? '#A7F3D0' : '#166534',
          title: 'Đã xác nhận xử lý sự cố',
          sub: 'Còi báo động đã tắt và trạng thái an toàn đã được lưu trên hệ thống.',
        },
        REOPENED: {
          bg: isDarkMode ? '#450A0A35' : '#FEF2F2',
          border: '#EF4444',
          icon: 'alert-circle' as const,
          iconColor: '#EF4444',
          titleColor: isDarkMode ? '#FCA5A5' : '#B91C1C',
          subColor: isDarkMode ? '#FECACA' : '#991B1B',
          title: 'Đã kích hoạt lại cảnh báo',
          sub: 'Còi báo động tại nhà và thông báo khẩn cấp đã được bật lại.',
        },
        ERROR: {
          bg: isDarkMode ? '#451A0335' : '#FFFBEB',
          border: '#F59E0B',
          icon: 'warning' as const,
          iconColor: '#D97706',
          titleColor: isDarkMode ? '#FCD34D' : '#B45309',
          subColor: isDarkMode ? '#FDE68A' : '#92400E',
          title: 'Không thể đồng bộ với máy chủ',
          sub: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
        },
      }[activeFeedbackKey]
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chi tiết sự kiện</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          {!incident.is_acknowledged ? (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2', borderColor: '#EF4444' }]}>
              <View style={styles.liveRedDot} />
              <Text style={[styles.statusBadgeText, { color: isDarkMode ? '#FCA5A5' : '#DC2626' }]}>
                Khẩn cấp • Chưa xử lý
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#ECFDF5', borderColor: '#22C55E' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={[styles.statusBadgeText, { color: isDarkMode ? '#86EFAC' : '#16A34A' }]}>
                Đã xử lý an toàn ({handlerDisplayName})
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{typeLabel}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{incident.message}</Text>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          {incident.confidence != null && (
            <>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Độ tin cậy AI</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={[styles.rowValue, { color: '#EF4444', fontWeight: '700' }]}>{(incident.confidence * 100).toFixed(0)}% (AI)</Text>
                </View>
              </View>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            </>
          )}

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Thời gian ghi nhận</Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>{new Date(incident.created_at).toLocaleString('vi-VN')}</Text>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Vị trí cảm biến</Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>{incident.device_id ? `Thiết bị: ${incident.device_id}` : 'Cảm biến giám sát'}</Text>
          </View>

          {incident.is_acknowledged && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Người xử lý</Text>
                <Text style={[styles.rowValue, { color: '#16A34A', fontWeight: '700' }]}>{handlerDisplayName}</Text>
              </View>
              {incident.acknowledged_at && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Thời gian xử lý</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{new Date(incident.acknowledged_at).toLocaleString('vi-VN')}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <IncidentEvidenceViewer
          incident={incident}
          viewMode={viewMode}
          setViewMode={setViewMode}
          evidenceImg={evidenceImg}
          videoUrl={videoUrl}
          onImageError={() => setImgError(true)}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {feedbackConfig && (
          <View style={[styles.successToast, { backgroundColor: feedbackConfig.bg, borderColor: feedbackConfig.border }]}>
            <Ionicons name={feedbackConfig.icon} size={24} color={feedbackConfig.iconColor} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.successToastTitle, { color: feedbackConfig.titleColor }]}>{feedbackConfig.title}</Text>
              <Text style={[styles.successToastSubtitle, { color: feedbackConfig.subColor }]}>{feedbackConfig.sub}</Text>
            </View>
          </View>
        )}

        {!incident.is_acknowledged ? (
          <TouchableOpacity style={styles.ackBtn} onPress={() => setConfirmModal('ACK')} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.ackBtnText}>Đánh dấu đã xử lý</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            <View style={[styles.ackBtnDisabled, { backgroundColor: isDarkMode ? '#1E293B' : '#ECFDF5', borderColor: isDarkMode ? '#059669' : '#22C55E' }]}>
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
              <Text style={[styles.ackBtnDisabledText, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
                Đã xử lý an toàn (Bởi {handlerDisplayName})
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.reopenBtn, isDarkMode && { backgroundColor: '#450A0A25', borderColor: '#DC2626' }]}
              onPress={() => setConfirmModal('REOPEN')}
              activeOpacity={0.8}
            >
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.reopenBtnText}>Mở lại cảnh báo (Chưa an toàn)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.returnBtn, { backgroundColor: isDarkMode ? colors.card : '#F1F5F9', borderColor: colors.border }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
              <Text style={[styles.returnBtnText, { color: colors.textPrimary }]}>Quay lại màn hình chính</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <IncidentConfirmModal
        confirmModal={confirmModal}
        isDarkMode={isDarkMode}
        onClose={() => setConfirmModal(null)}
        onConfirmAck={performAcknowledge}
        onConfirmReopen={performReopen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backBtn: { marginRight: 12 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  loadingText: { color: '#94A3B8', textAlign: 'center', marginTop: 100 },
  notFoundBtn: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#FF7A00', borderRadius: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  statusBadgeText: { fontWeight: '700', fontSize: 13 },
  liveRedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  typeLabel: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  message: { color: '#94A3B8', fontSize: 15, lineHeight: 22 },
  infoCard: { padding: 16, borderRadius: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  rowDivider: { height: 1, marginVertical: 8 },
  ackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, gap: 8, marginTop: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  ackBtnDisabled: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 16, gap: 8, marginTop: 8, borderWidth: 1.5 },
  ackBtnDisabledText: { fontWeight: '700', fontSize: 16 },
  successToast: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, marginTop: 6, marginBottom: 4 },
  successToastTitle: { fontWeight: '700', fontSize: 14 },
  successToastSubtitle: { fontSize: 12, marginTop: 2 },
  returnBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  returnBtnText: { fontWeight: '600', fontSize: 15 },
  reopenBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#EF4444', backgroundColor: '#FEF2F2', gap: 8 },
  reopenBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
});
