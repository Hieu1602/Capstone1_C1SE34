import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface SmartbandHardwareSpecsCardProps {
  algoSettings: {
    minHeartRate?: number;
    maxHeartRate?: number;
    minSpO2?: number;
  };
  onNavigateAlgoConfig: () => void;
  colors?: any;
  isDarkMode?: boolean;
}

export const SmartbandHardwareSpecsCard: React.FC<SmartbandHardwareSpecsCardProps> = ({
  algoSettings,
  onNavigateAlgoConfig,
  colors = {},
  isDarkMode = false,
}) => {
  return (
    <>
      {/* 4. THÔNG SỐ KỸ THUẬT PHẦN CỨNG (HARDWARE SPECIFICATIONS) */}
      <View style={[styles.specsCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LocalizedText style={[styles.specsCardTitle, isDarkMode && { color: colors.textPrimary }]}>
          Thông Số Kỹ Thuật Phần Cứng
        </LocalizedText>
        <LocalizedText style={[styles.specsCardDesc, isDarkMode && { color: colors.textSecondary }]}>
          Cấu hình phần cứng IoT y tế thu thập tín hiệu sinh học kết nối Orange Pi 5 Hub:
        </LocalizedText>

        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Thiết bị đo sinh hiệu</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>CooSpo HW706 (Armband)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Cảm biến quang học PPG</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Optical Heart Rate Sensor (1Hz)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Chỉ số sinh tồn hỗ trợ</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Nhịp tim (BPM) &amp; HRV (RR-Intervals)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Cảm biến tiếp xúc da</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Sensor Contact (Phát hiện tháo vòng)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Giao thức kết nối không dây</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>BLE 5.0 (GATT 0x180D) &amp; ANT+</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Dung lượng Pin &amp; Nguồn sạc</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Pin sạc Li-Po 90mAh (25h đo liên tục)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Chuẩn kháng nước &amp; bụi</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>IP67</LocalizedText>
        </View>
        <View style={[styles.specTableRow, { borderBottomWidth: 0 }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Mã MAC Bluetooth</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>C8:DE:BD:8F:78:3C</LocalizedText>
        </View>
      </View>

      {/* 5. CÀI ĐẶT CẢNH BÁO AN TOÀN */}
      <TouchableOpacity
        style={[styles.algoShortcutCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onNavigateAlgoConfig}
        activeOpacity={0.85}
      >
        <View style={styles.algoShortcutLeft}>
          <View style={[styles.algoShortcutIconBox, isDarkMode && { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
            <Ionicons name="shield-checkmark" size={24} color="#0284C7" />
          </View>
          <View style={{ marginLeft: 14 }}>
            <LocalizedText style={[styles.algoShortcutTitle, isDarkMode && { color: colors.textPrimary }]}>
              Cài Đặt Ngưỡng Cảnh Báo AI
            </LocalizedText>
            <LocalizedText style={[styles.algoShortcutSub, isDarkMode && { color: colors.textSecondary }]}>
              Ngưỡng nhịp tim ({algoSettings.minHeartRate ?? 60}-{algoSettings.maxHeartRate ?? 100} bpm) • SpO₂ (&lt;{algoSettings.minSpO2 ?? 95}%)
            </LocalizedText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  specsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  specsCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  specsCardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 16,
  },
  specTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  specTableKey: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  specTableVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1.2,
    textAlign: 'right',
  },
  algoShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  algoShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  algoShortcutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  algoShortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  algoShortcutSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});

