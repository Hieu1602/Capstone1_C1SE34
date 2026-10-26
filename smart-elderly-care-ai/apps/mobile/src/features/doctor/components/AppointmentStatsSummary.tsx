import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText } from '../../../i18n/LocalizedComponents';

interface AppointmentStatsSummaryProps {
  totalCount: number;
  upcomingCount: number;
  completedCount: number;
  filterTab: 'ALL' | 'UPCOMING' | 'COMPLETED';
  onFilterChange: (tab: 'ALL' | 'UPCOMING' | 'COMPLETED') => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentStatsSummary: React.FC<AppointmentStatsSummaryProps> = ({
  totalCount,
  upcomingCount,
  completedCount,
  filterTab,
  onFilterChange,
  isDarkMode,
}) => {
  const stats = [
    { key: 'total', icon: 'calendar', color: '#2563EB', bg: '#EFF6FF', border: '#3B82F633', label: 'Tổng lịch', count: totalCount },
    { key: 'upcoming', icon: 'time', color: '#D97706', bg: '#FFFBEB', border: '#F59E0B33', label: 'Sắp tới', count: upcomingCount },
    { key: 'completed', icon: 'checkmark-done', color: '#059669', bg: '#ECFDF5', border: '#10B98133', label: 'Đã khám', count: completedCount },
  ];

  return (
    <View>
      {/* 3 Thẻ thống kê */}
      <View style={styles.summaryGrid}>
        {stats.map((s) => (
          <View
            key={s.key}
            style={[
              styles.summaryCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: s.border },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={15} color={s.color} />
            </View>
            <LocalizedText style={[styles.statNumber, { color: s.color }]}>{s.count}</LocalizedText>
            <LocalizedText style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              {s.label}
            </LocalizedText>
          </View>
        ))}
      </View>

      {/* Bộ lọc trạng thái */}
      <View style={styles.filterRow}>
        {[
          { key: 'ALL' as const, label: `Tất cả (${totalCount})` },
          { key: 'UPCOMING' as const, label: `Sắp tới (${upcomingCount})` },
          { key: 'COMPLETED' as const, label: `Đã khám (${completedCount})` },
        ].map((tab) => {
          const active = filterTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onFilterChange(tab.key)}
              style={[
                styles.filterChip,
                active
                  ? { backgroundColor: Colors.primary }
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
});
