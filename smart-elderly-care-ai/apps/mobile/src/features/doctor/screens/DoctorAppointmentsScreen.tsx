// DoctorAppointmentsScreen.tsx
// Quản lý toàn bộ lịch hẹn khám, tái khám định kỳ & đồng bộ lịch phát loa nhắc nhở cho Bác sĩ gia đình

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';

import {
  AppointmentItem,
  AppointmentStatsSummary,
  AppointmentCard,
  AppointmentFormModal,
} from '../components';

export type { AppointmentItem };

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

  const handleViewPatient = (pId: string) => {
    navigation.navigate('DoctorPatientDetail', { patientId: pId });
  };

  const totalCount = appointments.length;
  const upcomingCount = appointments.filter((a) => a.status === 'UPCOMING').length;
  const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;

  const filteredAppointments = appointments.filter((a) => {
    if (filterTab === 'UPCOMING') return a.status === 'UPCOMING';
    if (filterTab === 'COMPLETED') return a.status === 'COMPLETED';
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
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
            <LocalizedText style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Lịch Khám & Tái Khám
            </LocalizedText>
            <LocalizedText style={[styles.headerSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              Theo dõi lịch định kỳ & Tự động phát loa nhắc qua Hub AI
            </LocalizedText>
          </View>
          <TouchableOpacity style={styles.btnAdd} onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 2 }} />
            <LocalizedText style={styles.btnAddText}>Đặt lịch</LocalizedText>
          </TouchableOpacity>
        </View>

        {/* 3 Thẻ thống kê & Bộ lọc */}
        <AppointmentStatsSummary
          totalCount={totalCount}
          upcomingCount={upcomingCount}
          completedCount={completedCount}
          filterTab={filterTab}
          onFilterChange={setFilterTab}
          isDarkMode={isDarkMode}
          colors={colors}
        />
      </View>

      {/* Thanh thông báo chạy chữ từ Admin (dành cho Bác sĩ) */}
      <AdminMarqueeBanner targetAudience="doctors" />

      {/* Danh sách lịch hẹn */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color="#0284C7" style={{ marginVertical: 20 }} />
        )}

        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={44} color="#94A3B8" />
            <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Không có lịch khám nào trong danh mục này.
            </LocalizedText>
          </View>
        ) : (
          filteredAppointments.map((apt) => (
            <AppointmentCard
              key={apt.id}
              appointment={apt}
              onViewPatient={handleViewPatient}
              onMarkCompleted={handleMarkCompleted}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteAppointment}
              isDarkMode={isDarkMode}
              colors={colors}
            />
          ))
        )}
      </ScrollView>

      {/* Modal Đặt lịch / Sửa lịch */}
      <AppointmentFormModal
        visible={modalVisible}
        isEditing={!!editingAptId}
        patientName={patientName}
        scheduledAt={scheduledAt}
        examType={examType}
        location={location}
        instructions={instructions}
        enableSpeaker={enableSpeaker}
        isSubmitting={isSubmitting}
        onChangePatientName={setPatientName}
        onChangeScheduledAt={setScheduledAt}
        onChangeExamType={setExamType}
        onChangeLocation={setLocation}
        onChangeInstructions={setInstructions}
        onToggleEnableSpeaker={setEnableSpeaker}
        onSave={handleSaveAppointment}
        onClose={() => setModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />
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
  scrollContent: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 13.5, marginTop: 8 },
});
