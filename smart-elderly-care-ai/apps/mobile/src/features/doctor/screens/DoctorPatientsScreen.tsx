// DoctorPatientsScreen.tsx
// Danh sách bệnh nhân người cao tuổi phụ trách dành cho Bác sĩ gia đình

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { doctorApi } from '../../../services/api';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';


export interface PatientCardData {
  id: string;
  name: string;
  birth_year: number;
  age: number;
  gender: string;
  house_id: string;
  house_name: string;
  house_address?: string;
  medical_history?: string;
  emergency_contact_phone?: string;
  device_id: string;
  is_online: boolean;
  battery_level?: number;
  heart_rate?: number;
  spo2?: number;
  skin_temp_max?: number;
  blood_pressure?: string;
  blood_type?: string;
  health_status: 'NORMAL' | 'WARNING' | 'DANGER' | string;
  last_updated?: string;
}

export default function DoctorPatientsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const { userName } = useAuthStore();

  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WARNING' | 'NORMAL'>('ALL');

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doctorApi.getPatients();
      if (res.data && Array.isArray(res.data)) {
        setPatients(res.data);
      }
    } catch {
      // Giữ dữ liệu hiện tại khi mất kết nối mạng
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [fetchPatients])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      const cleanQ = q.replace(/[^0-9]/g, '');
      const cleanPhone = (p.emergency_contact_phone || '').replace(/[^0-9]/g, '');

      const matchesName = p.name.toLowerCase().includes(q);
      const matchesPhone = cleanQ.length > 0 && cleanPhone.includes(cleanQ);

      if (!matchesName && !matchesPhone) return false;
    }

    if (filterTab === 'WARNING') return p.health_status === 'WARNING' || p.health_status === 'DANGER';
    if (filterTab === 'NORMAL') return p.health_status === 'NORMAL';
    return true;
  });

  const totalPatients = patients.length;
  const warningCount = patients.filter(
    (p) => p.health_status === 'WARNING' || p.health_status === 'DANGER'
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Doctor Header */}
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
            <LocalizedText style={[styles.statNumber, { color: colors.textPrimary }]}>{totalPatients}</LocalizedText>
            <LocalizedText style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
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
            <LocalizedText style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
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
            <LocalizedText style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
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
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {[
            { key: 'ALL', label: `Tất cả (${totalPatients})` },
            { key: 'WARNING', label: `Cần theo dõi (${warningCount})` },
            { key: 'NORMAL', label: `Ổn định (${totalPatients - warningCount})` },
          ].map((tab) => {
            const active = filterTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilterTab(tab.key as any)}
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

      {/* Patient Cards List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
        )}

        {filteredPatients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={48} color="#94A3B8" />
            <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Không tìm thấy hồ sơ người cao tuổi nào.
            </LocalizedText>
          </View>
        ) : (
          filteredPatients.map((patient) => {
            const isWarn = patient.health_status === 'WARNING';
            const isDanger = patient.health_status === 'DANGER';

            return (
              <TouchableOpacity
                key={patient.id}
                style={[
                  styles.patientCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : colors.border,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('DoctorPatientDetail', { patientId: patient.id })}
              >
                {/* Header card */}
                <View style={styles.cardHeader}>
                  <View style={styles.patientAvatar}>
                    <LocalizedText style={styles.patientAvatarText}>
                      {patient.name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A'}
                    </LocalizedText>
                  </View>
                  <View style={styles.cardHeaderInfo}>
                    <View style={styles.nameBadgeRow}>
                      <LocalizedText style={[styles.patientName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {patient.name}
                      </LocalizedText>
                      <View
                        style={[
                          styles.statusBadge,
                          isDanger
                            ? { backgroundColor: '#FEE2E2' }
                            : isWarn
                            ? { backgroundColor: '#FEF3C7' }
                            : { backgroundColor: '#D1FAE5' },
                        ]}
                      >
                        <LocalizedText
                          style={[
                            styles.statusBadgeText,
                            isDanger
                              ? { color: '#DC2626' }
                              : isWarn
                              ? { color: '#D97706' }
                              : { color: '#059669' },
                          ]}
                        >
                          {isDanger ? 'NGUY CƠ' : isWarn ? 'CHÚ Ý' : 'ỔN ĐỊNH'}
                        </LocalizedText>
                      </View>
                    </View>
                    <LocalizedText style={[styles.patientMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                      {patient.age} tuổi • {patient.gender} • Nhóm máu {patient.blood_type || 'O+'}
                    </LocalizedText>
                    <LocalizedText style={[styles.patientAddress, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                      🏠 {patient.house_name} • {patient.house_address}
                    </LocalizedText>
                    {patient.emergency_contact_phone ? (
                      <LocalizedText style={[styles.patientPhone, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]} numberOfLines={1}>
                        📞 {patient.emergency_contact_phone}
                      </LocalizedText>
                    ) : null}
                  </View>
                </View>

                {/* Medical History Tags */}
                {patient.medical_history ? (
                  <View style={[styles.historyRow, { backgroundColor: isDarkMode ? '#33415544' : '#F1F5F9' }]}>
                    <Ionicons name="medical" size={13} color="#EF4444" style={{ marginRight: 5 }} />
                    <LocalizedText style={[styles.historyText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                      Bệnh nền: {patient.medical_history}
                    </LocalizedText>
                  </View>
                ) : null}

                {/* Vitals Grid Chips */}
                <View style={styles.vitalsRow}>
                  {/* Nhịp tim */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="heart" size={14} color="#EF4444" />
                    <LocalizedText style={[styles.vitalValue, { color: colors.textPrimary }]}>
                      {patient.heart_rate !== null && patient.heart_rate !== undefined ? `${patient.heart_rate} ` : '-- '}
                      {patient.heart_rate !== null && patient.heart_rate !== undefined && (
                        <LocalizedText style={styles.vitalUnit}>bpm</LocalizedText>
                      )}
                    </LocalizedText>
                    <LocalizedText style={styles.vitalLabel}>Nhịp tim</LocalizedText>
                  </View>

                  {/* SpO2 */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="water" size={14} color="#0284C7" />
                    <LocalizedText
                      style={[
                        styles.vitalValue,
                        { color: (patient.spo2 && patient.spo2 < 95) ? '#EA580C' : colors.textPrimary },
                      ]}
                    >
                      {patient.spo2 !== null && patient.spo2 !== undefined ? `${patient.spo2}` : '--'}
                      {patient.spo2 !== null && patient.spo2 !== undefined && (
                        <LocalizedText style={styles.vitalUnit}>%</LocalizedText>
                      )}
                    </LocalizedText>
                    <LocalizedText style={styles.vitalLabel}>SpO₂</LocalizedText>
                  </View>

                  {/* Nhiệt độ */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="thermometer" size={14} color="#F59E0B" />
                    <LocalizedText style={[styles.vitalValue, { color: colors.textPrimary }]}>
                      {patient.skin_temp_max !== null && patient.skin_temp_max !== undefined ? `${patient.skin_temp_max}` : '--'}
                      {patient.skin_temp_max !== null && patient.skin_temp_max !== undefined && (
                        <LocalizedText style={styles.vitalUnit}>°C</LocalizedText>
                      )}
                    </LocalizedText>
                    <LocalizedText style={styles.vitalLabel}>Nhiệt độ</LocalizedText>
                  </View>

                  {/* Vòng đeo / Pin */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="watch" size={14} color="#10B981" />
                    <LocalizedText style={[styles.vitalValue, { color: '#10B981' }]}>
                      {patient.battery_level ?? 84}
                      <LocalizedText style={styles.vitalUnit}>%</LocalizedText>
                    </LocalizedText>
                    <LocalizedText style={styles.vitalLabel}>Pin vòng</LocalizedText>
                  </View>
                </View>

                {/* Footer action button */}
                <View style={styles.cardFooter}>
                  <View style={styles.syncWrap}>
                    <Ionicons name="bluetooth" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                    <LocalizedText
                      style={[styles.updatedText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
                      numberOfLines={1}
                    >
                      BLE Hub • {patient.last_updated}
                    </LocalizedText>
                  </View>
                  <View style={styles.footerActionGroup}>
                    <TouchableOpacity
                      style={[styles.btnMiniReport, { backgroundColor: isDarkMode ? '#334155' : '#E0F2FE' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        navigation.navigate('DoctorAnalytics', { patientId: patient.id });
                      }}
                    >
                      <Ionicons name="bar-chart-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                      <LocalizedText style={styles.btnMiniReportText}>Báo cáo</LocalizedText>
                    </TouchableOpacity>
                    <View style={styles.viewDetailBtn}>
                      <LocalizedText style={styles.viewDetailText}>Bệnh án</LocalizedText>
                      <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  listContent: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyText: { marginTop: 12, fontSize: 14 },
  patientCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  cardHeaderInfo: { flex: 1, marginLeft: 12 },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  patientName: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
  patientMeta: { fontSize: 12, marginTop: 1 },
  patientAddress: { fontSize: 11.5, marginTop: 3 },
  patientPhone: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  historyText: { fontSize: 11, fontWeight: '600', flex: 1 },
  vitalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 6,
  },
  vitalChip: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  vitalValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  vitalUnit: { fontSize: 10, fontWeight: '500' },
  vitalLabel: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F044',
  },
  syncWrap: { flexDirection: 'row', alignItems: 'center' },
  updatedText: { fontSize: 11, fontWeight: '500' },
  footerActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnMiniReport: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnMiniReportText: { fontSize: 11.5, fontWeight: '700', color: '#0284C7' },
  viewDetailBtn: { flexDirection: 'row', alignItems: 'center' },
  viewDetailText: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginRight: 2 },
});
