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
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Chip vi điều khiển (MCU)</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Nordic nRF52840 (ARM Cortex-M4F 64MHz)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Cảm biến sinh trắc PPG</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Maxim MAX30102 (Đo Nhịp tim &amp; SpO₂ quang học)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Cảm biến chuyển động IMU</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>MPU6050 6-DoF (Gia tốc 3 trục + Con quay 3 trục)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Cảm biến nhiệt độ bề mặt</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>NTC Skin Contact Thermistor (Sai số ±0.1°C)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Giao thức kết nối không dây</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Bluetooth Low Energy 5.0 (GATT Client Bleak)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Dung lượng Pin &amp; Nguồn sạc</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>Li-Po 110mAh • Sạc từ tính 5V/1A (Dùng 5-7 ngày)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, isDarkMode && { borderBottomColor: colors.border }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Chuẩn kháng nước &amp; bụi</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>IP67 (Chống nước sinh hoạt, rửa tay, đi mưa nhẹ)</LocalizedText>
        </View>
        <View style={[styles.specTableRow, { borderBottomWidth: 0 }]}>
          <LocalizedText style={[styles.specTableKey, isDarkMode && { color: colors.textSecondary }]}>Phiên bản Firmware OTA</LocalizedText>
          <LocalizedText style={[styles.specTableVal, isDarkMode && { color: colors.textPrimary }]}>v2.4.1-seca (Bản mới nhất, cập nhật 05/09/2026)</LocalizedText>
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

