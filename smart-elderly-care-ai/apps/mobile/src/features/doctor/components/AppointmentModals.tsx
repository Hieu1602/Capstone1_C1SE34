// AppointmentModals.tsx
// Tập hợp tất cả các Modal tương tác cho Lịch khám Bác sĩ:
// 1. AppointmentFormModal: Đặt lịch mới / Chỉnh sửa lịch khám chi tiết
// 2. AppointmentCancelModal: Hủy lịch hẹn kèm lý do & gợi ý nhanh
// 3. AppointmentCompleteModal: Xác nhận hoàn tất ca khám
// 4. AppointmentDetailModal: Chi tiết lịch hẹn khám khi nhấn vào Banner Trang chủ

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Switch, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { AppointmentItem, PatientCardData, getPatientAvatarUrl } from './types';

const pad2 = (n: number) => String(n).padStart(2, '0');
const DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const STANDARD_EXAM_TYPES = ['Khám định kỳ', 'Tái khám', 'Khám tổng quát', 'Xét nghiệm', 'Khác'];
const TIME_PICKER_SLOTS = [
  '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
];

const formatModalDateTime = (dateStr?: string) => {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${time} - ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatModalExamType = (type?: string) =>
  !type ? 'Khám sức khỏe định kỳ' : type === 'CLINIC' ? 'Khám tại phòng khám' : type === 'HOME_VISIT' ? 'Khám bệnh tại nhà' : type;

const maskPhoneNumber = (phone?: string) => {
  const clean = phone?.trim() || '';
  return !clean ? 'Đã bảo mật' : clean.length <= 4 ? '***' : `${clean.slice(0, 3)}****${clean.slice(-3)}`;
};

const getDefaultScheduledDate = (scheduledAt?: string) => {
  if (scheduledAt && !isNaN(new Date(scheduledAt).getTime())) return new Date(scheduledAt);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(8, 30, 0, 0);
  return t;
};

interface ThemeProps { isDarkMode: boolean; colors: any; }

// =============================================================
// SHARED MINI HELPERS
// =============================================================
const SectionTitle: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <View style={styles.sectionHeaderRow}>
    <Ionicons name={icon as any} size={15} color="#0284C7" />
    <LocalizedText style={styles.fieldLabelPrimary}>{label}</LocalizedText>
  </View>
);

const PatientAvatarMini: React.FC<{ pat?: any; fallbackName?: string; bg?: string }> = ({ pat, fallbackName, bg = '#0284C7' }) => {
  const rawAvatar = pat?.avatar_url || (pat?.name?.includes('Nguyễn Văn A') ? '/static/faces/fc51dc68-3ea2-4394-ac4b-906364ae425d.jpg' : undefined);
  return (
    <View style={[styles.patientAvatarMini, { backgroundColor: bg }]}>
      {rawAvatar ? (
        <Image source={{ uri: getPatientAvatarUrl(rawAvatar)! }} style={styles.avatarFull} resizeMode="cover" />
      ) : (
        <LocalizedText style={styles.patientAvatarMiniText}>{(pat?.name || fallbackName || 'C')[0]?.toUpperCase()}</LocalizedText>
      )}
    </View>
  );
};

const PopoverCard: React.FC<ThemeProps & {
  visible: boolean; title: string; onClose: () => void;
  headerRight?: React.ReactNode; children: React.ReactNode;
}> = ({ visible, title, onClose, isDarkMode, colors, headerRight, children }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.popoverBackdrop} activeOpacity={1} onPress={onClose}>
      <View style={[styles.popoverCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]} onStartShouldSetResponder={() => true}>
        <View style={styles.popoverHeader}>
          <LocalizedText style={[styles.popoverTitle, { color: colors.textPrimary }]}>{title}</LocalizedText>
          {headerRight || (
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        {children}
      </View>
    </TouchableOpacity>
  </Modal>
);

const DialogModal: React.FC<ThemeProps & {
  visible: boolean; onClose: () => void; icon: string; iconBg: string;
  iconColor: string; title: string; cardStyle?: any; children: React.ReactNode;
}> = ({ visible, onClose, icon, iconBg, iconColor, title, isDarkMode, colors, cardStyle, children }) => (
  <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dialogOverlay}>
      <View style={[cardStyle || styles.dialogBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.dialogHeader}>
          <View style={styles.rowCenter}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name={icon as any} size={20} color={iconColor} />
            </View>
            <LocalizedText style={[styles.dialogTitle, { color: colors.textPrimary }]}>{title}</LocalizedText>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// =============================================================
// 1. MODAL ĐẶT / CHỈNH SỬA LỊCH KHÁM (FORM)
// =============================================================
export interface AppointmentFormModalProps extends ThemeProps {
  visible: boolean; isEditing: boolean; patients?: any[];
  patientId: string; patientName: string; scheduledAt: string;
  examType: string; visitType?: 'HOME_VISIT' | 'CLINIC';
  location: string; instructions: string; enableSpeaker: boolean;
  recurrencePattern?: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  recurrenceOccurrences?: number; isSubmitting: boolean;
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
  onSave: () => void; onClose: () => void;
}

export const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({
  visible, isEditing, patients = [], patientId, patientName, scheduledAt,
  examType, visitType = 'HOME_VISIT', location, instructions, enableSpeaker,
  recurrencePattern = 'NONE', recurrenceOccurrences = 1, isSubmitting,
  onSelectPatient, onChangePatientName, onChangeScheduledAt, onChangeExamType,
  onChangeVisitType, onChangeLocation, onChangeInstructions, onToggleEnableSpeaker,
  onChangeRecurrencePattern, onChangeRecurrenceOccurrences, onSave, onClose, isDarkMode, colors,
}) => {
  const insets = useSafeAreaInsets();
  const [activePopover, setActivePopover] = useState<'NONE' | 'PATIENT' | 'DATE' | 'TIME' | 'EXAM'>('NONE');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('08:30');
  const [selectedDate, setSelectedDate] = useState<Date>(() => getDefaultScheduledDate(scheduledAt));
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

  const applyHomeLocation = (pat?: any) =>
    onChangeLocation(pat?.house_address ? `Tại nhà: ${pat.house_address}` : 'Tại nhà bệnh nhân (Khám tại gia)');

  useEffect(() => {
    if (!visible) return;
    const d = getDefaultScheduledDate(scheduledAt);
    const time = scheduledAt && !isNaN(new Date(scheduledAt).getTime()) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '08:30';
    setSelectedDate(d);
    setCalendarViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedTimeSlot(time);
    setCustomTimeInput(time);
    if (!scheduledAt) onChangeScheduledAt(d.toISOString());

    if (patients?.length > 0 && (!patientId || !patients.some((p) => String(p.id) === String(patientId)))) {
      const defaultPat = patients[0];
      onSelectPatient ? onSelectPatient(defaultPat) : onChangePatientName(defaultPat.name);
      if (visitType === 'HOME_VISIT') applyHomeLocation(defaultPat);
    }
    if (!examType) onChangeExamType('Khám định kỳ');
  }, [visible]);

  const selectedPatientObj = useMemo(() => patients.find((p) => String(p.id) === String(patientId)) || patients[0], [patients, patientId]);
  const formattedDateShort = `${DAYS_SHORT[selectedDate.getDay()]}, ${pad2(selectedDate.getDate())}/${pad2(selectedDate.getMonth() + 1)}/${selectedDate.getFullYear()}`;
  const isStandardExam = STANDARD_EXAM_TYPES.slice(0, 4).includes(examType);
  const isCustomExamType = !isStandardExam;
  const examTypeDisplay = isStandardExam ? examType : (examType ? `Khác: ${examType}` : 'Chọn lý do khám');

  const calendarDays = useMemo(() => {
    const y = calendarViewDate.getFullYear(), m = calendarViewDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay(), totalDays = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: firstDay + totalDays }, (_, idx) => {
      const dayNum = idx < firstDay ? -firstDay + idx + 1 : idx - firstDay + 1;
      const d = new Date(y, m, dayNum);
      return { date: d, current: idx >= firstDay, selected: idx >= firstDay && d.toDateString() === selectedDate.toDateString(), past: d < today };
    });
  }, [calendarViewDate, selectedDate]);

  const fieldBg = isDarkMode ? '#0F172A' : '#F8FAFC';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetOverlay}>
        <View style={[styles.sheetBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.rowCenter, { gap: 8 }]}>
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
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {/* 1. Chọn Bệnh nhân */}
            <View style={styles.sectionBlock}>
              <SectionTitle icon="person" label="Chọn bệnh nhân (*)" />
              {patients?.length > 0 ? (
                <TouchableOpacity style={[styles.dropdownTrigger, { backgroundColor: fieldBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => setActivePopover('PATIENT')}>
                  <View style={[styles.rowCenter, { flex: 1, gap: 10 }]}>
                    <PatientAvatarMini pat={selectedPatientObj} fallbackName={patientName} />
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
                <LocalizedTextInput style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]} value={patientName} onChangeText={onChangePatientName} placeholder="Nhập tên bệnh nhân" placeholderTextColor="#94A3B8" />
              )}
            </View>

            {/* 2. Chọn Thời gian */}
            <View style={styles.sectionBlock}>
              <SectionTitle icon="time" label="Thời gian tái khám (*)" />
              <View style={styles.rowGap10}>
                {[
                  { icon: 'calendar-outline', label: 'Ngày khám', val: formattedDateShort, pop: 'DATE' as const },
                  { icon: 'time-outline', label: 'Giờ khám', val: selectedTimeSlot, pop: 'TIME' as const },
                ].map((box) => (
                  <TouchableOpacity key={box.label} style={[styles.dateTimeInputBox, { backgroundColor: fieldBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => setActivePopover(box.pop)}>
                    <Ionicons name={box.icon as any} size={17} color="#0284C7" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <LocalizedText style={styles.inputMiniLabel}>{box.label}</LocalizedText>
                      <LocalizedText style={[styles.dateTimeValueText, { color: colors.textPrimary }]}>{box.val}</LocalizedText>
                    </View>
                    <Ionicons name="chevron-down" size={15} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 3. Hình thức khám & Địa điểm */}
            <View style={styles.sectionBlock}>
              <SectionTitle icon="medical" label="Hình thức & Địa điểm (*)" />
              <View style={styles.rowGap10}>
                {[
                  { key: 'HOME_VISIT' as const, label: 'Ở nhà bệnh nhân', icon: 'home' },
                  { key: 'CLINIC' as const, label: 'Phòng khám bác sĩ', icon: 'business' },
                ].map((item) => {
                  const active = visitType === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.modalityPill, active ? styles.activePill : { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: colors.border }]}
                      onPress={() => {
                        onChangeVisitType?.(item.key);
                        item.key === 'HOME_VISIT' ? applyHomeLocation(selectedPatientObj) : onChangeLocation('Phòng khám Bác sĩ Gia đình');
                      }}
                    >
                      <Ionicons name={item.icon as any} size={15} color={active ? '#FFFFFF' : colors.textPrimary} style={{ marginRight: 6 }} />
                      <LocalizedText style={{ color: active ? '#FFFFFF' : colors.textPrimary, fontSize: 11.5, fontWeight: active ? '700' : '600' }}>{item.label}</LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <LocalizedTextInput style={[styles.inputField, { marginTop: 8, color: colors.textPrimary, borderColor: colors.border }]} value={location} onChangeText={onChangeLocation} placeholder="Địa chỉ nhà cụ hoặc phòng khám..." placeholderTextColor="#94A3B8" />
            </View>

            {/* 4. Chuyên khoa / Lý do khám */}
            <View style={styles.sectionBlock}>
              <SectionTitle icon="clipboard" label="Chuyên khoa / Lý do khám (*)" />
              <TouchableOpacity style={[styles.dropdownTrigger, { backgroundColor: fieldBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => setActivePopover('EXAM')}>
                <LocalizedText style={[styles.dropdownValueText, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{examTypeDisplay}</LocalizedText>
                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
              </TouchableOpacity>
              {(isCustomExamType || examType === 'Khác') && (
                <LocalizedTextInput style={[styles.inputField, { marginTop: 8, color: colors.textPrimary, borderColor: colors.border }]} value={examType === 'Khác' ? '' : examType} onChangeText={onChangeExamType} placeholder="Nhập lý do / chuyên khoa khám cụ thể..." placeholderTextColor="#94A3B8" />
              )}
            </View>

            {/* 5. Dặn dò chuẩn bị */}
            <View style={styles.sectionBlock}>
              <SectionTitle icon="chatbubble-ellipses" label="Dặn dò chuẩn bị trước khám" />
              <LocalizedTextInput style={[styles.inputField, { height: 52, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]} multiline value={instructions} onChangeText={onChangeInstructions} placeholder="Nhập lời dặn của bác sĩ nếu có..." placeholderTextColor="#94A3B8" />
            </View>

            {/* 6. Accordion: Tuỳ chọn nâng cao */}
            <View style={{ marginTop: 4, marginBottom: 8 }}>
              <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: fieldBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}>
                <LocalizedText style={[styles.accordionTitle, { color: colors.textPrimary }]}>⚙️ Tuỳ chọn nâng cao</LocalizedText>
                <Ionicons name={isAdvancedOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
              </TouchableOpacity>

              {isAdvancedOpen && (
                <View style={[styles.accordionContent, { borderColor: colors.border, backgroundColor: isDarkMode ? '#0F1E33' : '#F8FAFC' }]}>
                  {!isEditing && (
                    <View style={{ marginBottom: 12 }}>
                      <LocalizedText style={[styles.subFieldLabel, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>Lịch khám định kỳ (Chu kỳ lặp):</LocalizedText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {[
                          { key: 'NONE', label: 'Không lặp' },
                          { key: 'WEEKLY', label: 'Hàng tuần' },
                          { key: 'MONTHLY', label: 'Hàng tháng' },
                          { key: 'QUARTERLY', label: 'Hàng quý' },
                        ].map((item) => {
                          const active = recurrencePattern === item.key;
                          return (
                            <TouchableOpacity key={item.key} style={[styles.recurrenceOptionPill, active ? styles.activePill : { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]} onPress={() => onChangeRecurrencePattern?.(item.key as any)}>
                              <LocalizedText style={{ fontSize: 11, color: active ? '#FFFFFF' : colors.textPrimary, fontWeight: active ? '700' : '500' }}>{item.label}</LocalizedText>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {recurrencePattern !== 'NONE' && (
                        <View style={[styles.occurrencesBox, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
                          <LocalizedText style={[styles.occurrencesLabel, { color: isDarkMode ? '#CBD5E1' : '#1E293B' }]}>Số đợt khám định kỳ tự động:</LocalizedText>
                          <View style={[styles.rowCenter, { gap: 10 }]}>
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

                  <View style={styles.rowCenter}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={[styles.rowCenter, { gap: 6 }]}>
                        <Ionicons name="volume-high" size={16} color="#0284C7" />
                        <LocalizedText style={[styles.switchTitle, { color: colors.textPrimary }]}>Phát loa thông minh Hub AI</LocalizedText>
                      </View>
                      <LocalizedText style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Tự động phát giọng nói nhắc nhở tại nhà bệnh nhân trước giờ khám 24h & 2h
                      </LocalizedText>
                    </View>
                    <Switch value={enableSpeaker} onValueChange={onToggleEnableSpeaker} trackColor={{ false: '#CBD5E1', true: '#2563EB' }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF', activeTrackColor: '#2563EB' } as any)} />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <TouchableOpacity style={[styles.btnAction, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
              <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Hủy</LocalizedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSavePrimary} onPress={onSave} disabled={isSubmitting} activeOpacity={0.85}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={[styles.rowCenter, { gap: 6 }]}>
                  <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                  <LocalizedText style={styles.btnSavePrimaryText}>{isEditing ? 'Cập nhật lịch khám' : 'Xác nhận tạo lịch'}</LocalizedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* POPOVER 1: Chọn Bệnh Nhân */}
      <PopoverCard visible={activePopover === 'PATIENT'} title="Chọn Bệnh Nhân" onClose={() => setActivePopover('NONE')} isDarkMode={isDarkMode} colors={colors}>
        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
          {patients.map((pat) => {
            const isSelected = String(pat.id) === String(patientId);
            return (
              <TouchableOpacity
                key={String(pat.id)}
                style={[styles.popoverOptionRow, { backgroundColor: isSelected ? (isDarkMode ? '#0F2942' : '#F0F9FF') : 'transparent' }]}
                onPress={() => {
                  onSelectPatient ? onSelectPatient(pat) : onChangePatientName(pat.name);
                  if (visitType === 'HOME_VISIT') applyHomeLocation(pat);
                  setActivePopover('NONE');
                }}
              >
                <PatientAvatarMini pat={pat} bg={isSelected ? '#0284C7' : '#94A3B8'} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <LocalizedText style={{ fontSize: 12.5, color: isSelected ? '#0284C7' : colors.textPrimary, fontWeight: isSelected ? '700' : '500' }}>{pat.name}</LocalizedText>
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
        visible={activePopover === 'DATE'}
        title={`Tháng ${calendarViewDate.getMonth() + 1}/${calendarViewDate.getFullYear()}`}
        onClose={() => setActivePopover('NONE')}
        isDarkMode={isDarkMode}
        colors={colors}
        headerRight={
          <View style={[styles.rowCenter, { gap: 8 }]}>
            {[-1, 1].map((delta) => (
              <TouchableOpacity key={delta} style={styles.calendarNavBtn} onPress={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + delta, 1))}>
                <Ionicons name={delta < 0 ? 'chevron-back' : 'chevron-forward'} size={18} color="#0284C7" />
              </TouchableOpacity>
            ))}
          </View>
        }
      >
        <View style={styles.calendarWeekRow}>
          {DAYS_SHORT.map((d) => <LocalizedText key={d} style={styles.calendarWeekText}>{d}</LocalizedText>)}
        </View>
        <View style={styles.calendarGrid}>
          {calendarDays.map((dayItem, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.calendarCell, dayItem.selected && { backgroundColor: '#0284C7' }]}
              disabled={!dayItem.current || dayItem.past}
              onPress={() => { syncScheduledAt(dayItem.date, selectedTimeSlot); setActivePopover('NONE'); }}
            >
              <LocalizedText style={{ fontSize: 12, color: !dayItem.current ? '#CBD5E1' : dayItem.past ? '#94A3B8' : dayItem.selected ? '#FFFFFF' : colors.textPrimary, fontWeight: dayItem.selected ? '800' : '600' }}>
                {dayItem.date.getDate()}
              </LocalizedText>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.calendarCloseBtn} onPress={() => setActivePopover('NONE')}>
          <LocalizedText style={{ color: '#0284C7', fontWeight: '700', fontSize: 12 }}>Đóng</LocalizedText>
        </TouchableOpacity>
      </PopoverCard>

      {/* POPOVER 3: Chọn Giờ Khám */}
      <PopoverCard visible={activePopover === 'TIME'} title="Chọn Giờ Khám" onClose={() => setActivePopover('NONE')} isDarkMode={isDarkMode} colors={colors}>
        <View style={styles.timeSlotGrid}>
          {TIME_PICKER_SLOTS.map((slot) => {
            const active = selectedTimeSlot === slot;
            return (
              <TouchableOpacity
                key={slot}
                style={[styles.timeSlotBtn, active ? styles.activePill : { backgroundColor: fieldBg, borderColor: colors.border }]}
                onPress={() => { syncScheduledAt(selectedDate, slot); setCustomTimeInput(slot); setActivePopover('NONE'); }}
              >
                <LocalizedText style={{ fontSize: 11.5, color: active ? '#FFFFFF' : colors.textPrimary, fontWeight: active ? '700' : '500' }}>{slot}</LocalizedText>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.customTimeRow, { borderTopColor: colors.border }]}>
          <LocalizedTextInput style={[styles.inputField, { flex: 1, paddingVertical: 6, fontSize: 12, color: colors.textPrimary, borderColor: colors.border }]} value={customTimeInput} onChangeText={setCustomTimeInput} placeholder="HH:mm (vd: 08:15)" placeholderTextColor="#94A3B8" maxLength={5} />
          <TouchableOpacity
            style={styles.btnConfirmSmall}
            onPress={() => { if (customTimeInput.trim()) syncScheduledAt(selectedDate, customTimeInput.trim()); setActivePopover('NONE'); }}
          >
            <LocalizedText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Xác nhận</LocalizedText>
          </TouchableOpacity>
        </View>
      </PopoverCard>

      {/* POPOVER 4: Chọn Chuyên Khoa */}
      <PopoverCard visible={activePopover === 'EXAM'} title="Chuyên Khoa / Lý Do Khám" onClose={() => setActivePopover('NONE')} isDarkMode={isDarkMode} colors={colors}>
        {STANDARD_EXAM_TYPES.map((type) => {
          const isSelected = type === 'Khác' ? isCustomExamType : examType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.popoverOptionRow, { backgroundColor: isSelected ? (isDarkMode ? '#0F2942' : '#F0F9FF') : 'transparent' }]}
              onPress={() => {
                onChangeExamType(type === 'Khác' ? (isCustomExamType && examType !== 'Khác' ? examType : 'Khác') : type);
                setActivePopover('NONE');
              }}
            >
              <LocalizedText style={{ fontSize: 12.5, color: isSelected ? '#0284C7' : colors.textPrimary, fontWeight: isSelected ? '700' : '500', flex: 1 }}>{type}</LocalizedText>
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
export interface AppointmentCancelModalProps extends ThemeProps {
  visible: boolean; appointment: AppointmentItem | null; isSubmitting: boolean;
  onConfirm: (reason: string) => void; onClose: () => void;
}

export const AppointmentCancelModal: React.FC<AppointmentCancelModalProps> = ({
  visible, appointment, isSubmitting, onConfirm, onClose, isDarkMode, colors,
}) => {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = () => { setReason(''); setErrorMsg(''); onClose(); };
  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) return setErrorMsg('Vui lòng nhập lý do hủy lịch khám (tối thiểu 3 ký tự).');
    setErrorMsg('');
    onConfirm(trimmed);
  };

  if (!appointment) return null;

  return (
    <DialogModal visible={visible} onClose={handleClose} icon="close-circle" iconBg="#FEE2E2" iconColor="#EF4444" title="Hủy Lịch Hẹn Khám" isDarkMode={isDarkMode} colors={colors}>
      <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC', borderColor: colors.border }]}>
        <LocalizedText style={[styles.infoPatient, { color: colors.textPrimary }]}>{appointment.patient_name}</LocalizedText>
        <LocalizedText style={[styles.infoTime, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          📅 {formatModalDateTime(appointment.scheduled_at)} • 🩺 {formatModalExamType(appointment.exam_type || appointment.visit_type)}
        </LocalizedText>
      </View>

      <LocalizedText style={styles.fieldLabelPrimary}>Lý do hủy lịch (*) :</LocalizedText>
      <LocalizedTextInput
        style={[styles.inputReason, { color: colors.textPrimary, borderColor: errorMsg ? '#EF4444' : colors.border, backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }]}
        multiline
        value={reason}
        onChangeText={(t) => { setReason(t); if (errorMsg) setErrorMsg(''); }}
        placeholder="VD: Bệnh nhân có việc gia đình đột xuất / Đã nhập viện điều trị..."
        placeholderTextColor="#94A3B8"
      />

      <View style={styles.quickSuggestionsRow}>
        {['Bệnh nhân có việc đột xuất', 'Bác sĩ có ca mổ khẩn cấp', 'Chuyển viện điều trị chuyên khoa', 'Sức khỏe ổn định, hoãn tái khám'].map((sug) => (
          <TouchableOpacity
            key={sug}
            style={[styles.quickPill, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: reason === sug ? '#EF4444' : isDarkMode ? '#475569' : '#CBD5E1' }]}
            onPress={() => { setReason(sug); if (errorMsg) setErrorMsg(''); }}
          >
            <LocalizedText style={{ fontSize: 11, fontWeight: '500', color: reason === sug ? '#DC2626' : isDarkMode ? '#CBD5E1' : '#475569' }}>{sug}</LocalizedText>
          </TouchableOpacity>
        ))}
      </View>

      {errorMsg ? <LocalizedText style={styles.errorText}>{errorMsg}</LocalizedText> : null}
      <LocalizedText style={[styles.noticeText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
        ℹ️ Việc hủy lịch sẽ tự động hủy các chuông/thông báo nhắc nhở đã lên lịch cho người nhà bệnh nhân.
      </LocalizedText>

      <View style={styles.dialogFooterRow}>
        <TouchableOpacity style={[styles.btnAction, { flex: 1, borderColor: colors.border }]} onPress={handleClose} disabled={isSubmitting}>
          <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Quay lại</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDangerConfirm} onPress={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <LocalizedText style={styles.btnWhiteText}>Xác nhận hủy</LocalizedText>}
        </TouchableOpacity>
      </View>
    </DialogModal>
  );
};

// =============================================================
// 3. MODAL XÁC NHẬN ĐÃ KHÁM XONG
// =============================================================
export interface AppointmentCompleteModalProps extends ThemeProps {
  visible: boolean; appointment: AppointmentItem | null; isSubmitting: boolean;
  onConfirm: () => void; onClose: () => void;
}

export const AppointmentCompleteModal: React.FC<AppointmentCompleteModalProps> = ({
  visible, appointment, isSubmitting, onConfirm, onClose, isDarkMode, colors,
}) => {
  if (!appointment) return null;
  const subCol = { color: isDarkMode ? '#94A3B8' : '#64748B' };

  return (
    <DialogModal visible={visible} onClose={onClose} icon="checkmark-circle" iconBg="#D1FAE5" iconColor="#059669" title="Xác Nhận Đã Khám Xong" isDarkMode={isDarkMode} colors={colors}>
      <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC', borderColor: colors.border }]}>
        <LocalizedText style={[styles.infoPatient, { color: colors.textPrimary }]}>{appointment.patient_name}</LocalizedText>
        <LocalizedText style={[styles.infoTime, subCol]}>📅 Thời gian: {formatModalDateTime(appointment.scheduled_at)}</LocalizedText>
        <LocalizedText style={[styles.infoTime, subCol]}>🩺 Chuyên khoa: {formatModalExamType(appointment.exam_type || appointment.visit_type)}</LocalizedText>
        {appointment.location ? <LocalizedText style={[styles.infoTime, subCol]}>📍 Địa điểm: {appointment.location}</LocalizedText> : null}
      </View>

      <LocalizedText style={[styles.confirmPrompt, { color: colors.textPrimary }]}>Bác sĩ xác nhận đã hoàn tất khám cho bệnh nhân?</LocalizedText>
      <LocalizedText style={[styles.confirmDesc, subCol]}>Trạng thái lịch hẹn sẽ được chuyển sang "ĐÃ KHÁM XONG" và đóng tất lại nhắc nhở.</LocalizedText>

      <View style={styles.dialogFooterRow}>
        <TouchableOpacity style={[styles.btnAction, { flex: 1, borderColor: colors.border }]} onPress={onClose} disabled={isSubmitting}>
          <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Quay lại</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSuccessConfirm} onPress={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <LocalizedText style={styles.btnWhiteText}>Xác nhận hoàn tất</LocalizedText>}
        </TouchableOpacity>
      </View>
    </DialogModal>
  );
};

// =============================================================
// 4. MODAL CHI TIẾT LỊCH HẸN KHÁM (BANNER TRANG CHỦ)
// =============================================================
export interface AppointmentDetailModalProps extends ThemeProps {
  visible: boolean; appointment: AppointmentItem | null; patientInfo?: PatientCardData | null;
  onClose: () => void; onReschedule: () => void; onStartExam: (patientId: string) => void;
  formatAptTime: (dateStr?: string) => string;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  visible, appointment, patientInfo, onClose, onReschedule, onStartExam, formatAptTime, isDarkMode, colors,
}) => {
  if (!appointment) return null;
  const rows = [
    { icon: 'person-outline', label: 'Bệnh nhân:', val: `${appointment.patient_name || 'Bệnh nhân'}${patientInfo ? ` (${patientInfo.age ? `${patientInfo.age} tuổi` : ''}${patientInfo.gender ? ` • ${patientInfo.gender}` : ''})` : ''}` },
    { icon: 'time-outline', label: 'Thời gian & Hình thức:', val: `Hôm nay, ${formatAptTime(appointment.scheduled_at)} • ${appointment.visit_type === 'CLINIC' ? 'Tại phòng khám' : 'Khám tại nhà'}` },
    { icon: 'location-outline', label: 'Địa chỉ khám:', val: appointment.location || patientInfo?.house_address || 'Nhà riêng bệnh nhân' },
    { icon: 'call-outline', label: 'Số điện thoại người nhà:', val: maskPhoneNumber(patientInfo?.emergency_contact_phone) },
    { icon: 'document-text-outline', label: 'Dặn dò y tế / Ghi chú:', val: appointment.instructions || appointment.clinical_notes || 'Khám sức khỏe định kỳ.' },
  ];

  return (
    <DialogModal visible={visible} onClose={onClose} icon="calendar" iconBg="#EFF6FF" iconColor="#2563EB" title="Chi tiết lịch hẹn khám" isDarkMode={isDarkMode} colors={colors} cardStyle={styles.detailCard}>
      <View style={{ gap: 12, marginBottom: 18 }}>
        {rows.map((row, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name={row.icon as any} size={18} color="#2563EB" style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <LocalizedText style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#94A3B8' : '#64748B' }}>{row.label}</LocalizedText>
              <LocalizedText style={[styles.infoPatient, { color: colors.textPrimary }]}>{row.val}</LocalizedText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.dialogFooterRow}>
        <TouchableOpacity style={[styles.btnAction, { flex: 1, borderColor: colors.border }]} activeOpacity={0.8} onPress={onReschedule}>
          <Ionicons name="calendar-outline" size={16} color={isDarkMode ? '#E2E8F0' : '#475569'} style={{ marginRight: 4 }} />
          <LocalizedText style={[styles.btnActionText, { color: isDarkMode ? '#E2E8F0' : '#475569' }]}>Đổi lịch</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnDangerConfirm, { backgroundColor: '#2563EB' }]} activeOpacity={0.85} onPress={() => onStartExam(appointment.patient_id)}>
          <Ionicons name="medkit" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <LocalizedText style={styles.btnWhiteText}>Bắt đầu khám</LocalizedText>
        </TouchableOpacity>
      </View>
    </DialogModal>
  );
};

const styles = StyleSheet.create({
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowGap10: { flexDirection: 'row', gap: 10 },
  dialogFooterRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  activePill: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  avatarFull: { width: '100%', height: '100%', borderRadius: 13 },
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
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10 },
  patientAvatarMini: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  patientAvatarMiniText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  dropdownValueText: { fontSize: 13, fontWeight: '700' },
  dropdownSubText: { fontSize: 11, color: '#64748B', marginTop: 1 },
  dateTimeInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  inputMiniLabel: { fontSize: 10, color: '#64748B', fontWeight: '500' },
  dateTimeValueText: { fontSize: 12.5, fontWeight: '700', marginTop: 1 },
  modalityPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 9, borderWidth: 1 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1 },
  accordionTitle: { fontSize: 12.5, fontWeight: '700' },
  accordionContent: { marginTop: 6, padding: 12, borderRadius: 10, borderWidth: 1 },
  recurrenceOptionPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  occurrencesBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#BAE6FD' },
  occurrencesLabel: { fontSize: 11.5, fontWeight: '600' },
  stepperBtn: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0284C7', justifyContent: 'center', alignItems: 'center' },
  stepperValue: { fontSize: 13, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  switchTitle: { fontSize: 12.5, fontWeight: '700' },
  switchSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  btnAction: { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnActionText: { fontSize: 13, fontWeight: '700' },
  btnSavePrimary: { flex: 1, backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnSavePrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  popoverBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  popoverCard: { width: '100%', maxWidth: 360, borderRadius: 16, padding: 16, elevation: 15 },
  popoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1' },
  popoverTitle: { fontSize: 14, fontWeight: '800' },
  popoverOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 9, marginBottom: 4 },
  calendarNavBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  calendarWeekText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#64748B' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.28%', height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  calendarCloseBtn: { marginTop: 10, alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 6 },
  timeSlotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSlotBtn: { width: '22.5%', paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  customTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  btnConfirmSmall: { backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 18 },
  dialogBox: { borderRadius: 16, padding: 18, borderWidth: 1, elevation: 10 },
  detailCard: { width: '100%', maxWidth: 380, alignSelf: 'center', borderRadius: 18, padding: 18, borderWidth: 1, elevation: 8 },
  dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1' },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  dialogTitle: { fontSize: 15, fontWeight: '800' },
  infoCard: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12, gap: 3 },
  infoPatient: { fontSize: 14, fontWeight: '800' },
  infoTime: { fontSize: 12, fontWeight: '500' },
  inputReason: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12.5, height: 68, textAlignVertical: 'top', marginTop: 4 },
  quickSuggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 8 },
  quickPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  errorText: { fontSize: 11.5, color: '#EF4444', fontWeight: '600', marginBottom: 6 },
  noticeText: { fontSize: 11, lineHeight: 15, marginBottom: 14 },
  confirmPrompt: { fontSize: 13.5, fontWeight: '700', marginBottom: 4 },
  confirmDesc: { fontSize: 12, lineHeight: 17, marginBottom: 16 },
  btnDangerConfirm: { flex: 1, flexDirection: 'row', backgroundColor: '#DC2626', paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnSuccessConfirm: { flex: 1, backgroundColor: '#10B981', paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnWhiteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
