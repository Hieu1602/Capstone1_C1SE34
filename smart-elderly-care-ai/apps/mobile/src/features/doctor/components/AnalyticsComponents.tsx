// AnalyticsComponents.tsx
// Tập hợp các thành phần trực quan hóa dữ liệu sinh hiệu cho Bác sĩ:
// 1. AnalyticsOverviewCards: Thẻ điểm nhận định AI & 4 chỉ số thống kê tổng quan (Nhịp tim, SpO2, Thân nhiệt, Giảm SpO2)
// 2. AnalyticsTrendChart: Đồ thị thanh diễn tiến lâm sàng theo ngày (HR, SpO2, Vận động)
// 3. AnalyticsVitalsTable: Bảng nhật ký chi tiết các mốc đo sinh hiệu
// 4. PatientSelectionView: Màn hình chọn bệnh nhân trước khi xem báo cáo phân tích

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { AnalyticsData, PatientOption, TrendItem } from './types';

// =============================================================
// 1. THẺ ĐIỂM ĐÁNH GIÁ & 4 CHỈ SỐ TỔNG QUAN
// =============================================================
export interface AnalyticsOverviewCardsProps {
  selectedPatient: PatientOption;
  analytics: AnalyticsData | null;
  isDarkMode: boolean;
  colors: any;
}

export const AnalyticsOverviewCards: React.FC<AnalyticsOverviewCardsProps> = ({
  selectedPatient,
  analytics,
  isDarkMode,
  colors,
}) => {
  const hrScore = analytics?.hr_stability_score;
  const isSafe = hrScore ? hrScore >= 85 : true;

  const metricCards = [
    {
      icon: 'heart' as const,
      color: '#EF4444',
      unit: 'bpm',
      val: analytics?.avg_heart_rate ?? selectedPatient.heartRate ?? '--',
      lbl: 'Nhịp tim TB',
      sub: `Dao động: ${analytics?.min_heart_rate ?? '--'} - ${analytics?.max_heart_rate ?? '--'}`,
    },
    {
      icon: 'water' as const,
      color: '#0284C7',
      unit: '%',
      val: analytics?.avg_spo2 ?? selectedPatient.spo2 ?? '--',
      lbl: 'SpO₂ Trung bình',
      sub: `Thấp nhất: ${analytics?.min_spo2 ?? '--'}%`,
    },
    {
      icon: 'thermometer' as const,
      color: '#F59E0B',
      unit: '°C',
      val: analytics?.avg_skin_temp ? `${analytics.avg_skin_temp}°C` : '--',
      lbl: 'Nhiệt độ da',
      sub: analytics?.avg_skin_temp ? 'Nhiệt độ đo da' : 'Chưa có dữ liệu',
    },
    {
      icon: 'alert-circle' as const,
      color: '#8B5CF6',
      unit: 'Lần',
      val: analytics?.spo2_drops_count != null ? analytics.spo2_drops_count : '--',
      lbl: 'Cơn tụt SpO₂',
      sub: 'Trong 7 ngày qua',
    },
  ];

  return (
    <View>
      {/* Thẻ nhận định lâm sàng */}
      <View
        style={[
          styles.assessmentCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: isSafe ? '#10B98144' : '#F59E0B44',
          },
        ]}
      >
        <View style={styles.scoreRow}>
          <View
            style={[
              styles.scoreCircle,
              {
                backgroundColor: isSafe ? '#ECFDF5' : '#FFFBEB',
                borderColor: isSafe ? '#10B981' : '#F59E0B',
              },
            ]}
          >
            <LocalizedText style={[styles.scoreNumber, { color: isSafe ? '#059669' : '#D97706' }]}>
              {hrScore ?? '--'}
            </LocalizedText>
            <LocalizedText style={styles.scoreMax}>/100</LocalizedText>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={[styles.statusTag, { backgroundColor: isSafe ? '#D1FAE5' : '#FEF3C7' }]}>
              <LocalizedText style={[styles.statusTagText, { color: isSafe ? '#059669' : '#D97706' }]}>
                {hrScore ? (isSafe ? 'SINH HIỆU ỔN ĐỊNH' : 'CẦN LƯU Ý THEO DÕI') : 'ĐANG THEO DÕI'}
              </LocalizedText>
            </View>
            <LocalizedText style={[styles.assessmentTitle, { color: colors.textPrimary }]}>
              Nhận định Y Khoa & AI
            </LocalizedText>
            <LocalizedText style={[styles.assessmentDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              {analytics?.ai_summary ||
                `Đang theo dõi dữ liệu sinh hiệu thực tế của bệnh nhân ${selectedPatient.name}.`}
            </LocalizedText>
          </View>
        </View>
      </View>

      {/* 4 Chỉ số thống kê */}
      <View style={styles.metricsGrid}>
        {metricCards.map((m, idx) => (
          <View
            key={idx}
            style={[
              styles.statCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: `${m.color}33` },
            ]}
          >
            <View style={styles.statTop}>
              <Ionicons name={m.icon} size={16} color={m.color} />
              <LocalizedText style={styles.statUnit}>{m.unit}</LocalizedText>
            </View>
            <LocalizedText style={[styles.statVal, { color: colors.textPrimary }]}>
              {m.val}
            </LocalizedText>
            <LocalizedText style={styles.statLbl}>{m.lbl}</LocalizedText>
            <LocalizedText style={styles.statSubRange}>{m.sub}</LocalizedText>
          </View>
        ))}
      </View>
    </View>
  );
};

// =============================================================
// 2. BIỂU ĐỒ DIỄN TIẾN LÂM SÀNG TỪNG NGÀY
// =============================================================
export interface AnalyticsTrendChartProps {
  selectedPatient: PatientOption;
  trends: TrendItem[];
  chartMode: 'HR' | 'SPO2' | 'STEPS';
  onChartModeChange: (mode: 'HR' | 'SPO2' | 'STEPS') => void;
  isDarkMode: boolean;
  colors: any;
}

export const AnalyticsTrendChart: React.FC<AnalyticsTrendChartProps> = ({
  selectedPatient,
  trends,
  chartMode,
  onChartModeChange,
  isDarkMode,
  colors,
}) => {
  return (
    <View style={[styles.chartCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
      <View style={styles.chartHeader}>
        <LocalizedText style={[styles.chartTitle, { color: colors.textPrimary }]}>
          Diễn Tiến Lâm Sàng Từng Ngày
        </LocalizedText>
        <LocalizedText style={[styles.chartSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          {selectedPatient.deviceId
            ? `Đo tự động qua Smartband (${selectedPatient.deviceId})`
            : 'Đo tự động qua thiết bị giám sát'}
        </LocalizedText>
      </View>

      <View style={styles.chartTabRow}>
        {[
          { key: 'HR' as const, label: 'Nhịp tim (bpm)' },
          { key: 'SPO2' as const, label: 'SpO₂ (%)' },
          { key: 'STEPS' as const, label: 'Vận động' },
        ].map((tab) => {
          const active = chartMode === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChartModeChange(tab.key)}
              style={[styles.chartModeBtn, active && styles.chartModeBtnActive]}
            >
              <LocalizedText
                style={[
                  styles.chartModeText,
                  active ? { color: Colors.primary, fontWeight: '700' } : { color: '#64748B' },
                ]}
              >
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
            <LocalizedText style={styles.noDataText}>
              Chưa có dữ liệu sinh hiệu chuỗi thời gian
            </LocalizedText>
          </View>
        ) : (
          trends.map((item: any, idx: number) => {
            let barPercent = 50;
            let barColor = '#0284C7';
            let displayVal = `${item.avg_heart_rate} bpm`;
            let isAlert = false;

            if (chartMode === 'HR') {
              const hr = item.avg_heart_rate ?? 0;
              barPercent = hr > 0 ? Math.min(Math.max(((hr - 50) / 60) * 100, 15), 100) : 0;
              barColor = hr > 80 ? '#F59E0B' : '#0284C7';
              displayVal = hr > 0 ? `${hr} bpm` : '--';
              isAlert = hr > 80;
            } else if (chartMode === 'SPO2') {
              const spo2 = item.avg_spo2 ?? 0;
              barPercent = spo2 > 0 ? Math.min(Math.max(((spo2 - 85) / 15) * 100, 15), 100) : 0;
              barColor = (item.min_spo2 || spo2) < 94 ? '#EF4444' : '#10B981';
              displayVal = spo2 > 0 ? `${spo2}%` : '--';
              isAlert = (item.min_spo2 || spo2) < 94;
            } else {
              const steps = item.steps ?? 0;
              barPercent = steps > 0 ? Math.min(Math.max((steps / 3500) * 100, 15), 100) : 0;
              barColor = '#8B5CF6';
              displayVal = steps > 0 ? `${steps}` : '--';
            }

            return (
              <View key={idx} style={styles.trendRow}>
                <LocalizedText style={[styles.trendDate, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                  {item.date}
                </LocalizedText>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barPercent}%`, backgroundColor: barColor }]} />
                </View>
                <LocalizedText style={[styles.barValueText, { color: colors.textPrimary }]}>
                  {displayVal}
                </LocalizedText>
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
  );
};

// =============================================================
// 3. BẢNG NHẬT KÝ CHỈ SỐ SINH HIỆU
// =============================================================
export interface AnalyticsVitalsTableProps {
  trends: TrendItem[];
  isDarkMode: boolean;
  colors: any;
}

export const AnalyticsVitalsTable: React.FC<AnalyticsVitalsTableProps> = ({
  trends,
  isDarkMode,
  colors,
}) => {
  return (
    <View style={[styles.tableCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
      <LocalizedText style={[styles.tableTitle, { color: colors.textPrimary }]}>
        Nhật Ký Chỉ Số Sinh Hiệu
      </LocalizedText>
      <View style={styles.tableHeaderRow}>
        <LocalizedText style={[styles.tableColHeader, { flex: 1.2 }]}>Ngày</LocalizedText>
        <LocalizedText style={[styles.tableColHeader, { flex: 1.2 }]}>Nhịp tim</LocalizedText>
        <LocalizedText style={[styles.tableColHeader, { flex: 1.2 }]}>SpO₂</LocalizedText>
        <LocalizedText style={[styles.tableColHeader, { flex: 1.5 }]}>Huyết áp</LocalizedText>
      </View>
      {trends.length === 0 ? (
        <View style={{ paddingVertical: 14, alignItems: 'center' }}>
          <LocalizedText style={{ fontSize: 13, color: '#94A3B8' }}>
            Chưa có dữ liệu nhật ký đo
          </LocalizedText>
        </View>
      ) : (
        trends.slice(0, 5).map((row: any, i: number) => (
          <View
            key={i}
            style={[
              styles.tableRow,
              i % 2 === 1 && { backgroundColor: isDarkMode ? '#0F172A44' : '#F8FAFC' },
            ]}
          >
            <LocalizedText
              style={[styles.tableCell, { flex: 1.2, fontWeight: '700', color: colors.textPrimary }]}
            >
              {row.date}
            </LocalizedText>
            <LocalizedText style={[styles.tableCell, { flex: 1.2, color: '#EF4444' }]}>
              {row.avg_heart_rate ? `${row.avg_heart_rate} bpm` : '--'}
            </LocalizedText>
            <LocalizedText
              style={[
                styles.tableCell,
                { flex: 1.2, color: row.min_spo2 && row.min_spo2 < 94 ? '#DC2626' : '#0284C7' },
              ]}
            >
              {row.avg_spo2 ? `${row.avg_spo2}%` : '--'}
            </LocalizedText>
            <LocalizedText style={[styles.tableCell, { flex: 1.5, color: '#10B981' }]}>
              {row.bp || '--'}
            </LocalizedText>
          </View>
        ))
      )}
    </View>
  );
};

// =============================================================
// 4. MÀN HÌNH CHỌN BỆNH NHÂN ĐỂ XEM BÁO CÁO (PatientSelectionView)
// =============================================================
export interface PatientSelectionViewProps {
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
  onBack?: () => void;
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
  onBack,
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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {onBack && (
              <TouchableOpacity
                style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6', marginRight: 10 }]}
                onPress={onBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
            <LocalizedText style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Hồ Sơ Y Khoa Bác Sĩ Gia Đình
            </LocalizedText>
            <LocalizedText style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Báo Cáo & Phân Tích Sinh Hiệu
            </LocalizedText>
          </View>
        </View>

          <TouchableOpacity
            style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
            onPress={onReload}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={17} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <LocalizedText style={[styles.guideText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
          Chọn một bệnh nhân bên dưới để xem báo cáo lâm sàng và đồ thị diễn tiến:
        </LocalizedText>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
          <LocalizedTextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Tìm theo tên hoặc số điện thoại..."
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

        <View style={styles.filterRow}>
          {[
            { key: 'ALL', label: `Tất cả (${patients.length})` },
            { key: 'WARNING', label: `Cần chú ý (${warningCount})` },
            { key: 'NORMAL', label: `Ổn định (${normalCount})` },
          ].map((tab) => {
            const isActive = filterStatus === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  !isActive && isDarkMode && { backgroundColor: '#334155' },
                ]}
                onPress={() => onFilterChange(tab.key as any)}
              >
                <LocalizedText
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                    !isActive && isDarkMode && { color: '#CBD5E1' },
                  ]}
                >
                  {tab.label}
                </LocalizedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredPatients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={48} color="#94A3B8" />
            <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              {searchQuery ? 'Không tìm thấy bệnh nhân nào khớp với từ khóa.' : 'Chưa có bệnh nhân nào trong danh sách.'}
            </LocalizedText>
          </View>
        ) : (
          filteredPatients.map((pat) => {
            const isWarn = pat.healthStatus === 'WARNING';
            const isDanger = pat.healthStatus === 'DANGER';
            const patPhone = (pat as any).phone;
            const patAddress = (pat as any).house_address || pat.houseName;
            return (
              <TouchableOpacity
                key={pat.id}
                style={[
                  styles.rosterCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : colors.border,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => onSelectPatient(pat)}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.avatarCircle,
                      {
                        backgroundColor: isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#E0F2FE',
                        borderColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#0284C7',
                      },
                    ]}
                  >
                    <LocalizedText
                      style={[
                        styles.avatarInitial,
                        { color: isDanger ? '#DC2626' : isWarn ? '#B45309' : '#0284C7' },
                      ]}
                    >
                      {pat.name.slice(0, 1).toUpperCase()}
                    </LocalizedText>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.nameRow}>
                      <LocalizedText style={[styles.cardPatientName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {pat.name}
                      </LocalizedText>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#DCFCE7',
                          },
                        ]}
                      >
                        <LocalizedText
                          style={[
                            styles.statusBadgeText,
                            { color: isDanger ? '#DC2626' : isWarn ? '#B45309' : '#059669' },
                          ]}
                        >
                          {isDanger ? 'NGUY CẤP' : isWarn ? 'CẢNH BÁO' : 'ỔN ĐỊNH'}
                        </LocalizedText>
                      </View>
                    </View>

                    <LocalizedText style={[styles.cardMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {pat.age} tuổi • {pat.gender}
                      {patPhone ? ` • 📞 ${patPhone}` : ''}
                    </LocalizedText>

                    {patAddress ? (
                      <LocalizedText style={[styles.cardAddress, { color: isDarkMode ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>
                        📍 {patAddress}
                      </LocalizedText>
                    ) : null}
                  </View>
                </View>

                {pat.condition && (
                  <View
                    style={[
                      styles.cardConditionRow,
                      { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' },
                    ]}
                  >
                    <Ionicons name="pulse" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                    <LocalizedText style={[styles.cardConditionText, { color: colors.textPrimary }]} numberOfLines={1}>
                      Bệnh lý nền: {pat.condition}
                    </LocalizedText>
                  </View>
                )}

                <View style={styles.vitalsRow}>
                  <View style={[styles.vitalItem, { backgroundColor: isDarkMode ? '#0F172A' : '#FEF2F2' }]}>
                    <Ionicons name="heart" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                    <LocalizedText style={[styles.vitalVal, { color: '#EF4444' }]}>
                      {pat.heartRate ? `${pat.heartRate} bpm` : '--'}
                    </LocalizedText>
                  </View>
                  <View style={[styles.vitalItem, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' }]}>
                    <Ionicons name="water" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                    <LocalizedText style={[styles.vitalVal, { color: '#0284C7' }]}>
                      {pat.spo2 ? `${pat.spo2}%` : '--'}
                    </LocalizedText>
                  </View>
                  <View style={[styles.vitalItem, { backgroundColor: isDarkMode ? '#0F172A' : '#ECFDF5' }]}>
                    <Ionicons name="speedometer" size={13} color="#10B981" style={{ marginRight: 4 }} />
                    <LocalizedText style={[styles.vitalVal, { color: '#10B981' }]}>
                      {pat.bloodPressure || '--'}
                    </LocalizedText>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <LocalizedText style={styles.cardActionText}>Xem báo cáo lâm sàng & đồ thị</LocalizedText>
                  <Ionicons name="chevron-forward" size={14} color="#0284C7" style={{ marginLeft: 2 }} />
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
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerSubtitle: { fontSize: 11.5, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', marginTop: 1 },
  reloadBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  guideText: { fontSize: 12.5, marginBottom: 10, fontWeight: '500' },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#0284C7' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  listContainer: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, marginTop: 10, textAlign: 'center' },
  rosterCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cardPatientName: { fontSize: 15.5, fontWeight: '800', flex: 1, marginRight: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardMeta: { fontSize: 12, marginBottom: 2 },
  cardAddress: { fontSize: 11 },
  cardConditionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 10, marginBottom: 8 },
  cardConditionText: { fontSize: 12, fontWeight: '500', flex: 1 },
  vitalsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  vitalItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 8 },
  vitalVal: { fontSize: 12, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0', paddingTop: 8 },
  cardActionText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },

  assessmentCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreNumber: { fontSize: 20, fontWeight: '800' },
  scoreMax: { fontSize: 10, color: '#94A3B8', marginTop: -2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  statusTagText: { fontSize: 10, fontWeight: '800' },
  assessmentTitle: { fontSize: 14, fontWeight: '700' },
  assessmentDesc: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statCard: { width: '48.5%', borderRadius: 12, padding: 12, borderWidth: 1 },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statUnit: { fontSize: 10.5, color: '#94A3B8' },
  statVal: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statLbl: { fontSize: 11.5, fontWeight: '600', color: '#64748B' },
  statSubRange: { fontSize: 9.5, color: '#94A3B8', marginTop: 2 },

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
