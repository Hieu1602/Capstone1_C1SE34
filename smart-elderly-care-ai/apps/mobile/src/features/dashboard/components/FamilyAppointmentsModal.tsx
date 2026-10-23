import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientApi } from '../../../services/api';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import { useTheme } from '../../../store/useThemeStore';

interface FamilyAppointmentsModalProps {
  visible: boolean;
  patientId: string | number;
  patientName?: string;
  onClose: () => void;
}

interface FamilyAppointmentItem {
  id: string;
  patient_id: string;
  patient_name?: string;
  doctor_name?: string;
  scheduled_at: string;
  visit_type?: string;
  exam_type?: string;
  location?: string;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | string;
  clinical_notes?: string;
  instructions?: string;
  cancellation_reason?: string;
  recurrence_pattern?: string;
  enable_speaker_reminder?: boolean;
}

export const FamilyAppointmentsModal: React.FC<FamilyAppointmentsModalProps> = ({
  visible,
  patientId,
  patientName,
  onClose,
}) => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<FamilyAppointmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('UPCOMING');

  const fetchAppointments = useCallback(async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const res = await patientApi.getAppointments(patientId);
      if (res.data && Array.isArray(res.data)) {
        setAppointments(res.data);
      }
    } catch {
      // Keep existing list on network issue
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  const handleConfirmAppointment = async (aptId: string) => {
    try {
      setConfirmingId(aptId);
      await patientApi.confirmAppointment(patientId, aptId);
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === aptId
            ? {
                ...a,
                clinical_notes: `[ĐÃ XÁC NHẬN ĐÓN TIẾP] ${a.clinical_notes || ''}`.trim(),
              }
            : a
        )
      );
      LocalizedAlert.alert(
        'Đã xác nhận đón tiếp',
        'Cảm ơn gia đình! Hệ thống đã ghi nhận và thông báo cho Bác sĩ biết gia đình đã sẵn sàng đón tiếp vào ngày khám.'
      );
    } catch (err: any) {
      LocalizedAlert.alert('Lỗi', err?.response?.data?.detail || 'Không thể xác nhận lịch khám vào lúc này.');
    } finally {
      setConfirmingId(null);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchAppointments();
    }
  }, [visible, fetchAppointments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (activeTab === 'UPCOMING') return apt.status === 'UPCOMING';
    if (activeTab === 'COMPLETED') return apt.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return apt.status === 'CANCELLED';
    return true;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Lịch Khám & Tái Khám
              </LocalizedText>
              {patientName ? (
                <LocalizedText style={[styles.modalSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Bệnh nhân: {patientName}
                </LocalizedText>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.btnClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Read-only notice */}
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: isDarkMode ? '#0F172A88' : '#EFF6FF', borderColor: '#3B82F633' },
            ]}
          >
            <Ionicons name="shield-checkmark" size={14} color="#0284C7" style={{ marginRight: 6 }} />
            <LocalizedText style={[styles.noticeText, { color: isDarkMode ? '#93C5FD' : '#0369A1' }]}>
              Lịch khám được lập & dặn dò trực tiếp bởi Bác sĩ gia đình phụ trách.
            </LocalizedText>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {[
              { key: 'UPCOMING', label: 'Sắp tới' },
              { key: 'COMPLETED', label: 'Đã khám' },
              { key: 'CANCELLED', label: 'Đã hủy' },
              { key: 'ALL', label: 'Tất cả' },
            ].map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tabItem,
                    isSelected && {
                      borderBottomColor: '#0284C7',
                      borderBottomWidth: 2,
                    },
                  ]}
                  onPress={() => setActiveTab(tab.key as any)}
                >
                  <LocalizedText
                    style={[
                      styles.tabText,
                      { color: isSelected ? '#0284C7' : isDarkMode ? '#94A3B8' : '#64748B' },
                      isSelected && { fontWeight: '700' },
                    ]}
                  >
                    {tab.label}
                  </LocalizedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Appointments list */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {loading && !refreshing && (
              <ActivityIndicator size="small" color="#0284C7" style={{ marginVertical: 20 }} />
            )}

            {!loading && filteredAppointments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={40} color="#94A3B8" />
                <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Chưa có lịch khám nào trong mục này.
                </LocalizedText>
              </View>
            ) : (
              filteredAppointments.map((apt) => {
                const isUpcoming = apt.status === 'UPCOMING';
                const isCompleted = apt.status === 'COMPLETED';
                const isConfirmed = (apt.clinical_notes || '').includes('[ĐÃ XÁC NHẬN ĐÓN TIẾP]');
                const cleanInstructions = (apt.instructions || apt.clinical_notes || '')
                  .replace(/\[ĐÃ XÁC NHẬN ĐÓN TIẾP\]/g, '')
                  .trim();

                return (
                  <View
                    key={apt.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                        borderColor: isUpcoming
                          ? isConfirmed
                            ? '#10B98155'
                            : '#F59E0B66'
                          : isCompleted
                          ? '#10B98144'
                          : '#EF444433',
                      },
                    ]}
                  >
                    {/* Top Row: Date & Status */}
                    <View style={styles.cardHeader}>
                      <View style={styles.dateBadge}>
                        <Ionicons name="calendar" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                        <LocalizedText style={styles.dateText}>{apt.scheduled_at}</LocalizedText>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isUpcoming
                              ? isConfirmed
                                ? '#D1FAE5'
                                : '#FEF3C7'
                              : isCompleted
                              ? '#D1FAE5'
                              : '#FEE2E2',
                          },
                        ]}
                      >
                        <LocalizedText
                          style={[
                            styles.statusText,
                            {
                              color: isUpcoming
                                ? isConfirmed
                                  ? '#059669'
                                  : '#D97706'
                                : isCompleted
                                ? '#059669'
                                : '#DC2626',
                            },
                          ]}
                        >
                          {isUpcoming
                            ? isConfirmed
                              ? 'ĐÃ XÁC NHẬN'
                              : 'CHỜ GIA ĐÌNH XÁC NHẬN'
                            : isCompleted
                            ? 'ĐÃ KHÁM XONG'
                            : 'ĐÃ HỦY'}
                        </LocalizedText>
                      </View>
                    </View>

                    {/* Specialty / Purpose */}
                    <View style={styles.specialtyRow}>
                      <Ionicons name="medkit" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                      <LocalizedText style={[styles.specialtyText, { color: colors.textPrimary }]}>
                        {apt.exam_type || apt.visit_type || 'Khám sức khỏe định kỳ'}
                      </LocalizedText>
                    </View>

                    {/* Location */}
                    {apt.location ? (
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={13} color="#64748B" style={{ marginRight: 5 }} />
                        <LocalizedText style={[styles.metaText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                          {apt.location}
                        </LocalizedText>
                      </View>
                    ) : null}

                    {/* Doctor Name */}
                    {apt.doctor_name ? (
                      <View style={styles.metaRow}>
                        <Ionicons name="person-outline" size={13} color="#64748B" style={{ marginRight: 5 }} />
                        <LocalizedText style={[styles.metaText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                          Bác sĩ: {apt.doctor_name}
                        </LocalizedText>
                      </View>
                    ) : null}

                    {/* Instructions */}
                    {cleanInstructions ? (
                      <View
                        style={[
                          styles.instructionsBox,
                          { backgroundColor: isDarkMode ? '#1E293B88' : '#FFFFFF' },
                        ]}
                      >
                        <LocalizedText
                          style={[styles.instructionsText, { color: isDarkMode ? '#E2E8F0' : '#334155' }]}
                        >
                          📝 <LocalizedText style={{ fontWeight: '700' }}>Dặn dò:</LocalizedText>{' '}
                          {cleanInstructions}
                        </LocalizedText>
                      </View>
                    ) : null}

                    {/* Family Confirmation Action or Confirmed Notice */}
                    {isUpcoming && !isConfirmed && (
                      <View
                        style={[
                          styles.confirmPromptBox,
                          {
                            backgroundColor: isDarkMode ? '#1E293B' : '#FEF9C344',
                            borderColor: '#F59E0B66',
                          },
                        ]}
                      >
                        <View style={styles.confirmPromptRow}>
                          <Ionicons name="notifications" size={15} color="#D97706" style={{ marginRight: 6 }} />
                          <LocalizedText style={[styles.confirmPromptText, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
                            Bác sĩ vừa lên lịch. Gia đình vui lòng xác nhận sẵn sàng đón tiếp.
                          </LocalizedText>
                        </View>
                        <TouchableOpacity
                          style={styles.btnConfirmFamily}
                          onPress={() => handleConfirmAppointment(apt.id)}
                          disabled={confirmingId === apt.id}
                        >
                          {confirmingId === apt.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <LocalizedText style={styles.btnConfirmFamilyText}>Xác nhận đón tiếp Bác sĩ</LocalizedText>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {isUpcoming && isConfirmed && (
                      <View
                        style={[
                          styles.confirmedSuccessBox,
                          {
                            backgroundColor: isDarkMode ? '#064E3B33' : '#ECFDF5',
                            borderColor: '#10B98144',
                          },
                        ]}
                      >
                        <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 6 }} />
                        <LocalizedText style={[styles.confirmedSuccessText, { color: isDarkMode ? '#6EE7B7' : '#047857' }]}>
                          Gia đình đã xác nhận đón tiếp Bác sĩ. Hệ thống sẽ phát loa nhắc trước 24h & 2h.
                        </LocalizedText>
                      </View>
                    )}

                    {/* Cancellation reason if cancelled */}
                    {apt.status === 'CANCELLED' && apt.cancellation_reason ? (
                      <View
                        style={[
                          styles.cancelBox,
                          { backgroundColor: isDarkMode ? '#450A0A33' : '#FEF2F2' },
                        ]}
                      >
                        <Ionicons name="alert-circle" size={13} color="#DC2626" style={{ marginRight: 4 }} />
                        <LocalizedText
                          style={[styles.cancelText, { color: isDarkMode ? '#FCA5A5' : '#B91C1C' }]}
                        >
                          <LocalizedText style={{ fontWeight: '700' }}>Lý do hủy:</LocalizedText>{' '}
                          {apt.cancellation_reason}
                        </LocalizedText>
                      </View>
                    ) : null}

                    {/* Hub reminder status */}
                    <View style={styles.reminderRow}>
                      <Ionicons
                        name={apt.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
                        size={12}
                        color={apt.enable_speaker_reminder ? '#059669' : '#94A3B8'}
                        style={{ marginRight: 4 }}
                      />
                      <LocalizedText
                        style={[
                          styles.reminderText,
                          { color: apt.enable_speaker_reminder ? '#059669' : '#64748B' },
                        ]}
                      >
                        {apt.enable_speaker_reminder
                          ? 'Loa Hub tự động nhắc trước 24h & 2h'
                          : 'Nhắc qua loa: Tắt'}
                      </LocalizedText>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.btnBottomClose} onPress={onClose}>
            <LocalizedText style={styles.btnBottomCloseText}>Đóng</LocalizedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  btnClose: {
    padding: 4,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  noticeText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 10,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12.5,
  },
  scrollList: {
    paddingBottom: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 13,
    marginTop: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0284C7',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  specialtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  specialtyText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaText: {
    fontSize: 11.5,
  },
  instructionsBox: {
    borderRadius: 7,
    padding: 8,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F088',
  },
  instructionsText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  cancelBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 7,
    padding: 7,
    marginTop: 6,
  },
  cancelText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F066',
  },
  reminderText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  btnBottomClose: {
    marginTop: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnBottomCloseText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  confirmPromptBox: {
    borderRadius: 9,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  confirmPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmPromptText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  btnConfirmFamily: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnConfirmFamilyText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  confirmedSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  confirmedSuccessText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
});
