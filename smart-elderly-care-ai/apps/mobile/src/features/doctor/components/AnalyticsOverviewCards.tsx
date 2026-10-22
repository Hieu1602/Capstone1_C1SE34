import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { AnalyticsData, PatientOption } from './types';

interface AnalyticsOverviewCardsProps {
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

  return (
    <View>
      {/* Thẻ đánh giá lâm sàng */}
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
        <View
          style={[
            styles.statCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#EF444433' },
          ]}
        >
          <View style={styles.statTop}>
            <Ionicons name="heart" size={16} color="#EF4444" />
            <LocalizedText style={styles.statUnit}>bpm</LocalizedText>
          </View>
          <LocalizedText style={[styles.statVal, { color: colors.textPrimary }]}>
            {analytics?.avg_heart_rate ?? selectedPatient.heartRate ?? '--'}
          </LocalizedText>
          <LocalizedText style={styles.statLbl}>Nhịp tim TB</LocalizedText>
          <LocalizedText style={styles.statSubRange}>
            Dao động: {analytics?.min_heart_rate ?? '--'} - {analytics?.max_heart_rate ?? '--'}
          </LocalizedText>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#0284C733' },
          ]}
        >
          <View style={styles.statTop}>
            <Ionicons name="water" size={16} color="#0284C7" />
            <LocalizedText style={styles.statUnit}>%</LocalizedText>
          </View>
          <LocalizedText style={[styles.statVal, { color: colors.textPrimary }]}>
            {analytics?.avg_spo2 ?? selectedPatient.spo2 ?? '--'}
          </LocalizedText>
          <LocalizedText style={styles.statLbl}>SpO₂ TB</LocalizedText>
          <LocalizedText style={[styles.statSubRange, { color: '#059669' }]}>
            Thấp nhất: {analytics?.min_spo2 ? `${analytics.min_spo2}%` : '--'}
          </LocalizedText>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#10B98133' },
          ]}
        >
          <View style={styles.statTop}>
            <Ionicons name="pulse" size={16} color="#10B981" />
            <LocalizedText style={styles.statUnit}>mmHg</LocalizedText>
          </View>
          <LocalizedText style={[styles.statVal, { color: '#10B981' }]}>
            {selectedPatient.bloodPressure || '--'}
          </LocalizedText>
          <LocalizedText style={styles.statLbl}>Huyết áp</LocalizedText>
          <LocalizedText style={styles.statSubRange}>
            {selectedPatient.bloodPressure ? `Lần đo gần nhất` : 'Chưa có ghi nhận'}
          </LocalizedText>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B33' },
          ]}
        >
          <View style={styles.statTop}>
            <Ionicons name="thermometer" size={16} color="#F59E0B" />
            <LocalizedText style={styles.statUnit}>°C</LocalizedText>
          </View>
          <LocalizedText style={[styles.statVal, { color: '#D97706' }]}>
            {analytics?.avg_skin_temp ? `${analytics.avg_skin_temp}°C` : '--'}
          </LocalizedText>
          <LocalizedText style={styles.statLbl}>Nhiệt độ da</LocalizedText>
          <LocalizedText style={styles.statSubRange}>
            Tụt SpO₂: {analytics?.spo2_drops_count ?? 0} lần
          </LocalizedText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
});
