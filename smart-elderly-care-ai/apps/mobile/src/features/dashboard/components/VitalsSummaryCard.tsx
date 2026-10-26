// ==============================================================================
// TỆP: VitalsSummaryCard.tsx
// PHÂN HỆ: Thẻ Tóm tắt Chỉ số Sinh tồn & Trạng thái Thiết bị (HomeScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Hiển thị trạng thái kết nối thực tế của Bộ xử lý trung tâm Edge Hub (Online/Offline)
//     và dung lượng Pin của vòng đeo tay thông minh BLE.
//   - Hiển thị lưới 5 chỉ số giám sát: Nhịp tim (BPM), Oxy máu (SpO2), Thân nhiệt (AMG8833),
//     Tư thế vận động (YOLO-Pose) và Âm thanh môi trường (YAMNet).
//   - Khi chưa có dữ liệu đo từ Database, tự động hiển thị ký hiệu '--' chuẩn Empty State.
// ==============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';

interface VitalsSummaryCardProps {
  currentVitals: {
    heart_rate?: number | null;
    spo2?: number | null;
    skin_temp_max?: number | null;
    fall_detected?: boolean | null;
    [key: string]: any;
  };
  isEdgeHubOnline: boolean;
  braceletBattery?: number | null;
  isAcousticAlarm: boolean;
  isDarkMode: boolean;
  colors: any;
  navigation: any;
}

export const VitalsSummaryCard: React.FC<VitalsSummaryCardProps> = ({
  currentVitals,
  isEdgeHubOnline,
  braceletBattery,
  isAcousticAlarm,
  isDarkMode,
  colors,
  navigation,
}) => {
  // Kiểm tra các chỉ số sinh hiệu có dữ liệu thực từ cảm biến hay đang rỗng (null)
  const hasHR = currentVitals.heart_rate !== null && currentVitals.heart_rate !== undefined;
  const hasSpO2 = currentVitals.spo2 !== null && currentVitals.spo2 !== undefined;
  const hasTemp = currentVitals.skin_temp_max !== null && currentVitals.skin_temp_max !== undefined;
  // Kiểm tra thiết bị vòng đeo tay BLE có đang kết nối thực tế hay không
  const isBraceletConnected = Boolean(
    currentVitals?.bracelet_connected &&
    braceletBattery !== null &&
    braceletBattery !== undefined
  );

  return (
    <View style={[styles.vitalsSummaryCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header Card */}
      <View style={styles.vitalsSummaryHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.livePulseDot} />
          <Text style={[styles.vitalsSummaryTitle, isDarkMode && { color: colors.textPrimary }]}>Chỉ số sinh hiệu</Text>
        </View>
        <TouchableOpacity
          style={[styles.vitalsDetailChip, isDarkMode && { backgroundColor: 'rgba(255, 122, 0, 0.15)', borderColor: 'rgba(255, 122, 0, 0.3)' }]}
          onPress={() => navigation.navigate('HealthDetail')}
          activeOpacity={0.7}
        >
          <Text style={styles.vitalsDetailChipText}>Chi tiết</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Thanh trạng thái Thiết bị & Hub: Edge Hub Online/Offline & % Pin vòng BLE */}
      <View style={[styles.deviceStatusBar, isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
        <View style={styles.deviceStatusItem}>
          <Ionicons
            name="hardware-chip-outline"
            size={14}
            color={isEdgeHubOnline ? Colors.success : Colors.danger}
          />
          <Text style={[styles.deviceStatusText, isDarkMode && { color: colors.textSecondary }]}>
            Edge Hub:{' '}
            <Text
              style={{
                color: isEdgeHubOnline ? Colors.success : Colors.danger,
                fontWeight: '700',
              }}
            >
              {isEdgeHubOnline ? 'Online' : 'Offline'}
            </Text>
          </Text>
        </View>

        <View style={[styles.deviceStatusDivider, isDarkMode && { backgroundColor: colors.border }]} />

        <View style={styles.deviceStatusItem}>
          <Ionicons
            name={isBraceletConnected ? "battery-charging" : "bluetooth-outline"}
            size={15}
            color={isBraceletConnected ? Colors.aiBlue : isDarkMode ? '#64748B' : '#94A3B8'}
          />
          <Text style={[styles.deviceStatusText, isDarkMode && { color: colors.textSecondary }]}>
            Vòng BLE:{' '}
            <Text
              style={{
                color: isBraceletConnected
                  ? (isDarkMode ? colors.textPrimary : Colors.textPrimary)
                  : (isDarkMode ? '#94A3B8' : '#64748B'),
                fontWeight: '700',
              }}
            >
              {isBraceletConnected ? `${braceletBattery}% Pin` : 'Chưa kết nối'}
            </Text>
          </Text>
        </View>
      </View>

      {/* Lưới 5 chỉ số sinh hiệu: Nhịp tim, SpO2, AMG8833, YOLO-Pose, Acoustic/YAMNet */}
      <View style={styles.vitalsGrid}>
        {/* Nhịp tim */}
        <View style={styles.vitalItem}>
          <Ionicons name="heart" size={17} color="#EF4444" />
          <Text style={[styles.vitalValText, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
            {hasHR ? (
              <>
                {currentVitals.heart_rate}{' '}
                <Text style={styles.vitalUnit}>bpm</Text>
              </>
            ) : (
              '--'
            )}
          </Text>
          <Text style={[styles.vitalLblText, isDarkMode && { color: colors.textSecondary }]}>Nhịp tim</Text>
        </View>
        <View style={[styles.vitalDivider, isDarkMode && { backgroundColor: colors.border }]} />

        {/* SpO2 */}
        <View style={styles.vitalItem}>
          <Ionicons name="water" size={17} color="#3B82F6" />
          <Text style={[styles.vitalValText, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
            {hasSpO2 ? (
              <>
                {currentVitals.spo2}{' '}
                <Text style={styles.vitalUnit}>%</Text>
              </>
            ) : (
              '--'
            )}
          </Text>
          <Text style={[styles.vitalLblText, isDarkMode && { color: colors.textSecondary }]}>SpO₂</Text>
        </View>
        <View style={[styles.vitalDivider, isDarkMode && { backgroundColor: colors.border }]} />

        {/* Thân nhiệt */}
        <View style={styles.vitalItem}>
          <Ionicons name="thermometer" size={17} color="#F59E0B" />
          <Text style={[styles.vitalValText, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
            {hasTemp ? (
              <>
                {currentVitals.skin_temp_max}{' '}
                <Text style={styles.vitalUnit}>°C</Text>
              </>
            ) : (
              '--'
            )}
          </Text>
          <Text style={[styles.vitalLblText, isDarkMode && { color: colors.textSecondary }]}>Thân nhiệt</Text>
        </View>
        <View style={[styles.vitalDivider, isDarkMode && { backgroundColor: colors.border }]} />

        {/* Trạng thái vận động */}
        <View style={styles.vitalItem}>
          <Ionicons
            name="body"
            size={17}
            color={currentVitals.fall_detected ? Colors.danger : Colors.success}
          />
          <Text
            style={[
              styles.vitalValText,
              {
                fontSize: 12,
                color: currentVitals.fall_detected ? Colors.danger : (hasHR ? Colors.success : colors.textSecondary),
              },
            ]}
            numberOfLines={1}
          >
            {currentVitals.fall_detected ? 'Ngã!' : (hasHR ? 'Sinh hoạt' : '--')}
          </Text>
          <Text style={[styles.vitalLblText, isDarkMode && { color: colors.textSecondary }]}>Vận động</Text>
        </View>
        <View style={[styles.vitalDivider, isDarkMode && { backgroundColor: colors.border }]} />

        {/* Kênh âm thanh môi trường */}
        <View style={styles.vitalItem}>
          <Ionicons
            name={isAcousticAlarm ? 'warning' : 'mic'}
            size={17}
            color={isAcousticAlarm ? Colors.danger : '#8B5CF6'}
          />
          <Text
            style={[
              styles.vitalValText,
              {
                fontSize: 12,
                color: isAcousticAlarm ? Colors.danger : '#8B5CF6',
              },
            ]}
            numberOfLines={1}
          >
            {isAcousticAlarm ? 'La hét!' : (currentVitals.acoustic_status ?? 'Bình thường')}
          </Text>
          <Text style={[styles.vitalLblText, isDarkMode && { color: colors.textSecondary }]}>Âm thanh</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  vitalsSummaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    ...Shadows.soft,
  },
  vitalsSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  vitalsSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vitalsDetailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.15)',
  },
  vitalsDetailChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B00',
  },
  deviceStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  deviceStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deviceStatusText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deviceStatusDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.borderDark,
  },
  vitalsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  vitalItem: {
    alignItems: 'center',
    flex: 1,
  },
  vitalValText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  vitalUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  vitalLblText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  vitalDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
});

