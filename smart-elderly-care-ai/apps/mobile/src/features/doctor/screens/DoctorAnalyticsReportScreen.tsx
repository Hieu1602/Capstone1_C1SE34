// DoctorAnalyticsReportScreen.tsx
// Phân tích đồ thị y khoa chuỗi thời gian, đánh giá sức khỏe AI dành cho Bác sĩ
// Hỗ trợ chọn bệnh nhân từ danh sách toàn bộ người cao tuổi phụ trách

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';

import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';
import { LocalizedText } from '../../../i18n/LocalizedComponents';

import {
  PatientOption,
  AnalyticsData,
  TrendItem,
  PatientSelectionView,
  AnalyticsOverviewCards,
  AnalyticsTrendChart,
  AnalyticsVitalsTable,
  DayVitalsDetailModal,
  DayFilterSelectorModal,
} from '../components';

export type { PatientOption };

export default function DoctorAnalyticsReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, colors } = useTheme();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const paramId = route.params?.patientId;
  const paramPatient = route.params?.patient;
  const [hasSwitchedPatient, setHasSwitchedPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(() => {
    if (paramPatient && paramPatient.id) return paramPatient;
    if (paramId) {
      return {
        id: String(paramId),
        name: 'Đang tải...',
        age: 0,
        gender: '',
        condition: '',
        deviceId: '',
        healthStatus: 'NORMAL',
      };
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'WARNING' | 'NORMAL'>('ALL');

  const [days, setDays] = useState<number>(7);
  const [chartMode, setChartMode] = useState<'HR' | 'SPO2' | 'BP' | 'TEMP' | 'STEPS'>('HR');
  const [selectedMetricFilter, setSelectedMetricFilter] = useState<'ALL' | 'HR' | 'SPO2' | 'BP' | 'TEMP'>('ALL');
  const [selectedFilteredDate, setSelectedFilteredDate] = useState<string | null>(null);
  const [isDayFilterModalVisible, setIsDayFilterModalVisible] = useState(false);

  const [selectedDayDetail, setSelectedDayDetail] = useState<TrendItem | null>(null);
  const [isDayModalVisible, setIsDayModalVisible] = useState(false);

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
    if (hasSwitchedPatient) return;
    if (route.params?.patient && route.params.patient.id) {
      setSelectedPatient(route.params.patient);
    }
    const pId = route.params?.patientId;
    if (pId) {
      const found = patients.find((p) => String(p.id) === String(pId));
      if (found) {
        setSelectedPatient(found);
      } else {
        doctorApi
          .getPatientDetail(String(pId))
          .then((res) => {
            if (res.data) {
              const d = res.data;
              setSelectedPatient({
                id: String(d.id || pId),
                name: d.name || 'Bệnh nhân',
                age: d.age ?? 0,
                gender: d.gender ?? '',
                condition: d.conditions?.map((c: any) => c.name).join(', ') || d.medical_history || '',
                deviceId: d.device_id || '',
                houseName: d.house_name ? `${d.house_name}${d.house_address ? ` • ${d.house_address}` : ''}` : undefined,
                bloodPressure: d.blood_pressure,
                heartRate: d.heart_rate,
                spo2: d.spo2,
                healthStatus: d.health_status || 'NORMAL',
                lastUpdated: d.last_updated,
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [route.params?.patientId, route.params?.patient, patients, hasSwitchedPatient]);

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

  // Lấy dữ liệu của ngày đang được lọc (nếu có)
  const filteredDayItem = useMemo(() => {
    if (!selectedFilteredDate) return null;
    return trends.find((t) => t.date === selectedFilteredDate) || null;
  }, [trends, selectedFilteredDate]);

  // Handler khi nhấn xem chi tiết 1 ngày bất kỳ
  const handlePressDay = (dayItem: TrendItem) => {
    setSelectedDayDetail(dayItem);
    setIsDayModalVisible(true);
  };

  // =========================================================================
  // GIAO DIỆN 1: DANH SÁCH CHỌN BỆNH NHÂN
  // =========================================================================
  if (!selectedPatient) {
    if (paramId && !hasSwitchedPatient) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      );
    }
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
        onSelectPatient={(p) => {
          setHasSwitchedPatient(false);
          setSelectedPatient(p);
        }}
        onReload={loadPatients}
        onBack={() => navigation.goBack()}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[styles.roundBackBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
              onPress={() => {
                setHasSwitchedPatient(true);
                setSelectedPatient(null);
              }}
            >
              <Ionicons name="people-outline" size={16} color="#2563EB" style={{ marginRight: 4 }} />
              <LocalizedText style={styles.backBtnText}>Đổi bệnh nhân</LocalizedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
            onPress={fetchAnalytics}
          >
            <Ionicons name="sync-outline" size={18} color="#2563EB" />
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

        {/* Lựa chọn chu kỳ ngày & Nút Lọc Theo Ngày */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysRow}
        >
          {[7, 14, 30].map((d) => {
            const active = days === d && !selectedFilteredDate;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => {
                  setSelectedFilteredDate(null);
                  setDays(d);
                }}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: '#2563EB' }
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

          {/* Nút lọc theo từng ngày */}
          <TouchableOpacity
            onPress={() => setIsDayFilterModalVisible(true)}
            style={[
              styles.dayChip,
              styles.dayFilterBtn,
              selectedFilteredDate
                ? { backgroundColor: '#2563EB', borderColor: '#2563EB' }
                : { backgroundColor: isDarkMode ? '#334155' : '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 },
            ]}
          >
            <Ionicons
              name="calendar"
              size={13}
              color={selectedFilteredDate ? '#FFFFFF' : '#2563EB'}
              style={{ marginRight: 4 }}
            />
            <LocalizedText
              style={[
                styles.dayChipText,
                selectedFilteredDate
                  ? { color: '#FFFFFF', fontWeight: '800' }
                  : { color: '#2563EB', fontWeight: '700' },
              ]}
            >
              {selectedFilteredDate ? `Ngày ${selectedFilteredDate}` : 'Lọc theo ngày'}
            </LocalizedText>
            {selectedFilteredDate && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedFilteredDate(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 4 }}
              >
                <Ionicons name="close-circle" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Bộ lọc dữ liệu sinh hiệu: Tất cả, Nhịp tim, SpO2, Huyết áp, Thân nhiệt */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricFilterRow}
        >
          {[
            { key: 'ALL' as const, label: 'Tất cả', icon: 'grid-outline' as const },
            { key: 'HR' as const, label: 'Nhịp tim', icon: 'heart' as const, color: '#EF4444' },
            { key: 'SPO2' as const, label: 'SpO₂', icon: 'water' as const, color: '#0284C7' },
            { key: 'BP' as const, label: 'Huyết áp', icon: 'speedometer' as const, color: '#10B981' },
            { key: 'TEMP' as const, label: 'Nhiệt độ', icon: 'thermometer' as const, color: '#F59E0B' },
          ].map((m) => {
            const active = selectedMetricFilter === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => {
                  setSelectedMetricFilter(m.key);
                  if (m.key !== 'ALL') {
                    setChartMode(m.key as any);
                  }
                }}
                style={[
                  styles.metricChip,
                  active
                    ? { backgroundColor: '#2563EB', borderColor: '#2563EB' }
                    : {
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                      },
                ]}
              >
                <Ionicons
                  name={m.icon}
                  size={12}
                  color={active ? '#FFFFFF' : (m.color || (isDarkMode ? '#94A3B8' : '#64748B'))}
                  style={{ marginRight: 4 }}
                />
                <LocalizedText
                  style={[
                    styles.metricChipText,
                    active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#475569' },
                  ]}
                >
                  {m.label}
                </LocalizedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 10 }} />}

        {/* Banner thông báo khi đang lọc theo ngày cụ thể */}
        {selectedFilteredDate && (
          <View style={[styles.activeFilterBanner, { backgroundColor: isDarkMode ? '#1E3A8A44' : '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="funnel" size={15} color="#2563EB" />
              <LocalizedText style={[styles.activeFilterBannerText, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
                Đang lọc dữ liệu ngày: <LocalizedText style={{ fontWeight: '800' }}>{selectedFilteredDate}</LocalizedText>
              </LocalizedText>
            </View>
            <TouchableOpacity
              style={styles.activeFilterActionBtn}
              onPress={() => {
                const found = trends.find((t) => t.date === selectedFilteredDate);
                if (found) {
                  setSelectedDayDetail(found);
                  setIsDayModalVisible(true);
                }
              }}
            >
              <Ionicons name="analytics" size={13} color="#2563EB" style={{ marginRight: 3 }} />
              <LocalizedText style={styles.activeFilterActionBtnText}>Xem 24h</LocalizedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.activeFilterClearBtn}
              onPress={() => setSelectedFilteredDate(null)}
            >
              <LocalizedText style={styles.activeFilterClearBtnText}>Bỏ lọc</LocalizedText>
              <Ionicons name="close" size={13} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {/* Thẻ đánh giá lâm sàng & các chỉ số thống kê */}
        <AnalyticsOverviewCards
          selectedPatient={selectedPatient}
          analytics={analytics}
          filteredDayItem={filteredDayItem}
          selectedMetricFilter={selectedMetricFilter}
          onSelectMetricFilter={(m) => {
            setSelectedMetricFilter(m);
            if (m !== 'ALL') setChartMode(m as any);
          }}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* Biểu đồ diễn tiến */}
        <AnalyticsTrendChart
          selectedPatient={selectedPatient}
          trends={trends}
          chartMode={chartMode}
          selectedFilteredDate={selectedFilteredDate}
          onChartModeChange={(m) => {
            setChartMode(m);
            if (m !== 'STEPS') setSelectedMetricFilter(m);
          }}
          onPressDay={handlePressDay}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* Bảng nhật ký sinh hiệu */}
        <AnalyticsVitalsTable
          trends={trends}
          filterMetric={selectedMetricFilter}
          selectedFilteredDate={selectedFilteredDate}
          onPressDay={handlePressDay}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* Modal chi tiết sinh hiệu 24h của ngày bất kỳ */}
        <DayVitalsDetailModal
          visible={isDayModalVisible}
          onClose={() => setIsDayModalVisible(false)}
          dayItem={selectedDayDetail}
          selectedPatient={selectedPatient}
          onSelectFilterDate={(dateStr) => setSelectedFilteredDate(dateStr)}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* Modal bộ lọc ngày */}
        <DayFilterSelectorModal
          visible={isDayFilterModalVisible}
          onClose={() => setIsDayFilterModalVisible(false)}
          trends={trends}
          selectedFilteredDate={selectedFilteredDate}
          onSelectDate={(d) => setSelectedFilteredDate(d)}
          onViewDetail={(item) => {
            setSelectedDayDetail(item);
            setIsDayModalVisible(true);
          }}
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
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roundBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
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
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  activeName: { fontSize: 15, fontWeight: '800' },
  activeSub: { fontSize: 11.5 },
  daysRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8, paddingVertical: 2 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  dayChipText: { fontSize: 11.5 },
  dayFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Bộ lọc sinh hiệu
  metricFilterRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  metricChipText: { fontSize: 11.5, fontWeight: '600' },

  // Banner đang lọc ngày
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  activeFilterBannerText: { fontSize: 12, flex: 1 },
  activeFilterActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeFilterActionBtnText: { fontSize: 11.5, fontWeight: '700', color: '#2563EB' },
  activeFilterClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  activeFilterClearBtnText: { fontSize: 11.5, fontWeight: '600', color: '#64748B', marginRight: 2 },

  detailScrollContent: { padding: 16, paddingBottom: 95 },
});
