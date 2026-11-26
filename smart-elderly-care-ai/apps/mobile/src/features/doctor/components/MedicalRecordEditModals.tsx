// MedicalRecordEditModals.tsx
// 4 Modal nâng cấp thông minh (Chips, Preset Templates, Steppers, Date-Time Picker) cho Hồ sơ Bệnh nhân Y tế

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SeverityType } from './types';

// =============================================================
// SHARED BASE PRIMITIVES
// =============================================================
const SmartBaseModal: React.FC<{
  visible: boolean;
  title: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
  children: React.ReactNode;
}> = ({ visible, title, iconName, iconColor = '#2563EB', onClose, isDarkMode, colors, children }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
      <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            {iconName ? (
              <View style={[styles.modalTitleIconWrap, { backgroundColor: `${iconColor}18` }]}>
                <Ionicons name={iconName} size={18} color={iconColor} />
              </View>
            ) : null}
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingBottom: 6 }}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const SubmitBtn: React.FC<{ title: string; onPress: () => void; loading?: boolean }> = ({
  title,
  onPress,
  loading,
}) => (
  <TouchableOpacity style={styles.modalSubmitBtn} onPress={onPress} disabled={loading} activeOpacity={0.85}>
    {loading ? (
      <ActivityIndicator color="#FFFFFF" size="small" />
    ) : (
      <Text style={styles.modalSubmitBtnText}>{title}</Text>
    )}
  </TouchableOpacity>
);

const parseCommaTags = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const appendUniqueClause = (current: string, clause: string): string => {
  const clean = current.trim();
  if (!clean) return clause;
  if (clean.toLowerCase().includes(clause.toLowerCase())) return clean;
  const sep = clean.endsWith('.') || clean.endsWith(',') || clean.endsWith(';') ? ' ' : '; ';
  return `${clean}${sep}${clause}`;
};

// =============================================================
// 1. MODAL GHI CHÚ BÁC SĨ & LỊCH TÁI KHÁM (Quick Notes + Date-Time Picker)
// =============================================================
export interface DoctorNotesModalProps {
  visible: boolean;
  notes: string;
  nextAppt: string;
  onChangeNotes: (val: string) => void;
  onChangeNextAppt: (val: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

const QUICK_CLINICAL_NOTES = [
  'Uống thuốc đúng giờ theo đơn',
  'Đo huyết áp mỗi sáng',
  'Hạn chế vận động mạnh',
  'Theo dõi chỉ số SpO2 hằng ngày',
];

const QUICK_REVISIT_PRESETS = [
  { label: 'Sau 1 tuần', days: 7 },
  { label: 'Sau 2 tuần', days: 14 },
  { label: 'Sau 1 tháng', days: 30 },
];

const TIME_SLOT_PRESETS = ['08:00', '08:30', '09:00', '10:00', '14:00', '15:30'];

const parseApptDate = (raw: string): Date => {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?/);
  if (m) {
    const d = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      m[4] ? Number(m[4]) : 8,
      m[5] ? Number(m[5]) : 30
    );
    if (!Number.isNaN(d.getTime())) return d;
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(8, 30, 0, 0);
  return fallback;
};

const formatApptDate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const DoctorNotesModal: React.FC<DoctorNotesModalProps> = ({
  visible,
  notes,
  nextAppt,
  onChangeNotes,
  onChangeNextAppt,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customTimeText, setCustomTimeText] = useState('');
  const currentDate = parseApptDate(nextAppt);
  const [cursorMonth, setCursorMonth] = useState(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );

  const applyPresetDays = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    target.setHours(currentDate.getHours() || 8, currentDate.getMinutes() || 30, 0, 0);
    setCursorMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    onChangeNextAppt(formatApptDate(target));
  };

  const selectCalendarDay = (yearNum: number, monthNum: number, dayNum: number) => {
    const next = new Date(
      yearNum,
      monthNum,
      dayNum,
      currentDate.getHours() || 8,
      currentDate.getMinutes() || 30,
      0,
      0
    );
    onChangeNextAppt(formatApptDate(next));
  };

  const setTimeSlot = (slot: string) => {
    const [hh, mm] = slot.split(':').map(Number);
    const next = new Date(currentDate);
    next.setHours(hh, mm, 0, 0);
    onChangeNextAppt(formatApptDate(next));
    setShowCustomTime(false);
  };

  const applyCustomTime = () => {
    const clean = customTimeText.trim();
    if (!/^\d{1,2}:\d{2}$/.test(clean)) return;
    const [hh, mm] = clean.split(':').map(Number);
    if (hh > 23 || mm > 59) return;
    setTimeSlot(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    setCustomTimeText('');
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const currentTimeStr = `${pad(currentDate.getHours())}:${pad(currentDate.getMinutes())}`;

  const calYear = cursorMonth.getFullYear();
  const calMonth = cursorMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstWeekdayMon0 = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const calCells: (number | null)[] = [];
  for (let i = 0; i < firstWeekdayMon0; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);
  while (calCells.length % 7 !== 0) calCells.push(null);

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  return (
    <SmartBaseModal
      visible={visible}
      title="Ghi Chú & Lịch Tái Khám"
      iconName="journal-outline"
      iconColor="#2563EB"
      onClose={onClose}
      isDarkMode={isDarkMode}
      colors={colors}
    >
      <Text style={styles.fieldLabel}>Mẫu lời dặn y khoa nhanh</Text>
      <View style={styles.chipsWrap}>
        {QUICK_CLINICAL_NOTES.map((tpl) => {
          const active = notes.toLowerCase().includes(tpl.toLowerCase());
          return (
            <TouchableOpacity
              key={tpl}
              style={[
                styles.templateChip,
                {
                  backgroundColor: active ? '#DBEAFE' : isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderColor: active ? '#2563EB' : colors.border,
                },
              ]}
              onPress={() => onChangeNotes(appendUniqueClause(notes, tpl))}
              activeOpacity={0.75}
            >
              <Ionicons name={active ? 'checkmark-circle' : 'add-circle-outline'} size={14} color={active ? '#2563EB' : '#64748B'} />
              <Text style={[styles.templateChipText, { color: active ? '#1D4ED8' : colors.textPrimary }]}>{tpl}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Lời dặn dò y khoa</Text>
      <TextInput
        style={[
          styles.inputField,
          { height: 86, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
        ]}
        multiline
        placeholder="Chạm mẫu ở trên hoặc nhập ghi chú lâm sàng..."
        placeholderTextColor="#94A3B8"
        value={notes}
        onChangeText={onChangeNotes}
      />

      <Text style={styles.fieldLabel}>Lịch hẹn tái khám tiếp theo</Text>
      <View style={styles.presetRow}>
        {QUICK_REVISIT_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.days}
            style={[
              styles.presetPillBtn,
              { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#93C5FD' },
            ]}
            onPress={() => applyPresetDays(p.days)}
            activeOpacity={0.75}
          >
            <Ionicons name="time-outline" size={13} color="#2563EB" />
            <Text style={styles.presetPillText}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.datePickerTrigger,
          {
            backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
            borderColor: showPicker ? '#2563EB' : colors.border,
          },
        ]}
        onPress={() => setShowPicker((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Ionicons name="calendar" size={18} color="#2563EB" />
          <Text style={[styles.datePickerValue, { color: nextAppt ? colors.textPrimary : '#94A3B8' }]}>
            {nextAppt || 'Chọn ngày & giờ tái khám'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>
            {showPicker ? 'Thu gọn' : 'Mở lịch'}
          </Text>
          <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#2563EB" />
        </View>
      </TouchableOpacity>

      {showPicker && (
        <View
          style={[
            styles.pickerPanel,
            { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border },
          ]}
        >
          {/* Thanh chuyển tháng */}
          <View style={styles.dateStepperRow}>
            <TouchableOpacity
              style={[styles.miniStepBtn, { borderColor: colors.border }]}
              onPress={() => setCursorMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            >
              <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.pickerDateTitle, { color: colors.textPrimary }]}>
              {`Tháng ${pad(calMonth + 1)}/${calYear}`}
            </Text>
            <TouchableOpacity
              style={[styles.miniStepBtn, { borderColor: colors.border }]}
              onPress={() => setCursorMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Tiêu đề thứ T2 -> CN */}
          <View style={styles.calWeekRow}>
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((wd) => (
              <View key={wd} style={styles.calWeekCell}>
                <Text style={styles.calWeekText}>{wd}</Text>
              </View>
            ))}
          </View>

          {/* Lưới các ngày trong tháng */}
          <View style={styles.calGrid}>
            {calCells.map((dayNum, idx) => {
              if (dayNum === null) {
                return <View key={`empty-${idx}`} style={styles.calDayCell} />;
              }
              const cellDate = new Date(calYear, calMonth, dayNum);
              const isPast = cellDate < todayMidnight;
              const isSelected =
                currentDate.getFullYear() === calYear &&
                currentDate.getMonth() === calMonth &&
                currentDate.getDate() === dayNum;

              return (
                <TouchableOpacity
                  key={`${calYear}-${calMonth}-${dayNum}`}
                  disabled={isPast}
                  activeOpacity={0.75}
                  onPress={() => selectCalendarDay(calYear, calMonth, dayNum)}
                  style={styles.calDayCell}
                >
                  <View
                    style={[
                      styles.calDayCircle,
                      isSelected && { backgroundColor: '#2563EB' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        {
                          color: isSelected
                            ? '#FFFFFF'
                            : isPast
                              ? '#94A3B8'
                              : colors.textPrimary,
                          opacity: isPast ? 0.4 : 1,
                        },
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.pickerSectionLabel, { marginTop: 8 }]}>Chọn giờ khám</Text>
          <View style={styles.chipsWrap}>
            {TIME_SLOT_PRESETS.map((slot) => {
              const isSelected = currentTimeStr === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.timeSlotChip,
                    {
                      backgroundColor: isSelected ? '#2563EB' : isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderColor: isSelected ? '#2563EB' : colors.border,
                    },
                  ]}
                  onPress={() => setTimeSlot(slot)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#FFFFFF' : colors.textPrimary }}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.timeSlotChip,
                {
                  borderStyle: 'dashed',
                  borderColor: '#2563EB',
                  backgroundColor: isDarkMode ? '#1E3A8A30' : '#EFF6FF',
                },
              ]}
              onPress={() => setShowCustomTime((v) => !v)}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>+ Thêm giờ khác</Text>
            </TouchableOpacity>
          </View>

          {showCustomTime && (
            <View style={[styles.customAddRow, { marginTop: 8 }]}>
              <TextInput
                style={[styles.inputFieldSmall, { flex: 1, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="HH:mm (VD: 16:45)"
                placeholderTextColor="#94A3B8"
                value={customTimeText}
                onChangeText={setCustomTimeText}
                onSubmitEditing={applyCustomTime}
              />
              <TouchableOpacity style={styles.customAddBtn} onPress={applyCustomTime} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <SubmitBtn title="Lưu Thay Đổi" onPress={onSave} loading={isSaving} />
    </SmartBaseModal>
  );
};

// =============================================================
// 2. MODAL THÊM / SỬA BỆNH LÝ NỀN (Quick Geriatric Condition Chips)
// =============================================================
export interface ConditionFormModalProps {
  visible: boolean;
  isEditing: boolean;
  name: string;
  severity: SeverityType;
  note: string;
  onChangeName: (val: string) => void;
  onChangeSeverity: (val: SeverityType) => void;
  onChangeNote: (val: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

const GERIATRIC_CONDITIONS = [
  'Tăng huyết áp',
  'Đái tháo đường Type 2',
  'Rối loạn lipid máu',
  'Suy tim mạn',
  'Thoái hóa khớp',
  'COPD / Hen phế quản',
  'Rối loạn tiền đình',
];

const SEVERITY_OPTIONS = [
  { key: 'danger' as const, label: 'Nguy cơ cao', color: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle' as const },
  { key: 'warning' as const, label: 'Cần theo dõi', color: '#D97706', bg: '#FEF3C7', icon: 'eye' as const },
  { key: 'info' as const, label: 'Ổn định', color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle' as const },
];

export const ConditionFormModal: React.FC<ConditionFormModalProps> = ({
  visible,
  isEditing,
  name,
  severity,
  note,
  onChangeName,
  onChangeSeverity,
  onChangeNote,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <SmartBaseModal
    visible={visible}
    title={isEditing ? 'Sửa Chẩn Đoán Bệnh Lý' : 'Thêm Bệnh Lý Nền Mới'}
    iconName="medkit-outline"
    iconColor="#2563EB"
    onClose={onClose}
    isDarkMode={isDarkMode}
    colors={colors}
  >
    <Text style={styles.fieldLabel}>Tên bệnh lý / chẩn đoán (*)</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="Tìm hoặc nhập tên bệnh lý..."
      placeholderTextColor="#94A3B8"
      value={name}
      onChangeText={onChangeName}
    />

    <Text style={styles.subHintLabel}>Bệnh lý lão khoa phổ biến (chạm để chọn nhanh):</Text>
    <View style={styles.chipsWrap}>
      {GERIATRIC_CONDITIONS.map((cond) => {
        const selected = name.trim().toLowerCase() === cond.toLowerCase();
        return (
          <TouchableOpacity
            key={cond}
            style={[
              styles.templateChip,
              {
                backgroundColor: selected ? '#2563EB' : isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: selected ? '#2563EB' : colors.border,
              },
            ]}
            onPress={() => onChangeName(cond)}
            activeOpacity={0.75}
          >
            <Text style={[styles.templateChipText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{cond}</Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <Text style={styles.fieldLabel}>Mức độ nghiêm trọng</Text>
    <View style={styles.severityPickerRow}>
      {SEVERITY_OPTIONS.map((s) => {
        const isSelected = severity === s.key;
        return (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.severityOptionBtn,
              isSelected
                ? { borderColor: s.color, backgroundColor: isDarkMode ? `${s.color}25` : s.bg }
                : { borderColor: colors.border },
            ]}
            onPress={() => onChangeSeverity(s.key)}
            activeOpacity={0.8}
          >
            <Ionicons name={s.icon} size={14} color={isSelected ? s.color : '#94A3B8'} style={{ marginBottom: 2 }} />
            <Text style={[styles.severityOptionText, { color: isSelected ? s.color : isDarkMode ? '#CBD5E1' : '#64748B' }]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <Text style={styles.fieldLabel}>Ghi chú lâm sàng</Text>
    <TextInput
      style={[
        styles.inputField,
        { height: 72, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
      ]}
      multiline
      placeholder="Dặn dò cụ thể..."
      placeholderTextColor="#94A3B8"
      value={note}
      onChangeText={onChangeNote}
    />
    <SubmitBtn title="Lưu Bệnh Lý" onPress={onSave} loading={isSaving} />
  </SmartBaseModal>
);

// =============================================================
// 3. MODAL DỊ ỨNG & DINH DƯỠNG (Tag Chips + Custom Add + Diet Presets)
// =============================================================
export interface AllergiesDietModalProps {
  visible: boolean;
  drugAllergies: string;
  foodAllergies: string;
  dietaryNotes: string;
  onChangeDrugAllergies: (val: string) => void;
  onChangeFoodAllergies: (val: string) => void;
  onChangeDietaryNotes: (val: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

const DRUG_ALLERGY_CHIPS = [
  'Penicillin',
  'Paracetamol',
  'Aspirin',
  'NSAIDs',
  'Kháng sinh nhóm Sulfa',
  'Không dị ứng thuốc',
];

const FOOD_ALLERGY_CHIPS = [
  'Hải sản',
  'Đậu phộng',
  'Sữa & Chế phẩm sữa',
  'Trứng',
  'Đồ ngọt / Nhiều đường',
  'Không dị ứng thực phẩm',
];

const DIET_TEMPLATES = [
  'Ăn nhạt (Giảm muối - Tim mạch)',
  'Ít đường / Tinh bột (Tiểu đường)',
  'Thức ăn mềm / Dễ tiêu',
  'Tăng cường chất xơ & Rau xanh',
  'Tránh thực phẩm từ đậu nành',
];

const AllergyChipsSection: React.FC<{
  label: string;
  presetChips: string[];
  noneChipLabel: string;
  value: string;
  onChange: (val: string) => void;
  customPlaceholder: string;
  isDarkMode: boolean;
  colors: any;
}> = ({ label, presetChips, noneChipLabel, value, onChange, customPlaceholder, isDarkMode, colors }) => {
  const [customInput, setCustomInput] = useState('');
  const selected = parseCommaTags(value);
  const extraCustomTags = selected.filter((t) => !presetChips.some((p) => p.toLowerCase() === t.toLowerCase()));
  const allChips = [...presetChips, ...extraCustomTags];

  const toggleTag = (tag: string) => {
    if (tag === noneChipLabel) {
      const hasNone = selected.includes(noneChipLabel);
      onChange(hasNone ? '' : noneChipLabel);
      return;
    }
    const withoutNone = selected.filter((t) => t !== noneChipLabel);
    const exists = withoutNone.some((t) => t.toLowerCase() === tag.toLowerCase());
    const next = exists
      ? withoutNone.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : [...withoutNone, tag];
    onChange(next.join(', '));
  };

  const addCustomTag = () => {
    const clean = customInput.trim();
    if (!clean) return;
    const withoutNone = selected.filter((t) => t !== noneChipLabel);
    if (!withoutNone.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      onChange([...withoutNone, clean].join(', '));
    }
    setCustomInput('');
  };

  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipsWrap}>
        {allChips.map((chip) => {
          const isSelected = selected.some((t) => t.toLowerCase() === chip.toLowerCase());
          const isNone = chip === noneChipLabel;
          return (
            <TouchableOpacity
              key={chip}
              style={[
                styles.allergyChip,
                isSelected
                  ? isNone
                    ? { backgroundColor: '#DCFCE7', borderColor: '#16A34A' }
                    : { backgroundColor: isDarkMode ? '#7F1D1D55' : '#FEE2E2', borderColor: '#EF4444' }
                  : { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border },
              ]}
              onPress={() => toggleTag(chip)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.allergyChipText,
                  {
                    color: isSelected
                      ? isNone
                        ? '#15803D'
                        : isDarkMode
                          ? '#FCA5A5'
                          : '#DC2626'
                      : colors.textPrimary,
                  },
                ]}
              >
                {chip}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.customAddRow}>
        <TextInput
          style={[styles.inputFieldSmall, { flex: 1, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder={customPlaceholder}
          placeholderTextColor="#94A3B8"
          value={customInput}
          onChangeText={setCustomInput}
          onSubmitEditing={addCustomTag}
        />
        <TouchableOpacity style={styles.customAddBtn} onPress={addCustomTag} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const AllergiesDietModal: React.FC<AllergiesDietModalProps> = ({
  visible,
  drugAllergies,
  foodAllergies,
  dietaryNotes,
  onChangeDrugAllergies,
  onChangeFoodAllergies,
  onChangeDietaryNotes,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <SmartBaseModal
    visible={visible}
    title="Dị Ứng & Dinh Dưỡng"
    iconName="nutrition-outline"
    iconColor="#EA580C"
    onClose={onClose}
    isDarkMode={isDarkMode}
    colors={colors}
  >
    <AllergyChipsSection
      label="Dị ứng thuốc"
      presetChips={DRUG_ALLERGY_CHIPS}
      noneChipLabel="Không dị ứng thuốc"
      value={drugAllergies}
      onChange={onChangeDrugAllergies}
      customPlaceholder="Thêm thuốc khác +"
      isDarkMode={isDarkMode}
      colors={colors}
    />

    <AllergyChipsSection
      label="Dị ứng thực phẩm"
      presetChips={FOOD_ALLERGY_CHIPS}
      noneChipLabel="Không dị ứng thực phẩm"
      value={foodAllergies}
      onChange={onChangeFoodAllergies}
      customPlaceholder="Thêm thực phẩm khác +"
      isDarkMode={isDarkMode}
      colors={colors}
    />

    <Text style={styles.fieldLabel}>Chế độ ăn khuyến nghị (chạm mẫu để chèn nhanh)</Text>
    <View style={styles.chipsWrap}>
      {DIET_TEMPLATES.map((tpl) => {
        const active = dietaryNotes.toLowerCase().includes(tpl.toLowerCase());
        return (
          <TouchableOpacity
            key={tpl}
            style={[
              styles.templateChip,
              {
                backgroundColor: active ? '#DCFCE7' : isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: active ? '#16A34A' : colors.border,
              },
            ]}
            onPress={() => onChangeDietaryNotes(appendUniqueClause(dietaryNotes, tpl))}
            activeOpacity={0.75}
          >
            <Ionicons name={active ? 'checkmark-circle' : 'add-circle-outline'} size={14} color={active ? '#16A34A' : '#64748B'} />
            <Text style={[styles.templateChipText, { color: active ? '#15803D' : colors.textPrimary }]}>{tpl}</Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <TextInput
      style={[
        styles.inputField,
        { height: 76, textAlignVertical: 'top', marginTop: 6, color: colors.textPrimary, borderColor: colors.border },
      ]}
      multiline
      placeholder="Ghi chú chế độ ăn khuyến nghị..."
      placeholderTextColor="#94A3B8"
      value={dietaryNotes}
      onChangeText={onChangeDietaryNotes}
    />
    <SubmitBtn title="Lưu Dinh Dưỡng" onPress={onSave} loading={isSaving} />
  </SmartBaseModal>
);

// =============================================================
// 4. MODAL CẤU HÌNH NGƯỠNG SINH HIỆU (3 Presets + [-] Value [+] Steppers)
// =============================================================
export interface ThresholdsConfigModalProps {
  visible: boolean;
  hrHigh: string;
  hrLow: string;
  spo2Low: string;
  onChangeHrHigh: (val: string) => void;
  onChangeHrLow: (val: string) => void;
  onChangeSpo2Low: (val: string) => void;
  isSaving?: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

const THRESHOLD_PRESETS = [
  { label: 'Người cao tuổi tiêu chuẩn', hrHigh: '100', hrLow: '55', spo2Low: '94' },
  { label: 'Bệnh nhân Tim mạch', hrHigh: '95', hrLow: '55', spo2Low: '95' },
  { label: 'Bệnh nhân Hô hấp (COPD)', hrHigh: '105', hrLow: '60', spo2Low: '90' },
];

const ThresholdStepperRow: React.FC<{
  title: string;
  reference: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  onChange: (val: string) => void;
  isDarkMode: boolean;
  colors: any;
}> = ({ title, reference, unit, value, min, max, step = 1, onChange, isDarkMode, colors }) => {
  const numeric = parseInt(value, 10);
  const safeNum = Number.isNaN(numeric) ? min : numeric;

  const adjust = (delta: number) => {
    const next = Math.max(min, Math.min(max, safeNum + delta));
    onChange(String(next));
  };

  return (
    <View style={[styles.stepperCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
      <View style={styles.stepperTopRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.stepperTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={styles.stepperRef}>{reference}</Text>
        </View>

        <View style={styles.stepperControls}>
          <TouchableOpacity
            style={[styles.stepBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}
            onPress={() => adjust(-step)}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={16} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.stepValueBox}>
            <TextInput
              style={[styles.stepValueInput, { color: '#2563EB' }]}
              value={value}
              onChangeText={(txt) => onChange(txt.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              maxLength={3}
            />
            <Text style={styles.stepUnitText}>{unit}</Text>
          </View>

          <TouchableOpacity
            style={[styles.stepBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}
            onPress={() => adjust(step)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const ThresholdsConfigModal: React.FC<ThresholdsConfigModalProps> = ({
  visible,
  hrHigh,
  hrLow,
  spo2Low,
  onChangeHrHigh,
  onChangeHrLow,
  onChangeSpo2Low,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <SmartBaseModal
    visible={visible}
    title="Cấu Hình Ngưỡng Y Tế"
    iconName="pulse-outline"
    iconColor="#2563EB"
    onClose={onClose}
    isDarkMode={isDarkMode}
    colors={colors}
  >
    <Text style={styles.fieldLabel}>Gói ngưỡng cấu hình sẵn</Text>
    <View style={styles.chipsWrap}>
      {THRESHOLD_PRESETS.map((p) => {
        const active = hrHigh === p.hrHigh && hrLow === p.hrLow && spo2Low === p.spo2Low;
        return (
          <TouchableOpacity
            key={p.label}
            style={[
              styles.templateChip,
              {
                backgroundColor: active ? '#2563EB' : isDarkMode ? '#0F172A' : '#EFF6FF',
                borderColor: active ? '#2563EB' : '#93C5FD',
              },
            ]}
            onPress={() => {
              onChangeHrHigh(p.hrHigh);
              onChangeHrLow(p.hrLow);
              onChangeSpo2Low(p.spo2Low);
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.templateChipText, { color: active ? '#FFFFFF' : '#1D4ED8' }]}>{p.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <View style={{ marginTop: 10, gap: 10 }}>
      <ThresholdStepperRow
        title="Nhịp tim tối đa"
        reference="Ngưỡng tham chiếu an toàn: 90 – 120 bpm"
        unit="bpm"
        value={hrHigh}
        min={70}
        max={180}
        step={5}
        onChange={onChangeHrHigh}
        isDarkMode={isDarkMode}
        colors={colors}
      />
      <ThresholdStepperRow
        title="Nhịp tim tối thiểu"
        reference="Ngưỡng tham chiếu an toàn: 45 – 65 bpm"
        unit="bpm"
        value={hrLow}
        min={35}
        max={90}
        step={5}
        onChange={onChangeHrLow}
        isDarkMode={isDarkMode}
        colors={colors}
      />
      <ThresholdStepperRow
        title="SpO₂ tối thiểu"
        reference="Ngưỡng tham chiếu an toàn: 88% – 96%"
        unit="%"
        value={spo2Low}
        min={80}
        max={99}
        step={1}
        onChange={onChangeSpo2Low}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </View>

    <SubmitBtn title="Lưu Cấu Hình" onPress={onSave} loading={isSaving} />
  </SmartBaseModal>
);

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', padding: 14 },
  modalBox: { borderRadius: 18, padding: 16, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  modalTitleIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 10, marginBottom: 6 },
  subHintLabel: { fontSize: 11, color: '#64748B', marginTop: 8, marginBottom: 6 },
  inputField: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  inputFieldSmall: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12.5 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  templateChipText: { fontSize: 12, fontWeight: '600' },
  allergyChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1.2 },
  allergyChipText: { fontSize: 12, fontWeight: '600' },
  customAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  customAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  presetPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetPillText: { fontSize: 11.5, fontWeight: '700', color: '#2563EB' },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  datePickerValue: { fontSize: 13.5, fontWeight: '700' },
  pickerPanel: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  dateStepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  miniStepBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pickerDateTitle: { fontSize: 14.5, fontWeight: '800' },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekCell: { width: '14.285%', alignItems: 'center' },
  calWeekText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: '14.285%', height: 29, alignItems: 'center', justifyContent: 'center' },
  calDayCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  calDayText: { fontSize: 12.5, fontWeight: '700' },
  pickerSectionLabel: { fontSize: 11.5, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  timeSlotChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  severityPickerRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  severityOptionBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10, borderWidth: 1.2 },
  severityOptionText: { fontSize: 11.5, fontWeight: '700' },
  stepperCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  stepperTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stepperTitle: { fontSize: 13.5, fontWeight: '700' },
  stepperRef: { fontSize: 11, color: '#64748B', marginTop: 2 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  stepBtn: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValueBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexShrink: 0 },
  stepValueInput: { fontSize: 15, fontWeight: '800', textAlign: 'center', width: 40, padding: 0 },
  stepUnitText: { fontSize: 11, fontWeight: '600', color: '#64748B', marginLeft: 2 },
  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
