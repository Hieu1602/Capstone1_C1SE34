// DoctorAppointmentsScreen.tsx
// Quản lý toàn bộ lịch hẹn khám, tái khám định kỳ & đồng bộ lịch phát loa nhắc nhở cho Bác sĩ gia đình

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';

export interface AppointmentItem {
  id: string;
  patient_id: string;
  patient_name: string;
  scheduled_at: string;
  exam_type: string;
  location: string;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | string;
  instructions?: string;
  doctor_name: string;
  enable_speaker_reminder: boolean;
  created_at?: string;
}

export default function DoctorAppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [patients, setPatients] = useState<any[]>([]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [examType, setExamType] = useState('');
  const [location, setLocation] = useState('');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const [aptRes, patRes] = await Promise.allSettled([
        doctorApi.getAppointments(),
        doctorApi.getPatients(),
      ]);
      if (aptRes.status === 'fulfilled' && aptRes.value.data && Array.isArray(aptRes.value.data)) {
        setAppointments(aptRes.value.data);
      }
      if (patRes.status === 'fulfilled' && patRes.value.data && Array.isArray(patRes.value.data)) {
        setPatients(patRes.value.data);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const handleOpenCreateModal = () => {
    setEditingAptId(null);
    const defaultPat = patients[0];
    setPatientId(defaultPat?.id ? String(defaultPat.id) : '');
    setPatientName(defaultPat?.name || '');
    setScheduledAt('');
    setExamType('');
    setLocation(defaultPat?.house_address || '');
    setInstructions('');
    setEnableSpeaker(true);
    setModalVisible(true);
  };

  const handleOpenEditModal = (apt: AppointmentItem) => {
    setEditingAptId(apt.id);
    setPatientId(apt.patient_id);
    setPatientName(apt.patient_name);
    setScheduledAt(apt.scheduled_at);
    setExamType(apt.exam_type);
    setLocation(apt.location);
    setInstructions(apt.instructions || '');
    setEnableSpeaker(apt.enable_speaker_reminder);
    setModalVisible(true);
  };

  const handleSaveAppointment = async () => {
    if (!scheduledAt.trim() || !examType.trim()) {
      LocalizedAlert.alert('Thiếu thông tin', 'Vui lòng nhập ngày giờ và chuyên khoa khám.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        patient_id: patientId || (patients[0]?.id ? String(patients[0].id) : ''),
        patient_name: patientName.trim() || patients[0]?.name || 'Bệnh nhân',
        scheduled_at: scheduledAt.trim(),
        exam_type: examType.trim(),
        location: location.trim(),
        instructions: instructions.trim(),
        enable_speaker_reminder: enableSpeaker,
      };

      if (editingAptId) {
        const res = await doctorApi.updateAppointment(editingAptId, payload);
        if (res.data) {
          setAppointments((prev) => prev.map((a) => (a.id === editingAptId ? res.data : a)));
        }
        setModalVisible(false);
        LocalizedAlert.alert('Thành công', 'Đã cập nhật lịch hẹn tái khám.');
      } else {
        const res = await doctorApi.createAppointment(payload);
        if (res.data) {
          setAppointments([res.data, ...appointments]);
        }
        setModalVisible(false);
        LocalizedAlert.alert(
          'Đã đặt lịch khám',
          `Đã tạo lịch khám "${payload.exam_type}" vào ${payload.scheduled_at}. Hệ thống sẽ phát loa nhắc nhở người nhà trước buổi khám!`
        );
      }
    } catch {
      LocalizedAlert.alert('Lỗi', 'Không thể kết nối lưu lịch hẹn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkCompleted = async (aptId: string) => {
    try {
      await doctorApi.updateAppointment(aptId, { status: 'COMPLETED' });
      setAppointments((prev) =>
        prev.map((a) => (a.id === aptId ? { ...a, status: 'COMPLETED' } : a))
      );
      LocalizedAlert.alert('Đã khám xong', 'Đã ghi nhận hoàn tất buổi khám.');
    } catch {
      LocalizedAlert.alert('Lỗi', 'Không thể cập nhật trạng thái lịch khám.');
    }
  };

  const handleDeleteAppointment = (aptId: string, title: string) => {
    LocalizedAlert.alert('Hủy lịch hẹn', `Bác sĩ có chắc chắn muốn hủy lịch khám "${title}"?`, [
      { text: 'Quay lại', style: 'cancel' },
      {
        text: 'Hủy lịch',
        style: 'destructive',
        onPress: async () => {
          try {
            await doctorApi.deleteAppointment(aptId);
            setAppointments((prev) => prev.filter((a) => a.id !== aptId));
            LocalizedAlert.alert('Đã hủy', 'Đã xóa lịch hẹn thành công.');
          } catch {
            LocalizedAlert.alert('Lỗi', 'Không thể xóa lịch hẹn.');
          }
        },
      },
    ]);
  };

  const totalCount = appointments.length;
  const upcomingCount = appointments.filter((a) => a.status === 'UPCOMING').length;
  const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;

  const filteredAppointments = appointments.filter((a) => {
    if (filterTab === 'UPCOMING') return a.status === 'UPCOMING';
    if (filterTab === 'COMPLETED') return a.status === 'COMPLETED';
    return true;
  });

  const stats = [
    { key: 'total', icon: 'calendar', color: '#2563EB', bg: '#EFF6FF', border: '#3B82F633', label: 'Tổng lịch', count: totalCount },
    { key: 'upcoming', icon: 'time', color: '#D97706', bg: '#FFFBEB', border: '#F59E0B33', label: 'Sắp tới', count: upcomingCount },
    { key: 'completed', icon: 'checkmark-done', color: '#059669', bg: '#ECFDF5', border: '#10B98133', label: 'Đã khám', count: completedCount },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <LocalizedText style={[styles.headerTitle, { color: colors.textPrimary }]}>Lịch Khám & Tái Khám</LocalizedText>
            <LocalizedText style={[styles.headerSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              Theo dõi lịch định kỳ & Tự động phát loa nhắc qua Hub AI
            </LocalizedText>
          </View>
          <TouchableOpacity style={styles.btnAdd} onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 2 }} />
            <LocalizedText style={styles.btnAddText}>Đặt lịch</LocalizedText>
          </TouchableOpacity>
        </View>

        {/* 3 Thẻ thống kê */}
        <View style={styles.summaryGrid}>
          {stats.map((s) => (
            <View key={s.key} style={[styles.summaryCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: s.border }]}>
              <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon as any} size={15} color={s.color} />
              </View>
              <LocalizedText style={[styles.statNumber, { color: s.color }]}>{s.count}</LocalizedText>
              <LocalizedText style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>{s.label}</LocalizedText>
            </View>
          ))}
        </View>

        {/* Bộ lọc trạng thái */}
        <View style={styles.filterRow}>
          {[
            { key: 'ALL', label: `Tất cả (${totalCount})` },
            { key: 'UPCOMING', label: `Sắp tới (${upcomingCount})` },
            { key: 'COMPLETED', label: `Đã khám (${completedCount})` },
          ].map((tab) => {
            const active = filterTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilterTab(tab.key as any)}
                style={[styles.filterChip, active ? { backgroundColor: Colors.primary } : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
              >
                <LocalizedText style={[styles.filterChipText, active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                  {tab.label}
                </LocalizedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Danh sách lịch hẹn */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />}

        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={44} color="#94A3B8" />
            <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Không có lịch khám nào trong danh mục này.
            </LocalizedText>
          </View>
        ) : (
          filteredAppointments.map((apt) => {
            const isUpcoming = apt.status === 'UPCOMING';
            const isCompleted = apt.status === 'COMPLETED';
            const initial = apt.patient_name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A';

            return (
              <View
                key={apt.id}
                style={[
                  styles.aptCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isUpcoming ? '#3B82F655' : isCompleted ? '#10B98144' : colors.border,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.dateTagBox}>
                    <Ionicons name="calendar" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                    <LocalizedText style={styles.dateTagText}>{apt.scheduled_at}</LocalizedText>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: isUpcoming ? '#FEF3C7' : isCompleted ? '#D1FAE5' : '#F1F5F9' },
                    ]}
                  >
                    <LocalizedText
                      style={[
                        styles.statusPillText,
                        { color: isUpcoming ? '#D97706' : isCompleted ? '#059669' : '#64748B' },
                      ]}
                    >
                      {isUpcoming ? 'SẮP TỚI' : isCompleted ? 'ĐÃ KHÁM XONG' : 'ĐÃ HỦY'}
                    </LocalizedText>
                  </View>
                </View>

                {/* Thông tin bệnh nhân */}
                <View style={styles.patientRow}>
                  <View style={styles.patientAvatar}>
                    <LocalizedText style={styles.patientAvatarText}>{initial}</LocalizedText>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <LocalizedText style={[styles.patientName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {apt.patient_name}
                    </LocalizedText>
                    {apt.location ? (
                      <LocalizedText style={[styles.aptMetaText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                        {apt.location}
                      </LocalizedText>
                    ) : null}
                  </View>
                </View>

                {/* Chuyên khoa khám */}
                <View style={styles.examTypeBox}>
                  <Ionicons name="medkit" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                  <LocalizedText style={[styles.examTypeText, { color: colors.textPrimary }]}>{apt.exam_type}</LocalizedText>
                </View>

                {/* Dặn dò */}
                {apt.instructions ? (
                  <View style={[styles.instructionsBox, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC' }]}>
                    <LocalizedText style={[styles.instructionsText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                      📝 <LocalizedText style={{ fontWeight: '700' }}>Dặn dò:</LocalizedText> {apt.instructions}
                    </LocalizedText>
                  </View>
                ) : null}

                {/* Nhắc nhở qua loa */}
                <View style={styles.speakerRow}>
                  <View
                    style={[
                      styles.speakerBadge,
                      apt.enable_speaker_reminder
                        ? { backgroundColor: '#ECFDF5', borderColor: '#10B98144' }
                        : { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
                    ]}
                  >
                    <Ionicons
                      name={apt.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
                      size={12}
                      color={apt.enable_speaker_reminder ? '#059669' : '#94A3B8'}
                      style={{ marginRight: 4 }}
                    />
                    <LocalizedText style={[styles.speakerBadgeText, { color: apt.enable_speaker_reminder ? '#059669' : '#64748B' }]}>
                      {apt.enable_speaker_reminder ? 'Loa Hub nhắc trước 24h: BẬT' : 'Loa Hub: TẮT'}
                    </LocalizedText>
                  </View>
                </View>

                {/* Nút hành động */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.btnViewPatient}
                    onPress={() => navigation.navigate('DoctorPatientDetail', { patientId: apt.patient_id })}
                  >
                    <Ionicons name="document-text-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                    <LocalizedText style={styles.btnViewPatientText}>Hồ sơ bệnh án</LocalizedText>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {isUpcoming && (
                      <TouchableOpacity style={styles.btnComplete} onPress={() => handleMarkCompleted(apt.id)}>
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" style={{ marginRight: 2 }} />
                        <LocalizedText style={styles.btnCompleteText}>Đã khám</LocalizedText>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.btnEdit} onPress={() => handleOpenEditModal(apt)}>
                      <Ionicons name="pencil" size={13} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnDelete} onPress={() => handleDeleteAppointment(apt.id, apt.exam_type)}>
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Đặt lịch / Sửa lịch */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingAptId ? 'Chỉnh Sửa Lịch Khám' : 'Đặt Lịch Tái Khám Mới'}
              </LocalizedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <LocalizedText style={styles.fieldLabel}>Bệnh nhân (*)</LocalizedText>
              <LocalizedTextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={patientName}
                onChangeText={setPatientName}
                placeholder="VD: Cụ Nguyễn Văn An"
                placeholderTextColor="#94A3B8"
              />

              <LocalizedText style={styles.fieldLabel}>Ngày & Giờ tái khám (*)</LocalizedText>
              <LocalizedTextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholder="VD: 15/10/2026 - 08:30"
                placeholderTextColor="#94A3B8"
              />

              <LocalizedText style={styles.fieldLabel}>Chuyên khoa / Mục đích khám (*)</LocalizedText>
              <LocalizedTextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={examType}
                onChangeText={setExamType}
                placeholder="VD: Tái khám tim mạch & huyết áp"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.quickTypeRow}>
                {['Tái khám tim mạch', 'Đo điện tâm đồ (ECG)', 'Xét nghiệm máu', 'Khám tổng quát'].map((item) => (
                  <TouchableOpacity key={item} style={styles.quickTypePill} onPress={() => setExamType(item)}>
                    <LocalizedText style={styles.quickTypePillText}>{item}</LocalizedText>
                  </TouchableOpacity>
                ))}
              </View>

              <LocalizedText style={styles.fieldLabel}>Địa điểm khám</LocalizedText>
              <LocalizedTextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={location}
                onChangeText={setLocation}
                placeholder="VD: Tại nhà (Khám tại gia)"
                placeholderTextColor="#94A3B8"
              />

              <LocalizedText style={styles.fieldLabel}>Dặn dò người nhà & bệnh nhân</LocalizedText>
              <LocalizedTextInput
                style={[styles.inputField, { height: 70, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
                multiline
                value={instructions}
                onChangeText={setInstructions}
                placeholder="VD: Đo huyết áp 3 ngày trước khám. Nhịn ăn sáng để xét nghiệm..."
                placeholderTextColor="#94A3B8"
              />

              {/* Bật / Tắt phát loa nhắc */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <LocalizedText style={[styles.switchTitle, { color: colors.textPrimary }]}>
                    Phát loa nhắc nhở qua Hub AI
                  </LocalizedText>
                  <LocalizedText style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Tự động phát giọng nói nhắc cụ và người nhà trước ngày khám
                  </LocalizedText>
                </View>
                <Switch
                  value={enableSpeaker}
                  onValueChange={setEnableSpeaker}
                  trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={[styles.btnCancel, { borderColor: colors.border }]} onPress={() => setModalVisible(false)}>
                  <LocalizedText style={[styles.btnCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Hủy</LocalizedText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnSave} onPress={handleSaveAppointment} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <LocalizedText style={styles.btnSaveText}>Lưu lịch hẹn</LocalizedText>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSub: { fontSize: 11.5, marginTop: 2 },
  btnAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnAddText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  statIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statNumber: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  filterChipText: { fontSize: 11.5 },
  scrollContent: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 13.5, marginTop: 8 },
  aptCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateTagText: { fontSize: 11.5, fontWeight: '700', color: '#0284C7' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  statusPillText: { fontSize: 9.5, fontWeight: '800' },
  patientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  patientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  patientName: { fontSize: 14.5, fontWeight: '700' },
  aptMetaText: { fontSize: 11.5, marginTop: 1 },
  examTypeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F933',
    paddingVertical: 3,
    marginBottom: 6,
  },
  examTypeText: { fontSize: 13.5, fontWeight: '700' },
  instructionsBox: { borderRadius: 8, padding: 8, marginBottom: 6 },
  instructionsText: { fontSize: 12, lineHeight: 17 },
  speakerRow: { marginBottom: 8 },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  speakerBadgeText: { fontSize: 10.5, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F066',
  },
  btnViewPatient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  btnViewPatientText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  btnComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnCompleteText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  btnEdit: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDelete: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: { borderRadius: 14, padding: 18, maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16.5, fontWeight: '800' },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  quickTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  quickTypePill: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  quickTypePillText: { fontSize: 11, color: '#0284C7', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F066',
  },
  switchTitle: { fontSize: 12.5, fontWeight: '700' },
  switchSub: { fontSize: 10.5, marginTop: 1 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  btnCancel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  btnCancelText: { fontSize: 12.5, fontWeight: '700' },
  btnSave: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary },
  btnSaveText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
});
