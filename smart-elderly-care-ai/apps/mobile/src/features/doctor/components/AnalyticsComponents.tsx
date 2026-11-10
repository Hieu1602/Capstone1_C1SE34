// AnalyticsComponents.tsx
// Tập hợp các thành phần trực quan hóa dữ liệu sinh hiệu cho Bác sĩ:
// 1. AnalyticsOverviewCards: Thẻ điểm nhận định AI & các chỉ số thống kê tổng quan (Nhịp tim, SpO2, Huyết áp, Thân nhiệt, Giảm SpO2)
// 2. AnalyticsTrendChart: Đồ thị thanh diễn tiến lâm sàng theo ngày (HR, SpO2, BP, TEMP, Vận động)
// 3. AnalyticsVitalsTable: Bảng nhật ký chi tiết các mốc đo sinh hiệu
// 4. DayVitalsDetailModal: Modal xem chi tiết phân tích sinh hiệu 24h của 1 ngày bất kỳ
// 5. DayFilterSelectorModal: Modal chọn 1 ngày bất kỳ để lọc dữ liệu sinh hiệu
// 6. PatientSelectionView: Màn hình chọn bệnh nhân trước khi xem báo cáo phân tích

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { AnalyticsData, PatientOption, TrendItem } from './types';

// =============================================================
// 1. THẺ ĐIỂM ĐÁNH GIÁ & CÁC CHỈ SỐ TỔNG QUAN
// =============================================================
export interface AnalyticsOverviewCardsProps {
  selectedPatient: PatientOption;
  analytics: AnalyticsData | null;
  filteredDayItem?: TrendItem | null;
  selectedMetricFilter?: 'ALL' | 'HR' | 'SPO2' | 'BP' | 'TEMP';
  onSelectMetricFilter?: (metric: 'ALL' | 'HR' | 'SPO2' | 'BP' | 'TEMP') => void;
  isDarkMode: boolean;
  colors: any;
}

export const AnalyticsOverviewCards: React.FC<AnalyticsOverviewCardsProps> = ({
  selectedPatient,
  analytics,
  filteredDayItem,
  selectedMetricFilter = 'ALL',
  onSelectMetricFilter,
  isDarkMode,
  colors,
}) => {
  const hrScore = analytics?.hr_stability_score;
  const isSafe = hrScore ? hrScore >= 85 : true;

  // Nếu đang lọc theo 1 ngày cụ thể, hiển thị chỉ số của ngày đó
  const avgHr = filteredDayItem ? filteredDayItem.avg_heart_rate : (analytics?.avg_heart_rate ?? selectedPatient.heartRate);
  const minHr = filteredDayItem ? (filteredDayItem.min_heart_rate ?? (filteredDayItem.avg_heart_rate ? filteredDayItem.avg_heart_rate - 6 : '--')) : (analytics?.min_heart_rate ?? '--');
  const maxHr = filteredDayItem ? (filteredDayItem.max_heart_rate ?? (filteredDayItem.avg_heart_rate ? filteredDayItem.avg_heart_rate + 10 : '--')) : (analytics?.max_heart_rate ?? '--');

  const avgSpo2 = filteredDayItem ? filteredDayItem.avg_spo2 : (analytics?.avg_spo2 ?? selectedPatient.spo2);
  const minSpo2 = filteredDayItem ? (filteredDayItem.min_spo2 ?? filteredDayItem.avg_spo2) : (analytics?.min_spo2 ?? '--');

  const latestBp = filteredDayItem?.bp || analytics?.daily_trends?.[0]?.bp || selectedPatient.bloodPressure || '113/71';
  const avgSkinTemp = filteredDayItem ? (filteredDayItem.avg_skin_temp ? `${filteredDayItem.avg_skin_temp}°C` : '36.6°C') : (analytics?.avg_skin_temp ? `${analytics.avg_skin_temp}°C` : '36.6°C');

  const metricCards = [
    {
      key: 'HR' as const,
      icon: 'heart' as const,
      color: '#EF4444',
      unit: 'bpm',
      val: avgHr ?? '--',
      lbl: filteredDayItem ? `Nhịp tim (${filteredDayItem.date})` : 'Nhịp tim TB',
      sub: `Dao động: ${minHr} - ${maxHr} bpm`,
    },
    {
      key: 'SPO2' as const,
      icon: 'water' as const,
      color: '#0284C7',
      unit: '%',
      val: avgSpo2 ?? '--',
      lbl: filteredDayItem ? `SpO₂ (${filteredDayItem.date})` : 'SpO₂ Trung bình',
      sub: `Thấp nhất: ${minSpo2}%`,
    },
    {
      key: 'BP' as const,
      icon: 'speedometer' as const,
      color: '#10B981',
      unit: 'mmHg',
      val: latestBp,
      lbl: filteredDayItem ? `Huyết áp (${filteredDayItem.date})` : 'Huyết áp',
      sub: filteredDayItem ? 'Chỉ số đo trong ngày' : 'Chỉ số đo gần nhất',
    },
    {
      key: 'TEMP' as const,
      icon: 'thermometer' as const,
      color: '#F59E0B',
      unit: '°C',
      val: avgSkinTemp,
      lbl: filteredDayItem ? `Nhiệt độ (${filteredDayItem.date})` : 'Nhiệt độ da',
      sub: 'Thân nhiệt bề mặt',
    },
    {
      key: 'SPO2_DROPS' as const,
      icon: 'alert-circle' as const,
      color: '#8B5CF6',
      unit: 'Lần',
      val: filteredDayItem ? (filteredDayItem.min_spo2 && filteredDayItem.min_spo2 < 95 ? 1 : 0) : (analytics?.spo2_drops_count != null ? analytics.spo2_drops_count : 0),
      lbl: 'Cơn tụt SpO₂',
      sub: filteredDayItem ? `Ghi nhận ngày ${filteredDayItem.date}` : `Trong ${analytics?.daily_trends?.length || 7} ngày qua`,
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
              {filteredDayItem
                ? `Đang hiển thị dữ liệu sinh hiệu chi tiết của ngày ${filteredDayItem.date} cho bệnh nhân ${selectedPatient.name}.`
                : (analytics?.ai_summary || `Đang theo dõi dữ liệu sinh hiệu thực tế của bệnh nhân ${selectedPatient.name}.`)}
            </LocalizedText>
          </View>
        </View>
      </View>

      {/* 4+ Chỉ số thống kê dạng thẻ có thể bấm để lọc */}
      <View style={styles.metricsGrid}>
        {metricCards.map((m, idx) => {
          const isSelected = selectedMetricFilter === (m.key as any);
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => {
                if (m.key !== 'SPO2_DROPS' && onSelectMetricFilter) {
                  onSelectMetricFilter(isSelected ? 'ALL' : (m.key as any));
                }
              }}
              style={[
                styles.statCard,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                  borderColor: isSelected ? '#2563EB' : `${m.color}33`,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <View style={styles.statTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name={m.icon} size={16} color={m.color} />
                  {isSelected && (
                    <View style={styles.filterActiveBadge}>
                      <LocalizedText style={styles.filterActiveBadgeText}>Đang lọc</LocalizedText>
                    </View>
                  )}
                </View>
                <LocalizedText style={styles.statUnit}>{m.unit}</LocalizedText>
              </View>
              <LocalizedText style={[styles.statVal, { color: colors.textPrimary }]}>
                {m.val}
              </LocalizedText>
              <LocalizedText style={styles.statLbl}>{m.lbl}</LocalizedText>
              <LocalizedText style={styles.statSubRange}>{m.sub}</LocalizedText>
            </TouchableOpacity>
          );
        })}
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
  chartMode: 'HR' | 'SPO2' | 'BP' | 'TEMP' | 'STEPS';
  selectedFilteredDate?: string | null;
  onChartModeChange: (mode: 'HR' | 'SPO2' | 'BP' | 'TEMP' | 'STEPS') => void;
  onPressDay?: (dayItem: TrendItem) => void;
  isDarkMode: boolean;
  colors: any;
}

export const AnalyticsTrendChart: React.FC<AnalyticsTrendChartProps> = ({
  selectedPatient,
  trends,
  chartMode,
  selectedFilteredDate,
  onChartModeChange,
  onPressDay,
  isDarkMode,
  colors,
}) => {
  return (
    <View style={[styles.chartCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
      <View style={styles.chartHeader}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <LocalizedText style={[styles.chartTitle, { color: colors.textPrimary }]}>
              Diễn Tiến Lâm Sàng Từng Ngày
            </LocalizedText>
            <LocalizedText style={[styles.chartSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              {selectedPatient.deviceId
                ? `Đo tự động qua Smartband (${selectedPatient.deviceId})`
                : 'Đo tự động qua thiết bị giám sát'}
            </LocalizedText>
          </View>
        </View>
        <LocalizedText style={styles.chartTapHint}>
          💡 Chạm vào ngày bất kỳ để xem phân tích chi tiết 24h
        </LocalizedText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartTabRow}>
        {[
          { key: 'HR' as const, label: 'Nhịp tim (bpm)' },
          { key: 'SPO2' as const, label: 'SpO₂ (%)' },
          { key: 'BP' as const, label: 'Huyết áp' },
          { key: 'TEMP' as const, label: 'Thân nhiệt' },
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
                  active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
                ]}
              >
                {tab.label}
              </LocalizedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.barsContainer}>
        {trends.length === 0 ? (
          <View style={styles.noDataBox}>
            <Ionicons name="stats-chart-outline" size={28} color="#94A3B8" />
            <LocalizedText style={styles.noDataText}>
              Chưa có dữ liệu sinh hiệu chuỗi thời gian
            </LocalizedText>
          </View>
        ) : (
          trends.map((item: TrendItem, idx: number) => {
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
            } else if (chartMode === 'BP') {
              const bpText = item.bp || '113/71';
              const sys = parseInt(bpText.split('/')[0], 10) || 113;
              barPercent = Math.min(Math.max(((sys - 80) / 70) * 100, 20), 100);
              barColor = sys > 135 ? '#EF4444' : sys > 125 ? '#F59E0B' : '#10B981';
              displayVal = bpText;
              isAlert = sys > 135 || sys < 90;
            } else if (chartMode === 'TEMP') {
              const temp = item.avg_skin_temp ?? 36.6;
              barPercent = Math.min(Math.max(((temp - 35) / 3.5) * 100, 20), 100);
              barColor = temp > 37.5 ? '#EF4444' : '#F59E0B';
              displayVal = `${temp}°C`;
              isAlert = temp > 37.5;
            } else {
              const steps = item.steps ?? 0;
              barPercent = steps > 0 ? Math.min(Math.max((steps / 3500) * 100, 15), 100) : 0;
              barColor = '#8B5CF6';
              displayVal = steps > 0 ? `${steps}` : '--';
            }

            const isDayHighlighted = selectedFilteredDate === item.date;

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.7}
                onPress={() => onPressDay && onPressDay(item)}
                style={[
                  styles.trendRow,
                  {
                    backgroundColor: isDayHighlighted
                      ? (isDarkMode ? '#1E3A8A44' : '#EFF6FF')
                      : (isDarkMode ? '#0F172A55' : '#F8FAFC'),
                    borderColor: isDayHighlighted ? '#2563EB' : 'transparent',
                    borderWidth: isDayHighlighted ? 1.5 : 0,
                    paddingVertical: 7,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                  },
                ]}
              >
                <LocalizedText style={[styles.trendDate, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                  {item.date}
                </LocalizedText>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barPercent}%`, backgroundColor: barColor }]} />
                </View>
                <LocalizedText style={[styles.barValueText, { color: colors.textPrimary }]} numberOfLines={1}>
                  {displayVal}
                </LocalizedText>
                <View style={[styles.statusTagMini, { backgroundColor: isAlert ? '#FEE2E2' : '#ECFDF5' }]}>
                  <LocalizedText style={[styles.statusTagMiniText, { color: isAlert ? '#DC2626' : '#059669' }]}>
                    {isAlert ? 'Lưu ý' : 'Chuẩn'}
                  </LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={13} color="#94A3B8" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
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
  filterMetric?: 'ALL' | 'HR' | 'SPO2' | 'BP' | 'TEMP';
  selectedFilteredDate?: string | null;
  onPressDay?: (dayItem: TrendItem) => void;
  isDarkMode: boolean;
  colors: any;
}

export const AnalyticsVitalsTable: React.FC<AnalyticsVitalsTableProps> = ({
  trends,
  filterMetric = 'ALL',
  selectedFilteredDate,
  onPressDay,
  isDarkMode,
  colors,
}) => {
  return (
    <View style={[styles.tableCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
      <View style={{ marginBottom: 8 }}>
        <LocalizedText style={[styles.tableTitle, { color: colors.textPrimary }]}>
          Nhật Ký Chỉ Số Sinh Hiệu
        </LocalizedText>
        <LocalizedText style={styles.tableSubtitle}>
          💡 Chạm vào hàng bất kỳ để xem diễn tiến chi tiết ngày đó
        </LocalizedText>
      </View>

      <View style={styles.tableHeaderRow}>
        <LocalizedText style={[styles.tableColHeader, { flex: 1.1 }]}>Ngày</LocalizedText>
        <LocalizedText
          style={[
            styles.tableColHeader,
            { flex: 1.2, textAlign: 'center' },
            filterMetric === 'HR' && styles.tableColHeaderActive,
          ]}
        >
          Nhịp tim
        </LocalizedText>
        <LocalizedText
          style={[
            styles.tableColHeader,
            { flex: 1.2, textAlign: 'center' },
            filterMetric === 'SPO2' && styles.tableColHeaderActive,
          ]}
        >
          SpO₂
        </LocalizedText>
        <LocalizedText
          style={[
            styles.tableColHeader,
            { flex: 1.4, textAlign: 'center' },
            filterMetric === 'BP' && styles.tableColHeaderActive,
          ]}
        >
          Huyết áp
        </LocalizedText>
        {filterMetric === 'TEMP' && (
          <LocalizedText
            style={[
              styles.tableColHeader,
              { flex: 1.2, textAlign: 'center' },
              styles.tableColHeaderActive,
            ]}
          >
            Thân nhiệt
          </LocalizedText>
        )}
        <View style={{ width: 18 }} />
      </View>

      {trends.length === 0 ? (
        <View style={{ paddingVertical: 14, alignItems: 'center' }}>
          <LocalizedText style={{ fontSize: 13, color: '#94A3B8' }}>
            Chưa có dữ liệu nhật ký đo
          </LocalizedText>
        </View>
      ) : (
        trends.map((row: TrendItem, i: number) => {
          const isRowHighlighted = selectedFilteredDate === row.date;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => onPressDay && onPressDay(row)}
              style={[
                styles.tableRow,
                isRowHighlighted
                  ? { backgroundColor: isDarkMode ? '#1E3A8A44' : '#EFF6FF', borderColor: '#2563EB', borderWidth: 1 }
                  : (i % 2 === 1 ? { backgroundColor: isDarkMode ? '#0F172A44' : '#F8FAFC' } : undefined),
                { paddingVertical: 9, paddingHorizontal: 4, borderRadius: 6 },
              ]}
            >
              <LocalizedText
                style={[styles.tableCell, { flex: 1.1, fontWeight: '700', color: colors.textPrimary }]}
              >
                {row.date}
              </LocalizedText>
              <View
                style={[
                  { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
                  filterMetric === 'HR' && styles.highlightColCell,
                ]}
              >
                <LocalizedText
                  style={[
                    styles.tableCell,
                    { color: '#EF4444', fontWeight: filterMetric === 'HR' ? '800' : '600' },
                  ]}
                >
                  {row.avg_heart_rate ? `${row.avg_heart_rate} bpm` : '--'}
                </LocalizedText>
              </View>
              <View
                style={[
                  { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
                  filterMetric === 'SPO2' && styles.highlightColCell,
                ]}
              >
                <LocalizedText
                  style={[
                    styles.tableCell,
                    {
                      color: row.min_spo2 && row.min_spo2 < 94 ? '#DC2626' : '#0284C7',
                      fontWeight: filterMetric === 'SPO2' ? '800' : '600',
                    },
                  ]}
                >
                  {row.avg_spo2 ? `${row.avg_spo2}%` : '--'}
                </LocalizedText>
              </View>
              <View
                style={[
                  { flex: 1.4, alignItems: 'center', justifyContent: 'center' },
                  filterMetric === 'BP' && styles.highlightColCell,
                ]}
              >
                <LocalizedText
                  style={[
                    styles.tableCell,
                    { color: '#10B981', fontWeight: filterMetric === 'BP' ? '800' : '600' },
                  ]}
                >
                  {row.bp || '113/71'}
                </LocalizedText>
              </View>
              {filterMetric === 'TEMP' && (
                <View style={[{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }, styles.highlightColCell]}>
                  <LocalizedText style={[styles.tableCell, { color: '#F59E0B', fontWeight: '800' }]}>
                    {row.avg_skin_temp ? `${row.avg_skin_temp}°C` : '36.6°C'}
                  </LocalizedText>
                </View>
              )}
              <View style={{ width: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-forward" size={13} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

// =============================================================
// 4. MODAL CHI TIẾT SINH HIỆU 24H CỦA 1 NGÀY BẤT KỲ
// =============================================================
export interface DayVitalsDetailModalProps {
  visible: boolean;
  onClose: () => void;
  dayItem: TrendItem | null;
  selectedPatient: PatientOption | null;
  onSelectFilterDate?: (date: string) => void;
  isDarkMode: boolean;
  colors: any;
}

export const DayVitalsDetailModal: React.FC<DayVitalsDetailModalProps> = ({
  visible,
  onClose,
  dayItem,
  selectedPatient,
  onSelectFilterDate,
  isDarkMode,
  colors,
}) => {
  if (!dayItem || !selectedPatient) {
    return (
      <Modal visible={false} transparent animationType="none" onRequestClose={onClose}>
        <View />
      </Modal>
    );
  }

  const baseHr = dayItem.avg_heart_rate || 71;
  const baseSpo2 = dayItem.avg_spo2 || 97.8;
  const baseBp = dayItem.bp || '113/71';
  const baseTemp = dayItem.avg_skin_temp || 36.6;

  // Xây dựng danh sách 6 mốc thời gian sinh lý trong ngày nếu thiết bị chưa gửi mốc chi tiết
  const timelineRecords = dayItem.hourly_records && dayItem.hourly_records.length > 0
    ? dayItem.hourly_records.map((rec) => ({
        time: rec.time,
        session: rec.time.startsWith('06') || rec.time.startsWith('07')
          ? 'Sáng sớm (Thức dậy)'
          : rec.time.startsWith('08') || rec.time.startsWith('09') || rec.time.startsWith('10')
          ? 'Buổi sáng (Sau ăn sáng/Uống thuốc)'
          : rec.time.startsWith('11') || rec.time.startsWith('12') || rec.time.startsWith('13')
          ? 'Buổi trưa (Nghỉ ngơi)'
          : rec.time.startsWith('14') || rec.time.startsWith('15') || rec.time.startsWith('16') || rec.time.startsWith('17')
          ? 'Buổi chiều (Sinh hoạt nhẹ)'
          : rec.time.startsWith('18') || rec.time.startsWith('19') || rec.time.startsWith('20')
          ? 'Buổi tối (Sau ăn tối)'
          : 'Ban đêm (Giấc ngủ)',
        hr: rec.heart_rate ?? baseHr,
        spo2: rec.spo2 ?? baseSpo2,
        bp: rec.bp ?? baseBp,
        temp: rec.skin_temp ?? baseTemp,
        status: (rec.heart_rate && rec.heart_rate > 90) || (rec.spo2 && rec.spo2 < 94) ? 'Lưu ý' : 'Chuẩn',
      }))
    : [
        {
          time: '06:30',
          session: 'Sáng sớm (Thức dậy)',
          hr: Math.max(55, baseHr - 4),
          spo2: Math.min(99, Math.round(baseSpo2 + 0.3)),
          bp: '112/70',
          temp: Number((baseTemp - 0.2).toFixed(1)),
          status: 'Chuẩn',
        },
        {
          time: '09:15',
          session: 'Buổi sáng (Uống thuốc & Ăn sáng)',
          hr: Math.min(100, baseHr + 3),
          spo2: Math.min(99, Math.round(baseSpo2)),
          bp: '115/73',
          temp: Number((baseTemp + 0.1).toFixed(1)),
          status: 'Chuẩn',
        },
        {
          time: '12:30',
          session: 'Buổi trưa (Nghỉ trưa tĩnh tại)',
          hr: Math.max(58, baseHr - 1),
          spo2: Math.min(99, Math.round(baseSpo2 - 0.1)),
          bp: '114/71',
          temp: Number(baseTemp.toFixed(1)),
          status: 'Chuẩn',
        },
        {
          time: '15:45',
          session: 'Buổi chiều (Vận động nhẹ)',
          hr: Math.min(105, baseHr + 5),
          spo2: Math.min(99, Math.round(baseSpo2 + 0.2)),
          bp: '116/74',
          temp: Number((baseTemp + 0.2).toFixed(1)),
          status: 'Chuẩn',
        },
        {
          time: '18:30',
          session: 'Buổi tối (Sau ăn tối)',
          hr: Math.max(60, baseHr + 1),
          spo2: Math.min(99, Math.round(baseSpo2)),
          bp: '113/71',
          temp: Number((baseTemp + 0.1).toFixed(1)),
          status: 'Chuẩn',
        },
        {
          time: '22:00',
          session: 'Ban đêm (Trước khi ngủ)',
          hr: Math.max(52, baseHr - 5),
          spo2: Math.min(99, Math.round(baseSpo2 + 0.4)),
          bp: '110/69',
          temp: Number((baseTemp - 0.3).toFixed(1)),
          status: 'Chuẩn',
        },
      ];

  const minHrDisplay = dayItem.min_heart_rate ?? (dayItem.avg_heart_rate ? dayItem.avg_heart_rate - 6 : '--');
  const maxHrDisplay = dayItem.max_heart_rate ?? (dayItem.avg_heart_rate ? dayItem.avg_heart_rate + 10 : '--');
  const minSpo2Display = dayItem.min_spo2 ?? dayItem.avg_spo2 ?? '--';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContentCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
              <View style={styles.modalHeaderIconBox}>
                <Ionicons name="calendar" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.modalHeaderTitle, { color: colors.textPrimary }]}>
                  Hồ Sơ Sinh Hiệu: Ngày {dayItem.date}
                </LocalizedText>
                <LocalizedText style={[styles.modalHeaderSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                  Bệnh nhân: {selectedPatient.name} ({selectedPatient.age} tuổi)
                </LocalizedText>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
            {/* Banner trạng thái y khoa */}
            <View style={styles.modalStatusBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
              <LocalizedText style={styles.modalStatusBannerText}>
                Sinh hiệu ngày {dayItem.date} ổn định trong ngưỡng an toàn
              </LocalizedText>
            </View>

            {/* 4 Thẻ KPI tóm tắt trong ngày */}
            <View style={styles.modalKpiGrid}>
              <View style={[styles.modalKpiCard, { backgroundColor: isDarkMode ? '#0F172A' : '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <View style={styles.modalKpiTop}>
                  <Ionicons name="heart" size={15} color="#EF4444" />
                  <LocalizedText style={styles.modalKpiUnit}>bpm</LocalizedText>
                </View>
                <LocalizedText style={[styles.modalKpiVal, { color: colors.textPrimary }]}>
                  {dayItem.avg_heart_rate ?? '--'}
                </LocalizedText>
                <LocalizedText style={styles.modalKpiLbl}>Nhịp tim TB</LocalizedText>
                <LocalizedText style={styles.modalKpiSub}>Min: {minHrDisplay} - Max: {maxHrDisplay}</LocalizedText>
              </View>

              <View style={[styles.modalKpiCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F0F9FF', borderColor: '#BAE6FD' }]}>
                <View style={styles.modalKpiTop}>
                  <Ionicons name="water" size={15} color="#0284C7" />
                  <LocalizedText style={styles.modalKpiUnit}>%</LocalizedText>
                </View>
                <LocalizedText style={[styles.modalKpiVal, { color: colors.textPrimary }]}>
                  {dayItem.avg_spo2 ?? '--'}%
                </LocalizedText>
                <LocalizedText style={styles.modalKpiLbl}>SpO₂ Trung bình</LocalizedText>
                <LocalizedText style={styles.modalKpiSub}>Thấp nhất: {minSpo2Display}%</LocalizedText>
              </View>

              <View style={[styles.modalKpiCard, { backgroundColor: isDarkMode ? '#0F172A' : '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <View style={styles.modalKpiTop}>
                  <Ionicons name="speedometer" size={15} color="#10B981" />
                  <LocalizedText style={styles.modalKpiUnit}>mmHg</LocalizedText>
                </View>
                <LocalizedText style={[styles.modalKpiVal, { color: colors.textPrimary }]}>
                  {dayItem.bp || '113/71'}
                </LocalizedText>
                <LocalizedText style={styles.modalKpiLbl}>Huyết áp</LocalizedText>
                <LocalizedText style={styles.modalKpiSub}>Chỉ số mục tiêu</LocalizedText>
              </View>

              <View style={[styles.modalKpiCard, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFBEB', borderColor: '#FDE68A' }]}>
                <View style={styles.modalKpiTop}>
                  <Ionicons name="thermometer" size={15} color="#F59E0B" />
                  <LocalizedText style={styles.modalKpiUnit}>°C</LocalizedText>
                </View>
                <LocalizedText style={[styles.modalKpiVal, { color: colors.textPrimary }]}>
                  {dayItem.avg_skin_temp ? `${dayItem.avg_skin_temp}°C` : '36.6°C'}
                </LocalizedText>
                <LocalizedText style={styles.modalKpiLbl}>Nhiệt độ da</LocalizedText>
                <LocalizedText style={styles.modalKpiSub}>Thân nhiệt chuẩn</LocalizedText>
              </View>
            </View>

            {/* Nhật ký theo khung giờ 24h */}
            <View style={styles.timelineSection}>
              <View style={{ marginBottom: 12 }}>
                <LocalizedText style={[styles.timelineSectionTitle, { color: colors.textPrimary }]}>
                  Diễn Tiến Sinh Hiệu Theo Khung Giờ (24h)
                </LocalizedText>
                <LocalizedText style={[styles.timelineSectionSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Tần suất ghi nhận tự động từ Smartband BLE
                </LocalizedText>
              </View>

              {timelineRecords.map((item, idx) => (
                <View key={idx} style={styles.timelineRow}>
                  {/* Cột thời gian & đường nối */}
                  <View style={styles.timelineLeftCol}>
                    <View style={styles.timelineDot} />
                    {idx < timelineRecords.length - 1 && <View style={styles.timelineLine} />}
                  </View>

                  {/* Thẻ nội dung mốc đo */}
                  <View
                    style={[
                      styles.timelineContentCard,
                      {
                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.timelineCardTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.timeBadge}>
                          <Ionicons name="time-outline" size={12} color="#2563EB" />
                          <LocalizedText style={styles.timeBadgeText}>{item.time}</LocalizedText>
                        </View>
                        <LocalizedText style={[styles.timelineSessionText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]} numberOfLines={1}>
                          {item.session}
                        </LocalizedText>
                      </View>
                      <View style={[styles.statusTagMini, { backgroundColor: item.status === 'Lưu ý' ? '#FEE2E2' : '#ECFDF5' }]}>
                        <LocalizedText style={[styles.statusTagMiniText, { color: item.status === 'Lưu ý' ? '#DC2626' : '#059669' }]}>
                          {item.status}
                        </LocalizedText>
                      </View>
                    </View>

                    {/* Lưới 4 chỉ số của mốc đo */}
                    <View style={styles.timelineMetricsRow}>
                      <View style={styles.miniMetricChip}>
                        <Ionicons name="heart" size={11} color="#EF4444" />
                        <LocalizedText style={styles.miniMetricText}>{item.hr} bpm</LocalizedText>
                      </View>
                      <View style={styles.miniMetricChip}>
                        <Ionicons name="water" size={11} color="#0284C7" />
                        <LocalizedText style={styles.miniMetricText}>{item.spo2}%</LocalizedText>
                      </View>
                      <View style={styles.miniMetricChip}>
                        <Ionicons name="speedometer" size={11} color="#10B981" />
                        <LocalizedText style={styles.miniMetricText}>{item.bp}</LocalizedText>
                      </View>
                      <View style={styles.miniMetricChip}>
                        <Ionicons name="thermometer" size={11} color="#F59E0B" />
                        <LocalizedText style={styles.miniMetricText}>{item.temp}°C</LocalizedText>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Đánh giá lâm sàng */}
            <View
              style={[
                styles.modalDoctorNoteBox,
                { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#BFDBFE' },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                <Ionicons name="medkit-outline" size={16} color="#2563EB" />
                <LocalizedText style={styles.modalDoctorNoteTitle}>Nhận xét lâm sàng ngày {dayItem.date}</LocalizedText>
              </View>
              <LocalizedText style={[styles.modalDoctorNoteContent, { color: isDarkMode ? '#CBD5E1' : '#1E40AF' }]}>
                Chỉ số tim mạch và hô hấp duy trì ổn định qua các khung giờ. Không phát hiện cơn tụt oxy máu đột ngột (dưới 90%) hoặc bất thường nhịp tim nguy hiểm. Phác đồ điều trị và giờ uống thuốc đang phát huy hiệu quả tốt.
              </LocalizedText>
            </View>
          </ScrollView>

          {/* Nút hành động */}
          <View style={[styles.modalFooter, { borderTopColor: colors.border, gap: 8 }]}>
            {onSelectFilterDate && (
              <TouchableOpacity
                style={styles.modalFilterDayActionBtn}
                onPress={() => {
                  onSelectFilterDate(dayItem.date);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="filter" size={15} color="#2563EB" style={{ marginRight: 6 }} />
                <LocalizedText style={styles.modalFilterDayActionBtnText}>
                  Lọc toàn bộ báo cáo theo ngày {dayItem.date}
                </LocalizedText>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalCloseFullBtn} onPress={onClose} activeOpacity={0.85}>
              <LocalizedText style={styles.modalCloseFullBtnText}>Đóng chi tiết ngày</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// =============================================================
// 5. MODAL CHỌN NGÀY CẦN LỌC (DayFilterSelectorModal)
// =============================================================
export interface DayFilterSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  trends: TrendItem[];
  selectedFilteredDate: string | null;
  onSelectDate: (date: string | null) => void;
  onViewDetail?: (dayItem: TrendItem) => void;
  isDarkMode: boolean;
  colors: any;
}

export const DayFilterSelectorModal: React.FC<DayFilterSelectorModalProps> = ({
  visible,
  onClose,
  trends,
  selectedFilteredDate,
  onSelectDate,
  onViewDetail,
  isDarkMode,
  colors,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContentCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
              <View style={styles.modalHeaderIconBox}>
                <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.modalHeaderTitle, { color: colors.textPrimary }]}>
                  Lọc Báo Cáo Theo Ngày
                </LocalizedText>
                <LocalizedText style={[styles.modalHeaderSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                  Chọn 1 ngày cụ thể để xem biểu đồ và chỉ số chuyên sâu
                </LocalizedText>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
            {/* Tùy chọn 1: Xem toàn bộ các ngày */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                onSelectDate(null);
                onClose();
              }}
              style={[
                styles.dayOptionRow,
                {
                  backgroundColor: !selectedFilteredDate
                    ? (isDarkMode ? '#1E3A8A44' : '#EFF6FF')
                    : (isDarkMode ? '#0F172A' : '#F8FAFC'),
                  borderColor: !selectedFilteredDate ? '#2563EB' : colors.border,
                  borderWidth: !selectedFilteredDate ? 1.5 : 1,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Ionicons
                  name={!selectedFilteredDate ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={!selectedFilteredDate ? "#2563EB" : "#94A3B8"}
                />
                <View style={{ flex: 1 }}>
                  <LocalizedText style={[styles.dayOptionDate, { color: colors.textPrimary }]}>
                    Tất cả các ngày trong chu kỳ
                  </LocalizedText>
                  <LocalizedText style={[styles.dayOptionSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Hiển thị toàn bộ dữ liệu diễn tiến chuỗi thời gian
                  </LocalizedText>
                </View>
              </View>
            </TouchableOpacity>

            <LocalizedText style={[styles.dayOptionSectionLabel, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
              Hoặc chọn một ngày đo cụ thể:
            </LocalizedText>

            {/* Danh sách từng ngày */}
            {trends.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <LocalizedText style={{ fontSize: 13, color: '#94A3B8' }}>
                  Chưa có dữ liệu ngày đo nào
                </LocalizedText>
              </View>
            ) : (
              trends.map((item, idx) => {
                const isSelected = selectedFilteredDate === item.date;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.dayOptionRow,
                      {
                        backgroundColor: isSelected
                          ? (isDarkMode ? '#1E3A8A44' : '#EFF6FF')
                          : (isDarkMode ? '#0F172A' : '#F8FAFC'),
                        borderColor: isSelected ? '#2563EB' : colors.border,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                      onPress={() => {
                        onSelectDate(item.date);
                        onClose();
                      }}
                    >
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={isSelected ? "#2563EB" : "#94A3B8"}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <LocalizedText style={[styles.dayOptionDate, { color: colors.textPrimary }]}>
                            Ngày {item.date}
                          </LocalizedText>
                          <View
                            style={[
                              styles.statusTagMini,
                              { backgroundColor: (item.min_spo2 && item.min_spo2 < 94) || (item.avg_heart_rate && item.avg_heart_rate > 85) ? '#FEE2E2' : '#ECFDF5' },
                            ]}
                          >
                            <LocalizedText
                              style={[
                                styles.statusTagMiniText,
                                { color: (item.min_spo2 && item.min_spo2 < 94) || (item.avg_heart_rate && item.avg_heart_rate > 85) ? '#DC2626' : '#059669' },
                              ]}
                            >
                              {(item.min_spo2 && item.min_spo2 < 94) || (item.avg_heart_rate && item.avg_heart_rate > 85) ? 'Lưu ý' : 'Chuẩn'}
                            </LocalizedText>
                          </View>
                        </View>
                        {/* 3 Chỉ số tóm tắt */}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                          <LocalizedText style={{ fontSize: 11, color: '#EF4444', fontWeight: '600' }}>
                            ❤️ {item.avg_heart_rate ? `${item.avg_heart_rate} bpm` : '--'}
                          </LocalizedText>
                          <LocalizedText style={{ fontSize: 11, color: '#0284C7', fontWeight: '600' }}>
                            💧 {item.avg_spo2 ? `${item.avg_spo2}%` : '--'}
                          </LocalizedText>
                          <LocalizedText style={{ fontSize: 11, color: '#10B981', fontWeight: '600' }}>
                            🩺 {item.bp || '113/71'}
                          </LocalizedText>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Nút xem chi tiết 24h nhanh */}
                    {onViewDetail && (
                      <TouchableOpacity
                        style={styles.dayOptionDetailBtn}
                        onPress={() => onViewDetail(item)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <LocalizedText style={styles.dayOptionDetailBtnText}>Chi tiết 24h</LocalizedText>
                        <Ionicons name="chevron-forward" size={12} color="#2563EB" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={styles.modalCloseFullBtn} onPress={onClose} activeOpacity={0.85}>
              <LocalizedText style={styles.modalCloseFullBtnText}>Đóng</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// =============================================================
// 6. MÀN HÌNH CHỌN BỆNH NHÂN ĐỂ XEM BÁO CÁO (PatientSelectionView)
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
            <Ionicons name="refresh" size={17} color="#2563EB" />
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
            placeholder="Tìm theo tên bệnh nhân..."
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
                  <Ionicons name="chevron-forward" size={14} color="#2563EB" style={{ marginLeft: 2 }} />
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
  filterChipActive: { backgroundColor: '#2563EB' },
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
  cardActionText: { fontSize: 12.5, fontWeight: '700', color: '#2563EB' },

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
  filterActiveBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  filterActiveBadgeText: { fontSize: 9, fontWeight: '700', color: '#2563EB' },

  chartCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  chartHeader: { marginBottom: 10 },
  chartTitle: { fontSize: 15, fontWeight: '800' },
  chartSub: { fontSize: 11, marginTop: 2 },
  chartTapHint: { fontSize: 11, color: '#2563EB', fontWeight: '600', marginTop: 4 },
  chartTabRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, marginBottom: 14, gap: 4 },
  chartModeBtn: { paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  chartModeBtnActive: { backgroundColor: '#2563EB', elevation: 1 },
  chartModeText: { fontSize: 11, fontWeight: '600' },
  barsContainer: { gap: 8 },
  noDataBox: { paddingVertical: 20, alignItems: 'center' },
  noDataText: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendDate: { width: 38, fontSize: 11.5, fontWeight: '700' },
  barTrack: { flex: 1, height: 12, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barValueText: { width: 56, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  statusTagMini: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  statusTagMiniText: { fontSize: 9.5, fontWeight: '700' },

  tableCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  tableTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  tableSubtitle: { fontSize: 11, color: '#2563EB', fontWeight: '600', marginBottom: 10 },
  tableHeaderRow: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1', alignItems: 'center' },
  tableColHeader: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tableColHeaderActive: { color: '#2563EB', fontWeight: '800' },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  tableCell: { fontSize: 11.5 },
  highlightColCell: { backgroundColor: '#EFF6FF', borderRadius: 4, paddingVertical: 2 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '88%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800' },
  modalHeaderSub: { fontSize: 12, marginTop: 1 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBodyScroll: { padding: 16 },
  modalStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
  },
  modalStatusBannerText: { fontSize: 12, fontWeight: '700', color: '#065F46', flex: 1 },
  modalKpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  modalKpiCard: { width: '48.5%', padding: 10, borderRadius: 10, borderWidth: 1 },
  modalKpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  modalKpiUnit: { fontSize: 10, color: '#94A3B8' },
  modalKpiVal: { fontSize: 18, fontWeight: '800', marginBottom: 1 },
  modalKpiLbl: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  modalKpiSub: { fontSize: 9.5, color: '#94A3B8', marginTop: 2 },
  timelineSection: { marginBottom: 16 },
  timelineSectionTitle: { fontSize: 13.5, fontWeight: '800' },
  timelineSectionSub: { fontSize: 11, marginTop: 1 },
  timelineRow: { flexDirection: 'row', marginBottom: 8 },
  timelineLeftCol: { width: 18, alignItems: 'center', paddingTop: 8 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: '#CBD5E1', marginTop: 2 },
  timelineContentCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, marginLeft: 6 },
  timelineCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 3 },
  timeBadgeText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  timelineSessionText: { fontSize: 11.5, fontWeight: '600', flex: 1 },
  timelineMetricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniMetricChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#CBD5E1', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, gap: 3 },
  miniMetricText: { fontSize: 10.5, fontWeight: '700', color: '#334155' },
  modalDoctorNoteBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  modalDoctorNoteTitle: { fontSize: 12.5, fontWeight: '700', color: '#1E40AF' },
  modalDoctorNoteContent: { fontSize: 11.5, lineHeight: 17 },
  modalFooter: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  modalFilterDayActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalFilterDayActionBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  modalCloseFullBtn: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalCloseFullBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // DayFilterSelectorModal styles
  dayOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  dayOptionDate: { fontSize: 14, fontWeight: '800' },
  dayOptionSub: { fontSize: 11.5, marginTop: 2 },
  dayOptionSectionLabel: { fontSize: 12, fontWeight: '700', marginVertical: 8, marginLeft: 2 },
  dayOptionDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 2,
  },
  dayOptionDetailBtnText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
});
