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
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';

export interface PatientOption {
  id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  deviceId: string;
  houseName?: string;
  bloodPressure?: string;
  heartRate?: number;
  spo2?: number;
  healthStatus?: 'NORMAL' | 'WARNING' | 'DANGER' | string;
  lastUpdated?: string;
}

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
  const [analytics, setAnalytics] = useState<any>(null);

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
  const hrScore = analytics?.hr_stability_score;
  const isSafe = hrScore ? hrScore >= 85 : true;

  // =========================================================================
  // GIAO DIỆN 1: DANH SÁCH CHỌN BỆNH NHÂN
  // =========================================================================
  if (!selectedPatient) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderBottomColor: colors.border }]}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <LocalizedText style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Hồ Sơ Y Khoa Bác Sĩ Gia Đình
              </LocalizedText>
              <LocalizedText style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Báo Cáo & Phân Tích Sinh Hiệu
              </LocalizedText>
            </View>
            <TouchableOpacity style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]} onPress={loadPatients}>
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
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Bộ lọc trạng thái */}
          <View style={styles.filterRow}>
            {[
              { key: 'ALL', label: `Tất cả (${patients.length})` },
              { key: 'WARNING', label: `Cần lưu ý (${warningCount})` },
              { key: 'NORMAL', label: `Ổn định (${normalCount})` },
            ].map((tab) => {
              const active = filterStatus === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilterStatus(tab.key as any)}
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
                  onPress={() => setSelectedPatient(p)}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#334155' : '#EFF6FF', borderColor: statusColor }]}>
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
                        {p.age ? `${p.age} tuổi` : ''}{p.age && p.gender ? ' • ' : ''}{p.gender}{p.deviceId ? ` • Thiết bị: ${p.deviceId}` : ''}
                      </LocalizedText>
                      {p.houseName ? (
                        <LocalizedText style={[styles.cardAddress, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                          🏠 {p.houseName}
                        </LocalizedText>
                      ) : null}
                    </View>
                  </View>

                  {p.condition ? (
                    <View style={[styles.cardConditionRow, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                      <Ionicons name="medical" size={13} color="#EF4444" style={{ marginRight: 5 }} />
                      <LocalizedText style={[styles.cardConditionText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]} numberOfLines={1}>
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
  }

  // =========================================================================
  // GIAO DIỆN 2: CHI TIẾT BÁO CÁO BỆNH NHÂN ĐƯỢC CHỌN
  // =========================================================================
  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.detailHeaderTopRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
            onPress={() => setSelectedPatient(null)}
          >
            <Ionicons name="arrow-back" size={18} color="#0284C7" style={{ marginRight: 4 }} />
            <LocalizedText style={styles.backBtnText}>Đổi bệnh nhân</LocalizedText>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]} onPress={fetchAnalytics}>
            <Ionicons name="sync-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Thông tin bệnh nhân đang xem */}
        <View style={[styles.activePatientCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: colors.border }]}>
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
              {selectedPatient.age ? `${selectedPatient.age} tuổi` : ''}{selectedPatient.gender ? ` • ${selectedPatient.gender}` : ''}{selectedPatient.condition ? ` • ${selectedPatient.condition}` : ''}
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
                style={[styles.dayChip, active ? { backgroundColor: Colors.primary } : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
              >
                <LocalizedText style={[styles.dayChipText, active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                  {d} ngày qua
                </LocalizedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.detailScrollContent}>
        {loading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />}

        {/* Thẻ đánh giá lâm sàng */}
        <View style={[styles.assessmentCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isSafe ? '#10B98144' : '#F59E0B44' }]}>
          <View style={styles.scoreRow}>
            <View style={[styles.scoreCircle, { backgroundColor: isSafe ? '#ECFDF5' : '#FFFBEB', borderColor: isSafe ? '#10B981' : '#F59E0B' }]}>
              <LocalizedText style={[styles.scoreNumber, { color: isSafe ? '#059669' : '#D97706' }]}>{hrScore ?? '--'}</LocalizedText>
              <LocalizedText style={styles.scoreMax}>/100</LocalizedText>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={[styles.statusTag, { backgroundColor: isSafe ? '#D1FAE5' : '#FEF3C7' }]}>
                <LocalizedText style={[styles.statusTagText, { color: isSafe ? '#059669' : '#D97706' }]}>
                  {hrScore ? (isSafe ? 'SINH HIỆU ỔN ĐỊNH' : 'CẦN LƯU Ý THEO DÕI') : 'ĐANG THEO DÕI'}
                </LocalizedText>
              </View>
              <LocalizedText style={[styles.assessmentTitle, { color: colors.textPrimary }]}>Nhận định Y Khoa & AI</LocalizedText>
              <LocalizedText style={[styles.assessmentDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                {analytics?.ai_summary || `Đang theo dõi dữ liệu sinh hiệu thực tế của bệnh nhân ${selectedPatient.name}.`}
              </LocalizedText>
            </View>
          </View>
        </View>

        {/* 4 Chỉ số thống kê */}
        <View style={styles.metricsGrid}>
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#EF444433' }]}>
            <View style={styles.statTop}><Ionicons name="heart" size={16} color="#EF4444" /><LocalizedText style={styles.statUnit}>bpm</LocalizedText></View>
            <LocalizedText style={[styles.statVal, { color: colors.textPrimary }]}>{analytics?.avg_heart_rate ?? selectedPatient.heartRate ?? '--'}</LocalizedText>
            <LocalizedText style={styles.statLbl}>Nhịp tim TB</LocalizedText>
            <LocalizedText style={styles.statSubRange}>Dao động: {analytics?.min_heart_rate ?? '--'} - {analytics?.max_heart_rate ?? '--'}</LocalizedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#0284C733' }]}>
            <View style={styles.statTop}><Ionicons name="water" size={16} color="#0284C7" /><LocalizedText style={styles.statUnit}>%</LocalizedText></View>
            <LocalizedText style={[styles.statVal, { color: colors.textPrimary }]}>{analytics?.avg_spo2 ?? selectedPatient.spo2 ?? '--'}</LocalizedText>
            <LocalizedText style={styles.statLbl}>SpO₂ TB</LocalizedText>
            <LocalizedText style={[styles.statSubRange, { color: '#059669' }]}>Thấp nhất: {analytics?.min_spo2 ? `${analytics.min_spo2}%` : '--'}</LocalizedText>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#10B98133' }]}>
            <View style={styles.statTop}><Ionicons name="pulse" size={16} color="#10B981" /><LocalizedText style={styles.statUnit}>mmHg</LocalizedText></View>
            <LocalizedText style={[styles.statVal, { color: '#10B981' }]}>{selectedPatient.bloodPressure || '--'}</LocalizedText>
            <LocalizedText style={styles.statLbl}>Huyết áp</LocalizedText>
            <LocalizedText style={styles.statSubRange}>{selectedPatient.bloodPressure ? `Lần đo gần nhất` : 'Chưa có ghi nhận'}</LocalizedText>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B33' }]}>
            <View style={styles.statTop}><Ionicons name="thermometer" size={16} color="#F59E0B" /><LocalizedText style={styles.statUnit}>°C</LocalizedText></View>
            <LocalizedText style={[styles.statVal, { color: '#D97706' }]}>{analytics?.avg_skin_temp ? `${analytics.avg_skin_temp}°C` : '--'}</LocalizedText>
            <LocalizedText style={styles.statLbl}>Nhiệt độ da</LocalizedText>
            <LocalizedText style={styles.statSubRange}>Tụt SpO₂: {analytics?.spo2_drops_count ?? 0} lần</LocalizedText>
          </View>
        </View>

        {/* Biểu đồ diễn tiến */}
        <View style={[styles.chartCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <LocalizedText style={[styles.chartTitle, { color: colors.textPrimary }]}>Diễn Tiến Lâm Sàng Từng Ngày</LocalizedText>
            <LocalizedText style={[styles.chartSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              {selectedPatient.deviceId ? `Đo tự động qua Smartband (${selectedPatient.deviceId})` : 'Đo tự động qua thiết bị giám sát'}
            </LocalizedText>
          </View>

          {/* Tab chọn loại chỉ số biểu đồ */}
          <View style={styles.chartTabRow}>
            {[
              { key: 'HR', label: 'Nhịp tim (bpm)' },
              { key: 'SPO2', label: 'SpO₂ (%)' },
              { key: 'STEPS', label: 'Vận động' },
            ].map((tab) => {
              const active = chartMode === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setChartMode(tab.key as any)}
                  style={[styles.chartModeBtn, active && styles.chartModeBtnActive]}
                >
                  <LocalizedText style={[styles.chartModeText, active ? { color: Colors.primary, fontWeight: '700' } : { color: '#64748B' }]}>
                    {tab.label}
                  </LocalizedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.barsContainer}>
            {trends.length === 0 ? (
              <View style={styles.noDataBox}>
                <Ionicons name="stats-chart-outline" size={28} color="#94A3B8" />
                <LocalizedText style={styles.noDataText}>Chưa có dữ liệu sinh hiệu chuỗi thời gian</LocalizedText>
              </View>
            ) : (
              trends.map((item: any, idx: number) => {
                let barPercent = 50;
                let barColor = '#0284C7';
                let displayVal = `${item.avg_heart_rate} bpm`;
                let isAlert = false;

                if (chartMode === 'HR') {
                  barPercent = Math.min(Math.max(((item.avg_heart_rate - 50) / 60) * 100, 15), 100);
                  barColor = item.avg_heart_rate > 80 ? '#F59E0B' : '#0284C7';
                  displayVal = `${item.avg_heart_rate} bpm`;
                  isAlert = item.avg_heart_rate > 80;
                } else if (chartMode === 'SPO2') {
                  barPercent = Math.min(Math.max(((item.avg_spo2 - 85) / 15) * 100, 15), 100);
                  barColor = item.min_spo2 < 94 ? '#EF4444' : '#10B981';
                  displayVal = `${item.avg_spo2}%`;
                  isAlert = item.min_spo2 < 94;
                } else {
                  barPercent = Math.min(Math.max((item.steps / 3500) * 100, 15), 100);
                  barColor = '#8B5CF6';
                  displayVal = `${item.steps}`;
                }

                return (
                  <View key={idx} style={styles.trendRow}>
                    <LocalizedText style={[styles.trendDate, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>{item.date}</LocalizedText>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${barPercent}%`, backgroundColor: barColor }]} />
                    </View>
                    <LocalizedText style={[styles.barValueText, { color: colors.textPrimary }]}>{displayVal}</LocalizedText>
                    <View style={[styles.statusTagMini, { backgroundColor: isAlert ? '#FEE2E2' : '#ECFDF5' }]}>
                      <LocalizedText style={[styles.statusTagMiniText, { color: isAlert ? '#DC2626' : '#059669' }]}>
                        {isAlert ? 'Lưu ý' : 'Chuẩn'}
                      </LocalizedText>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Bảng nhật ký sinh hiệu */}
        <View style={[styles.tableCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <LocalizedText style={[styles.tableTitle, { color: colors.textPrimary }]}>Nhật Ký Chỉ Số Sinh Hiệu</LocalizedText>
          <View style={styles.tableHeaderRow}>
            <LocalizedText style={[styles.tableColHeader, { flex: 1.2 }]}>Ngày</LocalizedText>
            <LocalizedText style={[styles.tableColHeader, { flex: 1.2 }]}>Nhịp tim</LocalizedText>
            <LocalizedText style={[styles.tableColHeader, { flex: 1.2 }]}>SpO₂</LocalizedText>
            <LocalizedText style={[styles.tableColHeader, { flex: 1.5 }]}>Huyết áp</LocalizedText>
          </View>
          {trends.length === 0 ? (
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <LocalizedText style={{ fontSize: 13, color: '#94A3B8' }}>Chưa có dữ liệu nhật ký đo</LocalizedText>
            </View>
          ) : (
            trends.slice(0, 5).map((row: any, i: number) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: isDarkMode ? '#0F172A44' : '#F8FAFC' }]}>
                <LocalizedText style={[styles.tableCell, { flex: 1.2, fontWeight: '700', color: colors.textPrimary }]}>{row.date}</LocalizedText>
                <LocalizedText style={[styles.tableCell, { flex: 1.2, color: '#EF4444' }]}>{row.avg_heart_rate ? `${row.avg_heart_rate} bpm` : '--'}</LocalizedText>
                <LocalizedText style={[styles.tableCell, { flex: 1.2, color: row.min_spo2 && row.min_spo2 < 94 ? '#DC2626' : '#0284C7' }]}>{row.avg_spo2 ? `${row.avg_spo2}%` : '--'}</LocalizedText>
                <LocalizedText style={[styles.tableCell, { flex: 1.5, color: '#10B981' }]}>{row.bp || '--'}</LocalizedText>
              </View>
            ))
          )}
        </View>
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

  // Detail View
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
  assessmentCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: { fontSize: 19, fontWeight: '900' },
  scoreMax: { fontSize: 9.5, color: '#94A3B8', fontWeight: '600', marginTop: -2 },
  statusTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4 },
  statusTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  assessmentTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  assessmentDesc: { fontSize: 12, lineHeight: 17 },

  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statUnit: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 1 },
  statSubRange: { fontSize: 9.5, color: '#94A3B8', marginTop: 4 },

  chartCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  chartHeader: { marginBottom: 10 },
  chartTitle: { fontSize: 15, fontWeight: '800' },
  chartSub: { fontSize: 11, marginTop: 2 },
  chartTabRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, marginBottom: 14 },
  chartModeBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  chartModeBtnActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  chartModeText: { fontSize: 11, fontWeight: '600' },
  barsContainer: { gap: 8 },
  noDataBox: { paddingVertical: 20, alignItems: 'center' },
  noDataText: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendDate: { width: 40, fontSize: 11.5, fontWeight: '600' },
  barTrack: { flex: 1, height: 12, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barValueText: { width: 56, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  statusTagMini: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  statusTagMiniText: { fontSize: 9.5, fontWeight: '700' },

  tableCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  tableTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  tableHeaderRow: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1' },
  tableColHeader: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, alignItems: 'center' },
  tableCell: { fontSize: 11.5 },
});
