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
  AppointmentCancelModal,
  AppointmentCompleteModal,
} from '../components';

export type { AppointmentItem };

export default function DoctorAppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [patients, setPatients] = useState<any[]>([]);

  // Create / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [examType, setExamType] = useState('');
  const [visitType, setVisitType] = useState<'HOME_VISIT' | 'CLINIC'>('HOME_VISIT');
  const [location, setLocation] = useState('');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [recurrencePattern, setRecurrencePattern] = useState<'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'>('NONE');
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancellation Modal State
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [targetCancelApt, setTargetCancelApt] = useState<AppointmentItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Completion Confirmation Modal State
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [targetCompleteApt, setTargetCompleteApt] = useState<AppointmentItem | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

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

  const handleSelectPatient = (pat: any) => {
    setPatientId(String(pat.id));
    setPatientName(pat.name || '');
    if (visitType === 'HOME_VISIT') {
      if (pat.house_address) {
        setLocation(`Tại nhà: ${pat.house_address}`);
      } else {
        setLocation('Tại nhà bệnh nhân (Khám tại gia)');
      }
    }
  };

  const handleOpenCreateModal = () => {
    setEditingAptId(null);
    const defaultPat = patients[0];
    const patId = defaultPat?.id ? String(defaultPat.id) : '';
    setPatientId(patId);
    setPatientName(defaultPat?.name || '');
    setVisitType('HOME_VISIT');

    // Default to tomorrow 08:30
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 30, 0, 0);
    setScheduledAt(tomorrow.toISOString());

    setExamType('Khám định kỳ');
    setLocation(
      defaultPat?.house_address
        ? `Tại nhà: ${defaultPat.house_address}`
        : 'Tại nhà bệnh nhân (Khám tại gia)'
    );
    setInstructions('');
    setEnableSpeaker(true);
    setRecurrencePattern('NONE');
    setRecurrenceOccurrences(1);
    setModalVisible(true);
  };

  const handleOpenEditModal = (apt: AppointmentItem) => {
    setEditingAptId(apt.id);
    setPatientId(apt.patient_id);
    setPatientName(apt.patient_name);
    setScheduledAt(apt.scheduled_at);
    setExamType(apt.exam_type || apt.clinical_notes || 'Khám tổng quát định kỳ');
    setVisitType((apt.visit_type as any) || 'HOME_VISIT');
    setLocation(apt.location || '');
    setInstructions(apt.instructions || '');
    setEnableSpeaker(apt.enable_speaker_reminder ?? true);
    setRecurrencePattern((apt.recurrence_pattern as any) || 'NONE');
    setRecurrenceOccurrences(apt.recurrence_occurrences || 1);
    setModalVisible(true);
  };

  const handleSaveAppointment = async () => {
    if (!examType.trim()) {
      LocalizedAlert.alert('Thiếu thông tin', 'Vui lòng nhập chuyên khoa hoặc mục đích khám.');
      return;
    }

    // Format ISO timestamp
    let finalScheduledAt = scheduledAt.trim();
    if (!finalScheduledAt) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 30, 0, 0);
      finalScheduledAt = tomorrow.toISOString();
    } else {
      const parsed = new Date(finalScheduledAt);
      if (!isNaN(parsed.getTime())) {
        finalScheduledAt = parsed.toISOString();
      }
    }

    try {
      setIsSubmitting(true);
      const chosenPatientId = patientId || (patients[0]?.id ? String(patients[0].id) : null);
      if (!chosenPatientId) {
        LocalizedAlert.alert('Chưa chọn bệnh nhân', 'Vui lòng chọn một bệnh nhân từ danh sách để đặt lịch khám.');
        return;
      }
      const chosenPatientName = patientName.trim() || patients.find((p) => String(p.id) === String(chosenPatientId))?.name || 'Bệnh nhân';

      const payload: any = {
        patient_id: chosenPatientId,
        patient_name: chosenPatientName,
        scheduled_at: finalScheduledAt,
        visit_type: visitType,
        exam_type: examType.trim(),
        location: location.trim() || 'Tại nhà bệnh nhân',
        clinical_notes: instructions.trim() ? `[${examType.trim()}] ${instructions.trim()}` : examType.trim(),
        instructions: instructions.trim(),
        enable_speaker_reminder: enableSpeaker,
        recurrence_pattern: recurrencePattern,
        recurrence_occurrences: recurrencePattern !== 'NONE' ? recurrenceOccurrences : 1,
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
          if (Array.isArray(res.data)) {
            setAppointments([...res.data, ...appointments]);
          } else {
            setAppointments([res.data, ...appointments]);
          }
        }
        setModalVisible(false);
        const displayTime = new Date(finalScheduledAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        LocalizedAlert.alert(
          'Đã đặt lịch khám',
          `Đã tạo lịch khám "${payload.exam_type}" cho ${chosenPatientName} vào ${displayTime}. Thông báo tức thì đã được gửi đến Người nhà để xác nhận đón tiếp, đồng thời kích hoạt nhắc nhở loa Hub!`
        );
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409 || (detail && typeof detail === 'string' && detail.includes('trùng'))) {
        LocalizedAlert.alert(
          'Trùng lịch khám',
          detail || 'Khoảng thời gian này đã có một lịch khám khác. Vui lòng chọn thời gian khám khác.'
        );
      } else {
        LocalizedAlert.alert('Lỗi', detail || 'Không thể kết nối lưu lịch hẹn.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCompleteModal = (aptId: string) => {
    const target = appointments.find((a) => a.id === aptId);
    if (target) {
      setTargetCompleteApt(target);
      setCompleteModalVisible(true);
    }
  };

  const handleConfirmComplete = async () => {
    if (!targetCompleteApt) return;
    try {
      setIsCompleting(true);
      await doctorApi.completeAppointment(targetCompleteApt.id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === targetCompleteApt.id ? { ...a, status: 'COMPLETED' } : a))
      );
      setCompleteModalVisible(false);
      LocalizedAlert.alert('Đã khám xong', 'Đã ghi nhận hoàn tất buổi khám.');
    } catch (err: any) {
      LocalizedAlert.alert('Lỗi', err?.response?.data?.detail || 'Không thể cập nhật trạng thái lịch khám.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleOpenCancelModal = (apt: AppointmentItem) => {
    setTargetCancelApt(apt);
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async (reason: string) => {
    if (!targetCancelApt) return;
    try {
      setIsCancelling(true);
      await doctorApi.cancelAppointment(targetCancelApt.id, { cancellation_reason: reason });
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === targetCancelApt.id ? { ...a, status: 'CANCELLED', cancellation_reason: reason } : a
        )
      );
      setCancelModalVisible(false);
      LocalizedAlert.alert(
        'Đã hủy lịch khám',
        'Đã hủy lịch hẹn thành công, hủy các mốc nhắc nhở qua loa Hub và đồng bộ thông báo tới Gia đình.'
      );
    } catch (err: any) {
      const rawDetail = err?.response?.data?.detail;
      let errorMsg = 'Không thể hủy lịch khám.';
      if (typeof rawDetail === 'string') {
        errorMsg = rawDetail;
      } else if (Array.isArray(rawDetail)) {
        errorMsg = rawDetail.map((d: any) => d.msg || JSON.stringify(d)).join('\n');
      } else if (rawDetail && typeof rawDetail === 'object') {
        errorMsg = rawDetail.message || JSON.stringify(rawDetail);
      }
      LocalizedAlert.alert('Lỗi', errorMsg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteAppointment = (aptId: string, title: string) => {
    LocalizedAlert.alert('Xóa lịch khám', `Bác sĩ có chắc chắn muốn xóa bản ghi lịch khám "${title}"?`, [
      { text: 'Quay lại', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await doctorApi.deleteAppointment(aptId);
            setAppointments((prev) => prev.filter((a) => a.id !== aptId));
            LocalizedAlert.alert('Đã xóa', 'Đã xóa bản ghi lịch hẹn thành công.');
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
  const cancelledCount = appointments.filter((a) => a.status === 'CANCELLED').length;

  const filteredAppointments = appointments.filter((a) => {
    if (filterTab === 'UPCOMING') return a.status === 'UPCOMING';
    if (filterTab === 'COMPLETED') return a.status === 'COMPLETED';
    if (filterTab === 'CANCELLED') return a.status === 'CANCELLED';
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

        {/* 4 Thẻ thống kê & Bộ lọc */}
        <AppointmentStatsSummary
          totalCount={totalCount}
          upcomingCount={upcomingCount}
          completedCount={completedCount}
          cancelledCount={cancelledCount}
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
              onMarkCompleted={handleOpenCompleteModal}
              onEdit={handleOpenEditModal}
              onCancel={handleOpenCancelModal}
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
        patients={patients}
        patientId={patientId}
        patientName={patientName}
        scheduledAt={scheduledAt}
        examType={examType}
        visitType={visitType}
        location={location}
        instructions={instructions}
        enableSpeaker={enableSpeaker}
        recurrencePattern={recurrencePattern}
        recurrenceOccurrences={recurrenceOccurrences}
        isSubmitting={isSubmitting}
        onSelectPatient={handleSelectPatient}
        onChangePatientName={setPatientName}
        onChangeScheduledAt={setScheduledAt}
        onChangeExamType={setExamType}
        onChangeVisitType={setVisitType}
        onChangeLocation={setLocation}
        onChangeInstructions={setInstructions}
        onToggleEnableSpeaker={setEnableSpeaker}
        onChangeRecurrencePattern={setRecurrencePattern}
        onChangeRecurrenceOccurrences={setRecurrenceOccurrences}
        onSave={handleSaveAppointment}
        onClose={() => setModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal Xác nhận hoàn thành khám */}
      <AppointmentCompleteModal
        visible={completeModalVisible}
        appointment={targetCompleteApt}
        isSubmitting={isCompleting}
        onConfirm={handleConfirmComplete}
        onClose={() => setCompleteModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal Hủy lịch hẹn (Bắt buộc lý do) */}
      <AppointmentCancelModal
        visible={cancelModalVisible}
        appointment={targetCancelApt}
        isSubmitting={isCancelling}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelModalVisible(false)}
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
