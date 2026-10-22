import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

interface PatientVitalsTabProps {
  hrHigh: string;
  hrLow: string;
  spo2Low: string;
  isDarkMode: boolean;
  colors: any;
  onOpenThresholdModal: () => void;
  onViewAnalytics: () => void;
}

export const PatientVitalsTab: React.FC<PatientVitalsTabProps> = ({
  hrHigh,
  hrLow,
  spo2Low,
  isDarkMode,
  colors,
  onOpenThresholdModal,
  onViewAnalytics,
}) => {
  return (
    <View>
      <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ngưỡng An Toàn Lâm Sàng</Text>
          <TouchableOpacity style={styles.btnActionSmall} onPress={onOpenThresholdModal}>
            <Ionicons name="settings-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
            <Text style={styles.btnActionSmallText}>Cấu hình</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>Nhịp tim tối đa cảnh báo:</Text>
          <Text style={[styles.thresholdVal, { color: '#EF4444' }]}>{hrHigh} bpm</Text>
        </View>
        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>Nhịp tim tối thiểu cảnh báo:</Text>
          <Text style={[styles.thresholdVal, { color: '#EF4444' }]}>{hrLow} bpm</Text>
        </View>
        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>Ngưỡng SpO₂ nguy hiểm:</Text>
          <Text style={[styles.thresholdVal, { color: '#0284C7' }]}>&lt; {spo2Low}%</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.btnOpenAnalytics}
        activeOpacity={0.88}
        onPress={onViewAnalytics}
      >
        <Ionicons name="bar-chart" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.btnOpenAnalyticsText}>Xem Phân Tích Đồ Thị & Báo Cáo Sinh Hiệu</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionBox: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  btnActionSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' },
  btnActionSmallText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F044' },
  thresholdLabel: { fontSize: 12, color: '#64748B' },
  thresholdVal: { fontSize: 12.5, fontWeight: '700' },
  btnOpenAnalytics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0284C7', paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  btnOpenAnalyticsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
