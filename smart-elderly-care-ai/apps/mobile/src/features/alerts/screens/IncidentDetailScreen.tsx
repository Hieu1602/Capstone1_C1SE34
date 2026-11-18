// ==============================================================================
// TỆP: IncidentDetailScreen.tsx
// PHÂN HỆ: Màn hình Chi tiết Sự cố Khẩn cấp & Bằng chứng Video Clip 5 giây
// TÁC GIẢ: Phan Nguyễn Giáng My
// ==============================================================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Platform, Vibration, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { incidentsApi, BASE_URL } from '../../../services/api';
import { useTheme } from '../../../store/useThemeStore';
import { useAlertStore, useAuthStore } from '../../../store';
import { useVitalStore } from '../../../store/useVitalStore';
import type { Incident } from '../../../store/useAlertStore';

let Video: any = null;
if (Platform.OS !== 'web') {
  try { Video = require('react-native-video').default; } catch (e) {}
}

const LEVEL_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#EAB308', LOW: '#22C55E',
};

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

export default function IncidentDetailScreen({ route, navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const { acknowledgeIncident, reopenIncident, setSirenActive, incidents, fetchNotifications } = useAlertStore();
  const { userName, userId } = useAuthStore();
  const operatorName = userName || 'Người chăm sóc';

  const params = route.params ?? {};
  const incidentId = params.incidentId ?? params.id;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [isReopening, setIsReopening] = useState(false);

  const getHandlerDisplayName = (
    inc: Incident | null,
    currentUserName?: string | null,
    currentUserId?: string | number | null
  ): string => {
    if (!inc) return 'Người phụ trách';
    if (inc.acknowledged_by_name && inc.acknowledged_by_name.trim() !== '') {
      return inc.acknowledged_by_name;
    }
    const raw = inc.acknowledged_by;
    if (!raw || String(raw).trim() === '') {
      return 'Người phụ trách';
    }
    const rawStr = String(raw).trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawStr);
    if (isUUID) {
      if (
        currentUserId &&
        rawStr.toLowerCase() === String(currentUserId).toLowerCase() &&
        currentUserName
      ) {
        return currentUserName;
      }
      return 'Bác sĩ / Người phụ trách';
    }
    return rawStr;
  };

  const handlerDisplayName = getHandlerDisplayName(incident, userName, userId);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<'ACK' | 'REOPEN' | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<'ACKED' | 'REOPENED' | 'ERROR' | null>(null);
  const [imgError, setImgError] = useState(false);
  const [viewMode, setViewMode] = useState<'ai_box' | 'video'>('ai_box');

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

      if (!mediaThumb || !mediaVideo) {
        fetchIncident();
      }
      return;
    }

    if (storeInc) { setIncident(storeInc); setLoading(false); return; }
    fetchIncident();
  }, [incidentId, incidents]);

  const fetchIncident = async () => {
    try {
      const res = await incidentsApi.get(incidentId);
      setIncident(res.data || null);
    } catch (err) {
      console.warn('Lỗi khi tải chi tiết sự cố từ backend API:', err);
      setIncident(null);
    } finally { setLoading(false); }
  };

  // Optimistic UI (0ms): Đóng modal & cập nhật trạng thái tức thì, gọi API đồng bộ ngầm ở nền
  const performAcknowledge = async () => {
    if (!incident || incident.is_acknowledged) return;
    const prevSnapshot = { ...incident };
    setConfirmModal(null);

    try { if (Platform.OS !== 'web') Vibration.cancel(); } catch {}
    setSirenActive(false);
    try {
      useVitalStore.getState().setVitals({ fall_detected: false, acoustic_status: 'Bình thường' });
    } catch {}

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

  const handleAcknowledge = () => {
    if (!incident || incident.is_acknowledged) return;
    setConfirmModal('ACK');
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
      try {
        useVitalStore.getState().setVitals({
          fall_detected: incident.alert_type === 'FALL_DETECTED',
        });
      } catch {}
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

  const handleReopen = () => {
    if (!incident || !incident.is_acknowledged) return;
    setConfirmModal('REOPEN');
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

  const levelColor = LEVEL_COLORS[incident.alert_level] ?? '#64748B';
  const typeLabel = ALERT_TYPE_LABELS[incident.alert_type] ?? incident.alert_type;
  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('file://')) {
      return url;
    }
    const origin = (BASE_URL || '').replace(/\/api\/v1\/?$/, '');
    return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const videoUrl = resolveMediaUrl(incident.video_clip_url);
  const evidenceImg = imgError ? null : resolveMediaUrl(incident.thumbnail_url);

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
        {/* Badge trạng thái duy nhất (Không trùng lặp) */}
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

        {/* Evidence Video & AI Snapshot */}
        <View style={styles.videoSection}>
          <View style={styles.evidenceHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bằng chứng hình ảnh / clip sự cố</Text>
            {incident.confidence != null && (
              <View style={styles.confidenceBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.confidenceBadgeText}>Độ tin cậy: {(incident.confidence * 100).toFixed(0)}%</Text>
              </View>
            )}
          </View>

          {/* Tab selector */}
          <View style={[styles.tabSelector, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
            {[
              { mode: 'ai_box' as const, icon: 'scan-outline' as const, label: 'Ảnh bằng chứng AI' },
              { mode: 'video' as const, icon: 'videocam-outline' as const, label: 'Video Clip trích xuất' },
            ].map((tab) => {
              const active = viewMode === tab.mode;
              return (
                <TouchableOpacity key={tab.mode} style={[styles.tabItem, active && styles.tabItemActive]} onPress={() => setViewMode(tab.mode)} activeOpacity={0.8}>
                  <Ionicons name={tab.icon} size={15} color={active ? '#FFF' : (isDarkMode ? '#94A3B8' : '#64748B')} style={{ marginRight: 6 }} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {viewMode === 'ai_box' ? (
            evidenceImg ? (
              <View style={[styles.evidenceCard, { backgroundColor: '#0B0F19', borderColor: colors.border }]}>
                <Image source={{ uri: evidenceImg }} style={styles.evidenceImage} resizeMode="cover" onError={() => setImgError(true)} />
                <View style={styles.evidenceOverlayHeader}>
                  <View style={styles.recDot} /><Text style={styles.evidenceOsdText}>REC ● TRÍCH XUẤT BUFFER</Text>
                  <Text style={[styles.evidenceOsdText, { marginLeft: 'auto' }]}>{incident.device_id || 'CAM-01'}</Text>
                </View>

                {incident.alert_type === 'FALL_DETECTED' && (
                  <View style={styles.aiBoundingBox}>
                    <View style={styles.boxTag}>
                      <Ionicons name="warning" size={11} color="#FFF" style={{ marginRight: 3 }} />
                      <Text style={styles.boxTagText}>FALL DETECTED{incident.confidence != null ? ` (${(incident.confidence * 100).toFixed(1)}%)` : ''}</Text>
                    </View>
                    {[
                      { top: 12, left: '46%' }, { top: 38, left: '32%' }, { top: 38, left: '60%' },
                      { top: 82, left: '40%' }, { top: 110, left: '26%' }, { top: 125, left: '72%' },
                    ].map((pos, idx) => (
                      <View key={idx} style={[styles.skeletonJoint, pos as any]} />
                    ))}
                  </View>
                )}

                <View style={styles.evidenceOverlayFooter}>
                  <View style={styles.aiTag}>
                    <Ionicons name="scan-outline" size={13} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.aiTagText}>YOLO-Pose AI • Bằng chứng sự cố</Text>
                  </View>
                  {incident.confidence != null && (
                    <Text style={styles.evidenceOsdText}>Độ tin cậy: {(incident.confidence * 100).toFixed(0)}%</Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={[styles.evidenceCard, styles.evidenceFallback, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: colors.border }]}>
                <Ionicons name="image-outline" size={38} color={colors.textMuted} />
                <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>Không có hình ảnh bằng chứng cho sự cố này</Text>
              </View>
            )
          ) : (
            videoUrl ? (
              <View style={[styles.evidenceCard, { backgroundColor: '#000', borderColor: colors.border }]}>
                {Platform.OS === 'web' || !Video ? (
                  <video src={videoUrl} style={{ width: '100%', height: 230, borderRadius: 12, backgroundColor: '#000', objectFit: 'contain' }} controls autoPlay loop />
                ) : (
                  <Video source={{ uri: videoUrl }} style={styles.video} controls resizeMode="contain" paused={false} />
                )}
                <View style={styles.videoOsdBar}>
                  <View style={styles.recDot} /><Text style={styles.evidenceOsdText}>CLIP ĐÃ LƯU VÀO HỒ SƠ SỰ CỐ</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.evidenceCard, styles.evidenceFallback, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: colors.border }]}>
                <Ionicons name="videocam-off-outline" size={38} color={colors.textMuted} />
                <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>Không có video clip trích xuất cho sự cố này</Text>
              </View>
            )
          )}
        </View>

        {/* Inline Feedback Banner */}
        {(feedbackBanner === 'ACKED' || (incident.is_acknowledged && feedbackBanner !== 'ERROR')) && (
          <View style={[styles.successToast, { backgroundColor: isDarkMode ? '#064E3B25' : '#F0FDF4', borderColor: '#16A34A' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.successToastTitle, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
                Đã xác nhận xử lý sự cố
              </Text>
              <Text style={[styles.successToastSubtitle, { color: isDarkMode ? '#A7F3D0' : '#166534' }]}>
                Còi báo động đã tắt và trạng thái an toàn đã được lưu trên hệ thống.
              </Text>
            </View>
          </View>
        )}

        {feedbackBanner === 'REOPENED' && !incident.is_acknowledged && (
          <View style={[styles.successToast, { backgroundColor: isDarkMode ? '#450A0A35' : '#FEF2F2', borderColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.successToastTitle, { color: isDarkMode ? '#FCA5A5' : '#B91C1C' }]}>
                Đã kích hoạt lại cảnh báo
              </Text>
              <Text style={[styles.successToastSubtitle, { color: isDarkMode ? '#FECACA' : '#991B1B' }]}>
                Còi báo động tại nhà và thông báo khẩn cấp đã được bật lại.
              </Text>
            </View>
          </View>
        )}

        {feedbackBanner === 'ERROR' && (
          <View style={[styles.successToast, { backgroundColor: isDarkMode ? '#451A0335' : '#FFFBEB', borderColor: '#F59E0B' }]}>
            <Ionicons name="warning" size={24} color="#D97706" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.successToastTitle, { color: isDarkMode ? '#FCD34D' : '#B45309' }]}>
                Không thể đồng bộ với máy chủ
              </Text>
              <Text style={[styles.successToastSubtitle, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
                Vui lòng kiểm tra kết nối mạng và thử lại.
              </Text>
            </View>
          </View>
        )}

        {/* Action Button */}
        {!incident.is_acknowledged ? (
          <TouchableOpacity style={styles.ackBtn} onPress={handleAcknowledge} activeOpacity={0.8}>
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

            {/* Nút Mở lại cảnh báo (Chưa an toàn) */}
            <TouchableOpacity
              style={[
                styles.reopenBtn,
                isDarkMode && { backgroundColor: '#450A0A25', borderColor: '#DC2626' },
              ]}
              onPress={handleReopen}
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

      {/* Custom Confirm Modal (replaces window.confirm / Alert.alert) */}
      <Modal
        transparent
        visible={confirmModal !== null}
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmModal(null)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' },
            ]}
            onPress={() => {}}
          >
            <View
              style={[
                styles.modalIconWrap,
                {
                  backgroundColor:
                    confirmModal === 'REOPEN'
                      ? isDarkMode ? '#7C2D1240' : '#FFF7ED'
                      : isDarkMode ? '#064E3B40' : '#ECFDF5',
                },
              ]}
            >
              <Ionicons
                name={confirmModal === 'REOPEN' ? 'warning' : 'shield-checkmark'}
                size={30}
                color={confirmModal === 'REOPEN' ? '#EA580C' : '#16A34A'}
              />
            </View>

            <Text style={[styles.modalTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
              {confirmModal === 'REOPEN' ? 'Mở lại cảnh báo khẩn cấp?' : 'Xác nhận an toàn?'}
            </Text>

            <Text style={[styles.modalBody, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
              {confirmModal === 'REOPEN'
                ? 'Hệ thống sẽ kích hoạt lại còi báo động tại nhà và gửi thông báo ứng cứu cho gia đình.'
                : 'Xác nhận người cao tuổi đã an toàn, tắt còi báo động và lưu trạng thái xử lý.'}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
                ]}
                onPress={() => setConfirmModal(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelText, { color: isDarkMode ? '#E2E8F0' : '#475569' }]}>
                  Hủy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: confirmModal === 'REOPEN' ? '#DC2626' : '#16A34A' },
                ]}
                onPress={() => {
                  const action = confirmModal;
                  setConfirmModal(null);
                  if (action === 'REOPEN') {
                    performReopen();
                  } else if (action === 'ACK') {
                    performAcknowledge();
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>
                  {confirmModal === 'REOPEN' ? 'Xác nhận mở lại' : 'Xác nhận an toàn'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  levelBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  levelText: { fontWeight: '700', fontSize: 13 },
  typeLabel: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  message: { color: '#94A3B8', fontSize: 15, lineHeight: 22 },
  infoCard: { padding: 16, borderRadius: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  rowDivider: { height: 1, marginVertical: 8 },
  videoSection: { gap: 10 },
  evidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444420', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444' },
  confidenceBadgeText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  tabSelector: { flexDirection: 'row', borderRadius: 8, padding: 3 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6 },
  tabItemActive: { backgroundColor: '#2563EB', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFF', fontWeight: '700' },
  evidenceCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, position: 'relative', backgroundColor: '#0F172A' },
  evidenceFallback: { height: 180, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { marginTop: 8, fontSize: 13, fontWeight: '500' },
  evidenceImage: { width: '100%', height: 230, backgroundColor: '#1E293B' },
  video: { width: '100%', height: 230, borderRadius: 12, backgroundColor: '#000' },
  videoOsdBar: { position: 'absolute', bottom: 8, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  evidenceOverlayHeader: { position: 'absolute', top: 8, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 6 },
  evidenceOsdText: { color: '#FFF', fontSize: 11, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  aiBoundingBox: { position: 'absolute', top: '32%', left: '24%', width: '54%', height: '52%', borderWidth: 2, borderColor: '#EF4444', borderRadius: 4, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  boxTag: { position: 'absolute', top: -18, left: -2, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  boxTagText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  skeletonJoint: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#FFF' },
  evidenceOverlayFooter: { position: 'absolute', bottom: 8, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  aiTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.9)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  aiTagText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  ackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, gap: 8, marginTop: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  ackBtnDisabled: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 16, gap: 8, marginTop: 8, borderWidth: 1.5 },
  ackBtnDisabledText: { fontWeight: '700', fontSize: 16 },
  successToast: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, marginTop: 6, marginBottom: 4 },
  successToastTitle: { fontWeight: '700', fontSize: 14 },
  successToastSubtitle: { fontSize: 12, marginTop: 2 },
  returnBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  returnBtnText: { fontWeight: '600', fontSize: 15 },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    gap: 8,
  },
  reopenBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1.2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
