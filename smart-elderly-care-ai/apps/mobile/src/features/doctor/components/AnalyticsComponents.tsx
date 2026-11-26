// AnalyticsComponents.tsx
// Tập hợp các thành phần trực quan hóa dữ liệu sinh hiệu cho Bác sĩ:
// 1. AnalyticsOverviewCards: Thẻ điểm nhận định AI & các chỉ số thống kê tổng quan
// 2. AnalyticsTrendChart: Đồ thị thanh diễn tiến lâm sàng theo ngày
// 3. AnalyticsVitalsTable: Bảng nhật ký chi tiết các mốc đo sinh hiệu
// 4. DayVitalsDetailModal: Modal xem chi tiết phân tích sinh hiệu 24h của 1 ngày bất kỳ
// 5. DayFilterSelectorModal: Modal chọn 1 ngày bất kỳ để lọc dữ liệu sinh hiệu
// 6. PatientSelectionView: Màn hình chọn bệnh nhân trước khi xem báo cáo phân tích

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { AnalyticsData, PatientOption, TrendItem } from './types';
import { formatGenderVN } from '../../../utils/formatters';

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

  const avgHr = filteredDayItem ? filteredDayItem.avg_heart_rate : (analytics?.avg_heart_rate ?? selectedPatient.heartRate);
  const minHr = filteredDayItem ? (filteredDayItem.min_heart_rate ?? (filteredDayItem.avg_heart_rate ? filteredDayItem.avg_heart_rate - 6 : '--')) : (analytics?.min_heart_rate ?? '--');
  const maxHr = filteredDayItem ? (filteredDayItem.max_heart_rate ?? (filteredDayItem.avg_heart_rate ? filteredDayItem.avg_heart_rate + 10 : '--')) : (analytics?.max_heart_rate ?? '--');

  const avgSpo2 = filteredDayItem ? filteredDayItem.avg_spo2 : (analytics?.avg_spo2 ?? selectedPatient.spo2);
  const minSpo2 = filteredDayItem ? (filteredDayItem.min_spo2 ?? filteredDayItem.avg_spo2) : (analytics?.min_spo2 ?? '--');

  const latestBp = filteredDayItem?.bp || analytics?.daily_trends?.[0]?.bp || selectedPatient.bloodPressure || '113/71';
  const avgSkinTemp = filteredDayItem
    ? (filteredDayItem.avg_skin_temp ? `${filteredDayItem.avg_skin_temp}°C` : '36.6°C')
    : (analytics?.avg_skin_temp ? `${analytics.avg_skin_temp}°C` : '36.6°C');

  const metricCards = [
    { key: 'HR' as const, icon: 'heart' as const, color: '#EF4444', unit: 'bpm', val: avgHr ?? '--', lbl: filteredDayItem ? `Nhịp tim (${filteredDayItem.date})` : 'Nhịp tim TB', sub: `Dao động: ${minHr} - ${maxHr} bpm` },
    { key: 'SPO2' as const, icon: 'water' as const, color: '#0284C7', unit: '%', val: avgSpo2 ?? '--', lbl: filteredDayItem ? `SpO₂ (${filteredDayItem.date})` : 'SpO₂ Trung bình', sub: `Thấp nhất: ${minSpo2}%` },
    { key: 'BP' as const, icon: 'speedometer' as const, color: '#10B981', unit: 'mmHg', val: latestBp, lbl: filteredDayItem ? `Huyết áp (${filteredDayItem.date})` : 'Huyết áp', sub: filteredDayItem ? 'Chỉ số đo trong ngày' : 'Chỉ số đo gần nhất' },
    { key: 'TEMP' as const, icon: 'thermometer' as const, color: '#F59E0B', unit: '°C', val: avgSkinTemp, lbl: filteredDayItem ? `Nhiệt độ (${filteredDayItem.date})` : 'Nhiệt độ da', sub: 'Thân nhiệt bề mặt' },
    {
      key: 'SPO2_DROPS' as const,
      icon: 'alert-circle' as const,
      color: '#8B5CF6',
      unit: 'Lần',
      val: filteredDayItem ? (filteredDayItem.min_spo2 && filteredDayItem.min_spo2 < 95 ? 1 : 0) : (analytics?.spo2_drops_count ?? 0),
      lbl: 'Cơn tụt SpO₂',
      sub: filteredDayItem ? `Ghi nhận ngày ${filteredDayItem.date}` : `Trong ${analytics?.daily_trends?.length || 7} ngày qua`,
    },
  ];

  return (
    <View>
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
              {filteredDayItem
                ? `Đang hiển thị dữ liệu sinh hiệu chi tiết của ngày ${filteredDayItem.date} cho bệnh nhân ${selectedPatient.name}.`
                : (analytics?.ai_summary || `Đang theo dõi dữ liệu sinh hiệu thực tế của bệnh nhân ${selectedPatient.name}.`)}
            </LocalizedText>
          </View>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        {metricCards.map((m, idx) => {
          const isSelected = selectedMetricFilter === (m.key as any);
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => {
                if (m.key !== 'SPO2_DROPS' && onSelectMetricFilter) onSelectMetricFilter(isSelected ? 'ALL' : (m.key as any));
              }}
              style={[
                styles.statCard,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isSelected ? '#2563EB' : `${m.color}33`, borderWidth: isSelected ? 2 : 1 },
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
              <LocalizedText style={[styles.statVal, { color: colors.textPrimary }]}>{m.val}</LocalizedText>
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
  trends,
  chartMode,
  selectedFilteredDate,
  onPressDay,
  isDarkMode,
  colors,
}) => {
  const visibleTrends = selectedFilteredDate
    ? trends.filter((t) => t.date === selectedFilteredDate)
    : trends;

  return (
    <View style={[styles.chartCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
      <View style={styles.chartHeader}>
        <LocalizedText style={[styles.chartTitle, { color: colors.textPrimary }]}>Diễn Tiến Lâm Sàng Từng Ngày</LocalizedText>
        <LocalizedText style={[styles.chartSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          Đồng bộ tự động từ vòng đeo tay Smartband
        </LocalizedText>
        <LocalizedText style={styles.chartTapHint}>💡 Chạm vào ngày bất kỳ để xem phân tích chi tiết 24h</LocalizedText>
      </View>

      <View style={styles.barsContainer}>
        {visibleTrends.length === 0 ? (
          <View style={styles.noDataBox}>
            <Ionicons name="stats-chart-outline" size={28} color="#94A3B8" />
            <LocalizedText style={styles.noDataText}>
              {selectedFilteredDate
                ? `Chưa có dữ liệu đo sinh hiệu cho ngày ${selectedFilteredDate}`
                : 'Chưa có dữ liệu sinh hiệu chuỗi thời gian'}
            </LocalizedText>
          </View>
        ) : (
          visibleTrends.map((item: TrendItem, idx: number) => {
          let barPercent = 50, barColor = '#0284C7', displayVal = `${item.avg_heart_rate} bpm`, isAlert = false;

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
              onPress={() => onPressDay?.(item)}
              style={[
                styles.trendRow,
                {
                  backgroundColor: isDayHighlighted ? (isDarkMode ? '#1E3A8A44' : '#EFF6FF') : (isDarkMode ? '#0F172A55' : '#F8FAFC'),
                  borderColor: isDayHighlighted ? '#2563EB' : 'transparent',
                  borderWidth: isDayHighlighted ? 1.5 : 0,
                  paddingVertical: 7,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                },
              ]}
            >
              <LocalizedText style={[styles.trendDate, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>{item.date}</LocalizedText>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${barPercent}%`, backgroundColor: barColor }]} />
              </View>
              <LocalizedText style={[styles.barValueText, { color: colors.textPrimary }]} numberOfLines={1}>{displayVal}</LocalizedText>
              <View style={[styles.statusTagMini, { backgroundColor: isAlert ? '#FEE2E2' : '#ECFDF5' }]}>
                <LocalizedText style={[styles.statusTagMiniText, { color: isAlert ? '#DC2626' : '#059669' }]}>{isAlert ? 'Lưu ý' : 'Chuẩn'}</LocalizedText>
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
}) => (
  <View style={[styles.tableCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
    <View style={{ marginBottom: 8 }}>
      <LocalizedText style={[styles.tableTitle, { color: colors.textPrimary }]}>Nhật Ký Chỉ Số Sinh Hiệu</LocalizedText>
      <LocalizedText style={styles.tableSubtitle}>💡 Chạm vào hàng bất kỳ để xem diễn tiến chi tiết ngày đó</LocalizedText>
    </View>

    <View style={styles.tableHeaderRow}>
      <LocalizedText style={[styles.tableColHeader, { flex: 1.1 }]}>Ngày</LocalizedText>
      {[
        { key: 'HR', label: 'Nhịp tim', flex: 1.2 },
        { key: 'SPO2', label: 'SpO₂', flex: 1.2 },
        { key: 'BP', label: 'Huyết áp', flex: 1.4 },
        ...(filterMetric === 'TEMP' ? [{ key: 'TEMP', label: 'Thân nhiệt', flex: 1.2 }] : []),
      ].map((col) => (
        <LocalizedText
          key={col.key}
          style={[styles.tableColHeader, { flex: col.flex, textAlign: 'center' }, filterMetric === col.key && styles.tableColHeaderActive]}
        >
          {col.label}
        </LocalizedText>
      ))}
      <View style={{ width: 18 }} />
    </View>

    {trends.length === 0 ? (
      <View style={{ paddingVertical: 14, alignItems: 'center' }}>
        <LocalizedText style={{ fontSize: 13, color: '#94A3B8' }}>Chưa có dữ liệu nhật ký đo</LocalizedText>
      </View>
    ) : (
      trends.map((row: TrendItem, i: number) => {
        const isRowHighlighted = selectedFilteredDate === row.date;
        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => onPressDay?.(row)}
            style={[
              styles.tableRow,
              isRowHighlighted
                ? { backgroundColor: isDarkMode ? '#1E3A8A44' : '#EFF6FF', borderColor: '#2563EB', borderWidth: 1 }
                : (i % 2 === 1 ? { backgroundColor: isDarkMode ? '#0F172A44' : '#F8FAFC' } : undefined),
              { paddingVertical: 9, paddingHorizontal: 4, borderRadius: 6 },
            ]}
          >
            <LocalizedText style={[styles.tableCell, { flex: 1.1, fontWeight: '700', color: colors.textPrimary }]}>{row.date}</LocalizedText>
            <View style={[{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }, filterMetric === 'HR' && styles.highlightColCell]}>
              <LocalizedText style={[styles.tableCell, { color: '#EF4444', fontWeight: filterMetric === 'HR' ? '800' : '600' }]}>
                {row.avg_heart_rate ? `${row.avg_heart_rate} bpm` : '--'}
              </LocalizedText>
            </View>
            <View style={[{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }, filterMetric === 'SPO2' && styles.highlightColCell]}>
              <LocalizedText style={[styles.tableCell, { color: row.min_spo2 && row.min_spo2 < 94 ? '#DC2626' : '#0284C7', fontWeight: filterMetric === 'SPO2' ? '800' : '600' }]}>
                {row.avg_spo2 ? `${row.avg_spo2}%` : '--'}
              </LocalizedText>
            </View>
            <View style={[{ flex: 1.4, alignItems: 'center', justifyContent: 'center' }, filterMetric === 'BP' && styles.highlightColCell]}>
              <LocalizedText style={[styles.tableCell, { color: '#10B981', fontWeight: filterMetric === 'BP' ? '800' : '600' }]}>
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

  const measuredHourly = (dayItem.hourly_records || []).filter(
    (rec) =>
      rec.heart_rate != null ||
      rec.spo2 != null ||
      rec.bp != null ||
      rec.skin_temp != null
  );

  const timelineRecords = measuredHourly.map((rec) => ({
    time: rec.time,
    session: /^(06|07)/.test(rec.time)
      ? 'Sáng sớm (Thức dậy)'
      : /^(08|09|10)/.test(rec.time)
      ? 'Buổi sáng (Sau ăn sáng/Uống thuốc)'
      : /^(11|12|13)/.test(rec.time)
      ? 'Buổi trưa (Nghỉ ngơi)'
      : /^(14|15|16|17)/.test(rec.time)
      ? 'Buổi chiều (Sinh hoạt nhẹ)'
      : /^(18|19|20)/.test(rec.time)
      ? 'Buổi tối (Sau ăn tối)'
      : 'Ban đêm (Giấc ngủ)',
    hr: rec.heart_rate ?? null,
    spo2: rec.spo2 ?? null,
    bp: rec.bp ?? null,
    temp: rec.skin_temp ?? null,
    status: (rec.heart_rate && rec.heart_rate > 90) || (rec.spo2 && rec.spo2 < 94) ? 'Lưu ý' : 'Chuẩn',
  }));

  const minHrDisplay = dayItem.min_heart_rate ?? '--';
  const maxHrDisplay = dayItem.max_heart_rate ?? '--';
  const minSpo2Display = dayItem.min_spo2 ?? dayItem.avg_spo2 ?? '--';

  const kpiList = [
    { icon: 'heart', color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5', unit: 'bpm', val: dayItem.avg_heart_rate ?? '--', lbl: 'Nhịp tim TB', sub: `Min: ${minHrDisplay} - Max: ${maxHrDisplay}` },
    { icon: 'water', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', unit: '%', val: dayItem.avg_spo2 != null ? `${dayItem.avg_spo2}%` : '--%', lbl: 'SpO₂ Trung bình', sub: `Thấp nhất: ${minSpo2Display}%` },
    { icon: 'speedometer', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', unit: 'mmHg', val: dayItem.bp || '--', lbl: 'Huyết áp', sub: 'Chỉ số mục tiêu' },
    { icon: 'thermometer', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', unit: '°C', val: dayItem.avg_skin_temp != null ? `${dayItem.avg_skin_temp}°C` : '--°C', lbl: 'Nhiệt độ da', sub: 'Thân nhiệt chuẩn' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContentCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
              <View style={styles.modalHeaderIconBox}>
                <Ionicons name="calendar" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.modalHeaderTitle, { color: colors.textPrimary }]}>Hồ Sơ Sinh Hiệu: Ngày {dayItem.date}</LocalizedText>
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
            <View style={styles.modalStatusBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
              <LocalizedText style={styles.modalStatusBannerText}>Sinh hiệu ngày {dayItem.date} ổn định trong ngưỡng an toàn</LocalizedText>
            </View>

            <View style={styles.modalKpiGrid}>
              {kpiList.map((k) => (
                <View key={k.lbl} style={[styles.modalKpiCard, { backgroundColor: isDarkMode ? '#0F172A' : k.bg, borderColor: k.border }]}>
                  <View style={styles.modalKpiTop}>
                    <Ionicons name={k.icon as any} size={15} color={k.color} />
                    <LocalizedText style={styles.modalKpiUnit}>{k.unit}</LocalizedText>
                  </View>
                  <LocalizedText style={[styles.modalKpiVal, { color: colors.textPrimary }]}>{k.val}</LocalizedText>
                  <LocalizedText style={styles.modalKpiLbl}>{k.lbl}</LocalizedText>
                  <LocalizedText style={styles.modalKpiSub}>{k.sub}</LocalizedText>
                </View>
              ))}
            </View>

            <View style={styles.timelineSection}>
              <View style={{ marginBottom: 12 }}>
                <LocalizedText style={[styles.timelineSectionTitle, { color: colors.textPrimary }]}>Diễn Tiến Sinh Hiệu Theo Khung Giờ (24h)</LocalizedText>
                <LocalizedText style={[styles.timelineSectionSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Tần suất ghi nhận tự động từ Smartband BLE</LocalizedText>
              </View>

              {timelineRecords.length === 0 ? (
                <LocalizedText style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 13 }}>
                  Chưa có bản ghi chi tiết theo giờ trong ngày này.
                </LocalizedText>
              ) : timelineRecords.map((item, idx) => (
                <View key={idx} style={styles.timelineRow}>
                  <View style={styles.timelineLeftCol}>
                    <View style={styles.timelineDot} />
                    {idx < timelineRecords.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={[styles.timelineContentCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
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
                        <LocalizedText style={[styles.statusTagMiniText, { color: item.status === 'Lưu ý' ? '#DC2626' : '#059669' }]}>{item.status}</LocalizedText>
                      </View>
                    </View>
                    <View style={styles.timelineMetricsRow}>
                      {[
                        { icon: 'heart', color: '#EF4444', text: item.hr != null ? `${item.hr} bpm` : '-- bpm' },
                        { icon: 'water', color: '#0284C7', text: item.spo2 != null ? `${item.spo2}%` : '--%' },
                        { icon: 'speedometer', color: '#10B981', text: item.bp || '--' },
                        { icon: 'thermometer', color: '#F59E0B', text: item.temp != null ? `${item.temp}°C` : '--°C' },
                      ].map((chip, cIdx) => (
                        <View key={cIdx} style={styles.miniMetricChip}>
                          <Ionicons name={chip.icon as any} size={11} color={chip.color} />
                          <LocalizedText style={styles.miniMetricText}>{chip.text}</LocalizedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.modalDoctorNoteBox, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                <Ionicons name="medkit-outline" size={16} color="#2563EB" />
                <LocalizedText style={styles.modalDoctorNoteTitle}>Nhận xét lâm sàng ngày {dayItem.date}</LocalizedText>
              </View>
              <LocalizedText style={[styles.modalDoctorNoteContent, { color: isDarkMode ? '#CBD5E1' : '#1E40AF' }]}>
                Chỉ số tim mạch và hô hấp duy trì ổn định qua các khung giờ. Không phát hiện cơn tụt oxy máu đột ngột (dưới 90%) hoặc bất thường nhịp tim nguy hiểm. Phác đồ điều trị và giờ uống thuốc đang phát huy hiệu quả tốt.
              </LocalizedText>
            </View>
          </ScrollView>

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
                <LocalizedText style={styles.modalFilterDayActionBtnText}>Lọc toàn bộ báo cáo theo ngày {dayItem.date}</LocalizedText>
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

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const normalizeDayMonthKey = (raw: string): string => {
  const parts = raw.trim().split(/[-/]/);
  if (parts.length >= 2) {
    // Support YYYY-MM-DD or DD/MM or DD/MM/YYYY
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
  }
  return raw.trim();
};

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
  const [cursorMonth, setCursorMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const trendByDateKey = React.useMemo(() => {
    const map = new Map<string, TrendItem>();
    for (const item of trends) {
      if (item.date) {
        map.set(normalizeDayMonthKey(item.date), item);
      }
    }
    return map;
  }, [trends]);

  const year = cursorMonth.getFullYear();
  const month = cursorMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekdayMon0 = (new Date(year, month, 1).getDay() + 6) % 7;

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstWeekdayMon0; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const shiftMonth = (delta: number) => {
    setCursorMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const selectedKey = selectedFilteredDate ? normalizeDayMonthKey(selectedFilteredDate) : null;
  const selectedTrendItem = selectedKey ? trendByDateKey.get(selectedKey) : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContentCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
              <View style={styles.modalHeaderIconBox}>
                <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.modalHeaderTitle, { color: colors.textPrimary }]}>Lọc Báo Cáo Theo Ngày</LocalizedText>
                <LocalizedText style={[styles.modalHeaderSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={2}>
                  Chọn 1 ngày cụ thể để xem biểu đồ và chỉ số chuyên sâu
                </LocalizedText>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                onSelectDate(null);
                onClose();
              }}
              style={[
                styles.dayOptionRow,
                {
                  backgroundColor: !selectedFilteredDate ? (isDarkMode ? '#1E3A8A44' : '#EFF6FF') : (isDarkMode ? '#0F172A' : '#F8FAFC'),
                  borderColor: !selectedFilteredDate ? '#2563EB' : colors.border,
                  borderWidth: !selectedFilteredDate ? 1.5 : 1,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Ionicons name={!selectedFilteredDate ? 'radio-button-on' : 'radio-button-off'} size={18} color={!selectedFilteredDate ? '#2563EB' : '#94A3B8'} />
                <View style={{ flex: 1 }}>
                  <LocalizedText style={[styles.dayOptionDate, { color: colors.textPrimary }]}>Tất cả các ngày trong chu kỳ</LocalizedText>
                  <LocalizedText style={[styles.dayOptionSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Hiển thị toàn bộ dữ liệu diễn tiến chuỗi thời gian</LocalizedText>
                </View>
              </View>
            </TouchableOpacity>

            {/* Bảng Lịch Tháng Trực Quan */}
            <View style={[styles.calendarCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
              <View style={styles.calendarMonthBar}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} style={[styles.calendarNavBtn, { borderColor: colors.border }]}>
                  <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
                <LocalizedText style={[styles.calendarMonthTitle, { color: colors.textPrimary }]}>
                  {`Tháng ${String(month + 1).padStart(2, '0')}/${year}`}
                </LocalizedText>
                <TouchableOpacity onPress={() => shiftMonth(1)} style={[styles.calendarNavBtn, { borderColor: colors.border }]}>
                  <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.calendarWeekRow}>
                {WEEKDAY_LABELS.map((wd) => (
                  <View key={wd} style={styles.calendarWeekCell}>
                    <LocalizedText style={styles.calendarWeekText}>{wd}</LocalizedText>
                  </View>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarCells.map((dayNum, idx) => {
                  if (dayNum === null) {
                    return <View key={`empty-${idx}`} style={styles.calendarDayCell} />;
                  }
                  const dateKey = `${String(dayNum).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`;
                  const matchedTrend = trendByDateKey.get(dateKey);
                  const hasData = Boolean(matchedTrend);
                  const isSelected = selectedKey === dateKey;

                  return (
                    <TouchableOpacity
                      key={dateKey}
                      activeOpacity={0.75}
                      onPress={() => {
                        onSelectDate(matchedTrend?.date || dateKey);
                        onClose();
                      }}
                      style={[
                        styles.calendarDayCell,
                        isSelected && { backgroundColor: '#2563EB', borderRadius: 10 },
                      ]}
                    >
                      <LocalizedText
                        style={[
                          styles.calendarDayText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : hasData
                                ? colors.textPrimary
                                : isDarkMode
                                  ? '#64748B'
                                  : '#94A3B8',
                            opacity: isSelected || hasData ? 1 : 0.55,
                          },
                        ]}
                      >
                        {dayNum}
                      </LocalizedText>
                      <View
                        style={[
                          styles.calendarDot,
                          {
                            backgroundColor: isSelected
                              ? '#FFFFFF'
                              : hasData
                                ? '#10B981'
                                : 'transparent',
                          },
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.calendarLegendRow}>
                <View style={styles.calendarLegendItem}>
                  <View style={[styles.calendarDot, { backgroundColor: '#10B981' }]} />
                  <LocalizedText style={styles.calendarLegendText}>Có dữ liệu đo sinh hiệu</LocalizedText>
                </View>
                {selectedTrendItem && onViewDetail && (
                  <TouchableOpacity
                    style={styles.dayOptionDetailBtn}
                    onPress={() => onViewDetail(selectedTrendItem)}
                  >
                    <LocalizedText style={styles.dayOptionDetailBtnText}>Chi tiết 24h</LocalizedText>
                    <Ionicons name="chevron-forward" size={12} color="#2563EB" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>

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
}) => (
  <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
    <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderBottomColor: colors.border }]}>
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {onBack && (
            <TouchableOpacity style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6', marginRight: 10 }]} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <LocalizedText style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Hồ Sơ Y Khoa Bác Sĩ Gia Đình</LocalizedText>
            <LocalizedText style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Báo Cáo & Phân Tích Sinh Hiệu</LocalizedText>
          </View>
        </View>
        <TouchableOpacity style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]} onPress={onReload} activeOpacity={0.7}>
          <Ionicons name="refresh" size={17} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <LocalizedText style={[styles.guideText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
        Chọn một bệnh nhân bên dưới để xem báo cáo lâm sàng và đồ thị diễn tiến:
      </LocalizedText>

      <View style={[styles.searchBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
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
              style={[styles.filterChip, isActive && styles.filterChipActive, !isActive && isDarkMode && { backgroundColor: '#334155' }]}
              onPress={() => onFilterChange(tab.key as any)}
            >
              <LocalizedText style={[styles.filterChipText, isActive && styles.filterChipTextActive, !isActive && isDarkMode && { color: '#CBD5E1' }]}>
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
              style={[styles.rosterCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : colors.border }]}
              activeOpacity={0.85}
              onPress={() => onSelectPatient(pat)}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.avatarCircle, { backgroundColor: isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#E0F2FE', borderColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#0284C7' }]}>
                  <LocalizedText style={[styles.avatarInitial, { color: isDanger ? '#DC2626' : isWarn ? '#B45309' : '#0284C7' }]}>
                    {pat.name.slice(0, 1).toUpperCase()}
                  </LocalizedText>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.nameRow}>
                    <LocalizedText style={[styles.cardPatientName, { color: colors.textPrimary }]} numberOfLines={1}>{pat.name}</LocalizedText>
                    <View style={[styles.statusBadge, { backgroundColor: isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#DCFCE7' }]}>
                      <LocalizedText style={[styles.statusBadgeText, { color: isDanger ? '#DC2626' : isWarn ? '#B45309' : '#059669' }]}>
                        {isDanger ? 'NGUY CẤP' : isWarn ? 'CẢNH BÁO' : 'ỔN ĐỊNH'}
                      </LocalizedText>
                    </View>
                  </View>
                  <LocalizedText style={[styles.cardMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>{pat.age} tuổi • {formatGenderVN(pat.gender)}</LocalizedText>
                  {patAddress ? <LocalizedText style={[styles.cardAddress, { color: isDarkMode ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>📍 {patAddress}</LocalizedText> : null}
                </View>
              </View>

              {pat.condition && (
                <View style={[styles.cardConditionRow, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                  <Ionicons name="pulse" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                  <LocalizedText style={[styles.cardConditionText, { color: colors.textPrimary }]} numberOfLines={1}>Bệnh lý nền: {pat.condition}</LocalizedText>
                </View>
              )}

              <View style={styles.vitalsRow}>
                {[
                  { icon: 'heart', color: '#EF4444', bg: '#FEF2F2', val: pat.heartRate ? `${pat.heartRate} bpm` : '--' },
                  { icon: 'water', color: '#0284C7', bg: '#EFF6FF', val: pat.spo2 ? `${pat.spo2}%` : '--' },
                  { icon: 'speedometer', color: '#10B981', bg: '#ECFDF5', val: pat.bloodPressure || '--' },
                ].map((v, vIdx) => (
                  <View key={vIdx} style={[styles.vitalItem, { backgroundColor: isDarkMode ? '#0F172A' : v.bg }]}>
                    <Ionicons name={v.icon as any} size={13} color={v.color} style={{ marginRight: 4 }} />
                    <LocalizedText style={[styles.vitalVal, { color: v.color }]}>{v.val}</LocalizedText>
                  </View>
                ))}
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContentCard: { width: '100%', maxWidth: 540, maxHeight: '88%', borderRadius: 20, borderWidth: 1, overflow: 'hidden', elevation: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalHeaderIconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800' },
  modalHeaderSub: { fontSize: 12, marginTop: 1 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalBodyScroll: { padding: 16 },
  modalStatusBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 14 },
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
  modalFilterDayActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#2563EB', paddingVertical: 10, borderRadius: 10 },
  modalFilterDayActionBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  modalCloseFullBtn: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalCloseFullBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dayOptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginBottom: 8 },
  dayOptionDate: { fontSize: 14, fontWeight: '800' },
  dayOptionSub: { fontSize: 11.5, marginTop: 2 },
  dayOptionSectionLabel: { fontSize: 12, fontWeight: '700', marginVertical: 8, marginLeft: 2 },
  dayOptionDetailBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE', gap: 2 },
  dayOptionDetailBtnText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  calendarCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 4 },
  calendarMonthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calendarNavBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  calendarMonthTitle: { fontSize: 14, fontWeight: '800' },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calendarWeekCell: { width: '14.285%', alignItems: 'center' },
  calendarWeekText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: { width: '14.285%', height: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  calendarDayText: { fontSize: 13, fontWeight: '700' },
  calendarDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
  calendarLegendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1' },
  calendarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calendarLegendText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
});
