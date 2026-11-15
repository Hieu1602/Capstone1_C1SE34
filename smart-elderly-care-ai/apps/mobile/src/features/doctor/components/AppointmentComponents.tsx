// AppointmentComponents.tsx
// Tập hợp các Component hiển thị thông tin Lịch khám:
// 1. AppointmentStatsSummary: Thống kê 4 ô & bộ lọc trạng thái (Tổng, Sắp tới, Đã khám, Đã hủy)
// 2. WeekCalendarStrip: Dải chọn 7 ngày trong tuần nằm ngang kèm chấm trạng thái ca khám (Ảnh 2 & 3)
// 3. AppointmentCard: Thẻ hiển thị lịch hẹn theo dòng thời gian (Vertical Timeline - Ảnh 4)

import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { AppointmentItem, getPatientAvatarUrl } from './types';

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
    { key: 'completed', icon: 'checkmark-done', color: '#059669', bg: '#ECFDF5', border: '#10B98133', label: 'Đã khám', count: completedCount },
    { key: 'cancelled', icon: 'close-circle', color: '#DC2626', bg: '#FEF2F2', border: '#EF444433', label: 'Đã hủy', count: cancelledCount },
  ];

  return (
    <View>
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
            <LocalizedText style={[styles.statNumber, { color: s.color }]}>{s.count}</LocalizedText>
            <LocalizedText style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              {s.label}
            </LocalizedText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
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
              style={[
                styles.filterChip,
                active
                  ? { backgroundColor: activeBg, shadowColor: activeBg, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 }
                  : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' },
              ]}
            >
              <LocalizedText
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
      </ScrollView>
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
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0: CN, 1: T2...
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const days = [];
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d,
        label: labels[i],
        dayNum: d.getDate(),
        dateString: d.toDateString(),
        isToday: d.toDateString() === today.toDateString(),
      });
    }
    return days;
  }, []);

  const getDotsForDate = (dateObj: Date) => {
    const dayStr = dateObj.toISOString().slice(0, 10);
    const dayApts = appointments.filter((a) => a.scheduled_at && a.scheduled_at.startsWith(dayStr));
    const dots: string[] = [];
    if (dayApts.some((a) => a.status === 'UPCOMING')) dots.push('#F59E0B');
    if (dayApts.some((a) => a.status === 'COMPLETED')) dots.push('#10B981');
    if (dayApts.some((a) => a.status === 'CANCELLED')) dots.push('#EF4444');
    return dots;
  };

  return (
    <View style={styles.weekStripWrapper}>
      <View style={styles.weekStripHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="calendar-outline" size={15} color="#2563EB" />
          <LocalizedText style={[styles.weekStripTitle, { color: colors.textPrimary }]}>
            Lịch tuần này
          </LocalizedText>
        </View>
        {selectedDate && (
          <TouchableOpacity onPress={() => onSelectDate(null)} hitSlop={8}>
            <LocalizedText style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
              Xem tất cả
            </LocalizedText>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekDaysRow}
      >
        {weekDays.map((item) => {
          const isSelected = selectedDate ? item.dateString === selectedDate.toDateString() : false;
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
      </ScrollView>
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
  onViewPatient: (patientId: string) => void;
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
  onViewPatient,
  onMarkCompleted,
  onEdit,
  onCancel,
  onDelete,
  isDarkMode,
  colors,
}) => {
  const isUpcoming = apt.status === 'UPCOMING';
  const isCompleted = apt.status === 'COMPLETED';
  const isCancelled = apt.status === 'CANCELLED';
  const isFamilyConfirmed = (apt.clinical_notes || '').includes('[ĐÃ XÁC NHẬN ĐÓN TIẾP]');

  const cleanInstructions = (apt.instructions || '')
    .replace(/\[ĐÃ XÁC NHẬN ĐÓN TIẾP\]/g, '')
    .trim();
  const initial = (apt.patient_name || 'B').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'B';
  const isHomeVisit = apt.visit_type === 'HOME_VISIT' || apt.exam_type === 'HOME_VISIT';

  const getExamDisplayTitle = () => {
    if (apt.exam_type && apt.exam_type !== 'HOME_VISIT' && apt.exam_type !== 'CLINIC') {
      return apt.exam_type;
    }
    if (isHomeVisit) {
      return 'Khám bệnh tại nhà';
    }
    if (apt.visit_type === 'CLINIC' || apt.exam_type === 'CLINIC') {
      return 'Khám tại phòng khám SECA';
    }
    return 'Khám tổng quát định kỳ';
  };

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
      <View style={{ flex: 1, paddingBottom: 16 }}>
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
                name={isHomeVisit ? 'home' : 'business'}
                size={14}
                color="#2563EB"
                style={{ marginRight: 5 }}
              />
              <LocalizedText style={[styles.examTypeHeaderText, { color: colors.textPrimary }]} numberOfLines={1}>
                {getExamDisplayTitle()}
              </LocalizedText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {recurrenceLabel && (
                <View style={styles.recurrencePill}>
                  <Ionicons name="repeat" size={10} color="#7C3AED" style={{ marginRight: 2 }} />
                  <LocalizedText style={styles.recurrencePillText}>{recurrenceLabel}</LocalizedText>
                </View>
              )}

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: isUpcoming ? '#FEF3C7' : isCompleted ? '#D1FAE5' : '#FEE2E2' },
                ]}
              >
                <LocalizedText
                  style={[
                    styles.statusPillText,
                    { color: isUpcoming ? '#D97706' : isCompleted ? '#059669' : '#DC2626' },
                  ]}
                >
                  {isUpcoming ? 'SẮP TỚI' : isCompleted ? 'ĐÃ KHÁM XONG' : 'ĐÃ HỦY'}
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
            <View style={{ flex: 1, marginLeft: 10 }}>
              <LocalizedText style={[styles.patientName, { color: colors.textPrimary }]}>
                {apt.patient_name}
              </LocalizedText>
              {apt.location ? (
                <LocalizedText
                  style={[styles.aptMetaText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
                  numberOfLines={1}
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

          {isUpcoming && (
            <View style={styles.metaBadgesRow}>
              <View
                style={[
                  styles.familyBadge,
                  isFamilyConfirmed
                    ? { backgroundColor: '#ECFDF5', borderColor: '#10B98155' }
                    : { backgroundColor: '#FEF3C7', borderColor: '#F59E0B66' },
                ]}
              >
                <Ionicons
                  name={isFamilyConfirmed ? 'checkmark-circle' : 'hourglass-outline'}
                  size={12}
                  color={isFamilyConfirmed ? '#059669' : '#D97706'}
                  style={{ marginRight: 4 }}
                />
                <LocalizedText
                  style={[
                    styles.familyBadgeText,
                    { color: isFamilyConfirmed ? '#059669' : '#B45309' },
                  ]}
                >
                  {isFamilyConfirmed ? 'Gia đình đã xác nhận đón tiếp' : 'Chờ gia đình xác nhận'}
                </LocalizedText>
              </View>
            </View>
          )}

          <View style={[styles.actionRow, { borderTopColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
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

            {isUpcoming && (
              <TouchableOpacity
                style={[
                  styles.btnEdit,
                  { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: isDarkMode ? '#475569' : '#E2E8F0' },
                ]}
                onPress={() => onEdit(apt)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="pencil" size={15} color={isDarkMode ? '#CBD5E1' : '#475569'} />
              </TouchableOpacity>
            )}

            {isUpcoming ? (
              <TouchableOpacity
                style={[
                  styles.btnDelete,
                  { backgroundColor: isDarkMode ? '#450A0A55' : '#FEE2E2', borderColor: isDarkMode ? '#7F1D1D55' : '#FECACA' },
                ]}
                onPress={() => (onCancel ? onCancel(apt) : onDelete(apt.id, apt.exam_type || 'Khám bệnh'))}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close-circle-outline" size={17} color="#DC2626" />
              </TouchableOpacity>
            ) : (
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
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 2,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 15,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipText: { fontSize: 12.5 },

  // Week Calendar Strip Styles
  weekStripWrapper: {
    marginTop: 4,
    marginBottom: 6,
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
    gap: 8,
    paddingRight: 16,
  },
  dayCard: {
    width: 46,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
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
  },
  timelineAxisCol: {
    width: 58,
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
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
  },
  familyBadgeText: { fontSize: 11, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  btnViewPatient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnViewPatientText: { fontSize: 12.5, color: '#2563EB', fontWeight: '700' },
  btnComplete: {
    flex: 1.15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  btnCompleteText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  btnEdit: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDelete: {
    width: 38,
    height: 38,
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
