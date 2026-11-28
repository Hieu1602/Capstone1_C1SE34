import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BusySlotItem, patientApi } from '../../../services/api';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import { useTheme } from '../../../store/useThemeStore';
import { useVitalStore } from '../../../store/useVitalStore';
import {
  FAMILY_TIME_SLOTS,
  buildLocalDateTime,
  canFamilyManageAppointment,
  findFirstAvailableSlot,
  getFamilyAppointmentStatusInfo,
  getUpcomingDateOptions,
  isDoctorBusyForSlot,
  isSlotInPast,
  stripAppointmentSystemTags,
  toLocalDateKey,
} from '../utils/familyAppointments';

interface FamilyAppointmentsModalProps {
  visible: boolean;
  patientId: string | number;
  patientName?: string;
  onClose: () => void;
  initialMode?: 'LIST' | 'BOOK';
  doctorName?: string;
  defaultClinicLocation?: string;
  canManageRecords?: boolean;
  onAppointmentChanged?: () => void;
}

interface FamilyAppointmentItem {
  id: string;
  doctor_id?: string | null;
  created_by?: string | null;
  patient_id: string;
  patient_name?: string;
  doctor_name?: string;
  scheduled_at: string;
  visit_type?: string;
  exam_type?: string | null;
  location?: string;
  status: 'UPCOMING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | string;
  clinical_notes?: string;
  instructions?: string | null;
  cancellation_reason?: string;
  recurrence_pattern?: string;
  enable_speaker_reminder?: boolean;
}

function formatAppointmentTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${time} - ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatExamType(type?: string | null): string {
  if (!type) return 'Khám sức khỏe định kỳ';
  if (type === 'CLINIC') return 'Khám tại phòng khám';
  if (type === 'HOME_VISIT') return 'Khám bệnh tại nhà';
  return type;
}

export const FamilyAppointmentsModal: React.FC<FamilyAppointmentsModalProps> = ({
  visible,
  patientId,
  patientName,
  onClose,
  initialMode = 'LIST',
  doctorName,
  defaultClinicLocation,
  canManageRecords = true,
  onAppointmentChanged,
}) => {
  const { isDarkMode, colors } = useTheme();
  const normalizedPatientId =
    patientId !== null && patientId !== undefined ? String(patientId).trim() : '';

  const [mode, setMode] = useState<'LIST' | 'BOOK' | 'RESCHEDULE'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [loadingBusySlots, setLoadingBusySlots] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [appointments, setAppointments] = useState<FamilyAppointmentItem[]>([]);
  const [busySlots, setBusySlots] = useState<BusySlotItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('UPCOMING');

  // Booking / rescheduling form state
  const dateOptions = useMemo(() => getUpcomingDateOptions(15), [visible]);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateOptions[0]?.key || '');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('09:00');
  const [visitType, setVisitType] = useState<'HOME_VISIT' | 'CLINIC'>('HOME_VISIT');
  const [locationInput, setLocationInput] = useState<string>('Tại nhà (Khám tại gia)');
  const [locationTouched, setLocationTouched] = useState<boolean>(false);
  const [notesInput, setNotesInput] = useState<string>('');
  const [editingAppointment, setEditingAppointment] = useState<FamilyAppointmentItem | null>(null);
  const userPickedSlotRef = useRef<boolean>(false);

  const defaultLocationForVisit = useCallback(
    (vt: 'HOME_VISIT' | 'CLINIC') =>
      vt === 'HOME_VISIT'
        ? 'Tại nhà (Khám tại gia)'
        : defaultClinicLocation || 'Tại phòng khám Bác sĩ gia đình',
    [defaultClinicLocation]
  );

  const fetchAppointments = useCallback(async () => {
    if (!normalizedPatientId) {
      setAppointments([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoading(true);
      const res = await patientApi.getAppointments(normalizedPatientId);
      if (res.data && Array.isArray(res.data)) {
        setAppointments(res.data);
      }
    } catch {
      // Keep existing list on network issue
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizedPatientId]);

  const fetchBusySlots = useCallback(async (): Promise<BusySlotItem[]> => {
    if (!normalizedPatientId) {
      setBusySlots([]);
      return [];
    }
    try {
      setLoadingBusySlots(true);
      const res = await patientApi.getBusySlots(normalizedPatientId);
      const list = Array.isArray(res.data) ? res.data : [];
      setBusySlots(list);
      return list;
    } catch {
      setBusySlots([]);
      return [];
    } finally {
      setLoadingBusySlots(false);
    }
  }, [normalizedPatientId]);

  const openBookForm = useCallback(
    (currentBusy: BusySlotItem[]) => {
      userPickedSlotRef.current = false;
      setEditingAppointment(null);
      setVisitType('HOME_VISIT');
      setLocationInput(defaultLocationForVisit('HOME_VISIT'));
      setLocationTouched(false);
      setNotesInput('');
      const best = findFirstAvailableSlot(dateOptions, 'HOME_VISIT', currentBusy);
      setSelectedDateKey(best.dateKey);
      setSelectedTimeSlot(best.timeSlot);
      setMode('BOOK');
    },
    [dateOptions, defaultLocationForVisit]
  );

  const openRescheduleForm = useCallback(
    (apt: FamilyAppointmentItem) => {
      userPickedSlotRef.current = true;
      const vt: 'HOME_VISIT' | 'CLINIC' = apt.visit_type === 'CLINIC' ? 'CLINIC' : 'HOME_VISIT';
      const parsed = new Date(apt.scheduled_at);
      const parsedKey = !isNaN(parsed.getTime()) ? toLocalDateKey(parsed) : '';
      const matchedOpt = dateOptions.find((o) => o.key === parsedKey);
      const parsedTime = !isNaN(parsed.getTime())
        ? `${String(parsed.getHours()).padStart(2, '0')}:${parsed.getMinutes() >= 30 ? '30' : '00'}`
        : '09:00';

      setEditingAppointment(apt);
      setVisitType(vt);
      setLocationInput(apt.location || defaultLocationForVisit(vt));
      setLocationTouched(Boolean(apt.location));
      const cleanNotes = stripAppointmentSystemTags(apt.clinical_notes);
      setNotesInput(cleanNotes === 'Gia đình yêu cầu khám sức khỏe' ? '' : cleanNotes);

      if (matchedOpt && !isSlotInPast(matchedOpt.date, parsedTime)) {
        setSelectedDateKey(matchedOpt.key);
        setSelectedTimeSlot(parsedTime);
      } else {
        const best = findFirstAvailableSlot(dateOptions, vt, busySlots, apt.id);
        setSelectedDateKey(best.dateKey);
        setSelectedTimeSlot(best.timeSlot);
      }
      setMode('RESCHEDULE');
      fetchBusySlots();
    },
    [busySlots, dateOptions, defaultLocationForVisit, fetchBusySlots]
  );

  useEffect(() => {
    if (!visible) return;
    const effectiveMode = canManageRecords ? initialMode : 'LIST';
    setMode(effectiveMode);
    if (effectiveMode === 'BOOK') {
      openBookForm(busySlots);
    }
    fetchAppointments();
    fetchBusySlots().then((slots) => {
      if (effectiveMode === 'BOOK' && !userPickedSlotRef.current) {
        const best = findFirstAvailableSlot(dateOptions, 'HOME_VISIT', slots);
        setSelectedDateKey(best.dateKey);
        setSelectedTimeSlot(best.timeSlot);
      }
    });
  }, [visible, initialMode, normalizedPatientId, canManageRecords]);

  const selectedDateObj = useMemo(
    () => dateOptions.find((d) => d.key === selectedDateKey)?.date || dateOptions[0]?.date || new Date(),
    [dateOptions, selectedDateKey]
  );

  const handleVisitTypeChange = (nextVt: 'HOME_VISIT' | 'CLINIC') => {
    setVisitType(nextVt);
    if (!locationTouched) {
      setLocationInput(defaultLocationForVisit(nextVt));
    }
  };

  const handleConfirmAppointment = async (aptId: string) => {
    if (!normalizedPatientId || !canManageRecords) return;
    try {
      setConfirmingId(aptId);
      await patientApi.confirmAppointment(normalizedPatientId, aptId);
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === aptId
            ? {
                ...a,
                clinical_notes: `[ĐÃ XÁC NHẬN ĐÓN TIẾP] ${stripAppointmentSystemTags(a.clinical_notes)}`.trim(),
              }
            : a
        )
      );
      const vitalState = useVitalStore.getState();
      (vitalState.incidents || [])
        .filter((inc: any) => String(inc.note || inc.notes || '').includes(String(aptId)) && !inc.is_acknowledged)
        .forEach((inc: any) => vitalState.acknowledgeIncident(inc.id, 'Gia đình đã xác nhận đón tiếp'));
      onAppointmentChanged?.();
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

  const handleConfirmCancelAppointment = (apt: FamilyAppointmentItem) => {
    if (!normalizedPatientId || !canManageRecords) return;
    LocalizedAlert.alert(
      'Xác nhận hủy lịch khám',
      `Bạn có chắc muốn hủy lịch khám lúc ${formatAppointmentTime(apt.scheduled_at)} không?`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Hủy lịch',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingId(apt.id);
              await patientApi.cancelAppointment(
                normalizedPatientId,
                apt.id,
                'Gia đình hủy yêu cầu lịch khám'
              );
              await Promise.all([fetchAppointments(), fetchBusySlots()]);
              onAppointmentChanged?.();
              LocalizedAlert.alert('Đã hủy lịch', 'Yêu cầu lịch khám đã được hủy và thông báo cho Bác sĩ.');
            } catch (err: any) {
              LocalizedAlert.alert(
                'Lỗi hủy lịch',
                err?.response?.data?.detail || 'Không thể hủy lịch khám vào lúc này.'
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSubmitForm = async () => {
    if (!canManageRecords) {
      LocalizedAlert.alert('Không có quyền', 'Tài khoản thành viên chỉ xem không thể đặt hoặc dời lịch khám.');
      return;
    }
    if (!normalizedPatientId) {
      LocalizedAlert.alert('Chưa có hồ sơ', 'Không tìm thấy mã bệnh nhân hợp lệ để đặt lịch khám.');
      return;
    }

    const scheduledDate = buildLocalDateTime(selectedDateObj, selectedTimeSlot);
    if (!scheduledDate || isNaN(scheduledDate.getTime())) {
      LocalizedAlert.alert('Thời gian không hợp lệ', 'Vui lòng chọn ngày và khung giờ khám.');
      return;
    }
    if (scheduledDate.getTime() <= Date.now()) {
      LocalizedAlert.alert('Thời gian không hợp lệ', 'Thời gian hẹn phải ở trong tương lai.');
      return;
    }

    const excludeId = mode === 'RESCHEDULE' ? editingAppointment?.id : null;
    if (isDoctorBusyForSlot(selectedDateObj, selectedTimeSlot, visitType, busySlots, excludeId)) {
      LocalizedAlert.alert(
        'Khung giờ bác sĩ bận',
        'Bác sĩ đã có lịch khám khác trong khung giờ này. Vui lòng chọn khung giờ trống khác.'
      );
      return;
    }

    const finalLocation = locationInput.trim() || defaultLocationForVisit(visitType);
    const formattedNotes = notesInput.trim()
      ? `[Yêu cầu lịch khám] ${notesInput.trim()}`
      : 'Gia đình yêu cầu khám sức khỏe';

    try {
      setSubmitting(true);
      if (mode === 'RESCHEDULE' && editingAppointment) {
        await patientApi.rescheduleAppointment(normalizedPatientId, editingAppointment.id, {
          scheduled_at: scheduledDate.toISOString(),
          visit_type: visitType,
          location: finalLocation,
          clinical_notes: formattedNotes,
        });
      } else {
        await patientApi.requestAppointment(normalizedPatientId, {
          patient_id: normalizedPatientId,
          patient_name: patientName || 'Người cao tuổi',
          scheduled_at: scheduledDate.toISOString(),
          duration_minutes: 30,
          visit_type: visitType,
          location: finalLocation,
          clinical_notes: formattedNotes,
          enable_speaker_reminder: true,
        });
      }

      const displayDate =
        dateOptions.find((d) => d.key === selectedDateKey)?.dateLabel || toLocalDateKey(selectedDateObj);
      await Promise.all([fetchAppointments(), fetchBusySlots()]);
      onAppointmentChanged?.();
      setEditingAppointment(null);
      setActiveTab('UPCOMING');
      setMode('LIST');

      LocalizedAlert.alert(
        'Thành công',
        mode === 'RESCHEDULE'
          ? `Đã dời lịch khám sang ${selectedTimeSlot} ngày ${displayDate}. Hệ thống đã thông báo cho Bác sĩ phụ trách.`
          : `Đã gửi yêu cầu lịch khám lúc ${selectedTimeSlot} ngày ${displayDate}${doctorName ? ` với ${doctorName}` : ''}. Vui lòng chờ Bác sĩ xác nhận!`
      );
    } catch (err: any) {
      fetchBusySlots();
      LocalizedAlert.alert(
        err?.response?.status === 409 ? 'Khung giờ đã kín' : 'Lỗi đặt lịch',
        err?.response?.data?.detail || 'Không thể lưu lịch khám lúc này. Vui lòng thử lại sau.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
    fetchBusySlots();
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (activeTab === 'UPCOMING') return apt.status === 'UPCOMING' || apt.status === 'CONFIRMED';
    if (activeTab === 'COMPLETED') return apt.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return apt.status === 'CANCELLED';
    return true;
  });

  const isFormMode = mode === 'BOOK' || mode === 'RESCHEDULE';
  const excludeSlotId = mode === 'RESCHEDULE' ? editingAppointment?.id : null;
  const fieldBg = isDarkMode ? '#0F172A' : '#F8FAFC';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {mode === 'BOOK'
                  ? 'Đặt Lịch Khám'
                  : mode === 'RESCHEDULE'
                  ? 'Dời Lịch Khám'
                  : 'Lịch Khám'}
              </LocalizedText>
              {patientName ? (
                <LocalizedText style={[styles.modalSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Bệnh nhân: {patientName}
                  {doctorName && isFormMode ? ` • BS. ${doctorName}` : ''}
                </LocalizedText>
              ) : null}
            </View>

            <View style={styles.headerActionsRow}>
              {!isFormMode && normalizedPatientId && canManageRecords ? (
                <TouchableOpacity
                  style={styles.btnHeaderBook}
                  onPress={() => {
                    openBookForm(busySlots);
                    fetchBusySlots();
                  }}
                >
                  <Ionicons name="add" size={15} color="#FFFFFF" />
                  <LocalizedText style={styles.btnHeaderBookText}>Đặt lịch</LocalizedText>
                </TouchableOpacity>
              ) : null}
              {isFormMode ? (
                <TouchableOpacity
                  style={[styles.btnHeaderBack, { borderColor: borderCol }]}
                  onPress={() => {
                    setEditingAppointment(null);
                    setMode('LIST');
                  }}
                >
                  <Ionicons name="list-outline" size={14} color="#0284C7" />
                  <LocalizedText style={styles.btnHeaderBackText}>Danh sách</LocalizedText>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} style={styles.btnClose}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          {isFormMode ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
              {mode === 'RESCHEDULE' && editingAppointment ? (
                <View
                  style={[
                    styles.noticeBox,
                    { backgroundColor: isDarkMode ? '#0F172A88' : '#FFF7ED', borderColor: '#FDBA74' },
                  ]}
                >
                  <Ionicons name="swap-horizontal" size={14} color="#EA580C" style={{ marginRight: 6 }} />
                  <LocalizedText style={[styles.noticeText, { color: isDarkMode ? '#FDBA74' : '#9A3412' }]}>
                    Lịch cũ: {formatAppointmentTime(editingAppointment.scheduled_at)}
                  </LocalizedText>
                </View>
              ) : null}

              {/* Visit type */}
              <LocalizedText style={[styles.formLabel, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                Hình thức khám
              </LocalizedText>
              <View style={styles.visitTypeRow}>
                {[
                  { key: 'HOME_VISIT' as const, label: 'Khám tại nhà', icon: 'home-outline' as const },
                  { key: 'CLINIC' as const, label: 'Tại phòng khám', icon: 'business-outline' as const },
                ].map((vt) => {
                  const active = visitType === vt.key;
                  return (
                    <TouchableOpacity
                      key={vt.key}
                      style={[
                        styles.visitTypeBtn,
                        {
                          backgroundColor: active
                            ? isDarkMode
                              ? '#064E3B'
                              : '#ECFDF5'
                            : fieldBg,
                          borderColor: active ? '#059669' : borderCol,
                          borderWidth: active ? 1.5 : 1,
                        },
                      ]}
                      onPress={() => handleVisitTypeChange(vt.key)}
                    >
                      <Ionicons name={vt.icon} size={15} color={active ? '#059669' : '#64748B'} />
                      <LocalizedText
                        style={[
                          styles.visitTypeText,
                          { color: active ? '#059669' : colors.textPrimary, fontWeight: active ? '700' : '500' },
                        ]}
                      >
                        {vt.label}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date selector */}
              <LocalizedText style={[styles.formLabel, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                Chọn ngày khám (15 ngày tới)
              </LocalizedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateChipsRow}
              >
                {dateOptions.map((opt) => {
                  const selected = selectedDateKey === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.dateChipBtn,
                        {
                          backgroundColor: selected ? '#0284C7' : fieldBg,
                          borderColor: selected ? '#0284C7' : borderCol,
                        },
                      ]}
                      onPress={() => {
                        userPickedSlotRef.current = true;
                        setSelectedDateKey(opt.key);
                      }}
                    >
                      <LocalizedText
                        style={[
                          styles.dateChipDay,
                          { color: selected ? '#E0F2FE' : isDarkMode ? '#94A3B8' : '#64748B' },
                        ]}
                      >
                        {opt.dayLabel}
                      </LocalizedText>
                      <LocalizedText
                        style={[styles.dateChipDate, { color: selected ? '#FFFFFF' : colors.textPrimary }]}
                      >
                        {opt.dateLabel}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time slot grid */}
              <View style={styles.slotSectionHeader}>
                <LocalizedText style={[styles.formLabel, { color: isDarkMode ? '#CBD5E1' : '#475569', marginBottom: 0 }]}>
                  Chọn khung giờ khám
                </LocalizedText>
                {loadingBusySlots ? (
                  <ActivityIndicator size="small" color="#0284C7" />
                ) : (
                  <LocalizedText style={styles.slotHintText}>
                    {busySlots.length > 0 ? `${busySlots.length} lịch bận của BS` : 'Bác sĩ đang trống lịch'}
                  </LocalizedText>
                )}
              </View>

              <View style={styles.timeSlotGrid}>
                {FAMILY_TIME_SLOTS.map((slot) => {
                  const isPast = isSlotInPast(selectedDateObj, slot);
                  const isBusy =
                    !isPast &&
                    isDoctorBusyForSlot(selectedDateObj, slot, visitType, busySlots, excludeSlotId);
                  const disabled = isPast || isBusy;
                  const active = selectedTimeSlot === slot && !disabled;

                  return (
                    <TouchableOpacity
                      key={slot}
                      disabled={disabled}
                      style={[
                        styles.timeSlotBtn,
                        isBusy
                          ? {
                              backgroundColor: isDarkMode ? '#450A0A44' : '#FEF2F2',
                              borderColor: '#FCA5A5',
                              opacity: 0.75,
                            }
                          : isPast
                          ? {
                              backgroundColor: fieldBg,
                              borderColor: borderCol,
                              opacity: 0.45,
                            }
                          : active
                          ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                          : { backgroundColor: fieldBg, borderColor: borderCol },
                      ]}
                      onPress={() => {
                        userPickedSlotRef.current = true;
                        setSelectedTimeSlot(slot);
                      }}
                    >
                      <LocalizedText
                        style={[
                          styles.timeSlotText,
                          {
                            color: isBusy
                              ? '#DC2626'
                              : isPast
                              ? '#94A3B8'
                              : active
                              ? '#FFFFFF'
                              : colors.textPrimary,
                            fontWeight: active ? '700' : '600',
                            textDecorationLine: disabled ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {slot}
                      </LocalizedText>
                      {isBusy ? (
                        <LocalizedText style={styles.slotBusyLabel}>Bác sĩ bận</LocalizedText>
                      ) : isPast ? (
                        <LocalizedText style={styles.slotPastLabel}>Đã qua</LocalizedText>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {visitType === 'HOME_VISIT' ? (
                <LocalizedText style={[styles.bufferNote, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Lưu ý: Khám tại nhà cần cách các lịch khác của bác sĩ tối thiểu 60 phút để di chuyển.
                </LocalizedText>
              ) : null}

              {/* Location */}
              <LocalizedText style={[styles.formLabel, { color: isDarkMode ? '#CBD5E1' : '#475569', marginTop: 10 }]}>
                Địa điểm khám
              </LocalizedText>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: fieldBg, color: colors.textPrimary, borderColor: borderCol },
                ]}
                value={locationInput}
                onChangeText={(val) => {
                  setLocationTouched(true);
                  setLocationInput(val);
                }}
                placeholder="Nhập địa điểm khám..."
                placeholderTextColor="#94A3B8"
              />

              {/* Notes */}
              <LocalizedText style={[styles.formLabel, { color: isDarkMode ? '#CBD5E1' : '#475569', marginTop: 10 }]}>
                Ghi chú / Triệu chứng (tùy chọn)
              </LocalizedText>
              <TextInput
                style={[
                  styles.formInput,
                  styles.formTextArea,
                  { backgroundColor: fieldBg, color: colors.textPrimary, borderColor: borderCol },
                ]}
                value={notesInput}
                onChangeText={setNotesInput}
                multiline
                numberOfLines={2}
                placeholder="VD: Cụ hơi chóng mặt vào buổi sáng..."
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.formActionsRow}>
                <TouchableOpacity
                  style={[styles.btnFormCancel, { borderColor: borderCol, backgroundColor: fieldBg }]}
                  disabled={submitting}
                  onPress={() => {
                    if (initialMode === 'BOOK' && appointments.length === 0) {
                      onClose();
                    } else {
                      setEditingAppointment(null);
                      setMode('LIST');
                    }
                  }}
                >
                  <LocalizedText style={[styles.btnFormCancelText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                    Hủy
                  </LocalizedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnFormSubmit, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleSubmitForm}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <LocalizedText style={styles.btnFormSubmitText}>
                      {mode === 'RESCHEDULE' ? 'Lưu dời lịch' : 'Xác nhận đặt lịch'}
                    </LocalizedText>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <>
              {/* Notice */}
              <View
                style={[
                  styles.noticeBox,
                  { backgroundColor: isDarkMode ? '#0F172A88' : '#EFF6FF', borderColor: '#3B82F633' },
                ]}
              >
                <Ionicons name="shield-checkmark" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                <LocalizedText style={[styles.noticeText, { color: isDarkMode ? '#93C5FD' : '#0369A1' }]}>
                  {canManageRecords
                    ? 'Theo dõi lịch khám từ Bác sĩ hoặc đặt yêu cầu lịch khám mới cho gia đình.'
                    : 'Chế độ chỉ xem: bạn có thể theo dõi lịch khám (Chủ hộ hoặc người quản lý mới có quyền đặt/đổi lịch).'}
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
                style={{ flex: 1 }}
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
                    const statusInfo = getFamilyAppointmentStatusInfo(apt);
                    const canManage = canManageRecords && canFamilyManageAppointment(apt);
                    const isCompleted = apt.status === 'COMPLETED';
                    const cleanInstructions = stripAppointmentSystemTags(apt.instructions || apt.clinical_notes);

                    const badgeBg = statusInfo.isUpcoming
                      ? statusInfo.isConfirmed
                        ? '#D1FAE5'
                        : statusInfo.isFamilyRequested
                        ? '#DBEAFE'
                        : '#FEF3C7'
                      : isCompleted
                      ? '#D1FAE5'
                      : '#FEE2E2';

                    const badgeColor = statusInfo.isUpcoming
                      ? statusInfo.isConfirmed
                        ? '#059669'
                        : statusInfo.isFamilyRequested
                        ? '#1D4ED8'
                        : '#D97706'
                      : isCompleted
                      ? '#059669'
                      : '#DC2626';

                    return (
                      <View
                        key={apt.id}
                        style={[
                          styles.card,
                          {
                            backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                            borderColor: statusInfo.isUpcoming
                              ? statusInfo.isConfirmed
                                ? '#10B98155'
                                : statusInfo.isFamilyRequested
                                ? '#3B82F655'
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
                            <LocalizedText style={styles.dateText}>{formatAppointmentTime(apt.scheduled_at)}</LocalizedText>
                          </View>

                          <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                            <LocalizedText style={[styles.statusText, { color: badgeColor }]}>
                              {statusInfo.label}
                            </LocalizedText>
                          </View>
                        </View>

                        {/* Specialty / Purpose */}
                        <View style={styles.specialtyRow}>
                          <Ionicons name="medkit" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                          <LocalizedText style={[styles.specialtyText, { color: colors.textPrimary }]}>
                            {formatExamType(apt.exam_type || apt.visit_type)}
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
                              📝 <LocalizedText style={{ fontWeight: '700' }}>Dặn dò / Ghi chú:</LocalizedText>{' '}
                              {cleanInstructions}
                            </LocalizedText>
                          </View>
                        ) : null}

                        {/* Doctor-scheduled: family confirm prompt */}
                        {canManageRecords && statusInfo.showFamilyConfirmPrompt && (
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
                                Lịch khám đang chờ gia đình xác nhận sẵn sàng đón tiếp.
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

                        {/* Family-requested pending doctor confirmation notice */}
                        {statusInfo.isUpcoming && statusInfo.isFamilyRequested && !statusInfo.isConfirmed && (
                          <View
                            style={[
                              styles.pendingDoctorBox,
                              {
                                backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF',
                                borderColor: '#3B82F644',
                              },
                            ]}
                          >
                            <Ionicons name="time-outline" size={14} color="#2563EB" style={{ marginRight: 6 }} />
                            <LocalizedText style={[styles.pendingDoctorText, { color: isDarkMode ? '#93C5FD' : '#1D4ED8' }]}>
                              Yêu cầu đặt lịch đã gửi tới Bác sĩ phụ trách. Đang chờ Bác sĩ xác nhận.
                            </LocalizedText>
                          </View>
                        )}

                        {/* Confirmed notice */}
                        {statusInfo.isUpcoming && statusInfo.isConfirmed && (
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
                              {statusInfo.isFamilyRequested
                                ? 'Bác sĩ đã xác nhận lịch khám. Hệ thống sẽ phát loa nhắc trước 24h & 2h.'
                                : 'Gia đình đã xác nhận đón tiếp Bác sĩ. Hệ thống sẽ phát loa nhắc trước 24h & 2h.'}
                            </LocalizedText>
                          </View>
                        )}

                        {/* Family-booked actions: Reschedule & Cancel */}
                        {canManage && (
                          <View style={styles.familyActionRow}>
                            <TouchableOpacity
                              style={[
                                styles.btnReschedule,
                                {
                                  borderColor: '#0284C7',
                                  backgroundColor: isDarkMode ? '#0F2942' : '#EFF6FF',
                                },
                              ]}
                              onPress={() => openRescheduleForm(apt)}
                              disabled={cancellingId === apt.id}
                            >
                              <Ionicons name="calendar-outline" size={14} color={isDarkMode ? '#60A5FA' : '#0284C7'} />
                              <LocalizedText style={[styles.btnRescheduleText, isDarkMode && { color: '#93C5FD' }]}>
                                Dời lịch
                              </LocalizedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.btnCancelApt,
                                {
                                  borderColor: isDarkMode ? '#7F1D1D' : '#FCA5A5',
                                  backgroundColor: isDarkMode ? '#450A0A55' : '#FEF2F2',
                                },
                              ]}
                              onPress={() => handleConfirmCancelAppointment(apt)}
                              disabled={cancellingId === apt.id}
                            >
                              {cancellingId === apt.id ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                              ) : (
                                <>
                                  <Ionicons name="close-circle-outline" size={14} color={isDarkMode ? '#FCA5A5' : '#DC2626'} />
                                  <LocalizedText style={[styles.btnCancelAptText, isDarkMode && { color: '#FCA5A5' }]}>
                                    Hủy lịch
                                  </LocalizedText>
                                </>
                              )}
                            </TouchableOpacity>
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

                        {/* Hub reminder status (chỉ hiển thị cho lịch sắp tới / đã xác nhận) */}
                        {statusInfo.isUpcoming && (
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
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Close button */}
              <TouchableOpacity style={styles.btnBottomClose} onPress={onClose}>
                <LocalizedText style={styles.btnBottomCloseText}>Đóng</LocalizedText>
              </TouchableOpacity>
            </>
          )}
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
    height: '84%',
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnHeaderBook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnHeaderBookText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  btnHeaderBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  btnHeaderBackText: {
    color: '#0284C7',
    fontSize: 12.5,
    fontWeight: '700',
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 44,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...(typeof window !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  tabText: {
    fontSize: 12.5,
  },
  scrollList: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  emptyContainer: {
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnConfirmFamilyText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  pendingDoctorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  pendingDoctorText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
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
  familyActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  btnReschedule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
  },
  btnRescheduleText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
  },
  btnCancelApt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
  },
  btnCancelAptText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  visitTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  visitTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 10,
  },
  visitTypeText: {
    fontSize: 12.5,
  },
  dateChipsRow: {
    gap: 8,
    paddingBottom: 12,
  },
  dateChipBtn: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  dateChipDay: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  dateChipDate: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 2,
  },
  slotSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotHintText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
  },
  timeSlotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotBtn: {
    width: '23%',
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotText: {
    fontSize: 12,
  },
  slotBusyLabel: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 1,
  },
  slotPastLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  bufferNote: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  formTextArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btnFormCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFormCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  btnFormSubmit: {
    flex: 1.4,
    backgroundColor: '#059669',
    borderRadius: 10,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFormSubmitText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
