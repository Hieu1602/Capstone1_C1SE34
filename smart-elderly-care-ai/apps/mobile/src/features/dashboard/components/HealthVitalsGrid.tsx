// HealthVitalsGrid.tsx
// Lưới 4 thẻ hiển thị chỉ số sinh hiệu (Nhịp tim, SpO2, Thân nhiệt, Vận động)

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface VitalCardConfig {
  label: string;
  value: string;
  unit: string;
  status: string;
  statusColor: string;
  statusBg: string;
  range: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}

interface HealthVitalsGridProps {
  card1: VitalCardConfig;
  card2: VitalCardConfig;
  card3: VitalCardConfig;
  card4: VitalCardConfig;
  highlightedMetric: string | null;
  setHighlightedMetric: (val: string | null) => void;
  isDarkMode: boolean;
  colors: any;
}

export const HealthVitalsGrid: React.FC<HealthVitalsGridProps> = ({
  card1,
  card2,
  card3,
  card4,
  highlightedMetric,
  setHighlightedMetric,
  isDarkMode,
  colors,
}) => {
  return (
    <View style={styles.vitalsGrid}>
      {/* Thẻ 1: Nhịp tim */}
      <TouchableOpacity
        style={[
          styles.vitalBox,
          isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
          highlightedMetric === 'heartRate' && styles.vitalBoxHighlighted,
        ]}
        activeOpacity={0.8}
        onPress={() => setHighlightedMetric(highlightedMetric === 'heartRate' ? null : 'heartRate')}
      >
        <View style={styles.vitalBoxHeader}>
          <View style={[styles.vitalIconWrapper, { backgroundColor: card1.iconBg }]}>
            <Ionicons name={card1.icon} size={20} color={card1.iconColor} />
          </View>
          <View style={[styles.vitalStatusTag, { backgroundColor: card1.statusBg }]}>
            <Text style={[styles.vitalStatusText, { color: card1.statusColor }]}>
              {card1.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{card1.label}</Text>
        <View style={styles.vitalValRow}>
          <Text style={[styles.vitalValNumber, isDarkMode && { color: colors.textPrimary }]}>
            {card1.value}
          </Text>
          {Boolean(card1.unit) && (
            <Text style={[styles.vitalValUnit, isDarkMode && { color: colors.textSecondary }]}>{card1.unit}</Text>
          )}
        </View>
        <Text style={styles.vitalNormalRange}>{card1.range}</Text>
      </TouchableOpacity>

      {/* Thẻ 2: SpO2 */}
      <TouchableOpacity
        style={[
          styles.vitalBox,
          isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
          highlightedMetric === 'spo2' && styles.vitalBoxHighlighted,
        ]}
        activeOpacity={0.8}
        onPress={() => setHighlightedMetric(highlightedMetric === 'spo2' ? null : 'spo2')}
      >
        <View style={styles.vitalBoxHeader}>
          <View style={[styles.vitalIconWrapper, { backgroundColor: card2.iconBg }]}>
            <Ionicons name={card2.icon} size={20} color={card2.iconColor} />
          </View>
          <View style={[styles.vitalStatusTag, { backgroundColor: card2.statusBg }]}>
            <Text style={[styles.vitalStatusText, { color: card2.statusColor }]}>
              {card2.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{card2.label}</Text>
        <View style={styles.vitalValRow}>
          <Text style={[styles.vitalValNumber, isDarkMode && { color: colors.textPrimary }]}>{card2.value}</Text>
          {Boolean(card2.unit) && (
            <Text style={[styles.vitalValUnit, isDarkMode && { color: colors.textSecondary }]}>{card2.unit}</Text>
          )}
        </View>
        <Text style={styles.vitalNormalRange}>{card2.range}</Text>
      </TouchableOpacity>

      {/* Thẻ 3: Nhiệt độ cơ thể */}
      <TouchableOpacity
        style={[
          styles.vitalBox,
          isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
          highlightedMetric === 'temp' && styles.vitalBoxHighlighted,
        ]}
        activeOpacity={0.8}
        onPress={() => setHighlightedMetric(highlightedMetric === 'temp' ? null : 'temp')}
      >
        <View style={styles.vitalBoxHeader}>
          <View style={[styles.vitalIconWrapper, { backgroundColor: card3.iconBg }]}>
            <Ionicons name={card3.icon} size={20} color={card3.iconColor} />
          </View>
          <View style={[styles.vitalStatusTag, { backgroundColor: card3.statusBg }]}>
            <Text style={[styles.vitalStatusText, { color: card3.statusColor }]}>
              {card3.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{card3.label}</Text>
        <View style={styles.vitalValRow}>
          <Text style={[styles.vitalValNumber, isDarkMode && { color: colors.textPrimary }]}>{card3.value}</Text>
          {Boolean(card3.unit) && (
            <Text style={[styles.vitalValUnit, isDarkMode && { color: colors.textSecondary }]}>{card3.unit}</Text>
          )}
        </View>
        <Text style={styles.vitalNormalRange}>{card3.range}</Text>
      </TouchableOpacity>

      {/* Thẻ 4: Trạng thái vận động */}
      <TouchableOpacity
        style={[
          styles.vitalBox,
          isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
          highlightedMetric === 'activity' && styles.vitalBoxHighlighted,
        ]}
        activeOpacity={0.8}
        onPress={() => setHighlightedMetric(highlightedMetric === 'activity' ? null : 'activity')}
      >
        <View style={styles.vitalBoxHeader}>
          <View style={[styles.vitalIconWrapper, { backgroundColor: card4.iconBg }]}>
            <Ionicons name={card4.icon} size={20} color={card4.iconColor} />
          </View>
          <View style={[styles.vitalStatusTag, { backgroundColor: card4.statusBg }]}>
            <Text style={[styles.vitalStatusText, { color: card4.statusColor }]}>
              {card4.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{card4.label}</Text>
        <View style={styles.vitalValRow}>
          <Text
            style={[
              styles.vitalValNumber,
              isDarkMode && { color: colors.textPrimary },
              card4.value.length > 8 && { fontSize: 16 },
            ]}
          >
            {card4.value}
          </Text>
        </View>
        <Text style={styles.vitalNormalRange}>{card4.range}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  vitalBox: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  vitalBoxHighlighted: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  vitalBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  vitalIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalStatusTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vitalStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  vitalBoxLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  vitalValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  vitalValNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  vitalValUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  vitalNormalRange: {
    fontSize: 10,
    color: '#94A3B8',
  },
});

export default HealthVitalsGrid;
