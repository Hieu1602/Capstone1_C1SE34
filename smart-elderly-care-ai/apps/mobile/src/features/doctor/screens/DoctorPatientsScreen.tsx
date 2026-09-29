// DoctorPatientsScreen.tsx
// Danh sách bệnh nhân người cao tuổi phụ trách dành cho Bác sĩ gia đình

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { doctorApi } from '../../../services/api';

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
  health_status: 'NORMAL' | 'WARNING' | 'DANGER' | string;
  last_updated?: string;
}

const FALLBACK_PATIENTS: PatientCardData[] = [
  {
    id: 'e0000000-b4e1-4b08-b2d3-d949a0eb075c',
    name: 'Cụ Nguyễn Văn An',
    birth_year: 1948,
    age: 78,
    gender: 'Nam',
    house_id: 'c3333333-b4e1-4b08-b2d3-d949a0eb075c',
    house_name: 'Nhà của tôi',
    house_address: '123 Hải Phòng, P. Thạch Thang, Đà Nẵng',
    medical_history: 'Tăng huyết áp độ 2, Thiếu máu cơ tim nhẹ, Tiền đình',
    emergency_contact_phone: '+84905123456',
    device_id: 'BLE_BAND_001',
    is_online: true,
    battery_level: 84,
    heart_rate: 76,
    spo2: 98,
    skin_temp_max: 36.6,
    blood_pressure: '120/80 mmHg',
    health_status: 'NORMAL',
    last_updated: 'Vừa xong',
  },
  {
    id: 'e1111111-b4e1-4b08-b2d3-d949a0eb075c',
    name: 'Cụ Trần Thị Mai',
    birth_year: 1951,
    age: 75,
    gender: 'Nữ',
    house_id: 'c4444444-b4e1-4b08-b2d3-d949a0eb075c',
    house_name: 'Gia đình Chị Lan',
    house_address: '45 Lê Duẩn, Q. Hải Châu, Đà Nẵng',
    medical_history: 'Đái tháo đường Type 2, Thoái hóa khớp gối',
    emergency_contact_phone: '+84905999888',
    device_id: 'BLE_BAND_002',
    is_online: true,
    battery_level: 68,
    heart_rate: 88,
    spo2: 94,
    skin_temp_max: 36.8,
    blood_pressure: '135/85 mmHg',
    health_status: 'WARNING',
    last_updated: '3 phút trước',
  },
];

export default function DoctorPatientsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const { userName } = useAuthStore();

  const [patients, setPatients] = useState<PatientCardData[]>(FALLBACK_PATIENTS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WARNING' | 'NORMAL'>('ALL');

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doctorApi.getPatients();
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setPatients(res.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.medical_history || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.house_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
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
              <Text style={[styles.greetingSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Bác sĩ phụ trách y tế
              </Text>
              <Text style={[styles.doctorTitle, { color: colors.textPrimary }]}>
                {userName || 'BS. Trần Văn Minh'}
              </Text>
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
              <Ionicons name="people" size={18} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.statNumber}>{totalPatients}</Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Tổng bệnh nhân
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.summaryCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#10B98133' },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#059669" />
            </View>
            <View>
              <Text style={[styles.statNumber, { color: '#059669' }]}>
                {totalPatients - warningCount}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Sinh hiệu ổn định
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.summaryCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B33' },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="pulse" size={18} color="#D97706" />
            </View>
            <View>
              <Text style={[styles.statNumber, { color: warningCount > 0 ? '#DC2626' : '#D97706' }]}>
                {warningCount}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Cần lưu ý
              </Text>
            </View>
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
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Tìm theo tên cụ, bệnh nền hoặc địa chỉ..."
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
                <Text
                  style={[
                    styles.filterChipText,
                    active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
                  ]}
                >
                  {tab.label}
                </Text>
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
            <Text style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Không tìm thấy hồ sơ người cao tuổi nào.
            </Text>
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
                  <View style={styles.avatarRow}>
                    <View style={styles.patientAvatar}>
                      <Text style={styles.patientAvatarText}>
                        {patient.name.split(' ').slice(-1)[0][0] || 'C'}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.patientName, { color: colors.textPrimary }]}>
                          {patient.name}
                        </Text>
                        <Text style={[styles.patientAge, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                          ({patient.age} tuổi • {patient.gender})
                        </Text>
                      </View>
                      <Text style={[styles.patientAddress, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        🏠 {patient.house_name} • {patient.house_address}
                      </Text>
                    </View>
                  </View>

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
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isDanger
                          ? { color: '#DC2626' }
                          : isWarn
                          ? { color: '#D97706' }
                          : { color: '#059669' },
                      ]}
                    >
                      {isDanger ? 'NGUY CƠ CAO' : isWarn ? 'CẦN CHÚ Ý' : 'ỔN ĐỊNH'}
                    </Text>
                  </View>
                </View>

                {/* Medical History Tags */}
                {patient.medical_history ? (
                  <View style={styles.historyRow}>
                    <Ionicons name="medical" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={[styles.historyText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                      {patient.medical_history}
                    </Text>
                  </View>
                ) : null}

                {/* Vitals Grid Chips */}
                <View style={styles.vitalsRow}>
                  {/* Nhịp tim */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="heart" size={14} color="#EF4444" />
                    <Text style={[styles.vitalValue, { color: colors.textPrimary }]}>
                      {patient.heart_rate ?? 76} <Text style={styles.vitalUnit}>bpm</Text>
                    </Text>
                    <Text style={styles.vitalLabel}>Nhịp tim</Text>
                  </View>

                  {/* SpO2 */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="water" size={14} color="#0284C7" />
                    <Text
                      style={[
                        styles.vitalValue,
                        { color: (patient.spo2 ?? 98) < 95 ? '#EA580C' : colors.textPrimary },
                      ]}
                    >
                      {patient.spo2 ?? 98}
                      <Text style={styles.vitalUnit}>%</Text>
                    </Text>
                    <Text style={styles.vitalLabel}>SpO₂</Text>
                  </View>

                  {/* Nhiệt độ */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="thermometer" size={14} color="#F59E0B" />
                    <Text style={[styles.vitalValue, { color: colors.textPrimary }]}>
                      {patient.skin_temp_max ?? 36.6}
                      <Text style={styles.vitalUnit}>°C</Text>
                    </Text>
                    <Text style={styles.vitalLabel}>Nhiệt độ da</Text>
                  </View>

                  {/* Vòng đeo / Pin */}
                  <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <Ionicons name="watch" size={14} color="#10B981" />
                    <Text style={[styles.vitalValue, { color: '#10B981' }]}>
                      {patient.battery_level ?? 84}
                      <Text style={styles.vitalUnit}>%</Text>
                    </Text>
                    <Text style={styles.vitalLabel}>Pin vòng</Text>
                  </View>
                </View>

                {/* Footer action button */}
                <View style={styles.cardFooter}>
                  <Text style={[styles.updatedText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                    Đồng bộ qua BLE Smartband • {patient.last_updated}
                  </Text>
                  <View style={styles.viewDetailBtn}>
                    <Text style={styles.viewDetailText}>Xem bệnh án & Kê đơn</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  statNumber: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 10, fontWeight: '500' },
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
  listContent: { padding: 16, paddingBottom: 80 },
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  patientName: { fontSize: 16, fontWeight: '700', marginRight: 6 },
  patientAge: { fontSize: 13 },
  patientAddress: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E222',
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
  updatedText: { fontSize: 11 },
  viewDetailBtn: { flexDirection: 'row', alignItems: 'center' },
  viewDetailText: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginRight: 2 },
});
