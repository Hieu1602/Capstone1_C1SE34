import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { PatientOption } from './types';

interface PatientSelectionViewProps {
  insets: { top: number; bottom: number; left: number; right: number };
  isDarkMode: boolean;
  colors: any;
  patients: PatientOption[];
  filteredPatients: PatientOption[];
  searchQuery: string;
  filterStatus: 'ALL' | 'WARNING' | 'NORMAL';
  warningCount: number;
  normalCount: number;
  onSearchChange: (val: string) => void;
  onFilterChange: (status: 'ALL' | 'WARNING' | 'NORMAL') => void;
  onSelectPatient: (patient: PatientOption) => void;
  onReload: () => void;
}

export const PatientSelectionView: React.FC<PatientSelectionViewProps> = ({
  insets,
  isDarkMode,
  colors,
  patients,
  filteredPatients,
  searchQuery,
  filterStatus,
  warningCount,
  normalCount,
  onSearchChange,
  onFilterChange,
  onSelectPatient,
  onReload,
}) => {
  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

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
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <LocalizedText style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Hồ Sơ Y Khoa Bác Sĩ Gia Đình
            </LocalizedText>
            <LocalizedText style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Báo Cáo & Phân Tích Sinh Hiệu
            </LocalizedText>
          </View>
          <TouchableOpacity
            style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
            onPress={onReload}
          >
            <Ionicons name="sync-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <LocalizedText style={[styles.guideText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
          👨‍⚕️ Nhấn vào bệnh nhân để xem chi tiết biểu đồ sinh hiệu:
        </LocalizedText>

        {/* Ô tìm kiếm */}
        <View style={[styles.searchBox, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
          <LocalizedTextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Tìm theo tên bệnh nhân, bệnh nền..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Bộ lọc trạng thái */}
        <View style={styles.filterRow}>
          {[
            { key: 'ALL' as const, label: `Tất cả (${patients.length})` },
            { key: 'WARNING' as const, label: `Cần lưu ý (${warningCount})` },
            { key: 'NORMAL' as const, label: `Ổn định (${normalCount})` },
          ].map((tab) => {
            const active = filterStatus === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => onFilterChange(tab.key)}
              >
                <LocalizedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab.label}
                </LocalizedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Danh sách thẻ bệnh nhân */}
      <ScrollView contentContainerStyle={styles.listContainer}>
        {filteredPatients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={44} color="#94A3B8" />
            <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Không tìm thấy bệnh nhân nào phù hợp.
            </LocalizedText>
          </View>
        ) : (
          filteredPatients.map((p) => {
            const isDanger = p.healthStatus === 'DANGER';
            const isWarn = p.healthStatus === 'WARNING';
            const statusColor = isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';
            const statusBg = isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#D1FAE5';
            const statusText = isDanger ? '#DC2626' : isWarn ? '#D97706' : '#059669';
            const statusLabel = isDanger ? 'NGUY CƠ' : isWarn ? 'CHÚ Ý' : 'ỔN ĐỊNH';
            const initial = p.name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A';

            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.rosterCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : colors.border,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => onSelectPatient(p)}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: isDarkMode ? '#334155' : '#EFF6FF', borderColor: statusColor },
                    ]}
                  >
                    <LocalizedText style={[styles.avatarInitial, { color: Colors.primary }]}>{initial}</LocalizedText>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.nameRow}>
                      <LocalizedText style={[styles.cardPatientName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {p.name}
                      </LocalizedText>
                      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <LocalizedText style={[styles.statusBadgeText, { color: statusText }]}>
                          {statusLabel}
                        </LocalizedText>
                      </View>
                    </View>

                    <LocalizedText style={[styles.cardMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {p.age ? `${p.age} tuổi` : ''}
                      {p.age && p.gender ? ' • ' : ''}
                      {p.gender}
                      {p.deviceId ? ` • Thiết bị: ${p.deviceId}` : ''}
                    </LocalizedText>
                    {p.houseName ? (
                      <LocalizedText
                        style={[styles.cardAddress, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}
                        numberOfLines={1}
                      >
                        🏠 {p.houseName}
                      </LocalizedText>
                    ) : null}
                  </View>
                </View>

                {p.condition ? (
                  <View style={[styles.cardConditionRow, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="medical" size={13} color="#EF4444" style={{ marginRight: 5 }} />
                    <LocalizedText
                      style={[styles.cardConditionText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}
                      numberOfLines={1}
                    >
                      {p.condition}
                    </LocalizedText>
                  </View>
                ) : null}

                {/* 3 Chỉ số sinh hiệu thực tế */}
                <View style={styles.vitalsRow}>
                  <View style={[styles.vitalItem, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' }]}>
                    <Ionicons name="heart" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                    <LocalizedText style={[styles.vitalVal, { color: colors.textPrimary }]}>
                      {p.heartRate ? `${p.heartRate} bpm` : '--'}
                    </LocalizedText>
                  </View>

                  <View style={[styles.vitalItem, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' }]}>
                    <Ionicons name="water" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                    <LocalizedText style={[styles.vitalVal, { color: colors.textPrimary }]}>
                      {p.spo2 ? `${p.spo2}% SpO₂` : '--'}
                    </LocalizedText>
                  </View>

                  <View style={[styles.vitalItem, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' }]}>
                    <Ionicons name="pulse" size={13} color="#10B981" style={{ marginRight: 4 }} />
                    <LocalizedText style={[styles.vitalVal, { color: colors.textPrimary }]}>
                      {p.bloodPressure || '--'}
                    </LocalizedText>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Ionicons name="bar-chart-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                  <LocalizedText style={styles.cardActionText}>Xem phân tích sinh hiệu</LocalizedText>
                  <Ionicons name="arrow-forward" size={13} color="#0284C7" style={{ marginLeft: 4 }} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerSubtitle: { fontSize: 11.5, fontWeight: '500' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  reloadBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideText: { fontSize: 12.5, marginBottom: 10, fontWeight: '500' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#0284C7' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  listContainer: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, marginTop: 10, textAlign: 'center' },
  rosterCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '800' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardPatientName: { fontSize: 15.5, fontWeight: '800', flex: 1, marginRight: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardMeta: { fontSize: 12, marginBottom: 2 },
  cardAddress: { fontSize: 11 },
  cardConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  cardConditionText: { fontSize: 12, fontWeight: '500', flex: 1 },
  vitalsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  vitalItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  vitalVal: { fontSize: 12, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  cardActionText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
});
