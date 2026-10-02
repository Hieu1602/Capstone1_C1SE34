// HistoryScreen.tsx – Xem lại nhật ký y tế & lịch sử sự kiện với dữ liệu thực 100% từ Database
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { useTheme } from '../../store/useThemeStore';
import { vitalsApi, incidentsApi } from '../../services/api';
import { useVitalStore } from '../../store/useVitalStore';

type Tab = 'vitals' | 'incidents';

interface VitalRecord {
  id: string;
  time: string;
  device_id: string;
  heart_rate: number | null;
  spo2: number | null;
  skin_temp_max: number | null;
  person_count?: number | null;
  fall_detected?: boolean;
}

interface IncidentRecord {
  id: string;
  device_id: string;
  alert_type: string;
  alert_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  message: string;
  confidence?: number;
  sources?: string;
  video_clip_url?: string | null;
  thumbnail_url?: string | null;
  is_acknowledged: boolean;
  created_at: string;
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const YYYY = d.getFullYear();
    return `${hh}:${mm} • ${DD}/${MM}/${YYYY}`;
  } catch {
    return dateStr;
  }
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const { activeDevice } = useVitalStore();

  const [activeTab, setActiveTab] = useState<Tab>('vitals');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [vitalsList, setVitalsList] = useState<VitalRecord[]>([]);
  const [incidentsList, setIncidentsList] = useState<IncidentRecord[]>([]);

  const deviceId = activeDevice?.device_id || 'BLE_BAND_001';

  // 1. Tải dữ liệu thực tế từ Backend FastAPI & PostgreSQL
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [vitalsRes, incidentsRes] = await Promise.allSettled([
        vitalsApi.getHistory(deviceId, 100),
        incidentsApi.list(undefined, 50),
      ]);

      if (vitalsRes.status === 'fulfilled' && vitalsRes.value.data) {
        setVitalsList(Array.isArray(vitalsRes.value.data) ? vitalsRes.value.data : []);
      } else {
        setVitalsList([]);
      }

      if (incidentsRes.status === 'fulfilled' && incidentsRes.value.data) {
        setIncidentsList(Array.isArray(incidentsRes.value.data) ? incidentsRes.value.data : []);
      } else {
        setIncidentsList([]);
      }
    } catch (e) {
      console.warn('[HistoryScreen] Lỗi khi tải dữ liệu lịch sử thực tế:', e);
      setVitalsList([]);
      setIncidentsList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // 2. Tính toán thống kê thực tế từ mảng vitalsList
  const stats = useMemo(() => {
    const validHR = vitalsList.filter((v) => v.heart_rate != null).map((v) => Number(v.heart_rate));
    const validSpO2 = vitalsList.filter((v) => v.spo2 != null).map((v) => Number(v.spo2));
    const validTemp = vitalsList.filter((v) => v.skin_temp_max != null).map((v) => Number(v.skin_temp_max));

    const avgHR = validHR.length ? Math.round(validHR.reduce((a, b) => a + b, 0) / validHR.length) : null;
    const avgSpO2 = validSpO2.length ? Math.round((validSpO2.reduce((a, b) => a + b, 0) / validSpO2.length) * 10) / 10 : null;
    const avgTemp = validTemp.length ? Math.round((validTemp.reduce((a, b) => a + b, 0) / validTemp.length) * 10) / 10 : null;

    return {
      total: vitalsList.length,
      avgHR,
      avgSpO2,
      avgTemp,
    };
  }, [vitalsList]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? colors.background : '#F8FAFC' }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? colors.headerBg : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.canGoBack() && navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nhật Ký &amp; Lịch Sử</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Dữ liệu chuỗi thời gian thực từ thiết bị {deviceId}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh} activeOpacity={0.7}>
          <Ionicons name="reload" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs Chuyển đổi: Sinh hiệu / Sự kiện */}
      <View style={[styles.tabsContainer, { backgroundColor: isDarkMode ? colors.card : '#FFFFFF', borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'vitals' && styles.tabItemActive,
            activeTab === 'vitals' && { borderBottomColor: Colors.primary },
          ]}
          onPress={() => setActiveTab('vitals')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="pulse"
            size={18}
            color={activeTab === 'vitals' ? Colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'vitals' ? Colors.primary : colors.textSecondary },
              activeTab === 'vitals' && styles.tabTextActive,
            ]}
          >
            Sinh hiệu ({vitalsList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'incidents' && styles.tabItemActive,
            activeTab === 'incidents' && { borderBottomColor: '#EF4444' },
          ]}
          onPress={() => setActiveTab('incidents')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="warning"
            size={18}
            color={activeTab === 'incidents' ? '#EF4444' : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'incidents' ? '#EF4444' : colors.textSecondary },
              activeTab === 'incidents' && styles.tabTextActive,
            ]}
          >
            Sự kiện cảnh báo ({incidentsList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body Content */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Đang tải dữ liệu thực tế từ TimescaleDB &amp; PostgreSQL...
          </Text>
        </View>
      ) : activeTab === 'vitals' ? (
        /* TAB 1: DANH SÁCH SINH HIỆU THỰC TẾ */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          {/* Summary Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? colors.card : '#FFFFFF', borderColor: colors.border }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="heart" size={16} color="#DC2626" />
              </View>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>
                {stats.avgHR ? `${stats.avgHR} bpm` : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Nhịp tim TB</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: isDarkMode ? colors.card : '#FFFFFF', borderColor: colors.border }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="water" size={16} color="#0284C7" />
              </View>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>
                {stats.avgSpO2 ? `${stats.avgSpO2}%` : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>SpO₂ TB</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: isDarkMode ? colors.card : '#FFFFFF', borderColor: colors.border }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="thermometer" size={16} color="#D97706" />
              </View>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>
                {stats.avgTemp ? `${stats.avgTemp}°C` : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Nhiệt độ TB</Text>
            </View>
          </View>

          {vitalsList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="analytics-outline" size={48} color="#94A3B8" />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                Chưa có bản ghi sinh hiệu thực tế
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Hệ thống chưa nhận được gói tin đo từ vòng đeo tay BLE qua Edge Hub. Hãy đảm bảo thiết bị đã được bật.
              </Text>
            </View>
          ) : (
            <View style={styles.recordsList}>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                Lịch sử các lần đo gần nhất ({vitalsList.length} lượt)
              </Text>

              {vitalsList.map((item, idx) => {
                const isFall = Boolean(item.fall_detected);
                return (
                  <View
                    key={item.id || String(idx)}
                    style={[
                      styles.recordCard,
                      { backgroundColor: isDarkMode ? colors.card : '#FFFFFF', borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.recordTopRow}>
                      <View style={styles.recordTimeBadge}>
                        <Ionicons name="time-outline" size={13} color="#64748B" />
                        <Text style={styles.recordTimeText}>{formatDateTime(item.time)}</Text>
                      </View>
                      {isFall ? (
                        <View style={styles.fallBadgeAlert}>
                          <Ionicons name="warning" size={12} color="#FFFFFF" />
                          <Text style={styles.fallBadgeAlertText}>CÓ TÉ NGÃ</Text>
                        </View>
                      ) : (
                        <View style={styles.safeBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                          <Text style={styles.safeBadgeText}>Bình thường</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.recordMetricsRow}>
                      <View style={styles.metricCol}>
                        <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>Nhịp tim</Text>
                        <Text style={[styles.metricValue, { color: '#DC2626' }]}>
                          {item.heart_rate != null ? `${item.heart_rate} bpm` : '--'}
                        </Text>
                      </View>

                      <View style={styles.metricDivider} />

                      <View style={styles.metricCol}>
                        <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>Oxy máu SpO₂</Text>
                        <Text style={[styles.metricValue, { color: '#0284C7' }]}>
                          {item.spo2 != null ? `${item.spo2}%` : '--'}
                        </Text>
                      </View>

                      <View style={styles.metricDivider} />

                      <View style={styles.metricCol}>
                        <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>Thân nhiệt</Text>
                        <Text style={[styles.metricValue, { color: '#D97706' }]}>
                          {item.skin_temp_max != null ? `${item.skin_temp_max}°C` : '--'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        /* TAB 2: DANH SÁCH SỰ KIỆN CẢNH BÁO THỰC TẾ */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EF4444" />
          }
        >
          {incidentsList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={54} color="#10B981" />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                Không có sự cố nào
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Cơ sở dữ liệu an toàn, không có cảnh báo té ngã hoặc bất thường âm thanh nào được ghi nhận.
              </Text>
            </View>
          ) : (
            <View style={styles.recordsList}>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                Sự kiện cảnh báo thực tế ({incidentsList.length})
              </Text>

              {incidentsList.map((item) => {
                const isCritical = item.alert_level === 'CRITICAL' || item.alert_type === 'FALL_DETECTED';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.incidentCard,
                      { backgroundColor: isDarkMode ? colors.card : '#FFFFFF', borderColor: colors.border },
                    ]}
                    onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.incidentHeaderRow}>
                      <View style={[styles.incidentTypeBadge, { backgroundColor: isCritical ? '#FEE2E2' : '#EFF6FF' }]}>
                        <Ionicons
                          name={isCritical ? 'warning' : 'notifications'}
                          size={14}
                          color={isCritical ? '#DC2626' : '#2563EB'}
                        />
                        <Text style={[styles.incidentTypeBadgeText, { color: isCritical ? '#DC2626' : '#2563EB' }]}>
                          {item.alert_type}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.ackPill,
                          {
                            backgroundColor: item.is_acknowledged ? '#ECFDF5' : '#FEF2F2',
                            borderColor: item.is_acknowledged ? '#86EFAC' : '#FCA5A5',
                          },
                        ]}
                      >
                        <Text style={[styles.ackPillText, { color: item.is_acknowledged ? '#16A34A' : '#DC2626' }]}>
                          {item.is_acknowledged ? 'Đã xử lý' : 'Chưa xử lý'}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.incidentMessage, { color: colors.textPrimary }]}>
                      {item.message}
                    </Text>

                    <View style={styles.incidentFooterRow}>
                      <View style={styles.timeTag}>
                        <Ionicons name="time-outline" size={13} color="#94A3B8" />
                        <Text style={styles.timeTagText}>{formatDateTime(item.created_at)}</Text>
                      </View>
                      <View style={styles.viewDetailBtn}>
                        <Text style={styles.viewDetailText}>Xem chi tiết</Text>
                        <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFF4EC',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNum: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  recordsList: {
    gap: 12,
  },
  recordCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordTimeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  fallBadgeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fallBadgeAlertText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  safeBadgeText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '600',
  },
  recordMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  incidentCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  incidentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incidentTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  incidentTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ackPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ackPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  incidentMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  incidentFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTagText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF7A00',
  },
});
