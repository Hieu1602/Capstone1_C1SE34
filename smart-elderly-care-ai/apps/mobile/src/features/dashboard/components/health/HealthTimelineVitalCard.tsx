import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { timelineScrubberStyles as styles } from './timelineScrubberStyles';

// Chuyển đổi số phút trong ngày sang chuỗi giờ:phút (HH:MM)
export const formatTimeHM = (minutes: number): string => {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.min(1439, Math.round(minutes))) : 0;
  const h = Math.floor(safe / 60).toString().padStart(2, '0');
  const m = (safe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// Chuyển đổi chuỗi YYYY-MM-DD sang định dạng ngày Việt Nam DD/MM/YYYY
export const formatDisplayDateVN = (ymd: string): string => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ymd;
};

const resolveVitalTimeLabel = (vital: any, fallbackMinutes: number): string => {
  if (vital._label) return vital._label;
  const vitalTime = vital.recorded_at || vital.time || vital.created_at;
  if (!vitalTime) return formatTimeHM(fallbackMinutes);
  const d = new Date(vitalTime);
  if (!isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return formatTimeHM(fallbackMinutes);
};

interface EmptyStateConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconSize: number;
  iconMarginBottom: number;
  compact: boolean;
  title: string;
  subtitle: string;
}

interface HealthTimelineVitalCardProps {
  vital: any;
  displayMinutes: number;
  nowMinutes: number;
  isFutureScrubber: boolean;
  hasData: boolean;
  isLoadingVitals: boolean;
  selectedDate: string;
  isDarkMode: boolean;
  colors: any;
}

export const HealthTimelineVitalCard: React.FC<HealthTimelineVitalCardProps> = ({
  vital,
  displayMinutes,
  nowMinutes,
  isFutureScrubber,
  hasData,
  isLoadingVitals,
  selectedDate,
  isDarkMode,
  colors,
}) => {
  if (vital) {
    const statItems = [
      { label: 'Nhịp tim', value: `${vital.heart_rate ?? '--'} bpm`, color: '#EF4444' },
      { label: 'Oxy SpO₂', value: `${vital.spo2 ?? '--'}%`, color: '#0284C7' },
      { label: 'Bước chân', value: vital.steps != null ? `${vital.steps} bước` : '--', color: '#16A34A' },
      {
        label: 'Âm thanh',
        value: vital.sound_state || vital.sound || vital.acoustic_status || 'Bình thường',
        color: '#16A34A',
      },
    ];
    const dividerColor = isDarkMode ? '#334155' : '#DBEAFE';

    return (
      <View
        style={[
          styles.highlightBox,
          { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#3B82F6' },
        ]}
      >
        <View style={styles.highlightHeader}>
          <View style={styles.timelineTitleRow}>
            <Ionicons name="location" size={15} color="#2563EB" style={{ marginRight: 4 }} />
            <Text style={[styles.highlightTitle, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
              Mốc đo thực tế: {resolveVitalTimeLabel(vital, displayMinutes)}
            </Text>
          </View>
          <View style={styles.highlightBadge}>
            <Text style={styles.highlightBadgeText}>
              {vital.activity_state || vital.activity || 'Sinh hoạt'}
            </Text>
          </View>
        </View>

        <View style={styles.highlightStatsGrid}>
          {statItems.map((item, idx) => (
            <React.Fragment key={item.label}>
              {idx > 0 && <View style={[styles.highlightStatDivider, { backgroundColor: dividerColor }]} />}
              <View style={styles.highlightStatCol}>
                <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>{item.label}</Text>
                <Text style={[styles.highlightStatVal, { color: item.color }]}>{item.value}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  }

  let emptyConfig: EmptyStateConfig | null = null;
  if (isFutureScrubber) {
    emptyConfig = {
      icon: 'time-outline',
      iconSize: 24,
      iconMarginBottom: 4,
      compact: true,
      title: `Mốc thời gian chưa diễn ra (${formatTimeHM(displayMinutes)})`,
      subtitle: `Thời gian hiện tại là ${formatTimeHM(nowMinutes)}. Hệ thống chỉ hiển thị dữ liệu đo thực tế đã lưu trong cơ sở dữ liệu, không dự đoán số đo tương lai.`,
    };
  } else if (hasData) {
    emptyConfig = {
      icon: 'information-circle-outline',
      iconSize: 24,
      iconMarginBottom: 4,
      compact: true,
      title: `Không có dữ liệu đo quanh mốc ${formatTimeHM(displayMinutes)}`,
      subtitle: 'Không có số đo nào trong khoảng ±45 phút quanh mốc này (thiết bị có thể đang sạc pin hoặc chưa đeo).',
    };
  } else if (!isLoadingVitals) {
    emptyConfig = {
      icon: 'calendar-outline',
      iconSize: 30,
      iconMarginBottom: 6,
      compact: false,
      title: 'Chưa có dữ liệu đo cho ngày này',
      subtitle: `Không tìm thấy bản ghi nhịp tim & sinh hiệu nào trong cơ sở dữ liệu cho ngày ${formatDisplayDateVN(selectedDate)}. Vui lòng chọn ngày khác trên lịch để tua xem.`,
    };
  }

  if (!emptyConfig) return null;

  return (
    <View
      style={[
        styles.timelineEmptyBox,
        {
          backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
        },
        emptyConfig.compact && { paddingVertical: 14 },
      ]}
    >
      <Ionicons
        name={emptyConfig.icon}
        size={emptyConfig.iconSize}
        color="#94A3B8"
        style={{ marginBottom: emptyConfig.iconMarginBottom }}
      />
      <Text
        style={[
          styles.timelineEmptyTitle,
          { color: colors.textPrimary },
          emptyConfig.compact && { fontSize: 13 },
        ]}
      >
        {emptyConfig.title}
      </Text>
      <Text
        style={[
          styles.timelineEmptySub,
          { color: colors.textMuted },
          emptyConfig.compact && { fontSize: 11 },
        ]}
      >
        {emptyConfig.subtitle}
      </Text>
    </View>
  );
};
