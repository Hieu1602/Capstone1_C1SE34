/**
 * HealthDetailScreen.tsx
 * Màn hình Chi tiết Tình trạng Sức khỏe & Chỉ số Sinh hiệu người cao tuổi
 * Hệ thống Smart Elderly Care AI – Tích hợp Lọc dữ liệu theo ngày & Tua dòng thời gian (Interactive Timeline)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTheme } from '../../../store/useThemeStore';
import { vitalsApi, patientApi } from '../../../services/api';

// Subcomponents đã được module hoá
import { HealthTimelineScrubber } from '../components/HealthTimelineScrubber';
import { HealthVitalsGrid } from '../components/HealthVitalsGrid';
import { HealthChartSection } from '../components/HealthChartSection';
import { HealthDatePickerModal } from '../components/HealthDatePickerModal';
import { HealthOverallBanner } from '../components/health/HealthOverallBanner';
import { HealthDateFilterBar } from '../components/health/HealthDateFilterBar';
import { HealthSensorStatusCard } from '../components/health/HealthSensorStatusCard';
import { HealthAiAdviceCard } from '../components/health/HealthAiAdviceCard';
import { HealthMedicalRecordLink } from '../components/health/HealthMedicalRecordLink';
import {
  TimeRange,
  formatDateYMD,
  formatDisplayDateVN,
  getTodayStr,
  getYesterdayStr,
  getDaysAgoStr,
  computeHealthTabConfig,
} from '../components/health/useHealthTabConfig';

export default function HealthDetailScreen({ navigation, route }: any) {
  const { isDarkMode, colors } = useTheme();
  const metric = (route?.params?.focusMetric ?? route?.params?.metric) as 'heartRate' | 'activity' | 'spo2' | undefined;
  const initialTab = route?.params?.initialTab as 'today' | 'week' | 'month' | undefined;
  const {
    currentVitals,
    fetchVitals,
    patientsList,
    fetchPatientsList,
    activePatientId,
    setActivePatientId,
    iotDevices,
  } = useVitalStore();

  const initialPatientId =
    route?.params?.patientId ||
    activePatientId ||
    (patientsList && patientsList[0]?.id) ||
    undefined;
  const [selectedPatientId, setSelectedPatientId] = useState<any>(initialPatientId);

  useEffect(() => {
    if (!patientsList || patientsList.length === 0) {
      fetchPatientsList?.();
    }
  }, [fetchPatientsList, patientsList]);

  const currentPatient =
    (patientsList || []).find(
      (p: any) => p.id == selectedPatientId || p.elderly_id == selectedPatientId
    ) ||
    (patientsList && patientsList.length > 0 ? patientsList[0] : null);

  const patientDisplayName =
    currentPatient?.full_name ||
    currentPatient?.name ||
    route?.params?.patientName ||
    '';

  // Chuẩn hóa tên (bỏ dấu tiếng Việt, chữ thường)
  const normalizeStr = (s: any) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

  // Kiểm tra phần cứng Smartband / Watch
  const isSmartbandDevice = (d: any) => {
    if (!d) return false;
    const type = String(d.type || '').toLowerCase();
    const icon = String(d.icon || '').toLowerCase();
    const name = String(d.name || '').toLowerCase();
    const devType = String(d.device_type || '').toLowerCase();
    return (
      type === 'watch' ||
      type === 'smartband' ||
      type === 'band' ||
      icon === 'watch' ||
      devType.includes('band') ||
      devType.includes('watch') ||
      name.includes('smartband') ||
      name.includes('vòng') ||
      name.includes('đồng hồ')
    );
  };

  // Thiết bị vòng tay được gán cho người cao tuổi này (nếu có)
  // BẮT BUỘC: 1 đồng hồ chỉ kết nối với 1 cụ duy nhất. Cụ chưa gán vòng -> null
  const assignedBand = useMemo(() => {
    const pName = normalizeStr(patientDisplayName);
    const pId = String(selectedPatientId || currentPatient?.id || currentPatient?.elderly_id || '');

    const bands = (iotDevices || []).filter(isSmartbandDevice);
    if (bands.length === 0) return null;

    // 1. Khớp theo ID người cao tuổi
    const matchById = bands.find((d: any) => {
      if (d.elderly_id && pId && String(d.elderly_id).toLowerCase() === pId.toLowerCase()) {
        return true;
      }
      return false;
    });
    if (matchById) return matchById;

    // 2. Khớp theo tên người đeo (wearer_name)
    if (pName) {
      const matchByName = bands.find((d: any) => {
        if (d.wearer_name && normalizeStr(d.wearer_name) === pName) {
          return true;
        }
        return false;
      });
      if (matchByName) return matchByName;
    }

    // 3. Fallback cho người cao tuổi đầu tiên (nếu có vòng chưa gán trong nhà)
    const isFirstPatient =
      (!patientsList || patientsList.length === 0) ||
      (patientsList[0]?.id && String(patientsList[0].id) === pId);

    if (isFirstPatient && bands.length > 0) {
      const candidate = bands.find((d: any) => {
        if (!d.wearer_name && !d.elderly_id) return true;
        if (d.wearer_name && pName && normalizeStr(d.wearer_name) === pName) return true;
        return false;
      });
      return candidate || (bands.length === 1 && !bands[0].wearer_name ? bands[0] : null);
    }

    return null;
  }, [iotDevices, selectedPatientId, currentPatient, patientDisplayName, patientsList]);

  const effectiveDevId = assignedBand ? (assignedBand.deviceId || assignedBand.id || 'BLE_BAND_001') : null;

  const { permissions, userRole, role } = useAuthStore();
  const isOwnerOrAdmin =
    userRole === 'admin' ||
    role === 'admin' ||
    userRole === 'owner' ||
    role === 'owner' ||
    permissions?.is_owner === true ||
    permissions?.role_in_house === 'OWNER';
  const canViewHealth = isOwnerOrAdmin || Boolean(permissions?.can_view_health);

  useEffect(() => {
    if (!canViewHealth) {
      Alert.alert('Không có quyền truy cập', 'Chủ hộ đã tắt quyền xem chỉ số sức khỏe đối với tài khoản này.');
      navigation.goBack();
    }
  }, [canViewHealth, navigation]);

  const [selectedRange, setSelectedRange] = useState<TimeRange>(
    initialTab === 'week' ? 'WEEK' : initialTab === 'month' ? 'MONTH' : 'DAY'
  );
  const [highlightedMetric, setHighlightedMetric] = useState<string | null>(metric ?? null);
  const scrollRef = useRef<any>(null);

  // 1. Quản lý Lọc dữ liệu theo ngày (Date Filter)
  const dateOptions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const twoDaysAgo = new Date(Date.now() - 86400000 * 2);
    const threeDaysAgo = new Date(Date.now() - 86400000 * 3);

    return [
      { label: 'Hôm nay', sub: `${today.getDate()}/${today.getMonth() + 1}`, value: formatDateYMD(today) },
      { label: 'Hôm qua', sub: `${yesterday.getDate()}/${yesterday.getMonth() + 1}`, value: formatDateYMD(yesterday) },
      { label: '2 ngày trước', sub: `${twoDaysAgo.getDate()}/${twoDaysAgo.getMonth() + 1}`, value: formatDateYMD(twoDaysAgo) },
      { label: '3 ngày trước', sub: `${threeDaysAgo.getDate()}/${threeDaysAgo.getMonth() + 1}`, value: formatDateYMD(threeDaysAgo) },
    ];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateYMD(new Date()));
  const [dayVitals, setDayVitals] = useState<any[]>([]);
  const [rangeVitals, setRangeVitals] = useState<any[]>([]);
  const [isLoadingVitals, setIsLoadingVitals] = useState(false);
  const [isCalendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarInputDraft, setCalendarInputDraft] = useState(selectedDate);

  const isCustomDate = useMemo(() => {
    return !dateOptions.some((opt) => opt.value === selectedDate);
  }, [dateOptions, selectedDate]);

  // 2. Quản lý Tua dòng thời gian (Interactive Timeline Scrubber)
  const [scrubberMinutes, setScrubberMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const [isScrubbingTimeline, setIsScrubbingTimeline] = useState(false);

  // Tải dữ liệu từ Backend khi chọn ngày
  // QUY TẮC: 1 đồng hồ chỉ kết nối với 1 cụ. Nếu cụ chưa gán đồng hồ -> dữ liệu rỗng.
  const loadDateVitals = async (dateStr: string) => {
    setIsLoadingVitals(true);
    try {
      let vitals: any[] = [];
      // Chỉ gọi lấy lịch sử khi cụ này CÓ đồng hồ thông minh gán riêng cho mình
      if (effectiveDevId) {
        try {
          const res = await vitalsApi.getHistory(effectiveDevId, 300, dateStr);
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            vitals = res.data;
          }
        } catch (err) {
          console.warn('Lỗi vitalsApi.getHistory, fallback patientApi:', err);
        }
      }

      // Nếu có đồng hồ nhưng chưa tải được, thử tải qua API bệnh nhân
      if (vitals.length === 0 && selectedPatientId && effectiveDevId) {
        const fbRes = await patientApi.getVitals(selectedPatientId, dateStr).catch(() => ({ data: [] }));
        if (fbRes.data && Array.isArray(fbRes.data) && fbRes.data.length > 0) {
          vitals = fbRes.data;
        }
      }

      setDayVitals(vitals);
      if (vitals.length > 0) {
        if (dateStr === getTodayStr()) {
          const now = new Date();
          setScrubberMinutes(now.getHours() * 60 + now.getMinutes());
        } else {
          const last = vitals[vitals.length - 1];
          const rawDate = last?.recorded_at || last?.time || last?.created_at;
          if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              setScrubberMinutes(d.getHours() * 60 + d.getMinutes());
            }
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu sinh hiệu ngày:', e);
      setDayVitals([]);
    } finally {
      setIsLoadingVitals(false);
    }
  };

  // Cập nhật real-time dữ liệu biểu đồ khi có bản tin WebSocket mới đổ về
  useEffect(() => {
    // 1 đồng hồ chỉ kết nối 1 cụ: Chỉ nhận bản tin WebSocket nếu cụ CÓ vòng tay và gói tin từ đúng vòng tay đó
    if (!assignedBand) return;

    if (selectedDate === getTodayStr() && currentVitals?.heart_rate && Number(currentVitals.heart_rate) > 0) {
      const vDevId = (currentVitals as any)?.device_id;
      if (vDevId && vDevId !== assignedBand.deviceId && vDevId !== assignedBand.id) {
        return; // Gói tin của vòng tay cụ khác -> Bỏ qua
      }
      const vTime = (currentVitals as any)?.time || (currentVitals as any)?.recorded_at || currentVitals?.timestamp;
      const timeMs = vTime ? (typeof vTime === 'number' ? vTime : new Date(vTime).getTime()) : 0;
      // Chỉ tự động cập nhật biểu đồ hôm nay nếu bản ghi mới nhận trong vòng 2 phút
      if (timeMs && Math.abs(Date.now() - timeMs) > 2 * 60 * 1000) {
        return;
      }
      setDayVitals((prev) => {
        const now = new Date();
        const newRecord = {
          id: `live_${Date.now()}`,
          time: now.toISOString(),
          recorded_at: now.toISOString(),
          heart_rate: currentVitals.heart_rate,
          spo2: currentVitals.spo2,
          body_temp: currentVitals.skin_temp_max,
          skin_temp_max: currentVitals.skin_temp_max,
          fall_detected: currentVitals.fall_detected,
          activity_state: (currentVitals as any)?.activity_state || 'Sinh hoạt',
        };
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const lastTime = new Date(last.time || last.recorded_at).getTime();
          if (now.getTime() - lastTime < 3000) {
            return [...prev.slice(0, -1), newRecord];
          }
        }
        return [...prev, newRecord].slice(-100);
      });
    }
  }, [currentVitals?.heart_rate, currentVitals?.spo2, currentVitals?.timestamp, selectedDate, assignedBand]);

  // Tải dữ liệu lịch sử cho Tuần / Tháng từ Backend sử dụng Daily Summary
  const loadRangeVitals = async (days: number) => {
    setIsLoadingVitals(true);
    try {
      if (!effectiveDevId) {
        // Cụ chưa được gán đồng hồ -> dữ liệu tuần/tháng rỗng
        setRangeVitals([]);
        return;
      }
      const devId = effectiveDevId;
      const res = await vitalsApi.getDailySummary(days, devId).catch(() => ({ data: [] }));
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setRangeVitals(res.data);
      } else {
        const fb = await vitalsApi.getHistory(devId, days * 20).catch(() => ({ data: [] }));
        setRangeVitals(fb.data && Array.isArray(fb.data) ? fb.data : []);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu lịch sử tuần/tháng:', e);
      setRangeVitals([]);
    } finally {
      setIsLoadingVitals(false);
    }
  };

  useEffect(() => {
    fetchVitals();
  }, []);

  useEffect(() => {
    if (selectedRange === 'DAY') {
      loadDateVitals(selectedDate);
    } else {
      loadRangeVitals(selectedRange === 'WEEK' ? 7 : 30);
    }
  }, [selectedDate, selectedRange, selectedPatientId, effectiveDevId]);

  useEffect(() => {
    if (initialTab) {
      if (initialTab === 'today') setSelectedRange('DAY');
      else if (initialTab === 'week') setSelectedRange('WEEK');
      else if (initialTab === 'month') setSelectedRange('MONTH');
    }
    if (metric) {
      setHighlightedMetric(metric);
      const timer = setTimeout(() => {
        if (metric === 'heartRate' || metric === 'spo2') {
          scrollRef.current?.scrollTo({ y: 140, animated: true });
        } else if (metric === 'activity') {
          scrollRef.current?.scrollTo({ y: 220, animated: true });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [metric, initialTab]);

  const acousticStatus = currentVitals.acoustic_status ?? 'Bình thường';
  const isCurrentMatching = Boolean(
    assignedBand &&
    (currentVitals as any)?.device_id &&
    (
      String((currentVitals as any)?.device_id).toLowerCase() === String(assignedBand.deviceId || '').toLowerCase() ||
      String((currentVitals as any)?.device_id).toLowerCase() === String(assignedBand.id || '').toLowerCase()
    ) &&
    currentVitals.bracelet_connected !== false
  );
  const batteryDisplay = assignedBand
    ? (isCurrentMatching && currentVitals.bracelet_battery !== null && currentVitals.bracelet_battery !== undefined
        ? `${currentVitals.bracelet_battery}%`
        : (assignedBand.isOnline ? `${(assignedBand as any).batteryLevel || 85}%` : 'Ngoại tuyến'))
    : 'Chưa gán vòng';
  const isFallDetected = Boolean(isCurrentMatching && currentVitals.fall_detected);

  const handleRefresh = async () => {
    await fetchVitals();
    if (selectedRange === 'DAY') {
      await loadDateVitals(selectedDate);
    } else {
      await loadRangeVitals(selectedRange === 'WEEK' ? 50 : 100);
    }
    Alert.alert('Đồng bộ thành công', 'Dữ liệu sức khỏe từ Hub và vòng đeo tay đã được làm mới.');
  };

  // Tối ưu hóa: Tiền xử lý thời gian (phút trong ngày) một lần duy nhất khi danh sách dayVitals thay đổi
  const parsedDayVitals = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return [];
    return dayVitals.map((v) => {
      const rawDate = v.recorded_at || v.time || v.created_at;
      const d = rawDate ? new Date(rawDate) : null;
      const isValid = Boolean(d && !isNaN(d.getTime()));
      return {
        ...v,
        _minutes: isValid && d ? d.getHours() * 60 + d.getMinutes() : -1,
        _label: isValid && d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '--:--',
      };
    });
  }, [dayVitals]);

  // Tìm mốc đo gần nhất với giờ tua (chỉ so khớp số phút nguyên đã tiền xử lý, tránh tính lại Date khi kéo thanh trượt)
  const closestVital = useMemo(() => {
    const isToday = selectedDate === getTodayStr();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Nếu đang xem hôm nay mà tua vào thời điểm tương lai -> chưa có dữ liệu
    if (isToday && scrubberMinutes > nowMinutes) {
      return null;
    }

    let best: any = null;
    let minDiff = 999999;
    if (parsedDayVitals && parsedDayVitals.length > 0) {
      for (let i = 0; i < parsedDayVitals.length; i++) {
        const v = parsedDayVitals[i];
        const vMinutes = v._minutes;
        if (vMinutes < 0) continue;

        // Nếu là hôm nay, không chấp nhận bản ghi tương lai
        if (isToday && vMinutes > nowMinutes) continue;

        const diff = Math.abs(vMinutes - scrubberMinutes);
        // Gắn kết nếu bản ghi nằm trong khoảng +-180 phút (3 tiếng) quanh giờ tua
        if (diff < minDiff && diff <= 180) {
          minDiff = diff;
          best = v;
        }
      }
      // Nếu là ngày trong quá khứ có dữ liệu mà chưa khớp nấc tua thì chọn bản ghi gần nhất trong ngày
      if (!best && !isToday && parsedDayVitals.length > 0) {
        best = parsedDayVitals[parsedDayVitals.length - 1];
      }
    }

    // Nếu đang xem hôm nay và giờ tua gần giờ hiện tại (trong vòng 60 phút) mà lịch sử chưa có mốc gần,
    // chỉ dùng giá trị sinh hiệu real-time từ WebSocket nếu bản tin THỰC SỰ MỚI (trong vòng 2 phút)
    // và thiết bị đang kết nối. Tuyệt đối không lấy dữ liệu cũ từ phiên hôm trước gán vào mốc hiện tại!
    const isLiveFresh = (() => {
      if (!assignedBand) return false; // Cụ chưa gán vòng -> không gán sinh hiệu real-time
      if (!currentVitals?.heart_rate) return false;
      if (currentVitals.bracelet_connected === false) return false;
      const curDev = String((currentVitals as any)?.device_id || '').toLowerCase();
      const assDev = String(assignedBand.deviceId || (assignedBand as any).device_id || assignedBand.id || '').toLowerCase();
      if (!curDev || !assDev || (curDev !== assDev && !curDev.includes(assDev) && !assDev.includes(curDev))) {
        return false; // Vòng tay của cụ khác đang phát, không phải của cụ này!
      }
      const vTime = (currentVitals as any)?.time || (currentVitals as any)?.recorded_at || currentVitals?.timestamp;
      if (!vTime) return false;
      const timeMs = typeof vTime === 'number' ? vTime : new Date(vTime).getTime();
      if (isNaN(timeMs)) return false;
      return Math.abs(Date.now() - timeMs) <= 2 * 60 * 1000;
    })();

    if (!best && isToday && Math.abs(scrubberMinutes - nowMinutes) <= 60 && isLiveFresh) {
      return {
        id: 'realtime_live',
        time: now.toISOString(),
        recorded_at: now.toISOString(),
        heart_rate: currentVitals.heart_rate,
        spo2: currentVitals.spo2,
        body_temp: currentVitals.skin_temp_max,
        skin_temp_max: currentVitals.skin_temp_max,
        fall_detected: currentVitals.fall_detected,
        activity_state: (currentVitals as any)?.activity_state || 'Sinh hoạt',
        sound_state: (currentVitals as any)?.acoustic_status || 'Bình thường',
      };
    }

    return best;
  }, [parsedDayVitals, scrubberMinutes, selectedDate, currentVitals, assignedBand]);

  // Dữ liệu biểu đồ động theo ngày được chọn (sử dụng cache tiền xử lý và giới hạn tối đa 30 điểm để 60fps mượt mà)
  const chartDataForDay = useMemo(() => {
    if (!parsedDayVitals || parsedDayVitals.length === 0) return [];

    const step = Math.max(1, Math.ceil(parsedDayVitals.length / 30));
    const sampled: any[] = [];
    for (let i = 0; i < parsedDayVitals.length; i += step) {
      sampled.push(parsedDayVitals[i]);
    }
    const lastItem = parsedDayVitals[parsedDayVitals.length - 1];
    if (sampled[sampled.length - 1]?.id !== lastItem?.id) {
      sampled.push(lastItem);
    }

    return sampled.map((v) => ({
      id: v.id,
      label: v._label,
      hr: v.heart_rate,
      spo2: v.spo2,
      temp: v.body_temp ?? v.skin_temp_max,
      activity: v.activity || v.activity_state || 'Sinh hoạt',
      minute: v._minutes >= 0 ? v._minutes : 0,
    }));
  }, [parsedDayVitals]);

  // Nhịp tim trung bình trong ngày thực tế
  const dailyAvgHR = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return '--';
    const valid = dayVitals.filter((v) => typeof v.heart_rate === 'number');
    if (valid.length === 0) return '--';
    const sum = valid.reduce((acc, cur) => acc + cur.heart_rate, 0);
    return `${Math.round(sum / valid.length)} bpm`;
  }, [dayVitals]);

  // Dữ liệu biểu đồ và tính toán trung bình cho Tuần / Tháng (hỗ trợ cả getDailySummary và raw vitals)
  const weekData = useMemo(() => {
    const list = rangeVitals && Array.isArray(rangeVitals) && rangeVitals.length > 0 ? rangeVitals : [];
    const validHR = list.map((v) => v.heartRate ?? v.heart_rate).filter((h) => typeof h === 'number' && h > 0);
    const validSpO2 = list.map((v) => v.spo2).filter((s) => typeof s === 'number' && s > 0);
    const validTemp = list.map((v) => v.temperature ?? v.body_temp ?? v.skin_temp_max).filter((t) => typeof t === 'number' && t > 0);

    const avgHR = validHR.length > 0 ? (validHR.reduce((a, b) => a + b, 0) / validHR.length).toFixed(1) : '--';
    const avgSpO2 = validSpO2.length > 0 ? Math.round(validSpO2.reduce((a, b) => a + b, 0) / validSpO2.length).toString() : '--';
    const avgTemp = validTemp.length > 0 ? (validTemp.reduce((a, b) => a + b, 0) / validTemp.length).toFixed(1) : '--';

    const chart = list.map((v) => {
      let label = '';
      if (v.date) {
        const parts = String(v.date).split('-');
        label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : String(v.date);
      } else {
        const rawDate = v.recorded_at || v.time || v.created_at;
        const d = rawDate ? new Date(rawDate) : new Date();
        label = `${d.getDate()}/${d.getMonth() + 1}`;
      }
      return {
        label,
        hr: v.heartRate ?? v.heart_rate ?? 0,
      };
    });

    return { avgHR, avgSpO2, avgTemp, chart };
  }, [rangeVitals]);

  // Cấu hình tab theo mốc thời gian được chọn
  const currentTabConfig = useMemo(() => {
    return computeHealthTabConfig({
      selectedRange,
      weekData,
      isFallDetected,
      dayVitals,
      closestVital,
      selectedDate,
      scrubberMinutes,
      dailyAvgHR,
      chartDataForDay,
    });
  }, [
    selectedRange,
    weekData,
    isFallDetected,
    dayVitals,
    closestVital,
    selectedDate,
    scrubberMinutes,
    dailyAvgHR,
    chartDataForDay,
  ]);

  const hasData = dayVitals && dayVitals.length > 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header có nút Back, Tên người cao tuổi & Nút Refresh */}
      <View style={[styles.headerBar, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {patientDisplayName}
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
            Chỉ số sinh tồn & Bệnh án{currentPatient?.age ? ` • ${currentPatient.age} tuổi` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        scrollEnabled={!isScrubbingTimeline}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bộ chọn người cao tuổi khi gia đình có từ 2-3 người trở lên */}
        {patientsList && patientsList.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.patientChipsRow}
          >
            {patientsList.map((p: any) => {
              const pId = p.id || p.elderly_id;
              const isSelected = pId == selectedPatientId;
              return (
                <TouchableOpacity
                  key={pId}
                  style={[
                    styles.patientChip,
                    isSelected
                      ? styles.patientChipActive
                      : [styles.patientChipInactive, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }],
                  ]}
                  onPress={() => {
                    setSelectedPatientId(pId);
                    setActivePatientId?.(pId);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="person"
                    size={13}
                    color={isSelected ? '#FFFFFF' : (isDarkMode ? '#94A3B8' : '#64748B')}
                  />
                  <Text
                    style={[
                      styles.patientChipText,
                      isSelected
                        ? styles.patientChipTextActive
                        : { color: isDarkMode ? '#CBD5E1' : '#475569' },
                    ]}
                  >
                    {p.full_name || p.name || 'Người cao tuổi'}
                    {p.age ? ` (${p.age}t)` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Thông báo nếu người cao tuổi này chưa được gán vòng tay */}
        {!assignedBand && (
          <View style={[styles.unassignedBandBanner, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
            <Ionicons name="information-circle" size={20} color="#F59E0B" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.unassignedBandTitle, isDarkMode && { color: '#FBBF24' }]}>
                Chưa gán vòng đeo tay thông minh
              </Text>
              <Text style={[styles.unassignedBandText, isDarkMode && { color: '#CBD5E1' }]}>
                {patientDisplayName} chưa được liên kết với vòng tay BLE nào. Để theo dõi nhịp tim và SpO₂, hãy gán vòng tay trong mục Quản lý thiết bị hoặc chuyển người đeo ở chi tiết Smartband.
              </Text>
            </View>
          </View>
        )}

        {/* 2. Banner Tình trạng Tổng quan */}
        <HealthOverallBanner
          bannerAlert={currentTabConfig.bannerAlert}
          bannerIcon={currentTabConfig.bannerIcon}
          bannerTitle={currentTabConfig.bannerTitle}
          bannerSubtitle={currentTabConfig.bannerSubtitle}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 3. Bộ lọc dải thời gian (Theo ngày / 7 ngày qua / 30 ngày) */}
        <View style={[styles.rangeSelector, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
          {(['DAY', 'WEEK', 'MONTH'] as const).map((range) => {
            const isActive = selectedRange === range;
            const labels: Record<TimeRange, string> = {
              DAY: 'Theo ngày',
              WEEK: '7 ngày qua',
              MONTH: '30 ngày',
            };
            return (
              <TouchableOpacity
                key={range}
                style={[
                  styles.rangePill,
                  isActive && styles.rangePillActive,
                  isActive && isDarkMode && { backgroundColor: colors.card },
                ]}
                onPress={() => setSelectedRange(range)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.rangePillText,
                    isActive && styles.rangePillTextActive,
                    isActive && { color: colors.textPrimary },
                    !isActive && isDarkMode && { color: colors.textSecondary },
                  ]}
                >
                  {labels[range]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. Bộ chọn ngày */}
        {selectedRange === 'DAY' && (
          <HealthDateFilterBar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            dateOptions={dateOptions}
            isCustomDate={isCustomDate}
            isLoadingVitals={isLoadingVitals}
            hasDayVitals={hasData}
            formatDisplayDateVN={formatDisplayDateVN}
            formatDateYMD={formatDateYMD}
            onOpenCalendarModal={() => {
              setCalendarInputDraft(selectedDate);
              setCalendarModalVisible(true);
            }}
            isDarkMode={isDarkMode}
            colors={colors}
          />
        )}

        {/* 5. Thanh tua dòng thời gian */}
        {selectedRange === 'DAY' && (
          <HealthTimelineScrubber
            scrubberMinutes={scrubberMinutes}
            setScrubberMinutes={setScrubberMinutes}
            closestVital={closestVital}
            parsedDayVitals={parsedDayVitals}
            isLoadingVitals={isLoadingVitals}
            hasData={hasData}
            selectedDate={selectedDate}
            isDarkMode={isDarkMode}
            colors={colors}
            onScrubbingChange={setIsScrubbingTimeline}
          />
        )}

        {/* 6. Lưới 4 thẻ chỉ số sinh hiệu */}
        <HealthVitalsGrid
          card1={currentTabConfig.card1}
          card2={currentTabConfig.card2}
          card3={currentTabConfig.card3}
          card4={currentTabConfig.card4}
          highlightedMetric={highlightedMetric}
          setHighlightedMetric={setHighlightedMetric}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 7. Biểu đồ dao động nhịp tim */}
        <HealthChartSection
          chartTitle={currentTabConfig.chartTitle}
          chartSubtitle={currentTabConfig.chartSubtitle}
          chartAvg={currentTabConfig.chartAvg}
          chartData={currentTabConfig.chartData}
          closestVital={closestVital}
          scrubberMinutes={scrubberMinutes}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 8. Link tới Hồ sơ Bệnh án Điện Tử */}
        <HealthMedicalRecordLink
          onPress={() => navigation.navigate('PatientMedicalRecord', {
            patientId: selectedPatientId,
            patientName: patientDisplayName,
          })}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 9. Trạng thái Cảm biến & Môi trường */}
        <HealthSensorStatusCard
          batteryDisplay={batteryDisplay}
          acousticStatus={acousticStatus}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 10. Lời khuyên Bác sĩ AI */}
        <HealthAiAdviceCard
          aiAdvice={currentTabConfig.aiAdvice}
          isDarkMode={isDarkMode}
        />
      </ScrollView>

      {/* Modal chọn ngày trên lịch */}
      <HealthDatePickerModal
        visible={isCalendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        draftDate={calendarInputDraft}
        setDraftDate={setCalendarInputDraft}
        onConfirmDate={(val) => setSelectedDate(val)}
        todayStr={getTodayStr()}
        yesterdayStr={getYesterdayStr()}
        twoDaysAgoStr={getDaysAgoStr(2)}
        threeDaysAgoStr={getDaysAgoStr(3)}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
  patientChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  patientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  patientChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  patientChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  patientChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  patientChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  rangePillActive: {
    backgroundColor: '#FFFFFF',
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  rangePillTextActive: {
    fontWeight: '700',
    color: '#0F172A',
  },
  unassignedBandBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  unassignedBandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2,
  },
  unassignedBandText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#78350F',
  },
});
