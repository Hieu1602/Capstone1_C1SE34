// ==============================================================================
// TỆP: HomeScreen.tsx
// PHÂN HỆ: Màn hình Trang chủ (Dashboard / Nhà của tôi) - Smart Elderly Care AI
// TÁC GIẢ: Phan Nguyễn Giáng My
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTheme } from '../../../store/useThemeStore';
import { systemApi } from '../../../services/api';
import { alertsWS } from '../../../services/websocket';
import { HomeCameraCard } from '../components/HomeCameraCard';
import { MedicationReminderWidget } from '../components/MedicationReminderWidget';
import { VitalsSummaryCard } from '../components/VitalsSummaryCard';
import { HealthTrendsCard } from '../components/HealthTrendsCard';
import { AlarmSnoozeModal } from '../components/AlarmSnoozeModal';
import { FamilyAppointmentsModal } from '../components/FamilyAppointmentsModal';
import { usePatientStore } from '../../../store/usePatientStore';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';

export default function HomeScreen({ navigation }: any) {
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const {
    house, setHouseMode, camera, toggleCameraSleep, toggleCameraAIProtect,
    currentVitals, incidents, activeDevice, alarmSnooze, setAlarmSnooze,
    cancelAlarmSnooze, todayReminders, markMedicationTaken, fetchVitals,
    fetchSystemMode, fetchReminders, fetchNotifications, syncAllWithBackend,
    fetchHouseFromBackend, fetchDevicesFromBackend, iotDevices,
  } = useVitalStore();

  const { userRole, role, full_name, userName, phone_number, userPhone, permissions, fetchMyPermissions } = useAuthStore();
  const displayName = full_name || userName || 'Thành viên';
  const isMember = userRole === 'member' || !userRole || userRole === 'user';
  const hasLinkedHouse = Boolean(house?.id && house?.hasHouse !== false && house?.name && house.name.trim() !== '');
  const hasLinkedDevices = (iotDevices || []).length > 0;
  const isUserEmptyMember = isMember && !hasLinkedHouse && !hasLinkedDevices;

  // Kiểm tra quyền xem camera và chỉ số sinh hiệu của tài khoản thành viên
  const isOwnerOrAdmin =
    userRole === 'admin' ||
    userRole === 'owner' ||
    role === 'admin' ||
    role === 'owner' ||
    permissions?.is_owner === true ||
    permissions?.role_in_house === 'OWNER';
  const canViewCamera = isOwnerOrAdmin || Boolean(permissions?.can_view_camera);
  const canViewHealth = isOwnerOrAdmin || Boolean(permissions?.can_view_health);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        syncAllWithBackend?.(),
        fetchHouseFromBackend?.(),
        fetchDevicesFromBackend?.(),
        fetchVitals(),
        fetchNotifications(),
        fetchMyPermissions?.(),
      ]);
      Alert.alert(
        '🔄 Đã làm mới',
        hasLinkedHouse
          ? 'Đã tải thành công dữ liệu ngôi nhà và thiết bị mới nhất.'
          : 'Hiện tại tài khoản vẫn chưa được liên kết vào căn nhà nào. Hãy nhắc Chủ hộ thêm số điện thoại của bạn vào nhà nhé!'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const unreadIncidentsCount = (incidents || []).filter((item) => !item.is_acknowledged).length;
  const pendingMedCount = (todayReminders?.medications || []).filter((m) => !m.taken).length;
  const unreadCount = unreadIncidentsCount + pendingMedCount;

  const { patientRecord, fetchPatientRecord } = usePatientStore();
  const [familyAppointmentsModalVisible, setFamilyAppointmentsModalVisible] = useState(false);
  const [isMicSpeaking, setIsMicSpeaking] = useState(false);
  const [nextMedTaken, setNextMedTaken] = useState(false);

  useEffect(() => {
    fetchVitals(); fetchSystemMode(); fetchReminders(); fetchNotifications();
    fetchPatientRecord?.(); syncAllWithBackend?.();
    fetchMyPermissions?.();
    alertsWS.connect();
    const interval = setInterval(() => {
      fetchVitals();
      fetchMyPermissions?.();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      fetchVitals(); fetchNotifications(); fetchSystemMode(); fetchReminders();
      fetchMyPermissions?.();
    });
  }, [navigation]);

  const [snoozeModalVisible, setSnoozeModalVisible] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(alarmSnooze?.durationMinutes ?? 15);
  const [selectedMode, setSelectedMode] = useState<'VIBRATE' | 'SILENT'>(alarmSnooze?.mode ?? 'VIBRATE');
  const [syncAllFamily, setSyncAllFamily] = useState<boolean>(alarmSnooze?.syncAll ?? true);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);

  useEffect(() => {
    if (alarmSnooze) {
      setSelectedDuration(alarmSnooze.durationMinutes ?? 15);
      setSelectedMode(alarmSnooze.mode ?? 'VIBRATE');
      setSyncAllFamily(alarmSnooze.syncAll ?? true);
    }
  }, [alarmSnooze]);

  useEffect(() => {
    const updateCountdown = () => {
      if (alarmSnooze?.active) {
        if (alarmSnooze.until) {
          const diff = alarmSnooze.until - Date.now();
          if (diff <= 0) { cancelAlarmSnooze(); setRemainingMinutes(0); }
          else { setRemainingMinutes(Math.max(1, Math.ceil(diff / (60 * 1000)))); }
        } else { setRemainingMinutes(0); }
      } else { setRemainingMinutes(0); }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 10000);
    return () => clearInterval(timer);
  }, [alarmSnooze, cancelAlarmSnooze]);

  const criticalIncidents = incidents.filter(
    (i) => !i.is_acknowledged && (i.alert_level === 'CRITICAL' || i.alert_type === 'FALL_DETECTED')
  );
  const activeEmergency = criticalIncidents[0];
  const hasEmergency = Boolean(activeEmergency || currentVitals.fall_detected);
  const pendingAppointmentNotice = incidents.find(
    (i) => !i.is_acknowledged && i.alert_type === 'APPOINTMENT_SCHEDULED'
  );

  const handleConfirmSnooze = async () => {
    const until = selectedDuration > 0 ? Date.now() + selectedDuration * 60 * 1000 : null;
    setAlarmSnooze({
      active: true, durationMinutes: selectedDuration, until,
      mode: selectedMode, syncAll: syncAllFamily,
    });
    setSnoozeModalVisible(false);
    try {
      await systemApi.updateMode({ is_mute_alarm: true, mute_mode: selectedMode, duration_minutes: selectedDuration });
    } catch (e) { console.warn('API updateMode snooze error:', e); }

    Alert.alert(
      '🔕 Đã tạm dừng chuông báo động',
      `Đã thiết lập tạm dừng chuông báo động ${selectedDuration > 0 ? `trong ${selectedDuration} phút` : 'cho đến khi bật lại'}.\n\n• Kiểu báo: ${selectedMode === 'VIBRATE' ? 'Chỉ rung (Vibrate Mode - không phát còi loa Hub)' : 'Tắt hoàn toàn âm thanh'}\n• Đồng bộ: ${syncAllFamily ? 'Áp dụng cho tất cả tài khoản người nhà đang theo dõi' : 'Chỉ áp dụng trên máy này'}\n• Chế độ bảo vệ "${house.currentMode === 'AWAY' ? 'Xa' : 'Ở nhà'}" và AI camera vẫn tiếp tục hoạt động ghi hình bình thường.`
    );
  };

  const handleCancelSnooze = async () => {
    cancelAlarmSnooze(); setSnoozeModalVisible(false);
    try { await systemApi.updateMode({ is_mute_alarm: false }); }
    catch (e) { console.warn('API updateMode cancel snooze error:', e); }
    Alert.alert('🔔 Đã bật lại chuông báo động', 'Chuông báo động và còi hú Loa Hub đã được kích hoạt lại ở mức bình thường.');
  };

  const handlePressSnoozeButton = () => {
    if (isSnoozeActive) {
      Alert.alert(
        'Chuông báo động đang tắt',
        'Bạn muốn bật lại chuông báo động hay tùy chỉnh thời gian tạm tắt?',
        [
          { text: 'Đóng', style: 'cancel' },
          { text: '🔔 Bật lại ngay', onPress: handleCancelSnooze },
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

  const handleSOS115 = () => { navigation.navigate('EmergencySOS'); };

  const handleMicPress = () => {
    setIsMicSpeaking(!isMicSpeaking);
    Alert.alert(
      isMicSpeaking ? 'Đã tắt đàm thoại' : 'Đang bật đàm thoại 2 chiều 🎙️',
      isMicSpeaking ? 'Loa tại nhà đã đóng.' : 'Bạn đang kết nối trực tiếp đến loa và micro của camera phòng cụ bà.'
    );
  };

  const handleMultiView = () => {
    if (!canViewCamera) {
      Alert.alert('Không có quyền truy cập', 'Chủ hộ đã tắt quyền xem trực tiếp camera đối với tài khoản này.');
      return;
    }
    navigation.navigate('MultiView');
  };

  const handleSelectHouseMode = async (mode: 'AWAY' | 'HOME' | 'DISARM') => {
    if (house.currentMode === mode) return;
    setHouseMode(mode);
    const isPrivacy = mode === 'HOME';
    if (camera.isSleep !== isPrivacy) toggleCameraSleep();
    try { await systemApi.updateMode({ mode, is_camera_privacy: isPrivacy }); }
    catch (e) { console.warn('API updateMode house mode error:', e); }

    if (mode === 'AWAY') {
      Alert.alert('🚶 Chế độ Xa (Away) đã kích hoạt', 'Đã kích hoạt chế độ an ninh cao nhất: Camera phòng ngủ đã mở giám sát 24/7 và sẵn sàng phát hiện té ngã. Đã lưu vào PostgreSQL.');
    } else if (mode === 'HOME') {
      Alert.alert('🏠 Chế độ Ở nhà (Home) đã kích hoạt', 'Đã kích hoạt chế độ riêng tư: Ống kính camera phòng ngủ đã tạm cụp/che lại, vẫn duy trì theo dõi nhịp tim và té ngã 24/7. Đã lưu vào PostgreSQL.');
    } else if (mode === 'DISARM') {
      Alert.alert('🛡️ Chế độ Tắt báo động (Disarm) đã kích hoạt', 'Đã tắt hoàn toàn còi hú và các thông báo báo động. Đã lưu vào PostgreSQL.');
    }
  };

  const handleTogglePrivacyMode = () => {
    toggleCameraSleep();
    Alert.alert(
      camera.isSleep ? 'Đã mở lại ống kính camera' : 'Đã bật Chế độ riêng tư (Che camera)',
      camera.isSleep ? `Ống kính ${cameraDisplayName} đã mở lại và tiếp tục phát trực tiếp bình thường.` : `Ống kính ${cameraDisplayName} đã cụp lại và che khung hình. Màn hình đen riêng tư đã được kích hoạt.`
    );
  };

  const handleToggleAIProtect = () => {
    toggleCameraAIProtect();
    Alert.alert(
      camera.isAIProtect ? '⏸️ Đã tạm dừng tính năng AI' : '🛡️ Đã bật giám sát AI thông minh',
      camera.isAIProtect ? `Đã tạm dừng các tính năng AI (nhận diện té ngã & âm thanh bất thường) cho ${cameraDisplayName}. Camera chuyển sang chế độ ghi hình thông thường.` : `Đã kích hoạt toàn bộ tính năng AI cho ${cameraDisplayName}: Bật phát hiện té ngã 24/7 và nhận diện âm thanh bất thường YAMNet.`
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
    if (alarmSnooze.until && remainingMinutes > 0) snoozeButtonLabel = `Tắt chuông: còn ${remainingMinutes}p`;
    else if (alarmSnooze.durationMinutes === 0) snoozeButtonLabel = 'Tắt chuông: Vô hạn';
    else snoozeButtonLabel = 'Tắt chuông: Đang bật';
  }

  const nextMedication = todayReminders?.medications?.find((m) => !m.taken) || todayReminders?.medications?.[0] || null;
  const isMedDone = nextMedTaken || Boolean(nextMedication?.taken);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.houseTitleRow} onPress={() => navigation.navigate('HouseDetail')} activeOpacity={0.7}>
          <Text style={[styles.houseTitleText, { color: colors.textPrimary }]}>{house.name || 'Nhà của tôi'}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textPrimary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <View style={styles.topRightActions}>
          <TouchableOpacity style={[styles.iconCircleBtn, { marginRight: 6 }, isDarkMode && { backgroundColor: colors.iconBg }]} onPress={toggleTheme} activeOpacity={0.7} accessibilityLabel="Chuyển chế độ Sáng/Tối">
            <Ionicons name={isDarkMode ? 'sunny-outline' : 'moon-outline'} size={22} color={isDarkMode ? '#F59E0B' : colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconCircleBtn, isDarkMode && { backgroundColor: colors.iconBg }]} onPress={() => navigation.navigate('Alerts')} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadCount > 0 && <View style={styles.redBadgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconCircleBtn, { marginLeft: 8 }, isDarkMode && { backgroundColor: colors.iconBg }]} onPress={() => navigation.navigate('Devices')} activeOpacity={0.7}>
            <Ionicons name="add" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <AdminMarqueeBanner targetAudience="caregivers" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshData}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* 2. Chế độ an ninh */}
        <View style={styles.modesRow}>
          {[
            { key: 'AWAY', label: 'Xa', icon: 'exit-outline', activeColor: '#10B981', activeStyle: styles.modePillActiveAway, textColor: '#047857', isActive: house.currentMode === 'AWAY', onPress: () => handleSelectHouseMode('AWAY') },
            { key: 'HOME', label: 'Ở nhà', icon: 'home', activeColor: '#3B82F6', activeStyle: styles.modePillActiveHome, textColor: '#1D4ED8', isActive: house.currentMode === 'HOME', onPress: () => handleSelectHouseMode('HOME') },
            { key: 'DISARM', label: snoozeButtonLabel, icon: isSnoozeActive ? 'volume-mute' : 'notifications-off-outline', activeColor: isSnoozeActive ? '#F59E0B' : '#64748B', activeStyle: isSnoozeActive ? styles.modePillActiveSnooze : styles.modePillActiveDisarm, textColor: isSnoozeActive ? (isDarkMode ? '#FBBF24' : '#D97706') : '#475569', isActive: isSnoozeActive || house.currentMode === 'DISARM', onPress: handlePressSnoozeButton },
          ].map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modePill, m.isActive ? m.activeStyle : styles.modePillInactive, !m.isActive && isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={m.onPress}
              activeOpacity={0.75}
            >
              <View style={[styles.modeIconCircle, { backgroundColor: m.isActive ? m.activeColor : (isDarkMode ? colors.surfaceSubtle : '#E2E8F0') }]}>
                <Ionicons name={m.icon as any} size={14} color={m.isActive ? '#FFF' : (isDarkMode ? colors.textMuted : '#94A3B8')} />
              </View>
              <Text style={[styles.modePillText, { color: m.isActive ? m.textColor : (isDarkMode ? colors.textMuted : '#94A3B8') }]} numberOfLines={1}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 2.4. Banner Lịch khám Bác sĩ mới chờ Gia đình xác nhận */}
        {pendingAppointmentNotice && (
          <TouchableOpacity
            style={[styles.appointmentBanner, isDarkMode && { backgroundColor: 'rgba(217, 119, 6, 0.12)', borderColor: '#D97706' }]}
            activeOpacity={0.88}
            onPress={() => setFamilyAppointmentsModalVisible(true)}
          >
            <View style={styles.appointmentBannerLeft}>
              <View style={[styles.appointmentIconCircle, isDarkMode && { backgroundColor: 'rgba(217, 119, 6, 0.25)' }]}>
                <Ionicons name="calendar" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.appointmentBannerTitle, isDarkMode && { color: '#FBBF24' }]}>🗓️ LỊCH KHÁM MỚI TỪ BÁC SĨ</Text>
                  <View style={styles.appointmentBadge}><Text style={styles.appointmentBadgeText}>Chờ xác nhận</Text></View>
                </View>
                <Text style={[styles.appointmentBannerSubtitle, isDarkMode && { color: colors.textSecondary }]} numberOfLines={2}>
                  {pendingAppointmentNotice.message}
                </Text>
              </View>
            </View>
            <View style={[styles.appointmentActionBtn, isDarkMode && { backgroundColor: 'rgba(217, 119, 6, 0.25)' }]}>
              <Text style={[styles.appointmentActionBtnText, isDarkMode && { color: '#FBBF24' }]}>Xác nhận</Text>
              <Ionicons name="chevron-forward" size={14} color="#D97706" />
            </View>
          </TouchableOpacity>
        )}

        {/* 2.5. Banner Cảnh báo Khẩn cấp / Trạng thái ổn định */}
        {hasEmergency ? (
          <TouchableOpacity
            style={styles.emergencyBanner}
            activeOpacity={0.9}
            onPress={() => {
              if (activeEmergency) {
                navigation.navigate('EventDetail', {
                  incidentId: activeEmergency.id, id: activeEmergency.id, alert_type: activeEmergency.alert_type,
                  alert_level: activeEmergency.alert_level || 'CRITICAL', message: activeEmergency.message,
                  confidence: activeEmergency.confidence, thumbnail_url: activeEmergency.thumbnail_url ?? null,
                  video_clip_url: activeEmergency.video_clip_url ?? null, is_acknowledged: activeEmergency.is_acknowledged ?? false,
                });
              } else { navigation.navigate('Alerts'); }
            }}
          >
            <View style={styles.emergencyBannerHeader}>
              <View style={styles.emergencySirenPulse}><Ionicons name="warning" size={20} color="#FFF" /></View>
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
          <View style={[styles.stableHealthCard, { backgroundColor: isDarkMode ? '#064E3B18' : '#F0FDF4', borderColor: isDarkMode ? '#065F46' : '#BBF7D0' }]}>
            <View style={styles.stablePulseDot} />
            <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
            <Text style={[styles.stableHealthText, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
              Sức khoẻ ổn định • Hệ thống giám sát AI đang bảo vệ 24/7
            </Text>
          </View>
        )}

        {isUserEmptyMember ? (
          <View style={styles.emptyContainer}>
            {/* 1. Empty Illustration */}
            <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Ionicons name="home-outline" size={54} color={isDarkMode ? '#64748B' : '#94A3B8'} />
            </View>

            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Chưa có dữ liệu theo dõi
            </Text>

            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tài khoản thành viên mới chưa được liên kết với bất kỳ căn nhà hay thiết bị theo dõi nào. Sau khi được Chủ hộ thêm vào nhà, hệ thống sẽ tự động hiển thị camera và sinh hiệu người thân tại đây.
            </Text>
          </View>
        ) : (
          <>
            {/* 3. NÚT KHẨN CẤP: ONE-TOUCH SOS 115 */}
        <TouchableOpacity style={styles.sosCard} onPress={handleSOS115} activeOpacity={0.9}>
          <View style={styles.sosLeftContent}>
            <View style={styles.sosIconCircle}><Ionicons name="call" size={24} color="#FFF" /></View>
            <View style={styles.sosTextContainer}>
              <View style={styles.sosTitleRow}>
                <Text style={styles.sosTitleText}>ONE-TOUCH SOS 115</Text>
                <View style={styles.sosTag}><Text style={styles.sosTagText}>KHẨN CẤP</Text></View>
              </View>
              <Text style={styles.sosSubtitleText} numberOfLines={1}>Báo người thân &amp; gọi cấp cứu 115</Text>
            </View>
          </View>
          <View style={styles.sosActionCircle}><Ionicons name="arrow-forward" size={18} color={Colors.danger} /></View>
        </TouchableOpacity>

        {/* 4. Banner Nhiều chế độ xem (Multi-view) & 5. Main Camera Device Card */}
        {canViewCamera ? (
          <>
            <TouchableOpacity style={[styles.multiViewCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleMultiView} activeOpacity={0.9}>
              <Text style={[styles.multiViewText, isDarkMode && { color: colors.textPrimary }]}>Nhiều chế độ xem</Text>
              <View style={styles.playCircleBtn}><Ionicons name="play" size={14} color={Colors.primary} style={{ marginLeft: 2 }} /></View>
            </TouchableOpacity>

            <HomeCameraCard
              cameraDisplayName={cameraDisplayName} camera={camera} house={house} isDarkMode={isDarkMode}
              colors={colors} navigation={navigation} handleTogglePrivacyMode={handleTogglePrivacyMode}
              handleMicPress={handleMicPress} isMicSpeaking={isMicSpeaking} handleToggleAIProtect={handleToggleAIProtect}
            />
          </>
        ) : (
          <View style={[styles.cameraBlockedCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
            <View style={styles.cameraBlockedIconBox}>
              <Ionicons name="videocam-off" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.cameraBlockedTitle, { color: colors.textPrimary }]}>
              Camera an ninh đã bị khóa
            </Text>
            <Text style={[styles.cameraBlockedDesc, { color: colors.textSecondary }]}>
              Chủ hộ đã tắt quyền giám sát camera an ninh đối với tài khoản này. Vui lòng liên hệ Chủ hộ để được cấp quyền theo dõi.
            </Text>
            <View style={[styles.cameraBlockedBadge, isDarkMode && { backgroundColor: '#334155' }]}>
              <Ionicons name="lock-closed" size={13} color="#94A3B8" />
              <Text style={[styles.cameraBlockedBadgeText, isDarkMode && { color: '#94A3B8' }]}>Chưa được cấp quyền xem camera</Text>
            </View>
          </View>
        )}

        {/* 6. Widget Nhắc nhở uống thuốc */}
        {Boolean(nextMedication?.name) && (
          <MedicationReminderWidget
            nextMedication={nextMedication!} isMedDone={isMedDone} setNextMedTaken={setNextMedTaken}
            onConfirmTaken={(medId, timeStr) => { markMedicationTaken(medId, true, timeStr); setNextMedTaken(true); }}
            isDarkMode={isDarkMode} colors={colors} navigation={navigation}
          />
        )}

        {/* 7. Khối hiển thị Chỉ số sinh hiệu & 8. Khối Xu hướng sinh hiệu hôm nay */}
        {canViewHealth && (
          <>
            <VitalsSummaryCard
              currentVitals={currentVitals} isEdgeHubOnline={isEdgeHubOnline} braceletBattery={braceletBattery}
              isAcousticAlarm={isAcousticAlarm} isDarkMode={isDarkMode} colors={colors} navigation={navigation}
            />

            <HealthTrendsCard currentVitals={currentVitals} isDarkMode={isDarkMode} colors={colors} navigation={navigation} />
          </>
        )}
          </>
        )}
      </ScrollView>

      {/* Modal Tạm dừng chuông báo động */}
      <AlarmSnoozeModal
        visible={snoozeModalVisible} onClose={() => setSnoozeModalVisible(false)} alarmSnooze={alarmSnooze}
        selectedDuration={selectedDuration} setSelectedDuration={setSelectedDuration} selectedMode={selectedMode}
        setSelectedMode={setSelectedMode} syncAllFamily={syncAllFamily} setSyncAllFamily={setSyncAllFamily}
        remainingMinutes={remainingMinutes} isDarkMode={isDarkMode} colors={colors} onConfirm={handleConfirmSnooze}
        onCancel={handleCancelSnooze} isSnoozeActive={isSnoozeActive}
      />

      {/* Modal Lịch khám Bác sĩ */}
      <FamilyAppointmentsModal
        visible={familyAppointmentsModalVisible}
        patientId={pendingAppointmentNotice?.device_id && !isNaN(Number(pendingAppointmentNotice.device_id)) ? pendingAppointmentNotice.device_id : (patientRecord?.patient_id || 1)}
        patientName={patientRecord?.name}
        onClose={() => { setFamilyAppointmentsModalVisible(false); fetchNotifications(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  houseTitleRow: { flexDirection: 'row', alignItems: 'center' },
  houseTitleText: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  topRightActions: { flexDirection: 'row', alignItems: 'center' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  redBadgeDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.danger },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 70 },
  modesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 16 },
  modePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1.5 },
  modePillActiveAway: { backgroundColor: '#ECFDF5', borderColor: '#10B981', opacity: 1, ...Shadows.soft },
  modePillActiveHome: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', opacity: 1, ...Shadows.soft },
  modePillActiveDisarm: { backgroundColor: '#F1F5F9', borderColor: '#64748B', opacity: 1, ...Shadows.soft },
  modePillInactive: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', opacity: 0.6 },
  modePillActiveSnooze: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B', opacity: 1, ...Shadows.soft },
  modeIconCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  modePillText: { fontSize: 13, fontWeight: '700' },
  emergencyBanner: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 16, padding: 14, marginBottom: 16, ...Shadows.card },
  emergencyBannerHeader: { flexDirection: 'row', alignItems: 'center' },
  emergencySirenPulse: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  emergencyBannerTitle: { fontSize: 13, fontWeight: '800', color: '#DC2626', marginBottom: 2 },
  emergencyBannerMessage: { fontSize: 12, color: '#475569', lineHeight: 16, fontWeight: '500' },
  emergencyActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginLeft: 8, gap: 2 },
  emergencyActionBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  stableHealthCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16, gap: 8 },
  stablePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  stableHealthText: { fontSize: 12.5, fontWeight: '600' },
  sosCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#DC2626', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18, borderWidth: 1.5, borderColor: '#EF4444', ...Shadows.card },
  sosLeftContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sosIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sosTextContainer: { flex: 1 },
  sosTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosTitleText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  sosTag: { backgroundColor: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sosTagText: { color: '#DC2626', fontSize: 9, fontWeight: '900' },
  sosSubtitleText: { color: 'rgba(255, 255, 255, 0.92)', fontSize: 12, marginTop: 2, fontWeight: '500' },
  sosActionCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  multiViewCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 16, ...Shadows.card },
  multiViewText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  playCircleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  appointmentBanner: { backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1.5, borderColor: '#FDE68A', padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadows.soft },
  appointmentBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  appointmentIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  appointmentBannerTitle: { fontSize: 12, fontWeight: '800', color: '#B45309', letterSpacing: 0.3 },
  appointmentBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  appointmentBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  appointmentBannerSubtitle: { fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 16 },
  appointmentActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, gap: 2 },
  appointmentActionBtnText: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  emptyContainer: {
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Shadows.soft,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  userAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cameraBlockedCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cameraBlockedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cameraBlockedTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  cameraBlockedDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  cameraBlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  cameraBlockedBadgeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
});
