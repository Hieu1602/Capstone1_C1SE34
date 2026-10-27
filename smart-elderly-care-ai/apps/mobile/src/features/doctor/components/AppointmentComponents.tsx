// AppointmentComponents.tsx
// Tập hợp các Component hiển thị thông tin Lịch khám:
// 1. AppointmentStatsSummary: Thống kê 4 ô & bộ lọc trạng thái (Tổng, Sắp tới, Đã khám, Đã hủy)
// 2. AppointmentCard: Thẻ hiển thị chi tiết lịch hẹn của từng bệnh nhân

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { AppointmentItem } from './types';

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
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: s.border },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={14} color={s.color} />
            </View>
            <LocalizedText style={[styles.statNumber, { color: s.color }]}>{s.count}</LocalizedText>
            <LocalizedText style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
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
          const activeBg = tab.key === 'CANCELLED' ? '#DC2626' : Colors.primary;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onFilterChange(tab.key)}
              style={[
                styles.filterChip,
                active
                  ? { backgroundColor: activeBg }
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
      </View>
    </View>
  );
};

// =============================================================
// 2. CARD LỊCH HẸN (AppointmentCard)
// =============================================================
export interface AppointmentCardProps {
  appointment: AppointmentItem;
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
  const initial = apt.patient_name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A';

  const recurrenceLabel =
    apt.recurrence_pattern === 'WEEKLY'
      ? 'Định kỳ hàng tuần'
      : apt.recurrence_pattern === 'MONTHLY'
      ? 'Định kỳ hàng tháng'
      : apt.recurrence_pattern === 'QUARTERLY'
      ? 'Định kỳ hàng quý'
      : null;

  return (
    <View
      style={[
        styles.aptCard,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isUpcoming ? '#3B82F655' : isCompleted ? '#10B98144' : '#EF444433',
        },
      ]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.dateTagBox}>
          <Ionicons name="calendar" size={13} color="#0284C7" style={{ marginRight: 4 }} />
          <LocalizedText style={styles.dateTagText}>{apt.scheduled_at}</LocalizedText>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {recurrenceLabel && (
            <View style={styles.recurrencePill}>
              <Ionicons name="repeat" size={11} color="#7C3AED" style={{ marginRight: 3 }} />
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
          <LocalizedText style={styles.patientAvatarText}>{initial}</LocalizedText>
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
              {apt.location}
            </LocalizedText>
          ) : null}
        </View>
      </View>

      <View style={styles.examTypeBox}>
        <Ionicons name="medkit" size={14} color="#0284C7" style={{ marginRight: 6 }} />
        <LocalizedText style={[styles.examTypeText, { color: colors.textPrimary }]}>
          {apt.exam_type || apt.visit_type || 'Khám bệnh'}
        </LocalizedText>
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

      <View style={styles.metaBadgesRow}>
        {isUpcoming && (
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
              {isFamilyConfirmed ? 'Gia đình đã xác nhận' : 'Chờ gia đình xác nhận'}
            </LocalizedText>
          </View>
        )}

        <View
          style={[
            styles.speakerBadge,
            apt.enable_speaker_reminder
              ? { backgroundColor: '#ECFDF5', borderColor: '#10B98144' }
              : { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
          ]}
        >
          <Ionicons
            name={apt.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
            size={12}
            color={apt.enable_speaker_reminder ? '#059669' : '#94A3B8'}
            style={{ marginRight: 4 }}
          />
          <LocalizedText
            style={[
              styles.speakerBadgeText,
              { color: apt.enable_speaker_reminder ? '#059669' : '#64748B' },
            ]}
          >
            {apt.enable_speaker_reminder ? 'Loa Hub: BẬT' : 'Loa Hub: TẮT'}
          </LocalizedText>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.btnViewPatient}
          onPress={() => onViewPatient(apt.patient_id)}
        >
          <Ionicons name="document-text-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
          <LocalizedText style={styles.btnViewPatientText}>Hồ sơ bệnh án</LocalizedText>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isUpcoming && (
            <TouchableOpacity style={styles.btnComplete} onPress={() => onMarkCompleted(apt.id)}>
              <Ionicons name="checkmark" size={13} color="#FFFFFF" style={{ marginRight: 2 }} />
              <LocalizedText style={styles.btnCompleteText}>Đã khám</LocalizedText>
            </TouchableOpacity>
          )}

          {isUpcoming && (
            <TouchableOpacity style={styles.btnEdit} onPress={() => onEdit(apt)}>
              <Ionicons name="pencil" size={13} color="#475569" />
            </TouchableOpacity>
          )}

          {isUpcoming ? (
            <TouchableOpacity
              style={styles.btnDelete}
              onPress={() => (onCancel ? onCancel(apt) : onDelete(apt.id, apt.exam_type || 'Khám bệnh'))}
            >
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.btnDelete}
              onPress={() => onDelete(apt.id, apt.exam_type || 'Khám bệnh')}
            >
              <Ionicons name="trash-outline" size={13} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  statIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statNumber: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  filterChipText: { fontSize: 11.5 },

  aptCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateTagText: { fontSize: 11.5, fontWeight: '700', color: '#0284C7' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  statusPillText: { fontSize: 9.5, fontWeight: '800' },
  patientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  patientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  patientName: { fontSize: 14.5, fontWeight: '700' },
  aptMetaText: { fontSize: 11.5, marginTop: 1 },
  examTypeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F933',
    paddingVertical: 3,
    marginBottom: 6,
  },
  examTypeText: { fontSize: 13.5, fontWeight: '700' },
  instructionsBox: { borderRadius: 8, padding: 8, marginBottom: 6 },
  instructionsText: { fontSize: 12, lineHeight: 17 },
  metaBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  familyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  familyBadgeText: { fontSize: 10.5, fontWeight: '700' },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  speakerBadgeText: { fontSize: 10.5, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F066',
  },
  btnViewPatient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  btnViewPatientText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  btnComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnCompleteText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  btnEdit: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDelete: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
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
    borderRadius: 7,
    padding: 7,
    marginBottom: 6,
  },
  cancelReasonText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
});

