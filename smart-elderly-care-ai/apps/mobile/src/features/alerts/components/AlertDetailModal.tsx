// AlertDetailModal.tsx
// Modal xem nhanh & Đánh giá lâm sàng sự cố/cảnh báo tại chỗ (không chuyển trang)

import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors } from '../../../theme/colors';
import {
  getAlertConfig,
  analyzeAlertDetails,
  formatFriendlyTime,
} from '../utils/alertConfig';

interface AlertDetailModalProps {
  visible: boolean;
  item: any;
  onClose: () => void;
  onConfirmHandled: (item: any) => Promise<void> | void;
  isResponding?: boolean;
  isDarkMode?: boolean;
  colors?: any;
  navigation?: any;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  visible,
  item,
  onClose,
  onConfirmHandled,
  isResponding = false,
  isDarkMode = false,
  colors = {},
  navigation,
}) => {
  const { t } = useTranslation();

  if (!item) return null;

  const assessment = analyzeAlertDetails(item);
  const cfg = getAlertConfig(item.alert_type, item.notes, item.message);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.alertDetailModalCard,
            isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
          ]}
        >
          {/* Header: Icon, Tiêu đề, Nút Đóng X (Không tự ý đánh dấu đã xử lý khi bấm X) */}
          <View style={styles.alertDetailHeader}>
            <View
              style={[
                styles.alertDetailIconCircle,
                { backgroundColor: assessment.severityBg },
              ]}
            >
              <Ionicons
                name={cfg.iconName as any}
                size={22}
                color={assessment.severityColor}
              />
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={[
                  styles.alertDetailTitle,
                  isDarkMode && { color: colors.textPrimary || '#FFFFFF' },
                ]}
                numberOfLines={2}
              >
                {cfg.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View
                  style={[
                    styles.alertDetailSeverityBadge,
                    { backgroundColor: assessment.severityBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.alertDetailSeverityText,
                      { color: assessment.severityColor },
                    ]}
                  >
                    {assessment.severityLabel}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.alertDetailCloseBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {/* 1. Nội dung thông báo tóm tắt */}
            <View
              style={[
                styles.alertDetailSection,
                isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="information-circle" size={16} color={Colors.primary} />
                <Text
                  style={[
                    styles.alertDetailSectionTitle,
                    isDarkMode && { color: colors.textPrimary || '#FFFFFF' },
                  ]}
                >
                  Nội dung cảnh báo
                </Text>
              </View>
              <Text style={[styles.alertDetailBody, isDarkMode && { color: '#E2E8F0' }]}>
                {item.message}
              </Text>
            </View>

            {/* 2. Thông số / chỉ số đo được */}
            {assessment.metrics.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text
                  style={[
                    styles.alertDetailSectionSub,
                    isDarkMode && { color: colors.textSecondary || '#94A3B8' },
                  ]}
                >
                  THÔNG SỐ THỜI ĐIỂM GHI NHẬN
                </Text>
                <View style={styles.metricsGrid}>
                  {assessment.metrics.map((m, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.metricGridItem,
                        isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                        m.status === 'danger' && {
                          borderColor: '#F87171',
                          backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2',
                        },
                      ]}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={15}
                        color={
                          m.status === 'danger'
                            ? '#DC2626'
                            : m.status === 'warning'
                            ? '#EA580C'
                            : '#10B981'
                        }
                      />
                      <Text
                        style={[
                          styles.metricGridLabel,
                          isDarkMode && { color: colors.textSecondary || '#94A3B8' },
                        ]}
                      >
                        {m.label}
                      </Text>
                      <Text
                        style={[
                          styles.metricGridValue,
                          {
                            color:
                              m.status === 'danger'
                                ? '#DC2626'
                                : m.status === 'warning'
                                ? '#EA580C'
                                : '#10B981',
                          },
                        ]}
                      >
                        {m.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 3. Tóm tắt nguyên nhân & Đánh giá Bác sĩ AI */}
            <View
              style={[
                styles.aiAdviceBox,
                isDarkMode && {
                  backgroundColor: 'rgba(234, 88, 12, 0.1)',
                  borderColor: 'rgba(234, 88, 12, 0.3)',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="sparkles" size={16} color="#EA580C" />
                <Text style={styles.aiAdviceHeader}>
                  Nguyên nhân & Hướng dẫn Bác sĩ AI
                </Text>
              </View>
              <Text style={[styles.aiAdviceText, isDarkMode && { color: '#FED7AA' }]}>
                • <Text style={{ fontWeight: '700' }}>Nguyên nhân:</Text> {assessment.rootCause}
              </Text>
              <Text
                style={[
                  styles.aiAdviceText,
                  { marginTop: 4 },
                  isDarkMode && { color: '#FED7AA' },
                ]}
              >
                • <Text style={{ fontWeight: '700' }}>Xử lý ngay:</Text> {assessment.doctorAdvice}
              </Text>
            </View>

            {/* 4. Thông tin nguồn & thời gian */}
            <View style={styles.deviceMetaRow}>
              <Ionicons name="time-outline" size={13} color="#94A3B8" />
              <Text style={styles.deviceMetaText}>
                Thời điểm: {formatFriendlyTime(item.created_at, (k, c) => (c === undefined ? t(k) : t(k, { count: c })))} • Nguồn:{' '}
                {item.device_id || 'BLE Smart Band'}
              </Text>
            </View>
          </ScrollView>

          {/* 5. Khối Xác nhận đã nhận / xác nhận xử lý */}
          <View style={styles.alertDetailFooter}>
            {item.is_acknowledged ? (
              <View style={styles.handledStatusBox}>
                <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
                <Text style={styles.handledStatusText}>
                  Đã xác nhận xử lý
                  {item.acknowledged_by ? ` bởi ${item.acknowledged_by}` : ''}{' '}
                  lúc {formatFriendlyTime(item.acknowledged_at, (k, c) => (c === undefined ? t(k) : t(k, { count: c })))}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.confirmHandledBtn}
                onPress={() => onConfirmHandled(item)}
                activeOpacity={0.85}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                    <Text style={styles.confirmHandledBtnText}>
                      Xác nhận đã nhận & xử lý
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Nút phụ: Xem đồ thị chi tiết nếu muốn */}
            {(item.alert_type?.includes('HEART') ||
              item.alert_type?.includes('SPO2') ||
              item.alert_type?.includes('TEMP') ||
              item.alert_type === 'CRITICAL_TRIAD' ||
              item.alert_type === 'EXERTION_HYPOXIA') && navigation && (
              <TouchableOpacity
                style={styles.secondaryDetailBtn}
                onPress={() => {
                  onClose();
                  navigation.navigate('HealthDetail', {
                    initialTab: 'today',
                    focusMetric: item.alert_type.includes('SPO2')
                      ? 'spo2'
                      : item.alert_type.includes('TEMP')
                      ? 'temperature'
                      : 'heartRate',
                    metric: 'heartRate',
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryDetailBtnText}>
                  Xem biểu đồ sức khỏe chuyên sâu →
                </Text>
              </TouchableOpacity>
            )}

            {item.alert_type === 'PERSON_DETECTED' && navigation && (
              <TouchableOpacity
                style={styles.secondaryDetailBtn}
                onPress={() => {
                  onClose();
                  navigation.navigate('CameraDetail', {
                    cameraId: item.device_id || 'cam_living_room',
                    tab: 'playback',
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryDetailBtnText}>
                  Mở camera xem lại hiện trường →
                </Text>
              </TouchableOpacity>
            )}

            {(item.alert_type === 'FALL_DETECTED' || item.thumbnail_url || item.video_clip_url) && navigation && (
              <TouchableOpacity
                style={styles.secondaryDetailBtn}
                onPress={() => {
                  onClose();
                  navigation.navigate('IncidentDetail', {
                    incidentId: item.id,
                    id: item.id,
                    type: item.alert_type === 'FALL_DETECTED' ? 'FALL' : item.alert_type === 'ACOUSTIC_DISTRESS' ? 'ACOUSTIC' : item.alert_type,
                    alert_type: item.alert_type,
                    alert_level: item.alert_level || 'CRITICAL',
                    confidence: item.confidence != null ? `${Math.round(Number(item.confidence) * 100)}%` : undefined,
                    time: item.created_at ?? new Date().toISOString(),
                    created_at: item.created_at ?? new Date().toISOString(),
                    message: item.message,
                    clipAvailable: Boolean(item.video_clip_url || item.thumbnail_url),
                    thumbnail_url: item.thumbnail_url ?? null,
                    video_clip_url: item.video_clip_url ?? null,
                    is_acknowledged: item.is_acknowledged ?? false,
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryDetailBtnText}>
                  Xem ảnh & video bằng chứng AI →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertDetailModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  alertDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertDetailIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertDetailTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  alertDetailSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  alertDetailSeverityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  alertDetailCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  alertDetailSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  alertDetailSectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  alertDetailBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  alertDetailSectionSub: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricGridItem: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  metricGridLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  metricGridValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  aiAdviceBox: {
    marginTop: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  aiAdviceHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
  },
  aiAdviceText: {
    fontSize: 12,
    color: '#9A3412',
    lineHeight: 17,
  },
  deviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  deviceMetaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  alertDetailFooter: {
    marginTop: 14,
    gap: 8,
  },
  handledStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  handledStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  confirmHandledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmHandledBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryDetailBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  secondaryDetailBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
