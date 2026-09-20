// MedicalReportScreen.tsx
// Màn hình Lịch sử Y Tế & Xuất Báo Cáo PDF / Excel (Proposal FR13)
// Hỗ trợ bác sĩ gia đình và người chăm sóc xem xu hướng và tải file báo cáo định kỳ

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../theme/colors';

export default function MedicalReportScreen({ navigation }: any) {
  const [period, setPeriod] = useState<'WEEK' | 'MONTH'>('WEEK');

  const report = useMemo(() => {
    if (period === 'WEEK') {
      return {
        label: '08 - 14 Tháng 9, 2026',
        readings: '1.008',
        heartRate: '73',
        heartRateDelta: '+2 bpm',
        spo2: '98,2',
        temperature: '36,7',
        falls: '1',
        anomalies: '2',
        adherence: '94%',
        heartRateData: [68, 72, 70, 76, 74, 78, 73],
        spo2Data: [98, 99, 98, 98, 97, 99, 98],
        labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      };
    }

    return {
      label: '16 Tháng 8 - 14 Tháng 9, 2026',
      readings: '4.320',
      heartRate: '72',
      heartRateDelta: '-1 bpm',
      spo2: '98,4',
      temperature: '36,6',
      falls: '3',
      anomalies: '6',
      adherence: '91%',
      heartRateData: [71, 74, 72, 70, 73, 75, 72],
      spo2Data: [98, 98, 99, 97, 98, 99, 98],
      labels: ['16/8', '21/8', '26/8', '31/8', '5/9', '10/9', '14/9'],
    };
  }, [period]);

  const handleExportPDF = () => {
    Alert.alert(
      'Xuất Báo Cáo Y Tế (PDF)',
      `Đang tổng hợp dữ liệu sức khoẻ (Nhịp tim, SpO2, Thân nhiệt AMG8833, Sự kiện ngã) trong ${
        period === 'WEEK' ? '7 ngày qua' : '30 ngày qua'
      } sang file PDF chuẩn y khoa (ReportLab). File đã sẵn sàng để gửi cho bác sĩ gia đình!`
    );
  };

  const handleExportExcel = () => {
    Alert.alert(
      'Xuất Dữ Liệu Thô (Excel)',
      `Đang xuất dữ liệu chuỗi thời gian PostgreSQL sang bảng tính Excel (Openpyxl) với đầy đủ dấu thời gian và độ tin cậy AI.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>THEO DÕI SỨC KHỎE</Text>
          <Text style={styles.headerTitle}>Báo cáo sức khỏe</Text>
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={handleExportPDF} activeOpacity={0.8}>
          <Ionicons name="download-outline" size={21} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.reportIntro}>
          <View>
            <Text style={styles.reportIntroTitle}>Tổng quan</Text>
            <Text style={styles.reportIntroDate}>{report.label}</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>Đã đồng bộ</Text>
          </View>
        </View>

        <View style={styles.periodRow}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'WEEK' && styles.periodBtnActive]}
            onPress={() => setPeriod('WEEK')}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodText, period === 'WEEK' && styles.periodTextActive]}>7 ngày</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'MONTH' && styles.periodBtnActive]}
            onPress={() => setPeriod('MONTH')}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodText, period === 'MONTH' && styles.periodTextActive]}>1 tháng</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroLabel}>Điểm sức khỏe</Text>
              <View style={styles.heroScoreRow}>
                <Text style={styles.heroScore}>Ổn định</Text>
                <View style={styles.heroTrend}>
                  <Ionicons name="arrow-up" size={13} color="#0F766E" />
                  <Text style={styles.heroTrendText}>Tốt</Text>
                </View>
              </View>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="heart" size={22} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.heroProgressTrack}>
            <View style={styles.heroProgressValue} />
          </View>
          <Text style={styles.heroFootnote}>Dữ liệu được tổng hợp từ {report.readings} lần đo</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="pulse" size={18} color="#DC2626" />
            </View>
            <Text style={styles.metricValue}>{report.heartRate}<Text style={styles.metricUnit}> bpm</Text></Text>
            <Text style={styles.metricLabel}>Nhịp tim TB</Text>
            <Text style={styles.metricDelta}>{report.heartRateDelta} so với kỳ trước</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="water" size={18} color="#2563EB" />
            </View>
            <Text style={styles.metricValue}>{report.spo2}<Text style={styles.metricUnit}> %</Text></Text>
            <Text style={styles.metricLabel}>SpO₂ trung bình</Text>
            <Text style={styles.metricDelta}>Trong ngưỡng an toàn</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="thermometer" size={18} color="#D97706" />
            </View>
            <Text style={styles.metricValue}>{report.temperature}<Text style={styles.metricUnit}> °C</Text></Text>
            <Text style={styles.metricLabel}>Nhiệt độ cơ thể</Text>
            <Text style={styles.metricDelta}>Ổn định</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="watch" size={18} color="#16A34A" />
            </View>
            <Text style={styles.metricValue}>{report.adherence}</Text>
            <Text style={styles.metricLabel}>Tuân thủ đeo vòng</Text>
            <Text style={styles.metricDelta}>Mục tiêu &gt; 90%</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Xu hướng nhịp tim</Text>
              <Text style={styles.sectionSubtitle}>Trung bình theo ngày</Text>
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>bpm</Text>
            </View>
          </View>
          <View style={styles.chartArea}>
            <View style={styles.chartGuideLines}>
              <View style={styles.chartGuideLine} />
              <View style={styles.chartGuideLine} />
              <View style={styles.chartGuideLine} />
            </View>
            <View style={styles.barRow}>
              {report.heartRateData.map((value, index) => (
                <View key={`${period}-heart-${index}`} style={styles.barColumn}>
                  <View style={[styles.bar, { height: `${Math.max(34, (value - 60) * 3.1)}%` }]} />
                  <Text style={styles.barLabel}>{report.labels[index]}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.alertSummaryCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Cảnh báo & sự kiện</Text>
              <Text style={styles.sectionSubtitle}>Cần chú ý trong kỳ báo cáo</Text>
            </View>
            <Ionicons name="shield-checkmark-outline" size={24} color="#0F766E" />
          </View>
          <View style={styles.alertRow}>
            <View style={[styles.alertIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="warning" size={17} color="#DC2626" />
            </View>
            <Text style={styles.alertLabel}>Sự kiện té ngã</Text>
            <Text style={styles.alertValue}>{report.falls} lần</Text>
          </View>
          <View style={styles.alertRow}>
            <View style={[styles.alertIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="pulse" size={17} color="#D97706" />
            </View>
            <Text style={styles.alertLabel}>Nhịp tim bất thường</Text>
            <Text style={styles.alertValue}>{report.anomalies} lần</Text>
          </View>
        </View>

        <Text style={styles.exportSectionTitle}>Xuất báo cáo</Text>

        <TouchableOpacity
          style={styles.pdfExportBtn}
          onPress={handleExportPDF}
          activeOpacity={0.85}
        >
          <View style={styles.exportIconBox}>
            <Ionicons name="document-text" size={21} color="#DC2626" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.btnMainText}>Xuất báo cáo PDF</Text>
            <Text style={styles.btnSubText}>Bản tóm tắt cho bác sĩ</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#DC2626" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.excelExportBtn}
          onPress={handleExportExcel}
          activeOpacity={0.85}
        >
          <View style={[styles.exportIconBox, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="grid" size={21} color="#047857" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.btnMainText, { color: '#047857' }]}>Xuất dữ liệu Excel (.xlsx)</Text>
            <Text style={[styles.btnSubText, { color: '#065F46' }]}>Dữ liệu chi tiết theo thời gian</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#047857" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8F7',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4ECE9',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#0F9D8A',
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: '800',
    color: '#102A2B',
  },
  headerAction: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E8F7F3',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 38,
  },
  reportIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  reportIntroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#102A2B',
  },
  reportIntroDate: {
    marginTop: 4,
    fontSize: 12,
    color: '#70817F',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E8F7F3',
  },
  liveDot: {
    width: 7,
    height: 7,
    marginRight: 5,
    borderRadius: 4,
    backgroundColor: '#0F9D8A',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  periodRow: {
    flexDirection: 'row',
    marginBottom: 14,
    padding: 4,
    borderRadius: 13,
    backgroundColor: '#DDE9E6',
  },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  periodBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.soft,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#70817F',
  },
  periodTextActive: {
    color: '#0F766E',
  },
  heroCard: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#DDF5EE',
    ...Shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#36736D',
  },
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  heroScore: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0B4F4A',
  },
  heroTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#B8E9DD',
  },
  heroTrendText: {
    marginLeft: 2,
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },
  heroIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#0F9D8A',
  },
  heroProgressTrack: {
    height: 7,
    marginTop: 17,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#B8E9DD',
  },
  heroProgressValue: {
    width: '88%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#0F9D8A',
  },
  heroFootnote: {
    marginTop: 9,
    fontSize: 11,
    color: '#36736D',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricCard: {
    width: '48.2%',
    minHeight: 135,
    marginBottom: 10,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    ...Shadows.card,
  },
  metricIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  metricValue: {
    marginTop: 11,
    fontSize: 21,
    fontWeight: '900',
    color: '#102A2B',
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#70817F',
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#385452',
  },
  metricDelta: {
    marginTop: 5,
    fontSize: 10,
    color: '#7A8E8B',
  },
  chartCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    ...Shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#102A2B',
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#7A8E8B',
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 7,
    height: 7,
    marginRight: 5,
    borderRadius: 4,
    backgroundColor: '#0F9D8A',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#70817F',
  },
  chartArea: {
    height: 150,
    marginTop: 16,
    position: 'relative',
  },
  chartGuideLines: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 24,
    left: 0,
    justifyContent: 'space-between',
  },
  chartGuideLine: {
    height: 1,
    backgroundColor: '#E9F0EE',
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 24,
  },
  barColumn: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 18,
    minHeight: 35,
    borderRadius: 9,
    backgroundColor: '#0F9D8A',
  },
  barLabel: {
    position: 'absolute',
    bottom: 0,
    fontSize: 10,
    color: '#7A8E8B',
  },
  alertSummaryCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    ...Shadows.card,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  alertIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  alertLabel: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#385452',
  },
  alertValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#102A2B',
  },
  exportSectionTitle: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#102A2B',
  },
  pdfExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    backgroundColor: '#FFF7F7',
  },
  excelExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    backgroundColor: '#F0FDF9',
  },
  exportIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  btnMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  btnSubText: {
    marginTop: 3,
    fontSize: 11,
    color: '#B45309',
  },
});
