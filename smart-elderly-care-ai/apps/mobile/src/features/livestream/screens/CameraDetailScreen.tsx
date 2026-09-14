// CameraDetailScreen.tsx
// Màn hình Camera Chi Tiết & Dòng thời gian sự kiện khớp chính xác Hình 4 (Phong cách Imou Ranger 2C / SmartCare AI)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

export default function CameraDetailScreen({ navigation }: any) {
  const {
    camera,
    house,
    incidents,
    setCameraResolution,
    selectedDate,
    setSelectedDate,
  } = useVitalStore();

  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSkeletonPose, setShowSkeletonPose] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'PLAYBACK' | 'EVENTS' | 'CLOUD' | 'PROTECT'>('EVENTS');
  const [selectedIncidentForReplay, setSelectedIncidentForReplay] = useState<any | null>(null);

  const handleSpeakerToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleRecordToggle = () => {
    setIsRecording(!isRecording);
    Alert.alert(
      isRecording ? 'Đã dừng ghi hình' : 'Đang ghi hình video cục bộ 🔴',
      isRecording ? 'Video đã được lưu vào bộ nhớ thiết bị.' : 'Đang quay trực tiếp luồng camera 2K.'
    );
  };

  const handleMicToggle = () => {
    setIsSpeaking(!isSpeaking);
    Alert.alert(
      isSpeaking ? 'Đã tắt đàm thoại' : 'Đang kết nối đàm thoại 2 chiều 🎙️',
      isSpeaking
        ? 'Đã ngắt micro.'
        : 'Giọng nói của bạn đang được phát trực tiếp qua loa camera cho người cao tuổi.'
    );
  };

  const handleSnapshot = () => {
    Alert.alert('Chụp ảnh màn hình', 'Đã chụp ảnh khoảnh khắc và lưu vào thư viện.');
  };

  const handleResolutionSwitch = () => {
    const nextRes = camera.resolution === '2K' ? 'FHD' : camera.resolution === 'FHD' ? 'SD' : '2K';
    setCameraResolution(nextRes);
  };

  const handleSOS115 = () => {
    Alert.alert(
      '🚨 GỌI CẤP CỨU 115?',
      `Hành động này sẽ quay số 115 ngay lập tức và tự động sao chép địa chỉ nhà:\n"${house.address}" vào clipboard để bạn đọc cho tổng đài viên (FR11).`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gọi 115 Ngay',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:115'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* 1. Header: Back Arrow, Camera Title, Cast & Settings icons */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.cameraTitleText}>{camera.name}</Text>

        <View style={styles.topRightTools}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => Alert.alert('Chia sẻ luồng camera', 'Chia sẻ quyền xem camera cho bác sĩ gia đình.')}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { marginLeft: 10 }]}
            onPress={() => Alert.alert('Cài đặt Camera Ranger 2C', 'Độ phân giải: 2K\nBộ đệm vòng RAM: 5 giây (FR08)\nTheo dõi chuyển động Smart Tracking: Đang bật')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Video Player Canvas */}
      <View style={styles.playerContainer}>
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1000&q=85',
          }}
          style={styles.playerStream}
          resizeMode="cover"
        />

        {/* Pose estimation & safe zone overlay (FR03) */}
        {showSkeletonPose && (
          <View style={styles.skeletonOverlay}>
            <View style={styles.skeletonTag}>
              <Text style={styles.skeletonTagText}>YOLO-Pose: 17 Keypoints (32 FPS)</Text>
            </View>
            <View style={styles.thermalTag}>
              <Text style={styles.thermalTagText}>AMG8833: 36.8°C</Text>
            </View>
          </View>
        )}

        {/* Watermark branding Imou & Timestamp */}
        <View style={styles.playerWatermark}>
          <Text style={styles.watermarkImou}>imou</Text>
          <Text style={styles.watermarkTime}>2026-09-07 17:52:14</Text>
        </View>

        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}
      </View>

      {/* 3. Black Control Toolbar Under Video: Speaker, Record, Center Mic, Camera, Resolution */}
      <View style={styles.controlToolbar}>
        {/* Speaker / Mute */}
        <TouchableOpacity style={styles.controlBtn} onPress={handleSpeakerToggle}>
          <Ionicons
            name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
            size={22}
            color="#FFF"
          />
        </TouchableOpacity>

        {/* Video Record */}
        <TouchableOpacity style={styles.controlBtn} onPress={handleRecordToggle}>
          <Ionicons
            name="videocam-outline"
            size={24}
            color={isRecording ? Colors.danger : '#FFF'}
          />
        </TouchableOpacity>

        {/* Center Large Two-Way Mic Button */}
        <TouchableOpacity
          style={[styles.centerMicBtn, isSpeaking && styles.centerMicBtnActive]}
          onPress={handleMicToggle}
          activeOpacity={0.85}
        >
          <Ionicons name="mic" size={28} color="#FFF" />
        </TouchableOpacity>

        {/* Snapshot Photo */}
        <TouchableOpacity style={styles.controlBtn} onPress={handleSnapshot}>
          <Ionicons name="camera-outline" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Resolution Toggle (2K / FHD / SD) */}
        <TouchableOpacity style={styles.controlBtn} onPress={handleResolutionSwitch}>
          <Text style={styles.resolutionBadgeText}>{camera.resolution}</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Events & Timeline White Bottom Sheet */}
      <View style={styles.bottomSheetContainer}>
        {/* Date Selector Row: < 09/07 >, Search & Filter icons */}
        <View style={styles.dateSelectorRow}>
          <View style={styles.dateNavPill}>
            <TouchableOpacity onPress={() => setSelectedDate('08/07')}>
              <Ionicons name="caret-back" size={14} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.dateNavText}>{selectedDate}</Text>
            <TouchableOpacity onPress={() => setSelectedDate('09/07')}>
              <Ionicons name="caret-forward" size={14} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setShowSkeletonPose(!showSkeletonPose)}
            >
              <Ionicons
                name="sparkles-outline"
                size={20}
                color={showSkeletonPose ? Colors.primary : Colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, { marginLeft: 12 }]}
              onPress={() => Alert.alert('Bộ lọc sự kiện', 'Lọc theo: Tất cả, Té ngã, Phát hiện người, Bất thường nhịp tim, Tiếng kêu cứu.')}
            >
              <Ionicons name="funnel-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Event List with Thumbnails (Matching Screenshot 4) */}
        <ScrollView
          style={styles.eventListScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {incidents.map((item) => {
            const isCritical = item.alert_level === 'CRITICAL';
            const isFall = item.alert_type === 'FALL_DETECTED';
            const timeStr = item.created_at.substring(11, 19);

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.eventItemRow, isFall && styles.eventItemRowAlert]}
                onPress={() => {
                  if (item.video_clip_url) {
                    setSelectedIncidentForReplay(item);
                  } else {
                    Alert.alert('Chi tiết sự kiện', `${item.message}\nThời gian: ${timeStr}`);
                  }
                }}
                activeOpacity={0.75}
              >
                {/* Event Type Icon Badge */}
                <View
                  style={[
                    styles.eventIconCircle,
                    { backgroundColor: isCritical ? '#EF4444' : '#F97316' },
                  ]}
                >
                  <Ionicons
                    name={
                      isFall
                        ? 'warning'
                        : item.alert_type === 'HIGH_HEART_RATE'
                        ? 'heart'
                        : 'walk'
                    }
                    size={16}
                    color="#FFF"
                  />
                </View>

                {/* Event Title & Timestamp */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.eventTitleText, isFall && { color: '#DC2626' }]}>
                    {item.message}
                  </Text>
                  <Text style={styles.eventTimeText}>{timeStr}</Text>
                </View>

                {/* Event Thumbnail Preview if exists */}
                {item.thumbnail_url ? (
                  <View style={styles.thumbnailBox}>
                    <Image
                      source={{ uri: item.thumbnail_url }}
                      style={styles.thumbnailImg}
                      resizeMode="cover"
                    />
                    {item.video_clip_url && (
                      <View style={styles.playMiniOverlay}>
                        <Ionicons name="play" size={12} color="#FFF" />
                      </View>
                    )}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. Sub-navigation tabs inside playback sheet: Playback, Events, Cloud, Protect */}
        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={styles.subTabItem}
            onPress={() => {
              setActiveSubTab('PLAYBACK');
              Alert.alert('Xem lại 24/48h', 'Kéo thanh timeline để xem lại toàn bộ lịch sử 1-2 ngày lưu tại Hub.');
            }}
          >
            <Ionicons
              name="play-circle-outline"
              size={22}
              color={activeSubTab === 'PLAYBACK' ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subTabItem}
            onPress={() => setActiveSubTab('EVENTS')}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={22}
              color={activeSubTab === 'EVENTS' ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subTabItem}
            onPress={() => {
              setActiveSubTab('CLOUD');
              Alert.alert('Lưu trữ đám mây MinIO', 'Xem danh sách clip sự kiện đã được đồng bộ lên Cloud Object Storage.');
            }}
          >
            <Ionicons
              name="list"
              size={22}
              color={activeSubTab === 'CLOUD' ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subTabItem}
            onPress={() => {
              setActiveSubTab('PROTECT');
              Alert.alert('Chế độ bảo vệ', 'Mô hình AI YOLO-Pose & AMG8833 đang giám sát liên tục.');
            }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={activeSubTab === 'PROTECT' ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating SOS 115 Speed Dial Button (Proposal FR11) */}
      <TouchableOpacity
        style={styles.floatingSOSBtn}
        onPress={handleSOS115}
        activeOpacity={0.85}
      >
        <Ionicons name="call" size={20} color="#FFF" />
        <Text style={styles.floatingSOSText}>SOS 115</Text>
      </TouchableOpacity>

      {/* Modal phát lại Clip 5s trích xuất RAM (FR08 & FR10) */}
      <Modal visible={Boolean(selectedIncidentForReplay)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalVideoCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalVideoTitle}>Clip Sự Kiện 5 Giây (Bộ đệm RAM)</Text>
              <TouchableOpacity onPress={() => setSelectedIncidentForReplay(null)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalVideoPlayerBox}>
              <Image
                source={{ uri: selectedIncidentForReplay?.thumbnail_url }}
                style={{ width: '100%', height: 220 }}
                resizeMode="cover"
              />
              <View style={styles.playCenterOverlay}>
                <Ionicons name="play-circle" size={56} color="#FFF" />
              </View>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={styles.modalIncidentMsg}>{selectedIncidentForReplay?.message}</Text>
              <Text style={styles.modalIncidentSub}>
                Trích xuất tự động từ bộ đệm RAM của Hub Orange Pi 5 lưu trữ trên MinIO Cloud (FR08).
              </Text>

              <TouchableOpacity style={styles.callSOSInsideModal} onPress={handleSOS115}>
                <Ionicons name="call" size={18} color="#FFF" />
                <Text style={styles.callSOSInsideModalText}>GỌI CẤP CỨU 115 NGAY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#000',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  topRightTools: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Video Player
  playerContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
    position: 'relative',
  },
  playerStream: {
    width: '100%',
    height: '100%',
  },
  skeletonOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 6,
  },
  skeletonTag: {
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  skeletonTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  thermalTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  thermalTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  playerWatermark: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    alignItems: 'flex-end',
  },
  watermarkImou: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  watermarkTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
  },
  recordingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    marginRight: 4,
  },
  recordingText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 10,
  },
  // Dark Toolbar under player
  controlToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 56,
    backgroundColor: '#090D16',
    paddingHorizontal: 10,
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerMicBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  centerMicBtnActive: {
    backgroundColor: Colors.danger,
    borderColor: '#FCA5A5',
  },
  resolutionBadgeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  // White Bottom Sheet
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  dateNavText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBtn: {
    padding: 4,
  },
  // Event list
  eventListScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  eventItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  eventItemRowAlert: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 8,
    marginVertical: 4,
    borderBottomWidth: 0,
  },
  eventIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventTimeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  thumbnailBox: {
    width: 58,
    height: 42,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  playMiniOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sub tab bar
  subTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 48,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  subTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Floating SOS 115
  floatingSOSBtn: {
    position: 'absolute',
    bottom: 60,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    ...Shadows.card,
  },
  floatingSOSText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // Modal Replay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 16,
  },
  modalVideoCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalVideoTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalVideoPlayerBox: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
    position: 'relative',
  },
  playCenterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalIncidentMsg: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalIncidentSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  callSOSInsideModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  callSOSInsideModalText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
