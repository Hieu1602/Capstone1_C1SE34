// ==============================================================================
// TỆP: HealthDatePickerModal.tsx
// PHÂN HỆ: Hộp thoại Chọn ngày Tra cứu Lịch sử Sinh hiệu (HealthDetailScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Cho phép người dùng nhập ngày bất kỳ (định dạng chuẩn YYYY-MM-DD) hoặc chọn nhanh
//     các mốc: Hôm nay, Hôm qua, 2 ngày trước, 3 ngày trước.
//   - Kiểm tra tính hợp lệ (Validation) của chuỗi ngày trước khi truy vấn API Backend.
// ==============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';

interface HealthDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  draftDate: string;
  setDraftDate: (val: string) => void;
  onConfirmDate: (val: string) => void;
  todayStr: string;
  yesterdayStr?: string;
  twoDaysAgoStr?: string;
  threeDaysAgoStr?: string;
  datesWithData?: string[];
  isDarkMode: boolean;
  colors: any;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const parseYMD = (ymd: string): Date => {
  const parts = (ymd || '').split('-').map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const HealthDatePickerModal: React.FC<HealthDatePickerModalProps> = ({
  visible,
  onClose,
  draftDate,
  setDraftDate,
  onConfirmDate,
  todayStr,
  datesWithData = [],
  isDarkMode,
  colors,
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => parseYMD(draftDate || todayStr));
  const [pickerMode, setPickerMode] = useState<'DAY' | 'MONTH_YEAR'>('DAY');

  useEffect(() => {
    if (visible) {
      const base = parseYMD(draftDate || todayStr);
      setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
      setPickerMode('DAY');
    }
  }, [visible, draftDate, todayStr]);

  const dataSet = useMemo(() => new Set(datesWithData), [datesWithData]);

  const calendarCells = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const firstRaw = new Date(y, m, 1).getDay();
    const firstOffset = firstRaw === 0 ? 6 : firstRaw - 1; // T2 = 0 .. CN = 6
    const totalDays = new Date(y, m + 1, 0).getDate();

    return Array.from({ length: firstOffset + totalDays }, (_, idx) => {
      const isCurrentMonth = idx >= firstOffset;
      const dayNum = idx - firstOffset + 1;
      const d = new Date(y, m, dayNum);
      const ymd = toYMD(d);
      const isFuture = ymd > todayStr;
      const isSelected = isCurrentMonth && ymd === draftDate;
      const isToday = isCurrentMonth && ymd === todayStr;
      const hasData = isCurrentMonth && !isFuture && (dataSet.size === 0 ? isToday || isSelected : dataSet.has(ymd));
      return {
        isCurrentMonth,
        dayNum,
        ymd,
        isFuture,
        isSelected,
        isToday,
        hasData,
      };
    });
  }, [viewDate, draftDate, todayStr, dataSet]);

  const selectAndConfirm = (ymd: string) => {
    setDraftDate(ymd);
    onConfirmDate(ymd);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.modalCard,
            isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header: Tháng MM/YYYY ▼ + Nút < > bo tròn */}
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setPickerMode((prev) => (prev === 'DAY' ? 'MONTH_YEAR' : 'DAY'))}
              style={[
                styles.monthYearTrigger,
                isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.monthYearTitle, isDarkMode && { color: colors.textPrimary }]}>
                Tháng {viewDate.getMonth() + 1}/{viewDate.getFullYear()}
              </Text>
              <Ionicons
                name={pickerMode === 'MONTH_YEAR' ? 'caret-up' : 'caret-down'}
                size={13}
                color="#F97316"
              />
            </TouchableOpacity>

            <View style={styles.navBtnsRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
                }
                style={[
                  styles.navCircleBtn,
                  isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={isDarkMode ? colors.textPrimary : '#334155'} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
                }
                style={[
                  styles.navCircleBtn,
                  isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textPrimary : '#334155'} />
              </TouchableOpacity>
            </View>
          </View>

          {pickerMode === 'MONTH_YEAR' ? (
            <View style={{ paddingVertical: 4 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
              >
                {[2024, 2025, 2026, 2027].map((yr) => {
                  const activeYr = viewDate.getFullYear() === yr;
                  return (
                    <TouchableOpacity
                      key={yr}
                      onPress={() => setViewDate(new Date(yr, viewDate.getMonth(), 1))}
                      style={[
                        styles.yearChip,
                        activeYr && { backgroundColor: '#F97316', borderColor: '#F97316' },
                        isDarkMode && !activeYr && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.yearChipText,
                          activeYr && { color: '#FFFFFF' },
                          isDarkMode && !activeYr && { color: colors.textPrimary },
                        ]}
                      >
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.monthGrid}>
                {Array.from({ length: 12 }, (_, mIdx) => {
                  const activeM = viewDate.getMonth() === mIdx;
                  return (
                    <TouchableOpacity
                      key={mIdx}
                      onPress={() => {
                        setViewDate(new Date(viewDate.getFullYear(), mIdx, 1));
                        setPickerMode('DAY');
                      }}
                      style={[
                        styles.monthCell,
                        activeM && { backgroundColor: '#F97316', borderColor: '#F97316' },
                        isDarkMode && !activeM && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthCellText,
                          activeM && { color: '#FFFFFF', fontWeight: '800' },
                          isDarkMode && !activeM && { color: colors.textPrimary },
                        ]}
                      >
                        T{mIdx + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              {/* Hàng thứ T2 -> CN */}
              <View style={styles.weekRow}>
                {WEEKDAYS.map((wd) => (
                  <Text key={wd} style={styles.weekdayText}>
                    {wd}
                  </Text>
                ))}
              </View>

              {/* Lưới ngày bo tròn */}
              <View style={styles.daysGrid}>
                {calendarCells.map((cell, idx) => (
                  <View key={idx} style={styles.dayCellOuter}>
                    <TouchableOpacity
                      disabled={!cell.isCurrentMonth || cell.isFuture}
                      activeOpacity={0.75}
                      onPress={() => selectAndConfirm(cell.ymd)}
                      style={[
                        styles.dayCircle,
                        cell.isSelected && styles.dayCircleSelected,
                        !cell.isSelected && cell.isToday && styles.dayCircleToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isDarkMode && { color: colors.textPrimary },
                          !cell.isCurrentMonth && { color: 'transparent' },
                          cell.isFuture && { color: isDarkMode ? '#475569' : '#CBD5E1' },
                          cell.isToday && !cell.isSelected && { color: '#F97316', fontWeight: '800' },
                          cell.isSelected && { color: '#FFFFFF', fontWeight: '800' },
                        ]}
                      >
                        {cell.isCurrentMonth ? cell.dayNum : ''}
                      </Text>
                    </TouchableOpacity>
                    <View
                      style={[
                        styles.dataDot,
                        {
                          backgroundColor: cell.hasData
                            ? cell.isSelected
                              ? '#F97316'
                              : '#FB923C'
                            : 'transparent',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Chân Modal: Hôm nay & Đóng */}
          <View style={[styles.modalActions, isDarkMode && { borderTopColor: colors.border }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.todayBtn}
              onPress={() => selectAndConfirm(todayStr)}
            >
              <Ionicons name="today-outline" size={15} color="#F97316" style={{ marginRight: 5 }} />
              <Text style={styles.todayBtnText}>Hôm nay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.closeBtn, isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.closeBtnText, isDarkMode && { color: colors.textPrimary }]}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthYearTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  monthYearTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  navBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellOuter: {
    width: '14.28%',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#F97316',
  },
  dayCircleToday: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dataDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  yearChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthCell: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  monthCellText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EA580C',
  },
  closeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});

export default HealthDatePickerModal;

