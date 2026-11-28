// AppointmentComponents.tsx
// Tập hợp các Component hiển thị thông tin Lịch khám:
// 1. AppointmentStatsSummary: Thống kê 4 ô & bộ lọc trạng thái (Tổng, Sắp tới, Đã khám, Đã hủy)
// 2. WeekCalendarStrip: Dải chọn 7 ngày trong tuần nằm ngang kèm chấm trạng thái ca khám (Ảnh 2 & 3)
// 3. AppointmentCard: Thẻ hiển thị lịch hẹn theo dòng thời gian (Vertical Timeline - Ảnh 4)

import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { AppointmentItem, getPatientAvatarUrl } from './types';
import { AppointmentHistoryLine } from './AppointmentHistoryLine';
import {
  toLocalYMD,
  isTodayLocal,
  isSameLocalDay,
  getLocalToday,
  getCleanAppointmentTitle,
  isAppointmentFamilyConfirmed,
  stripDoctorAppointmentTags,
} from '../utils/dateUtils';

// =============================================================
// 1. THỐNG KÊ LỊCH HẸN & BỘ LỌC (AppointmentStatsSummary)
// =============================================================
export interface AppointmentStatsSummaryProps {
  totalCount: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount?: number;
  filterTab: 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  onFilterChange: (tab: 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED') => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentStatsSummary: React.FC<AppointmentStatsSummaryProps> = ({
  totalCount,
  upcomingCount,
  completedCount,
  cancelledCount = 0,
  filterTab,
  onFilterChange,
  isDarkMode,
}) => {
  const stats = [
    { key: 'total', icon: 'calendar', color: '#2563EB', bg: '#EFF6FF', border: '#3B82F633', label: 'Tổng lịch', count: totalCount },
    { key: 'upcoming', icon: 'time', color: '#D97706', bg: '#FFFBEB', border: '#F59E0B33', label: 'Sắp tới', count: upcomingCount },
    { key: 'completed', icon: 'checkmark-circle', color: '#059669', bg: '#ECFDF5', border: '#10B98133', label: 'Đã khám', count: completedCount },
    { key: 'cancelled', icon: 'close-circle', color: '#DC2626', bg: '#FEF2F2', border: '#EF444433', label: 'Đã hủy', count: cancelledCount },
  ];

  return (
    <View style={styles.statsSummaryWrap}>
      <View style={styles.summaryGrid}>
        {stats.map((s) => (
          <TouchableOpacity
            key={s.key}
            activeOpacity={0.8}
            onPress={() => {
              if (s.key === 'total') onFilterChange('ALL');
              else if (s.key === 'upcoming') onFilterChange('UPCOMING');
              else if (s.key === 'completed') onFilterChange('COMPLETED');
              else if (s.key === 'cancelled') onFilterChange('CANCELLED');
            }}
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor:
                  (s.key === 'total' && filterTab === 'ALL') ||
                  (s.key === 'upcoming' && filterTab === 'UPCOMING') ||
                  (s.key === 'completed' && filterTab === 'COMPLETED') ||
                  (s.key === 'cancelled' && filterTab === 'CANCELLED')
                    ? s.color
                    : s.border,
              },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={15} color={s.color} />
            </View>
            <LocalizedText style={[styles.statNumber, { color: s.color }]} numberOfLines={1}>
              {s.count}
            </LocalizedText>
            <LocalizedText
              style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
              numberOfLines={1}
            >
              {s.label}
            </LocalizedText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        {[
          { key: 'ALL' as const, label: `Tất cả (${totalCount})` },
          { key: 'UPCOMING' as const, label: `Sắp tới (${upcomingCount})` },
          { key: 'COMPLETED' as const, label: `Đã khám (${completedCount})` },
          { key: 'CANCELLED' as const, label: `Đã hủy (${cancelledCount})` },
        ].map((tab) => {
          const active = filterTab === tab.key;
          const activeBg = tab.key === 'CANCELLED' ? '#DC2626' : '#2563EB';
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onFilterChange(tab.key)}
              activeOpacity={0.8}
              style={[
                styles.filterChip,
                active
                  ? { backgroundColor: activeBg }
                  : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' },
              ]}
            >
              <LocalizedText
                numberOfLines={1}
                style={[
                  styles.filterChipText,
                  active
                    ? { color: '#FFFFFF', fontWeight: '700' }
                    : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
                ]}
              >
                {tab.label}
              </LocalizedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// =============================================================
// 2. DẢI CHỌN NGÀY THEO TUẦN NẰM NGANG (WeekCalendarStrip - Ảnh 2 & 3)
// =============================================================
export interface WeekCalendarStripProps {
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
  appointments: AppointmentItem[];
  isDarkMode: boolean;
  colors: any;
}

export const WeekCalendarStrip: React.FC<WeekCalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  appointments,
  isDarkMode,
  colors,
}) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date());

  const getWeekMonday = (baseDate: Date) => {
    const d = new Date(baseDate);
    d.setHours(0, 0, 0, 0);
    const currentDay = d.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    d.setDate(d.getDate() + mondayOffset);
    return d;
  };

  const weekDays = useMemo(() => {
    const today = getLocalToday();
    const anchor = new Date(today);
    anchor.setDate(today.getDate() + weekOffset * 7);
    const monday = getWeekMonday(anchor);

    const days = [];
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d,
        label: labels[i],
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        dateYMD: toLocalYMD(d),
        isToday: isTodayLocal(d),
      });
    }
    return days;
  }, [weekOffset]);

  useEffect(() => {
    if (!selectedDate) return;
    const todayMonday = getWeekMonday(getLocalToday());
    const targetMonday = getWeekMonday(selectedDate);
    const diffWeeks = Math.round((targetMonday.getTime() - todayMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    setWeekOffset(diffWeeks);
  }, [selectedDate]);

  const getDotsForDate = (dateObj: Date) => {
    const dayStr = toLocalYMD(dateObj);
    const dayApts = appointments.filter((a) => {
      if (!a.scheduled_at) return false;
      return toLocalYMD(a.scheduled_at) === dayStr;
    });
    const dots: string[] = [];
    if (dayApts.some((a) => a.status === 'UPCOMING' || a.status === 'CONFIRMED')) dots.push('#F59E0B');
    if (dayApts.some((a) => a.status === 'COMPLETED')) dots.push('#10B981');
    if (dayApts.some((a) => a.status === 'CANCELLED')) dots.push('#EF4444');
    return dots;
  };

  const jumpToDateWeek = (targetDate: Date) => {
    const todayMonday = getWeekMonday(getLocalToday());
    const targetMonday = getWeekMonday(targetDate);
    const diffWeeks = Math.round((targetMonday.getTime() - todayMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    setWeekOffset(diffWeeks);
    onSelectDate(targetDate);
    setMonthModalVisible(false);
  };

  const monthCalendarDays = useMemo(() => {
    const y = calendarViewDate.getFullYear();
    const m = calendarViewDate.getMonth();
    const firstDayRaw = new Date(y, m, 1).getDay();
    const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1; // T2 = 0 ... CN = 6
    const totalDays = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: firstDay + totalDays }, (_, idx) => {
      const dayNum = idx - firstDay + 1;
      const d = new Date(y, m, dayNum);
      const isCurrent = idx >= firstDay;
      const dots = isCurrent ? getDotsForDate(d) : [];
      return {
        date: d,
        current: isCurrent,
        selected: isCurrent && selectedDate ? isSameLocalDay(d, selectedDate) : false,
        isToday: isCurrent && isTodayLocal(d),
        dots,
      };
    });
  }, [calendarViewDate, selectedDate, appointments]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return '';
    const first = weekDays[0];
    const last = weekDays[6];
    return `${String(first.dayNum).padStart(2, '0')}/${String(first.monthNum).padStart(2, '0')} - ${String(last.dayNum).padStart(2, '0')}/${String(last.monthNum).padStart(2, '0')}`;
  }, [weekDays]);

  return (
    <View style={styles.weekStripWrapper}>
      <View style={[styles.weekStripHeader, { flexWrap: 'wrap', gap: 6 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
          <TouchableOpacity
            onPress={() => {
              setCalendarViewDate(selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date());
              setMonthModalVisible(true);
            }}
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="calendar-outline" size={16} color="#2563EB" />
          </TouchableOpacity>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <LocalizedText style={[styles.weekStripTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {weekOffset === 0 ? 'Lịch tuần này' : weekOffset < 0 ? `Tuần trước (${Math.abs(weekOffset)})` : `Tuần sau (+${weekOffset})`}
            </LocalizedText>
            <LocalizedText style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', fontWeight: '600' }} numberOfLines={1}>
              {weekRangeLabel}
            </LocalizedText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 34,
              paddingHorizontal: 7,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            }}
          >
            <Ionicons name="chevron-back" size={13} color={colors.textPrimary} />
            <LocalizedText style={{ fontSize: 11, fontWeight: '600', color: colors.textPrimary }}>Tuần trước</LocalizedText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setWeekOffset(0);
              onSelectDate(null);
            }}
            style={{
              justifyContent: 'center',
              minHeight: 34,
              paddingHorizontal: 8,
              borderRadius: 8,
              backgroundColor: weekOffset === 0 && !selectedDate ? '#2563EB' : (isDarkMode ? '#1E293B' : '#EFF6FF'),
              borderWidth: 1,
              borderColor: weekOffset === 0 && !selectedDate ? '#2563EB' : '#BFDBFE',
            }}
          >
            <LocalizedText style={{ fontSize: 11, fontWeight: '700', color: weekOffset === 0 && !selectedDate ? '#FFFFFF' : '#2563EB' }}>
              Tuần này
            </LocalizedText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w + 1)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 34,
              paddingHorizontal: 7,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            }}
          >
            <LocalizedText style={{ fontSize: 11, fontWeight: '600', color: colors.textPrimary }}>Tuần sau</LocalizedText>
            <Ionicons name="chevron-forward" size={13} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {selectedDate && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isDarkMode ? '#1E3A8A' : '#DBEAFE',
            backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF',
          }}
        >
          <LocalizedText style={{ fontSize: 11.5, fontWeight: '600', color: isDarkMode ? '#93C5FD' : '#1E40AF' }}>
            Đang lọc ngày {String(selectedDate.getDate()).padStart(2, '0')}/{String(selectedDate.getMonth() + 1).padStart(2, '0')}
          </LocalizedText>
          <TouchableOpacity onPress={() => onSelectDate(null)} hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}>
            <LocalizedText style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? '#60A5FA' : '#2563EB' }}>
              Xem tất cả
            </LocalizedText>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={monthModalVisible} transparent animationType="fade" onRequestClose={() => setMonthModalVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setMonthModalVisible(false)}
        >
          <View
            style={{ width: '100%', maxWidth: 360, borderRadius: 16, padding: 16, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
                style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="chevron-back" size={18} color="#2563EB" />
              </TouchableOpacity>
              <LocalizedText style={{ fontSize: 14.5, fontWeight: '800', color: colors.textPrimary }}>
                Tháng {calendarViewDate.getMonth() + 1}/{calendarViewDate.getFullYear()}
              </LocalizedText>
              <TouchableOpacity
                onPress={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
                style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="chevron-forward" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 }}>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <LocalizedText key={d} style={{ width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#64748B' }}>{d}</LocalizedText>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthCalendarDays.map((dayItem, idx) => (
                <TouchableOpacity
                  key={idx}
                  disabled={!dayItem.current}
                  onPress={() => jumpToDateWeek(dayItem.date)}
                  style={{
                    width: '14.28%',
                    height: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 8,
                    backgroundColor: dayItem.selected ? '#2563EB' : dayItem.isToday ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : 'transparent',
                  }}
                >
                  <LocalizedText
                    style={{
                      fontSize: 12.5,
                      fontWeight: dayItem.selected || dayItem.isToday ? '800' : '600',
                      color: !dayItem.current ? 'transparent' : dayItem.selected ? '#FFFFFF' : dayItem.isToday ? '#2563EB' : colors.textPrimary,
                    }}
                  >
                    {dayItem.current ? dayItem.date.getDate() : ''}
                  </LocalizedText>
                  {dayItem.dots.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
                      {dayItem.dots.slice(0, 3).map((dc, di) => (
                        <View key={di} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dayItem.selected ? '#FFFFFF' : dc }} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setWeekOffset(0);
                  onSelectDate(null);
                  setMonthModalVisible(false);
                }}
              >
                <LocalizedText style={{ color: '#2563EB', fontWeight: '700', fontSize: 12 }}>Về tuần này</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMonthModalVisible(false)}>
                <LocalizedText style={{ color: '#64748B', fontWeight: '700', fontSize: 12 }}>Đóng</LocalizedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.weekDaysRow}>
        {weekDays.map((item) => {
          const isSelected = selectedDate ? isSameLocalDay(item.date, selectedDate) : false;
          const dots = getDotsForDate(item.date);
          return (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.8}
              onPress={() => {
                if (isSelected) {
                  onSelectDate(null);
                } else {
                  onSelectDate(item.date);
                }
              }}
              style={[
                styles.dayCard,
                isSelected
                  ? styles.dayCardSelected
                  : {
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderColor: item.isToday ? '#2563EB' : (isDarkMode ? '#334155' : '#E2E8F0'),
                    },
              ]}
            >
              <LocalizedText
                style={[
                  styles.dayLabelText,
                  isSelected
                    ? { color: '#BFDBFE', fontWeight: '700' }
                    : { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {item.label}
              </LocalizedText>
              <LocalizedText
                style={[
                  styles.dayNumText,
                  isSelected
                    ? { color: '#FFFFFF', fontWeight: '800' }
                    : { color: colors.textPrimary, fontWeight: item.isToday ? '800' : '600' },
                ]}
              >
                {item.dayNum}
              </LocalizedText>

              <View style={styles.dotsRow}>
                {dots.length > 0 ? (
                  dots.map((dotColor, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.statusDotSmall,
                        { backgroundColor: isSelected ? '#FFFFFF' : dotColor },
                      ]}
                    />
                  ))
                ) : (
                  <View style={[styles.statusDotSmall, { backgroundColor: 'transparent' }]} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// =============================================================
// 3. CARD LỊCH HẸN DÒNG THỜI GIAN (Vertical Timeline - Ảnh 4)
// =============================================================
export interface AppointmentCardProps {
  appointment: AppointmentItem;
  isFirst?: boolean;
  isLast?: boolean;
  isCurrentOrNext?: boolean;
  isOverdue?: boolean;
  onViewPatient: (patientId: string) => void;
  onConfirm?: (aptId: string) => void;
  onMarkCompleted: (aptId: string) => void;
  onEdit: (apt: AppointmentItem) => void;
  onCancel?: (apt: AppointmentItem) => void;
  onDelete: (aptId: string, examType: string) => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment: apt,
  isFirst = false,
  isLast = false,
  isCurrentOrNext = false,
  isOverdue = false,
  onViewPatient,
  onConfirm,
  onMarkCompleted,
  onEdit,
  onCancel,
  onDelete,
  isDarkMode,
  colors,
}) => {
  const isUpcoming = apt.status === 'UPCOMING' || apt.status === 'CONFIRMED';
  const isCompleted = apt.status === 'COMPLETED';
  const isCancelled = apt.status === 'CANCELLED';
  const isFamilyRequested = Boolean(apt.created_by && apt.doctor_id && String(apt.created_by) !== String(apt.doctor_id));
  const isFamilyConfirmed = isAppointmentFamilyConfirmed(apt);

  const cleanInstructions = stripDoctorAppointmentTags(
    apt.instructions || (isFamilyRequested ? apt.clinical_notes : '')
  );
  const initial = (apt.patient_name || 'B').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'B';
  const isHomeVisit = apt.visit_type === 'HOME_VISIT' || apt.exam_type === 'HOME_VISIT';

  const getExamDisplayTitle = () => getCleanAppointmentTitle(apt);

  const recurrenceLabel =
    apt.recurrence_pattern === 'WEEKLY'
      ? 'Hàng tuần'
      : apt.recurrence_pattern === 'MONTHLY'
      ? 'Hàng tháng'
      : apt.recurrence_pattern === 'QUARTERLY'
      ? 'Hàng quý'
      : null;

  const timeFormatted = (() => {
    if (!apt.scheduled_at) return { time: '--:--', dateStr: '--' };
    try {
      const d = new Date(apt.scheduled_at);
      if (isNaN(d.getTime())) return { time: apt.scheduled_at, dateStr: '--' };
      const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      return { time, dateStr };
    } catch {
      return { time: '--:--', dateStr: '--' };
    }
  })();

  const nodeColor = isCompleted ? '#059669' : isUpcoming ? '#2563EB' : '#DC2626';

  return (
    <View style={styles.timelineRow}>
      {/* CỘT MỐC GIỜ BÊN TRÁI (TIMELINE AXIS - Ảnh 4) */}
      <View style={styles.timelineAxisCol}>
        <LocalizedText style={[styles.timelineTimeText, { color: colors.textPrimary }]}>
          {timeFormatted.time}
        </LocalizedText>
        <LocalizedText style={[styles.timelineDateText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          {timeFormatted.dateStr}
        </LocalizedText>

        <View style={styles.timelineTrackWrap}>
          {!isFirst && <View style={[styles.timelineTrackLine, { backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }]} />}
          <View
            style={[
              styles.timelineNode,
              {
                borderColor: nodeColor,
                backgroundColor: isUpcoming ? '#EFF6FF' : isCompleted ? '#ECFDF5' : '#FEF2F2',
              },
            ]}
          >
            <View style={[styles.timelineNodeCore, { backgroundColor: nodeColor }]} />
          </View>
          {!isLast && <View style={[styles.timelineTrackLine, { backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }]} />}
        </View>
      </View>

      {/* THẺ CA KHÁM BÊN PHẢI TRỤC (Ảnh 4) */}
      <View style={{ flex: 1, minWidth: 0, paddingBottom: 16 }}>
        {isCurrentOrNext && (
          <View style={styles.nowIndicatorRow}>
            <View style={styles.nowBadge}>
              <View style={styles.nowDot} />
              <LocalizedText style={styles.nowBadgeText}>BÂY GIỜ</LocalizedText>
            </View>
            <View style={[styles.nowDashedLine, { borderColor: isDarkMode ? '#10B98166' : '#10B98199' }]} />
          </View>
        )}

        <View
          style={[
            styles.aptCard,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isUpcoming ? '#3B82F644' : isCompleted ? '#10B98133' : '#EF444433',
            },
          ]}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.examTypeHeader}>
              <Ionicons
                name={isHomeVisit ? 'home' : apt.visit_type === 'TELEHEALTH' ? 'videocam' : 'business'}
                size={14}
                color="#2563EB"
                style={{ marginRight: 5 }}
              />
              <LocalizedText style={[styles.examTypeHeaderText, { color: colors.textPrimary }]} numberOfLines={1}>
                {getExamDisplayTitle()}
              </LocalizedText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {recurrenceLabel && (
                <View style={styles.recurrencePill}>
                  <Ionicons name="repeat" size={10} color="#7C3AED" style={{ marginRight: 2 }} />
                  <LocalizedText style={styles.recurrencePillText}>{recurrenceLabel}</LocalizedText>
                </View>
              )}

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isUpcoming
                      ? isOverdue
                        ? isDarkMode
                          ? '#7C2D1266'
                          : '#FFF7ED'
                        : apt.status === 'CONFIRMED'
                        ? isDarkMode
                          ? '#064E3B66'
                          : '#D1FAE5'
                        : isDarkMode
                        ? '#78350F55'
                        : '#FEF3C7'
                      : isCompleted
                      ? isDarkMode
                        ? '#064E3B66'
                        : '#D1FAE5'
                      : isDarkMode
                      ? '#7F1D1D55'
                      : '#FEE2E2',
                  },
                ]}
              >
                <LocalizedText
                  style={[
                    styles.statusPillText,
                    {
                      color: isUpcoming
                        ? isOverdue
                          ? isDarkMode
                            ? '#FDBA74'
                            : '#C2410C'
                          : apt.status === 'CONFIRMED'
                          ? isDarkMode
                            ? '#34D399'
                            : '#059669'
                          : isDarkMode
                          ? '#FBBF24'
                          : '#D97706'
                        : isCompleted
                        ? isDarkMode
                          ? '#34D399'
                          : '#059669'
                        : isDarkMode
                        ? '#FCA5A5'
                        : '#DC2626',
                    },
                  ]}
                >
                  {isUpcoming
                    ? isOverdue
                      ? 'QUÁ GIỜ'
                      : apt.status === 'CONFIRMED'
                      ? 'ĐÃ XÁC NHẬN'
                      : 'SẮP TỚI'
                    : isCompleted
                    ? 'ĐÃ KHÁM XONG'
                    : 'ĐÃ HỦY'}
                </LocalizedText>
              </View>
            </View>
          </View>

          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              {apt.patient_avatar_url || (apt.patient_name && apt.patient_name.includes('Nguyễn Văn A')) ? (
                <Image
                  source={{
                    uri: getPatientAvatarUrl(
                      apt.patient_avatar_url || '/static/faces/fc51dc68-3ea2-4394-ac4b-906364ae425d.jpg'
                    )!,
                  }}
                  style={styles.patientAvatarImg}
                  resizeMode="cover"
                />
              ) : (
                <LocalizedText style={styles.patientAvatarText}>{initial}</LocalizedText>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
              <LocalizedText style={[styles.patientName, { color: colors.textPrimary }]}>
                {apt.patient_name}
              </LocalizedText>
              {apt.location ? (
                <LocalizedText
                  style={[styles.aptMetaText, { color: isDarkMode ? '#94A3B8' : '#64748B', lineHeight: 17 }]}
                >
                  📍 {apt.location}
                </LocalizedText>
              ) : null}
            </View>
          </View>

          {cleanInstructions ? (
            <View style={[styles.instructionsBox, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC' }]}>
              <LocalizedText style={[styles.instructionsText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                📝 <LocalizedText style={{ fontWeight: '700' }}>Dặn dò:</LocalizedText> {cleanInstructions}
              </LocalizedText>
            </View>
          ) : null}

          {isCancelled && apt.cancellation_reason ? (
            <View
              style={[
                styles.cancelReasonBox,
                { backgroundColor: isDarkMode ? '#450A0A44' : '#FEF2F2', borderColor: '#EF444444' },
              ]}
            >
              <Ionicons name="alert-circle" size={14} color="#DC2626" style={{ marginRight: 5, marginTop: 1 }} />
              <LocalizedText
                style={[styles.cancelReasonText, { color: isDarkMode ? '#FCA5A5' : '#B91C1C' }]}
              >
                <LocalizedText style={{ fontWeight: '700' }}>Lý do hủy:</LocalizedText> {apt.cancellation_reason}
              </LocalizedText>
            </View>
          ) : null}

          <AppointmentHistoryLine
            appointmentId={apt.id}
            lastEvent={apt.last_event}
            createdAt={apt.created_at}
            isDarkMode={isDarkMode}
          />

          {isUpcoming && (
            <View style={styles.metaBadgesRow}>
              <View
                style={[
                  styles.familyBadge,
                  isFamilyConfirmed
                    ? {
                        backgroundColor: isDarkMode ? '#064E3B66' : '#ECFDF5',
                        borderColor: isDarkMode ? '#10B98166' : '#10B98155',
                      }
                    : {
                        backgroundColor: isDarkMode ? '#78350F55' : '#FEF3C7',
                        borderColor: isDarkMode ? '#F59E0B66' : '#F59E0B66',
                      },
                ]}
              >
                <Ionicons
                  name={isFamilyConfirmed ? 'checkmark-circle' : 'hourglass-outline'}
                  size={12}
                  color={isFamilyConfirmed ? (isDarkMode ? '#34D399' : '#059669') : (isDarkMode ? '#FBBF24' : '#D97706')}
                  style={{ marginRight: 4 }}
                />
                <LocalizedText
                  style={[
                    styles.familyBadgeText,
                    { color: isFamilyConfirmed ? (isDarkMode ? '#6EE7B7' : '#047857') : (isDarkMode ? '#FDE68A' : '#92400E') },
                  ]}
                >
                  {isFamilyConfirmed
                    ? isFamilyRequested
                      ? 'Bác sĩ đã xác nhận lịch'
                      : 'Gia đình đã xác nhận đón tiếp'
                    : isFamilyRequested
                      ? 'Gia đình yêu cầu — Chờ BS xác nhận'
                      : 'Chờ gia đình xác nhận'}
                </LocalizedText>
              </View>
            </View>
          )}

          <View style={[styles.actionGroup, { borderTopColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
            {isUpcoming && isFamilyRequested && apt.status === 'UPCOMING' && onConfirm && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btnComplete, { backgroundColor: '#0284C7', shadowColor: '#0284C7' }]}
                  onPress={() => onConfirm(apt.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <LocalizedText style={styles.btnCompleteText} numberOfLines={1}>
                    Xác nhận
                  </LocalizedText>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.btnViewPatient,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF', borderColor: isDarkMode ? '#334155' : '#BFDBFE' },
                ]}
                onPress={() => onViewPatient(apt.patient_id)}
                activeOpacity={0.75}
              >
                <Ionicons name="document-text" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                <LocalizedText style={styles.btnViewPatientText} numberOfLines={1}>
                  Hồ sơ
                </LocalizedText>
              </TouchableOpacity>

              {isUpcoming && (
                <TouchableOpacity
                  style={styles.btnComplete}
                  onPress={() => onMarkCompleted(apt.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <LocalizedText style={styles.btnCompleteText} numberOfLines={1}>
                    Đã khám
                  </LocalizedText>
                </TouchableOpacity>
              )}

              {!isUpcoming && (
                <TouchableOpacity
                  style={[
                    styles.btnDelete,
                    { backgroundColor: isDarkMode ? '#450A0A55' : '#FEE2E2', borderColor: isDarkMode ? '#7F1D1D55' : '#FECACA' },
                  ]}
                  onPress={() => onDelete(apt.id, apt.exam_type || 'Khám bệnh')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="trash-outline" size={15} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>

            {isUpcoming && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.btnSecondaryAction,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#475569' : '#CBD5E1' },
                  ]}
                  onPress={() => onEdit(apt)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={14} color={isDarkMode ? '#E2E8F0' : '#334155'} style={{ marginRight: 5 }} />
                  <LocalizedText style={[styles.btnSecondaryText, { color: isDarkMode ? '#E2E8F0' : '#334155' }]} numberOfLines={1}>
                    Dời lịch
                  </LocalizedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnSecondaryAction,
                    { backgroundColor: isDarkMode ? '#450A0A44' : '#FFFFFF', borderColor: isDarkMode ? '#7F1D1D' : '#FECACA' },
                  ]}
                  onPress={() => (onCancel ? onCancel(apt) : onDelete(apt.id, apt.exam_type || 'Khám bệnh'))}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close-circle-outline" size={15} color="#DC2626" style={{ marginRight: 5 }} />
                  <LocalizedText style={[styles.btnSecondaryText, { color: isDarkMode ? '#FCA5A5' : '#DC2626' }]} numberOfLines={1}>
                    Hủy lịch
                  </LocalizedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statsSummaryWrap: {
    width: '100%',
    minWidth: 0,
  },
  summaryGrid: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
    marginBottom: 10,
    gap: 6,
  },
  summaryCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    minWidth: 0,
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    flexGrow: 1,
    paddingHorizontal: 8,
    minHeight: 38,
    paddingVertical: 6,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipText: { fontSize: 12 },

  // Week Calendar Strip Styles
  weekStripWrapper: {
    width: '100%',
    minWidth: 0,
    marginTop: 4,
    marginBottom: 4,
  },
  weekStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekStripTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  weekDaysRow: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
    gap: 5,
  },
  dayCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dayLabelText: {
    fontSize: 10.5,
    marginBottom: 3,
  },
  dayNumText: {
    fontSize: 16,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    minHeight: 5,
    alignItems: 'center',
  },
  statusDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Timeline Layout Styles
  timelineRow: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
  },
  timelineAxisCol: {
    width: 54,
    flexShrink: 0,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineTimeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  timelineDateText: {
    fontSize: 10,
    marginTop: 1,
    fontWeight: '600',
  },
  timelineTrackWrap: {
    flex: 1,
    alignItems: 'center',
    marginTop: 6,
    width: 20,
  },
  timelineTrackLine: {
    width: 2,
    flex: 1,
  },
  timelineNode: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  timelineNodeCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nowIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  nowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  nowBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nowDashedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },

  // Appointment Card
  aptCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  examTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  examTypeHeaderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  patientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  patientAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  patientName: { fontSize: 15, fontWeight: '800' },
  aptMetaText: { fontSize: 11.5, marginTop: 2 },
  instructionsBox: { borderRadius: 10, padding: 9, marginBottom: 8 },
  instructionsText: { fontSize: 12, lineHeight: 17 },
  metaBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  familyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    minHeight: 26,
    borderRadius: 8,
    borderWidth: 1,
  },
  familyBadgeText: { fontSize: 11, fontWeight: '700' },
  actionGroup: {
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnViewPatient: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnViewPatientText: { fontSize: 12.5, color: '#2563EB', fontWeight: '700' },
  btnComplete: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  btnCompleteText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  btnSecondaryAction: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 12.5, fontWeight: '700' },
  btnDelete: {
    width: 44,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurrencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  recurrencePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  cancelReasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  cancelReasonText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
});
