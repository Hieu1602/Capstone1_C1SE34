import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { getSpo2BadgeConfig } from './healthTrendsHelpers';
import { healthTrendsStyles as styles } from './healthTrendsStyles';

interface Spo2RulerCardProps {
  isDarkMode: boolean;
  colors: any;
  hasSpO2: boolean;
  spo2Value: number | null;
  spo2PinPercent: number;
  onPress: () => void;
}

const SPO2_RULER_TICKS = [
  { label: '90%', isStandard: false },
  { label: '92%', isStandard: false },
  { label: '95% (Chuẩn)', isStandard: true },
  { label: '98%', isStandard: false },
  { label: '100%', isStandard: false },
] as const;

export function Spo2RulerCard({
  isDarkMode,
  colors,
  hasSpO2,
  spo2Value,
  spo2PinPercent,
  onPress,
}: Spo2RulerCardProps) {
  const badge = getSpo2BadgeConfig(hasSpO2, spo2Value, isDarkMode);

  return (
    <TouchableOpacity
      style={[styles.spo2GaugeCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.spo2CardTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
          <View style={styles.spo2IconCircle}>
            <Ionicons name="water" size={16} color="#0284C7" />
          </View>
          <Text style={[styles.spo2CardTitle, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
            Chỉ số Oxy máu SpO₂
          </Text>
        </View>
        <View style={[styles.spo2BadgeGreen, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.iconName} size={13} color={badge.iconColor} />
          <Text
            style={[styles.spo2BadgeGreenText, { color: badge.textColor }]}
            numberOfLines={1}
          >
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Thước đo ngang SpO2 từ 90% đến 100% */}
      <View style={styles.rulerContainer}>
        <View style={styles.rulerTrackBg}>
          <View style={styles.rulerZoneWarning} />
          <View style={styles.rulerZoneSafe} />
          {hasSpO2 && (
            <View style={[styles.rulerMarkerPin, { left: `${spo2PinPercent}%` }]}>
              <View style={styles.rulerPointerArrow} />
              <View style={styles.rulerPointerDot} />
            </View>
          )}
        </View>

        {/* Các mốc số cố định trên thước đo chuẩn y tế */}
        <View style={styles.rulerTicksRow}>
          {SPO2_RULER_TICKS.map((tick) => (
            <Text
              key={tick.label}
              style={[
                styles.rulerTickText,
                tick.isStandard
                  ? { fontWeight: '700', color: Colors.primary }
                  : isDarkMode && { color: colors.textSecondary },
              ]}
            >
              {tick.label}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.spo2FooterRow}>
        <Ionicons
          name={hasSpO2 ? 'shield-checkmark-outline' : 'information-circle-outline'}
          size={14}
          color={hasSpO2 ? '#15803D' : '#64748B'}
        />
        <Text style={[styles.spo2FooterNote, isDarkMode && { color: colors.textSecondary }]}>
          {hasSpO2
            ? 'Ngưỡng an toàn ≥ 95% • Nồng độ oxy bão hoà duy trì tối ưu'
            : 'Chưa ghi nhận dữ liệu đo SpO₂ từ vòng đeo tay'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
