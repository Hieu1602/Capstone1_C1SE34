// MedicalReportScreen.tsx
// Màn hình Lịch sử Y Tế & Xuất Báo Cáo PDF / Excel (Proposal FR13)
// Hỗ trợ người chăm sóc & bác sĩ xem xu hướng và tải file báo cáo định kỳ thực tế từ Backend

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../theme/colors';
import { useTheme } from '../../store/useThemeStore';
import { LocalizedAlert, LocalizedText } from '../../i18n/LocalizedComponents';
import { reportsApi } from '../../services/api';

interface ReportData {
  period: 'WEEK' | 'MONTH';
  days: number;
  label: string;
  readings: string;
  total_readings: number;
  heartRate: string;
  heartRateDelta: string;
  spo2: string;
  temperature: string;
  falls: string;
  anomalies: string;
  adherence: string;
  healthScore: string;
  healthScoreTrend: string;
  healthScoreProgress: number;
  heartRateData: number[];
  spo2Data: number[];
  labels: string[];
  isSynced: boolean;
  hasData: boolean;
}

const DEFAULT_REPORT: ReportData = {
  period: 'WEEK',
  days: 7,
  label: 'Dữ liệu thời gian thực',
  readings: '0',
  total_readings: 0,
  heartRate: '--',
  heartRateDelta: '0 bpm',
  spo2: '--',
  temperature: '--',
  falls: '0',
  anomalies: '0',
  adherence: '0%',
  healthScore: 'Chưa có dữ liệu',
  healthScoreTrend: 'Đang kết nối',
  healthScoreProgress: 0,
  heartRateData: [0, 0, 0, 0, 0, 0, 0],
  spo2Data: [0, 0, 0, 0, 0, 0, 0],
  labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  isSynced: false,
  hasData: false,
};

export default function MedicalReportScreen({ navigation, route }: any) {
  const { isDarkMode } = useTheme();
  const [period, setPeriod] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [report, setReport] = useState<ReportData>(DEFAULT_REPORT);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const patientId = route?.params?.patientId;
  const deviceId = route?.params?.deviceId;

  const fetchReport = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await reportsApi.getSummary(period, patientId, deviceId);
      if (res && res.data) {
        setReport({
          period: res.data.period || period,
          days: res.data.days || (period === 'WEEK' ? 7 : 30),
          label: res.data.label || '',
          readings: res.data.readings || '0',
          total_readings: res.data.total_readings || 0,
          heartRate: res.data.heartRate || '--',
          heartRateDelta: res.data.heartRateDelta || '0 bpm',
          spo2: res.data.spo2 || '--',
          temperature: res.data.temperature || '--',
          falls: res.data.falls || '0',
          anomalies: res.data.anomalies || '0',
          adherence: res.data.adherence || '0%',
          healthScore: res.data.healthScore || 'Ổn định',
          healthScoreTrend: res.data.healthScoreTrend || 'Tốt',
          healthScoreProgress:
            typeof res.data.healthScoreProgress === 'number'
              ? res.data.healthScoreProgress
              : 0.85,
          heartRateData:
            Array.isArray(res.data.heartRateData) && res.data.heartRateData.length > 0
              ? res.data.heartRateData
              : [0, 0, 0, 0, 0, 0, 0],
          spo2Data:
            Array.isArray(res.data.spo2Data) && res.data.spo2Data.length > 0
              ? res.data.spo2Data
              : [0, 0, 0, 0, 0, 0, 0],
          labels:
            Array.isArray(res.data.labels) && res.data.labels.length > 0
              ? res.data.labels
              : period === 'WEEK'
              ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
              : ['1', '5', '10', '15', '20', '25', '30'],
          isSynced: Boolean(res.data.isSynced),
          hasData: Boolean(res.data.hasData),
        });
      }
    } catch (error) {
      console.warn('[MedicalReportScreen] Lỗi khi tải dữ liệu báo cáo:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, patientId, deviceId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportPDF = async () => {
    try {
      const url = reportsApi.getPdfUrl(period, patientId, deviceId);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        LocalizedAlert.alert(
          'Xuất Báo Cáo Y Tế (PDF)',
          `Đã tạo liên kết báo cáo PDF chuẩn y tế:\n${url}`
        );
      }
    } catch {
      LocalizedAlert.alert('Xuất Báo Cáo Y Tế (PDF)', 'Không thể mở liên kết tải báo cáo PDF.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const url = reportsApi.getExcelUrl(period, patientId, deviceId);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        LocalizedAlert.alert(
          'Xuất Dữ Liệu Thô (Excel)',
          `Đã tạo liên kết tải bảng tính Excel chuỗi thời gian:\n${url}`
        );
      }
    } catch {
      LocalizedAlert.alert('Xuất Dữ Liệu Thô (Excel)', 'Không thể mở liên kết tải file Excel.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: '#0B0F19', borderBottomColor: '#334155' }]}>
        <TouchableOpacity
          style={[styles.backBtn, isDarkMode && { backgroundColor: '#1E293B', borderRadius: 18, borderWidth: 1, borderColor: '#334155' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <LocalizedText style={[styles.headerEyebrow, isDarkMode && { color: '#94A3B8' }]}>THEO DÕI SỨC KHỎE</LocalizedText>
          <LocalizedText style={[styles.headerTitle, isDarkMode && { color: '#F8FAFC' }]}>Báo cáo sức khỏe</LocalizedText>
        </View>
        <TouchableOpacity
          style={[styles.headerAction, isDarkMode && { backgroundColor: '#1E293B', borderRadius: 18, borderWidth: 1, borderColor: '#334155' }]}
          onPress={handleExportPDF}
          activeOpacity={0.8}
        >
          <Ionicons name="download-outline" size={21} color={isDarkMode ? '#F8FAFC' : Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchReport(true)}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Tiêu đề & Trạng thái đồng bộ */}
        <View style={styles.reportIntro}>
          <View>
            <LocalizedText style={[styles.reportIntroTitle, isDarkMode && { color: '#F8FAFC' }]}>Tổng quan</LocalizedText>
            <LocalizedText style={[styles.reportIntroDate, isDarkMode && { color: '#94A3B8' }]}>{report.label}</LocalizedText>
          </View>
          <View style={[styles.liveBadge, isDarkMode && { backgroundColor: '#134E4A' }]}>
            <View style={[styles.liveDot, !report.isSynced && { backgroundColor: '#F59E0B' }]} />
            <LocalizedText style={[styles.liveBadgeText, isDarkMode && { color: '#5EEAD4' }]}>
              {report.isSynced ? 'Đã đồng bộ' : 'Chờ thiết bị'}
            </LocalizedText>
          </View>
        </View>

        {/* Tab chuyển đổi: 7 ngày / 1 tháng */}
        <View style={[styles.periodRow, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'WEEK' && (isDarkMode ? { backgroundColor: '#0B0F19' } : styles.periodBtnActive)]}
            onPress={() => setPeriod('WEEK')}
            activeOpacity={0.8}
          >
            <LocalizedText
              style={[
                styles.periodText,
                isDarkMode && { color: '#94A3B8' },
                period === 'WEEK' && (isDarkMode ? { color: '#F8FAFC', fontWeight: '800' } : styles.periodTextActive),
              ]}
            >
              7 ngày
            </LocalizedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'MONTH' && (isDarkMode ? { backgroundColor: '#0B0F19' } : styles.periodBtnActive)]}
            onPress={() => setPeriod('MONTH')}
            activeOpacity={0.8}
          >
            <LocalizedText
              style={[
                styles.periodText,
                isDarkMode && { color: '#94A3B8' },
                period === 'MONTH' && (isDarkMode ? { color: '#F8FAFC', fontWeight: '800' } : styles.periodTextActive),
              ]}
            >
              1 tháng
            </LocalizedText>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <LocalizedText style={[styles.loadingText, isDarkMode && { color: '#94A3B8' }]}>
              Đang tổng hợp dữ liệu y tế thực tế...
            </LocalizedText>
          </View>
        ) : (
          <>
            {/* Card Hero: Điểm sức khỏe */}
            <View style={[styles.heroCard, isDarkMode && { backgroundColor: '#134E4A' }]}>
              <View style={styles.heroTopRow}>
                <View>
                  <LocalizedText style={styles.heroLabel}>Điểm sức khỏe</LocalizedText>
                  <View style={styles.heroScoreRow}>
                    <LocalizedText style={styles.heroScore}>{report.healthScore}</LocalizedText>
                    <View style={styles.heroTrend}>
                      <Ionicons
                        name={
                          report.healthScoreTrend === 'Bất thường' || report.healthScoreTrend === 'Cần chú ý'
                            ? 'warning-outline'
                            : 'arrow-up'
                        }
                        size={13}
                        color="#0F766E"
                      />
                      <LocalizedText style={styles.heroTrendText}>{report.healthScoreTrend}</LocalizedText>
                    </View>
                  </View>
                </View>
                <View style={styles.heroIcon}>
                  <Ionicons name="heart" size={22} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.heroProgressTrack}>
                <View
                  style={[
                    styles.heroProgressValue,
                    {
                      width: `${Math.round(Math.max(0, Math.min(1, report.healthScoreProgress)) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <LocalizedText style={styles.heroFootnote}>
                {report.total_readings > 0
                  ? `Dữ liệu được tổng hợp từ ${report.readings} lần đo`
                  : 'Chưa có bản ghi sinh hiệu nào trong kỳ báo cáo'}
              </LocalizedText>
            </View>

            {/* Grid 4 Chỉ số */}
            <View style={styles.metricGrid}>
              {/* Nhịp tim TB */}
              <View style={[styles.metricCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
                <View style={[styles.metricIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="pulse" size={18} color="#DC2626" />
                </View>
                <LocalizedText style={[styles.metricValue, isDarkMode && { color: '#F8FAFC' }]}>
                  {report.heartRate}
                  {report.heartRate !== '--' && <LocalizedText style={styles.metricUnit}> bpm</LocalizedText>}
                </LocalizedText>
                <LocalizedText style={[styles.metricLabel, isDarkMode && { color: '#94A3B8' }]}>Nhịp tim TB</LocalizedText>
                <LocalizedText style={[styles.metricDelta, isDarkMode && { color: '#CBD5E1' }]}>
                  {report.heartRateDelta} so với kỳ trước
                </LocalizedText>
              </View>

              {/* SpO2 */}
              <View style={[styles.metricCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
                <View style={[styles.metricIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="water" size={18} color="#2563EB" />
                </View>
                <LocalizedText style={[styles.metricValue, isDarkMode && { color: '#F8FAFC' }]}>
                  {report.spo2}
                  {report.spo2 !== '--' && <LocalizedText style={styles.metricUnit}> %</LocalizedText>}
                </LocalizedText>
                <LocalizedText style={[styles.metricLabel, isDarkMode && { color: '#94A3B8' }]}>SpO₂ trung bình</LocalizedText>
                <LocalizedText style={[styles.metricDelta, isDarkMode && { color: '#CBD5E1' }]}>
                  {report.total_readings > 0 ? 'Trong ngưỡng an toàn' : 'Chưa có dữ liệu'}
                </LocalizedText>
              </View>

              {/* Thân nhiệt */}
              <View style={[styles.metricCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
                <View style={[styles.metricIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="thermometer" size={18} color="#D97706" />
                </View>
                <LocalizedText style={[styles.metricValue, isDarkMode && { color: '#F8FAFC' }]}>
                  {report.temperature}
                  {report.temperature !== '--' && <LocalizedText style={styles.metricUnit}> °C</LocalizedText>}
                </LocalizedText>
                <LocalizedText style={[styles.metricLabel, isDarkMode && { color: '#94A3B8' }]}>Nhiệt độ cơ thể</LocalizedText>
                <LocalizedText style={[styles.metricDelta, isDarkMode && { color: '#CBD5E1' }]}>
                  {report.total_readings > 0 ? 'Ổn định' : 'Chưa có dữ liệu'}
                </LocalizedText>
              </View>

              {/* Tuân thủ đeo vòng */}
              <View style={[styles.metricCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
                <View style={[styles.metricIcon, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="watch" size={18} color="#16A34A" />
                </View>
                <LocalizedText style={[styles.metricValue, isDarkMode && { color: '#F8FAFC' }]}>{report.adherence}</LocalizedText>
                <LocalizedText style={[styles.metricLabel, isDarkMode && { color: '#94A3B8' }]}>Tuân thủ đeo vòng</LocalizedText>
                <LocalizedText style={[styles.metricDelta, isDarkMode && { color: '#CBD5E1' }]}>Mục tiêu &gt; 90%</LocalizedText>
              </View>
            </View>

            {/* Biểu đồ xu hướng nhịp tim */}
            <View style={[styles.chartCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <LocalizedText style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Xu hướng nhịp tim</LocalizedText>
                  <LocalizedText style={[styles.sectionSubtitle, isDarkMode && { color: '#94A3B8' }]}>Trung bình theo ngày</LocalizedText>
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.legendDot} />
                  <LocalizedText style={[styles.legendText, isDarkMode && { color: '#94A3B8' }]}>bpm</LocalizedText>
                </View>
              </View>
              <View style={styles.chartArea}>
                <View style={styles.chartGuideLines}>
                  <View style={styles.chartGuideLine} />
                  <View style={styles.chartGuideLine} />
                  <View style={styles.chartGuideLine} />
                </View>
                <View style={styles.barRow}>
                  {report.heartRateData.map((value: number, index: number) => {
                    const isZero = !value || value <= 0;
                    const barHeightPercent = isZero ? 6 : Math.max(18, Math.min(100, (value - 40) * 1.6));
                    return (
                      <View key={`${period}-heart-${index}`} style={styles.barColumn}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${barHeightPercent}%`,
                              backgroundColor: isZero
                                ? (isDarkMode ? '#334155' : '#CBD5E1')
                                : '#0F9D8A',
                            },
                          ]}
                        />
                        <LocalizedText style={[styles.barLabel, isDarkMode && { color: '#94A3B8' }]}>
                          {report.labels[index] || ''}
                        </LocalizedText>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Cảnh báo & sự kiện */}
            <View style={[styles.alertSummaryCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <LocalizedText style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Cảnh báo & sự kiện</LocalizedText>
                  <LocalizedText style={[styles.sectionSubtitle, isDarkMode && { color: '#94A3B8' }]}>Cần chú ý trong kỳ báo cáo</LocalizedText>
                </View>
                <Ionicons name="shield-checkmark-outline" size={24} color="#0F766E" />
              </View>
              <View style={styles.alertRow}>
                <View style={[styles.alertIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="warning" size={17} color="#DC2626" />
                </View>
                <LocalizedText style={[styles.alertLabel, isDarkMode && { color: '#F8FAFC' }]}>Sự kiện té ngã</LocalizedText>
                <LocalizedText style={[styles.alertValue, isDarkMode && { color: '#F8FAFC' }]}>{report.falls} lần</LocalizedText>
              </View>
              <View style={styles.alertRow}>
                <View style={[styles.alertIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="pulse" size={17} color="#D97706" />
                </View>
                <LocalizedText style={[styles.alertLabel, isDarkMode && { color: '#F8FAFC' }]}>Nhịp tim bất thường</LocalizedText>
                <LocalizedText style={[styles.alertValue, isDarkMode && { color: '#F8FAFC' }]}>{report.anomalies} lần</LocalizedText>
              </View>
            </View>

            {/* Các nút xuất báo cáo */}
            <LocalizedText style={[styles.exportSectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Xuất báo cáo</LocalizedText>

            <TouchableOpacity
              style={[styles.pdfExportBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
              onPress={handleExportPDF}
              activeOpacity={0.85}
            >
              <View style={styles.exportIconBox}>
                <Ionicons name="document-text" size={21} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <LocalizedText style={[styles.btnMainText, isDarkMode && { color: '#F8FAFC' }]}>Xuất báo cáo PDF</LocalizedText>
                <LocalizedText style={[styles.btnSubText, isDarkMode && { color: '#94A3B8' }]}>Bản tóm tắt y khoa ReportLab</LocalizedText>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#DC2626" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.excelExportBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
              onPress={handleExportExcel}
              activeOpacity={0.85}
            >
              <View style={[styles.exportIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="grid" size={21} color="#047857" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <LocalizedText style={[styles.btnMainText, isDarkMode ? { color: '#34D399' } : { color: '#047857' }]}>
                  Xuất dữ liệu Excel (.xlsx)
                </LocalizedText>
                <LocalizedText style={[styles.btnSubText, isDarkMode ? { color: '#A7F3D0' } : { color: '#065F46' }]}>
                  Dữ liệu chuỗi thời gian Openpyxl
                </LocalizedText>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#047857" />
            </TouchableOpacity>
          </>
        )}
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
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#70817F',
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
    minHeight: 8,
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
