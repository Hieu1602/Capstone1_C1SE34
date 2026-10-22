import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';

interface DoctorPatientsHeaderProps {
  insets: { top: number; bottom: number; left: number; right: number };
  userName?: string | null;
  totalPatients: number;
  warningCount: number;
  searchQuery: string;
  filterTab: 'ALL' | 'WARNING' | 'NORMAL';
  onChangeSearch: (val: string) => void;
  onChangeFilter: (tab: 'ALL' | 'WARNING' | 'NORMAL') => void;
  onRefresh: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorPatientsHeader: React.FC<DoctorPatientsHeaderProps> = ({
  insets,
  userName,
  totalPatients,
  warningCount,
  searchQuery,
  filterTab,
  onChangeSearch,
  onChangeFilter,
  onRefresh,
  isDarkMode,
  colors,
}) => {
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.doctorInfo}>
          <View style={styles.avatarBadge}>
            <Ionicons name="medkit" size={20} color="#FFFFFF" />
          </View>
          <View>
            <LocalizedText style={[styles.greetingSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Bác sĩ phụ trách y tế
            </LocalizedText>
            <LocalizedText style={[styles.doctorTitle, { color: colors.textPrimary }]}>
              {userName || 'BS. Trần Văn Minh'}
            </LocalizedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
          onPress={onRefresh}
        >
          <Ionicons name="sync-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Clinical Summary Cards */}
      <View style={styles.summaryGrid}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#3B82F633' },
          ]}
        >
          <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="people" size={16} color="#2563EB" />
          </View>
          <LocalizedText style={[styles.statNumber, { color: colors.textPrimary }]}>
            {totalPatients}
          </LocalizedText>
          <LocalizedText
            style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
            numberOfLines={1}
          >
            Tổng số
          </LocalizedText>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#10B98133' },
          ]}
        >
          <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="shield-checkmark" size={16} color="#059669" />
          </View>
          <LocalizedText style={[styles.statNumber, { color: '#059669' }]}>
            {totalPatients - warningCount}
          </LocalizedText>
          <LocalizedText
            style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
            numberOfLines={1}
          >
            Ổn định
          </LocalizedText>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B33' },
          ]}
        >
          <View style={[styles.statIconBox, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="pulse" size={16} color="#D97706" />
          </View>
          <LocalizedText style={[styles.statNumber, { color: warningCount > 0 ? '#DC2626' : '#D97706' }]}>
            {warningCount}
          </LocalizedText>
          <LocalizedText
            style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
            numberOfLines={1}
          >
            Cần lưu ý
          </LocalizedText>
        </View>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="search" size={18} color="#94A3B8" />
        <LocalizedTextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Tìm theo tên hoặc số điện thoại..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={onChangeSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onChangeSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {[
          { key: 'ALL' as const, label: `Tất cả (${totalPatients})` },
          { key: 'WARNING' as const, label: `Cần theo dõi (${warningCount})` },
          { key: 'NORMAL' as const, label: `Ổn định (${totalPatients - warningCount})` },
        ].map((tab) => {
          const active = filterTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChangeFilter(tab.key)}
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
                  active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  doctorInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  greetingSub: { fontSize: 12, fontWeight: '500' },
  doctorTitle: { fontSize: 18, fontWeight: '700' },
  reloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipText: { fontSize: 12 },
});
