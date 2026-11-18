// ==============================================================================
// TỆP: HomeScreen.tsx
// PHÂN HỆ: Màn hình Trang chủ (Dashboard / Nhà của tôi) - Smart Elderly Care AI
// TÁC GIẢ: Phan Nguyễn Giáng My
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTheme } from '../../../store/useThemeStore';
import { systemApi } from '../../../services/api';
import { alertsWS } from '../../../services/websocket';
import { MedicationReminderWidget } from '../components/MedicationReminderWidget';
import { AlarmSnoozeModal } from '../components/AlarmSnoozeModal';
import { FamilyAppointmentsModal } from '../components/FamilyAppointmentsModal';
import { HomeAppointmentBanner, HomeStatusBanner, HomeSosCard } from '../components/home/HomeBanners';
import { HomeCameraSection } from '../components/home/HomeCameraSection';
import { HomeVitalsSection } from '../components/home/HomeVitalsSection';
import { HomeEmptyState } from '../components/home/HomeEmptyState';
import { usePatientStore } from '../../../store/usePatientStore';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';

export default function HomeScreen({ navigation }: any) {
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const {
    house, setHouseMode, camera, toggleCameraSleep, toggleCameraAIProtect,
    currentVitals, incidents, activeDevice, alarmSnooze, setAlarmSnooze,
    cancelAlarmSnooze, todayReminders, markMedicationTaken, fetchVitals,
    fetchSystemMode, fetchReminders, fetchNotifications, syncAllWithBackend,
    iotDevices, patientsList, fetchPatientsList,
  } = useVitalStore();

  const {
    userRole,
    role,
    permissions,
    fetchMyPermissions,
    has_house,
    assigned_house,
    household_id,
    has_devices,
    device_count,
  } = useAuthStore();

  // Xác định rõ ràng: Tài khoản không thuộc ngôi nhà nào (tài khoản mới hoặc vừa bị kick/rời khỏi nhà)
  const isExplicitlyNoHouse =
    (has_house === false && (house?.hasHouse === false || !house?.id) && !household_id && !assigned_house) ||
    permissions?.role_in_house === 'NEW_USER' ||
    permissions?.role_in_house === 'NONE';

  const hasLinkedHouse = !isExplicitlyNoHouse && Boolean(
    (house?.id && house?.hasHouse !== false && house?.name && house.name.trim() !== '') ||
    household_id ||
    assigned_house ||
    has_house === true ||
    permissions?.role_in_house === 'OWNER' ||
    permissions?.role_in_house === 'MEMBER' ||
    permissions?.is_owner === true
  );
  const isOwnerOrAdmin = !isExplicitlyNoHouse && Boolean(
    userRole === 'admin' ||
    role === 'admin' ||
    userRole === 'owner' ||
    role === 'owner' ||
    permissions?.is_owner === true ||
    permissions?.role_in_house === 'OWNER'
  );

  // Phân biệt 3 loại tài khoản chính xác:
  const isNewAccount = !hasLinkedHouse;
  const isMemberInLinkedHouse = hasLinkedHouse && !isOwnerOrAdmin;
  const isHouseOwner = hasLinkedHouse && isOwnerOrAdmin;

  // Quyền thêm / quản lý thiết bị
  const canManageDevices = isNewAccount || isHouseOwner || Boolean(permissions?.can_manage_devices);

  // Nhận diện thiết bị tức thì
  const hasLinkedDevices = (iotDevices || []).length > 0 || has_devices === true || (typeof device_count === 'number' && device_count > 0);
  const isUserEmptyMember = isNewAccount || (!hasLinkedDevices && !isHouseOwner && !permissions?.can_manage_devices);

  // Kiểm tra quyền xem camera và chỉ số sinh hiệu của tài khoản thành viên
  const isCameraExplicitlyBlocked = !isOwnerOrAdmin && permissions?.can_view_camera === false;
  const canViewCamera = isOwnerOrAdmin || (!isCameraExplicitlyBlocked && hasLinkedHouse);
  const canViewHealth = isOwnerOrAdmin || (hasLinkedHouse && permissions?.can_view_health !== false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { patientRecord, fetchPatientRecord } = usePatientStore();
  const lastFetchRef = React.useRef<number>(0);
  const isLoadingRef = React.useRef<boolean>(false);

  const loadDashboardData = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 8000) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    lastFetchRef.current = now;

    try {
      const calls: Promise<any>[] = [
        fetchVitals(),
        fetchSystemMode(),
        fetchReminders(),
        fetchNotifications(),
        fetchPatientRecord?.(),
        fetchPatientsList?.(),
        syncAllWithBackend?.(),
      ];
      if (force || !permissions) {
        calls.push(fetchMyPermissions?.());
      }
      await Promise.allSettled(calls);
    } finally {
      isLoadingRef.current = false;
    }
  }, [fetchVitals, fetchSystemMode, fetchReminders, fetchNotifications, fetchPatientRecord, fetchPatientsList, syncAllWithBackend, fetchMyPermissions]);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardData(true);
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

  const [familyAppointmentsModalVisible, setFamilyAppointmentsModalVisible] = useState(false);
  const [isMicSpeaking] = useState(false);
  const [nextMedTaken, setNextMedTaken] = useState(false);

  useEffect(() => {
    loadDashboardData(true);
    alertsWS.connect();
    const interval = setInterval(() => {
      fetchVitals();
    }, 20000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      loadDashboardData(false);
    });
  }, [navigation, loadDashboardData]);

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
      if (alarmSnooze?.active && alarmSnooze.until) {
        const diff = alarmSnooze.until - Date.now();
        if (diff <= 0) {
          cancelAlarmSnooze();
          setRemainingMinutes(0);
        } else {
          setRemainingMinutes(Math.max(1, Math.ceil(diff / (60 * 1000))));
        }
      } else {
        setRemainingMinutes(0);
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 10000);
    return () => clearInterval(timer);
  }, [alarmSnooze, cancelAlarmSnooze]);

  const criticalIncidents = incidents.filter(
    (i) => !i.is_acknowledged && (i.alert_level === 'CRITICAL' || i.alert_type === 'FALL_DETECTED')
  );
  const activeEmergency = criticalIncidents[0];
  const hasEmergency = Boolean(activeEmergency || (currentVitals.fall_detected && criticalIncidents.length > 0));

  useEffect(() => {
    if (criticalIncidents.length === 0 && currentVitals.fall_detected) {
      useVitalStore.getState().setVitals({ fall_detected: false });
    }
  }, [criticalIncidents.length, currentVitals.fall_detected]);

  const pendingAppointmentNotice = incidents.find(
    (i) =>
      !i.is_acknowledged &&
      (i.alert_type === 'APPOINTMENT_SCHEDULED' || i.alert_type === 'APPOINTMENT_REQUESTED')
  );

  const appointmentPatientInfo = React.useMemo(() => {
    if (!pendingAppointmentNotice) return { id: patientRecord?.patient_id || 1, name: patientRecord?.name };
    let pid: any = null;
    let pname: string | null = null;
    if (pendingAppointmentNotice.notes?.includes('PATIENT:')) {
      pid = pendingAppointmentNotice.notes.split('PATIENT:')[1].split('|')[0].trim();
    }
    if (pendingAppointmentNotice.notes?.includes('NAME:')) {
      pname = pendingAppointmentNotice.notes.split('NAME:')[1].split('|')[0].trim();
    }
    if (!pname && pendingAppointmentNotice.message) {
      const match = pendingAppointmentNotice.message.match(/cho\s+([^,]+?)\s+vào\s+/i);
      if (match && match[1]) pname = match[1].trim();
    }
    const pList = (patientsList && patientsList.length > 0) ? patientsList : (usePatientStore.getState().patientsList || []);
    if (pname && !pid) {
      const found = pList.find((p: any) => (p.name || p.full_name)?.toLowerCase().trim() === pname?.toLowerCase().trim());
      if (found) pid = found.id || found.elderly_id;
    }
    if (pid && !pname) {
      const found = pList.find((p: any) => p.id === pid || p.elderly_id === pid);
      if (found) pname = found.name || found.full_name;
    }
    return {
      id: pid || (pendingAppointmentNotice.device_id && !isNaN(Number(pendingAppointmentNotice.device_id)) ? pendingAppointmentNotice.device_id : (patientRecord?.patient_id || 1)),
      name: pname || (pid && pList.find((p: any) => p.id === pid || p.elderly_id === pid)?.name) || patientRecord?.name || 'Bệnh nhân',
    };
  }, [pendingAppointmentNotice, patientsList, patientRecord]);

  const handleConfirmSnooze = async () => {
    if (!isOwnerOrAdmin) {
      Alert.alert('Quyền truy cập bị giới hạn', 'Tài khoản Thành viên chỉ có quyền xem dữ liệu, không thể thay đổi cài đặt chuông báo động.');
      return;
    }
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
    if (!isOwnerOrAdmin) {
      Alert.alert('Quyền truy cập bị giới hạn', 'Tài khoản Thành viên chỉ có quyền xem dữ liệu, không thể thay đổi cài đặt chuông báo động.');
      return;
    }
    cancelAlarmSnooze();
    setSnoozeModalVisible(false);
    try { await systemApi.updateMode({ is_mute_alarm: false }); }
    catch (e) { console.warn('API updateMode cancel snooze error:', e); }
    Alert.alert('🔔 Đã bật lại chuông báo động', 'Chuông báo động và còi hú Loa Hub đã được kích hoạt lại ở mức bình thường.');
  };

  const handlePressSnoozeButton = () => {
    setSelectedDuration(alarmSnooze?.durationMinutes || 15);
    setSelectedMode(alarmSnooze?.mode || 'VIBRATE');
    setSyncAllFamily(alarmSnooze?.syncAll ?? true);
    setSnoozeModalVisible(true);
  };

  const handleNavigateToEmergency = () => {
    if (activeEmergency) {
      navigation.navigate('IncidentDetailScreen', {
        incidentId: activeEmergency.id,
        id: activeEmergency.id,
        incident: activeEmergency,
        alert_type: activeEmergency.alert_type,
        alert_level: activeEmergency.alert_level || 'CRITICAL',
        message: activeEmergency.message,
        confidence: activeEmergency.confidence,
        thumbnail_url: activeEmergency.thumbnail_url ?? null,
        video_clip_url: activeEmergency.video_clip_url ?? null,
        is_acknowledged: activeEmergency.is_acknowledged ?? false,
      });
    } else {
      navigation.navigate('Alerts');
    }
  };

  const handleMicPress = () => {
    navigation.navigate('CameraDetail', {
      cameraId: effectiveCamera.id,
      cameraName: cameraDisplayName,
      room: effectiveCamera.room || 'Phòng khách',
      streamUrl: effectiveCamera.streamUrl,
    });
  };

  const handleMultiView = () => {
    if (!canViewCamera) {
      Alert.alert('Không có quyền truy cập', 'Chủ hộ đã tắt quyền xem trực tiếp camera đối với tài khoản này.');
      return;
    }
    navigation.navigate('MultiView');
  };

  const handleSelectHouseMode = async (mode: 'AWAY' | 'HOME' | 'DISARM') => {
    if (!isOwnerOrAdmin) {
      Alert.alert(
        'Quyền truy cập bị giới hạn',
        'Tài khoản Thành viên chỉ có quyền xem dữ liệu, không được phép thay đổi chế độ an ninh của ngôi nhà.'
      );
      return;
    }
    if (house.currentMode === mode) return;
    setHouseMode(mode);
    const isPrivacy = mode === 'HOME';
    if (camera.isSleep !== isPrivacy) toggleCameraSleep();
    try { await systemApi.updateMode({ mode, is_camera_privacy: isPrivacy }); }
    catch (e) { console.warn('API updateMode house mode error:', e); }

    const modeAlerts: Record<'AWAY' | 'HOME' | 'DISARM', [string, string]> = {
      AWAY: ['🚶 Chế độ Xa (Away) đã kích hoạt', 'Đã kích hoạt chế độ an ninh cao nhất: Camera phòng ngủ đã mở giám sát 24/7 và sẵn sàng phát hiện té ngã. Đã lưu vào PostgreSQL.'],
      HOME: ['🏠 Chế độ Ở nhà (Home) đã kích hoạt', 'Đã kích hoạt chế độ riêng tư: Ống kính camera phòng ngủ đã tạm cụp/che lại, vẫn duy trì theo dõi nhịp tim và té ngã 24/7. Đã lưu vào PostgreSQL.'],
      DISARM: ['🛡️ Chế độ Tắt báo động (Disarm) đã kích hoạt', 'Đã tắt hoàn toàn còi hú và các thông báo báo động. Đã lưu vào PostgreSQL.'],
    };
    Alert.alert(...modeAlerts[mode]);
  };

  const handleTogglePrivacyMode = () => {
    if (!isOwnerOrAdmin) {
      Alert.alert('Quyền truy cập bị giới hạn', 'Tài khoản Thành viên chỉ có quyền xem dữ liệu, không thể bật/tắt chế độ riêng tư của camera.');
      return;
    }
    toggleCameraSleep();
    Alert.alert(
      camera.isSleep ? 'Đã mở lại ống kính camera' : 'Đã bật Chế độ riêng tư',
      camera.isSleep ? `Ống kính ${cameraDisplayName} đã mở lại và tiếp tục phát trực tiếp bình thường.` : `Ống kính ${cameraDisplayName} đã cụp lại và che khung hình. Màn hình đen riêng tư đã được kích hoạt.`
    );
  };

  const handleToggleAIProtect = () => {
    if (!isOwnerOrAdmin) {
      Alert.alert('Quyền truy cập bị giới hạn', 'Tài khoản Thành viên chỉ có quyền xem dữ liệu, không thể thay đổi cài đặt giám sát AI.');
      return;
    }
    toggleCameraAIProtect();
    Alert.alert(
      camera.isAIProtect ? '⏸️ Đã tạm dừng tính năng AI' : '🛡️ Đã bật giám sát AI thông minh',
      camera.isAIProtect ? `Đã tạm dừng các tính năng AI (nhận diện té ngã & âm thanh bất thường) cho ${cameraDisplayName}. Camera chuyển sang chế độ ghi hình thông thường.` : `Đã kích hoạt toàn bộ tính năng AI cho ${cameraDisplayName}: Bật phát hiện té ngã 24/7 và nhận diện âm thanh bất thường YAMNet.`
    );
  };

  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.max(280, windowWidth - 32);
  const [activeCamIndex, setActiveCamIndex] = useState(0);

  const cameraDevices = (iotDevices || []).filter((d) => d.type?.toLowerCase() === 'camera');
  const effectiveCameraList = cameraDevices.length > 0
    ? cameraDevices.map((dev) => ({
        ...camera,
        id: dev.id,
        name: (dev.name || 'Camera').replace(/^Camera\s+Camera\s+/i, 'Camera '),
        room: dev.location || 'Phòng giám sát',
        streamUrl: dev.streamUrl,
      }))
    : (camera?.id || camera?.streamUrl)
      ? [{ ...camera, id: camera.id, name: (camera.name || 'Camera an ninh AI').replace(/^Camera\s+Camera\s+/i, 'Camera '), room: camera.room || 'Phòng khách', streamUrl: camera.streamUrl }]
      : [];
  const hasValidCamera = effectiveCameraList.length > 0;
  const effectiveCamera = effectiveCameraList[0] || camera;
  const cameraDisplayName = (effectiveCamera?.name || 'Camera an ninh AI').replace(/^Camera\s+Camera\s+/i, 'Camera ');
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
        <TouchableOpacity
          style={styles.houseTitleRow}
          onPress={() => (hasLinkedHouse ? navigation.navigate('HouseDetail') : navigation.navigate('Profile'))}
          activeOpacity={0.7}
        >
          <Text style={[styles.houseTitleText, { color: colors.textPrimary }]}>
            {hasLinkedHouse ? (house?.name || assigned_house || 'Nhà của tôi') : 'Chưa tham gia nhà'}
          </Text>
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
          {canManageDevices && (
            <TouchableOpacity style={[styles.iconCircleBtn, { marginLeft: 8 }, isDarkMode && { backgroundColor: colors.iconBg }]} onPress={() => navigation.navigate('Devices')} activeOpacity={0.7} accessibilityLabel="Quản lý thiết bị">
              <Ionicons name="add" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
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
        {hasLinkedHouse && !isUserEmptyMember && (
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
        )}

        {/* 2.4. Banner Lịch khám Bác sĩ mới */}
        {hasLinkedHouse && pendingAppointmentNotice && (
          <HomeAppointmentBanner
            notice={pendingAppointmentNotice}
            isDarkMode={isDarkMode}
            colors={colors}
            onPress={() => setFamilyAppointmentsModalVisible(true)}
          />
        )}

        {/* 2.5. Banner Cảnh báo Khẩn cấp / Trạng thái ổn định */}
        <HomeStatusBanner
          hasEmergency={hasEmergency}
          activeEmergency={activeEmergency}
          hasLinkedHouse={hasLinkedHouse}
          isUserEmptyMember={isUserEmptyMember}
          isDarkMode={isDarkMode}
          onNavigateToEmergency={handleNavigateToEmergency}
        />

        {isUserEmptyMember ? (
          <HomeEmptyState
            isNewAccount={isNewAccount}
            isMemberInLinkedHouse={isMemberInLinkedHouse}
            canManageDevices={canManageDevices}
            isDarkMode={isDarkMode}
            colors={colors}
            onJoinHouse={() => navigation.navigate('Profile')}
            onAddDevice={() => navigation.navigate('Devices')}
            onRefresh={handleRefreshData}
          />
        ) : (
          <>
            <HomeSosCard onPress={() => navigation.navigate('EmergencySOS')} />

            <HomeCameraSection
              isCameraExplicitlyBlocked={isCameraExplicitlyBlocked}
              hasLinkedHouse={hasLinkedHouse}
              canViewCamera={canViewCamera}
              hasValidCamera={hasValidCamera}
              effectiveCameraList={effectiveCameraList}
              cardWidth={cardWidth}
              activeCamIndex={activeCamIndex}
              setActiveCamIndex={setActiveCamIndex}
              house={house}
              isDarkMode={isDarkMode}
              colors={colors}
              navigation={navigation}
              isOwnerOrAdmin={isOwnerOrAdmin}
              canManageDevices={canManageDevices}
              isMicSpeaking={isMicSpeaking}
              onMultiView={handleMultiView}
              onTogglePrivacyMode={handleTogglePrivacyMode}
              onMicPress={handleMicPress}
              onToggleAIProtect={handleToggleAIProtect}
            />

            {Boolean(nextMedication?.name) && (
              <MedicationReminderWidget
                nextMedication={nextMedication!} isMedDone={isMedDone} setNextMedTaken={setNextMedTaken}
                onConfirmTaken={(medId, timeStr) => { markMedicationTaken(medId, true, timeStr); setNextMedTaken(true); }}
                isDarkMode={isDarkMode} colors={colors} navigation={navigation}
              />
            )}

            {canViewHealth && (
              <HomeVitalsSection
                patientsList={patientsList}
                patientRecord={patientRecord}
                iotDevices={iotDevices}
                currentVitals={currentVitals}
                isEdgeHubOnline={isEdgeHubOnline}
                braceletBattery={braceletBattery}
                isAcousticAlarm={isAcousticAlarm}
                cardWidth={cardWidth}
                isDarkMode={isDarkMode}
                colors={colors}
                navigation={navigation}
              />
            )}
          </>
        )}
      </ScrollView>

      <AlarmSnoozeModal
        visible={snoozeModalVisible} onClose={() => setSnoozeModalVisible(false)} alarmSnooze={alarmSnooze}
        selectedDuration={selectedDuration} setSelectedDuration={setSelectedDuration} selectedMode={selectedMode}
        setSelectedMode={setSelectedMode} syncAllFamily={syncAllFamily} setSyncAllFamily={setSyncAllFamily}
        remainingMinutes={remainingMinutes} isDarkMode={isDarkMode} colors={colors} onConfirm={handleConfirmSnooze}
        onCancel={handleCancelSnooze} isSnoozeActive={isSnoozeActive}
      />

      <FamilyAppointmentsModal
        visible={familyAppointmentsModalVisible}
        patientId={appointmentPatientInfo.id}
        patientName={appointmentPatientInfo.name}
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
});
