// MultiViewScreen.tsx
// Màn hình xem đồng thời nhiều luồng Camera (Multi-View / 2x2 Grid)
// Hỗ trợ hiển thị các kênh giám sát thời gian thực từ hệ thống thiết bị IoT

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import { launchEmergencyCall } from '../../../services/emergency';

interface CameraFeed {
  id: string;
  name: string;
  room: string;
  uri?: string;
  fps: number;
  bitrate: string;
  isAIActive: boolean;
  aiTag: string;
  isOnline: boolean;
}

export default function MultiViewScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const { house, iotDevices } = useVitalStore();
  const [layoutMode, setLayoutMode] = useState<'GRID' | 'LIST'>('GRID');
  const [mutedFeeds, setMutedFeeds] = useState<Record<string, boolean>>({});

  // Lấy danh sách camera thực tế từ store
  const configuredCameras = (iotDevices || []).filter(
    (d) =>
      d.type === 'camera' ||
      d.name.toLowerCase().includes('camera') ||
      d.name.includes('SECA') ||
      d.name.includes('Ranger')
  );

  const cameraFeeds: CameraFeed[] = configuredCameras.map((dev, idx) => ({
    id: dev.id,
    name: dev.name,
    room: dev.location || 'Phòng giám sát',
    uri: dev.streamUrl,
    fps: dev.isOnline ? 30 : 0,
    bitrate: dev.isOnline ? '135 kbps' : '0 kbps',
    isAIActive: dev.isOnline,
    aiTag: dev.isOnline ? 'AI Giám sát an toàn' : 'Ngoại tuyến',
    isOnline: dev.isOnline,
  }));

  const toggleMute = (camId: string) => {
    setMutedFeeds((prev) => ({
      ...prev,
      [camId]: !prev[camId],
    }));
  };

  const handleOpenDetail = (feed: CameraFeed) => {
    navigation.navigate('CameraDetail', {
      cameraId: feed.id,
      cameraName: feed.name,
      room: feed.room,
    });
  };

  const isGrid = layoutMode === 'GRID';
  const bgMain = isDarkMode ? '#0F172A' : '#F1F5F9';
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#FFF' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgMain }]} edges={['top', 'bottom']}>
      {/* 1. Header */}
      <View style={[styles.headerRow, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', borderBottomColor: borderCol }]}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' }]}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Home' }))}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={textTitle} />
          </TouchableOpacity>

          <View style={{ marginLeft: 8 }}>
            <LocalizedText style={[styles.headerTitle, { color: textTitle }]}>Nhiều Chế Độ Xem</LocalizedText>
            <LocalizedText style={[styles.headerSub, { color: textSub }]}>
              {house?.name || 'Nhà của tôi'} • {cameraFeeds.length} Kênh Camera
            </LocalizedText>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.headerActionBtn, isGrid ? styles.btnActiveGrid : { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', borderColor: borderCol }]}
            onPress={() => setLayoutMode('GRID')}
            activeOpacity={0.8}
            accessibilityLabel="Lưới 2x2"
          >
            <Ionicons name="grid" size={18} color={isGrid ? '#FFF' : textSub} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerActionBtn, { marginLeft: 8 }, !isGrid ? styles.btnActiveList : { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', borderColor: borderCol }]}
            onPress={() => setLayoutMode('LIST')}
            activeOpacity={0.8}
            accessibilityLabel="Danh sách"
          >
            <Ionicons name="list" size={20} color={!isGrid ? '#FFF' : textSub} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Container */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={isGrid ? styles.gridContainer : styles.listContainer}
      >
        {cameraFeeds.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="videocam-outline" size={40} color={isDarkMode ? '#64748B' : '#94A3B8'} />
            </View>
            <LocalizedText style={[styles.emptyTitle, { color: textTitle }]}>
              Chưa có Camera nào được kết nối
            </LocalizedText>
            <LocalizedText style={[styles.emptyDesc, { color: textSub }]}>
              Hệ thống chưa ghi nhận luồng camera giám sát trong căn nhà này. Bạn có thể thêm thiết bị mới tại tab Thiết bị.
            </LocalizedText>
            <TouchableOpacity
              style={styles.addDeviceBtn}
              onPress={() => navigation.navigate('Main', { screen: 'Devices' })}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <LocalizedText style={styles.addDeviceBtnText}>Thêm Camera Giám Sát</LocalizedText>
            </TouchableOpacity>
          </View>
        ) : (
          cameraFeeds.map((feed) => {
            const isMuted = mutedFeeds[feed.id] ?? true;

            return (
              <TouchableOpacity
                key={feed.id}
                style={[
                  isGrid ? styles.gridCard : styles.listCard,
                  { backgroundColor: bgCard, borderColor: borderCol },
                ]}
                activeOpacity={0.9}
                onPress={() => handleOpenDetail(feed)}
              >
                <View style={[styles.videoBox, isGrid ? styles.videoBoxGrid : styles.videoBoxList]}>
                  {feed.uri ? (
                    <Image source={{ uri: feed.uri }} style={styles.feedImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.placeholderBox}>
                      <Ionicons
                        name={feed.isOnline ? 'videocam' : 'videocam-off'}
                        size={isGrid ? 32 : 44}
                        color={feed.isOnline ? '#38BDF8' : '#64748B'}
                      />
                      <LocalizedText style={[styles.placeholderText, { color: textSub }]}>
                        {feed.isOnline ? 'Đang kết nối luồng RTSP / WebRTC...' : 'Camera đang ngoại tuyến'}
                      </LocalizedText>
                    </View>
                  )}

                  {/* Top Overlay */}
                  <View style={[styles.feedTopOverlay, { padding: isGrid ? 5 : 8 }]}>
                    <View style={styles.roomBadge}>
                      <View style={[styles.statusDot, { backgroundColor: feed.isOnline ? '#10B981' : '#EF4444' }]} />
                      <LocalizedText style={[styles.badgeText, { fontSize: isGrid ? 10 : 11 }]} numberOfLines={1}>
                        {feed.room}
                      </LocalizedText>
                    </View>

                    <View style={styles.fpsBadge}>
                      <LocalizedText style={[styles.fpsText, { fontSize: isGrid ? 9 : 10 }]}>
                        {feed.fps} FPS
                      </LocalizedText>
                    </View>
                  </View>

                  {/* Bottom Overlay */}
                  <View style={[styles.feedBottomOverlay, { padding: isGrid ? 5 : 8 }]}>
                    <View style={styles.aiTagPill}>
                      <Ionicons name="sparkles" size={isGrid ? 9 : 11} color="#38BDF8" style={{ marginRight: 3 }} />
                      <LocalizedText style={[styles.aiTagText, { fontSize: isGrid ? 8.5 : 9.5 }]} numberOfLines={1}>
                        {feed.aiTag}
                      </LocalizedText>
                    </View>

                    <View style={styles.feedControls}>
                      <TouchableOpacity style={[styles.iconCircle, isGrid && styles.iconCircleGrid]} onPress={() => toggleMute(feed.id)}>
                        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={isGrid ? 11 : 14} color="#FFF" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconCircle, isGrid && styles.iconCircleGrid, { marginLeft: isGrid ? 4 : 6 }]}
                        onPress={() => handleOpenDetail(feed)}
                      >
                        <Ionicons name="expand" size={isGrid ? 10 : 13} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Footer for List Mode */}
                {!isGrid && (
                  <View style={[styles.listCardFooter, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}>
                    <LocalizedText style={[styles.listCardTitle, { color: textTitle }]}>{feed.name}</LocalizedText>
                    <LocalizedText style={[styles.listCardSub, { color: textSub }]}>
                      Băng thông: {feed.bitrate} • Suy luận NPU Hub RK3588S
                    </LocalizedText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* Info Banner */}
        {cameraFeeds.length > 0 && (
          <View style={[styles.noticeBox, { backgroundColor: isDarkMode ? 'rgba(2,132,199,0.12)' : '#E0F2FE', borderColor: isDarkMode ? 'rgba(2,132,199,0.25)' : '#BAE6FD' }]}>
            <Ionicons name="information-circle-outline" size={18} color={isDarkMode ? '#38BDF8' : '#0284C7'} />
            <LocalizedText style={[styles.noticeText, { color: isDarkMode ? '#BAE6FD' : '#0369A1' }]}>
              {isGrid ? 'Chạm vào ô camera bất kỳ để phóng to & xem chi tiết.' : 'Chạm vào bất kỳ ô camera nào để mở màn hình chi tiết, xem dòng thời gian và đàm thoại 2 chiều.'}
            </LocalizedText>
          </View>
        )}
      </ScrollView>

      {/* 3. Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', borderTopColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.backHomeBtn, { backgroundColor: isDarkMode ? '#374151' : '#F1F5F9' }]}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={19} color={textTitle} />
          <LocalizedText style={[styles.backHomeBtnText, { color: textTitle }]}>Quay Về Trang Chủ</LocalizedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sosActionBtn}
          onPress={() => {
            LocalizedAlert.alert(
              '🚨 KÍCH HOẠT SOS 115',
              `Gọi cấp cứu 115 và sao chép vị trí:\n"${house?.address || 'Chưa cập nhật'}"`,
              [
                { text: 'Hủy', style: 'cancel' },
                { text: '📍 Gửi vị trí & ảnh', onPress: () => navigation.navigate('SendEmergencyLocation') },
                {
                  text: 'Gọi 115',
                  style: 'destructive',
                  onPress: () => {
                    void launchEmergencyCall({ address: house?.address })
                      .then(() => LocalizedAlert.alert('Đã kích hoạt', 'Đang mở trình gọi khẩn cấp 115.'))
                      .catch((err) => console.warn('[MultiViewScreen] Emergency call error:', err));
                  },
                },
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={18} color="#FFF" />
          <LocalizedText style={styles.sosActionBtnText}>SOS 115</LocalizedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 11, marginTop: 2 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnActiveGrid: { backgroundColor: '#F97316', borderColor: '#FB923C', ...Shadows.soft },
  btnActiveList: { backgroundColor: Colors.primary, borderColor: '#3B82F6', ...Shadows.soft },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  listContainer: { padding: 14, paddingBottom: 10 },

  gridCard: { width: '48.8%', borderRadius: 12, overflow: 'hidden', marginBottom: 10, borderWidth: 1, ...Shadows.card },
  listCard: { width: '100%', borderRadius: 18, overflow: 'hidden', marginBottom: 16, borderWidth: 1, ...Shadows.card },

  videoBox: { width: '100%', position: 'relative', backgroundColor: '#0B0F19' },
  videoBoxGrid: { aspectRatio: 4 / 3 },
  videoBoxList: { height: 190 },
  feedImage: { width: '100%', height: '100%' },

  placeholderBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 10 },
  placeholderText: { fontSize: 10, textAlign: 'center', marginTop: 6, fontWeight: '600' },

  feedTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  roomBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.85)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, maxWidth: '65%' },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
  badgeText: { fontWeight: '700', color: '#FFF' },
  fpsBadge: { backgroundColor: 'rgba(15,23,42,0.85)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6 },
  fpsText: { fontWeight: '700', color: '#38BDF8' },

  feedBottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  aiTagPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(2,132,199,0.88)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, maxWidth: '65%' },
  aiTagText: { fontWeight: '700', color: '#FFF' },
  feedControls: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(15,23,42,0.85)', alignItems: 'center', justifyContent: 'center' },
  iconCircleGrid: { width: 22, height: 22, borderRadius: 11 },

  listCardFooter: { padding: 12 },
  listCardTitle: { fontSize: 15, fontWeight: '800' },
  listCardSub: { fontSize: 11, marginTop: 2 },

  noticeBox: { width: '100%', flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 10, marginVertical: 8, borderWidth: 1 },
  noticeText: { flex: 1, marginLeft: 8, fontSize: 11.5, lineHeight: 16 },

  emptyContainer: { width: '100%', alignItems: 'center', justifyContent: 'center', padding: 28, borderRadius: 18, borderWidth: 1, marginVertical: 20 },
  emptyIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(148,163,184,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptyDesc: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16, paddingHorizontal: 12 },
  addDeviceBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 6 },
  addDeviceBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, gap: 12 },
  backHomeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 14, gap: 8 },
  backHomeBtnText: { fontSize: 14, fontWeight: '700' },
  sosActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, paddingHorizontal: 20, backgroundColor: Colors.danger, borderRadius: 14, gap: 6, ...Shadows.card },
  sosActionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
