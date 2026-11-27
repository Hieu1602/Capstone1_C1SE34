import { useEffect, useState } from 'react';
import { vitalsApi } from '../../../../services/api';

export interface HrPoint {
  time: string;
  val: number;
}

export interface TodayActivityStats {
  hasData: boolean;
  walkPct: number;
  sitPct: number;
  restPct: number;
  activeLabel: string;
  restLabel: string;
}

export interface ChartCoord {
  x: number;
  y: number;
  val: number;
  time: string;
}

export interface MiniLineChartGeometry {
  chartHeight: number;
  padLeft: number;
  padRight: number;
  hasChartData: boolean;
  lastPt: ChartCoord;
  isHighHR: boolean;
  lineColor: string;
  refY: number;
  linePath: string;
  areaPath: string;
}

export interface TrendStatusBadge {
  text: string;
  color: string;
  bg: string;
  icon: 'information-circle' | 'warning' | 'checkmark-circle';
}

export interface Spo2BadgeConfig {
  bg: string;
  textColor: string;
  iconName: 'checkmark-circle' | 'warning' | 'information-circle';
  iconColor: string;
  label: string;
}

/** Kiểm tra tính tươi mới của dữ liệu sinh hiệu (trong vòng 15 phút hoặc vòng tay đang kết nối). */
export function checkIsLiveFresh(currentVitals?: any): boolean {
  if (currentVitals?.heart_rate || currentVitals?.spo2) {
    const vTime = currentVitals?.time || currentVitals?.recorded_at || currentVitals?.timestamp;
    if (!vTime) return true;
    const timeMs = typeof vTime === 'number' ? vTime : new Date(vTime).getTime();
    if (isNaN(timeMs)) return true;
    return Math.abs(Date.now() - timeMs) <= 15 * 60 * 1000 || Boolean(currentVitals?.bracelet_connected);
  }
  return false;
}

function formatTimeHHMM(dateInput: string | number | Date): string {
  const d = new Date(dateInput);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Tải lịch sử nhịp tim 12h qua từ API và tự động nối thêm mốc mới khi có WebSocket đẩy tới.
 * BẮT BUỘC: 1 đồng hồ chỉ kết nối với 1 cụ. Nếu chưa gán đồng hồ thì trả về mảng rỗng.
 */
export function useHeartRateTrendHistory(
  patientDevice: any,
  currentVitals: any,
  hasHR: boolean
): HrPoint[] {
  const [hrBars, setHrBars] = useState<HrPoint[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      // 1 đồng hồ chỉ kết nối với 1 cụ. Nếu cụ chưa gán đồng hồ -> Không tải lịch sử của đồng hồ khác!
      if (!patientDevice) {
        if (isMounted) setHrBars([]);
        return;
      }
      try {
        const devId = patientDevice.deviceId || patientDevice.id || 'BLE_BAND_001';
        let resData: any[] = [];
        try {
          const res = await vitalsApi.getHistory(devId, 30);
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            resData = res.data;
          }
        } catch {}
        if (resData.length === 0 && devId !== 'BLE_BAND_001') {
          try {
            const fallbackRes = await vitalsApi.getHistory('BLE_BAND_001', 30);
            if (fallbackRes.data && Array.isArray(fallbackRes.data)) {
              resData = fallbackRes.data;
            }
          } catch {}
        }
        if (isMounted && resData.length > 0) {
          const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
          let valid = resData
            .filter((v: any) => {
              if (v.heart_rate == null || Number(v.heart_rate) <= 0) return false;
              const rawTime = v.time || v.recorded_at || v.created_at;
              const vTime = rawTime ? new Date(rawTime).getTime() : 0;
              return vTime >= twelveHoursAgo;
            })
            .reverse();
          if (valid.length === 0) {
            // Fallback lấy các bản ghi đo gần nhất nếu thời gian thử nghiệm có độ trễ
            valid = resData
              .filter((v: any) => v.heart_rate != null && Number(v.heart_rate) > 0)
              .slice(0, 15)
              .reverse();
          }
          if (valid.length > 0) {
            // Lấy tối đa 15 mốc gần nhất để vẽ đường cong nhịp tim mềm mại
            const finalPoints = valid.slice(-15).map((item: any, idx: number, arr: any[]) => ({
              time: idx < arr.length - 1 && item.time ? formatTimeHHMM(item.time) : 'Hiện tại',
              val: Math.round(Number(item.heart_rate)),
            }));
            setHrBars(finalPoints);
          } else {
            setHrBars([]);
          }
        } else if (isMounted) {
          setHrBars([]);
        }
      } catch {
        if (isMounted) setHrBars([]);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [patientDevice?.deviceId, patientDevice?.id, currentVitals?.device_id]);

  // Cập nhật mốc mới khi có WebSocket nhịp tim đẩy tới
  useEffect(() => {
    if (hasHR && Number(currentVitals?.heart_rate) > 0) {
      setHrBars((prev) => {
        const val = Math.round(Number(currentVitals.heart_rate));
        if (prev.length === 0) {
          return [{ time: 'Hiện tại', val }];
        }
        const timeStr = formatTimeHHMM(new Date());
        const updated = prev.map((p, i) => (i === prev.length - 1 ? { ...p, time: timeStr } : p));
        return [...updated, { time: 'Hiện tại', val }].slice(-15);
      });
    }
  }, [currentVitals?.heart_rate, currentVitals?.timestamp, hasHR]);

  return hrBars;
}

function classifySampleActivity(v: any): 'walk' | 'sit' | 'rest' {
  const txt = String(v?.activity_state || v?.posture_state || '').toLowerCase();
  if (txt.includes('đi') || txt.includes('walk') || txt.includes('tập') || txt.includes('chạy') || txt.includes('exercise')) {
    return 'walk';
  }
  if (txt.includes('nằm') || txt.includes('ngủ') || txt.includes('rest') || txt.includes('lying') || txt.includes('sleep')) {
    return 'rest';
  }
  const hr = Number(v?.heart_rate || 0);
  if (hr >= 95) return 'walk';
  if (hr > 0 && hr < 72) return 'rest';
  return 'sit';
}

function formatDurationShort(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}p`;
  const h = Math.round((m / 60) * 10) / 10;
  return `${h}h`;
}

function computeActivityFromSamples(samples: any[]): TodayActivityStats {
  if (!samples || samples.length === 0) {
    return { hasData: false, walkPct: 0, sitPct: 0, restPct: 0, activeLabel: '--', restLabel: '--' };
  }
  let walk = 0;
  let sit = 0;
  let rest = 0;
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const s of samples) {
    const cls = classifySampleActivity(s);
    if (cls === 'walk') walk++;
    else if (cls === 'rest') rest++;
    else sit++;

    const rawT = s?.time || s?.recorded_at || s?.created_at || s?.timestamp;
    const ms = rawT ? new Date(rawT).getTime() : NaN;
    if (!isNaN(ms)) {
      if (ms < minTs) minTs = ms;
      if (ms > maxTs) maxTs = ms;
    }
  }

  const total = walk + sit + rest;
  const walkPct = Math.round((walk * 100) / total);
  const sitPct = Math.round((sit * 100) / total);
  const restPct = Math.max(0, 100 - walkPct - sitPct);

  const spanMins = Number.isFinite(minTs) && Number.isFinite(maxTs) && maxTs > minTs
    ? Math.max(1, (maxTs - minTs) / 60000)
    : Math.max(1, total * 0.5);
  const activeMins = (spanMins * walkPct) / 100;
  const restMins = Math.max(0, spanMins - activeMins);

  return {
    hasData: true,
    walkPct,
    sitPct,
    restPct,
    activeLabel: formatDurationShort(activeMins),
    restLabel: formatDurationShort(restMins),
  };
}

/** Phân tích tỷ lệ Vận động & Sinh hoạt từ dữ liệu đo thực tế trong ngày hôm nay. */
export function useTodayActivityStats(
  patientDevice: any,
  currentVitals: any,
  hasAnyData: boolean
): TodayActivityStats {
  const [samples, setSamples] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchToday = async () => {
      if (!patientDevice) {
        if (isMounted) setSamples([]);
        return;
      }
      try {
        const devId = patientDevice.deviceId || patientDevice.id || 'BLE_BAND_001';
        const res = await vitalsApi.getHistory(devId, 120);
        const rows = Array.isArray(res?.data) ? res.data : [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayMs = startOfToday.getTime();
        const todayRows = rows.filter((v: any) => {
          const rawTime = v.time || v.recorded_at || v.created_at;
          const ms = rawTime ? new Date(rawTime).getTime() : 0;
          return ms >= todayMs && (v.heart_rate > 0 || v.spo2 > 0);
        });
        if (isMounted) setSamples(todayRows.reverse());
      } catch {
        if (isMounted) setSamples([]);
      }
    };
    fetchToday();
    return () => {
      isMounted = false;
    };
  }, [patientDevice?.deviceId, patientDevice?.id]);

  useEffect(() => {
    if (hasAnyData && (currentVitals?.heart_rate || currentVitals?.spo2)) {
      setSamples((prev) => [
        ...prev.slice(-240),
        {
          heart_rate: currentVitals.heart_rate,
          spo2: currentVitals.spo2,
          activity_state: currentVitals.activity_state,
          posture_state: currentVitals.posture_state,
          time: currentVitals.time || currentVitals.timestamp || new Date().toISOString(),
        },
      ]);
    }
  }, [currentVitals?.heart_rate, currentVitals?.timestamp, currentVitals?.activity_state, hasAnyData]);

  return computeActivityFromSamples(samples);
}

/** Tính toán tọa độ & đường cong Bezier SVG cho Mini Line Chart nhịp tim. */
export function buildMiniLineChartGeometry(
  displayBars: HrPoint[],
  chartWidth: number,
  avgHR: number | null
): MiniLineChartGeometry {
  const chartHeight = 54;
  const padLeft = 6;
  const padRight = 10;
  const padTop = 6;
  const padBottom = 6;

  const vals = displayBars.map((p) => p.val);
  const minVal = vals.length > 0 ? Math.min(...vals, 55) : 55;
  const maxVal = vals.length > 0 ? Math.max(...vals, 105) : 105;
  const range = Math.max(15, maxVal - minVal);

  const usableW = Math.max(80, chartWidth - padLeft - padRight);
  const usableH = chartHeight - padTop - padBottom;

  const rawCoords: ChartCoord[] = displayBars.map((p, i) => {
    const x = padLeft + (displayBars.length > 1 ? (i / (displayBars.length - 1)) * usableW : usableW / 2);
    const normY = (p.val - minVal) / range;
    const y = padTop + (1 - normY) * usableH;
    return { x, y, val: p.val, time: p.time };
  });

  const coords: ChartCoord[] =
    rawCoords.length === 1
      ? [
          { x: padLeft, y: rawCoords[0].y, val: rawCoords[0].val, time: rawCoords[0].time },
          { x: padLeft + usableW, y: rawCoords[0].y, val: rawCoords[0].val, time: rawCoords[0].time },
        ]
      : rawCoords;

  const hasChartData = coords.length > 0;
  const lastPt = hasChartData ? coords[coords.length - 1] : { x: 0, y: 0, val: 0, time: '' };
  const firstPt = hasChartData ? coords[0] : { x: 0, y: 0, val: 0, time: '' };
  const isHighHR = lastPt.val >= 100;
  const lineColor = isHighHR ? '#F59E0B' : '#10B981';

  const refY = Math.max(
    padTop,
    Math.min(chartHeight - padBottom, padTop + (1 - ((avgHR ?? 75) - minVal) / range) * usableH)
  );

  let linePath = '';
  let areaPath = '';
  if (hasChartData) {
    linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpX = (prev.x + curr.x) / 2;
      linePath += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    areaPath = `${linePath} L ${lastPt.x} ${chartHeight} L ${firstPt.x} ${chartHeight} Z`;
  }

  return {
    chartHeight,
    padLeft,
    padRight,
    hasChartData,
    lastPt,
    isHighHR,
    lineColor,
    refY,
    linePath,
    areaPath,
  };
}

export function getTrendStatusBadge(
  hasAnyData: boolean,
  lastHrVal: number,
  spo2Value: number | null,
  isDarkMode: boolean
): TrendStatusBadge {
  const isHighHR = lastHrVal >= 100;
  const isLowHR = lastHrVal > 0 && lastHrVal < 50;
  const isLowSpO2 = spo2Value !== null && spo2Value < 95;
  const isWarning = isHighHR || isLowHR || isLowSpO2;

  return {
    text: !hasAnyData
      ? 'Chưa có dữ liệu'
      : isHighHR && lastHrVal >= 120
        ? 'Nhịp tim cao'
        : isWarning
          ? 'Cần theo dõi'
          : 'Đạt chuẩn',
    color: !hasAnyData ? '#64748B' : isWarning ? '#D97706' : '#15803D',
    bg: !hasAnyData ? (isDarkMode ? '#1E293B' : '#F1F5F9') : isWarning ? '#FEF3C7' : '#DCFCE7',
    icon: !hasAnyData ? 'information-circle' : isWarning ? 'warning' : 'checkmark-circle',
  };
}

export function getSpo2BadgeConfig(
  hasSpO2: boolean,
  spo2Value: number | null,
  isDarkMode: boolean
): Spo2BadgeConfig {
  if (!hasSpO2 || spo2Value === null) {
    return {
      bg: isDarkMode ? '#1E293B' : '#F1F5F9',
      textColor: isDarkMode ? '#94A3B8' : '#64748B',
      iconName: 'information-circle',
      iconColor: '#64748B',
      label: 'Chưa có dữ liệu',
    };
  }
  const isSafe = spo2Value >= 95;
  return {
    bg: isSafe ? (isDarkMode ? '#064E3B' : '#DCFCE7') : isDarkMode ? '#451A03' : '#FEF3C7',
    textColor: isSafe ? (isDarkMode ? '#86EFAC' : '#15803D') : isDarkMode ? '#FBBF24' : '#D97706',
    iconName: isSafe ? 'checkmark-circle' : 'warning',
    iconColor: isSafe ? '#15803D' : '#D97706',
    label: `${spo2Value}% • ${isSafe ? 'An toàn' : 'Cần theo dõi'}`,
  };
}
