// ==============================================================================
// TỆP: MedicationReminderScreen.tsx
// PHÂN HỆ: Màn hình Quản lý Lịch Uống thuốc & Chế độ Sinh hoạt Hàng ngày
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   1. Quản lý danh sách các cữ thuốc theo buổi (Sáng, Trưa, Tối) và Lịch uống nước.
//   2. Tích hợp tính năng Phát lời nhắc giọng nói tự động qua Loa thông minh Edge Hub (FR12).
//   3. Cho phép thêm cữ thuốc mới, lọc theo buổi và đánh dấu hoàn thành từng cữ thuốc.
//   4. Hiển thị trạng thái trống (Empty State) chuẩn xác khi chưa tạo lịch nhắc nhở.
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Modal, Pressable, ActivityIndicator, Platform, Image, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatGenderVN } from '../../../utils/formatters';
import { resolveAvatarUrl } from '../../auth/hooks/useProfileManager';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { usePatientStore, ReminderItem } from '../../../store/usePatientStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { remindersApi } from '../../../services/api';
import { cameraApi } from '../../../services/camera';
import { handleHeaderBack } from '../../../navigation/navigationHelpers';

// Cấu trúc dữ liệu một mốc nhắc uống nước / sinh hoạt
interface HydrationSchedule {
  time: string;
  amount: string;
  note: string;
  done: boolean;
}

export default function MedicationReminderScreen({ navigation, route }: any) {
  const { isDarkMode } = useTheme();

  // Kết nối Store trung tâm usePatientStore để đồng bộ 2 chiều với Trang chủ & Thông báo
  const {
    todayReminders,
    fetchReminders,
    markMedicationTaken,
    patientsList,
    fetchPatientsList,
    activePatientId,
    setActivePatientId,
  } = usePatientStore();
  const { userRole, role, permissions, fetchMyPermissions, has_house, household_id } = useAuthStore();
  const [checkingPerms, setCheckingPerms] = useState(true);
  const isSpecialUser = userRole === 'admin' || userRole === 'doctor' || role === 'admin' || role === 'doctor';
  const hasNoHouse = !isSpecialUser && (!household_id || has_house === false);

  const initialPatientId = hasNoHouse
    ? undefined
    : (route?.params?.patientId ||
       activePatientId ||
       (patientsList && patientsList[0]?.id) ||
       undefined);
  const [selectedPatientId, setSelectedPatientId] = useState<any>(initialPatientId);

  useEffect(() => {
    fetchPatientsList?.();
    fetchMyPermissions().finally(() => setCheckingPerms(false));
  }, []);

  useEffect(() => {
    if (route?.params?.patientId && String(route.params.patientId) !== String(selectedPatientId)) {
      setSelectedPatientId(route.params.patientId);
    }
  }, [route?.params?.patientId]);

  const currentPatient = hasNoHouse ? null : (
    (patientsList || []).find(
      (p: any) => p.id == selectedPatientId || p.elderly_id == selectedPatientId
    ) || (patientsList && patientsList.length > 0 ? patientsList[0] : null)
  );
  const effectivePatientId = currentPatient?.id || currentPatient?.elderly_id || selectedPatientId;

  useEffect(() => {
    if (hasNoHouse) return;
    if (effectivePatientId) {
      fetchReminders(effectivePatientId);
    } else {
      fetchReminders();
    }
  }, [effectivePatientId, hasNoHouse]);

  const patientDisplayName =
    currentPatient?.full_name ||
    currentPatient?.name ||
    (hasNoHouse ? '' : route?.params?.patientName) ||
    '';

  const isOwnerOrAdmin =
    userRole === 'admin' ||
    role === 'admin' ||
    userRole === 'owner' ||
    role === 'owner' ||
    Boolean(permissions?.is_owner) ||
    permissions?.role_in_house === 'OWNER';
  const canManageRecords = isOwnerOrAdmin || Boolean(permissions?.can_manage_records);

  // Trạng thái bật/tắt phát giọng nói nhắc nhở qua Loa thông minh Edge Hub (FR12)
  const [hubVoiceReminderEnabled, setHubVoiceReminderEnabled] = useState(true);
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);

  // Bộ lọc hiển thị theo buổi: Tất cả | Buổi sáng | Buổi trưa | Buổi tối
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MORNING' | 'NOON' | 'EVENING'>('ALL');

  // Danh sách cữ thuốc thực tế đồng bộ từ Store
  const medications: ReminderItem[] = todayReminders?.medications || [];

  // Danh sách lịch uống nước trong ngày (đồng bộ từ backend)
  const hydrationList: Array<HydrationSchedule & { id?: string }> = todayReminders?.hydrations || [];
  const [isAddHydrationVisible, setAddHydrationVisible] = useState(false);
  const [hydrationDraft, setHydrationDraft] = useState({ time: '08:00', amount: '250ml', note: 'Uống 1 ly nước ấm' });

  const handleAddHydrationSlot = async () => {
    const t = hydrationDraft.time.trim() || '08:00';
    const amt = hydrationDraft.amount.trim() || '250ml';
    const nt = hydrationDraft.note.trim() || 'Nhắc uống nước qua loa Hub';
    try {
      await remindersApi.createHydration({
        time: t,
        amount: amt,
        note: nt,
        patient_id: effectivePatientId ? String(effectivePatientId) : undefined,
      });
      await fetchReminders(effectivePatientId);
      setAddHydrationVisible(false);
    } catch {
      LocalizedAlert.alert('Lỗi', 'Không thể thêm mốc uống nước. Vui lòng thử lại.');
    }
  };

  // State quản lý Kê đơn thuốc mới (Chuẩn nghiệp vụ lâm sàng)
  interface PrescriptionMedDraft {
    id: string;
    name: string;
    dose: string;
    sessions: ('MORNING' | 'NOON' | 'EVENING')[];
    time: string;
    sessionTimes?: Partial<Record<'MORNING' | 'NOON' | 'EVENING', string>>;
    instructions: string;
  }

  const [isAddMedModalVisible, setAddMedModalVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{ medId: string; session: 'MORNING' | 'NOON' | 'EVENING' } | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [datePickerTarget, setDatePickerTarget] = useState<'START' | 'END' | null>(null);
  const [datePickerMonth, setDatePickerMonth] = useState<Date>(() => new Date());

  const formatDisplayDateVN = (isoDate: string) => {
    const parts = (isoDate || '').split('-');
    if (parts.length !== 3) return isoDate || 'Chọn ngày';
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const openPrescriptionDatePicker = (target: 'START' | 'END') => {
    const raw = target === 'START' ? startDate : endDate;
    const parsed = raw ? new Date(raw) : new Date();
    const valid = !isNaN(parsed.getTime()) ? parsed : new Date();
    setDatePickerMonth(new Date(valid.getFullYear(), valid.getMonth(), 1));
    setDatePickerTarget(target);
  };
  const [medList, setMedList] = useState<PrescriptionMedDraft[]>([
    {
      id: 'm_1',
      name: '',
      dose: '1 viên',
      sessions: ['MORNING'],
      time: '08:00',
      instructions: 'Sau khi ăn no',
    },
  ]);
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);

  const handleAddMedItem = () => {
    setMedList((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}_${prev.length + 1}`,
        name: '',
        dose: '1 viên',
        sessions: ['MORNING'],
        time: '08:00',
        instructions: 'Sau khi ăn no',
      },
    ]);
  };

  const handleRemoveMedItem = (id: string) => {
    if (medList.length <= 1) return;
    setMedList((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateMedItem = (id: string, field: keyof PrescriptionMedDraft, value: any) => {
    setMedList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const SESSION_DEFAULT_TIMES: Record<'MORNING' | 'NOON' | 'EVENING', string> = {
    MORNING: '08:00',
    NOON: '12:00',
    EVENING: '20:00',
  };

  const handleToggleMedSession = (id: string, session: 'MORNING' | 'NOON' | 'EVENING') => {
    setMedList((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const exists = m.sessions.includes(session);
        const next = exists ? m.sessions.filter((s) => s !== session) : [...m.sessions, session];
        const finalSessions = next.length > 0 ? next : [session];
        const nextSessionTimes = { ...(m.sessionTimes || {}) };
        if (!exists && !nextSessionTimes[session]) {
          nextSessionTimes[session] = SESSION_DEFAULT_TIMES[session];
        }
        const primarySession = finalSessions[0];
        return {
          ...m,
          sessions: finalSessions,
          sessionTimes: nextSessionTimes,
          time: nextSessionTimes[primarySession] || SESSION_DEFAULT_TIMES[primarySession],
        };
      })
    );
  };

  const handleSetDurationDays = (days: number) => {
    const start = new Date(startDate || Date.now());
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleSavePrescription = async () => {
    if (!canManageRecords) {
      LocalizedAlert.alert(
        'Không có quyền thay đổi',
        'Tài khoản Thành viên chưa được cấp quyền "Quản lý Lịch thuốc & Bệnh án". Vui lòng liên hệ Chủ hộ để được cấp quyền.'
      );
      return;
    }
    const diagTrimmed = diagnosis.trim();
    if (!diagTrimmed) {
      LocalizedAlert.alert('Thiếu thông tin', 'Vui lòng nhập Tên bệnh / Chẩn đoán điều trị.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      LocalizedAlert.alert('Ngày không hợp lệ', 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.');
      return;
    }
    const emptyMed = medList.find((m) => !m.name.trim());
    if (emptyMed) {
      LocalizedAlert.alert('Thiếu thông tin', 'Vui lòng nhập tên & hàm lượng cho tất cả các loại thuốc trong đơn.');
      return;
    }

    setIsSavingPrescription(true);
    try {
      await remindersApi.createPrescription({
        diagnosis: diagTrimmed,
        start_date: startDate,
        end_date: endDate,
        patient_id: effectivePatientId ? String(effectivePatientId) : undefined,
        medications: medList.map((m) => {
          const primarySession = m.sessions[0] || 'MORNING';
          return {
            name: m.name.trim(),
            dose: m.dose.trim() || '1 viên',
            sessions: m.sessions,
            time: m.sessionTimes?.[primarySession] || SESSION_DEFAULT_TIMES[primarySession],
            session_times: m.sessionTimes,
            instructions: m.instructions.trim(),
          };
        }),
      });

      await fetchReminders(effectivePatientId);

      setAddMedModalVisible(false);
      setDiagnosis('');
      setMedList([
        {
          id: 'm_1',
          name: '',
          dose: '1 viên',
          sessions: ['MORNING'],
          time: '08:00',
          instructions: 'Sau khi ăn no',
        },
      ]);
      LocalizedAlert.alert(
        'Thành công 🎉',
        `Đã lưu đơn thuốc "${diagTrimmed}" gồm ${medList.length} loại thuốc cho ${patientDisplayName}.`
      );
    } catch (err) {
      console.warn('Lỗi khi lưu đơn thuốc:', err);
      LocalizedAlert.alert('Lỗi', 'Không thể lưu đơn thuốc lên máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSavingPrescription(false);
    }
  };

  const [deletingRxId, setDeletingRxId] = useState<string | null>(null);

  const handleDeletePrescription = (rx: any) => {
    if (!canManageRecords || deletingRxId) {
      if (!canManageRecords) {
        LocalizedAlert.alert(
          'Không có quyền thao tác',
          'Tài khoản Thành viên chưa được cấp quyền "Quản lý Lịch thuốc & Bệnh án".'
        );
      }
      return;
    }
    const rxIdStr = String(rx.id);
    LocalizedAlert.alert(
      'Xóa đơn thuốc điều trị',
      `Bạn có chắc muốn xóa đơn thuốc "${rx.medication_name}" khỏi lịch nhắc nhở của ${patientDisplayName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            setDeletingRxId(rxIdStr);
            try {
              await remindersApi.deletePrescription(rxIdStr, effectivePatientId);
              const rxTimes = new Set(Array.isArray(rx.schedule_times) ? rx.schedule_times : []);
              const orphaned = medications.filter(
                (m) =>
                  !String(m.id).startsWith('rx-med-') &&
                  m.name === rx.medication_name &&
                  (rxTimes.size === 0 || rxTimes.has(m.time))
              );
              await Promise.all(
                orphaned.map((m) => remindersApi.delete(m.id, effectivePatientId).catch(() => {}))
              );
              await fetchReminders(effectivePatientId);
            } catch {
              LocalizedAlert.alert('Lỗi', 'Không thể xóa đơn thuốc. Vui lòng thử lại.');
            } finally {
              setDeletingRxId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteMedication = (med: ReminderItem) => {
    if (!canManageRecords) {
      LocalizedAlert.alert(
        'Không có quyền thao tác',
        'Tài khoản Thành viên chưa được cấp quyền "Quản lý Lịch thuốc & Bệnh án".'
      );
      return;
    }
    LocalizedAlert.alert(
      'Xóa cữ thuốc',
      `Bạn có chắc muốn xóa cữ thuốc "${med.name}" (${med.time})?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await remindersApi.delete(med.id, effectivePatientId);
              await fetchReminders(effectivePatientId);
            } catch {
              LocalizedAlert.alert('Lỗi', 'Không thể xóa cữ thuốc. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  // Đánh dấu hoàn thành hoặc hoàn tác một cữ thuốc
  const toggleMedicationTaken = async (id: string) => {
    const med = medications.find((item) => item.id === id);
    if (!med) return;
    const nextState = !med.taken;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await markMedicationTaken(id, nextState, nextState ? timeStr : undefined, effectivePatientId);
    if (nextState) {
      LocalizedAlert.alert('Đã xác nhận', `Đã đánh dấu uống thuốc "${med.name}" lúc ${timeStr} cho ${patientDisplayName}.`);
    } else {
      LocalizedAlert.alert('Hoàn tác', `Đã chuyển "${med.name}" về trạng thái chưa uống.`);
    }
  };

  const toggleHydrationDone = async (hydrationId?: string) => {
    if (!hydrationId) return;
    try {
      await remindersApi.toggleHydration(hydrationId, effectivePatientId);
      await fetchReminders(effectivePatientId);
    } catch {
      LocalizedAlert.alert('Lỗi', 'Không thể cập nhật trạng thái uống nước.');
    }
  };

  const handleDeleteHydrationSlot = async (hydrationId?: string) => {
    if (!hydrationId || !canManageRecords) return;
    try {
      await remindersApi.deleteHydration(hydrationId, effectivePatientId);
      await fetchReminders(effectivePatientId);
    } catch {
      LocalizedAlert.alert('Lỗi', 'Không thể xóa mốc uống nước.');
    }
  };

  const [speakerVolume, setSpeakerVolume] = useState<number>(80);
  const volumeTrackWidth = useRef(0);
  const volumeStartVal = useRef(80);
  const speakerVolumeRef = useRef(80);
  speakerVolumeRef.current = speakerVolume;

  useFocusEffect(
    useCallback(() => {
      cameraApi.getSpeakerVolume().then((res) => {
        if (typeof res.data?.volume === 'number') {
          setSpeakerVolume(res.data.volume);
        }
      }).catch(() => {});
    }, [])
  );

  const persistSpeakerVolume = (vol: number) => {
    cameraApi.setSpeakerVolume(vol).catch(() => {});
  };

  const volumeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const w = volumeTrackWidth.current;
        if (!w) return;
        const pct = Math.round(Math.max(0, Math.min(1, evt.nativeEvent.locationX / w)) * 100);
        volumeStartVal.current = pct;
        setSpeakerVolume(pct);
      },
      onPanResponderMove: (_, gestureState) => {
        const w = volumeTrackWidth.current;
        if (!w) return;
        const deltaPct = Math.round((gestureState.dx / w) * 100);
        setSpeakerVolume(Math.max(0, Math.min(100, volumeStartVal.current + deltaPct)));
      },
      onPanResponderRelease: () => {
        persistSpeakerVolume(speakerVolumeRef.current);
      },
    })
  ).current;

  const handleTestVoiceSpeaker = async () => {
    if (!hubVoiceReminderEnabled) {
      LocalizedAlert.alert('Loa đang tắt', 'Vui lòng gạt bật tính năng phát qua Loa thông minh Hub trước.');
      return;
    }

    const firstMed = medications.find((m) => !m.taken);
    const textNotice = firstMed
      ? `Chào ${patientDisplayName}, đã đến giờ uống thuốc ${firstMed.name}, liều ${firstMed.dose}. Cụ nhớ uống thuốc với nước ấm nhé.`
      : `Xin chào ${patientDisplayName}, loa nhắc nhở giọng nói tiếng Việt trên camera đang hoạt động bình thường.`;

    setIsPlayingTestVoice(true);
    try {
      await cameraApi.speak(textNotice, undefined, true, speakerVolume);
      LocalizedAlert.alert('Loa camera đã phát', `📢 "${textNotice}"`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Không thể kết nối tới loa camera';
      LocalizedAlert.alert('Lỗi phát loa camera', String(detail));
    } finally {
      setIsPlayingTestVoice(false);
    }
  };

  const filteredMeds = medications.filter((m) => {
    if (selectedFilter === 'ALL') return true;
    return m.session === selectedFilter;
  });

  const morningCount = medications.filter((m) => m.session === 'MORNING').length;
  const morningDone = medications.filter((m) => m.session === 'MORNING' && m.taken).length;
  const noonCount = medications.filter((m) => m.session === 'NOON').length;
  const noonDone = medications.filter((m) => m.session === 'NOON' && m.taken).length;
  const eveningCount = medications.filter((m) => m.session === 'EVENING').length;
  const eveningDone = medications.filter((m) => m.session === 'EVENING' && m.taken).length;

  const bgScreen = isDarkMode ? '#0B0F19' : '#F8FAFC';
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgScreen }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
          onPress={() => handleHeaderBack(navigation, route, 'Home', true)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={textTitle} />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <LocalizedText style={[styles.headerTitle, { color: textTitle }]}>Lịch uống thuốc & Ăn uống</LocalizedText>
          <LocalizedText style={[styles.headerSubtitle, { color: textSub }]}>Đồng bộ giọng nói Loa thông minh Hub</LocalizedText>
        </View>

        <View style={{ width: 38 }} />
      </View>

      {/* 1.1. Bộ chọn người cao tuổi khi gia đình có từ 2 người trở lên */}
      {patientsList && patientsList.length > 1 && (
        <View style={{ backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderCol }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.patientChipsRow}
          >
            {patientsList.map((p: any) => {
              const pId = p.id || p.elderly_id;
              const isSelected = pId == selectedPatientId;
              return (
                <TouchableOpacity
                  key={pId}
                  style={[
                    styles.patientChip,
                    isSelected
                      ? styles.patientChipActive
                      : [styles.patientChipInactive, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }],
                  ]}
                  onPress={() => {
                    setSelectedPatientId(pId);
                    setActivePatientId?.(pId);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="person"
                    size={13}
                    color={isSelected ? '#FFFFFF' : (isDarkMode ? '#94A3B8' : '#64748B')}
                  />
                  <LocalizedText
                    style={[
                      styles.patientChipText,
                      isSelected
                        ? styles.patientChipTextActive
                        : { color: isDarkMode ? '#CBD5E1' : '#475569' },
                    ]}
                  >
                    {p.full_name || p.name || 'Người cao tuổi'}
                    {p.age ? ` (${p.age}t)` : ''}
                  </LocalizedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 1.2. Thẻ tóm tắt thông tin người cao tuổi đang theo dõi */}
        {!currentPatient ? (
          <View style={[styles.patientHeroCard, { backgroundColor: bgCard, borderColor: borderCol, alignItems: 'center', paddingVertical: 28 }]}>
            <View style={[styles.patientAvatarCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', marginBottom: 12, marginRight: 0, width: 56, height: 56, borderRadius: 28 }]}>
              <Ionicons name="people-outline" size={28} color="#94A3B8" />
            </View>
            <LocalizedText style={[styles.patientHeroName, { color: textTitle, textAlign: 'center', marginBottom: 6 }]}>
              Chưa có người cao tuổi trong nhà
            </LocalizedText>
            <LocalizedText style={[styles.patientHeroMeta, { color: textSub, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16, marginBottom: 16 }]}>
              Vui lòng tham gia căn nhà hoặc thêm hồ sơ người cao tuổi để quản lý lịch uống thuốc và dinh dưỡng.
            </LocalizedText>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => navigation.navigate('PatientsList')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <LocalizedText style={styles.emptyAddBtnText}>Quản lý hồ sơ người cao tuổi</LocalizedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.patientHeroCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={styles.patientHeroRow}>
              {(() => {
                const rawAvatar = currentPatient?.avatar_url || null;
                const resolvedUri = rawAvatar ? resolveAvatarUrl(rawAvatar) : null;
                return (
                  <View style={[styles.patientAvatarCircle, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF', overflow: 'hidden', marginRight: 12 }]}>
                    {resolvedUri ? (
                      <Image source={{ uri: resolvedUri }} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="person" size={24} color="#2563EB" />
                    )}
                  </View>
                );
              })()}
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.patientHeroName, { color: textTitle }]}>
                  {patientDisplayName} {currentPatient?.age ? `(${currentPatient.age} tuổi)` : ''}
                </LocalizedText>
                <LocalizedText style={[styles.patientHeroMeta, { color: textSub }]}>
                  {currentPatient?.gender ? `Giới tính: ${formatGenderVN(currentPatient.gender)} • ` : ''}
                  {currentPatient?.blood_type ? `Nhóm máu: ${currentPatient.blood_type}` : 'Đang theo dõi cữ thuốc & đơn điều trị'}
                </LocalizedText>
              </View>
            </View>

            {/* Thanh tiến độ cữ thuốc */}
            <View style={[styles.patientProgressWrap, { borderTopColor: borderCol }]}>
              <View style={styles.patientProgressRow}>
                <LocalizedText style={[styles.patientProgressText, { color: textSub }]}>
                  Tiến độ cữ thuốc hôm nay
                </LocalizedText>
                <LocalizedText style={[styles.patientProgressPercent, { color: Colors.primary }]}>
                  {medications.length > 0
                    ? `${medications.filter((m) => m.taken).length}/${medications.length} cữ (${Math.round((medications.filter((m) => m.taken).length / medications.length) * 100)}%)`
                    : 'Chưa có cữ thuốc'}
                </LocalizedText>
              </View>
              <View style={[styles.progressBarTrack, isDarkMode && { backgroundColor: '#334155' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: medications.length > 0
                        ? `${Math.round((medications.filter((m) => m.taken).length / medications.length) * 100)}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* 1.3. Khối Đơn thuốc điều trị từ Bác sĩ (nếu có) */}
        {todayReminders?.doctor_prescriptions && todayReminders.doctor_prescriptions.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.sectionIconBox, { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' }]}>
                  <Ionicons name="receipt-outline" size={20} color="#059669" />
                </View>
                <View>
                  <LocalizedText style={[styles.sectionTitle, { color: textTitle }]}>
                    Đơn thuốc điều trị ({todayReminders.doctor_prescriptions.length})
                  </LocalizedText>
                  <LocalizedText style={[styles.sectionSubtitle, { color: textSub }]}>
                    Chỉ định y tế chính thức dành cho {patientDisplayName}
                  </LocalizedText>
                </View>
              </View>
            </View>

            {todayReminders.doctor_prescriptions.map((rx: any) => {
              const isDeleting = deletingRxId === String(rx.id);
              return (
              <View
                key={rx.id}
                style={[
                  styles.doctorRxCard,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: borderCol,
                    opacity: isDeleting ? 0.55 : 1,
                  },
                ]}
              >
                <View style={styles.doctorRxHeader}>
                  <View style={styles.doctorRxBadge}>
                    <Ionicons name="shield-checkmark" size={11} color="#2563EB" />
                    <LocalizedText style={styles.doctorRxBadgeText}>
                      {rx.doctor_name || 'Bác sĩ phụ trách'}
                    </LocalizedText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {rx.created_at ? (
                      <LocalizedText style={{ fontSize: 10.5, color: textSub }}>
                        {rx.created_at.split(' ')[0]}
                      </LocalizedText>
                    ) : null}
                    {canManageRecords && (
                      <TouchableOpacity
                        onPress={() => handleDeletePrescription(rx)}
                        disabled={Boolean(deletingRxId)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        {isDeleting ? (
                          <>
                            <ActivityIndicator size="small" color="#EF4444" />
                            <LocalizedText style={{ fontSize: 11, color: '#EF4444', fontWeight: '600' }}>
                              Đang xóa...
                            </LocalizedText>
                          </>
                        ) : (
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <LocalizedText style={[styles.doctorRxName, { color: textTitle }]}>
                  {rx.medication_name}
                </LocalizedText>
                <LocalizedText style={styles.doctorRxMeta}>
                  Liều lượng: {rx.dosage} {rx.quantity ? `• Số lượng: ${rx.quantity}` : ''}
                </LocalizedText>

                {rx.instructions ? (
                  <LocalizedText style={[styles.doctorRxInstructions, { color: textSub }]}>
                    Hướng dẫn: {rx.instructions}
                  </LocalizedText>
                ) : null}

                {rx.schedule_times && rx.schedule_times.length > 0 && (
                  <View style={styles.doctorRxTimesRow}>
                    <LocalizedText style={{ fontSize: 11, color: textSub, alignSelf: 'center' }}>
                      Cữ uống:
                    </LocalizedText>
                    {rx.schedule_times.map((t: string) => (
                      <View key={t} style={[styles.doctorRxTimeChip, isDarkMode && { backgroundColor: '#1E293B' }]}>
                        <Ionicons name="alarm-outline" size={11} color={Colors.primary} />
                        <LocalizedText style={[styles.doctorRxTimeText, isDarkMode && { color: '#E2E8F0' }]}>
                          {t}
                        </LocalizedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              );
            })}
          </View>
        )}
        {/* Loa thông minh Hub */}
        <View
          style={[
            styles.speakerCard,
            {
              backgroundColor: hubVoiceReminderEnabled ? (isDarkMode ? '#1E293B' : '#FFFBF5') : bgCard,
              borderColor: hubVoiceReminderEnabled ? (isDarkMode ? '#9A3412' : '#FED7AA') : borderCol,
            },
          ]}
        >
          <View style={styles.speakerTopRow}>
            <View style={[styles.speakerIconCircle, { backgroundColor: isDarkMode ? '#432005' : '#FFF7ED' }]}>
              <Ionicons name="volume-high" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <LocalizedText style={[styles.speakerTitle, { color: textTitle }]}>Loa thông minh Hub</LocalizedText>
              <LocalizedText style={[styles.speakerSubtitle, { color: textSub }]}>
                Tự động phát giọng nói tiếng Việt nhắc nhở người cao tuổi khi đến giờ
              </LocalizedText>
            </View>
            <Switch
              value={hubVoiceReminderEnabled}
              onValueChange={(val) => {
                if (!canManageRecords) {
                  LocalizedAlert.alert('Không có quyền thay đổi', 'Chỉ Chủ hộ hoặc người được ủy quyền mới có thể cấu hình loa nhắc nhở.');
                  return;
                }
                setHubVoiceReminderEnabled(val);
              }}
              disabled={!canManageRecords}
              trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: Colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.speakerDivider, { backgroundColor: borderCol }]} />

          <View style={styles.speakerVolumeRow}>
            <Ionicons
              name={speakerVolume === 0 ? 'volume-mute' : speakerVolume < 50 ? 'volume-low' : 'volume-high'}
              size={16}
              color={textSub}
            />
            <View
              style={styles.volumeTrackTouch}
              onLayout={(e) => {
                volumeTrackWidth.current = e.nativeEvent.layout.width;
              }}
              {...volumeResponder.panHandlers}
            >
              <View style={[styles.volumeTrack, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                <View style={[styles.volumeFill, { width: `${speakerVolume}%` }]} />
              </View>
              <View style={[styles.volumeThumb, { left: `${speakerVolume}%` }]} />
            </View>
            <LocalizedText style={[styles.volumeValueText, { color: textTitle }]}>{speakerVolume}%</LocalizedText>
          </View>

          <View style={styles.speakerBottomRow}>
            <View style={styles.speakerStatusPill}>
              <View style={styles.greenLiveDot} />
              <LocalizedText style={styles.speakerStatusText}>{`Hub #01 Online (Âm lượng ${speakerVolume}%)`}</LocalizedText>
            </View>
            <TouchableOpacity
              style={[styles.testVoiceBtn, isPlayingTestVoice && { opacity: 0.6 }]}
              onPress={handleTestVoiceSpeaker}
              activeOpacity={0.8}
              disabled={isPlayingTestVoice}
            >
              <Ionicons name={isPlayingTestVoice ? 'radio' : 'play'} size={14} color="#FFF" />
              <LocalizedText style={styles.testVoiceBtnText}>
                {isPlayingTestVoice ? 'Đang phát...' : 'Thử giọng nói'}
              </LocalizedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danh mục cữ thuốc hôm nay */}
        <View style={[styles.sectionCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionIconBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
                <Ionicons name="medical" size={20} color="#2563EB" />
              </View>
              <LocalizedText style={[styles.sectionTitle, { color: textTitle }]}>Danh mục cữ thuốc hôm nay</LocalizedText>
            </View>
            <TouchableOpacity onPress={() => {
              if (!canManageRecords) {
                LocalizedAlert.alert(
                  'Không có quyền thao tác',
                  'Tài khoản Thành viên chưa được cấp quyền "Quản lý Lịch thuốc & Bệnh án".'
                );
                return;
              }
              setAddMedModalVisible(true);
            }}>
              <LocalizedText style={[styles.addMedLink, !canManageRecords && { color: textSub }]}>
                {canManageRecords ? '+ Thêm cữ' : '🔒 Chỉ xem'}
              </LocalizedText>
            </TouchableOpacity>
          </View>

          {/* Tab chọn buổi */}
          <View style={styles.sessionTabRow}>
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'MORNING', label: `Sáng (${morningDone}/${morningCount})` },
              { key: 'NOON', label: `Trưa (${noonDone}/${noonCount})` },
              { key: 'EVENING', label: `Tối (${eveningDone}/${eveningCount})` },
            ].map((tab) => {
              const active = selectedFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.sessionTabBtn, active && styles.sessionTabBtnActive, isDarkMode && !active && { backgroundColor: '#0F172A' }]}
                  onPress={() => setSelectedFilter(tab.key as any)}
                >
                  <LocalizedText style={[styles.sessionTabText, active && styles.sessionTabTextActive, isDarkMode && !active && { color: '#94A3B8' }]}>
                    {tab.label}
                  </LocalizedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Danh sách cữ thuốc */}
          <View style={styles.medListContainer}>
            {filteredMeds.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="medical-outline" size={36} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                <LocalizedText style={[styles.emptyBoxTitle, { color: textTitle }]}>Chưa có lịch uống thuốc</LocalizedText>
                <LocalizedText style={[styles.emptyBoxSub, { color: textSub }]}>
                  Bấm "+ Thêm cữ" ở góc trên để tạo lịch nhắc nhở uống thuốc cho người cao tuổi.
                </LocalizedText>
              </View>
            ) : (
              filteredMeds.map((med) => (
                <View
                  key={med.id}
                  style={[
                    styles.medItemRow,
                    {
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      borderColor: med.taken ? '#10B981' : borderCol,
                    },
                  ]}
                >
                  <View style={styles.medTimeBadge}>
                    <Ionicons name="time-outline" size={12} color="#0EA5E9" />
                    <LocalizedText style={styles.medTimeText}>{med.time}</LocalizedText>
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <LocalizedText
                      style={[
                        styles.medItemName,
                        { color: textTitle },
                        med.taken && styles.medItemNameDone,
                      ]}
                    >
                      {med.name}
                    </LocalizedText>
                    <LocalizedText style={styles.medItemDose}>{med.dose}</LocalizedText>
                    <LocalizedText style={[styles.medItemPurpose, { color: textSub }]}>Mục đích: {med.purpose}</LocalizedText>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.medCheckBtn, med.taken ? styles.medCheckBtnDone : styles.medCheckBtnPending]}
                      onPress={() => toggleMedicationTaken(med.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={med.taken ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={med.taken ? '#10B981' : '#94A3B8'} />
                      <LocalizedText style={[styles.medCheckBtnText, { color: med.taken ? '#10B981' : '#64748B' }]}>
                        {med.taken ? 'Đã uống' : 'Chưa'}
                      </LocalizedText>
                    </TouchableOpacity>
                    {canManageRecords && !String(med.id).startsWith('rx-med-') && (
                      <TouchableOpacity
                        onPress={() => handleDeleteMedication(med)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Bổ sung nước định kỳ */}
        <View style={[styles.sectionCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.sectionIconBox, { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' }]}>
                <Ionicons name="water-outline" size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.sectionTitle, { color: textTitle }]}>Bổ sung nước định kỳ</LocalizedText>
                <LocalizedText style={[styles.sectionSubtitle, { color: textSub }]}>Khuyến nghị: 1.5 - 2L nước mỗi ngày</LocalizedText>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (!canManageRecords) {
                  LocalizedAlert.alert('Không có quyền thao tác', 'Tài khoản Thành viên chưa được cấp quyền quản lý lịch.');
                  return;
                }
                setAddHydrationVisible(true);
              }}
              activeOpacity={0.75}
            >
              <LocalizedText style={styles.addMedLink}>+ Thêm mốc</LocalizedText>
            </TouchableOpacity>
          </View>

          {hydrationList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="water-outline" size={36} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <LocalizedText style={[styles.emptyBoxTitle, { color: textTitle }]}>Chưa có mốc nhắc nhở uống nước</LocalizedText>
              <LocalizedText style={[styles.emptyBoxSub, { color: textSub }]}>
                Hệ thống sẽ đồng bộ lịch uống nước theo khuyến nghị y tế của bác sĩ điều trị.
              </LocalizedText>
            </View>
          ) : (
            <View style={styles.hydrationGrid}>
              {hydrationList.map((h, idx) => (
                <TouchableOpacity
                  key={h.id || idx}
                  style={[styles.hydrationCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: h.done ? '#0284C7' : borderCol }]}
                  onPress={() => toggleHydrationDone(h.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.hydrationCardTop}>
                    <LocalizedText style={styles.hydrationTimeText}>{h.time}</LocalizedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name={h.done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={h.done ? '#0284C7' : '#94A3B8'} />
                      {canManageRecords && h.id && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleDeleteHydrationSlot(h.id);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="close-circle-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <LocalizedText style={[styles.hydrationAmountText, { color: textTitle }]}>{h.amount}</LocalizedText>
                  <LocalizedText style={[styles.hydrationNoteText, { color: textSub }]} numberOfLines={2}>
                    {h.note}
                  </LocalizedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Kê Đơn Thuốc Điều Trị Mới (Hỗ trợ nhiều loại thuốc cùng lúc) */}
      <Modal transparent visible={isAddMedModalVisible} animationType="fade" onRequestClose={() => setAddMedModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddMedModalVisible(false)}>
          <Pressable style={[styles.modalCardLarge, { backgroundColor: bgCard, borderColor: borderCol }]} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconBox}>
                <Ionicons name="medical" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <LocalizedText style={[styles.modalTitleLarge, { color: textTitle }]}>Thêm lịch uống thuốc</LocalizedText>
                <LocalizedText style={[styles.modalSubtitleLarge, { color: textSub }]}>
                  {`Thiết lập lịch nhắc nhở uống thuốc cho: ${patientDisplayName}${currentPatient?.age ? ` (${currentPatient.age} tuổi)` : ''}`}
                </LocalizedText>
              </View>
              <TouchableOpacity onPress={() => setAddMedModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540, marginTop: 10 }} contentContainerStyle={{ paddingBottom: 10 }}>
              {/* PHẦN 1: THÔNG TIN BỆNH & THỜI GIAN ĐIỀU TRỊ */}
              <View style={[styles.prescriptionSectionBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol }]}>
                <LocalizedText style={[styles.inputLabel, { color: textTitle }]}>Tên bệnh / Nhóm thuốc *</LocalizedText>
                <LocalizedTextInput
                  style={[styles.textInput, { backgroundColor: bgCard, color: textTitle, borderColor: borderCol }]}
                  placeholder="VD: Tăng huyết áp, Tiểu đường..."
                  placeholderTextColor="#94A3B8"
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {['Tăng huyết áp', 'Tiểu đường', 'Tim mạch', 'Mỡ máu', 'Xương khớp', 'Bổ sung Vitamin'].map((group) => {
                    const active = diagnosis.trim() === group;
                    return (
                      <TouchableOpacity
                        key={group}
                        activeOpacity={0.75}
                        onPress={() => setDiagnosis(group)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: active ? '#F97316' : borderCol,
                          backgroundColor: active ? (isDarkMode ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED') : bgCard,
                        }}
                      >
                        <LocalizedText style={{ fontSize: 11.5, fontWeight: active ? '700' : '500', color: active ? '#EA580C' : textTitle }}>
                          {group}
                        </LocalizedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Ngày bắt đầu:</LocalizedText>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => openPrescriptionDatePicker('START')}
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: bgCard,
                          borderColor: borderCol,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        },
                      ]}
                    >
                      <LocalizedText style={{ fontSize: 13.5, fontWeight: '600', color: textTitle }}>
                        {formatDisplayDateVN(startDate)}
                      </LocalizedText>
                      <Ionicons name="calendar-outline" size={17} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Ngày kết thúc:</LocalizedText>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => openPrescriptionDatePicker('END')}
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: bgCard,
                          borderColor: borderCol,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        },
                      ]}
                    >
                      <LocalizedText style={{ fontSize: 13.5, fontWeight: '600', color: textTitle }}>
                        {formatDisplayDateVN(endDate)}
                      </LocalizedText>
                      <Ionicons name="calendar-outline" size={17} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Modal Calendar Date Picker cho Ngày bắt đầu / Ngày kết thúc */}
                <Modal visible={Boolean(datePickerTarget)} transparent animationType="fade" onRequestClose={() => setDatePickerTarget(null)}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                    activeOpacity={1}
                    onPress={() => setDatePickerTarget(null)}
                  >
                    <View
                      style={{ width: '100%', maxWidth: 350, borderRadius: 16, padding: 16, backgroundColor: bgCard }}
                      onStartShouldSetResponder={() => true}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <LocalizedText style={{ fontSize: 14, fontWeight: '800', color: textTitle }}>
                          {datePickerTarget === 'START' ? 'Chọn Ngày bắt đầu' : 'Chọn Ngày kết thúc'}
                        </LocalizedText>
                        <TouchableOpacity onPress={() => setDatePickerTarget(null)} hitSlop={8}>
                          <Ionicons name="close" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1, 1))}
                          style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name="chevron-back" size={16} color="#2563EB" />
                        </TouchableOpacity>
                        <LocalizedText style={{ fontSize: 13.5, fontWeight: '700', color: textTitle }}>
                          Tháng {datePickerMonth.getMonth() + 1}/{datePickerMonth.getFullYear()}
                        </LocalizedText>
                        <TouchableOpacity
                          onPress={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1, 1))}
                          style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name="chevron-forward" size={16} color="#2563EB" />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 }}>
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                          <LocalizedText key={d} style={{ width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#64748B' }}>{d}</LocalizedText>
                        ))}
                      </View>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {(() => {
                          const y = datePickerMonth.getFullYear();
                          const m = datePickerMonth.getMonth();
                          const firstRaw = new Date(y, m, 1).getDay();
                          const firstDay = firstRaw === 0 ? 6 : firstRaw - 1;
                          const totalDays = new Date(y, m + 1, 0).getDate();
                          const activeStr = datePickerTarget === 'START' ? startDate : endDate;
                          return Array.from({ length: firstDay + totalDays }, (_, idx) => {
                            const isCurrent = idx >= firstDay;
                            const dayNum = idx - firstDay + 1;
                            const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                            const isSelected = isCurrent && iso === activeStr;
                            return (
                              <TouchableOpacity
                                key={idx}
                                disabled={!isCurrent}
                                onPress={() => {
                                  if (datePickerTarget === 'START') {
                                    setStartDate(iso);
                                    if (endDate && iso > endDate) {
                                      setEndDate(iso);
                                    }
                                  } else {
                                    setEndDate(iso);
                                  }
                                  setDatePickerTarget(null);
                                }}
                                style={{
                                  width: '14.28%',
                                  height: 36,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  borderRadius: 8,
                                  backgroundColor: isSelected ? '#2563EB' : 'transparent',
                                }}
                              >
                                <LocalizedText style={{ fontSize: 12.5, fontWeight: isSelected ? '800' : '600', color: !isCurrent ? 'transparent' : isSelected ? '#FFFFFF' : textTitle }}>
                                  {isCurrent ? dayNum : ''}
                                </LocalizedText>
                              </TouchableOpacity>
                            );
                          });
                        })()}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Modal>

                {/* Helper chips cho thời gian đợt thuốc */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {[
                    { label: '+7 ngày', days: 7 },
                    { label: '+14 ngày', days: 14 },
                    { label: '+30 ngày', days: 30 },
                  ].map((chip) => (
                    <TouchableOpacity
                      key={chip.label}
                      style={[styles.presetDayChip, { borderColor: borderCol }]}
                      onPress={() => handleSetDurationDays(chip.days)}
                    >
                      <LocalizedText style={styles.presetDayChipText}>{chip.label}</LocalizedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* PHẦN 2: DANH SÁCH THUỐC TRONG ĐƠN */}
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <LocalizedText style={[styles.inputLabel, { color: textTitle, marginBottom: 0 }]}>
                    2. Danh sách thuốc trong đơn ({medList.length} loại):
                  </LocalizedText>
                  <TouchableOpacity style={styles.addMedRowBtn} onPress={handleAddMedItem} activeOpacity={0.7}>
                    <Ionicons name="add-circle" size={16} color={Colors.primary} />
                    <LocalizedText style={styles.addMedRowBtnText}>Thêm thuốc</LocalizedText>
                  </TouchableOpacity>
                </View>

                {medList.map((med, index) => (
                  <View
                    key={med.id}
                    style={[styles.medCardBox, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', borderColor: borderCol }]}
                  >
                    <View style={styles.medCardTopRow}>
                      <View style={styles.medCardBadge}>
                        <LocalizedText style={styles.medCardBadgeText}>Thuốc #{index + 1}</LocalizedText>
                      </View>
                      {medList.length > 1 && (
                        <TouchableOpacity onPress={() => handleRemoveMedItem(med.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <LocalizedText style={[styles.inputLabelSmall, { color: textSub }]}>Tên thuốc & hàm lượng *</LocalizedText>
                    <LocalizedTextInput
                      style={[styles.textInputSmall, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
                      placeholder="VD: Amlodipine 5mg, Glucophage 500mg..."
                      placeholderTextColor="#94A3B8"
                      value={med.name}
                      onChangeText={(val) => handleUpdateMedItem(med.id, 'name', val)}
                    />

                    <View style={{ marginTop: 8 }}>
                      <LocalizedText style={[styles.inputLabelSmall, { color: textSub }]}>Liều lượng:</LocalizedText>
                      <LocalizedTextInput
                        style={[styles.textInputSmall, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
                        placeholder="VD: 1 viên"
                        placeholderTextColor="#94A3B8"
                        value={med.dose}
                        onChangeText={(val) => handleUpdateMedItem(med.id, 'dose', val)}
                      />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {['1/2 viên', '1 viên', '2 viên', '1 gói', '10 ml'].map((dosePreset) => {
                          const active = med.dose.trim() === dosePreset;
                          return (
                            <TouchableOpacity
                              key={dosePreset}
                              activeOpacity={0.75}
                              onPress={() => handleUpdateMedItem(med.id, 'dose', dosePreset)}
                              style={{
                                paddingHorizontal: 9,
                                paddingVertical: 4,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: active ? '#F97316' : borderCol,
                                backgroundColor: active ? (isDarkMode ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED') : (isDarkMode ? '#1E293B' : '#F8FAFC'),
                              }}
                            >
                              <LocalizedText style={{ fontSize: 11, fontWeight: active ? '700' : '500', color: active ? '#EA580C' : textSub }}>
                                {dosePreset}
                              </LocalizedText>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Cữ uống trong ngày (gộp giờ uống trực tiếp) */}
                    <LocalizedText style={[styles.inputLabelSmall, { color: textSub, marginTop: 10 }]}>
                      Cữ uống (chạm giờ để đổi nhanh):
                    </LocalizedText>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {([
                        { key: 'MORNING' as const, label: 'Sáng', defaultTime: '08:00' },
                        { key: 'NOON' as const, label: 'Trưa', defaultTime: '12:00' },
                        { key: 'EVENING' as const, label: 'Tối', defaultTime: '20:00' },
                      ]).map((s) => {
                        const isChosen = med.sessions.includes(s.key);
                        const slotTime = med.sessionTimes?.[s.key] || s.defaultTime;
                        return (
                          <View
                            key={s.key}
                            style={[
                              styles.sessionMultiChip,
                              { flexDirection: 'column', paddingVertical: 6, paddingHorizontal: 4, gap: 4 },
                              isChosen && styles.sessionMultiChipActive,
                            ]}
                          >
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                              onPress={() => handleToggleMedSession(med.id, s.key)}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={isChosen ? 'checkbox' : 'square-outline'}
                                size={14}
                                color={isChosen ? '#FFF' : textSub}
                                style={{ marginRight: 4 }}
                              />
                              <LocalizedText style={[styles.sessionMultiChipText, isChosen && styles.sessionMultiChipTextActive]}>
                                {s.label}
                              </LocalizedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                              disabled={!isChosen}
                              onPress={() => setTimePickerTarget({ medId: med.id, session: s.key })}
                              activeOpacity={0.75}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3,
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: 8,
                                backgroundColor: isChosen ? 'rgba(255,255,255,0.22)' : 'rgba(148,163,184,0.18)',
                              }}
                            >
                              <LocalizedText style={{ fontSize: 10.5, fontWeight: '700', color: isChosen ? '#FFFFFF' : textSub }}>
                                {slotTime}
                              </LocalizedText>
                              {isChosen && <Ionicons name="chevron-down" size={10} color="#FFFFFF" />}
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>

                    {/* Hướng dẫn uống */}
                    <LocalizedText style={[styles.inputLabelSmall, { color: textSub, marginTop: 8 }]}>Ghi chú / Hướng dẫn uống:</LocalizedText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                      {['Sau khi ăn no', 'Trước khi ăn 30p', 'Khi cần thiết'].map((inst) => {
                        const isSel = med.instructions === inst;
                        return (
                          <TouchableOpacity
                            key={inst}
                            style={[styles.instChip, isSel && styles.instChipActive]}
                            onPress={() => handleUpdateMedItem(med.id, 'instructions', inst)}
                          >
                            <LocalizedText style={[styles.instChipText, isSel && styles.instChipTextActive]}>{inst}</LocalizedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <LocalizedTextInput
                      style={[styles.textInputSmall, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: textTitle, borderColor: borderCol, marginTop: 4 }]}
                      placeholder="Hoặc nhập hướng dẫn chi tiết khác..."
                      placeholderTextColor="#94A3B8"
                      value={med.instructions}
                      onChangeText={(val) => handleUpdateMedItem(med.id, 'instructions', val)}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]}
                onPress={() => setAddMedModalVisible(false)}
                disabled={isSavingPrescription}
              >
                <LocalizedText style={[styles.modalCancelText, { color: textSub }]}>Hủy</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingPrescription && { opacity: 0.7 }]}
                onPress={handleSavePrescription}
                disabled={isSavingPrescription}
              >
                {isSavingPrescription ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <LocalizedText style={styles.modalSaveText}>Lưu đơn thuốc</LocalizedText>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Thêm mốc uống nước */}
      <Modal transparent visible={isAddHydrationVisible} animationType="fade" onRequestClose={() => setAddHydrationVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddHydrationVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]} onPress={() => {}}>
            <LocalizedText style={[styles.modalTitleLarge, { color: textTitle, marginBottom: 12 }]}>
              Thêm mốc nhắc uống nước
            </LocalizedText>

            <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Khung giờ nhắc qua loa:</LocalizedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {['08:00', '10:30', '14:30', '16:30', '20:00'].map((slot) => {
                const active = hydrationDraft.time === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    activeOpacity={0.75}
                    onPress={() => setHydrationDraft((p) => ({ ...p, time: slot }))}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? '#0284C7' : borderCol,
                      backgroundColor: active ? '#E0F2FE' : (isDarkMode ? '#0F172A' : '#F8FAFC'),
                    }}
                  >
                    <LocalizedText style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? '#0284C7' : textTitle }}>
                      {slot}
                    </LocalizedText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <LocalizedTextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol, marginBottom: 10 }]}
              placeholder="Hoặc nhập giờ (VD: 09:15)"
              placeholderTextColor="#94A3B8"
              value={hydrationDraft.time}
              onChangeText={(time) => setHydrationDraft((p) => ({ ...p, time }))}
            />

            <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Lượng nước:</LocalizedText>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {['150ml', '200ml', '250ml', '300ml'].map((amt) => {
                const active = hydrationDraft.amount === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    activeOpacity={0.75}
                    onPress={() => setHydrationDraft((p) => ({ ...p, amount: amt }))}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 10,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: active ? '#0284C7' : borderCol,
                      backgroundColor: active ? '#E0F2FE' : (isDarkMode ? '#0F172A' : '#F8FAFC'),
                    }}
                  >
                    <LocalizedText style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? '#0284C7' : textTitle }}>
                      {amt}
                    </LocalizedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Ghi chú lời nhắc:</LocalizedText>
            <LocalizedTextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
              placeholder="VD: Uống 1 ly nước ấm"
              placeholderTextColor="#94A3B8"
              value={hydrationDraft.note}
              onChangeText={(note) => setHydrationDraft((p) => ({ ...p, note }))}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]}
                onPress={() => setAddHydrationVisible(false)}
              >
                <LocalizedText style={[styles.modalCancelText, { color: textSub }]}>Hủy</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddHydrationSlot}>
                <LocalizedText style={styles.modalSaveText}>Thêm mốc</LocalizedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Modal chọn giờ nhanh cho từng cữ uống */}
      <Modal transparent visible={Boolean(timePickerTarget)} animationType="fade" onRequestClose={() => setTimePickerTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTimePickerTarget(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol, maxWidth: 320 }]} onPress={() => {}}>
            <LocalizedText style={[styles.modalTitleLarge, { color: textTitle, marginBottom: 10 }]}>
              {timePickerTarget?.session === 'MORNING'
                ? 'Chọn giờ uống Buổi sáng'
                : timePickerTarget?.session === 'NOON'
                ? 'Chọn giờ uống Buổi trưa'
                : 'Chọn giờ uống Buổi tối'}
            </LocalizedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(timePickerTarget?.session === 'MORNING'
                ? ['06:30', '07:00', '07:30', '08:00', '08:30', '09:00']
                : timePickerTarget?.session === 'NOON'
                ? ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30']
                : ['18:30', '19:00', '19:30', '20:00', '20:30', '21:00']
              ).map((slot) => (
                <TouchableOpacity
                  key={slot}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (!timePickerTarget) return;
                    setMedList((prev) =>
                      prev.map((m) =>
                        m.id === timePickerTarget.medId
                          ? {
                              ...m,
                              time: slot,
                              sessionTimes: { ...(m.sessionTimes || {}), [timePickerTarget.session]: slot },
                            }
                          : m
                      )
                    );
                    setTimePickerTarget(null);
                  }}
                  style={{
                    width: '30.5%',
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                    backgroundColor: isDarkMode ? '#0F172A' : '#FFF7ED',
                  }}
                >
                  <LocalizedText style={{ fontSize: 13, fontWeight: '700', color: '#EA580C' }}>{slot}</LocalizedText>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitleCol: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  addHeaderBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },

  speakerCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
  speakerTopRow: { flexDirection: 'row', alignItems: 'center' },
  speakerIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  speakerTitle: { fontSize: 14, fontWeight: '700' },
  speakerSubtitle: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  speakerDivider: { height: 1, marginVertical: 10 },
  speakerVolumeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  volumeTrackTouch: { flex: 1, height: 28, justifyContent: 'center' },
  volumeTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  volumeFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  volumeThumb: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, marginLeft: -8, borderWidth: 2, borderColor: '#FFF' },
  volumeValueText: { width: 38, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  speakerBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speakerStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10B981' },
  speakerStatusText: { fontSize: 11, color: '#10B981', fontWeight: '600' },
  testVoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  testVoiceBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  sectionCard: { borderRadius: 18, padding: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionSubtitle: { fontSize: 11, marginTop: 2 },
  addMedLink: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  sessionTabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sessionTabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  sessionTabBtnActive: { backgroundColor: Colors.primary },
  sessionTabText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  sessionTabTextActive: { color: '#FFF' },

  medListContainer: { gap: 10 },
  medItemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  medTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  medTimeText: { fontSize: 11, fontWeight: '700', color: '#0284C7' },
  medItemName: { fontSize: 14, fontWeight: '700' },
  medItemNameDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  medItemDose: { fontSize: 12, color: '#0284C7', marginTop: 2, fontWeight: '600' },
  medItemPurpose: { fontSize: 11, marginTop: 2 },
  medCheckBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  medCheckBtnPending: { backgroundColor: '#F1F5F9' },
  medCheckBtnDone: { backgroundColor: '#DCFCE7' },
  medCheckBtnText: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  emptyBoxTitle: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  emptyBoxSub: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 17 },

  hydrationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hydrationCard: { width: '48.5%', padding: 10, borderRadius: 10, borderWidth: 1 },
  hydrationCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hydrationTimeText: { fontSize: 11, fontWeight: '700', color: '#0284C7' },
  hydrationAmountText: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  hydrationNoteText: { fontSize: 11, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, padding: 20, borderWidth: 1 },
  modalCardLarge: { width: '100%', maxWidth: 480, borderRadius: 20, padding: 18, borderWidth: 1 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  modalHeaderIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(14,165,233,0.12)', alignItems: 'center', justifyContent: 'center' },
  modalTitleLarge: { fontSize: 16, fontWeight: '800' },
  modalSubtitleLarge: { fontSize: 11, marginTop: 1 },
  prescriptionSectionBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 6 },
  presetDayChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#E2E8F033' },
  presetDayChipText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  addMedRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(14,165,233,0.12)' },
  addMedRowBtnText: { fontSize: 11.5, fontWeight: '700', color: Colors.primary },
  medCardBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  medCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  medCardBadge: { backgroundColor: 'rgba(14,165,233,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  medCardBadgeText: { fontSize: 10.5, fontWeight: '700', color: Colors.primary },
  inputLabelSmall: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  textInputSmall: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  sessionMultiChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 6, backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: '#CBD5E1' },
  sessionMultiChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sessionMultiChipText: { fontSize: 10.5, fontWeight: '700', color: '#475569' },
  sessionMultiChipTextActive: { color: '#FFF' },
  instChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  instChipActive: { backgroundColor: '#FFF7ED', borderColor: '#F97316' },
  instChipText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  instChipTextActive: { color: '#EA580C', fontWeight: '700' },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  sessionPickBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E2E8F0', alignItems: 'center' },
  sessionPickBtnActive: { backgroundColor: Colors.primary },
  sessionPickText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  sessionPickTextActive: { color: '#FFF' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '600' },
  modalSaveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 12,
  },
  lockBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
  },
  lockBannerDesc: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },

  patientChipsRow: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  patientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  patientChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  patientChipInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  patientChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  patientChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  patientHeroCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  patientHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientHeroName: {
    fontSize: 16,
    fontWeight: '800',
  },
  patientHeroMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  patientProgressWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  patientProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  patientProgressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  patientProgressPercent: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  doctorRxCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  doctorRxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  doctorRxName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  doctorRxMeta: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 4,
  },
  doctorRxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  doctorRxBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  doctorRxInstructions: {
    fontSize: 12,
    marginBottom: 6,
  },
  doctorRxTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doctorRxTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doctorRxTimeText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
  modalPatientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalPatientBannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalPatientBannerSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
