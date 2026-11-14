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

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Shadows } from '../../../theme/colors';
import { getTodayStr } from './health/useHealthTabConfig';

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
  parsedDayVitals?: any[];
  isLoadingVitals: boolean;
  hasData: boolean;
  selectedDate: string;
  isDarkMode: boolean;
  colors: any;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

export const HealthTimelineScrubber: React.FC<HealthTimelineScrubberProps> = React.memo(({
  scrubberMinutes,
  setScrubberMinutes,
  closestVital,
  parsedDayVitals,
  isLoadingVitals,
  hasData,
  selectedDate,
  isDarkMode,
  colors,
  onScrubbingChange,
}) => {
  const now = new Date();
  const isToday = selectedDate === getTodayStr();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const maxScrubMinutes = isToday ? nowMinutes : 1439;

  // Local state hiển thị để thumb thanh trượt di chuyển mượt mà
  const [displayMinutes, setDisplayMinutes] = useState(scrubberMinutes);
  const isDraggingRef = useRef(false);
  const pendingMinutesRef = useRef(scrubberMinutes);
  const lastUpdateRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  const trackRef = useRef<any>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackPageXRef = useRef(0);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setDisplayMinutes(scrubberMinutes);
      pendingMinutesRef.current = scrubberMinutes;
    }
  }, [scrubberMinutes]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const isFutureScrubber = isToday && displayMinutes > nowMinutes;

  // Tìm mốc đo thực tế cục bộ trong bộ nhớ RAM cho thẻ nổi bật
  const localClosestVital = useMemo(() => {
    if (!parsedDayVitals || parsedDayVitals.length === 0) return closestVital;
    if (isToday && displayMinutes > nowMinutes) return null;

    let best: any = null;
    let minDiff = 999999;
    for (let i = 0; i < parsedDayVitals.length; i++) {
      const v = parsedDayVitals[i];
      const vMinutes = v._minutes;
      if (vMinutes < 0) continue;
      if (isToday && vMinutes > nowMinutes) continue;

      const diff = Math.abs(vMinutes - displayMinutes);
      if (diff < minDiff && diff <= 90) {
        minDiff = diff;
        best = v;
      }
    }
    return best ?? closestVital;
  }, [parsedDayVitals, displayMinutes, isToday, nowMinutes, closestVital]);

  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow?.((x: number, _y: number, width: number) => {
      if (typeof x === 'number' && x > 0) {
        trackPageXRef.current = x;
      }
      if (typeof width === 'number' && width > 0) {
        setTrackWidth(width);
      }
    });
  }, []);

  const updateScrubberByPageX = useCallback(
    (pageX: number, isFinal = false) => {
      if (trackWidth <= 0) return;
      const originX = trackPageXRef.current > 0 ? trackPageXRef.current : 0;
      const localX = Math.max(0, Math.min(trackWidth, pageX - originX));
      const ratio = localX / trackWidth;
      const rawMins = ratio * 1439;
      // Tua theo nấc 5 phút
      const targetMins = Math.round(rawMins / 5) * 5;
      const clamped = Math.max(0, Math.min(targetMins, maxScrubMinutes));

      if (isFinal) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        pendingMinutesRef.current = clamped;
        setDisplayMinutes(clamped);
        setScrubberMinutes(clamped);
        return;
      }

      // Khi đang kéo: kiểm tra nếu giá trị không đổi thì bỏ qua
      if (clamped === pendingMinutesRef.current) return;
      pendingMinutesRef.current = clamped;

      // Throttle cập nhật giao diện local ở mức ~25fps (40ms) để không làm nghẽn JS thread
      const now = Date.now();
      if (now - lastUpdateRef.current >= 40) {
        lastUpdateRef.current = now;
        setDisplayMinutes(clamped);
      } else if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          lastUpdateRef.current = Date.now();
          setDisplayMinutes(pendingMinutesRef.current);
        });
      }
    },
    [trackWidth, maxScrubMinutes, setScrubberMinutes]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 3,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dx) > 3,
        onPanResponderGrant: (evt) => {
          isDraggingRef.current = true;
          onScrubbingChange?.(true);
          measureTrack();
          if (trackPageXRef.current <= 0) {
            trackPageXRef.current = Math.max(0, evt.nativeEvent.pageX - evt.nativeEvent.locationX);
          }
          updateScrubberByPageX(evt.nativeEvent.pageX, false);
        },
        onPanResponderMove: (evt) => {
          updateScrubberByPageX(evt.nativeEvent.pageX, false);
        },
        onPanResponderRelease: (evt) => {
          isDraggingRef.current = false;
          onScrubbingChange?.(false);
          updateScrubberByPageX(evt.nativeEvent.pageX, true);
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          onScrubbingChange?.(false);
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          setDisplayMinutes(pendingMinutesRef.current);
          setScrubberMinutes(pendingMinutesRef.current);
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [measureTrack, updateScrubberByPageX, setScrubberMinutes, onScrubbingChange]
  );

  const currentScrub = Math.min(displayMinutes, maxScrubMinutes);
  const ratio = Math.max(0, Math.min(1, currentScrub / 1439));
  const progressPercent = `${ratio * 100}%`;
  const thumbLeft = trackWidth > 0 ? Math.max(0, Math.min(trackWidth - 24, ratio * trackWidth - 12)) : 0;

  return (
    <View style={[styles.timelineCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.timelineHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.timelineIconDot}>
            <Ionicons name="time" size={15} color="#FFF" />
          </View>
          <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>
            Tua Dòng Thời Gian
          </Text>
        </View>
        <View style={styles.timeBadge}>
          <Ionicons name="stopwatch-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={styles.timeBadgeText}>{formatTimeHM(displayMinutes)}</Text>
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
            max={maxScrubMinutes}
            step="5"
            value={Math.min(displayMinutes, maxScrubMinutes)}
            onChange={(e: any) => {
              const val = Number(e.target.value);
              setDisplayMinutes(val);
              setScrubberMinutes(val);
            }}
            style={{
              width: '100%',
              height: 8,
              accentColor: '#2563EB',
              cursor: 'pointer',
              borderRadius: 4,
            }}
          />
        ) : (
          <View
            ref={trackRef}
            style={styles.sliderTouchArea}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setTrackWidth(w);
              measureTrack();
            }}
            {...panResponder.panHandlers}
          >
            <View
              pointerEvents="none"
              style={[styles.sliderMockTrack, isDarkMode && { backgroundColor: '#334155' }]}
            >
              <View style={[styles.sliderMockProgress, { width: progressPercent }]} />
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.sliderMockThumb,
                { left: thumbLeft },
              ]}
            />
          </View>
        )}

        {/* Time Axis Labels */}
        <View style={styles.sliderLabelsRow}>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>00:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>06:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>12:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>18:00</Text>
          <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>
            {isToday ? `Hiện tại ${formatTimeHM(nowMinutes)}` : '23:59'}
          </Text>
        </View>
      </View>

      {/* Quick Jump Buttons */}
      <View style={styles.quickJumpRow}>
        {[
          { label: 'Sáng', time: '07:00', mins: 420 },
          { label: 'Trưa', time: '12:00', mins: 720 },
          { label: 'Chiều', time: '17:00', mins: 1020 },
          { label: 'Tối', time: '21:00', mins: 1260 },
        ].map((btn) => {
          const isFutureBtn = isToday && btn.mins > nowMinutes;
          const isActive = Math.abs(displayMinutes - btn.mins) < 30 && !isFutureBtn;
          return (
            <TouchableOpacity
              key={btn.label}
              disabled={isFutureBtn}
              style={[
                styles.quickJumpBtn,
                isActive && styles.quickJumpBtnActive,
                isDarkMode && { backgroundColor: colors.surfaceSubtle },
                isFutureBtn && { opacity: 0.35, backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
              ]}
              onPress={() => {
                setDisplayMinutes(btn.mins);
                setScrubberMinutes(btn.mins);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.quickJumpBtnText,
                  isActive && styles.quickJumpBtnTextActive,
                  { color: isDarkMode ? colors.textSecondary : '#475569' },
                  isFutureBtn && { color: isDarkMode ? '#64748B' : '#94A3B8' },
                ]}
              >
                {btn.label} {btn.time}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Highlighted Closest Vital Card */}
      {localClosestVital ? (
        <View style={[styles.highlightBox, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#3B82F6' }]}>
          <View style={styles.highlightHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location" size={15} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={[styles.highlightTitle, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
                Mốc đo thực tế: {localClosestVital._label || (() => {
                  const vitalTime = localClosestVital.recorded_at || localClosestVital.time || localClosestVital.created_at;
                  if (!vitalTime) return formatTimeHM(displayMinutes);
                  const d = new Date(vitalTime);
                  return !isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : formatTimeHM(displayMinutes);
                })()}
              </Text>
            </View>
            <View style={styles.highlightBadge}>
              <Text style={styles.highlightBadgeText}>
                {localClosestVital.activity_state || localClosestVital.activity || 'Sinh hoạt'}
              </Text>
            </View>
          </View>

          <View style={styles.highlightStatsGrid}>
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Nhịp tim</Text>
              <Text style={[styles.highlightStatVal, { color: '#EF4444' }]}>{localClosestVital.heart_rate ?? '--'} bpm</Text>
            </View>
            <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Oxy SpO₂</Text>
              <Text style={[styles.highlightStatVal, { color: '#0284C7' }]}>{localClosestVital.spo2 ?? '--'}%</Text>
            </View>
            <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Thân nhiệt</Text>
              <Text style={[styles.highlightStatVal, { color: '#D97706' }]}>{localClosestVital.body_temp ?? localClosestVital.skin_temp_max ?? '--'}°C</Text>
            </View>
            <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
            <View style={styles.highlightStatCol}>
              <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Âm thanh</Text>
              <Text style={[styles.highlightStatVal, { color: '#16A34A' }]}>{localClosestVital.sound_state || localClosestVital.sound || localClosestVital.acoustic_status || 'Bình thường'}</Text>
            </View>
          </View>
        </View>
      ) : isFutureScrubber ? (
        <View style={[styles.timelineEmptyBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0', paddingVertical: 14 }]}>
          <Ionicons name="time-outline" size={24} color="#94A3B8" style={{ marginBottom: 4 }} />
          <Text style={[styles.timelineEmptyTitle, { color: colors.textPrimary, fontSize: 13 }]}>
            Mốc thời gian chưa diễn ra ({formatTimeHM(displayMinutes)})
          </Text>
          <Text style={[styles.timelineEmptySub, { color: colors.textMuted, fontSize: 11 }]}>
            Thời gian hiện tại là {formatTimeHM(nowMinutes)}. Hệ thống chỉ hiển thị dữ liệu đo thực tế đã lưu trong cơ sở dữ liệu, không dự đoán số đo tương lai.
          </Text>
        </View>
      ) : hasData ? (
        <View style={[styles.timelineEmptyBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0', paddingVertical: 14 }]}>
          <Ionicons name="information-circle-outline" size={24} color="#94A3B8" style={{ marginBottom: 4 }} />
          <Text style={[styles.timelineEmptyTitle, { color: colors.textPrimary, fontSize: 13 }]}>
            Không có dữ liệu đo quanh mốc {formatTimeHM(displayMinutes)}
          </Text>
          <Text style={[styles.timelineEmptySub, { color: colors.textMuted, fontSize: 11 }]}>
            Không có số đo nào trong khoảng ±45 phút quanh mốc này (thiết bị có thể đang sạc pin hoặc chưa đeo).
          </Text>
        </View>
      ) : (
        !isLoadingVitals && (
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
});

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
  sliderTouchArea: {
    height: 38,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderMockTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#FFF',
    top: 7,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
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

