// DoctorAnalyticsReportScreen.tsx
// Phân tích đồ thị y khoa chuỗi thời gian, đánh giá sức khỏe AI & Xuất báo cáo PDF/Excel chuẩn y tế

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';

interface PatientOption {
  id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  deviceId: string;
}

const PATIENTS_LIST: PatientOption[] = [
  {
    id: 'e0000000-b4e1-4b08-b2d3-d949a0eb075c',
    name: 'Cụ Nguyễn Văn An',
    age: 78,
    gender: 'Nam',
    condition: 'Tăng huyết áp Đ2 • Thiếu máu cơ tim',
    deviceId: 'BLE_BAND_001',
  },
  {
    id: 'e1111111-b4e1-4b08-b2d3-d949a0eb075c',
    name: 'Bà Trần Thị Mai',
    age: 74,
    gender: 'Nữ',
    condition: 'Đái tháo đường T2 • Rối loạn tiền đình',
    deviceId: 'BLE_BAND_002',
  },
];

export default function DoctorAnalyticsReportScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { isDarkMode, colors } = useTheme();

  const [selectedPatient, setSelectedPatient] = useState<PatientOption>(PATIENTS_LIST[0]);
  const [days, setDays] = useState<number>(7);
  const [chartMode, setChartMode] = useState<'HR' | 'SPO2' | 'STEPS'>('HR');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [exportingType, setExportingType] = useState<'pdf' | 'excel' | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doctorApi.getAnalytics(selectedPatient.id, days);
      if (res.data) {
        setAnalytics(res.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [selectedPatient.id, days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = (type: 'pdf' | 'excel') => {
    setExportingType(type);
    const backendBase = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';
    const endpoint =
      type === 'pdf'
        ? `${backendBase}/api/v1/reports/${selectedPatient.deviceId}/pdf?days=${days}`
        : `${backendBase}/api/v1/reports/${selectedPatient.deviceId}/excel?days=${days}`;

    setTimeout(() => {
      setExportingType(null);
      if (Platform.OS === 'web') {
        window.open(endpoint, '_blank');
      } else {
        Linking.openURL(endpoint).catch(() => {
          Alert.alert('Thông báo', `Tải file báo cáo từ: ${endpoint}`);
        });
      }
    }, 600);
  };

  const trends = analytics?.daily_trends || [
    { date: '23/09', avg_heart_rate: 76, min_heart_rate: 62, avg_spo2: 98, min_spo2: 95, bp: '120/80', steps: 2800 },
    { date: '24/09', avg_heart_rate: 74, min_heart_rate: 60, avg_spo2: 97, min_spo2: 94, bp: '122/82', steps: 3100 },
    { date: '25/09', avg_heart_rate: 78, min_heart_rate: 65, avg_spo2: 98, min_spo2: 96, bp: '124/84', steps: 2600 },
    { date: '26/09', avg_heart_rate: 75, min_heart_rate: 61, avg_spo2: 98, min_spo2: 95, bp: '118/78', steps: 2900 },
    { date: '27/09', avg_heart_rate: 82, min_heart_rate: 68, avg_spo2: 93, min_spo2: 92, bp: '135/88', steps: 1800 },
    { date: '28/09', avg_heart_rate: 77, min_heart_rate: 63, avg_spo2: 97, min_spo2: 95, bp: '120/80', steps: 2750 },
    { date: '29/09', avg_heart_rate: 76, min_heart_rate: 62, avg_spo2: 98, min_spo2: 96, bp: '122/80', steps: 2840 },
  ];

  const hrScore = analytics?.hr_stability_score || 94;
  const isSafe = hrScore >= 85;

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* TOP HEADER */}
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Hồ Sơ Y Khoa TimescaleDB & AI Edge Hub
            </Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Báo Cáo & Phân Tích Sinh Hiệu
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
            onPress={fetchAnalytics}
          >
            <Ionicons name="sync-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* BỘ CHỌN BỆNH NHÂN */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientSelectorRow}>
          {PATIENTS_LIST.map((p) => {
            const active = selectedPatient.id === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPatient(p)}
                style={[
                  styles.patientPill,
                  active
                    ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                    : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: colors.border },
                ]}
                activeOpacity={0.8}
              >
                <View style={[styles.miniAvatar, active ? { backgroundColor: '#FFFFFF' } : { backgroundColor: '#0284C7' }]}>
                  <Text style={[styles.miniAvatarText, active ? { color: '#0284C7' } : { color: '#FFFFFF' }]}>
                    {p.name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A'}
                  </Text>
                </View>
                <View style={{ marginLeft: 6 }}>
                  <Text style={[styles.patientPillName, active ? { color: '#FFFFFF' } : { color: colors.textPrimary }]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.patientPillSub, active ? { color: '#E0F2FE' } : { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    {p.age} tuổi • {p.gender}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* BỘ LỌC CHU KỲ NGÀY */}
        <View style={styles.daysFilterRow}>
          {[7, 14, 30].map((d) => {
            const active = days === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDays(d)}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: Colors.primary }
                    : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' },
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    active ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
                  ]}
                >
                  {d} ngày qua
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
        )}

        {/* THẺ ĐÁNH GIÁ TỔNG QUAN & ĐIỂM SỨC KHỎE LÂM SÀNG */}
        <View
          style={[
            styles.assessmentCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isSafe ? '#10B98144' : '#F59E0B44' },
          ]}
        >
          <View style={styles.scoreRow}>
            <View style={[styles.scoreCircle, { backgroundColor: isSafe ? '#ECFDF5' : '#FFFBEB', borderColor: isSafe ? '#10B981' : '#F59E0B' }]}>
              <Text style={[styles.scoreNumber, { color: isSafe ? '#059669' : '#D97706' }]}>{hrScore}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={[styles.statusTag, { backgroundColor: isSafe ? '#D1FAE5' : '#FEF3C7' }]}>
                <Text style={[styles.statusTagText, { color: isSafe ? '#059669' : '#D97706' }]}>
                  {isSafe ? 'SINH HIỆU ỔN ĐỊNH CAO' : 'CẦN LƯU Ý THEO DÕI'}
                </Text>
              </View>
              <Text style={[styles.assessmentTitle, { color: colors.textPrimary }]}>
                Nhận định Bác sĩ & AI Hub
              </Text>
              <Text style={[styles.assessmentDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Đáp ứng thuốc huyết áp tốt. Không ghi nhận cơn rung nhĩ hay té ngã trong {days} ngày qua.
              </Text>
            </View>
          </View>
        </View>

        {/* BỘ 4 THẺ CHỈ SỐ THỐNG KÊ LÂM SÀNG */}
        <View style={styles.metricsGrid}>
          {/* Nhịp tim */}
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#EF444433' }]}>
            <View style={styles.statCardTop}>
              <Ionicons name="heart" size={18} color="#EF4444" />
              <Text style={styles.statUnit}>bpm</Text>
            </View>
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>
              {analytics?.avg_heart_rate || 75.6}
            </Text>
            <Text style={styles.statLbl}>Nhịp tim TB</Text>
            <Text style={styles.statSubRange}>Dao động: {analytics?.min_heart_rate || 60} - {analytics?.max_heart_rate || 98}</Text>
          </View>

          {/* SpO2 */}
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#0284C733' }]}>
            <View style={styles.statCardTop}>
              <Ionicons name="water" size={18} color="#0284C7" />
              <Text style={styles.statUnit}>%</Text>
            </View>
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>
              {analytics?.avg_spo2 || 97.8}
            </Text>
            <Text style={styles.statLbl}>SpO₂ TB</Text>
            <Text style={[styles.statSubRange, { color: '#059669' }]}>Thấp nhất: {analytics?.min_spo2 || 92}%</Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          {/* Huyết áp */}
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#10B98133' }]}>
            <View style={styles.statCardTop}>
              <Ionicons name="pulse" size={18} color="#10B981" />
              <Text style={styles.statUnit}>mmHg</Text>
            </View>
            <Text style={[styles.statVal, { color: '#10B981' }]}>122/80</Text>
            <Text style={styles.statLbl}>Huyết áp TB</Text>
            <Text style={styles.statSubRange}>Cao nhất: 135/88</Text>
          </View>

          {/* Nhiệt độ */}
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B33' }]}>
            <View style={styles.statCardTop}>
              <Ionicons name="thermometer" size={18} color="#F59E0B" />
              <Text style={styles.statUnit}>°C</Text>
            </View>
            <Text style={[styles.statVal, { color: '#D97706' }]}>
              {analytics?.avg_skin_temp || 36.6}
            </Text>
            <Text style={styles.statLbl}>Nhiệt độ da</Text>
            <Text style={styles.statSubRange}>Tụt SpO₂: {analytics?.spo2_drops_count || 1} lần</Text>
          </View>
        </View>

        {/* BIỂU ĐỒ DIỄN TIẾN TRỰC QUAN THEO NGÀY */}
        <View style={[styles.chartCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
                Diễn Tiến Lâm Sàng Từng Ngày
              </Text>
              <Text style={[styles.chartSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Dữ liệu đo liên tục 24/7 từ Smartband qua Hub Edge AI
              </Text>
            </View>
          </View>

          {/* Chuyển đổi tab đồ thị */}
          <View style={styles.chartTabRow}>
            {[
              { key: 'HR', label: 'Nhịp tim (bpm)' },
              { key: 'SPO2', label: 'Oxy máu SpO₂ (%)' },
              { key: 'STEPS', label: 'Vận động (bước)' },
            ].map((tab) => {
              const active = chartMode === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setChartMode(tab.key as any)}
                  style={[styles.chartModeBtn, active && styles.chartModeBtnActive]}
                >
                  <Text style={[styles.chartModeText, active ? { color: Colors.primary, fontWeight: '700' } : { color: '#64748B' }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Hàng biểu đồ thanh */}
          <View style={styles.barsContainer}>
            {trends.map((item: any, idx: number) => {
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
                  <Text style={[styles.trendDate, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                    {item.date}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${barPercent}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.barValueText, { color: colors.textPrimary }]}>{displayVal}</Text>
                  <View style={[styles.statusTagMini, isAlert ? { backgroundColor: '#FEE2E2' } : { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.statusTagMiniText, isAlert ? { color: '#DC2626' } : { color: '#059669' }]}>
                      {isAlert ? 'Lưu ý' : 'Chuẩn'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* BẢNG TỔNG HỢP CHI TIẾT */}
        <View style={[styles.tableCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>Nhật Ký Chỉ Số Sinh Hiệu</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableColHeader, { flex: 1.2 }]}>Ngày</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2 }]}>Nhịp tim</Text>
            <Text style={[styles.tableColHeader, { flex: 1.2 }]}>SpO₂</Text>
            <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Huyết áp</Text>
          </View>
          {trends.slice(0, 5).map((row: any, i: number) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: isDarkMode ? '#0F172A44' : '#F8FAFC' }]}>
              <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '700', color: colors.textPrimary }]}>{row.date}</Text>
              <Text style={[styles.tableCell, { flex: 1.2, color: '#EF4444' }]}>{row.avg_heart_rate} bpm</Text>
              <Text style={[styles.tableCell, { flex: 1.2, color: row.min_spo2 < 94 ? '#DC2626' : '#0284C7' }]}>{row.avg_spo2}%</Text>
              <Text style={[styles.tableCell, { flex: 1.5, color: '#10B981' }]}>{row.bp || '120/80'}</Text>
            </View>
          ))}
        </View>

        {/* KHU VỰC XUẤT BÁO CÁO Y KHOA CHUẨN */}
        <View style={[styles.exportBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.exportHeader}>
            <Ionicons name="document-attach" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.exportBoxTitle, { color: colors.textPrimary }]}>
              Xuất Báo Cáo Y Khoa Định Kỳ
            </Text>
          </View>
          <Text style={[styles.exportBoxDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Tự động trích xuất dữ liệu chuỗi thời gian TimescaleDB, phác đồ điều trị và nhận định lâm sàng thành bản tóm tắt y khoa.
          </Text>

          {/* Nút Xem Trước Báo Cáo */}
          <TouchableOpacity
            style={styles.btnPreview}
            onPress={() => setPreviewModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="eye-outline" size={17} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={styles.btnPreviewText}>Xem trước Tóm tắt Báo cáo Y khoa</Text>
          </TouchableOpacity>

          {/* 2 Nút Xuất PDF và Excel */}
          <View style={styles.exportBtnRow}>
            <TouchableOpacity
              style={[styles.btnExport, { backgroundColor: '#DC2626' }]}
              onPress={() => handleExport('pdf')}
              disabled={exportingType !== null}
            >
              {exportingType === 'pdf' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="document-text" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnExportText}>Tải Bản PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnExport, { backgroundColor: '#059669' }]}
              onPress={() => handleExport('excel')}
              disabled={exportingType !== null}
            >
              {exportingType === 'excel' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="grid-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnExportText}>Tải File Excel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ===================================================================== */}
      {/* MODAL: XEM TRƯỚC BÁO CÁO Y KHOA (MEDICAL REPORT PREVIEW)               */}
      {/* ===================================================================== */}
      <Modal visible={previewModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="newspaper" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Bản Tóm Tắt Y Khoa</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              <View style={styles.docHospitalHeader}>
                <Text style={styles.docHospitalName}>BỆNH VIỆN ĐA KHOA ĐÀ NẴNG</Text>
                <Text style={styles.docSub}>KHOA TIM MẠCH & LÃO KHOA • HỆ THỐNG SMART ELDERLY CARE</Text>
                <View style={styles.docDivider} />
              </View>

              <Text style={styles.docMainTitle}>BÁO CÁO THEO DÕI SỨC KHỎE NGƯỜI CAO TUỔI</Text>

              <View style={styles.docMetaGrid}>
                <Text style={styles.docMetaItem}><Text style={{ fontWeight: '700' }}>Bệnh nhân:</Text> {selectedPatient.name}</Text>
                <Text style={styles.docMetaItem}><Text style={{ fontWeight: '700' }}>Tuổi / Giới:</Text> {selectedPatient.age} tuổi ({selectedPatient.gender})</Text>
                <Text style={styles.docMetaItem}><Text style={{ fontWeight: '700' }}>Bác sĩ phụ trách:</Text> BS. Trần Văn Minh</Text>
                <Text style={styles.docMetaItem}><Text style={{ fontWeight: '700' }}>Chu kỳ theo dõi:</Text> {days} ngày gần nhất</Text>
              </View>

              <Text style={styles.docSectionTitle}>1. Tiền sử & Bệnh lý nền chẩn đoán</Text>
              <Text style={styles.docBodyText}>
                - Tăng huyết áp độ 2 (Huyết áp mục tiêu &lt; 140/90 mmHg){'\n'}
                - Thiếu máu cơ tim cục bộ mạn tính{'\n'}
                - Loãng xương tuổi già, nguy cơ té ngã
              </Text>

              <Text style={styles.docSectionTitle}>2. Tổng hợp chỉ số sinh hiệu {days} ngày qua</Text>
              <View style={styles.docTableBox}>
                <Text style={styles.docTableCell}>• Nhịp tim trung bình: <Text style={{ fontWeight: '700' }}>{analytics?.avg_heart_rate || 75.6} bpm</Text> (60 - 98 bpm)</Text>
                <Text style={styles.docTableCell}>• Nồng độ SpO₂ trung bình: <Text style={{ fontWeight: '700' }}>{analytics?.avg_spo2 || 97.8}%</Text> (Thấp nhất: 92%)</Text>
                <Text style={styles.docTableCell}>• Huyết áp trung bình: <Text style={{ fontWeight: '700' }}>122/80 mmHg</Text></Text>
                <Text style={styles.docTableCell}>• Nhiệt độ da trung bình: <Text style={{ fontWeight: '700' }}>36.6°C</Text></Text>
                <Text style={styles.docTableCell}>• Sự kiện té ngã: <Text style={{ fontWeight: '700', color: '#059669' }}>0 lần (An toàn)</Text></Text>
              </View>

              <Text style={styles.docSectionTitle}>3. Kết luận lâm sàng & Dặn dò y khoa</Text>
              <Text style={styles.docBodyText}>
                Bệnh nhân tuân thủ dùng thuốc đều đặn. Sinh hiệu nằm trong ngưỡng an toàn cho phép. Tiếp tục duy trì phác đồ điều trị và đo huyết áp mỗi sáng. Tái khám định kỳ theo lịch hẹn.
              </Text>
            </ScrollView>

            {/* Hàng nút modal */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.btnCancel, { borderColor: colors.border }]}
                onPress={() => setPreviewModalVisible(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSave, { backgroundColor: '#DC2626' }]}
                onPress={() => {
                  setPreviewModalVisible(false);
                  handleExport('pdf');
                }}
              >
                <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Tải PDF Ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerSubtitle: { fontSize: 11.5, fontWeight: '500' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  reloadBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  patientSelectorRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  patientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: { fontSize: 12, fontWeight: '800' },
  patientPillName: { fontSize: 13, fontWeight: '700' },
  patientPillSub: { fontSize: 10 },

  daysFilterRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  dayChipText: { fontSize: 11.5 },

  scrollContent: { padding: 16, paddingBottom: 95 },

  assessmentCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: { fontSize: 20, fontWeight: '800' },
  scoreMax: { fontSize: 10, color: '#94A3B8', marginTop: -2 },
  statusTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusTagText: { fontSize: 9.5, fontWeight: '800' },
  assessmentTitle: { fontSize: 14, fontWeight: '700' },
  assessmentDesc: { fontSize: 11.5, marginTop: 2, lineHeight: 17 },

  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  statUnit: { fontSize: 11, fontWeight: '500', color: '#94A3B8' },
  statLbl: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  statSubRange: { fontSize: 10, color: '#64748B', marginTop: 3, fontWeight: '500' },

  chartCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  chartHeader: { marginBottom: 10 },
  chartTitle: { fontSize: 15, fontWeight: '700' },
  chartSub: { fontSize: 11, marginTop: 2 },

  chartTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  chartModeBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  chartModeBtnActive: { backgroundColor: '#FFFFFF' },
  chartModeText: { fontSize: 11 },

  barsContainer: { marginTop: 4 },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  trendDate: { width: 44, fontSize: 11.5, fontWeight: '600' },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#E2E8F066',
    borderRadius: 5,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5 },
  barValueText: { width: 56, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  statusTagMini: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  statusTagMiniText: { fontSize: 9.5, fontWeight: '700' },

  tableCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  tableTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  tableColHeader: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F033',
  },
  tableCell: { fontSize: 11.5 },

  exportBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  exportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  exportBoxTitle: { fontSize: 15, fontWeight: '700' },
  exportBoxDesc: { fontSize: 11.5, lineHeight: 17, marginBottom: 12 },
  btnPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F644',
    marginBottom: 10,
  },
  btnPreviewText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
  exportBtnRow: { flexDirection: 'row', gap: 10 },
  btnExport: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnExportText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    borderRadius: 16,
    padding: 18,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  docHospitalHeader: { alignItems: 'center', marginBottom: 10 },
  docHospitalName: { fontSize: 13, fontWeight: '800', color: '#0284C7', letterSpacing: 0.5 },
  docSub: { fontSize: 9.5, color: '#64748B', marginTop: 2, textAlign: 'center' },
  docDivider: { width: '80%', height: 1, backgroundColor: '#E2E8F0', marginTop: 8 },
  docMainTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center', marginVertical: 8, color: '#0F172A' },
  docMetaGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 4,
  },
  docMetaItem: { fontSize: 11.5, color: '#334155' },
  docSectionTitle: { fontSize: 12.5, fontWeight: '700', color: '#0284C7', marginTop: 8, marginBottom: 4 },
  docBodyText: { fontSize: 11.5, lineHeight: 18, color: '#334155' },
  docTableBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
    gap: 4,
  },
  docTableCell: { fontSize: 11.5, color: '#334155' },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
});
