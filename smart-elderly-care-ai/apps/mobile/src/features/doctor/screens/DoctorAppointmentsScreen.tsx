// DoctorAppointmentsScreen.tsx
// Quản lý toàn bộ lịch hẹn khám, tái khám định kỳ & đồng bộ lịch phát loa nhắc nhở cho Bác sĩ gia đình

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';

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

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [patientId] = useState('e0000000-b4e1-4b08-b2d3-d949a0eb075c');
  const [patientName, setPatientName] = useState('Cụ Nguyễn Văn An');
  const [scheduledAt, setScheduledAt] = useState('15/10/2026 - 08:30');
  const [examType, setExamType] = useState('Tái khám tim mạch & huyết áp');
  const [location, setLocation] = useState('Tại nhà (Khám tại gia)');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doctorApi.getAppointments();
      if (res.data && Array.isArray(res.data)) {
        setAppointments(res.data);
      }
    } catch (e) {
      console.warn('Lỗi tải lịch khám thực tế:', e);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const handleOpenCreateModal = () => {
    setEditingAptId(null);
    setPatientName('Cụ Nguyễn Văn An');
    setScheduledAt('15/10/2026 - 08:30');
    setExamType('Tái khám tim mạch & huyết áp');
    setLocation('Tại nhà (Khám tại gia)');
    setInstructions('Đo huyết áp và nhịn ăn sáng trước khi lấy mẫu máu xét nghiệm.');
    setEnableSpeaker(true);
    setModalVisible(true);
  };

  const handleOpenEditModal = (apt: AppointmentItem) => {
    setEditingAptId(apt.id);
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
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập ngày giờ và chuyên khoa khám.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        patient_id: patientId,
        patient_name: patientName,
        scheduled_at: scheduledAt.trim(),
        exam_type: examType.trim(),
        location: location.trim(),
        instructions: instructions.trim(),
        enable_speaker_reminder: enableSpeaker,
      };

      if (editingAptId) {
        const res = await doctorApi.updateAppointment(editingAptId, payload);
        if (res.data) {
          setAppointments((prev) =>
            prev.map((a) => (a.id === editingAptId ? res.data : a))
          );
        } else {
          setAppointments((prev) =>
            prev.map((a) => (a.id === editingAptId ? { ...a, ...payload } : a))
          );
        }
        setModalVisible(false);
        Alert.alert('Thành công', 'Đã cập nhật lịch hẹn tái khám.');
      } else {
        const res = await doctorApi.createAppointment(payload);
        const newApt = res.data || {
          ...payload,
          id: `apt-${Date.now()}`,
          status: 'UPCOMING',
          doctor_name: 'BS. Trần Văn Minh',
          created_at: 'Hôm nay',
        };
        setAppointments([newApt, ...appointments]);
        setModalVisible(false);
        Alert.alert(
          'Đã đặt lịch khám',
          `Đã tạo lịch khám "${payload.exam_type}" vào ${payload.scheduled_at}. Hub Orange Pi 5 sẽ tự động phát loa tiếng Việt nhắc người nhà trước buổi khám!`
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu lịch hẹn.');
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
      Alert.alert('Đã khám xong', 'Đã ghi nhận hoàn tất buổi khám.');
    } catch {
      setAppointments((prev) =>
        prev.map((a) => (a.id === aptId ? { ...a, status: 'COMPLETED' } : a))
      );
    }
  };

  const handleDeleteAppointment = (aptId: string, title: string) => {
    Alert.alert('Hủy lịch hẹn', `Bác sĩ có chắc chắn muốn hủy lịch khám "${title}"?`, [
      { text: 'Quay lại', style: 'cancel' },
      {
        text: 'Hủy lịch',
        style: 'destructive',
        onPress: async () => {
          try {
            await doctorApi.deleteAppointment(aptId);
            setAppointments((prev) => prev.filter((a) => a.id !== aptId));
            Alert.alert('Đã hủy', 'Đã xóa lịch hẹn thành công.');
          } catch {
            setAppointments((prev) => prev.filter((a) => a.id !== aptId));
          }
        },
      },
    ]);
  };

  const filteredAppointments = appointments.filter((a) => {
    if (filterTab === 'UPCOMING') return a.status === 'UPCOMING';
    if (filterTab === 'COMPLETED') return a.status === 'COMPLETED';
    return true;
  });

  const totalCount = appointments.length;
  const upcomingCount = appointments.filter((a) => a.status === 'UPCOMING').length;
  const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* TOP HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Lịch Khám & Tái Khám</Text>
            <Text style={[styles.headerSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              Theo dõi lịch định kỳ & Tự động phát loa nhắc qua Hub AI
            </Text>
          </View>
          <TouchableOpacity style={styles.btnAddHeader} onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 2 }} />
            <Text style={styles.btnAddHeaderText}>Đặt lịch</Text>
          </TouchableOpacity>
        </View>

        {/* BỘ 3 THẺ THỐNG KÊ GỌN GÀNG */}
        <View style={styles.summaryGrid}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#3B82F633' },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar" size={16} color="#2563EB" />
            </View>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{totalCount}</Text>
            <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              Tổng lịch
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B33' },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="time" size={16} color="#D97706" />
            </View>
            <Text style={[styles.statNumber, { color: '#D97706' }]}>{upcomingCount}</Text>
            <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              Sắp tới
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#10B98133' },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="checkmark-done" size={16} color="#059669" />
            </View>
            <Text style={[styles.statNumber, { color: '#059669' }]}>{completedCount}</Text>
            <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              Đã khám
            </Text>
          </View>
        </View>

        {/* BỘ LỌC TRẠNG THÁI */}
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
                style={[
                  styles.filterChip,
                  active
                    ? { backgroundColor: Colors.primary }
                    : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* DANH SÁCH LỊCH HẸN */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
        )}

        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
            <Text style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Không có lịch khám nào trong danh mục này.
            </Text>
          </View>
        ) : (
          filteredAppointments.map((apt) => {
            const isUpcoming = apt.status === 'UPCOMING';
            const isCompleted = apt.status === 'COMPLETED';

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
                {/* HÀNG TRÊN: NGÀY GIỜ & HUY HIỆU TRẠNG THÁI */}
                <View style={styles.cardTopRow}>
                  <View style={styles.dateTagBox}>
                    <Ionicons name="calendar" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                    <Text style={styles.dateTagText}>{apt.scheduled_at}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isUpcoming
                        ? { backgroundColor: '#FEF3C7' }
                        : isCompleted
                        ? { backgroundColor: '#D1FAE5' }
                        : { backgroundColor: '#F1F5F9' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isUpcoming
                          ? { color: '#D97706' }
                          : isCompleted
                          ? { color: '#059669' }
                          : { color: '#64748B' },
                      ]}
                    >
                      {isUpcoming ? 'SẮP TỚI' : isCompleted ? 'ĐÃ KHÁM XONG' : 'ĐÃ HỦY'}
                    </Text>
                  </View>
                </View>

                {/* THÔNG TIN BỆNH NHÂN */}
                <View style={styles.patientRow}>
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientAvatarText}>
                      {apt.patient_name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.patientName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {apt.patient_name} (78 tuổi)
                    </Text>
                    <Text style={[styles.aptMetaText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                      {apt.location}
                    </Text>
                  </View>
                </View>

                {/* HẠNG MỤC KHÁM */}
                <View style={styles.examTypeBox}>
                  <Ionicons name="medkit" size={15} color="#0284C7" style={{ marginRight: 6 }} />
                  <Text style={[styles.examTypeText, { color: colors.textPrimary }]}>{apt.exam_type}</Text>
                </View>

                {/* DẶN DÒ Y KHOA CHO NGƯỜI NHÀ */}
                {apt.instructions ? (
                  <View
                    style={[
                      styles.instructionsBox,
                      { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC' },
                    ]}
                  >
                    <Text style={[styles.instructionsText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                      📝 <Text style={{ fontWeight: '700' }}>Dặn dò:</Text> {apt.instructions}
                    </Text>
                  </View>
                ) : null}

                {/* HUY HIỆU PHÁT LOA THÔNG MINH */}
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
                      size={13}
                      color={apt.enable_speaker_reminder ? '#059669' : '#94A3B8'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.speakerBadgeText,
                        { color: apt.enable_speaker_reminder ? '#059669' : '#64748B' },
                      ]}
                    >
                      {apt.enable_speaker_reminder ? 'Loa Hub nhắc trước 24h: BẬT' : 'Loa Hub: TẮT'}
                    </Text>
                  </View>
                </View>

                {/* HÀNG HÀNH ĐỘNG CỦA BÁC SĨ */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.btnViewPatient}
                    onPress={() => navigation.navigate('DoctorPatientDetail', { patientId: apt.patient_id })}
                  >
                    <Ionicons name="document-text-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                    <Text style={styles.btnViewPatientText}>Hồ sơ bệnh án</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {isUpcoming && (
                      <TouchableOpacity
                        style={styles.btnComplete}
                        onPress={() => handleMarkCompleted(apt.id)}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                        <Text style={styles.btnCompleteText}>Đã khám</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.btnEdit}
                      onPress={() => handleOpenEditModal(apt)}
                    >
                      <Ionicons name="pencil" size={13} color="#475569" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnDelete}
                      onPress={() => handleDeleteAppointment(apt.id, apt.exam_type)}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ===================================================================== */}
      {/* MODAL: ĐẶT LỊCH / CHỈNH SỬA LỊCH KHÁM                                */}
      {/* ===================================================================== */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingAptId ? 'Chỉnh Sửa Lịch Khám' : 'Đặt Lịch Tái Khám Mới'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Bệnh nhân (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={patientName}
                onChangeText={setPatientName}
                placeholder="VD: Cụ Nguyễn Văn An"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Ngày & Giờ tái khám (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholder="VD: 15/10/2026 - 08:30"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Chuyên khoa / Mục đích khám (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={examType}
                onChangeText={setExamType}
                placeholder="VD: Tái khám tim mạch & huyết áp"
                placeholderTextColor="#94A3B8"
              />

              {/* Các gợi ý mục đích khám nhanh */}
              <View style={styles.quickTypeRow}>
                {[
                  'Tái khám tim mạch',
                  'Đo điện tâm đồ (ECG)',
                  'Xét nghiệm máu',
                  'Khám tổng quát',
                ].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.quickTypePill}
                    onPress={() => setExamType(item)}
                  >
                    <Text style={styles.quickTypePillText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Địa điểm khám</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={location}
                onChangeText={setLocation}
                placeholder="VD: Tại nhà (Khám tại gia)"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Dặn dò người nhà & bệnh nhân chuẩn bị</Text>
              <TextInput
                style={[
                  styles.inputField,
                  { height: 75, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
                ]}
                multiline
                value={instructions}
                onChangeText={setInstructions}
                placeholder="VD: Đo huyết áp 3 ngày trước khám. Nhịn ăn sáng để xét nghiệm..."
                placeholderTextColor="#94A3B8"
              />

              {/* Bật / Tắt thông báo qua Loa Hub Orange Pi */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>
                    Phát loa nhắc nhở trên Hub Orange Pi 5
                  </Text>
                  <Text style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Tự động phát giọng nói tiếng Việt nhắc cụ và người nhà trước ngày khám
                  </Text>
                </View>
                <Switch
                  value={enableSpeaker}
                  onValueChange={setEnableSpeaker}
                  trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Hàng nút modal */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.btnCancel, { borderColor: colors.border }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.btnCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnSave}
                  onPress={handleSaveAppointment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnSaveText}>Lưu lịch hẹn</Text>
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
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  btnAddHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnAddHeaderText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipText: { fontSize: 12 },

  scrollContent: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, marginTop: 10 },

  aptCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateTagText: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: { fontSize: 10, fontWeight: '800' },

  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  patientName: { fontSize: 15, fontWeight: '700' },
  aptMetaText: { fontSize: 12, marginTop: 1 },

  examTypeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F933',
    paddingVertical: 4,
    marginBottom: 8,
  },
  examTypeText: { fontSize: 14, fontWeight: '700' },

  instructionsBox: {
    borderRadius: 8,
    padding: 9,
    marginBottom: 8,
  },
  instructionsText: { fontSize: 12.5, lineHeight: 18 },

  speakerRow: { marginBottom: 10 },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  speakerBadgeText: { fontSize: 11, fontWeight: '600' },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F066',
  },
  btnViewPatient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  btnViewPatientText: { fontSize: 11.5, color: '#0284C7', fontWeight: '700' },

  btnComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnCompleteText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },

  btnEdit: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDelete: {
    padding: 6,
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
  modalBox: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 10, marginBottom: 5 },
  inputField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  quickTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickTypePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickTypePillText: { fontSize: 11, color: '#0284C7', fontWeight: '600' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F066',
  },
  switchTitle: { fontSize: 13, fontWeight: '700' },
  switchSub: { fontSize: 11, marginTop: 2 },

  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnCancelText: { fontSize: 13, fontWeight: '700' },
  btnSave: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  btnSaveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
