// ==============================================================================
// TỆP: HealthTimelineScrubber.tsx
// PHÂN HỆ: Thanh Tua Dòng Thời Gian Tương Tác (Interactive Timeline Scrubber)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Cho phép người dùng kéo thanh trượt hoặc bấm chọn nhanh các mốc giờ trong ngày
//     (Sáng 07:00, Trưa 12:00, Chiều 17:00, Tối 21:00).
//   - Hiển thị chi tiết bản ghi sinh hiệu gần nhất với thời điểm đang chọn (Nhịp tim,
//     SpO2, Nhiệt độ da, Âm thanh).
// ==============================================================================

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Platform, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { getTodayStr } from './health/useHealthTabConfig';
import { timelineScrubberStyles as styles } from './health/timelineScrubberStyles';
import { HealthTimelineVitalCard, formatTimeHM } from './health/HealthTimelineVitalCard';

const QUICK_JUMP_PRESETS = [
  { label: 'Sáng', time: '07:00', mins: 420 },
  { label: 'Trưa', time: '12:00', mins: 720 },
  { label: 'Chiều', time: '17:00', mins: 1020 },
  { label: 'Tối', time: '21:00', mins: 1260 },
] as const;

const FIXED_AXIS_LABELS = ['00:00', '06:00', '12:00', '18:00'] as const;

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
  const [isDebouncingSync, setIsDebouncingSync] = useState(false);
  const isDraggingRef = useRef(false);
  const pendingMinutesRef = useRef(scrubberMinutes);
  const rafIdRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trackRef = useRef<any>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const setScrubberMinutesRef = useRef(setScrubberMinutes);
  setScrubberMinutesRef.current = setScrubberMinutes;
  const maxScrubMinutesRef = useRef(maxScrubMinutes);
  maxScrubMinutesRef.current = maxScrubMinutes;
  const onScrubbingChangeRef = useRef(onScrubbingChange);
  onScrubbingChangeRef.current = onScrubbingChange;

  const commitScrubDebounced = useCallback((mins: number, delayMs = 1000) => {
    const safeMins = Number.isFinite(mins) ? Math.max(0, Math.min(mins, maxScrubMinutesRef.current)) : 0;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsDebouncingSync(true);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      setIsDebouncingSync(false);
      setScrubberMinutesRef.current?.(safeMins);
    }, delayMs);
  }, []);

  useEffect(() => {
    if (!isDraggingRef.current && !debounceTimerRef.current) {
      setDisplayMinutes(scrubberMinutes);
      pendingMinutesRef.current = scrubberMinutes;
    }
  }, [scrubberMinutes]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
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

  const calcMinutesFromLocationX = (rawLocX: any): number => {
    const w = trackWidthRef.current > 0 ? trackWidthRef.current : 280;
    if (typeof rawLocX !== 'number' || !Number.isFinite(rawLocX)) {
      return pendingMinutesRef.current;
    }
    const locX = Math.max(0, Math.min(w, rawLocX));
    const targetMins = Math.round(((locX / w) * 1439) / 5) * 5;
    return Math.max(0, Math.min(targetMins, maxScrubMinutesRef.current));
  };

  const panResponder = useMemo(() => {
    const finishScrub = (mins: number) => {
      isDraggingRef.current = false;
      onScrubbingChangeRef.current?.(false);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingMinutesRef.current = mins;
      setDisplayMinutes(mins);
      // Đợi 1 giây trước khi đồng bộ xuống biểu đồ/toàn trang để tránh giật hoặc crash trên Android
      commitScrubDebounced(mins, 1000);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dx) > 2,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = true;
        onScrubbingChangeRef.current?.(true);
        const clamped = calcMinutesFromLocationX(evt?.nativeEvent?.locationX);
        pendingMinutesRef.current = clamped;
        setDisplayMinutes(clamped);
      },
      onPanResponderMove: (evt) => {
        const clamped = calcMinutesFromLocationX(evt?.nativeEvent?.locationX);
        if (clamped !== pendingMinutesRef.current) {
          pendingMinutesRef.current = clamped;
          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = null;
              setDisplayMinutes(pendingMinutesRef.current);
            });
          }
        }
      },
      onPanResponderRelease: (evt) => {
        finishScrub(calcMinutesFromLocationX(evt?.nativeEvent?.locationX));
      },
      onPanResponderTerminate: () => {
        finishScrub(pendingMinutesRef.current);
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }, [commitScrubDebounced]);

  const currentScrub = Math.min(displayMinutes, maxScrubMinutes);
  const ratio = Math.max(0, Math.min(1, currentScrub / 1439));
  const progressPercent = `${ratio * 100}%` as `${number}%`;
  const thumbLeft = trackWidth > 0 ? Math.max(0, Math.min(trackWidth - 24, ratio * trackWidth - 12)) : 0;
  const axisLabels = [...FIXED_AXIS_LABELS, isToday ? `Hiện tại ${formatTimeHM(nowMinutes)}` : '23:59'];

  return (
    <View style={[styles.timelineCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.timelineHeader}>
        <View style={styles.timelineTitleRow}>
          <View style={styles.timelineIconDot}>
            <Ionicons name="time" size={15} color="#FFF" />
          </View>
          <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>
            Tua Dòng Thời Gian
          </Text>
        </View>
        <View style={styles.timeBadge}>
          <Ionicons name="stopwatch-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={styles.timeBadgeText}>
            {formatTimeHM(displayMinutes)}{isDebouncingSync ? ' • Đang tải...' : ''}
          </Text>
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
              if (w > 0) {
                trackWidthRef.current = w;
                setTrackWidth(w);
              }
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
              style={[styles.sliderMockThumb, { left: thumbLeft }]}
            />
          </View>
        )}

        {/* Time Axis Labels */}
        <View style={styles.sliderLabelsRow}>
          {axisLabels.map((lbl) => (
            <Text key={lbl} style={[styles.sliderLabelText, { color: colors.textMuted }]}>
              {lbl}
            </Text>
          ))}
        </View>
      </View>

      {/* Quick Jump Buttons */}
      <View style={styles.quickJumpRow}>
        {QUICK_JUMP_PRESETS.map((btn) => {
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
                const safe = Math.max(0, Math.min(btn.mins, maxScrubMinutes));
                pendingMinutesRef.current = safe;
                setDisplayMinutes(safe);
                commitScrubDebounced(safe, 800);
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
                {`${btn.label} ${btn.time}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Highlighted Closest Vital Card or Empty State */}
      <HealthTimelineVitalCard
        vital={localClosestVital}
        displayMinutes={displayMinutes}
        nowMinutes={nowMinutes}
        isFutureScrubber={isFutureScrubber}
        hasData={hasData}
        isLoadingVitals={isLoadingVitals}
        selectedDate={selectedDate}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </View>
  );
});

export default HealthTimelineScrubber;
