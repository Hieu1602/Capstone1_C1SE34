// ============================================================================
// THẺ CHỈ SỐ SINH HIỆU THỜI GIAN THỰC (VITAL CARD)
// Hệ thống: Smart Elderly Care AI (SECA)
// Chức năng:
//   - Hiển thị chỉ số sinh hiệu đo được từ vòng đeo tay BLE (Nhịp tim, SpO2, Thân nhiệt, Huyết áp, v.v.)
//   - Tự động đánh giá phân loại mức độ an toàn theo dải chỉ số y tế tiêu chuẩn:
//       + normal (Bình thường - Xanh lá #22C55E)
//       + warning (Cần chú ý - Cam #F97316)
//       + critical (Nguy hiểm - Đỏ #EF4444)
//       + unknown (Chưa có tín hiệu - Xám #64748B)
//   - Cập nhật màu sắc giá trị và thanh chỉ báo động (Status Bar) tương ứng
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Định nghĩa khoảng giá trị bình thường tiêu chuẩn cho từng loại sinh hiệu
 */
interface NormalRange {
  min: number; // Ngưỡng tối thiểu bình thường
  max: number; // Ngưỡng tối đa bình thường
}

/**
 * Thuộc tính đầu vào của component VitalCard
 */
interface VitalCardProps {
  icon: keyof typeof Ionicons.glyphMap; // Biểu tượng sinh hiệu từ thư viện Ionicons
  label: string;                         // Tên chỉ số (VD: Nhịp tim, SpO2, Nhiệt độ)
  value: number | null | undefined;     // Giá trị đo thực tế thời gian thực
  unit: string;                          // Đơn vị đo (VD: bpm, %, °C, mmHg)
  color: string;                         // Màu nhận diện đặc trưng của loại chỉ số
  normalRange?: NormalRange;             // Dải an toàn y tế tham chiếu
  decimals?: number;                     // Số chữ số thập phân hiển thị (mặc định: 0)
}

/**
 * Các cấp độ trạng thái sức khỏe của chỉ số
 */
type StatusLevel = 'normal' | 'warning' | 'critical' | 'unknown';

/**
 * Hàm phân loại tình trạng chỉ số sinh hiệu dựa trên ngưỡng y tế tham chiếu
 * - Nếu không có giá trị đo: trả về 'unknown'
 * - Nếu giá trị lệch vượt quá 10% ngưỡng an toàn: trả về 'critical'
 * - Nếu giá trị vượt nhẹ ngưỡng an toàn: trả về 'warning'
 * - Nằm trong dải an toàn: trả về 'normal'
 */
function getStatus(value: number | null | undefined, range?: NormalRange): StatusLevel {
  if (value === null || value === undefined) return 'unknown';
  if (!range) return 'normal';
  if (value < range.min * 0.9 || value > range.max * 1.1) return 'critical';
  if (value < range.min || value > range.max) return 'warning';
  return 'normal';
}

/**
 * Bảng mã màu sắc quy chuẩn theo từng cấp độ cảnh báo
 */
const STATUS_COLORS: Record<StatusLevel, string> = {
  normal: '#22C55E',   // Xanh lá - An toàn, ổn định
  warning: '#F97316',  // Cam - Cảnh báo cần theo dõi
  critical: '#EF4444', // Đỏ - Nguy cấp, cần hỗ trợ y tế
  unknown: '#64748B',  // Xám - Đang chờ tín hiệu cảm biến
};

export default function VitalCard({
  icon,
  label,
  value,
  unit,
  color,
  normalRange,
  decimals = 0,
}: VitalCardProps) {
  // Đánh giá tình trạng sinh hiệu hiện tại
  const status = getStatus(value, normalRange);
  const statusColor = STATUS_COLORS[status];

  // Chuỗi hiển thị giá trị: làm tròn theo decimals hoặc '---' nếu chưa có dữ liệu đo
  const displayValue =
    value !== null && value !== undefined
      ? value.toFixed(decimals)
      : '---';

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      {/* Khối biểu tượng chỉ số sinh hiệu */}
      <View style={[styles.iconWrapper, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>

      {/* Tên chỉ số sinh hiệu */}
      <Text style={styles.label}>{label}</Text>

      {/* Dòng hiển thị giá trị số & đơn vị đo */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: statusColor }]}>{displayValue}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {/* Thanh vạch chỉ báo trạng thái ở cạnh dưới thẻ */}
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
