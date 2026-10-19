// ==============================================================================
// TỆP: HealthTimelineScrubber.tsx
// PHÂN HỆ: Thanh Tua Dòng Thời Gian Tương Tác (Interactive Timeline Scrubber)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Cho phép người dùng kéo thanh trượt hoặc bấm chọn nhanh 6 mốc giờ trong ngày
//     (00:00, 06:00, 09:00, 12:00, 18:00, 22:00).
//   - Hiển thị chi tiết bản ghi sinh hiệu gần nhất với thời điểm đang chọn (Nhịp tim,
//     SpO2, Nhiệt độ da, Trạng thái té ngã).
// ==============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Shadows } from '../../../theme/colors';

// Chuyển đổi số phút trong ngày sang chuỗi giờ:phút (HH:MM)
const formatTimeHM = (minutes: number) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// Chuyển đổi chuỗi YYYY-MM-DD sang định dạng ngày Việt Nam DD/MM/YYYY
const formatDisplayDateVN = (ymd: string) => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymd;
};

interface HealthTimelineScrubberProps {
  scrubberMinutes: number;
  setScrubberMinutes: (val: number) => void;
  closestVital: any;
  isLoadingVitals: boolean;
  hasData: boolean;
  selectedDate: string;
  isDarkMode: boolean;
  colors: any;
}

export const HealthTimelineScrubber: React.FC<HealthTimelineScrubberProps> = ({
  scrubberMinutes,
  setScrubberMinutes,
  closestVital,
  isLoadingVitals,
  hasData,
  selectedDate,
  isDarkMode,
  colors,
}) => {
  return (
    <View style={[styles.timelineCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.timelineHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.timelineIconDot}>
            <Ionicons name="time" size={15} color="#FFF" />
          </View>
          <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>
            Tua Dòng Thời Gian (Interactive Timeline)
          </Text>
        </View>
        <View style={styles.timeBadge}>
          <Ionicons name="stopwatch-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={styles.timeBadgeText}>{formatTimeHM(scrubberMinutes)}</Text>
        </View>
      </View>

      <Text style={[styles.timelineSub, { color: colors.textSecondary }]}>
        Kéo thanh trượt để tua xem lại dữ liệu sinh tồn đo được tại từng thời khắc trong ngày:
      </Text>

      {/* Slider Control */}
      <View style={styles.sliderContainer}>
        {Platform.OS === 'web' ? (
          <input
            type="range"
            min="0"
            max="1439"
            step="15"
            value={scrubberMinutes}
            onChange={(e: any) => setScrubberMinutes(Number(e.target.value))}
            style={{
              width: '100%',
              height: 8,
              accentColor: '#2563EB',
              cursor: 'pointer',
              borderRadius: 4,
            }}
          />
        ) : (
          <View style={styles.sliderMockTrack}>
            <View style={[styles.sliderMockProgress, { width: `${(scrubberMinutes / 1439) * 100}%` }]} />
            <View style={[styles.sliderMockThumb, { left: `${Math.min(94, (scrubberMinutes / 1439) * 100)}%` }]} />
          </View>
        )}

        {/* Time Axis Labels */}
        <View style={styles.sliderLabelsRow}>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>00:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>06:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>12:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>18:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>23:59</Text>
        </View>
      </View>

      {/* Quick Jump Buttons */}
      <View style={styles.quickJumpRow}>
        {[
          { label: 'Sáng', time: '07:00', mins: 420 },
          { label: 'Trưa', time: '12:00', mins: 720 },
          { label: 'Chiều', time: '17:00', mins: 1020 },
          { label: 'Tối', time: '21:00', mins: 1260 },
        ].map((btn) => (
          <TouchableOpacity
            key={btn.label}
            style={[
              styles.quickJumpBtn,
              Math.abs(scrubberMinutes - btn.mins) < 30 && styles.quickJumpBtnActive,
              isDarkMode && { backgroundColor: colors.surfaceSubtle },
            ]}
            onPress={() => setScrubberMinutes(btn.mins)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.quickJumpBtnText,
                Math.abs(scrubberMinutes - btn.mins) < 30 && styles.quickJumpBtnTextActive,
                { color: isDarkMode ? colors.textSecondary : '#475569' },
              ]}
            >
              {btn.label} {btn.time}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Highlighted Closest Vital Card */}
      {closestVital ? (
        <View style={[styles.highlightBox, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#3B82F6' }]}>
          <View style={styles.highlightHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location" size={15} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={[styles.highlightTitle, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
                Mốc đo thực tế: {(() => {
                  const vitalTime = closestVital.recorded_at || closestVital.time || closestVital.created_at;
                  if (!vitalTime) return '--:--';
                  const d = new Date(vitalTime);
                  return !isNaN(d.getTime()) ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                })()}
              </Text>
            </View>
            <View style={styles.highlightBadge}>
              <Text style={styles.highlightBadgeText}>
                {closestVital.activity_state || closestVital.activity || 'Sinh hoạt'}
              </Text>
            </View>
          </View>

          <View style={styles.highlightStatsGrid}>
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Nhịp tim</Text>
              <Text style={[styles.highlightStatVal, { color: '#EF4444' }]}>{closestVital.heart_rate ?? '--'} bpm</Text>
            </View>
            <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Oxy SpO₂</Text>
              <Text style={[styles.highlightStatVal, { color: '#0284C7' }]}>{closestVital.spo2 ?? '--'}%</Text>
            </View>
            <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Thân nhiệt</Text>
              <Text style={[styles.highlightStatVal, { color: '#D97706' }]}>{closestVital.body_temp ?? closestVital.skin_temp_max ?? '--'}°C</Text>
            </View>
            <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Âm thanh</Text>
              <Text style={[styles.highlightStatVal, { color: '#16A34A' }]}>{closestVital.sound_state || closestVital.sound || closestVital.acoustic_status || 'Bình thường'}</Text>
            </View>
          </View>
        </View>
      ) : (
        !isLoadingVitals && !hasData && (
          <View style={[styles.timelineEmptyBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
            <Ionicons name="calendar-outline" size={30} color="#94A3B8" style={{ marginBottom: 6 }} />
            <Text style={[styles.timelineEmptyTitle, { color: colors.textPrimary }]}>
              Chưa có dữ liệu đo cho ngày này
            </Text>
            <Text style={[styles.timelineEmptySub, { color: colors.textMuted }]}>
              Không tìm thấy bản ghi nhịp tim & sinh hiệu nào trong cơ sở dữ liệu cho ngày {formatDisplayDateVN(selectedDate)}. Vui lòng chọn ngày khác trên lịch để tua xem.
            </Text>
          </View>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timelineIconDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineSub: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  timeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderMockTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderMockProgress: {
    height: 8,
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  sliderMockThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFF',
    top: -6,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sliderLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quickJumpRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  quickJumpBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickJumpBtnActive: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  quickJumpBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  quickJumpBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  highlightBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  highlightBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  highlightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  highlightStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  highlightStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  highlightStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 3,
  },
  highlightStatVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  highlightStatDivider: {
    width: 1,
    height: 24,
  },
  timelineEmptyBox: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  timelineEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  timelineEmptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default HealthTimelineScrubber;

