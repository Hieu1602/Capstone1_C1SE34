// HomeScreen.tsx
// Màn hình Trang chủ Smart Home / Elderly Care AI
// Tích hợp One-Touch SOS 115, Camera WebRTC & Playback 24/48h, Sinh hiệu & Âm thanh YAMNet, Sự cố gần đây

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
  Platform,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

// Hàm sao chép clipboard an toàn hỗ trợ cả native và web
const copyAddressToClipboard = (text: string) => {
  try {
    if (Clipboard && typeof Clipboard.setString === 'function') {
      Clipboard.setString(text);
    } else if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      (navigator as any).clipboard
    ) {
      (navigator as any).clipboard.writeText(text);
    }
  } catch (e) {
    console.warn('Clipboard write error:', e);
  }
};

export default function HomeScreen({ navigation }: any) {
  const {
    house,
    setHouseMode,
    camera,
    toggleCameraSleep,
    toggleCameraAIProtect,
    currentVitals,
    incidents,
    activeDevice,
  } = useVitalStore();

  const [isMicSpeaking, setIsMicSpeaking] = useState(false);

  // Xử lý One-Touch SOS 115
  const handleSOS115 = () => {
    // Tự động sao chép địa chỉ nhà vào Clipboard
    copyAddressToClipboard(house.address);

    // Kích hoạt quay số nhanh đến 115
    Linking.openURL('tel:115').catch(() => {
      console.log('Thiết bị không hỗ trợ cuộc gọi viễn thông trực tiếp');
    });

    // Thông báo Toast/Alert kèm địa chỉ đã sao chép
    Alert.alert(
      '🚨 ĐÃ KÍCH HOẠT ONE-TOUCH SOS 115',
      `Đã sao chép địa chỉ nhà và mở cuộc gọi cấp cứu 115.\n\n📍 Địa chỉ đã sao chép:\n"${house.address}"\n\nBạn có thể dán hoặc đọc trực tiếp địa chỉ này cho tổng đài viên cấp cứu.`,
      [
        { text: 'Đóng', style: 'cancel' },
        {
          text: 'Quay số 115 lại',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:115'),
        },
      ]
    );
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

  const handleSelectHouseMode = (mode: 'AWAY' | 'HOME' | 'DISARM') => {
    // Radio / Segmented Control: Nếu đã chọn mode này thì giữ nguyên
    if (house.currentMode === mode) return;

    setHouseMode(mode);

    if (mode === 'AWAY') {
      Alert.alert(
        '🚶 Chế độ Xa (Away) đã kích hoạt',
        'Đã kích hoạt chế độ an ninh cao nhất: Tối đa độ nhạy cảm biến, phát hiện té ngã và chuông báo động 24/7. Camera tiếp tục phát trực tiếp bình thường.'
      );
    } else if (mode === 'HOME') {
      Alert.alert(
        '🏠 Chế độ Ở nhà (Home) đã kích hoạt',
        'Đã giảm mức báo động xâm nhập khi gia đình sinh hoạt, nhưng vẫn duy trì theo dõi té ngã và sinh hiệu trực tiếp 24/7.'
      );
    } else if (mode === 'DISARM') {
      Alert.alert(
        '🛡️ Chế độ Tắt báo động (Disarm) đã kích hoạt',
        'Đã tắt hoàn toàn còi hú và các thông báo báo động. Camera vẫn mở và hiển thị luồng trực tiếp bình thường.'
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
  const braceletBattery = currentVitals.bracelet_battery ?? 88;
  const acousticStatus = currentVitals.acoustic_status ?? 'Bình thường';
  const isAcousticAlarm = acousticStatus.includes('la hét') || acousticStatus.includes('va đập');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header: "Nhà của tôi v", Bell with badge, Add button */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.houseTitleRow}
          onPress={() => navigation.navigate('HouseDetail')}
          activeOpacity={0.7}
        >
          <Text style={styles.houseTitleText}>{house.name}</Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textPrimary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <View style={styles.topRightActions}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => navigation.navigate('Alerts')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            <View style={styles.redBadgeDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconCircleBtn, { marginLeft: 12 }]}
            onPress={() => navigation.navigate('Devices')}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

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
            ]}
            onPress={() => handleSelectHouseMode('AWAY')}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.modeIconCircle,
                { backgroundColor: house.currentMode === 'AWAY' ? '#10B981' : '#E2E8F0' },
              ]}
            >
              <Ionicons
                name="exit-outline"
                size={14}
                color={house.currentMode === 'AWAY' ? '#FFF' : '#94A3B8'}
              />
            </View>
            <Text
              style={[
                styles.modePillText,
                { color: house.currentMode === 'AWAY' ? '#047857' : '#94A3B8' },
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
            ]}
            onPress={() => handleSelectHouseMode('HOME')}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.modeIconCircle,
                { backgroundColor: house.currentMode === 'HOME' ? '#3B82F6' : '#E2E8F0' },
              ]}
            >
              <Ionicons
                name="home"
                size={14}
                color={house.currentMode === 'HOME' ? '#FFF' : '#94A3B8'}
              />
            </View>
            <Text
              style={[
                styles.modePillText,
                { color: house.currentMode === 'HOME' ? '#1D4ED8' : '#94A3B8' },
              ]}
              numberOfLines={1}
            >
              Ở nhà
            </Text>
          </TouchableOpacity>

          {/* Nút 3: Tắt báo động / Bỏ canh gác (Disarm) */}
          <TouchableOpacity
            style={[
              styles.modePill,
              house.currentMode === 'DISARM' ? styles.modePillActiveDisarm : styles.modePillInactive,
            ]}
            onPress={() => handleSelectHouseMode('DISARM')}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.modeIconCircle,
                { backgroundColor: house.currentMode === 'DISARM' ? '#64748B' : '#E2E8F0' },
              ]}
            >
              <MaterialCommunityIcons
                name="shield-off-outline"
                size={15}
                color={house.currentMode === 'DISARM' ? '#FFF' : '#94A3B8'}
              />
            </View>
            <Text
              style={[
                styles.modePillText,
                { color: house.currentMode === 'DISARM' ? '#1E293B' : '#94A3B8' },
              ]}
              numberOfLines={1}
            >
              Tắt báo động
            </Text>
          </TouchableOpacity>
        </View>

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
                Quay số 115 &amp; tự động sao chép địa chỉ nhà
              </Text>
            </View>
          </View>

          <View style={styles.sosActionCircle}>
            <Ionicons name="arrow-forward" size={18} color={Colors.danger} />
          </View>
        </TouchableOpacity>

        {/* 4. Banner "Nhiều chế độ xem" (Multi-view) */}
        <TouchableOpacity
          style={styles.multiViewCard}
          onPress={handleMultiView}
          activeOpacity={0.9}
        >
          <Text style={styles.multiViewText}>Nhiều chế độ xem</Text>
          <View style={styles.playCircleBtn}>
            <Ionicons name="play" size={14} color={Colors.primary} style={{ marginLeft: 2 }} />
          </View>
        </TouchableOpacity>

        {/* 6. Main Camera Device Card (Live View & Playback) */}
        <View style={styles.cameraCard}>
          {/* Card Video Area (Clickable to open CameraDetail) */}
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => navigation.navigate('CameraDetail')}
            style={styles.cameraPreviewBox}
          >
            {/* Ảnh phòng khách thực tế của người cao tuổi */}
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
              }}
              style={styles.cameraSnapshot}
              resizeMode="cover"
            />

            {/* Live Stream Overlay Header: Tên thiết bị thân thiện & Badge WebRTC / Edge Hub */}
            <View style={styles.cameraOverlayTop}>
              <View style={styles.cameraTitleWithBadge}>
                <Text style={styles.cameraNameOverlay} numberOfLines={1}>
                  {cameraDisplayName}
                </Text>
                {/* Badge trạng thái kết nối WebRTC / Live */}
                {camera.isSleep ? (
                  <View style={styles.privacyLiveBadge}>
                    <Ionicons name="eye-off" size={10} color="#F59E0B" style={{ marginRight: 4 }} />
                    <Text style={styles.privacyLiveBadgeText}>Ống kính riêng tư • Đã che</Text>
                  </View>
                ) : !camera.isAIProtect ? (
                  <View style={styles.normalModeBadge}>
                    <View style={styles.normalGrayDot} />
                    <Text style={styles.normalModeBadgeText}>Chế độ thường • AI Tắt</Text>
                  </View>
                ) : house.currentMode === 'AWAY' ? (
                  <View style={styles.awayLiveBadge}>
                    <View style={styles.liveGreenDot} />
                    <Text style={styles.awayLiveBadgeText}>Vắng nhà • AI Giám sát 24/7</Text>
                  </View>
                ) : house.currentMode === 'DISARM' ? (
                  <View style={styles.disarmLiveBadge}>
                    <MaterialCommunityIcons name="shield-off-outline" size={11} color="#E2E8F0" style={{ marginRight: 4 }} />
                    <Text style={styles.disarmLiveBadgeText}>Tắt báo động • AI Trực tiếp</Text>
                  </View>
                ) : (
                  <View style={styles.liveWebRTCBadge}>
                    <View style={styles.liveGreenDot} />
                    <Text style={styles.liveWebRTCText}>Ở nhà • AI WebRTC</Text>
                  </View>
                )}
              </View>

              <View style={styles.cameraStatusIcons}>
                <View style={styles.hubStatusPill}>
                  <Text style={styles.hubStatusPillText}>Hub #01 Online</Text>
                </View>
                <Ionicons name="wifi" size={14} color="#10B981" style={{ marginLeft: 6 }} />
                <TouchableOpacity
                  style={{ marginLeft: 8 }}
                  onPress={() => navigation.navigate('CameraDetail')}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* SmartCare Watermark góc dưới phải */}
            <View style={styles.watermarkTag}>
              <Text style={styles.watermarkText}>SmartCare AI</Text>
            </View>

            {/* Privacy Mode Overlay: Màn hình đen che camera vật lý khi camera.isSleep = true */}
            {camera.isSleep ? (
              <View style={styles.privacyOverlay}>
                <View style={styles.privacyIconCircle}>
                  <Ionicons name="eye-off" size={32} color="#F59E0B" />
                </View>
                <Text style={styles.privacyOverlayTitle}>Ống kính đang ở chế độ riêng tư</Text>
                <Text style={styles.privacyOverlaySub}>
                  Ống kính camera đã cụp lại và che khung hình. Luồng trực tiếp tạm thời tắt.
                </Text>
                <TouchableOpacity
                  style={styles.privacyDisableBtn}
                  onPress={handleTogglePrivacyMode}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye" size={14} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.privacyDisableText}>Mở lại ống kính</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* NÚT TRUY CẬP NHANH: "Xem lại 24/48h" (Interactive Timeline Playback) ngay bên dưới video */}
          <TouchableOpacity
            style={styles.playbackQuickBar}
            onPress={() => navigation.navigate('CameraDetail')}
            activeOpacity={0.8}
          >
            <View style={styles.playbackLeftBox}>
              <View style={styles.playbackIconCircle}>
                <Ionicons name="play-back" size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.playbackTitle}>Xem lại 24/48h (Interactive Timeline Playback)</Text>
                <Text style={styles.playbackSub}>Bộ đệm RAM Edge Hub &amp; lưu trữ MinIO Cloud</Text>
              </View>
            </View>
            <View style={styles.playbackRightAction}>
              <Text style={styles.playbackBadgeText}>24h - 48h</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </View>
          </TouchableOpacity>

          {/* 3 Quick Action Buttons Under Video (Power/Standby, Mic, AI Shield) */}
          <View style={styles.cameraBottomToolbar}>
            {/* 1. Nút Chế độ riêng tư của camera (Con mắt: eye / eye-off) */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleTogglePrivacyMode}
              activeOpacity={0.7}
            >
              <View style={styles.cameraPrivacyContainer}>
                <Ionicons
                  name={camera.isSleep ? 'eye-off' : 'eye-outline'}
                  size={20}
                  color={camera.isSleep ? '#F59E0B' : Colors.textPrimary}
                />
                <Text
                  style={[
                    styles.cameraPrivacyText,
                    { color: camera.isSleep ? '#D97706' : Colors.textPrimary },
                  ]}
                >
                  Riêng tư
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.toolDivider} />

            {/* 2. Nút Đàm thoại 2 chiều (Micro ở giữa) */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleMicPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isMicSpeaking ? 'mic' : 'mic-outline'}
                size={22}
                color={isMicSpeaking ? Colors.danger : Colors.textPrimary}
              />
            </TouchableOpacity>

            <View style={styles.toolDivider} />

            {/* 3. Nút Chế độ bảo vệ AI (Khiên AI) */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleToggleAIProtect}
              activeOpacity={0.7}
            >
              <View style={styles.aiShieldContainer}>
                {camera.isAIProtect ? (
                  <Ionicons
                    name="shield-checkmark"
                    size={18}
                    color="#2563EB"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="shield-off-outline"
                    size={18}
                    color="#94A3B8"
                  />
                )}
                <Text
                  style={[
                    styles.aiShieldText,
                    { color: camera.isAIProtect ? '#2563EB' : '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {camera.isAIProtect ? 'AI Bảo vệ: Bật' : 'AI: Tắt'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. Khối hiển thị Tình trạng sức khoẻ (lấy từ useVitalStore) */}
        <View style={styles.vitalsSummaryCard}>
          {/* Header Card */}
          <View style={styles.vitalsSummaryHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.livePulseDot} />
              <Text style={styles.vitalsSummaryTitle}>Tình trạng sức khoẻ</Text>
            </View>
            <TouchableOpacity
              style={styles.vitalsDetailChip}
              onPress={() => navigation.navigate('HealthDetail')}
              activeOpacity={0.7}
            >
              <Text style={styles.vitalsDetailChipText}>Chi tiết</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Thanh trạng thái Thiết bị & Hub: Edge Hub Online/Offline & % Pin vòng BLE */}
          <View style={styles.deviceStatusBar}>
            <View style={styles.deviceStatusItem}>
              <Ionicons
                name="hardware-chip-outline"
                size={14}
                color={isEdgeHubOnline ? Colors.success : Colors.danger}
              />
              <Text style={styles.deviceStatusText}>
                Edge Hub:{' '}
                <Text
                  style={{
                    color: isEdgeHubOnline ? Colors.success : Colors.danger,
                    fontWeight: '700',
                  }}
                >
                  {isEdgeHubOnline ? 'Online' : 'Offline'}
                </Text>
              </Text>
            </View>

            <View style={styles.deviceStatusDivider} />

            <View style={styles.deviceStatusItem}>
              <Ionicons name="battery-charging" size={15} color={Colors.aiBlue} />
              <Text style={styles.deviceStatusText}>
                Vòng BLE:{' '}
                <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>
                  {braceletBattery}% Pin
                </Text>
              </Text>
            </View>
          </View>

          {/* Lưới 5 chỉ số sinh hiệu: Nhịp tim, SpO2, AMG8833, YOLO-Pose, Acoustic/YAMNet */}
          <View style={styles.vitalsGrid}>
            {/* Nhịp tim */}
            <View style={styles.vitalItem}>
              <Ionicons name="heart" size={17} color="#EF4444" />
              <Text style={styles.vitalValText} numberOfLines={1}>
                {currentVitals.heart_rate ?? 74}{' '}
                <Text style={styles.vitalUnit}>bpm</Text>
              </Text>
              <Text style={styles.vitalLblText}>Nhịp tim</Text>
            </View>
            <View style={styles.vitalDivider} />

            {/* SpO2 */}
            <View style={styles.vitalItem}>
              <Ionicons name="water" size={17} color="#3B82F6" />
              <Text style={styles.vitalValText} numberOfLines={1}>
                {currentVitals.spo2 ?? 98}{' '}
                <Text style={styles.vitalUnit}>%</Text>
              </Text>
              <Text style={styles.vitalLblText}>SpO₂</Text>
            </View>
            <View style={styles.vitalDivider} />

            {/* Thân nhiệt AMG8833 */}
            <View style={styles.vitalItem}>
              <Ionicons name="thermometer" size={17} color="#F59E0B" />
              <Text style={styles.vitalValText} numberOfLines={1}>
                {currentVitals.skin_temp_max ?? 36.8}{' '}
                <Text style={styles.vitalUnit}>°C</Text>
              </Text>
              <Text style={styles.vitalLblText}>AMG8833</Text>
            </View>
            <View style={styles.vitalDivider} />

            {/* Tư thế YOLO-Pose */}
            <View style={styles.vitalItem}>
              <Ionicons
                name="body"
                size={17}
                color={currentVitals.fall_detected ? Colors.danger : Colors.success}
              />
              <Text
                style={[
                  styles.vitalValText,
                  {
                    fontSize: 12,
                    color: currentVitals.fall_detected ? Colors.danger : Colors.success,
                  },
                ]}
                numberOfLines={1}
              >
                {currentVitals.fall_detected ? 'Ngã!' : 'Bình thường'}
              </Text>
              <Text style={styles.vitalLblText}>YOLO-Pose</Text>
            </View>
            <View style={styles.vitalDivider} />

            {/* Kênh âm thanh Acoustic / YAMNet */}
            <View style={styles.vitalItem}>
              <Ionicons
                name={isAcousticAlarm ? 'warning' : 'mic'}
                size={17}
                color={isAcousticAlarm ? Colors.danger : '#8B5CF6'}
              />
              <Text
                style={[
                  styles.vitalValText,
                  {
                    fontSize: 12,
                    color: isAcousticAlarm ? Colors.danger : '#8B5CF6',
                  },
                ]}
                numberOfLines={1}
              >
                {isAcousticAlarm ? 'La hét!' : 'Bình thường'}
              </Text>
              <Text style={styles.vitalLblText}>YAMNet</Text>
            </View>
          </View>
        </View>

        {/* 7. Khối "Xu hướng sức khoẻ hôm nay" (Tổng quan mini dễ hiểu cho người nhà) */}
        <View style={styles.trendSectionContainer}>
          <View style={styles.trendSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="stats-chart" size={17} color={Colors.primary} />
              <Text style={styles.trendSectionTitle}>Xu hướng sức khoẻ hôm nay</Text>
            </View>
            <View style={styles.trendStandardBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#15803D" />
              <Text style={styles.trendStandardBadgeText}>Đạt chuẩn</Text>
            </View>
          </View>

          {/* Hàng 2 thẻ biểu đồ mini */}
          <View style={styles.miniChartsRow}>
            {/* Thẻ 1: Biểu đồ nhịp tim 12h qua */}
            <View style={styles.miniChartCard}>
              <View style={styles.miniCardTop}>
                <Text style={styles.miniCardTitle}>Nhịp tim 12h qua</Text>
                <View style={styles.miniCardBadge}>
                  <Text style={styles.miniCardBadgeText}>TB 74</Text>
                </View>
              </View>

              {/* Mini bar chart */}
              <View style={styles.miniBarChartArea}>
                <View style={styles.miniDashedRefLine}>
                  <View style={styles.miniDashedDash} />
                  <Text style={styles.miniRefLabel}>74 bpm</Text>
                </View>

                <View style={styles.miniBarsRow}>
                  {[
                    { time: '06h', val: 70 },
                    { time: '08h', val: 74 },
                    { time: '10h', val: 82 },
                    { time: '12h', val: 72 },
                    { time: '14h', val: 76 },
                    { time: '16h', val: 74 },
                  ].map((col) => {
                    const height = Math.max(14, ((col.val - 50) / 45) * 44);
                    const isHigh = col.val >= 80;
                    return (
                      <View key={col.time} style={styles.miniBarCol}>
                        <Text style={styles.miniBarValText}>{col.val}</Text>
                        <View style={styles.miniBarTrack}>
                          <View
                            style={[
                              styles.miniBarFill,
                              {
                                height,
                                backgroundColor: isHigh ? '#F59E0B' : '#10B981',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.miniBarTimeText}>{col.time}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.miniCardFooter}>
                <View style={styles.miniStatusDotGreen} />
                <Text style={styles.miniStatusNote}>Chuẩn 60-100 bpm</Text>
              </View>
            </View>

            {/* Thẻ 2: Mức độ vận động & sinh hoạt */}
            <View style={styles.miniChartCard}>
              <View style={styles.miniCardTop}>
                <Text style={styles.miniCardTitle}>Vận động & Sinh hoạt</Text>
                <Ionicons name="body" size={15} color="#0284C7" />
              </View>

              {/* Stacked progress bar (25% Xanh lá, 45% Xanh dương, 30% Tím) */}
              <View style={styles.stackedBarTrack}>
                <View style={[styles.stackedSegment, { flex: 25, backgroundColor: '#10B981' }]} />
                <View style={[styles.stackedSegment, { flex: 45, backgroundColor: '#0284C7' }]} />
                <View style={[styles.stackedSegment, { flex: 30, backgroundColor: '#8B5CF6' }]} />
              </View>

              {/* Chú thích stacked bar */}
              <View style={styles.stackedLegendGrid}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Đi lại 25%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
                  <Text style={styles.legendText}>Ngồi 45%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={styles.legendText}>Nghỉ 30%</Text>
                </View>
              </View>

              <View style={styles.activitySummaryCard}>
                <Text style={styles.activitySummaryText}>
                  Vận động: <Text style={styles.boldGreen}>2.5h</Text> | Nghỉ: <Text style={styles.boldBlue}>6h</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Thẻ 3: Toàn chiều rộng bên dưới - Thước đo Oxy máu SpO2 */}
          <View style={styles.spo2GaugeCard}>
            <View style={styles.spo2CardTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.spo2IconCircle}>
                  <Ionicons name="water" size={16} color="#0284C7" />
                </View>
                <Text style={styles.spo2CardTitle}>Chỉ số Oxy máu SpO₂</Text>
              </View>
              <View style={styles.spo2BadgeGreen}>
                <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                <Text style={styles.spo2BadgeGreenText}>98% - Rất tốt</Text>
              </View>
            </View>

            {/* Thước đo ngang SpO2 từ 90% đến 100% */}
            <View style={styles.rulerContainer}>
              <View style={styles.rulerTrackBg}>
                {/* Vùng cảnh báo < 95% (50% thanh đo) */}
                <View style={styles.rulerZoneWarning} />
                {/* Vùng an toàn >= 95% (50% thanh đo) */}
                <View style={styles.rulerZoneSafe} />
                {/* Con trỏ mốc 98% (vị trí 80% từ 90->100) */}
                <View style={[styles.rulerMarkerPin, { left: '80%' }]}>
                  <View style={styles.rulerPointerArrow} />
                  <View style={styles.rulerPointerDot} />
                </View>
              </View>

              {/* Các mốc số trên thước đo */}
              <View style={styles.rulerTicksRow}>
                <Text style={styles.rulerTickText}>90%</Text>
                <Text style={styles.rulerTickText}>92%</Text>
                <Text style={[styles.rulerTickText, { fontWeight: '700', color: Colors.primary }]}>95% (Chuẩn)</Text>
                <Text style={[styles.rulerTickText, { fontWeight: '800', color: '#15803D' }]}>98%</Text>
                <Text style={styles.rulerTickText}>100%</Text>
              </View>
            </View>

            <View style={styles.spo2FooterRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#15803D" />
              <Text style={styles.spo2FooterNote}>
                Ngưỡng an toàn ≥ 95% • Nồng độ oxy bão hoà duy trì tối ưu
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  // Section Header "Tất cả thiết bị"
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  viewLayoutIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLineSmall: {
    width: 1,
    height: 14,
    backgroundColor: Colors.borderDark,
    marginRight: 8,
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
  // Camera Card (Ranger 2C)
  cameraCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    ...Shadows.card,
  },
  cameraPreviewBox: {
    width: '100%',
    height: 200,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  cameraSnapshot: {
    width: '100%',
    height: '100%',
  },
  cameraOverlayTop: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cameraTitleWithBadge: {
    flexDirection: 'column',
    maxWidth: '55%',
  },
  cameraNameOverlay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  liveWebRTCBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  liveWebRTCText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  privacyLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  privacyLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FDE68A',
  },
  alarmLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  alarmRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 4,
  },
  alarmLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FECACA',
  },
  disarmLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  disarmLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  normalModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(100, 116, 139, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  normalGrayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginRight: 4,
  },
  normalModeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  awayLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  awayLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  cameraPausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(100, 116, 139, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pausedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginRight: 4,
  },
  cameraPausedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  cameraStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hubStatusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.8,
    borderColor: '#10B981',
  },
  hubStatusPillText: {
    color: '#E6F9F5',
    fontSize: 10,
    fontWeight: '700',
  },
  watermarkTag: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  watermarkText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  sleepOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepOverlayText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
  privacyOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  privacyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  privacyOverlayTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  privacyOverlaySub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  privacyDisableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  privacyDisableText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cameraPausedOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cameraPausedIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  cameraPausedTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  cameraPausedSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  cameraResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  cameraResumeBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  // Nút truy cập nhanh: Xem lại 24/48h
  playbackQuickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playbackLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playbackIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  playbackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  playbackSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  playbackRightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playbackBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cameraBottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
  },
  toolBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  aiShieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiShieldText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cameraPowerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cameraPowerText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cameraPrivacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cameraPrivacyText: {
    fontSize: 12,
    fontWeight: '800',
  },
  // Vitals Summary Card
  vitalsSummaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    ...Shadows.soft,
  },
  vitalsSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  vitalsSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vitalsDetailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.15)',
  },
  vitalsDetailChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B00',
  },
  deviceStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  deviceStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deviceStatusText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deviceStatusDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.borderDark,
  },
  vitalsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  vitalItem: {
    alignItems: 'center',
    flex: 1,
  },
  vitalValText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  vitalUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  vitalLblText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  vitalDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  // 7. Khối Xu hướng sức khoẻ hôm nay (Health Trends Overview)
  trendSectionContainer: {
    marginTop: 18,
    marginBottom: 8,
  },
  trendSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trendSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  trendStandardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendStandardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  miniChartsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  miniChartCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Shadows.soft,
  },
  miniCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  miniCardBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  miniCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  miniBarChartArea: {
    height: 78,
    justifyContent: 'flex-end',
    position: 'relative',
    marginVertical: 4,
  },
  miniDashedRefLine: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  miniDashedDash: {
    flex: 1,
    height: 1,
    borderWidth: 0.8,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  miniRefLabel: {
    fontSize: 8,
    color: '#94A3B8',
    marginLeft: 3,
    fontWeight: '600',
  },
  miniBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 66,
  },
  miniBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  miniBarValText: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  miniBarTrack: {
    width: 8,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  miniBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  miniBarTimeText: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
  miniCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  miniStatusDotGreen: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  miniStatusNote: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  stackedBarTrack: {
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 8,
  },
  stackedSegment: {
    height: '100%',
  },
  stackedLegendGrid: {
    gap: 4,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activitySummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginTop: 'auto',
  },
  activitySummaryText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  boldGreen: {
    fontWeight: '700',
    color: '#10B981',
  },
  boldBlue: {
    fontWeight: '700',
    color: '#0284C7',
  },
  spo2GaugeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
    ...Shadows.soft,
  },
  spo2CardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  spo2IconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spo2CardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  spo2BadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spo2BadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  rulerContainer: {
    marginBottom: 10,
  },
  rulerTrackBg: {
    height: 14,
    flexDirection: 'row',
    borderRadius: 7,
    overflow: 'visible',
    position: 'relative',
    marginBottom: 6,
  },
  rulerZoneWarning: {
    flex: 50,
    height: 14,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
    backgroundColor: '#FED7AA',
  },
  rulerZoneSafe: {
    flex: 50,
    height: 14,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: '#86EFAC',
  },
  rulerMarkerPin: {
    position: 'absolute',
    top: -6,
    marginLeft: -7,
    alignItems: 'center',
    zIndex: 2,
  },
  rulerPointerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#15803D',
  },
  rulerPointerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#15803D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: 1,
    ...Shadows.soft,
  },
  rulerTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 8,
  },
  rulerTickText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  spo2FooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  spo2FooterNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
