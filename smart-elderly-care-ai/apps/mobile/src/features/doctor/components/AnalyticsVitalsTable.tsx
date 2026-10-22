import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { TrendItem } from './types';

interface AnalyticsVitalsTableProps {
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

const styles = StyleSheet.create({
  tableCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  tableTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  tableHeaderRow: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1' },
  tableColHeader: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, alignItems: 'center' },
  tableCell: { fontSize: 11.5 },
});
