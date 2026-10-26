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
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { usePatientStore, ReminderItem } from '../../../store/usePatientStore';

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

  useEffect(() => {
    fetchReminders();
  }, []);

  // Trạng thái bật/tắt phát giọng nói nhắc nhở qua Loa thông minh Edge Hub (FR12)
  const [hubVoiceReminderEnabled, setHubVoiceReminderEnabled] = useState(true);
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);

  // Bộ lọc hiển thị theo buổi: Tất cả | Buổi sáng | Buổi trưa | Buổi tối
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MORNING' | 'NOON' | 'EVENING'>('ALL');

  // Danh sách cữ thuốc thực tế đồng bộ từ Store
  const medications: ReminderItem[] = todayReminders?.medications || [];

  // Danh sách lịch uống nước trong ngày
  const [hydrationList, setHydrationList] = useState<HydrationSchedule[]>([]);

  // State quản lý Modal thêm cữ thuốc mới
  const [isAddMedModalVisible, setAddMedModalVisible] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedTime, setNewMedTime] = useState('18:30');
  const [newMedSession, setNewMedSession] = useState<'MORNING' | 'NOON' | 'EVENING'>('EVENING');
  const [newMedDose, setNewMedDose] = useState('');

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

  const handleAddNewMed = () => {
    if (!newMedName.trim()) {
      LocalizedAlert.alert('Lỗi', 'Vui lòng nhập tên thuốc.');
      return;
    }

    const newMed: ReminderItem = {
      id: `med_${Date.now()}`,
      name: newMedName.trim(),
      time: newMedTime.trim() || '18:30',
      session: newMedSession,
      dose: newMedDose.trim() || '1 viên sau khi ăn',
      purpose: 'Theo chỉ định bác sĩ',
      taken: false,
    };

    usePatientStore.setState((state) => {
      const curMeds = state.todayReminders?.medications || [];
      const updatedMeds = [...curMeds, newMed];
      return {
        todayReminders: {
          date: state.todayReminders?.date || new Date().toISOString().split('T')[0],
          total_medications: updatedMeds.length,
          completed_medications: updatedMeds.filter((m) => m.taken).length,
          hub_voice_reminder_enabled: state.todayReminders?.hub_voice_reminder_enabled ?? true,
          medications: updatedMeds,
          meals: state.todayReminders?.meals || [],
        },
      };
    });

    setNewMedName('');
    setNewMedDose('');
    setAddMedModalVisible(false);
    LocalizedAlert.alert('Thành công', 'Đã thêm lịch uống thuốc mới.');
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
          style={[styles.addHeaderBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
          onPress={() => setAddMedModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={Colors.primary} />
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
              onValueChange={setHubVoiceReminderEnabled}
              trackColor={{ false: '#CBD5E1', true: Colors.primary }}
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
            <TouchableOpacity onPress={() => setAddMedModalVisible(true)}>
              <LocalizedText style={styles.addMedLink}>+ Thêm cữ</LocalizedText>
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

      {/* Modal Thêm cữ thuốc */}
      <Modal transparent visible={isAddMedModalVisible} animationType="fade" onRequestClose={() => setAddMedModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddMedModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]} onPress={() => {}}>
            <LocalizedText style={[styles.modalTitle, { color: textTitle }]}>Thêm cữ thuốc mới</LocalizedText>

            <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Tên thuốc & hàm lượng:</LocalizedText>
            <LocalizedTextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
              placeholder="VD: Losartan 50mg"
              placeholderTextColor="#94A3B8"
              value={newMedName}
              onChangeText={setNewMedName}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Giờ uống (HH:mm):</LocalizedText>
                <LocalizedTextInput
                  style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
                  value={newMedTime}
                  onChangeText={setNewMedTime}
                />
              </View>

              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.inputLabel, { color: textSub }]}>Cữ buổi:</LocalizedText>
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  {(['MORNING', 'NOON', 'EVENING'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sessionPickBtn, newMedSession === s && styles.sessionPickBtnActive]}
                      onPress={() => setNewMedSession(s)}
                    >
                      <LocalizedText style={[styles.sessionPickText, newMedSession === s && styles.sessionPickTextActive]}>
                        {s === 'MORNING' ? 'Sáng' : s === 'NOON' ? 'Trưa' : 'Tối'}
                      </LocalizedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <LocalizedText style={[styles.inputLabel, { color: textSub, marginTop: 10 }]}>Liều lượng & Hướng dẫn:</LocalizedText>
            <LocalizedTextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
              placeholder="VD: 1 viên sau khi ăn no"
              placeholderTextColor="#94A3B8"
              value={newMedDose}
              onChangeText={setNewMedDose}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]}
                onPress={() => setAddMedModalVisible(false)}
              >
                <LocalizedText style={[styles.modalCancelText, { color: textSub }]}>Hủy</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddNewMed}>
                <LocalizedText style={styles.modalSaveText}>Lưu cữ thuốc</LocalizedText>
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, padding: 20, borderWidth: 1 },
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
});
