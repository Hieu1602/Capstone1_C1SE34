// DoctorAnalyticsReportScreen.tsx
// Phân tích đồ thị y khoa chuỗi thời gian, đánh giá sức khỏe AI dành cho Bác sĩ
// Hỗ trợ chọn bệnh nhân từ danh sách toàn bộ người cao tuổi phụ trách

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';
import { LocalizedText } from '../../../i18n/LocalizedComponents';

import {
  PatientOption,
  AnalyticsData,
  PatientSelectionView,
  AnalyticsOverviewCards,
  AnalyticsTrendChart,
  AnalyticsVitalsTable,
} from '../components';

export type { PatientOption };

export default function DoctorAnalyticsReportScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { isDarkMode, colors } = useTheme();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'WARNING' | 'NORMAL'>('ALL');

  const [days, setDays] = useState<number>(7);
  const [chartMode, setChartMode] = useState<'HR' | 'SPO2' | 'STEPS'>('HR');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // 1. Tải danh sách bệnh nhân
  const loadPatients = useCallback(async () => {
    try {
      const res = await doctorApi.getPatients();
      if (res.data && Array.isArray(res.data)) {
        const mapped: PatientOption[] = res.data.map((item: any) => ({
          id: String(item.id),
          name: item.name || 'Bệnh nhân',
          age: item.age ?? 0,
          gender: item.gender ?? '',
          condition: item.medical_history ?? '',
          deviceId: item.device_id ?? '',
          houseName: item.house_name ? `${item.house_name}${item.house_address ? ` • ${item.house_address}` : ''}` : undefined,
          bloodPressure: item.blood_pressure,
          heartRate: item.heart_rate,
          spo2: item.spo2,
          healthStatus: item.health_status || 'NORMAL',
          lastUpdated: item.last_updated,
        }));
        setPatients(mapped);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

  // 2. Tự động chọn bệnh nhân nếu có param truyền vào
  useEffect(() => {
    const paramId = route.params?.patientId;
    if (paramId && patients.length > 0) {
      const found = patients.find((p) => p.id === String(paramId));
      if (found) setSelectedPatient(found);
    }
  }, [route.params?.patientId, patients]);

  // 3. Tải phân tích khi chọn bệnh nhân
  const fetchAnalytics = useCallback(async () => {
    if (!selectedPatient) return;
    try {
      setLoading(true);
      const res = await doctorApi.getAnalytics(selectedPatient.id, days);
      if (res.data) setAnalytics(res.data);
    } catch {
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [selectedPatient, days]);

  useEffect(() => {
    if (selectedPatient) fetchAnalytics();
  }, [selectedPatient, fetchAnalytics]);

  // Lọc bệnh nhân
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.houseName || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (filterStatus === 'WARNING') return p.healthStatus === 'WARNING' || p.healthStatus === 'DANGER';
      if (filterStatus === 'NORMAL') return p.healthStatus === 'NORMAL';
      return true;
    });
  }, [patients, searchQuery, filterStatus]);

  const warningCount = patients.filter((p) => p.healthStatus === 'WARNING' || p.healthStatus === 'DANGER').length;
  const normalCount = patients.filter((p) => p.healthStatus === 'NORMAL').length;

  const trends = analytics?.daily_trends || [];

  // =========================================================================
  // GIAO DIỆN 1: DANH SÁCH CHỌN BỆNH NHÂN
  // =========================================================================
  if (!selectedPatient) {
    return (
      <PatientSelectionView
        insets={insets}
        isDarkMode={isDarkMode}
        colors={colors}
        patients={patients}
        filteredPatients={filteredPatients}
        searchQuery={searchQuery}
        filterStatus={filterStatus}
        warningCount={warningCount}
        normalCount={normalCount}
        onSearchChange={setSearchQuery}
        onFilterChange={setFilterStatus}
        onSelectPatient={setSelectedPatient}
        onReload={loadPatients}
      />
    );
  }

  // =========================================================================
  // GIAO DIỆN 2: CHI TIẾT BÁO CÁO BỆNH NHÂN ĐƯỢC CHỌN
  // =========================================================================
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
        <View style={styles.detailHeaderTopRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
            onPress={() => setSelectedPatient(null)}
          >
            <Ionicons name="arrow-back" size={18} color="#0284C7" style={{ marginRight: 4 }} />
            <LocalizedText style={styles.backBtnText}>Đổi bệnh nhân</LocalizedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
            onPress={fetchAnalytics}
          >
            <Ionicons name="sync-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Thông tin bệnh nhân đang xem */}
        <View
          style={[
            styles.activePatientCard,
            { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: colors.border },
          ]}
        >
          <View style={styles.activeAvatar}>
            <LocalizedText style={styles.activeAvatarText}>
              {selectedPatient.name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A'}
            </LocalizedText>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <LocalizedText style={[styles.activeName, { color: colors.textPrimary }]} numberOfLines={1}>
              {selectedPatient.name}
            </LocalizedText>
            <LocalizedText style={[styles.activeSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              {selectedPatient.age ? `${selectedPatient.age} tuổi` : ''}
              {selectedPatient.gender ? ` • ${selectedPatient.gender}` : ''}
              {selectedPatient.condition ? ` • ${selectedPatient.condition}` : ''}
            </LocalizedText>
          </View>
        </View>

        {/* Lựa chọn ngày chu kỳ */}
        <View style={styles.daysRow}>
          {[7, 14, 30].map((d) => {
            const active = days === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDays(d)}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: Colors.primary }
                    : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' },
                ]}
              >
                <LocalizedText
                  style={[
                    styles.dayChipText,
                    active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
                  ]}
                >
                  {d} ngày qua
                </LocalizedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.detailScrollContent}>
        {loading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />}

        {/* Thẻ đánh giá lâm sàng & 4 chỉ số thống kê */}
        <AnalyticsOverviewCards
          selectedPatient={selectedPatient}
          analytics={analytics}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* Biểu đồ diễn tiến */}
        <AnalyticsTrendChart
          selectedPatient={selectedPatient}
          trends={trends}
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* Bảng nhật ký sinh hiệu */}
        <AnalyticsVitalsTable
          trends={trends}
          isDarkMode={isDarkMode}
          colors={colors}
        />
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
  reloadBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: '#0284C7' },
  activePatientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  activeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  activeName: { fontSize: 15, fontWeight: '800' },
  activeSub: { fontSize: 11.5 },
  daysRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  dayChipText: { fontSize: 11.5 },
  detailScrollContent: { padding: 16, paddingBottom: 95 },
});
