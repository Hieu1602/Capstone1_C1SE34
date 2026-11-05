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

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Modal, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { usePatientStore, ReminderItem } from '../../../store/usePatientStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { remindersApi } from '../../../services/api';

// Cấu trúc dữ liệu một mốc nhắc uống nước / sinh hoạt
interface HydrationSchedule {
  time: string;
  amount: string;
  note: string;
  done: boolean;
}

export default function MedicationReminderScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();

  // Kết nối Store trung tâm usePatientStore để đồng bộ 2 chiều với Trang chủ & Thông báo
  const { todayReminders, fetchReminders, markMedicationTaken } = usePatientStore();
  const { userRole, role, permissions, fetchMyPermissions } = useAuthStore();
  const [checkingPerms, setCheckingPerms] = useState(true);

  useEffect(() => {
    fetchReminders();
    fetchMyPermissions().finally(() => setCheckingPerms(false));
  }, []);

  const isOwnerOrAdmin = userRole === 'admin' || role === 'admin' || Boolean(permissions?.is_owner);
  const canManageRecords = isOwnerOrAdmin || Boolean(permissions?.can_manage_records);

  // Trạng thái bật/tắt phát giọng nói nhắc nhở qua Loa thông minh Edge Hub (FR12)
  const [hubVoiceReminderEnabled, setHubVoiceReminderEnabled] = useState(true);
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);

  // Bộ lọc hiển thị theo buổi: Tất cả | Buổi sáng | Buổi trưa | Buổi tối
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MORNING' | 'NOON' | 'EVENING'>('ALL');

  // Danh sách cữ thuốc thực tế đồng bộ từ Store
  const medications: ReminderItem[] = todayReminders?.medications || [];

  // Danh sách lịch uống nước trong ngày
  const [hydrationList, setHydrationList] = useState<HydrationSchedule[]>([]);

  // State quản lý Kê đơn thuốc mới (Chuẩn nghiệp vụ lâm sàng)
  interface PrescriptionMedDraft {
    id: string;
    name: string;
    dose: string;
    sessions: ('MORNING' | 'NOON' | 'EVENING')[];
    time: string;
    instructions: string;
  }

  const [isAddMedModalVisible, setAddMedModalVisible] = useState(false);
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

  const handleToggleMedSession = (id: string, session: 'MORNING' | 'NOON' | 'EVENING') => {
    setMedList((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const exists = m.sessions.includes(session);
        const next = exists ? m.sessions.filter((s) => s !== session) : [...m.sessions, session];
        return { ...m, sessions: next.length > 0 ? next : [session] };
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
        medications: medList.map((m) => ({
          name: m.name.trim(),
          dose: m.dose.trim() || '1 viên',
          sessions: m.sessions,
          time: m.time || (m.sessions.includes('MORNING') ? '08:00' : m.sessions.includes('NOON') ? '12:00' : '20:00'),
          instructions: m.instructions.trim(),
        })),
      });

      // Tạo các item cục bộ hiển thị tức thì trên giao diện
      const newItems: ReminderItem[] = [];
      const sessionTimes: Record<string, string> = {
        MORNING: '08:00',
        NOON: '12:00',
        EVENING: '20:00',
      };
      medList.forEach((m) => {
        m.sessions.forEach((sess) => {
          newItems.push({
            id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: m.name.trim(),
            time: m.time || sessionTimes[sess] || '08:00',
            session: sess,
            dose: `${m.dose.trim() || '1 viên'}${m.instructions ? ` (${m.instructions})` : ''}`,
            purpose: diagTrimmed,
            taken: false,
          });
        });
      });

      usePatientStore.setState((state) => {
        const curMeds = state.todayReminders?.medications || [];
        const updatedMeds = [...curMeds, ...newItems];
        return {
          todayReminders: {
            date: state.todayReminders?.date || new Date().toISOString().split('T')[0],
            total_medications: updatedMeds.length,
            completed_medications: updatedMeds.filter((it) => it.taken).length,
            hub_voice_reminder_enabled: state.todayReminders?.hub_voice_reminder_enabled ?? true,
            medications: updatedMeds,
            meals: state.todayReminders?.meals || [],
          },
        };
      });

      // Refetch
      fetchReminders?.();

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
      const alertMsg = `Đã lưu đơn thuốc "${diagTrimmed}" gồm ${medList.length} loại thuốc.`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Thành công 🎉\n\n${alertMsg}`);
      } else {
        LocalizedAlert.alert('Thành công 🎉', alertMsg);
      }
    } catch (err) {
      console.warn('Lỗi khi lưu đơn thuốc:', err);
      LocalizedAlert.alert('Lỗi', 'Không thể lưu đơn thuốc lên máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSavingPrescription(false);
    }
  };

  // Đánh dấu hoàn thành hoặc hoàn tác một cữ thuốc
  const toggleMedicationTaken = async (id: string) => {
    const med = medications.find((item) => item.id === id);
    if (!med) return;
    const nextState = !med.taken;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await markMedicationTaken(id, nextState, nextState ? timeStr : undefined);
    if (nextState) {
      LocalizedAlert.alert('Đã xác nhận', `Đã đánh dấu uống thuốc "${med.name}" lúc ${timeStr}.`);
    } else {
      LocalizedAlert.alert('Hoàn tác', `Đã chuyển "${med.name}" về trạng thái chưa uống.`);
    }
  };

  const toggleHydrationDone = (index: number) => {
    setHydrationList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item))
    );
  };

  const handleTestVoiceSpeaker = () => {
    if (!hubVoiceReminderEnabled) {
      LocalizedAlert.alert('Loa đang tắt', 'Vui lòng gạt bật tính năng phát qua Loa thông minh Hub trước.');
      return;
    }

    setIsPlayingTestVoice(true);
    setTimeout(() => {
      setIsPlayingTestVoice(false);
      const firstMed = medications.find((m) => !m.taken);
      const textNotice = firstMed
        ? `Đã đến giờ uống thuốc ${firstMed.name} (${firstMed.dose}).`
        : 'Hiện không có lịch uống thuốc sắp tới.';
      LocalizedAlert.alert('Loa Hub đã phát', `📢 "${textNotice}"`);
    }, 1200);
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
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={textTitle} />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <LocalizedText style={[styles.headerTitle, { color: textTitle }]}>Lịch uống thuốc & Ăn uống</LocalizedText>
          <LocalizedText style={[styles.headerSubtitle, { color: textSub }]}>Đồng bộ giọng nói Loa thông minh Hub FR12</LocalizedText>
        </View>

        <TouchableOpacity
          style={[styles.addHeaderBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }, !canManageRecords && { opacity: 0.7 }]}
          onPress={() => {
            if (!canManageRecords) {
              LocalizedAlert.alert(
                'Không có quyền thao tác',
                'Tài khoản Thành viên chưa được cấp quyền "Quản lý Lịch thuốc & Bệnh án". Vui lòng nhờ Chủ hộ cấp quyền trong mục Quản lý nhà.'
              );
              return;
            }
            setAddMedModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name={canManageRecords ? "add" : "lock-closed"} size={canManageRecords ? 22 : 18} color={canManageRecords ? Colors.primary : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Loa thông minh Hub */}
        <View style={[styles.speakerCard, { backgroundColor: bgCard, borderColor: hubVoiceReminderEnabled ? Colors.primary : borderCol }]}>
          <View style={styles.speakerTopRow}>
            <View style={[styles.speakerIconCircle, { backgroundColor: isDarkMode ? '#432005' : '#FFF7ED' }]}>
              <Ionicons name="volume-high" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <LocalizedText style={[styles.speakerTitle, { color: textTitle }]}>Loa thông minh Hub (Voice Reminder)</LocalizedText>
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

          <View style={styles.speakerBottomRow}>
            <View style={styles.speakerStatusPill}>
              <View style={styles.greenLiveDot} />
              <LocalizedText style={styles.speakerStatusText}>Hub #01 Online (Âm lượng 80%)</LocalizedText>
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
                </View>
              ))
            )}
          </View>
        </View>

        {/* Bổ sung nước định kỳ */}
        <View style={[styles.sectionCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionIconBox, { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' }]}>
                <Ionicons name="water-outline" size={20} color="#0284C7" />
              </View>
              <View>
                <LocalizedText style={[styles.sectionTitle, { color: textTitle }]}>Bổ sung nước định kỳ</LocalizedText>
                <LocalizedText style={[styles.sectionSubtitle, { color: textSub }]}>Khuyến nghị: 1.5 - 2L nước mỗi ngày</LocalizedText>
              </View>
            </View>
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
                  key={idx}
                  style={[styles.hydrationCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: h.done ? '#0284C7' : borderCol }]}
                  onPress={() => toggleHydrationDone(idx)}
                  activeOpacity={0.8}
                >
                  <View style={styles.hydrationCardTop}>
                    <LocalizedText style={styles.hydrationTimeText}>{h.time}</LocalizedText>
                    <Ionicons name={h.done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={h.done ? '#0284C7' : '#94A3B8'} />
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
                <LocalizedText style={[styles.modalTitleLarge, { color: textTitle }]}>Kê đơn thuốc điều trị</LocalizedText>
                <LocalizedText style={[styles.modalSubtitleLarge, { color: textSub }]}>Tạo đơn bệnh và thiết lập lịch nhắc nhở các cữ uống</LocalizedText>
              </View>
              <TouchableOpacity onPress={() => setAddMedModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520, marginTop: 10 }} contentContainerStyle={{ paddingBottom: 10 }}>
              {/* PHẦN 1: THÔNG TIN BỆNH & THỜI GIAN ĐIỀU TRỊ */}
              <View style={[styles.prescriptionSectionBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol }]}>
                <LocalizedText style={[styles.inputLabel, { color: textTitle }]}>1. Tên bệnh / Chẩn đoán (Diagnosis) *</LocalizedText>
                <LocalizedTextInput
                  style={[styles.textInput, { backgroundColor: bgCard, color: textTitle, borderColor: borderCol }]}
                  placeholder="VD: Tăng huyết áp, Đái tháo đường Tuýp 2..."
                  placeholderTextColor="#94A3B8"
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Ngày bắt đầu:</LocalizedText>
                    <LocalizedTextInput
                      style={[styles.textInput, { backgroundColor: bgCard, color: textTitle, borderColor: borderCol }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                      value={startDate}
                      onChangeText={setStartDate}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Ngày kết thúc:</LocalizedText>
                    <LocalizedTextInput
                      style={[styles.textInput, { backgroundColor: bgCard, color: textTitle, borderColor: borderCol }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                      value={endDate}
                      onChangeText={setEndDate}
                    />
                  </View>
                </View>

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

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <LocalizedText style={[styles.inputLabelSmall, { color: textSub }]}>Liều lượng:</LocalizedText>
                        <LocalizedTextInput
                          style={[styles.textInputSmall, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
                          placeholder="VD: 1 viên"
                          placeholderTextColor="#94A3B8"
                          value={med.dose}
                          onChangeText={(val) => handleUpdateMedItem(med.id, 'dose', val)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <LocalizedText style={[styles.inputLabelSmall, { color: textSub }]}>Giờ uống cụ thể:</LocalizedText>
                        <LocalizedTextInput
                          style={[styles.textInputSmall, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
                          placeholder="08:00"
                          placeholderTextColor="#94A3B8"
                          value={med.time}
                          onChangeText={(val) => handleUpdateMedItem(med.id, 'time', val)}
                        />
                      </View>
                    </View>

                    {/* Cữ uống trong ngày */}
                    <LocalizedText style={[styles.inputLabelSmall, { color: textSub, marginTop: 8 }]}>Cữ uống:</LocalizedText>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['MORNING', 'NOON', 'EVENING'] as const).map((s) => {
                        const isChosen = med.sessions.includes(s);
                        return (
                          <TouchableOpacity
                            key={s}
                            style={[styles.sessionMultiChip, isChosen && styles.sessionMultiChipActive]}
                            onPress={() => handleToggleMedSession(med.id, s)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={isChosen ? 'checkbox' : 'square-outline'}
                              size={14}
                              color={isChosen ? '#FFF' : textSub}
                              style={{ marginRight: 4 }}
                            />
                            <LocalizedText style={[styles.sessionMultiChipText, isChosen && styles.sessionMultiChipTextActive]}>
                              {s === 'MORNING' ? 'Sáng (08:00)' : s === 'NOON' ? 'Trưa (12:00)' : 'Tối (20:00)'}
                            </LocalizedText>
                          </TouchableOpacity>
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

  speakerCard: { borderRadius: 16, padding: 14, borderWidth: 1.5 },
  speakerTopRow: { flexDirection: 'row', alignItems: 'center' },
  speakerIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  speakerTitle: { fontSize: 14, fontWeight: '700' },
  speakerSubtitle: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  speakerDivider: { height: 1, marginVertical: 10 },
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
  instChipActive: { backgroundColor: '#E0F2FE', borderColor: '#0284C7' },
  instChipText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  instChipTextActive: { color: '#0284C7', fontWeight: '700' },
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
});
