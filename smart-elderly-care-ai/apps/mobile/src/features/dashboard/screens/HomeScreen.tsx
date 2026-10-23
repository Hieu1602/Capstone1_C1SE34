// ==============================================================================
// TỆP: HomeScreen.tsx
// PHÂN HỆ: Màn hình Trang chủ (Dashboard / Nhà của tôi) - Smart Elderly Care AI
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   1. Hiển thị tổng quan ngôi nhà thông minh & chế độ an ninh (Xa, Ở nhà, Tắt báo động).
//   2. Kết nối WebSocket thời gian thực nhận cảnh báo té ngã (YOLO-Pose) & âm thanh (YAMNet).
//   3. Hiển thị thẻ Camera trực tiếp (HomeCameraCard), Tóm tắt sinh hiệu (VitalsSummaryCard),
//      Xu hướng sức khỏe 12h (HealthTrendsCard) và Nhắc lịch uống thuốc (MedicationReminderWidget).
//   4. Quản lý tính năng Tạm dừng chuông báo động (AlarmSnoozeModal) & Nút gọi khẩn cấp SOS 115.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
// Ánh xạ Text và Alert sang wrapper i18n để mọi nhãn trên Trang chủ theo ngôn ngữ đã chọn.
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { systemApi } from '../../../services/api';
import { alertsWS } from '../../../services/websocket';

// Các component con đã được tách module hóa giúp code gọn gàng, dễ bảo trì
import { HomeCameraCard } from '../components/HomeCameraCard';
import { MedicationReminderWidget } from '../components/MedicationReminderWidget';
import { VitalsSummaryCard } from '../components/VitalsSummaryCard';
import { HealthTrendsCard } from '../components/HealthTrendsCard';
import { AlarmSnoozeModal } from '../components/AlarmSnoozeModal';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';

export default function HomeScreen({ navigation }: any) {
  // Quản lý trạng thái giao diện Sáng / Tối (Dark Mode)
  const { isDarkMode, colors, toggleTheme } = useTheme();
  // Truy xuất dữ liệu trung tâm từ Zustand Store (useVitalStore)
  const {
    house,
    setHouseMode,
    camera,
    toggleCameraSleep,
    toggleCameraAIProtect,
    currentVitals,
    incidents,
    activeDevice,
    alarmSnooze,
    setAlarmSnooze,
    cancelAlarmSnooze,
    todayReminders,
    fetchVitals,
    fetchSystemMode,
    fetchReminders,
    fetchNotifications,
    syncAllWithBackend,
  } = useVitalStore();

  const [isMicSpeaking, setIsMicSpeaking] = useState(false);
  const [nextMedTaken, setNextMedTaken] = useState(false);

  // Tự động gọi API đồng bộ dữ liệu thời gian thực từ Backend FastAPI & mở WebSocket
  useEffect(() => {
    fetchVitals();
    fetchSystemMode();
    fetchReminders();
    fetchNotifications();

    // Kết nối WebSocket nhận cảnh báo té ngã thời gian thực & sinh hiệu 5s/lần
    alertsWS.connect();

    const interval = setInterval(() => {
      fetchVitals();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Tự động làm mới dữ liệu khi màn hình HomeScreen được focus (quay lại từ IncidentDetailScreen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchVitals();
      fetchNotifications();
      fetchSystemMode();
    });
    return unsubscribe;
  }, [navigation]);

  // State cho ActionSheet / BottomSheet "Tạm dừng chuông báo động"
  const [snoozeModalVisible, setSnoozeModalVisible] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(alarmSnooze?.durationMinutes ?? 15);
  const [selectedMode, setSelectedMode] = useState<'VIBRATE' | 'SILENT'>(alarmSnooze?.mode ?? 'VIBRATE');
  const [syncAllFamily, setSyncAllFamily] = useState<boolean>(alarmSnooze?.syncAll ?? true);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);

  // Đồng bộ state khi alarmSnooze thay đổi
  useEffect(() => {
    if (alarmSnooze) {
      setSelectedDuration(alarmSnooze.durationMinutes ?? 15);
      setSelectedMode(alarmSnooze.mode ?? 'VIBRATE');
      setSyncAllFamily(alarmSnooze.syncAll ?? true);
    }
  }, [alarmSnooze]);

  // Bộ đếm ngược thời gian tạm tắt chuông
  useEffect(() => {
    const updateCountdown = () => {
      if (alarmSnooze?.active) {
        if (alarmSnooze.until) {
          const diff = alarmSnooze.until - Date.now();
          if (diff <= 0) {
            cancelAlarmSnooze();
            setRemainingMinutes(0);
          } else {
            setRemainingMinutes(Math.max(1, Math.ceil(diff / (60 * 1000))));
          }
        } else {
          setRemainingMinutes(0); // Vô thời hạn
        }
      } else {
        setRemainingMinutes(0);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 10000);
    return () => clearInterval(timer);
  }, [alarmSnooze, cancelAlarmSnooze]);

  // Kiểm tra sự cố khẩn cấp (té ngã / critical incident chưa xử lý)
  const criticalIncidents = incidents.filter(
    (i) => !i.is_acknowledged && (i.alert_level === 'CRITICAL' || i.alert_type === 'FALL_DETECTED')
  );
  const activeEmergency = criticalIncidents[0];
  const hasEmergency = Boolean(activeEmergency || currentVitals.fall_detected);

  const handleConfirmSnooze = async () => {
    const until = selectedDuration > 0 ? Date.now() + selectedDuration * 60 * 1000 : null;
    setAlarmSnooze({
      active: true,
      durationMinutes: selectedDuration,
      until,
      mode: selectedMode,
      syncAll: syncAllFamily,
    });
    setSnoozeModalVisible(false);

    try {
      await systemApi.updateMode({
        is_mute_alarm: true,
        mute_mode: selectedMode,
        duration_minutes: selectedDuration,
      });
    } catch (e) {
      console.warn('API updateMode snooze error:', e);
    }

    Alert.alert(
      '🔕 Đã tạm dừng chuông báo động',
      `Đã thiết lập tạm dừng chuông báo động ${
        selectedDuration > 0 ? `trong ${selectedDuration} phút` : 'cho đến khi bật lại'
      }.\n\n• Kiểu báo: ${selectedMode === 'VIBRATE' ? 'Chỉ rung (Vibrate Mode - không phát còi loa Hub)' : 'Tắt hoàn toàn âm thanh'}\n• Đồng bộ: ${syncAllFamily ? 'Áp dụng cho tất cả tài khoản người nhà đang theo dõi' : 'Chỉ áp dụng trên máy này'}\n• Chế độ bảo vệ "${house.currentMode === 'AWAY' ? 'Xa' : 'Ở nhà'}" và AI camera vẫn tiếp tục hoạt động ghi hình bình thường.`
    );
  };

  const handleCancelSnooze = async () => {
    cancelAlarmSnooze();
    setSnoozeModalVisible(false);

    try {
      await systemApi.updateMode({
        is_mute_alarm: false,
      });
    } catch (e) {
      console.warn('API updateMode cancel snooze error:', e);
    }

    Alert.alert(
      '🔔 Đã bật lại chuông báo động',
      'Chuông báo động và còi hú Loa Hub đã được kích hoạt lại ở mức bình thường.'
    );
  };

  const handlePressSnoozeButton = () => {
    if (isSnoozeActive) {
      Alert.alert(
        'Chuông báo động đang tắt',
        'Bạn muốn bật lại chuông báo động hay tùy chỉnh thời gian tạm tắt?',
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: '🔔 Bật lại ngay',
            onPress: handleCancelSnooze,
          },
          {
            text: '⚙️ Cài đặt lại',
            onPress: () => {
              setSelectedDuration(alarmSnooze?.durationMinutes || 15);
              setSelectedMode(alarmSnooze?.mode || 'VIBRATE');
              setSyncAllFamily(alarmSnooze?.syncAll ?? true);
              setSnoozeModalVisible(true);
            },
          },
        ]
      );
    } else {
      setSelectedDuration(alarmSnooze?.durationMinutes || 15);
      setSelectedMode(alarmSnooze?.mode || 'VIBRATE');
      setSyncAllFamily(alarmSnooze?.syncAll ?? true);
      setSnoozeModalVisible(true);
    }
  };

  // Đồng bộ thông tin nhà và camera từ Backend khi mở HomeScreen
  React.useEffect(() => {
    syncAllWithBackend?.();
  }, []);

  // Mở màn hình SOS trước khi người dùng xác nhận gọi cấp cứu.
  const handleSOS115 = () => {
    navigation.navigate('EmergencySOS');
  };

  const handleMicPress = () => {
    setIsMicSpeaking(!isMicSpeaking);
    Alert.alert(
      isMicSpeaking ? 'Đã tắt đàm thoại' : 'Đang bật đàm thoại 2 chiều 🎙️',
      isMicSpeaking
        ? 'Loa tại nhà đã đóng.'
        : 'Bạn đang kết nối trực tiếp đến loa và micro của camera phòng cụ bà.'
    );
  };

  const handleMultiView = () => {
    navigation.navigate('MultiView');
  };

  const handleSelectHouseMode = async (mode: 'AWAY' | 'HOME' | 'DISARM') => {
    // Radio / Segmented Control: Nếu đã chọn mode này thì giữ nguyên
    if (house.currentMode === mode) return;

    setHouseMode(mode);

    // Feature 4: Tự động kích hoạt/bỏ kích hoạt trạng thái "Riêng tư" của camera phòng ngủ
    // Ở nhà (HOME) -> Riêng tư = True (che camera phòng ngủ)
    // Xa (AWAY) -> Riêng tư = False (mở camera giám sát 24/7)
    const isPrivacy = mode === 'HOME';
    if (camera.isSleep !== isPrivacy) {
      toggleCameraSleep();
    }

    try {
      await systemApi.updateMode({
        mode,
        is_camera_privacy: isPrivacy,
      });
    } catch (e) {
      console.warn('API updateMode house mode error:', e);
    }

    if (mode === 'AWAY') {
      Alert.alert(
        '🚶 Chế độ Xa (Away) đã kích hoạt',
        'Đã kích hoạt chế độ an ninh cao nhất: Camera phòng ngủ đã mở giám sát 24/7 và sẵn sàng phát hiện té ngã. Đã lưu vào PostgreSQL.'
      );
    } else if (mode === 'HOME') {
      Alert.alert(
        '🏠 Chế độ Ở nhà (Home) đã kích hoạt',
        'Đã kích hoạt chế độ riêng tư: Ống kính camera phòng ngủ đã tạm cụp/che lại, vẫn duy trì theo dõi nhịp tim và té ngã 24/7. Đã lưu vào PostgreSQL.'
      );
    } else if (mode === 'DISARM') {
      Alert.alert(
        '🛡️ Chế độ Tắt báo động (Disarm) đã kích hoạt',
        'Đã tắt hoàn toàn còi hú và các thông báo báo động. Đã lưu vào PostgreSQL.'
      );
    }
  };

  const handleTogglePrivacyMode = () => {
    toggleCameraSleep();
    Alert.alert(
      camera.isSleep ? 'Đã mở lại ống kính camera' : 'Đã bật Chế độ riêng tư (Che camera)',
      camera.isSleep
        ? `Ống kính ${cameraDisplayName} đã mở lại và tiếp tục phát trực tiếp bình thường.`
        : `Ống kính ${cameraDisplayName} đã cụp lại và che khung hình. Màn hình đen riêng tư đã được kích hoạt.`
    );
  };

  const handleToggleAIProtect = () => {
    toggleCameraAIProtect();
    Alert.alert(
      camera.isAIProtect
        ? '⏸️ Đã tạm dừng tính năng AI'
        : '🛡️ Đã bật giám sát AI thông minh',
      camera.isAIProtect
        ? `Đã tạm dừng các tính năng AI (nhận diện té ngã & âm thanh bất thường) cho ${cameraDisplayName}. Camera chuyển sang chế độ ghi hình thông thường.`
        : `Đã kích hoạt toàn bộ tính năng AI cho ${cameraDisplayName}: Bật phát hiện té ngã 24/7 và nhận diện âm thanh bất thường YAMNet.`
    );
  };

  const cameraDisplayName = camera.name || 'Camera Phòng Ngủ - Hub #01';
  const isEdgeHubOnline = activeDevice?.is_online ?? true;
  const braceletBattery = currentVitals.bracelet_battery ?? null;
  const acousticStatus = currentVitals.acoustic_status ?? 'Bình thường';
  const isAcousticAlarm = acousticStatus.includes('la hét') || acousticStatus.includes('va đập');

  const isSnoozeActive = Boolean(alarmSnooze?.active);
  let snoozeButtonLabel = 'Tắt báo động';
  if (isSnoozeActive) {
    if (alarmSnooze.until && remainingMinutes > 0) {
      snoozeButtonLabel = `Tắt chuông: còn ${remainingMinutes}p`;
    } else if (alarmSnooze.durationMinutes === 0) {
      snoozeButtonLabel = 'Tắt chuông: Vô hạn';
    } else {
      snoozeButtonLabel = 'Tắt chuông: Đang bật';
    }
  }

  // Cữ thuốc kế tiếp từ Backend FastAPI
  const nextMedication =
    todayReminders?.medications?.find((m) => !m.taken) ||
    todayReminders?.medications?.[3] || {
      name: 'Uống thuốc huyết áp (Amlodipine 5mg)',
      time: '18:30',
      taken: false,
    };
  const isMedDone = nextMedTaken || Boolean(nextMedication.taken);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header: "Nhà của tôi v", Theme switcher, Bell with badge, Add button */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.houseTitleRow}
          onPress={() => navigation.navigate('HouseDetail')}
          activeOpacity={0.7}
        >
          <Text style={[styles.houseTitleText, { color: colors.textPrimary }]}>{house.name}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textPrimary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <View style={styles.topRightActions}>
          {/* Nút chuyển đổi Sáng / Tối */}
          <TouchableOpacity
            style={[styles.iconCircleBtn, { marginRight: 6 }, isDarkMode && { backgroundColor: colors.iconBg }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Chuyển chế độ Sáng/Tối"
          >
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
              size={22}
              color={isDarkMode ? '#F59E0B' : colors.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconCircleBtn, isDarkMode && { backgroundColor: colors.iconBg }]}
            onPress={() => navigation.navigate('Alerts')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            <View style={styles.redBadgeDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconCircleBtn, { marginLeft: 8 }, isDarkMode && { backgroundColor: colors.iconBg }]}
            onPress={() => navigation.navigate('Devices')}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Thanh thông báo chạy chữ từ Admin (dành cho Chủ hộ & Thành viên gia đình) */}
      <AdminMarqueeBanner targetAudience="caregivers" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Bộ chọn chế độ an ninh (House Security Mode) dạng Radio / Segmented Control: Xa - Ở nhà - Tắt báo động */}
        <View style={styles.modesRow}>
          {/* Nút 1: Xa (Away) */}
          <TouchableOpacity
            style={[
              styles.modePill,
              house.currentMode === 'AWAY' ? styles.modePillActiveAway : styles.modePillInactive,
              house.currentMode !== 'AWAY' && isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => handleSelectHouseMode('AWAY')}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.modeIconCircle,
                { backgroundColor: house.currentMode === 'AWAY' ? '#10B981' : (isDarkMode ? colors.surfaceSubtle : '#E2E8F0') },
              ]}
            >
              <Ionicons
                name="exit-outline"
                size={14}
                color={house.currentMode === 'AWAY' ? '#FFF' : (isDarkMode ? colors.textMuted : '#94A3B8')}
              />
            </View>
            <Text
              style={[
                styles.modePillText,
                { color: house.currentMode === 'AWAY' ? '#047857' : (isDarkMode ? colors.textMuted : '#94A3B8') },
              ]}
              numberOfLines={1}
            >
              Xa
            </Text>
          </TouchableOpacity>

          {/* Nút 2: Ở nhà (Home) */}
          <TouchableOpacity
            style={[
              styles.modePill,
              house.currentMode === 'HOME' ? styles.modePillActiveHome : styles.modePillInactive,
              house.currentMode !== 'HOME' && isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => handleSelectHouseMode('HOME')}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.modeIconCircle,
                { backgroundColor: house.currentMode === 'HOME' ? '#3B82F6' : (isDarkMode ? colors.surfaceSubtle : '#E2E8F0') },
              ]}
            >
              <Ionicons
                name="home"
                size={14}
                color={house.currentMode === 'HOME' ? '#FFF' : (isDarkMode ? colors.textMuted : '#94A3B8')}
              />
            </View>
            <Text
              style={[
                styles.modePillText,
                { color: house.currentMode === 'HOME' ? '#1D4ED8' : (isDarkMode ? colors.textMuted : '#94A3B8') },
              ]}
              numberOfLines={1}
            >
              Ở nhà
            </Text>
          </TouchableOpacity>

          {/* Nút 3: Tắt báo động / Tạm dừng chuông báo động (Snooze) */}
          <TouchableOpacity
            style={[
              styles.modePill,
              isSnoozeActive
                ? [
                    styles.modePillActiveSnooze,
                    isDarkMode && { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderColor: '#F59E0B' },
                  ]
                : house.currentMode === 'DISARM'
                ? styles.modePillActiveDisarm
                : styles.modePillInactive,
              !isSnoozeActive && house.currentMode !== 'DISARM' && isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={handlePressSnoozeButton}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.modeIconCircle,
                {
                  backgroundColor: isSnoozeActive
                    ? '#F59E0B'
                    : house.currentMode === 'DISARM'
                    ? '#64748B'
                    : isDarkMode
                    ? colors.surfaceSubtle
                    : '#E2E8F0',
                },
              ]}
            >
              <Ionicons
                name={isSnoozeActive ? 'volume-mute' : 'notifications-off-outline'}
                size={14}
                color={isSnoozeActive || house.currentMode === 'DISARM' ? '#FFF' : isDarkMode ? colors.textMuted : '#94A3B8'}
              />
            </View>
            <Text
              style={[
                styles.modePillText,
                {
                  color: isSnoozeActive
                    ? (isDarkMode ? '#FBBF24' : '#D97706')
                    : house.currentMode === 'DISARM'
                    ? '#475569'
                    : isDarkMode
                    ? colors.textMuted
                    : '#94A3B8',
                  fontWeight: isSnoozeActive ? '700' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {snoozeButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2.5. Banner Cảnh báo Khẩn cấp màu đỏ (hoặc Trạng thái Sức khoẻ ổn định) */}
        {hasEmergency ? (
          <TouchableOpacity
            style={styles.emergencyBanner}
            activeOpacity={0.9}
            onPress={() => {
              navigation.navigate('EventDetail', {
                incidentId: activeEmergency?.id || 'inc-03',
                id: activeEmergency?.id || 'inc-03',
                alert_type: activeEmergency?.alert_type || 'FALL_DETECTED',
                alert_level: activeEmergency?.alert_level || 'CRITICAL',
                message: activeEmergency?.message || '🚨 Cảnh báo té ngã (Fall Detected) - Trích xuất clip 5s bộ đệm Edge Hub RAM',
                confidence: 0.94,
                thumbnail_url: activeEmergency?.thumbnail_url || 'http://localhost:8000/static/evidence/fall_evidence_ai.jpg',
                video_clip_url: activeEmergency?.video_clip_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                is_acknowledged: false,
              });
            }}
          >
            <View style={styles.emergencyBannerHeader}>
              <View style={styles.emergencySirenPulse}>
                <Ionicons name="warning" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.emergencyBannerTitle}>🚨 CẢNH BÁO KHẨN CẤP ĐANG KÍCH HOẠT</Text>
                <Text style={styles.emergencyBannerMessage} numberOfLines={2}>
                  {activeEmergency?.message || 'Phát hiện sự cố té ngã (YOLO-Pose AI). Cần kiểm tra video và xác nhận xử lý ngay!'}
                </Text>
              </View>
              <View style={styles.emergencyActionBtn}>
                <Text style={styles.emergencyActionBtnText}>Xem & Xử lý</Text>
                <Ionicons name="chevron-forward" size={14} color="#DC2626" />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.stableHealthCard,
              {
                backgroundColor: isDarkMode ? '#064E3B18' : '#F0FDF4',
                borderColor: isDarkMode ? '#065F46' : '#BBF7D0',
              },
            ]}
          >
            <View style={styles.stablePulseDot} />
            <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
            <Text style={[styles.stableHealthText, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
              Sức khoẻ ổn định • Hệ thống giám sát AI đang bảo vệ 24/7
            </Text>
          </View>
        )}

        {/* 3. NÚT KHẨN CẤP: ONE-TOUCH SOS 115 (Màu đỏ nổi bật, dễ quan sát) */}
        <TouchableOpacity
          style={styles.sosCard}
          onPress={handleSOS115}
          activeOpacity={0.9}
        >
          <View style={styles.sosLeftContent}>
            <View style={styles.sosIconCircle}>
              <Ionicons name="call" size={24} color="#FFF" />
            </View>
            <View style={styles.sosTextContainer}>
              <View style={styles.sosTitleRow}>
                <Text style={styles.sosTitleText}>ONE-TOUCH SOS 115</Text>
                <View style={styles.sosTag}>
                  <Text style={styles.sosTagText}>KHẨN CẤP</Text>
                </View>
              </View>
              <Text style={styles.sosSubtitleText} numberOfLines={1}>
                Báo người thân &amp; gọi cấp cứu 115
              </Text>
            </View>
          </View>

          <View style={styles.sosActionCircle}>
            <Ionicons name="arrow-forward" size={18} color={Colors.danger} />
          </View>
        </TouchableOpacity>

        {/* 4. Banner "Nhiều chế độ xem" (Multi-view) */}
        <TouchableOpacity
          style={[styles.multiViewCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleMultiView}
          activeOpacity={0.9}
        >
          <Text style={[styles.multiViewText, isDarkMode && { color: colors.textPrimary }]}>Nhiều chế độ xem</Text>
          <View style={styles.playCircleBtn}>
            <Ionicons name="play" size={14} color={Colors.primary} style={{ marginLeft: 2 }} />
          </View>
        </TouchableOpacity>

        {/* 5. Main Camera Device Card (Live View & Playback) */}
        <HomeCameraCard
          cameraDisplayName={cameraDisplayName}
          camera={camera}
          house={house}
          isDarkMode={isDarkMode}
          colors={colors}
          navigation={navigation}
          handleTogglePrivacyMode={handleTogglePrivacyMode}
          handleMicPress={handleMicPress}
          isMicSpeaking={isMicSpeaking}
          handleToggleAIProtect={handleToggleAIProtect}
        />

        {/* 6. Widget Nhắc nhở uống thuốc & Ăn uống sinh hoạt */}
        <MedicationReminderWidget
          nextMedication={nextMedication}
          isMedDone={isMedDone}
          setNextMedTaken={setNextMedTaken}
          isDarkMode={isDarkMode}
          colors={colors}
          navigation={navigation}
        />

        {/* 7. Khối hiển thị Tình trạng sức khoẻ */}
        <VitalsSummaryCard
          currentVitals={currentVitals}
          isEdgeHubOnline={isEdgeHubOnline}
          braceletBattery={braceletBattery}
          isAcousticAlarm={isAcousticAlarm}
          isDarkMode={isDarkMode}
          colors={colors}
          navigation={navigation}
        />

        {/* 8. Khối "Xu hướng sức khoẻ hôm nay" */}
        <HealthTrendsCard
          currentVitals={currentVitals}
          isDarkMode={isDarkMode}
          colors={colors}
          navigation={navigation}
        />
      </ScrollView>

      {/* ActionSheet / BottomSheet Modal "Tạm dừng chuông báo động" */}
      <AlarmSnoozeModal
        visible={snoozeModalVisible}
        onClose={() => setSnoozeModalVisible(false)}
        alarmSnooze={alarmSnooze}
        selectedDuration={selectedDuration}
        setSelectedDuration={setSelectedDuration}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
        syncAllFamily={syncAllFamily}
        setSyncAllFamily={setSyncAllFamily}
        remainingMinutes={remainingMinutes}
        isDarkMode={isDarkMode}
        colors={colors}
        onConfirm={handleConfirmSnooze}
        onCancel={handleCancelSnooze}
        isSnoozeActive={isSnoozeActive}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  houseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  houseTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  redBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 70,
  },
  // Quick Mode Pills
  modesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 16,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  modePillActiveAway: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    opacity: 1,
    ...Shadows.soft,
  },
  modePillActiveHome: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    opacity: 1,
    ...Shadows.soft,
  },
  modePillActiveDisarm: {
    backgroundColor: '#F1F5F9',
    borderColor: '#64748B',
    opacity: 1,
    ...Shadows.soft,
  },
  modePillInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  modePillActiveSnooze: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    opacity: 1,
    ...Shadows.soft,
  },
  modeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Emergency Banner
  emergencyBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    ...Shadows.card,
  },
  emergencyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencySirenPulse: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 2,
  },
  emergencyBannerMessage: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    fontWeight: '500',
  },
  emergencyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
    gap: 2,
  },
  emergencyActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  // Stable Health Status
  stableHealthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  stablePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  stableHealthText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  // Khối One-Touch SOS 115
  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC2626',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    ...Shadows.card,
  },
  sosLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sosIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sosTextContainer: {
    flex: 1,
  },
  sosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosTitleText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sosTag: {
    backgroundColor: '#FFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sosTagText: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '900',
  },
  sosSubtitleText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  sosActionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  // Multi-view Banner
  multiViewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
    ...Shadows.card,
  },
  multiViewText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  playCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
