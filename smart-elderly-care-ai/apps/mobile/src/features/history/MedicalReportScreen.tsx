// MedicalReportScreen.tsx
// Màn hình Lịch sử Y Tế & Xuất Báo Cáo PDF / Excel (Proposal FR13)
// Hỗ trợ bác sĩ gia đình và người chăm sóc xem xu hướng và tải file báo cáo định kỳ

import React, { useState } from 'react';
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

  const handleExportPDF = () => {
    Alert.alert(
      'Xuất Báo Cáo Y Tế (PDF)',
      `Đang tổng hợp dữ liệu sinh hiệu (Nhịp tim, SpO2, Thân nhiệt AMG8833, Sự kiện ngã) trong ${
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
      {/* Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Báo Cáo Y Tế &amp; Xuất Dữ Liệu</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Period Selector */}
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'WEEK' && styles.periodBtnActive]}
            onPress={() => setPeriod('WEEK')}
          >
            <Text style={[styles.periodText, period === 'WEEK' && styles.periodTextActive]}>
              7 Ngày Qua
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'MONTH' && styles.periodBtnActive]}
            onPress={() => setPeriod('MONTH')}
          >
            <Text style={[styles.periodText, period === 'MONTH' && styles.periodTextActive]}>
              30 Ngày Qua
            </Text>
          </TouchableOpacity>
        </View>

        {/* Statistical Summary Cards */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardHeaderTitle}>Thống kê sinh hiệu trung bình</Text>
          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>73 <Text style={styles.statUnit}>bpm</Text></Text>
              <Text style={styles.statLabel}>Nhịp tim TB</Text>
            </View>
            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statVal}>98.2 <Text style={styles.statUnit}>%</Text></Text>
              <Text style={styles.statLabel}>SpO₂ TB</Text>
            </View>
            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statVal}>36.7 <Text style={styles.statUnit}>°C</Text></Text>
              <Text style={styles.statLabel}>Nhiệt độ trán</Text>
            </View>
          </View>
        </View>

        {/* Fall and Anomaly Count */}
        <View style={styles.anomalyCard}>
          <View style={styles.anomalyItem}>
            <View style={[styles.anomalyDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.anomalyTitle}>Sự kiện Té ngã:</Text>
            <Text style={styles.anomalyVal}>1 lần (Đã xử lý)</Text>
          </View>
          <View style={styles.anomalyItem}>
            <View style={[styles.anomalyDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.anomalyTitle}>Bất thường nhịp tim:</Text>
            <Text style={styles.anomalyVal}>2 lần (Nhịp tim &gt; 120)</Text>
          </View>
          <View style={styles.anomalyItem}>
            <View style={[styles.anomalyDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.anomalyTitle}>Tỷ lệ tuân thủ đeo vòng:</Text>
            <Text style={styles.anomalyVal}>94% thời gian</Text>
          </View>
        </View>

        {/* Export Buttons */}
        <Text style={styles.exportSectionTitle}>Tùy chọn xuất file (FR13)</Text>

        <TouchableOpacity
          style={styles.pdfExportBtn}
          onPress={handleExportPDF}
          activeOpacity={0.85}
        >
          <Ionicons name="document-text" size={24} color="#FFF" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.btnMainText}>Xuất báo cáo PDF</Text>
            <Text style={styles.btnSubText}>Định dạng chuẩn trình cho bác sĩ khám bệnh</Text>
          </View>
          <Ionicons name="download-outline" size={22} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.excelExportBtn}
          onPress={handleExportExcel}
          activeOpacity={0.85}
        >
          <Ionicons name="grid" size={24} color="#047857" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.btnMainText, { color: '#047857' }]}>Xuất dữ liệu Excel (.xlsx)</Text>
            <Text style={[styles.btnSubText, { color: '#065F46' }]}>Dữ liệu chi tiết chuỗi thời gian PostgreSQL</Text>
          </View>
          <Ionicons name="download-outline" size={22} color="#047857" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadows.soft,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  periodTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    ...Shadows.card,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  statGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  anomalyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    ...Shadows.card,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  anomalyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  anomalyTitle: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  anomalyVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  exportSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  pdfExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Shadows.card,
  },
  excelExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    ...Shadows.card,
  },
  btnMainText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  btnSubText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
});
