// MedicationReminderScreen.tsx
// Màn hình chi tiết "Lịch uống thuốc & Ăn uống sinh hoạt"
// Hỗ trợ Phát thông báo qua Loa thông minh Hub (Voice Reminder FR12)

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';


interface MedicationItem {
  id: string;
  name: string;
  time: string;
  session: 'MORNING' | 'NOON' | 'EVENING';
  dose: string;
  purpose: string;
  taken: boolean;
}

interface HydrationSchedule {
  time: string;
  amount: string;
  note: string;
  done: boolean;
}

export default function MedicationReminderScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();

  // FR12: Voice Reminder through Hub Smart Speaker
  const [hubVoiceReminderEnabled, setHubVoiceReminderEnabled] = useState(true);
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);

  // Filter session
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MORNING' | 'NOON' | 'EVENING'>('ALL');

  // Medication list
  const [medications, setMedications] = useState<MedicationItem[]>([
    {
      id: 'm1',
      name: 'Glucosamine Sulfate 1500mg',
      time: '07:30',
      session: 'MORNING',
      dose: '1 gói sau khi ăn sáng',
      purpose: 'Bôi trơn khớp gối, ngừa thoái hóa',
      taken: true,
    },
    {
      id: 'm2',
      name: 'Vitamin B-Complex tổng hợp',
      time: '07:30',
      session: 'MORNING',
      dose: '1 viên sau bữa sáng',
      purpose: 'Tăng cường tuần hoàn máu não',
      taken: true,
    },
    {
      id: 'm3',
      name: 'Canxi Nano + D3 MK7',
      time: '12:00',
      session: 'NOON',
      dose: '1 viên sủi sau ăn trưa',
      purpose: 'Ngừa loãng xương & chắc khỏe xương',
      taken: true,
    },
    {
      id: 'm4',
      name: 'Amlodipine 5mg (Thuốc huyết áp)',
      time: '18:30',
      session: 'EVENING',
      dose: '1 viên sau bữa tối',
      purpose: 'Kiểm soát huyết áp nền < 130/80',
      taken: false,
    },
    {
      id: 'm5',
      name: 'Metformin 500mg',
      time: '18:30',
      session: 'EVENING',
      dose: '1 viên sau bữa tối',
      purpose: 'Ổn định đường huyết đái tháo đường',
      taken: false,
    },
  ]);

  // Hydration schedule
  const [hydrationList, setHydrationList] = useState<HydrationSchedule[]>([
    { time: '08:30', amount: '200ml', note: 'Nước ấm sau thức dậy & ăn sáng', done: true },
    { time: '10:00', amount: '150ml', note: 'Nước lọc tinh khiết buổi sáng', done: true },
    { time: '14:30', amount: '200ml', note: 'Trà thảo mộc / Atiso ấm', done: true },
    { time: '16:30', amount: '150ml', note: 'Nước lọc bổ sung buổi chiều', done: false },
    { time: '20:00', amount: '150ml', note: 'Nước ấm 1 giờ trước khi ngủ', done: false },
  ]);

  // Add new med modal
  const [isAddMedModalVisible, setAddMedModalVisible] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedTime, setNewMedTime] = useState('18:30');
  const [newMedSession, setNewMedSession] = useState<'MORNING' | 'NOON' | 'EVENING'>('EVENING');
  const [newMedDose, setNewMedDose] = useState('');

  const toggleMedicationTaken = (id: string) => {
    setMedications((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !item.taken;
          if (nextState) {
            LocalizedAlert.alert('Đã xác nhận', `Đã đánh dấu uống thuốc "${item.name}".`);
          }
          return { ...item, taken: nextState };
        }
        return item;
      })
    );
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
      LocalizedAlert.alert(
        'Loa Hub đã phát',
        '📢 "Đã đến 18:30, mời cụ uống thuốc huyết áp Amlodipine 5mg và 1 cốc nước ấm."'
      );
    }, 1200);
  };

  const handleAddNewMed = () => {
    if (!newMedName.trim()) {
      LocalizedAlert.alert('Lỗi', 'Vui lòng nhập tên thuốc.');
      return;
    }

    const newMed: MedicationItem = {
      id: `med_${Date.now()}`,
      name: newMedName.trim(),
      time: newMedTime.trim() || '18:30',
      session: newMedSession,
      dose: newMedDose.trim() || '1 viên sau khi ăn',
      purpose: 'Thuốc theo chỉ định bác sĩ',
      taken: false,
    };

    setMedications([...medications, newMed]);
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

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' },
      ]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF',
            borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isDarkMode ? '#F8FAFC' : '#0F172A'}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <LocalizedText
            style={[
              styles.headerTitle,
              { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            Lịch uống thuốc &amp; Ăn uống
          </LocalizedText>
          <LocalizedText
            style={[
              styles.headerSubtitle,
              { color: isDarkMode ? '#94A3B8' : '#64748B' },
            ]}
          >
            Đồng bộ giọng nói Loa thông minh Hub FR12
          </LocalizedText>
        </View>

        <TouchableOpacity
          style={[
            styles.addHeaderBtn,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={() => setAddMedModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* TÙY CHỌN: Phát thông báo qua Loa thông minh Hub (Voice Reminder FR12) */}
        <View
          style={[
            styles.speakerCard,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: hubVoiceReminderEnabled ? Colors.primary : isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.speakerTopRow}>
            <View style={[styles.speakerIconCircle, { backgroundColor: isDarkMode ? '#432005' : '#FFF7ED' }]}>
              <Ionicons name="volume-high" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <LocalizedText
                  style={[
                    styles.speakerTitle,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  Loa thông minh Hub (Voice Reminder FR12)
                </LocalizedText>
              </View>
              <LocalizedText
                style={[
                  styles.speakerSubtitle,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
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

          <View style={[styles.speakerDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

          <View style={styles.speakerBottomRow}>
            <View style={styles.speakerStatusPill}>
              <View style={styles.greenLiveDot} />
              <LocalizedText style={styles.speakerStatusText}>Hub #01 Online (Âm lượng 80%)</LocalizedText>
            </View>
            <TouchableOpacity
              style={[
                styles.testVoiceBtn,
                isPlayingTestVoice && { opacity: 0.6 },
              ]}
              onPress={handleTestVoiceSpeaker}
              activeOpacity={0.8}
              disabled={isPlayingTestVoice}
            >
              <Ionicons
                name={isPlayingTestVoice ? 'radio' : 'play'}
                size={14}
                color="#FFF"
              />
              <LocalizedText style={styles.testVoiceBtnText}>
                {isPlayingTestVoice ? 'Đang phát...' : 'Thử giọng nói'}
              </LocalizedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Khối Cữ thuốc theo buổi (Sáng - Trưa - Tối) */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.sectionIconBox,
                  { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="medical" size={20} color="#2563EB" />
              </View>
              <LocalizedText
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Danh mục cữ thuốc hôm nay
              </LocalizedText>
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
                  style={[
                    styles.sessionTabBtn,
                    active && styles.sessionTabBtnActive,
                    isDarkMode && !active && { backgroundColor: '#0F172A' },
                  ]}
                  onPress={() => setSelectedFilter(tab.key as any)}
                >
                  <LocalizedText
                    style={[
                      styles.sessionTabText,
                      active && styles.sessionTabTextActive,
                      isDarkMode && !active && { color: '#94A3B8' },
                    ]}
                  >
                    {tab.label}
                  </LocalizedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Danh sách các loại thuốc */}
          <View style={styles.medListContainer}>
            {filteredMeds.map((med) => (
              <View
                key={med.id}
                style={[
                  styles.medItemRow,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: med.taken ? '#10B981' : isDarkMode ? '#334155' : '#E2E8F0',
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
                      { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                      med.taken && styles.medItemNameDone,
                    ]}
                  >
                    {med.name}
                  </LocalizedText>
                  <LocalizedText style={styles.medItemDose}>{med.dose}</LocalizedText>
                  <LocalizedText
                    style={[
                      styles.medItemPurpose,
                      { color: isDarkMode ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    Mục đích: {med.purpose}
                  </LocalizedText>
                </View>

                <TouchableOpacity
                  style={[
                    styles.medCheckBtn,
                    med.taken ? styles.medCheckBtnDone : styles.medCheckBtnPending,
                  ]}
                  onPress={() => toggleMedicationTaken(med.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={med.taken ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={med.taken ? '#10B981' : '#94A3B8'}
                  />
                  <LocalizedText
                    style={[
                      styles.medCheckBtnText,
                      { color: med.taken ? '#10B981' : '#64748B' },
                    ]}
                  >
                    {med.taken ? 'Đã uống' : 'Chưa'}
                  </LocalizedText>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Khối Khung giờ sinh hoạt ăn uống */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.sectionIconBox,
                  { backgroundColor: isDarkMode ? '#452F10' : '#FEF3C7' },
                ]}
              >
                <Ionicons name="restaurant-outline" size={20} color="#D97706" />
              </View>
              <LocalizedText
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Khung giờ sinh hoạt ăn uống
              </LocalizedText>
            </View>
          </View>

          <View style={styles.mealList}>
            {[
              {
                time: '07:00',
                meal: 'Bữa sáng',
                menu: 'Cháo yến mạch dinh dưỡng hoặc phở gà mềm xé sợi',
                icon: 'sunny-outline',
                color: '#F59E0B',
                status: 'Đã hoàn thành',
              },
              {
                time: '11:30',
                meal: 'Bữa trưa',
                menu: 'Cơm gạo mềm, cá hấp gừng hành, canh rau mồng tơi',
                icon: 'partly-sunny-outline',
                color: '#0EA5E9',
                status: 'Đã hoàn thành',
              },
              {
                time: '18:00',
                meal: 'Bữa tối',
                menu: 'Súp hạt sen bí đỏ, ức gà hầm mềm, dễ tiêu hóa',
                icon: 'moon-outline',
                color: '#6366F1',
                status: 'Sắp tới (18:00)',
              },
            ].map((m, idx) => (
              <View
                key={idx}
                style={[
                  styles.mealItem,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: isDarkMode ? '#334155' : '#F1F5F9',
                  },
                ]}
              >
                <View style={[styles.mealIconBox, { backgroundColor: `${m.color}20` }]}>
                  <Ionicons name={m.icon as any} size={20} color={m.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <LocalizedText
                      style={[
                        styles.mealName,
                        { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                      ]}
                    >
                      {m.meal} ({m.time})
                    </LocalizedText>
                    <View
                      style={[
                        styles.mealStatusBadge,
                        {
                          backgroundColor:
                            m.status.includes('hoàn thành')
                              ? isDarkMode
                                ? '#064E3B'
                                : '#DCFCE7'
                              : isDarkMode
                              ? '#432005'
                              : '#FEF3C7',
                        },
                      ]}
                    >
                      <LocalizedText
                        style={[
                          styles.mealStatusText,
                          {
                            color: m.status.includes('hoàn thành')
                              ? '#15803D'
                              : '#B45309',
                          },
                        ]}
                      >
                        {m.status}
                      </LocalizedText>
                    </View>
                  </View>
                  <LocalizedText
                    style={[
                      styles.mealMenuText,
                      { color: isDarkMode ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    {m.menu}
                  </LocalizedText>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Khối Bổ sung nước định kỳ */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.sectionIconBox,
                  { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' },
                ]}
              >
                <Ionicons name="water-outline" size={20} color="#0284C7" />
              </View>
              <View>
                <LocalizedText
                  style={[
                    styles.sectionTitle,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  Bổ sung nước định kỳ
                </LocalizedText>
                <LocalizedText
                  style={[
                    styles.sectionSubtitle,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Khuyến nghị người cao tuổi: 1.5 - 2L nước mỗi ngày
                </LocalizedText>
              </View>
            </View>
          </View>

          <View style={styles.hydrationGrid}>
            {hydrationList.map((h, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.hydrationCard,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: h.done ? '#0284C7' : isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => toggleHydrationDone(idx)}
                activeOpacity={0.8}
              >
                <View style={styles.hydrationCardTop}>
                  <LocalizedText style={styles.hydrationTimeText}>{h.time}</LocalizedText>
                  <Ionicons
                    name={h.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={h.done ? '#0284C7' : '#94A3B8'}
                  />
                </View>
                <LocalizedText
                  style={[
                    styles.hydrationAmountText,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {h.amount}
                </LocalizedText>
                <LocalizedText
                  style={[
                    styles.hydrationNoteText,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                  numberOfLines={2}
                >
                  {h.note}
                </LocalizedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Modal Thêm cữ thuốc */}
      <Modal
        transparent
        visible={isAddMedModalVisible}
        animationType="fade"
        onRequestClose={() => setAddMedModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddMedModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
            onPress={() => {}}
          >
            <LocalizedText
              style={[
                styles.modalTitle,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              Thêm cữ thuốc mới
            </LocalizedText>

            <LocalizedText
              style={[
                styles.inputLabel,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Tên thuốc &amp; hàm lượng:
            </LocalizedText>
            <LocalizedTextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
              placeholder="VD: Losartan 50mg"
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={newMedName}
              onChangeText={setNewMedName}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <LocalizedText
                  style={[
                    styles.inputLabel,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Giờ uống (HH:mm):
                </LocalizedText>
                <LocalizedTextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      color: isDarkMode ? '#F8FAFC' : '#0F172A',
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    },
                  ]}
                  value={newMedTime}
                  onChangeText={setNewMedTime}
                />
              </View>

              <View style={{ flex: 1 }}>
                <LocalizedText
                  style={[
                    styles.inputLabel,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Cữ buổi:
                </LocalizedText>
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  {(['MORNING', 'NOON', 'EVENING'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.sessionPickBtn,
                        newMedSession === s && styles.sessionPickBtnActive,
                      ]}
                      onPress={() => setNewMedSession(s)}
                    >
                      <LocalizedText
                        style={[
                          styles.sessionPickText,
                          newMedSession === s && styles.sessionPickTextActive,
                        ]}
                      >
                        {s === 'MORNING' ? 'Sáng' : s === 'NOON' ? 'Trưa' : 'Tối'}
                      </LocalizedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <LocalizedText
              style={[
                styles.inputLabel,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Liều lượng &amp; Hướng dẫn:
            </LocalizedText>
            <LocalizedTextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
              placeholder="VD: 1 viên sau khi ăn no"
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={newMedDose}
              onChangeText={setNewMedDose}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => setAddMedModalVisible(false)}
              >
                <LocalizedText
                  style={[
                    styles.modalCancelText,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Hủy
                </LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddNewMed}
              >
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
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  addHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  speakerCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  speakerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  speakerSubtitle: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  speakerDivider: {
    height: 1,
    marginVertical: 12,
  },
  speakerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speakerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  speakerStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  testVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  testVoiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  sectionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  addMedLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  sessionTabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  sessionTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  sessionTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  sessionTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  medListContainer: {
    gap: 10,
  },
  medItemRow: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  medTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  medTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  medItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  medItemNameDone: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  medItemDose: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  medItemPurpose: {
    fontSize: 11,
    marginTop: 2,
  },
  medCheckBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  medCheckBtnDone: {},
  medCheckBtnPending: {},
  medCheckBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mealList: {
    gap: 10,
  },
  mealItem: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealName: {
    fontSize: 14,
    fontWeight: '700',
  },
  mealStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mealStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mealMenuText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  hydrationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hydrationCard: {
    width: '48%',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  hydrationCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hydrationTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  hydrationAmountText: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  hydrationNoteText: {
    fontSize: 10,
    lineHeight: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sessionPickBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  sessionPickBtnActive: {
    backgroundColor: Colors.primary,
  },
  sessionPickText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  sessionPickTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
