import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';

export interface AppointmentFormModalProps {
  visible: boolean;
  isEditing: boolean;
  patients?: any[];
  patientId: string;
  patientName: string;
  scheduledAt: string;
  examType: string;
  visitType?: 'HOME_VISIT' | 'CLINIC';
  location: string;
  instructions: string;
  enableSpeaker: boolean;
  recurrencePattern?: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  recurrenceOccurrences?: number;
  isSubmitting: boolean;
  onSelectPatient?: (patient: any) => void;
  onChangePatientName: (val: string) => void;
  onChangeScheduledAt: (val: string) => void;
  onChangeExamType: (val: string) => void;
  onChangeVisitType?: (val: 'HOME_VISIT' | 'CLINIC') => void;
  onChangeLocation: (val: string) => void;
  onChangeInstructions: (val: string) => void;
  onToggleEnableSpeaker: (val: boolean) => void;
  onChangeRecurrencePattern?: (val: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY') => void;
  onChangeRecurrenceOccurrences?: (val: number) => void;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

const COMMON_TIME_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
];

const EXAM_PURPOSES = [
  'Tái khám tim mạch & HA',
  'Đo điện tâm đồ (ECG)',
  'Xét nghiệm máu tại nhà',
  'Khám tổng quát định kỳ',
  'Kiểm tra đường huyết & tiểu đường',
  'Khám phục hồi chức năng',
];

const PRESET_INSTRUCTIONS = [
  'Đo huyết áp 3 ngày trước khám',
  'Nhịn ăn sáng để xét nghiệm máu',
  'Chuẩn bị danh mục thuốc đang uống',
  'Có người thân cùng có mặt khi khám',
];

export const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({
  visible,
  isEditing,
  patients = [],
  patientId,
  patientName,
  scheduledAt,
  examType,
  visitType = 'HOME_VISIT',
  location,
  instructions,
  enableSpeaker,
  recurrencePattern = 'NONE',
  recurrenceOccurrences = 1,
  isSubmitting,
  onSelectPatient,
  onChangePatientName,
  onChangeScheduledAt,
  onChangeExamType,
  onChangeVisitType,
  onChangeLocation,
  onChangeInstructions,
  onToggleEnableSpeaker,
  onChangeRecurrencePattern,
  onChangeRecurrenceOccurrences,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => {
  const insets = useSafeAreaInsets();

  // Date and Time internal state for clean user interaction
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (scheduledAt) {
      const parsed = new Date(scheduledAt);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 30, 0, 0);
    return tomorrow;
  });

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('08:30');
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());

  // Synchronize internal date/time with parent ISO string
  const syncScheduledAt = (date: Date, timeSlot: string) => {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const target = new Date(date);
    target.setHours(hours || 8, minutes || 30, 0, 0);
    setSelectedDate(target);
    setSelectedTimeSlot(timeSlot);
    onChangeScheduledAt(target.toISOString());
  };

  useEffect(() => {
    if (visible) {
      if (scheduledAt) {
        const parsed = new Date(scheduledAt);
        if (!isNaN(parsed.getTime())) {
          setSelectedDate(parsed);
          setCalendarViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
          const hh = String(parsed.getHours()).padStart(2, '0');
          const mm = String(parsed.getMinutes()).padStart(2, '0');
          setSelectedTimeSlot(`${hh}:${mm}`);
          return;
        }
      }
      // Initialize with tomorrow 08:30
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 30, 0, 0);
      setSelectedDate(tomorrow);
      setCalendarViewDate(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1));
      setSelectedTimeSlot('08:30');
      onChangeScheduledAt(tomorrow.toISOString());
    }
  }, [visible]);

  // Quick Date Preset Handler
  const handleQuickDatePreset = (daysOffset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    syncScheduledAt(target, selectedTimeSlot);
  };

  // Date Stepper (+1 day / -1 day)
  const handleStepDay = (step: number) => {
    const target = new Date(selectedDate);
    target.setDate(target.getDate() + step);
    syncScheduledAt(target, selectedTimeSlot);
  };

  // Formatted date string for Vietnamese UI
  const formattedDateDisplay = useMemo(() => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeek = days[selectedDate.getDay()];
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDate.getFullYear();
    return `${dayOfWeek}, ${day}/${month}/${year}`;
  }, [selectedDate]);

  // Selected Patient Details
  const selectedPatientObj = useMemo(() => {
    return patients.find((p) => String(p.id) === String(patientId)) || patients[0];
  }, [patients, patientId]);

  // Visit Modality Presets (CHỈ CÓ 2 LOẠI: Ở nhà bệnh nhân hoặc Phòng khám của bác sĩ)
  const handleSelectModality = (modality: 'HOME_VISIT' | 'CLINIC') => {
    if (onChangeVisitType) {
      onChangeVisitType(modality);
    }
    // Auto populate location based on modality
    if (modality === 'HOME_VISIT') {
      const curPatient = patients.find((p) => String(p.id) === String(patientId));
      if (curPatient?.house_address) {
        onChangeLocation(`Tại nhà: ${curPatient.house_address}`);
      } else {
        onChangeLocation('Tại nhà bệnh nhân (Khám tại gia)');
      }
    } else {
      onChangeLocation('Phòng khám Bác sĩ Gia đình (123 Hải Phòng, Đà Nẵng)');
    }
  };

  // Append or toggle instruction template
  const handleToggleInstructionPreset = (preset: string) => {
    if (!instructions.trim()) {
      onChangeInstructions(preset);
    } else if (instructions.includes(preset)) {
      // Remove if already present
      const cleaned = instructions
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && s !== preset)
        .join('; ');
      onChangeInstructions(cleaned);
    } else {
      onChangeInstructions(`${instructions.trim()}; ${preset}`);
    }
  };

  // Calendar generation for DatePicker Modal
  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; isSelected: boolean; isPast: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Padding for days before the first day of the month
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDate = new Date(year, month, -firstDayIndex + i + 1);
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isSelected: false,
        isPast: prevDate < today,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const isSelected =
        curDate.getFullYear() === selectedDate.getFullYear() &&
        curDate.getMonth() === selectedDate.getMonth() &&
        curDate.getDate() === selectedDate.getDate();

      days.push({
        date: curDate,
        isCurrentMonth: true,
        isSelected,
        isPast: curDate < today,
      });
    }

    return days;
  }, [calendarViewDate, selectedDate]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="calendar" size={18} color="#0284C7" />
              </View>
              <View>
                <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {isEditing ? 'Chỉnh Sửa Lịch Khám' : 'Đặt Lịch Tái Khám Mới'}
                </LocalizedText>
                <LocalizedText style={[styles.modalSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Lập kế hoạch khám & gửi xác nhận tới người nhà
                </LocalizedText>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Chọn Bệnh nhân từ danh sách bệnh nhân của bác sĩ */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="people" size={17} color="#0284C7" />
                <LocalizedText style={styles.fieldLabel}>Chọn bệnh nhân từ danh sách (*)</LocalizedText>
              </View>

              {patients && patients.length > 0 ? (
                <View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.patientRosterRow}
                  >
                    {patients.map((pat) => {
                      const isSelected = String(pat.id) === String(patientId);
                      const initial = pat.name?.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'C';
                      return (
                        <TouchableOpacity
                          key={String(pat.id)}
                          style={[
                            styles.patientCardPill,
                            {
                              backgroundColor: isSelected
                                ? isDarkMode
                                  ? '#0F2942'
                                  : '#F0F9FF'
                                : isDarkMode
                                ? '#0F172A'
                                : '#F8FAFC',
                              borderColor: isSelected ? '#0284C7' : colors.border,
                            },
                          ]}
                          onPress={() => {
                            if (onSelectPatient) {
                              onSelectPatient(pat);
                            } else {
                              onChangePatientName(pat.name);
                            }
                            if (visitType === 'HOME_VISIT' && pat.house_address) {
                              onChangeLocation(`Tại nhà: ${pat.house_address}`);
                            }
                          }}
                        >
                          <View
                            style={[
                              styles.patientAvatarBadge,
                              { backgroundColor: isSelected ? '#0284C7' : '#94A3B8' },
                            ]}
                          >
                            <LocalizedText style={styles.patientAvatarText}>{initial}</LocalizedText>
                          </View>
                          <View style={{ flex: 1 }}>
                            <LocalizedText
                              style={[
                                styles.patientCardName,
                                {
                                  color: isSelected ? '#0284C7' : colors.textPrimary,
                                  fontWeight: isSelected ? '800' : '600',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {pat.name}
                            </LocalizedText>
                            <LocalizedText style={styles.patientCardMeta} numberOfLines={1}>
                              {pat.age ? `${pat.age} tuổi` : 'Người cao tuổi'}
                              {pat.house_name ? ` • ${pat.house_name}` : ''}
                            </LocalizedText>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={18} color="#0284C7" style={{ marginLeft: 4 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Thẻ tóm tắt bệnh nhân đang chọn (thay cho ô gõ tay thừa) */}
                  {selectedPatientObj && (
                    <View
                      style={[
                        styles.patientSelectedBanner,
                        { backgroundColor: isDarkMode ? '#0F2942' : '#F0F9FF', borderColor: '#0284C7' },
                      ]}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#0284C7" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <LocalizedText style={[styles.patientSelectedTitle, { color: colors.textPrimary }]}>
                          Bệnh nhân: <LocalizedText style={{ fontWeight: '800', color: '#0284C7' }}>{selectedPatientObj.name}</LocalizedText>
                        </LocalizedText>
                        <LocalizedText style={styles.patientSelectedSub}>
                          {selectedPatientObj.age ? `${selectedPatientObj.age} tuổi` : ''}
                          {selectedPatientObj.house_address ? ` • ${selectedPatientObj.house_address}` : ''}
                        </LocalizedText>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <LocalizedTextInput
                  style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={patientName}
                  onChangeText={onChangePatientName}
                  placeholder="Nhập tên bệnh nhân"
                  placeholderTextColor="#94A3B8"
                />
              )}
            </View>

            {/* 2. Chọn Ngày & Giờ khám (DatePicker / Combo Box) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time" size={17} color="#0284C7" />
                <LocalizedText style={styles.fieldLabel}>Ngày & Giờ tái khám (*)</LocalizedText>
              </View>

              {/* Banner hiển thị ngày giờ đã chọn & nút mở DatePicker */}
              <TouchableOpacity
                style={[
                  styles.selectedDateTimeBanner,
                  { backgroundColor: isDarkMode ? '#0F2942' : '#F0F9FF', borderColor: '#0284C7' },
                ]}
                activeOpacity={0.8}
                onPress={() => setShowDatePickerModal(true)}
              >
                <View style={{ flex: 1 }}>
                  <LocalizedText style={styles.bannerSubTitle}>Thời gian đã chọn (Bấm để mở lịch):</LocalizedText>
                  <LocalizedText style={styles.bannerMainTitle}>
                    {selectedTimeSlot} — {formattedDateDisplay}
                  </LocalizedText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.openCalendarBtn}>
                    <Ionicons name="calendar-outline" size={16} color="#0284C7" />
                  </View>
                  <TouchableOpacity
                    style={styles.dateStepBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleStepDay(-1);
                    }}
                  >
                    <Ionicons name="chevron-back" size={18} color="#0284C7" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateStepBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleStepDay(1);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#0284C7" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Nút chọn nhanh ngày */}
              <View style={styles.quickDateRow}>
                {[
                  { label: 'Hôm nay', offset: 0 },
                  { label: 'Ngày mai', offset: 1 },
                  { label: '+3 ngày', offset: 3 },
                  { label: '+1 tuần', offset: 7 },
                  { label: '+1 tháng', offset: 30 },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.quickDatePill,
                      {
                        backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleQuickDatePreset(item.offset)}
                  >
                    <LocalizedText style={[styles.quickDatePillText, { color: colors.textPrimary }]}>
                      {item.label}
                    </LocalizedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Khung giờ khám đề xuất */}
              <LocalizedText style={[styles.subFieldLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Chọn khung giờ khám:
              </LocalizedText>
              <View style={styles.timeSlotGrid}>
                {COMMON_TIME_SLOTS.map((slot) => {
                  const isSlotActive = selectedTimeSlot === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[
                        styles.timeSlotChip,
                        isSlotActive
                          ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                          : { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border },
                      ]}
                      onPress={() => syncScheduledAt(selectedDate, slot)}
                    >
                      <LocalizedText
                        style={[
                          styles.timeSlotText,
                          { color: isSlotActive ? '#FFFFFF' : colors.textPrimary, fontWeight: isSlotActive ? '800' : '600' },
                        ]}
                      >
                        {slot}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Hình thức khám (CHỈ CÓ 2 LOẠI: Ở NHÀ BỆNH NHÂN HOẶC PHÒNG KHÁM CỦA BÁC SĨ) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="medical" size={17} color="#0284C7" />
                <LocalizedText style={styles.fieldLabel}>Hình thức khám (*)</LocalizedText>
              </View>
              <View style={styles.modalityRow}>
                {[
                  { key: 'HOME_VISIT', label: 'Ở nhà bệnh nhân', icon: 'home' },
                  { key: 'CLINIC', label: 'Phòng khám của bác sĩ', icon: 'business' },
                ].map((item) => {
                  const isModActive = visitType === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.modalityPill,
                        isModActive
                          ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                          : { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: colors.border },
                      ]}
                      onPress={() => handleSelectModality(item.key as any)}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isModActive ? '#FFFFFF' : colors.textPrimary}
                        style={{ marginRight: 6 }}
                      />
                      <LocalizedText
                        style={[
                          styles.modalityText,
                          { color: isModActive ? '#FFFFFF' : colors.textPrimary, fontWeight: isModActive ? '700' : '600' },
                        ]}
                      >
                        {item.label}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Mục đích khám (Tự ghi hoặc chọn nhanh) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="clipboard" size={17} color="#0284C7" />
                <LocalizedText style={styles.fieldLabel}>Chuyên khoa / Mục đích khám (*)</LocalizedText>
              </View>

              {/* Ô tự ghi */}
              <LocalizedTextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={examType}
                onChangeText={onChangeExamType}
                placeholder="Bác sĩ tự ghi hoặc chọn nhanh bên dưới..."
                placeholderTextColor="#94A3B8"
              />

              {/* Chip chọn nhanh */}
              <View style={styles.quickTypeRow}>
                {EXAM_PURPOSES.map((item) => {
                  const isPurposeActive = examType === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.quickTypePill,
                        isPurposeActive
                          ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                          : { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: colors.border },
                      ]}
                      onPress={() => onChangeExamType(item)}
                    >
                      {isPurposeActive && (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                      )}
                      <LocalizedText
                        style={[
                          styles.quickTypePillText,
                          { color: isPurposeActive ? '#FFFFFF' : '#0284C7', fontWeight: isPurposeActive ? '700' : '600' },
                        ]}
                      >
                        {item}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. Địa điểm khám */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="location" size={17} color="#0284C7" />
                <LocalizedText style={styles.fieldLabel}>Địa điểm khám cụ thể</LocalizedText>
              </View>
              <LocalizedTextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={location}
                onChangeText={onChangeLocation}
                placeholder="Địa chỉ nhà cụ hoặc phòng khám..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 6. Dặn dò người nhà & bệnh nhân (Tự ghi hoặc chọn nhanh) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="chatbubble-ellipses" size={17} color="#0284C7" />
                <LocalizedText style={styles.fieldLabel}>Dặn dò chuẩn bị trước khám</LocalizedText>
              </View>
              {/* Ô tự ghi đa dòng */}
              <LocalizedTextInput
                style={[
                  styles.inputField,
                  { height: 68, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
                ]}
                multiline
                value={instructions}
                onChangeText={onChangeInstructions}
                placeholder="Bác sĩ tự ghi dặn dò hoặc bấm chọn nhanh bên dưới..."
                placeholderTextColor="#94A3B8"
              />
              {/* Chip chọn nhanh dặn dò */}
              <View style={styles.quickTypeRow}>
                {PRESET_INSTRUCTIONS.map((preset) => {
                  const isPresetActive = instructions.includes(preset);
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.instructionPresetPill,
                        isPresetActive
                          ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                          : { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: colors.border },
                      ]}
                      onPress={() => handleToggleInstructionPreset(preset)}
                    >
                      <Ionicons
                        name={isPresetActive ? 'checkmark-circle' : 'add-circle-outline'}
                        size={12}
                        color={isPresetActive ? '#FFFFFF' : '#0284C7'}
                        style={{ marginRight: 4 }}
                      />
                      <LocalizedText
                        style={[
                          styles.instructionPresetText,
                          { color: isPresetActive ? '#FFFFFF' : colors.textPrimary, fontWeight: isPresetActive ? '700' : '500' },
                        ]}
                      >
                        {preset}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 7. Lặp lại định kỳ (khi tạo mới) */}
            {!isEditing && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="repeat" size={17} color="#0284C7" />
                  <LocalizedText style={styles.fieldLabel}>Lịch khám định kỳ (Chu kỳ lặp)</LocalizedText>
                </View>
                <View style={styles.recurrencePillRow}>
                  {[
                    { key: 'NONE', label: 'Không lặp' },
                    { key: 'WEEKLY', label: 'Hàng tuần' },
                    { key: 'MONTHLY', label: 'Hàng tháng' },
                    { key: 'QUARTERLY', label: 'Hàng quý' },
                  ].map((item) => {
                    const isSelected = recurrencePattern === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.recurrenceOptionPill,
                          isSelected
                            ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                            : { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: colors.border },
                        ]}
                        onPress={() => onChangeRecurrencePattern && onChangeRecurrencePattern(item.key as any)}
                      >
                        <LocalizedText
                          style={[
                            styles.recurrenceOptionText,
                            { color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: isSelected ? '700' : '500' },
                          ]}
                        >
                          {item.label}
                        </LocalizedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {recurrencePattern !== 'NONE' && (
                  <View style={[styles.occurrencesBox, { backgroundColor: isDarkMode ? '#0F2942' : '#EFF6FF' }]}>
                    <LocalizedText style={[styles.occurrencesLabel, { color: isDarkMode ? '#CBD5E1' : '#1E293B' }]}>
                      Số đợt khám định kỳ tự động:
                    </LocalizedText>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          onChangeRecurrenceOccurrences &&
                          onChangeRecurrenceOccurrences(Math.max(1, recurrenceOccurrences - 1))
                        }
                      >
                        <Ionicons name="remove" size={16} color="#0284C7" />
                      </TouchableOpacity>
                      <LocalizedText style={[styles.stepperValue, { color: colors.textPrimary }]}>
                        {recurrenceOccurrences}
                      </LocalizedText>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          onChangeRecurrenceOccurrences &&
                          onChangeRecurrenceOccurrences(Math.min(12, recurrenceOccurrences + 1))
                        }
                      >
                        <Ionicons name="add" size={16} color="#0284C7" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 8. Bật / Tắt phát loa nhắc */}
            <View style={[styles.switchRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="volume-high" size={17} color="#0284C7" />
                  <LocalizedText style={[styles.switchTitle, { color: colors.textPrimary }]}>
                    Phát loa thông minh Hub AI
                  </LocalizedText>
                </View>
                <LocalizedText style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Tự động phát giọng nói nhắc nhở tại nhà cụ trước giờ khám 24h & 2h
                </LocalizedText>
              </View>
              <Switch
                value={enableSpeaker}
                onValueChange={onToggleEnableSpeaker}
                trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>

          {/* Sticky Bottom Action Footer */}
          <View
            style={[
              styles.modalFooter,
              {
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 14),
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.btnCancel, { borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <LocalizedText style={[styles.btnCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                Hủy
              </LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSave}
              onPress={onSave}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                  <LocalizedText style={styles.btnSaveText}>
                    {isEditing ? 'Cập nhật lịch khám' : 'Xác nhận tạo lịch'}
                  </LocalizedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* DatePicker Calendar Modal */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={[styles.calendarBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.calendarHeader}>
              <LocalizedText style={[styles.calendarTitle, { color: colors.textPrimary }]}>
                Tháng {calendarViewDate.getMonth() + 1}/{calendarViewDate.getFullYear()}
              </LocalizedText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.calendarNavBtn}
                  onPress={() =>
                    setCalendarViewDate(
                      new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1)
                    )
                  }
                >
                  <Ionicons name="chevron-back" size={18} color="#0284C7" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarNavBtn}
                  onPress={() =>
                    setCalendarViewDate(
                      new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1)
                    )
                  }
                >
                  <Ionicons name="chevron-forward" size={18} color="#0284C7" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Days of week header */}
            <View style={styles.calendarWeekRow}>
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
                <LocalizedText key={d} style={styles.calendarWeekText}>
                  {d}
                </LocalizedText>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.calendarDaysGrid}>
              {calendarDays.map((dayItem, idx) => {
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.calendarDayCell,
                      dayItem.isSelected && styles.calendarDayCellSelected,
                    ]}
                    disabled={!dayItem.isCurrentMonth || dayItem.isPast}
                    onPress={() => {
                      syncScheduledAt(dayItem.date, selectedTimeSlot);
                      setShowDatePickerModal(false);
                    }}
                  >
                    <LocalizedText
                      style={[
                        styles.calendarDayText,
                        !dayItem.isCurrentMonth
                          ? { color: '#CBD5E1' }
                          : dayItem.isPast
                          ? { color: '#94A3B8' }
                          : dayItem.isSelected
                          ? { color: '#FFFFFF', fontWeight: '800' }
                          : { color: colors.textPrimary },
                      ]}
                    >
                      {dayItem.date.getDate()}
                    </LocalizedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.calendarCloseBtn}
              onPress={() => setShowDatePickerModal(false)}
            >
              <LocalizedText style={styles.calendarCloseBtnText}>Đóng</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16.5, fontWeight: '800' },
  modalSubtitle: { fontSize: 11, marginTop: 1 },
  scrollBody: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 },
  sectionBlock: { marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
  subFieldLabel: { fontSize: 11.5, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  inputField: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },

  // Patient Roster Pills
  patientRosterRow: { gap: 8, paddingVertical: 4 },
  patientCardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 220,
    minWidth: 155,
  },
  patientAvatarBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  patientCardName: { fontSize: 12.5 },
  patientCardMeta: { fontSize: 10.5, color: '#94A3B8', marginTop: 1 },

  // Selected Patient Banner
  patientSelectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  patientSelectedTitle: { fontSize: 12 },
  patientSelectedSub: { fontSize: 10.5, color: '#64748B', marginTop: 1 },

  // DateTime Banner
  selectedDateTimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  bannerSubTitle: { fontSize: 10.5, color: '#0284C7', fontWeight: '700', textTransform: 'uppercase' },
  bannerMainTitle: { fontSize: 13.5, fontWeight: '800', color: '#0284C7', marginTop: 2 },
  stepperDateRow: { flexDirection: 'row', gap: 6 },
  dateStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openCalendarBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quick Date presets
  quickDateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  quickDatePill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  quickDatePillText: { fontSize: 11.5, fontWeight: '600' },

  // Time Slot Grid
  timeSlotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeSlotChip: {
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
    minWidth: 54,
    alignItems: 'center',
  },
  timeSlotText: { fontSize: 12 },

  // Modality Row (Chỉ 2 loại)
  modalityRow: { flexDirection: 'row', gap: 10 },
  modalityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 9,
  },
  modalityText: { fontSize: 12 },

  // Exam purpose pills
  quickTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  quickTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  quickTypePillText: { fontSize: 11.5 },

  // Instruction presets
  instructionPresetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  instructionPresetText: { fontSize: 10.5 },

  // Recurrence
  recurrencePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recurrenceOptionPill: {
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
  },
  recurrenceOptionText: { fontSize: 11.5 },
  occurrencesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  occurrencesLabel: { fontSize: 12, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: { fontSize: 14, fontWeight: '800', minWidth: 20, textAlign: 'center' },

  // Switch row
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  switchTitle: { fontSize: 12.5, fontWeight: '700' },
  switchSub: { fontSize: 10.5, marginTop: 2 },

  // Sticky Action Footer
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnCancel: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
  },
  btnCancelText: { fontSize: 13, fontWeight: '700' },
  btnSave: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnSaveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Calendar Modal Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarTitle: { fontSize: 15, fontWeight: '800' },
  calendarNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 6,
  },
  calendarWeekText: { width: 38, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#64748B' },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDayCell: {
    width: 38,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  calendarDayCellSelected: {
    backgroundColor: '#0284C7',
  },
  calendarDayText: { fontSize: 12.5, fontWeight: '600' },
  calendarCloseBtn: {
    marginTop: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  calendarCloseBtnText: { color: '#0284C7', fontWeight: '700', fontSize: 13 },
});
