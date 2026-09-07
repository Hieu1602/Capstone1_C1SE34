// VitalCard.tsx
// Component hiển thị một chỉ số sinh hiệu với màu sắc theo trạng thái

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NormalRange {
  min: number;
  max: number;
}

interface VitalCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | null | undefined;
  unit: string;
  color: string;
  normalRange?: NormalRange;
  decimals?: number;
}

type StatusLevel = 'normal' | 'warning' | 'critical' | 'unknown';

function getStatus(value: number | null | undefined, range?: NormalRange): StatusLevel {
  if (value === null || value === undefined) return 'unknown';
  if (!range) return 'normal';
  if (value < range.min * 0.9 || value > range.max * 1.1) return 'critical';
  if (value < range.min || value > range.max) return 'warning';
  return 'normal';
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  normal:  '#22C55E',
  warning: '#F97316',
  critical:'#EF4444',
  unknown: '#64748B',
};

export default function VitalCard({
  icon, label, value, unit, color, normalRange, decimals = 0,
}: VitalCardProps) {
  const status = getStatus(value, normalRange);
  const statusColor = STATUS_COLORS[status];
  const displayValue = value !== null && value !== undefined
    ? value.toFixed(decimals)
    : '---';

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      {/* Icon */}
      <View style={[styles.iconWrapper, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>

      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Value */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: statusColor }]}>{displayValue}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {/* Status indicator */}
      <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  unit: {
    color: '#64748B',
    fontSize: 13,
    paddingBottom: 4,
  },
  statusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.6,
  },
});
