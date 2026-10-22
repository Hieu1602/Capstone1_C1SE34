import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { PatientOption, TrendItem } from './types';

interface AnalyticsTrendChartProps {
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

      {/* Tab chọn loại chỉ số biểu đồ */}
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

const styles = StyleSheet.create({
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
});
