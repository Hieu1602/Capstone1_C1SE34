// CameraDetailScreen.tsx
// Màn hình Camera Chi Tiết – UI chuẩn Imou Life / SmartCare AI
// Tham khảo giao diện thực tế Imou Ranger 2C

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  Linking,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

export default function CameraDetailScreen({ navigation }: any) {
  const { width: winW, height: winH } = useWindowDimensions();
  const isPortrait = winH > winW;
  const {
    camera,
    house,
    incidents,
    setCameraResolution,
    toggleCameraSleep,
    toggleCameraAIProtect,
  } = useVitalStore();

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [smartTracking, setSmartTracking] = useState(true);
  const [showAIHud, setShowAIHud] = useState(true);
  const [isLandscapeFullscreen, setIsLandscapeFullscreen] = useState(false);
  const [selectedIncidentForReplay, setSelectedIncidentForReplay] = useState<any | null>(null);

  // Flash animation cho nút chụp ảnh
  const flashAnim = useRef(new Animated.Value(0)).current;
  const snapScale = useRef(new Animated.Value(1)).current;

  const handleSnapshot = () => {
    flashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(snapScale, { toValue: 0.7, duration: 80, useNativeDriver: true }),
      Animated.spring(snapScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    Alert.alert('📸 Đã chụp ảnh!', 'Ảnh khoảnh khắc đã được lưu vào thư viện thiết bị.');
  };

  const handleRecordToggle = () => {
    setIsRecording(!isRecording);
    Alert.alert(
      isRecording ? 'Đã dừng ghi hình' : 'Đang ghi hình video cục bộ 🔴',
      isRecording ? 'Video đã được lưu vào bộ nhớ thiết bị.' : 'Đang quay trực tiếp luồng camera.'
    );
  };

  const handleMicToggle = () => {
    setIsSpeaking(!isSpeaking);
    Alert.alert(
      isSpeaking ? 'Đã tắt đàm thoại' : 'Đàm thoại 2 chiều 🎙️',
      isSpeaking
        ? 'Đã ngắt micro.'
        : 'Giọng nói của bạn đang được phát trực tiếp qua loa camera.'
    );
  };

  const handleResolutionSwitch = () => {
    const nextRes = camera.resolution === '2K' ? 'FHD' : camera.resolution === 'FHD' ? 'SD' : '2K';
    setCameraResolution(nextRes);
  };

  const handleSOS115 = () => {
    Alert.alert(
      '🚨 GỌI CẤP CỨU 115?',
      `Hành động này sẽ quay số 115 ngay lập tức.\nĐịa chỉ: "${house.address}"`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Gọi 115 Ngay', style: 'destructive', onPress: () => Linking.openURL('tel:115') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* ═══ 1. HEADER ═══ */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>{camera.name}</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => Alert.alert('Chia sẻ', 'Chia sẻ quyền xem camera cho bác sĩ gia đình.')}
          >
            <Ionicons name="add-outline" size={22} color="#0F172A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowSettingsModal(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ 2. VIDEO PLAYER ═══ */}
      <View style={styles.playerContainer}>
        {camera.isSleep ? (
          <View style={styles.privacyOverlay}>
            <View style={styles.privacyIconCircle}>
              <Ionicons name="eye-off" size={32} color="#F59E0B" />
            </View>
            <Text style={styles.privacyTitle}>Chế độ riêng tư</Text>
            <Text style={styles.privacySub}>Ống kính đã được che. Luồng trực tiếp tạm tắt.</Text>
            <TouchableOpacity style={styles.privacyBtn} onPress={toggleCameraSleep} activeOpacity={0.8}>
              <Ionicons name="eye" size={14} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.privacyBtnText}>Mở lại ống kính</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1000&q=85' }}
              style={styles.playerStream}
              resizeMode="cover"
            />
            {/* Timestamp watermark top-left */}
            <View style={styles.timestampOverlay}>
              <Text style={styles.timestampText}>15-09-2026 Hai  09:21:28</Text>
            </View>

            {/* ── AI HUD Overlays ── */}
            {camera.isAIProtect && showAIHud && (
              <>
                {/* AI badges top-right */}
                <View style={styles.aiHudTopRight}>
                  <View style={styles.aiHudBadge}>
                    <View style={[styles.aiHudDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.aiHudText}>AI Protect: ON</Text>
                  </View>
                  <View style={styles.aiHudBadge}>
                    <Ionicons name="body" size={10} color="#38BDF8" style={{ marginRight: 3 }} />
                    <Text style={styles.aiHudText}>YOLO-Pose 17KP • 32 FPS</Text>
                  </View>
                </View>

                {/* Sensor badges bottom-left */}
                <View style={styles.aiHudBottomLeft}>
                  <View style={[styles.aiHudBadge, { backgroundColor: 'rgba(245,158,11,0.88)' }]}>
                    <Ionicons name="thermometer" size={10} color="#FFF" style={{ marginRight: 3 }} />
                    <Text style={styles.aiHudText}>AMG8833: 36.8°C</Text>
                  </View>
                  <View style={[styles.aiHudBadge, { backgroundColor: 'rgba(139,92,246,0.85)' }]}>
                    <Ionicons name="mic" size={10} color="#FFF" style={{ marginRight: 3 }} />
                    <Text style={styles.aiHudText}>YAMNet: Bình thường</Text>
                  </View>
                  <View style={[styles.aiHudBadge, { backgroundColor: 'rgba(16,185,129,0.85)' }]}>
                    <Ionicons name="walk" size={10} color="#FFF" style={{ marginRight: 3 }} />
                    <Text style={styles.aiHudText}>Người: 1 • An toàn</Text>
                  </View>
                </View>

                {/* Safe zone dashed border */}
                <View style={styles.safeZoneBorder} />
              </>
            )}

            {/* Camera name watermark bottom-right */}
            <View style={styles.cameraNameOverlay}>
              <Text style={styles.cameraNameWatermark}>{camera.name}</Text>
            </View>

            {/* AI HUD toggle button */}
            {camera.isAIProtect && (
              <TouchableOpacity
                style={styles.aiToggleBtn}
                onPress={() => setShowAIHud(!showAIHud)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showAIHud ? 'eye' : 'eye-off'}
                  size={14}
                  color={showAIHud ? '#38BDF8' : '#94A3B8'}
                />
                <Text style={[styles.aiToggleText, !showAIHud && { color: '#94A3B8' }]}>
                  AI
                </Text>
              </TouchableOpacity>
            )}
            {/* Recording badge */}
            {isRecording && (
              <View style={styles.recordingBadge}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>REC</Text>
              </View>
            )}
            {/* Flash overlay */}
            <Animated.View
              pointerEvents="none"
              style={[styles.shutterFlash, { opacity: flashAnim }]}
            />
          </>
        )}
      </View>

      {/* ═══ 3. TIMELINE PROGRESS BAR ═══ */}
      <View style={styles.timelineBarContainer}>
        <View style={styles.timelineBarTrack}>
          <View style={styles.timelineBarProgress} />
        </View>
      </View>

      {/* ═══ 4. CONTROLS AREA ═══ */}
      {showControls && (
        <View style={styles.controlsArea}>
          {/* Row 1: Pause | Volume | HD | Grid | Landscape (Xoay ngang màn hình) */}
          <View style={styles.controlRow1}>
            <TouchableOpacity style={styles.controlIconBtn} onPress={() => setIsPaused(!isPaused)}>
              <Ionicons name={isPaused ? 'play' : 'pause'} size={22} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlIconBtn} onPress={() => setIsMuted(!isMuted)}>
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={22}
                color="#334155"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlIconBtn} onPress={handleResolutionSwitch}>
              <View style={styles.hdBadge}>
                <Text style={styles.hdBadgeText}>{camera.resolution}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlIconBtn}
              onPress={() => navigation.navigate('MultiView')}
            >
              <Ionicons name="grid-outline" size={22} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlIconBtn}
              onPress={() => setIsLandscapeFullscreen(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="phone-rotate-landscape" size={24} color="#334155" />
            </TouchableOpacity>
          </View>

          {/* Row 2: Playback pill | Camera | Record | Mic | PTZ control */}
          <View style={styles.controlRow2}>
            <TouchableOpacity
              style={styles.playbackPill}
              onPress={() => Alert.alert('Playback', 'Xem lại bản ghi 24/48h từ bộ đệm RAM & MinIO Cloud.')}
              activeOpacity={0.8}
            >
              <Ionicons name="play-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.playbackPillText}>Playback</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleBtn} onPress={handleSnapshot} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: snapScale }] }}>
                <Ionicons name="camera-outline" size={22} color="#334155" />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circleBtn, isRecording && styles.circleBtnActive]}
              onPress={handleRecordToggle}
              activeOpacity={0.7}
            >
              <Ionicons name="radio-button-on-outline" size={22} color={isRecording ? '#FFF' : '#334155'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circleBtn, isSpeaking && styles.circleBtnActive]}
              onPress={handleMicToggle}
              activeOpacity={0.7}
            >
              <Ionicons name="mic-outline" size={22} color={isSpeaking ? '#FFF' : '#334155'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.circleBtn}
              onPress={() => Alert.alert(
                'Điều khiển xoay Camera (PTZ)',
                'Gửi lệnh xoay camera qua MQTT tới Hub #01.\n\n↑ Lên  |  ↓ Xuống  |  ← Trái  |  → Phải\n\nImou Ranger 2C hỗ trợ xoay 355° ngang & 80° dọc.',
              )}
              activeOpacity={0.7}
            >
              <Ionicons name="move-outline" size={22} color="#334155" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Collapse / Expand chevron */}
      <TouchableOpacity
        style={styles.collapseBtn}
        onPress={() => setShowControls(!showControls)}
        activeOpacity={0.6}
      >
        <Ionicons
          name={showControls ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#94A3B8"
        />
      </TouchableOpacity>

      {/* ═══ 5. EVENT MESSAGES ═══ */}
      <View style={styles.eventSection}>
        <Text style={styles.eventSectionTitle}>Event Messages</Text>

        <ScrollView
          style={styles.eventListScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {incidents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>
                No messages. Event messages can only be kept for 7 days.
              </Text>
            </View>
          ) : (
            incidents.map((item) => {
              const isCritical = item.alert_level === 'CRITICAL';
              const isFall = item.alert_type === 'FALL_DETECTED';
              const timeStr = item.created_at.substring(11, 19);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.eventItem, isFall && styles.eventItemAlert]}
                  onPress={() => {
                    if (item.video_clip_url) {
                      setSelectedIncidentForReplay(item);
                    } else {
                      Alert.alert('Chi tiết', `${item.message}\nThời gian: ${timeStr}`);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.eventIconCircle,
                      { backgroundColor: isCritical ? '#FEE2E2' : '#FFF7ED' },
                    ]}
                  >
                    <Ionicons
                      name={
                        isFall ? 'warning' :
                          item.alert_type === 'HIGH_HEART_RATE' ? 'heart' :
                            item.alert_type === 'ACOUSTIC_DISTRESS' ? 'mic' : 'walk'
                      }
                      size={16}
                      color={isCritical ? '#EF4444' : '#F97316'}
                    />
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, isFall && { color: '#DC2626' }]} numberOfLines={1}>
                      {item.message}
                    </Text>
                    <Text style={styles.eventTime}>{timeStr}</Text>
                  </View>
                  {item.thumbnail_url ? (
                    <View style={styles.eventThumb}>
                      <Image source={{ uri: item.thumbnail_url }} style={styles.eventThumbImg} resizeMode="cover" />
                      {item.video_clip_url && (
                        <View style={styles.eventThumbPlay}>
                          <Ionicons name="play" size={10} color="#FFF" />
                        </View>
                      )}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ═══ FLOATING SOS 115 ═══ */}
      <TouchableOpacity style={styles.floatingSOS} onPress={handleSOS115} activeOpacity={0.85}>
        <Ionicons name="call" size={18} color="#FFF" />
        <Text style={styles.floatingSOSText}>SOS 115</Text>
      </TouchableOpacity>

      {/* ═══ MODAL: FULLSCREEN LANDSCAPE (XOAY NGANG) ═══ */}
      <Modal
        visible={isLandscapeFullscreen}
        transparent={false}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <View style={styles.landscapeRoot}>
          <View
            style={[
              styles.landscapeRotatedBox,
              isPortrait && {
                width: winH,
                height: winW,
                top: (winH - winW) / 2,
                left: (winW - winH) / 2,
                transform: [{ rotate: '90deg' }],
              },
            ]}
          >
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=90' }}
              style={styles.landscapeStream}
              resizeMode="cover"
            />

            {/* Top Bar: Back / Close & Title */}
            <View style={styles.landscapeTopBar}>
              <TouchableOpacity
                style={styles.landscapeCloseBtn}
                onPress={() => setIsLandscapeFullscreen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={26} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.landscapeTitle}>
                {camera.name} • 15-09-2026 Ba 09:57:17 • {camera.resolution}
              </Text>
            </View>

            {/* Bottom Bar: Snapshot, Record, Mic, Res, Rotate Exit */}
            <View style={styles.landscapeBottomBar}>
              <TouchableOpacity style={styles.landscapeIconBtn} onPress={handleSnapshot}>
                <Ionicons name="camera-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.landscapeIconBtn, isRecording && { backgroundColor: Colors.danger }]}
                onPress={handleRecordToggle}
              >
                <Ionicons name="radio-button-on" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.landscapeIconBtn, isSpeaking && { backgroundColor: Colors.danger }]}
                onPress={handleMicToggle}
              >
                <Ionicons name="mic-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.landscapeIconBtn} onPress={handleResolutionSwitch}>
                <Text style={styles.landscapeHdText}>{camera.resolution}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.landscapeIconBtn}
                onPress={() => setIsLandscapeFullscreen(false)}
              >
                <MaterialCommunityIcons name="phone-rotate-landscape" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL: CLIP REPLAY ═══ */}
      <Modal visible={Boolean(selectedIncidentForReplay)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Clip Sự Kiện 5 Giây</Text>
              <TouchableOpacity onPress={() => setSelectedIncidentForReplay(null)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalPlayer}>
              <Image
                source={{ uri: selectedIncidentForReplay?.thumbnail_url }}
                style={{ width: '100%', height: 220 }}
                resizeMode="cover"
              />
              <View style={styles.modalPlayOverlay}>
                <Ionicons name="play-circle" size={56} color="#FFF" />
              </View>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={styles.modalMsg}>{selectedIncidentForReplay?.message}</Text>
              <Text style={styles.modalSub}>
                Trích xuất tự động từ bộ đệm RAM Hub Orange Pi 5 → MinIO Cloud (FR08).
              </Text>
              <TouchableOpacity style={styles.modalSOSBtn} onPress={handleSOS115}>
                <Ionicons name="call" size={18} color="#FFF" />
                <Text style={styles.modalSOSText}>GỌI CẤP CỨU 115 NGAY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL: SETTINGS ═══ */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Cài Đặt Camera</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsCamInfo}>
              <View style={styles.settingsCamIcon}>
                <Ionicons name="camera-outline" size={22} color="#1E293B" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.settingsCamName}>{camera.name}</Text>
                <Text style={styles.settingsCamRoom}>{camera.room} • Imou Ranger 2C</Text>
              </View>
              <View style={[styles.onlinePill, !camera.isOnline && { backgroundColor: '#FEE2E2' }]}>
                <View style={[styles.onlineDot, !camera.isOnline && { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.onlineText, !camera.isOnline && { color: '#EF4444' }]}>
                  {camera.isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            <View style={styles.settingsDivider} />

            {/* Toggle: Privacy */}
            <TouchableOpacity style={styles.settingsRow} onPress={toggleCameraSleep} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <View style={styles.settingsIconBox}>
                  <Ionicons name="eye-off-outline" size={20} color="#1E293B" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.settingsRowTitle}>Chế Độ Riêng Tư</Text>
                  <Text style={styles.settingsRowSub}>Cụp ống kính, tắt luồng video</Text>
                </View>
              </View>
              <View style={[styles.toggle, camera.isSleep && styles.toggleOn]}>
                <View style={[styles.toggleThumb, camera.isSleep && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* Toggle: AI Protect */}
            <TouchableOpacity style={styles.settingsRow} onPress={toggleCameraAIProtect} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <View style={styles.settingsIconBox}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#1E293B" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.settingsRowTitle}>AI Protect (YOLO-Pose)</Text>
                  <Text style={styles.settingsRowSub}>Nhận dạng tư thế & phát hiện té ngã</Text>
                </View>
              </View>
              <View style={[styles.toggle, camera.isAIProtect && styles.toggleOn]}>
                <View style={[styles.toggleThumb, camera.isAIProtect && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* Toggle: Smart Tracking (Control) */}
            <TouchableOpacity style={styles.settingsRow} onPress={() => setSmartTracking(!smartTracking)} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <View style={styles.settingsIconBox}>
                  <Ionicons name="person-outline" size={20} color="#1E293B" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.settingsRowTitle}>Smart Tracking (Theo Dõi Đối Tượng)</Text>
                  <Text style={styles.settingsRowSub}>Tự động xoay PTZ 355° bám sát người</Text>
                </View>
              </View>
              <View style={[styles.toggle, smartTracking && styles.toggleOn]}>
                <View style={[styles.toggleThumb, smartTracking && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* Toggle: Microphone / Intercom */}
            <TouchableOpacity style={styles.settingsRow} onPress={handleMicToggle} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <View style={styles.settingsIconBox}>
                  <Ionicons name="mic-outline" size={20} color="#1E293B" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.settingsRowTitle}>Microphone & Đàm Thoại 2 Chiều</Text>
                  <Text style={styles.settingsRowSub}>Thu âm và đàm thoại trực tiếp qua camera</Text>
                </View>
              </View>
              <View style={[styles.toggle, isSpeaking && styles.toggleOn]}>
                <View style={[styles.toggleThumb, isSpeaking && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            <View style={styles.settingsDivider} />

            {/* Resolution */}
            <Text style={styles.settingsLabel}>Độ Phân Giải</Text>
            <View style={styles.resRow}>
              {(['2K', 'FHD', 'SD'] as const).map((res) => {
                const active = camera.resolution === res;
                return (
                  <TouchableOpacity
                    key={res}
                    style={[styles.resChip, active && styles.resChipActive]}
                    onPress={() => setCameraResolution(res)}
                  >
                    <Text style={[styles.resChipText, active && styles.resChipTextActive]}>{res}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Hardware */}
            <View style={styles.hwBox}>
              <View style={styles.hwRow}>
                <Text style={styles.hwKey}>Bộ đệm RAM</Text>
                <Text style={styles.hwVal}>5 giây (FR08)</Text>
              </View>
              <View style={styles.hwRow}>
                <Text style={styles.hwKey}>Mã thiết bị</Text>
                <Text style={styles.hwVal}>{camera.id}</Text>
              </View>
              <View style={[styles.hwRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.hwKey}>Stream URL</Text>
                <Text style={[styles.hwVal, { color: '#0284C7' }]}>{camera.streamUrl}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FA',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Video Player ──
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  playerStream: {
    width: '100%',
    height: '100%',
  },
  timestampOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  timestampText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  cameraNameOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  cameraNameWatermark: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  recordingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginRight: 5,
  },
  recordingText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 10,
  },
  shutterFlash: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#FFFFFF',
    zIndex: 20,
  },

  // Privacy overlay
  privacyOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  privacyTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  privacySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 14,
  },
  privacyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  privacyBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── AI HUD Overlays ──
  aiHudTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 4,
    alignItems: 'flex-end',
    zIndex: 3,
  },
  aiHudBottomLeft: {
    position: 'absolute',
    bottom: 28,
    left: 8,
    gap: 4,
    zIndex: 3,
  },
  aiHudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  aiHudDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  aiHudText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  safeZoneBorder: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    right: '10%',
    bottom: '20%',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderStyle: 'dashed',
    borderRadius: 8,
    zIndex: 2,
  },
  aiToggleBtn: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    zIndex: 4,
  },
  aiToggleText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Timeline Progress Bar ──
  timelineBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#FFF',
  },
  timelineBarTrack: {
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 1.5,
  },
  timelineBarProgress: {
    width: '45%',
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 1.5,
  },

  // ── Controls Area ──
  controlsArea: {
    backgroundColor: '#FFF',
    paddingTop: 8,
    paddingBottom: 4,
  },
  controlRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  controlIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdBadge: {
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hdBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  controlRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  playbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  playbackPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  circleBtnActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },

  // ── Collapse chevron ──
  collapseBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  // ── Event Messages ──
  eventSection: {
    flex: 1,
    backgroundColor: '#F6F8FA',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  eventSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  eventListScroll: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    ...Shadows.soft,
  },
  eventItemAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  eventIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContent: {
    flex: 1,
    marginLeft: 10,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  eventThumb: {
    width: 50,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    marginLeft: 8,
  },
  eventThumbImg: {
    width: '100%',
    height: '100%',
  },
  eventThumbPlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Floating SOS ──
  floatingSOS: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    ...Shadows.soft,
  },
  floatingSOSText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Modal: Clip Replay ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalPlayer: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
    position: 'relative',
  },
  modalPlayOverlay: {
    ...(StyleSheet.absoluteFill as object),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalMsg: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalSOSBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  modalSOSText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Modal: Settings ──
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  settingsCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  settingsCamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingsCamIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  settingsCamName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsCamRoom: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingsRowSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  resRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  resChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  resChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  resChipText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#64748B',
  },
  resChipTextActive: {
    color: Colors.primary,
  },
  hwBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hwRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  hwKey: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  hwVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  // Toggle
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },

  // ── Landscape Fullscreen (Xoay Ngang) ──
  landscapeRoot: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  landscapeRotatedBox: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeStream: {
    width: '100%',
    height: '100%',
  },
  landscapeTopBar: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
    zIndex: 10,
  },
  landscapeCloseBtn: {
    padding: 2,
  },
  landscapeTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  landscapeBottomBar: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
    zIndex: 10,
  },
  landscapeIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeHdText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
});