// AppointmentModals.tsx
// Tập hợp tất cả các Modal tương tác cho Lịch khám Bác sĩ:
// 1. AppointmentFormModal: Đặt lịch mới / Chỉnh sửa lịch khám chi tiết
// 2. AppointmentCancelModal: Hủy lịch hẹn kèm lý do & gợi ý nhanh
// 3. AppointmentCompleteModal: Xác nhận hoàn tất ca khám
// 4. AppointmentDetailModal: Chi tiết lịch hẹn khám khi nhấn vào Banner Trang chủ

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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { AppointmentItem, PatientCardData, getPatientAvatarUrl } from './types';

// =============================================================
// 1. MODAL ĐẶT / CHỈNH SỬA LỊCH KHÁM (FORM)
// =============================================================
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

const STANDARD_EXAM_TYPES = ['Khám định kỳ', 'Tái khám', 'Khám tổng quát', 'Xét nghiệm', 'Khác'];
const TIME_PICKER_SLOTS = [
  '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
];

const PopoverCard: React.FC<{
  visible: boolean;
  title: string;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}> = ({ visible, title, onClose, isDarkMode, colors, headerRight, children }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.popoverBackdrop} activeOpacity={1} onPress={onClose}>
      <View style={[styles.popoverCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]} onStartShouldSetResponder={() => true}>
        <View style={styles.popoverHeader}>
          <LocalizedText style={[styles.popoverTitle, { color: colors.textPrimary }]}>{title}</LocalizedText>
          {headerRight || (
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        {children}
      </View>
    </TouchableOpacity>
  </Modal>
);

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
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [showExamTypePicker, setShowExamTypePicker] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (scheduledAt) {
      const p = new Date(scheduledAt);
      if (!isNaN(p.getTime())) return p;
    }
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(8, 30, 0, 0);
    return t;
  });

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('08:30');
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());

  const syncScheduledAt = (date: Date, timeSlot: string) => {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const target = new Date(date);
    target.setHours(hours || 8, minutes || 30, 0, 0);
    setSelectedDate(target);
    setSelectedTimeSlot(timeSlot);
    onChangeScheduledAt(target.toISOString());
  };

  useEffect(() => {
    if (!visible) return;
    if (scheduledAt) {
      const p = new Date(scheduledAt);
      if (!isNaN(p.getTime())) {
        setSelectedDate(p);
        setCalendarViewDate(new Date(p.getFullYear(), p.getMonth(), 1));
        const time = `${String(p.getHours()).padStart(2, '0')}:${String(p.getMinutes()).padStart(2, '0')}`;
        setSelectedTimeSlot(time);
        setCustomTimeInput(time);
      }
    } else {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(8, 30, 0, 0);
      setSelectedDate(t);
      setCalendarViewDate(new Date(t.getFullYear(), t.getMonth(), 1));
      setSelectedTimeSlot('08:30');
      setCustomTimeInput('08:30');
      onChangeScheduledAt(t.toISOString());
    }

    if (patients?.length > 0 && (!patientId || !patients.some((p) => String(p.id) === String(patientId)))) {
      const defaultPat = patients[0];
      onSelectPatient ? onSelectPatient(defaultPat) : onChangePatientName(defaultPat.name);
      if (visitType === 'HOME_VISIT') {
        onChangeLocation(defaultPat.house_address ? `Tại nhà: ${defaultPat.house_address}` : 'Tại nhà bệnh nhân (Khám tại gia)');
      }
    }

    if (!examType) onChangeExamType('Khám định kỳ');
  }, [visible]);

  const selectedPatientObj = useMemo(
    () => patients.find((p) => String(p.id) === String(patientId)) || patients[0],
    [patients, patientId]
  );

  const formattedDateShort = useMemo(() => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return `${days[selectedDate.getDay()]}, ${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()}`;
  }, [selectedDate]);

  const isCustomExamType = useMemo(
    () => !['Khám định kỳ', 'Tái khám', 'Khám tổng quát', 'Xét nghiệm'].includes(examType),
    [examType]
  );

  const examTypeDisplay = useMemo(() => {
    if (['Khám định kỳ', 'Tái khám', 'Khám tổng quát', 'Xét nghiệm'].includes(examType)) return examType;
    return examType ? `Khác: ${examType}` : 'Chọn lý do khám';
  }, [examType]);

  const handleSelectModality = (modality: 'HOME_VISIT' | 'CLINIC') => {
    onChangeVisitType?.(modality);
    if (modality === 'HOME_VISIT') {
      const curPatient = patients.find((p) => String(p.id) === String(patientId));
      onChangeLocation(curPatient?.house_address ? `Tại nhà: ${curPatient.house_address}` : 'Tại nhà bệnh nhân (Khám tại gia)');
    } else {
      onChangeLocation('Phòng khám Bác sĩ Gia đình');
    }
  };

  const calendarDays = useMemo(() => {
    const y = calendarViewDate.getFullYear(), m = calendarViewDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay(), totalDays = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days: { date: Date; current: boolean; selected: boolean; past: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) {
      const d = new Date(y, m, -firstDay + i + 1);
      days.push({ date: d, current: false, selected: false, past: d < today });
    }
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(y, m, i);
      days.push({ date: d, current: true, selected: d.toDateString() === selectedDate.toDateString(), past: d < today });
    }
    return days;
  }, [calendarViewDate, selectedDate]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetOverlay}>
        <View style={[styles.sheetBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="calendar" size={18} color="#0284C7" />
              </View>
              <View>
                <LocalizedText style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  {isEditing ? 'Chỉnh Sửa Lịch Khám' : 'Đặt Lịch Tái Khám Mới'}
                </LocalizedText>
                <LocalizedText style={[styles.sheetSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Lập kế hoạch khám & gửi xác nhận tới người nhà
                </LocalizedText>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {/* 1. Chọn Bệnh nhân */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="person" size={15} color="#0284C7" />
                <LocalizedText style={styles.fieldLabelPrimary}>Chọn bệnh nhân (*)</LocalizedText>
              </View>
              {patients?.length > 0 ? (
                <TouchableOpacity
                  style={[styles.dropdownTrigger, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => setShowPatientPicker(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                    <View style={styles.patientAvatarMini}>
                      {selectedPatientObj?.avatar_url || (selectedPatientObj?.name && selectedPatientObj.name.includes('Nguyễn Văn A')) ? (
                        <Image
                          source={{
                            uri: getPatientAvatarUrl(
                              selectedPatientObj?.avatar_url || '/static/faces/fc51dc68-3ea2-4394-ac4b-906364ae425d.jpg'
                            )!,
                          }}
                          style={{ width: '100%', height: '100%', borderRadius: 13 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <LocalizedText style={styles.patientAvatarMiniText}>
                          {(selectedPatientObj?.name || patientName || 'C')[0]?.toUpperCase()}
                        </LocalizedText>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <LocalizedText style={[styles.dropdownValueText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {selectedPatientObj?.name || patientName || 'Chọn bệnh nhân'}
                      </LocalizedText>
                      <LocalizedText style={styles.dropdownSubText} numberOfLines={1}>
                        {selectedPatientObj?.age ? `${selectedPatientObj.age} tuổi` : 'Người cao tuổi'}
                        {selectedPatientObj?.house_address ? ` • ${selectedPatientObj.house_address}` : ''}
                      </LocalizedText>
                    </View>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
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

            {/* 2. Chọn Thời gian: [Ngày khám] và [Giờ khám] */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time" size={15} color="#0284C7" />
                <LocalizedText style={styles.fieldLabelPrimary}>Thời gian tái khám (*)</LocalizedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.dateTimeInputBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => setShowDatePickerModal(true)}
                >
                  <Ionicons name="calendar-outline" size={17} color="#0284C7" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <LocalizedText style={styles.inputMiniLabel}>Ngày khám</LocalizedText>
                    <LocalizedText style={[styles.dateTimeValueText, { color: colors.textPrimary }]}>{formattedDateShort}</LocalizedText>
                  </View>
                  <Ionicons name="chevron-down" size={15} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateTimeInputBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => setShowTimePickerModal(true)}
                >
                  <Ionicons name="time-outline" size={17} color="#0284C7" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <LocalizedText style={styles.inputMiniLabel}>Giờ khám</LocalizedText>
                    <LocalizedText style={[styles.dateTimeValueText, { color: colors.textPrimary }]}>{selectedTimeSlot}</LocalizedText>
                  </View>
                  <Ionicons name="chevron-down" size={15} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Hình thức khám & Địa điểm khám */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="medical" size={15} color="#0284C7" />
                <LocalizedText style={styles.fieldLabelPrimary}>Hình thức & Địa điểm (*)</LocalizedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { key: 'HOME_VISIT', label: 'Ở nhà bệnh nhân', icon: 'home' },
                  { key: 'CLINIC', label: 'Phòng khám bác sĩ', icon: 'business' },
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
                      <Ionicons name={item.icon as any} size={15} color={isModActive ? '#FFFFFF' : colors.textPrimary} style={{ marginRight: 6 }} />
                      <LocalizedText style={{ color: isModActive ? '#FFFFFF' : colors.textPrimary, fontSize: 11.5, fontWeight: isModActive ? '700' : '600' }}>
                        {item.label}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <LocalizedTextInput
                style={[styles.inputField, { marginTop: 8, color: colors.textPrimary, borderColor: colors.border }]}
                value={location}
                onChangeText={onChangeLocation}
                placeholder="Địa chỉ nhà cụ hoặc phòng khám..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 4. Chuyên khoa / Lý do khám */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="clipboard" size={15} color="#0284C7" />
                <LocalizedText style={styles.fieldLabelPrimary}>Chuyên khoa / Lý do khám (*)</LocalizedText>
              </View>
              <TouchableOpacity
                style={[styles.dropdownTrigger, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => setShowExamTypePicker(true)}
              >
                <LocalizedText style={[styles.dropdownValueText, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                  {examTypeDisplay}
                </LocalizedText>
                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
              </TouchableOpacity>
              {(isCustomExamType || examType === 'Khác') && (
                <LocalizedTextInput
                  style={[styles.inputField, { marginTop: 8, color: colors.textPrimary, borderColor: colors.border }]}
                  value={examType === 'Khác' ? '' : examType}
                  onChangeText={onChangeExamType}
                  placeholder="Nhập lý do / chuyên khoa khám cụ thể..."
                  placeholderTextColor="#94A3B8"
                />
              )}
            </View>

            {/* 5. Dặn dò chuẩn bị */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="chatbubble-ellipses" size={15} color="#0284C7" />
                <LocalizedText style={styles.fieldLabelPrimary}>Dặn dò chuẩn bị trước khám</LocalizedText>
              </View>
              <LocalizedTextInput
                style={[styles.inputField, { height: 52, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
                multiline
                value={instructions}
                onChangeText={onChangeInstructions}
                placeholder="Nhập lời dặn của bác sĩ nếu có..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 6. Accordion: ⚙️ Tuỳ chọn nâng cao */}
            <View style={{ marginTop: 4, marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.accordionHeader, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
              >
                <LocalizedText style={[styles.accordionTitle, { color: colors.textPrimary }]}>⚙️ Tuỳ chọn nâng cao</LocalizedText>
                <Ionicons name={isAdvancedOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
              </TouchableOpacity>

              {isAdvancedOpen && (
                <View style={[styles.accordionContent, { borderColor: colors.border, backgroundColor: isDarkMode ? '#0F1E33' : '#F8FAFC' }]}>
                  {!isEditing && (
                    <View style={{ marginBottom: 12 }}>
                      <LocalizedText style={[styles.subFieldLabel, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                        Lịch khám định kỳ (Chu kỳ lặp):
                      </LocalizedText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
                                  : { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
                              ]}
                              onPress={() => onChangeRecurrencePattern?.(item.key as any)}
                            >
                              <LocalizedText style={{ fontSize: 11, color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: isSelected ? '700' : '500' }}>
                                {item.label}
                              </LocalizedText>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {recurrencePattern !== 'NONE' && (
                        <View style={[styles.occurrencesBox, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
                          <LocalizedText style={[styles.occurrencesLabel, { color: isDarkMode ? '#CBD5E1' : '#1E293B' }]}>
                            Số đợt khám định kỳ tự động:
                          </LocalizedText>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity style={styles.stepperBtn} onPress={() => onChangeRecurrenceOccurrences?.(Math.max(1, recurrenceOccurrences - 1))}>
                              <Ionicons name="remove" size={16} color="#0284C7" />
                            </TouchableOpacity>
                            <LocalizedText style={[styles.stepperValue, { color: colors.textPrimary }]}>{recurrenceOccurrences}</LocalizedText>
                            <TouchableOpacity style={styles.stepperBtn} onPress={() => onChangeRecurrenceOccurrences?.(Math.min(12, recurrenceOccurrences + 1))}>
                              <Ionicons name="add" size={16} color="#0284C7" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="volume-high" size={16} color="#0284C7" />
                        <LocalizedText style={[styles.switchTitle, { color: colors.textPrimary }]}>Phát loa thông minh Hub AI</LocalizedText>
                      </View>
                      <LocalizedText style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Tự động phát giọng nói nhắc nhở tại nhà bệnh nhân trước giờ khám 24h & 2h
                      </LocalizedText>
                    </View>
                    <Switch value={enableSpeaker} onValueChange={onToggleEnableSpeaker} trackColor={{ false: '#CBD5E1', true: '#0284C7' }} thumbColor="#FFFFFF" />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.modalFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <TouchableOpacity style={[styles.btnAction, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
              <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Hủy</LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSavePrimary} onPress={onSave} disabled={isSubmitting} activeOpacity={0.85}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                  <LocalizedText style={styles.btnSavePrimaryText}>{isEditing ? 'Cập nhật lịch khám' : 'Xác nhận tạo lịch'}</LocalizedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* POPOVER 1: Chọn Bệnh Nhân */}
      <PopoverCard visible={showPatientPicker} title="Chọn Bệnh Nhân" onClose={() => setShowPatientPicker(false)} isDarkMode={isDarkMode} colors={colors}>
        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
          {patients.map((pat) => {
            const isSelected = String(pat.id) === String(patientId);
            return (
              <TouchableOpacity
                key={String(pat.id)}
                style={[styles.popoverOptionRow, { backgroundColor: isSelected ? (isDarkMode ? '#0F2942' : '#F0F9FF') : 'transparent' }]}
                onPress={() => {
                  onSelectPatient ? onSelectPatient(pat) : onChangePatientName(pat.name);
                  if (visitType === 'HOME_VISIT') {
                    onChangeLocation(pat.house_address ? `Tại nhà: ${pat.house_address}` : 'Tại nhà bệnh nhân (Khám tại gia)');
                  }
                  setShowPatientPicker(false);
                }}
              >
                <View style={[styles.patientAvatarMini, { backgroundColor: isSelected ? '#0284C7' : '#94A3B8' }]}>
                  {pat.avatar_url ? (
                    <Image
                      source={{ uri: getPatientAvatarUrl(pat.avatar_url)! }}
                      style={{ width: '100%', height: '100%', borderRadius: 13 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <LocalizedText style={styles.patientAvatarMiniText}>{(pat.name || 'C')[0]?.toUpperCase()}</LocalizedText>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <LocalizedText style={{ fontSize: 12.5, color: isSelected ? '#0284C7' : colors.textPrimary, fontWeight: isSelected ? '700' : '500' }}>
                    {pat.name}
                  </LocalizedText>
                  <LocalizedText style={styles.dropdownSubText}>
                    {pat.age ? `${pat.age} tuổi` : 'Người cao tuổi'}{pat.house_address ? ` • ${pat.house_address}` : ''}
                  </LocalizedText>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={18} color="#0284C7" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </PopoverCard>

      {/* POPOVER 2: Chọn Ngày Khám */}
      <PopoverCard
        visible={showDatePickerModal}
        title={`Tháng ${calendarViewDate.getMonth() + 1}/${calendarViewDate.getFullYear()}`}
        onClose={() => setShowDatePickerModal(false)}
        isDarkMode={isDarkMode}
        colors={colors}
        headerRight={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.calendarNavBtn} onPress={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={18} color="#0284C7" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.calendarNavBtn} onPress={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={18} color="#0284C7" />
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.calendarWeekRow}>
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
            <LocalizedText key={d} style={styles.calendarWeekText}>{d}</LocalizedText>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {calendarDays.map((dayItem, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.calendarCell, dayItem.selected && { backgroundColor: '#0284C7' }]}
              disabled={!dayItem.current || dayItem.past}
              onPress={() => {
                syncScheduledAt(dayItem.date, selectedTimeSlot);
                setShowDatePickerModal(false);
              }}
            >
              <LocalizedText
                style={{
                  fontSize: 12,
                  color: !dayItem.current ? '#CBD5E1' : dayItem.past ? '#94A3B8' : dayItem.selected ? '#FFFFFF' : colors.textPrimary,
                  fontWeight: dayItem.selected ? '800' : '600',
                }}
              >
                {dayItem.date.getDate()}
              </LocalizedText>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.calendarCloseBtn} onPress={() => setShowDatePickerModal(false)}>
          <LocalizedText style={{ color: '#0284C7', fontWeight: '700', fontSize: 12 }}>Đóng</LocalizedText>
        </TouchableOpacity>
      </PopoverCard>

      {/* POPOVER 3: Chọn Giờ Khám */}
      <PopoverCard visible={showTimePickerModal} title="Chọn Giờ Khám" onClose={() => setShowTimePickerModal(false)} isDarkMode={isDarkMode} colors={colors}>
        <View style={styles.timeSlotGrid}>
          {TIME_PICKER_SLOTS.map((slot) => {
            const isSelected = selectedTimeSlot === slot;
            return (
              <TouchableOpacity
                key={slot}
                style={[
                  styles.timeSlotBtn,
                  isSelected ? { backgroundColor: '#0284C7', borderColor: '#0284C7' } : { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border },
                ]}
                onPress={() => {
                  syncScheduledAt(selectedDate, slot);
                  setCustomTimeInput(slot);
                  setShowTimePickerModal(false);
                }}
              >
                <LocalizedText style={{ fontSize: 11.5, color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: isSelected ? '700' : '500' }}>
                  {slot}
                </LocalizedText>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.customTimeRow, { borderTopColor: colors.border }]}>
          <LocalizedTextInput
            style={[styles.inputField, { flex: 1, paddingVertical: 6, fontSize: 12, color: colors.textPrimary, borderColor: colors.border }]}
            value={customTimeInput}
            onChangeText={setCustomTimeInput}
            placeholder="HH:mm (vd: 08:15)"
            placeholderTextColor="#94A3B8"
            maxLength={5}
          />
          <TouchableOpacity
            style={styles.btnConfirmSmall}
            onPress={() => {
              if (customTimeInput.trim()) syncScheduledAt(selectedDate, customTimeInput.trim());
              setShowTimePickerModal(false);
            }}
          >
            <LocalizedText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Xác nhận</LocalizedText>
          </TouchableOpacity>
        </View>
      </PopoverCard>

      {/* POPOVER 4: Chọn Chuyên Khoa */}
      <PopoverCard visible={showExamTypePicker} title="Chuyên Khoa / Lý Do Khám" onClose={() => setShowExamTypePicker(false)} isDarkMode={isDarkMode} colors={colors}>
        {STANDARD_EXAM_TYPES.map((type) => {
          const isSelected = type === 'Khác' ? isCustomExamType : examType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.popoverOptionRow, { backgroundColor: isSelected ? (isDarkMode ? '#0F2942' : '#F0F9FF') : 'transparent' }]}
              onPress={() => {
                onChangeExamType(type === 'Khác' ? (isCustomExamType && examType !== 'Khác' ? examType : 'Khác') : type);
                setShowExamTypePicker(false);
              }}
            >
              <LocalizedText style={{ fontSize: 12.5, color: isSelected ? '#0284C7' : colors.textPrimary, fontWeight: isSelected ? '700' : '500', flex: 1 }}>
                {type}
              </LocalizedText>
              {isSelected && <Ionicons name="checkmark-circle" size={18} color="#0284C7" />}
            </TouchableOpacity>
          );
        })}
      </PopoverCard>
    </Modal>
  );
};

// =============================================================
// 2. MODAL HỦY LỊCH HẸN KHÁM
// =============================================================
export interface AppointmentCancelModalProps {
  visible: boolean;
  appointment: AppointmentItem | null;
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentCancelModal: React.FC<AppointmentCancelModalProps> = ({
  visible,
  appointment,
  isSubmitting,
  onConfirm,
  onClose,
  isDarkMode,
  colors,
}) => {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErrorMsg('Vui lòng nhập lý do hủy lịch khám (tối thiểu 3 ký tự).');
      return;
    }
    setErrorMsg('');
    onConfirm(trimmed);
  };

  const handleClose = () => {
    setReason('');
    setErrorMsg('');
    onClose();
  };

  if (!appointment) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.dialogHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </View>
              <LocalizedText style={[styles.dialogTitle, { color: colors.textPrimary }]}>Hủy Lịch Hẹn Khám</LocalizedText>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC', borderColor: colors.border }]}>
            <LocalizedText style={[styles.infoPatient, { color: colors.textPrimary }]}>{appointment.patient_name}</LocalizedText>
            <LocalizedText style={[styles.infoTime, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              📅 {appointment.scheduled_at} • 🩺 {appointment.exam_type || appointment.visit_type || 'Khám bệnh'}
            </LocalizedText>
          </View>

          <LocalizedText style={styles.fieldLabelPrimary}>Lý do hủy lịch (*) :</LocalizedText>
          <LocalizedTextInput
            style={[
              styles.inputReason,
              { color: colors.textPrimary, borderColor: errorMsg ? '#EF4444' : colors.border, backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' },
            ]}
            multiline
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="VD: Bệnh nhân có việc gia đình đột xuất / Đã nhập viện điều trị..."
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.quickSuggestionsRow}>
            {['Bệnh nhân có việc đột xuất', 'Bác sĩ có ca mổ khẩn cấp', 'Chuyển viện điều trị chuyên khoa', 'Sức khỏe ổn định, hoãn tái khám'].map((sug) => (
              <TouchableOpacity
                key={sug}
                style={[
                  styles.quickPill,
                  { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: reason === sug ? '#EF4444' : isDarkMode ? '#475569' : '#CBD5E1' },
                ]}
                onPress={() => {
                  setReason(sug);
                  if (errorMsg) setErrorMsg('');
                }}
              >
                <LocalizedText style={{ fontSize: 11, fontWeight: '500', color: reason === sug ? '#DC2626' : isDarkMode ? '#CBD5E1' : '#475569' }}>
                  {sug}
                </LocalizedText>
              </TouchableOpacity>
            ))}
          </View>

          {errorMsg ? <LocalizedText style={styles.errorText}>{errorMsg}</LocalizedText> : null}

          <LocalizedText style={[styles.noticeText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            ℹ️ Việc hủy lịch sẽ tự động hủy các chuông/thông báo nhắc nhở đã lên lịch cho người nhà bệnh nhân.
          </LocalizedText>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity style={[styles.btnAction, { flex: 1, borderColor: colors.border }]} onPress={handleClose} disabled={isSubmitting}>
              <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Quay lại</LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnDangerConfirm} onPress={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <LocalizedText style={styles.btnWhiteText}>Xác nhận hủy</LocalizedText>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// =============================================================
// 3. MODAL XÁC NHẬN ĐÃ KHÁM XONG
// =============================================================
export interface AppointmentCompleteModalProps {
  visible: boolean;
  appointment: AppointmentItem | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentCompleteModal: React.FC<AppointmentCompleteModalProps> = ({
  visible,
  appointment,
  isSubmitting,
  onConfirm,
  onClose,
  isDarkMode,
  colors,
}) => {
  if (!appointment) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.dialogHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
              </View>
              <LocalizedText style={[styles.dialogTitle, { color: colors.textPrimary }]}>Xác Nhận Đã Khám Xong</LocalizedText>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC', borderColor: colors.border }]}>
            <LocalizedText style={[styles.infoPatient, { color: colors.textPrimary }]}>{appointment.patient_name}</LocalizedText>
            <LocalizedText style={[styles.infoTime, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>📅 Thời gian: {appointment.scheduled_at}</LocalizedText>
            <LocalizedText style={[styles.infoTime, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              🩺 Chuyên khoa: {appointment.exam_type || appointment.visit_type || 'Khám bệnh'}
            </LocalizedText>
            {appointment.location ? (
              <LocalizedText style={[styles.infoTime, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>📍 Địa điểm: {appointment.location}</LocalizedText>
            ) : null}
          </View>

          <LocalizedText style={[styles.confirmPrompt, { color: colors.textPrimary }]}>Bác sĩ xác nhận đã hoàn tất khám cho bệnh nhân?</LocalizedText>
          <LocalizedText style={[styles.confirmDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Trạng thái lịch hẹn sẽ được chuyển sang "ĐÃ KHÁM XONG" và đóng tất lại nhắc nhở.
          </LocalizedText>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity style={[styles.btnAction, { flex: 1, borderColor: colors.border }]} onPress={onClose} disabled={isSubmitting}>
              <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Quay lại</LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSuccessConfirm} onPress={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <LocalizedText style={styles.btnWhiteText}>Xác nhận hoàn tất</LocalizedText>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// =============================================================
// 4. MODAL CHI TIẾT LỊCH HẸN KHÁM (BANNER TRANG CHỦ)
// =============================================================
export interface AppointmentDetailModalProps {
  visible: boolean;
  appointment: AppointmentItem | null;
  patientInfo?: PatientCardData | null;
  onClose: () => void;
  onReschedule: () => void;
  onStartExam: (patientId: string) => void;
  formatAptTime: (dateStr?: string) => string;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  visible,
  appointment,
  patientInfo,
  onClose,
  onReschedule,
  onStartExam,
  formatAptTime,
  isDarkMode,
  colors,
}) => {
  if (!appointment) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <View style={[styles.detailCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.dialogHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="calendar" size={18} color="#2563EB" />
              </View>
              <LocalizedText style={[styles.dialogTitle, { color: colors.textPrimary }]}>Chi tiết lịch hẹn khám</LocalizedText>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 12, marginBottom: 18 }}>
            {[
              {
                icon: 'person-outline',
                label: 'Bệnh nhân:',
                val: `${appointment.patient_name || 'Bệnh nhân'}${patientInfo ? ` (${patientInfo.age ? `${patientInfo.age} tuổi` : ''}${patientInfo.gender ? ` • ${patientInfo.gender}` : ''})` : ''}`,
              },
              {
                icon: 'time-outline',
                label: 'Thời gian & Hình thức:',
                val: `Hôm nay, ${formatAptTime(appointment.scheduled_at)} • ${appointment.visit_type === 'CLINIC' ? 'Tại phòng khám' : 'Khám tại nhà'}`,
              },
              {
                icon: 'location-outline',
                label: 'Địa chỉ khám:',
                val: appointment.location || patientInfo?.house_address || 'Nhà riêng bệnh nhân',
              },
              {
                icon: 'call-outline',
                label: 'Số điện thoại người nhà:',
                val: patientInfo?.emergency_contact_phone || 'Chưa cập nhật',
                isPhone: true,
              },
              {
                icon: 'document-text-outline',
                label: 'Dặn dò y tế / Ghi chú:',
                val: appointment.instructions || appointment.clinical_notes || 'Khám sức khỏe định kỳ.',
              },
            ].map((row, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons name={row.icon as any} size={18} color="#2563EB" style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <LocalizedText style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#94A3B8' : '#64748B' }}>{row.label}</LocalizedText>
                  <LocalizedText style={[styles.infoPatient, { color: row.isPhone ? '#2563EB' : colors.textPrimary }]}>{row.val}</LocalizedText>
                </View>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity style={[styles.btnAction, { flex: 1, borderColor: colors.border }]} activeOpacity={0.8} onPress={onReschedule}>
              <Ionicons name="calendar-outline" size={16} color={isDarkMode ? '#E2E8F0' : '#475569'} style={{ marginRight: 4 }} />
              <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#E2E8F0' : '#475569' }]}>Đổi lịch</LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnDangerConfirm, { backgroundColor: '#2563EB' }]}
              activeOpacity={0.85}
              onPress={() => onStartExam(appointment.patient_id)}
            >
              <Ionicons name="medkit" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <LocalizedText style={styles.btnWhiteText}>Bắt đầu khám</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  /* Bottom Sheet Overlay & Box */
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheetBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingTop: 16, elevation: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  sheetSubtitle: { fontSize: 11, marginTop: 1 },
  scrollBody: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 },
  sectionBlock: { marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  fieldLabelPrimary: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  subFieldLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: 6 },
  inputField: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  dropdownValueText: { fontSize: 13, fontWeight: '600' },
  dropdownSubText: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  patientAvatarMini: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0284C7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  patientAvatarMiniText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  dateTimeInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  inputMiniLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  dateTimeValueText: { fontSize: 12.5, fontWeight: '700', marginTop: 1 },
  modalityPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10 },
  accordionTitle: { fontSize: 12.5, fontWeight: '700' },
  accordionContent: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, padding: 12, marginTop: -1 },
  recurrenceOptionPill: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  occurrencesBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 8, marginTop: 8 },
  occurrencesLabel: { fontSize: 11.5, fontWeight: '600' },
  stepperBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  stepperValue: { fontSize: 13, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  switchTitle: { fontSize: 12, fontWeight: '700' },
  switchSub: { fontSize: 10.5, marginTop: 1 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 18, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  btnAction: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnActionText: { fontSize: 12.5, fontWeight: '700' },
  btnSavePrimary: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: '#0284C7', flexDirection: 'row', alignItems: 'center' },
  btnSavePrimaryText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  /* Dialog (Cancel, Complete, Detail) */
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  dialogBox: { borderRadius: 14, padding: 18, elevation: 4 },
  dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dialogTitle: { fontSize: 16, fontWeight: '700' },
  infoCard: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 14 },
  infoPatient: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoTime: { fontSize: 12, marginTop: 2 },
  inputReason: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 70, textAlignVertical: 'top', marginBottom: 8 },
  quickSuggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  quickPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  errorText: { fontSize: 11, color: '#EF4444', marginBottom: 8 },
  noticeText: { fontSize: 11, lineHeight: 16, marginBottom: 14 },
  confirmPrompt: { fontSize: 14, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  confirmDesc: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  btnDangerConfirm: { flex: 1, backgroundColor: '#DC2626', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnSuccessConfirm: { flex: 1, backgroundColor: '#059669', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnWhiteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  detailCard: { width: '100%', borderRadius: 20, padding: 20, borderWidth: 1, elevation: 8 },

  /* Popover styles */
  popoverBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  popoverCard: { width: '100%', maxWidth: 320, borderRadius: 14, padding: 16, elevation: 8 },
  popoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1', marginBottom: 8 },
  popoverTitle: { fontSize: 14.5, fontWeight: '800' },
  popoverOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 6, borderRadius: 8 },
  timeSlotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', paddingVertical: 6 },
  timeSlotBtn: { width: '22%', borderWidth: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  customTimeRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  btnConfirmSmall: { backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7 },
  calendarNavBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1', paddingBottom: 4 },
  calendarWeekText: { width: 36, textAlign: 'center', fontSize: 10.5, fontWeight: '700', color: '#64748B' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  calendarCell: { width: 36, height: 34, justifyContent: 'center', alignItems: 'center', borderRadius: 7, marginVertical: 2 },
  calendarCloseBtn: { marginTop: 10, backgroundColor: '#F1F5F9', borderRadius: 7, paddingVertical: 7, alignItems: 'center' },
});
