// MultiViewScreen.tsx
// Màn hình xem đồng thời nhiều luồng Camera (Multi-View / 2x2 Grid)
// Hỗ trợ hiển thị 4 kênh giám sát theo thời gian thực (WebRTC / RTSP)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CameraFeed {
  id: string;
  name: string;
  room: string;
  uri: string;
  fps: number;
  bitrate: string;
  isAIActive: boolean;
  aiTag: string;
  isOnline: boolean;
}

export default function MultiViewScreen({ navigation }: any) {
  const { house } = useVitalStore();
  const [layoutMode, setLayoutMode] = useState<'GRID' | 'LIST'>('GRID');
  const [mutedFeeds, setMutedFeeds] = useState<{ [key: string]: boolean }>({
    'cam-1': false,
    'cam-2': true,
    'cam-3': true,
    'cam-4': true,
  });

  const cameraFeeds: CameraFeed[] = [
    {
      id: 'cam-1',
      name: 'Camera Phòng Ngủ - Hub #01',
      room: 'Phòng ngủ',
      uri: 'https://images.unsplash.com/photo-1540518614846-7ede433c4550?w=600&q=80',
      fps: 30,
      bitrate: '142 kbps',
      isAIActive: true,
      aiTag: 'YOLO-Pose • 36.8°C',
      isOnline: true,
    },
    {
      id: 'cam-2',
      name: 'Camera Phòng Khách - Hub #02',
      room: 'Phòng khách',
      uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
      fps: 30,
      bitrate: '138 kbps',
      isAIActive: true,
      aiTag: 'Phát hiện người',
      isOnline: true,
    },
    {
      id: 'cam-3',
      name: 'Camera Khu Bếp & Bàn Ăn',
      room: 'Bếp',
      uri: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&q=80',
      fps: 25,
      bitrate: '110 kbps',
      isAIActive: false,
      aiTag: 'YAMNet • An toàn',
      isOnline: true,
    },
    {
      id: 'cam-4',
      name: 'Camera Ban Công & Cửa Chính',
      room: 'Cửa ra vào',
      uri: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80',
      fps: 25,
      bitrate: '115 kbps',
      isAIActive: true,
      aiTag: 'Rào ảo an toàn',
      isOnline: true,
    },
  ];

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
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* 1. Header with Back button, Title and Layout Toggle */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main', { screen: 'Home' });
              }
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={{ marginLeft: 8 }}>
            <Text style={styles.headerTitle}>Nhiều Chế Độ Xem</Text>
            <Text style={styles.headerSub}>{house.name} • 4 Kênh WebRTC</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              layoutMode === 'GRID' ? styles.headerActionBtnActiveGrid : styles.headerActionBtnInactive,
            ]}
            onPress={() => setLayoutMode('GRID')}
            activeOpacity={0.8}
            accessibilityLabel="Lưới 2x2"
          >
            <Ionicons
              name="grid"
              size={18}
              color={layoutMode === 'GRID' ? '#FFF' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              { marginLeft: 8 },
              layoutMode === 'LIST' ? styles.headerActionBtnActiveList : styles.headerActionBtnInactive,
            ]}
            onPress={() => setLayoutMode('LIST')}
            activeOpacity={0.8}
            accessibilityLabel="Danh sách"
          >
            <Ionicons
              name="list"
              size={20}
              color={layoutMode === 'LIST' ? '#FFF' : '#94A3B8'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Camera Feeds Container */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          layoutMode === 'GRID' ? styles.gridContainer : styles.listContainer
        }
      >
        {cameraFeeds.map((feed) => {
          const isMuted = mutedFeeds[feed.id] ?? true;
          const isGrid = layoutMode === 'GRID';

          return (
            <TouchableOpacity
              key={feed.id}
              style={isGrid ? styles.gridCard : styles.listCard}
              activeOpacity={0.9}
              onPress={() => handleOpenDetail(feed)}
            >
              <View style={isGrid ? styles.gridVideoBox : styles.listVideoBox}>
                <Image
                  source={{ uri: feed.uri }}
                  style={styles.feedImage}
                  resizeMode="cover"
                />

                {/* Top Badge: Room & Live WebRTC */}
                <View style={isGrid ? styles.feedTopRowGrid : styles.feedTopRow}>
                  <View style={isGrid ? styles.roomBadgeGrid : styles.roomBadge}>
                    <View style={isGrid ? styles.greenDotGrid : styles.greenDot} />
                    <Text
                      style={isGrid ? styles.roomBadgeTextGrid : styles.roomBadgeText}
                      numberOfLines={1}
                    >
                      {feed.room}
                    </Text>
                  </View>

                  <View style={isGrid ? styles.fpsBadgeGrid : styles.fpsBadge}>
                    <Text style={isGrid ? styles.fpsBadgeTextGrid : styles.fpsBadgeText}>
                      {feed.fps} FPS
                    </Text>
                  </View>
                </View>

                {/* Bottom Overlay Info: AI Tag & Controls */}
                <View style={isGrid ? styles.feedBottomOverlayGrid : styles.feedBottomOverlay}>
                  <View style={isGrid ? styles.aiTagPillGrid : styles.aiTagPill}>
                    <Ionicons
                      name="sparkles"
                      size={isGrid ? 8 : 10}
                      color="#38BDF8"
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={isGrid ? styles.aiTagTextGrid : styles.aiTagText}
                      numberOfLines={1}
                    >
                      {feed.aiTag}
                    </Text>
                  </View>

                  <View style={styles.feedControlButtons}>
                    <TouchableOpacity
                      style={isGrid ? styles.smallIconCircleGrid : styles.smallIconCircle}
                      onPress={() => toggleMute(feed.id)}
                    >
                      <Ionicons
                        name={isMuted ? 'volume-mute' : 'volume-high'}
                        size={isGrid ? 11 : 14}
                        color="#FFF"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        isGrid ? styles.smallIconCircleGrid : styles.smallIconCircle,
                        { marginLeft: isGrid ? 4 : 6 },
                      ]}
                      onPress={() => handleOpenDetail(feed)}
                    >
                      <Ionicons name="expand" size={isGrid ? 10 : 13} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Feed Title under Card (for List Mode) */}
              {!isGrid && (
                <View style={styles.listCardFooter}>
                  <Text style={styles.listCardTitle}>{feed.name}</Text>
                  <Text style={styles.listCardSub}>
                    Băng thông: {feed.bitrate} • Suy luận NPU Hub RK3588S
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Info Banner at bottom */}
        <View style={layoutMode === 'GRID' ? styles.multiViewNoticeBoxGrid : styles.multiViewNoticeBox}>
          <Ionicons
            name="information-circle-outline"
            size={layoutMode === 'GRID' ? 15 : 20}
            color="#38BDF8"
          />
          <Text
            style={layoutMode === 'GRID' ? styles.multiViewNoticeTextGrid : styles.multiViewNoticeText}
            numberOfLines={layoutMode === 'GRID' ? 1 : 2}
          >
            {layoutMode === 'GRID'
              ? 'Chạm vào ô camera bất kỳ để phóng to & xem chi tiết.'
              : 'Chạm vào bất kỳ ô camera nào để mở màn hình chi tiết, xem dòng thời gian 24/48h và kích hoạt đàm thoại 2 chiều.'}
          </Text>
        </View>
      </ScrollView>

      {/* 3. Bottom Action Bar: Quay lại Home & Gọi SOS 115 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.backHomeBtn}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={20} color="#FFF" />
          <Text style={styles.backHomeBtnText}>Quay Về Trang Chủ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sosActionBtn}
          onPress={() => {
            Alert.alert(
              '🚨 KÍCH HOẠT SOS 115',
              `Gọi cấp cứu 115 và sao chép vị trí:\n"${house.address}"`,
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Gọi 115',
                  style: 'destructive',
                  onPress: () => Alert.alert('Đã kết nối', 'Đang thực hiện cuộc gọi khẩn cấp 115.'),
                },
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={18} color="#FFF" />
          <Text style={styles.sosActionBtnText}>SOS 115</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerActionBtnInactive: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  headerActionBtnActiveGrid: {
    backgroundColor: '#F97316',
    borderColor: '#FB923C',
    ...Shadows.soft,
  },
  headerActionBtnActiveList: {
    backgroundColor: Colors.primary,
    borderColor: '#3B82F6',
    ...Shadows.soft,
  },
  // Grid layout (Lưới 2 hàng x 2 cột = 4 ô)
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  gridCard: {
    width: '48.8%',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
    ...Shadows.card,
  },
  gridVideoBox: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  feedTopRowGrid: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  roomBadgeGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    maxWidth: '65%',
  },
  greenDotGrid: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  roomBadgeTextGrid: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  fpsBadgeGrid: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fpsBadgeTextGrid: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  feedBottomOverlayGrid: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  aiTagPillGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.88)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '60%',
  },
  aiTagTextGrid: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFF',
  },
  smallIconCircleGrid: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiViewNoticeBoxGrid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.22)',
  },
  multiViewNoticeTextGrid: {
    flex: 1,
    marginLeft: 6,
    fontSize: 11,
    color: '#BAE6FD',
    lineHeight: 15,
  },
  // List layout (1 cột cuộn dọc)
  listContainer: {
    padding: 14,
  },
  listCard: {
    width: '100%',
    backgroundColor: '#1F2937',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  listVideoBox: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  feedImage: {
    width: '100%',
    height: '100%',
  },
  feedTopRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  roomBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  fpsBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fpsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#38BDF8',
  },
  feedBottomOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '65%',
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
  feedControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardFooter: {
    padding: 12,
    backgroundColor: '#1E293B',
  },
  listCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  listCardSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  multiViewNoticeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  multiViewNoticeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#BAE6FD',
    lineHeight: 17,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    gap: 12,
  },
  backHomeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    backgroundColor: '#374151',
    borderRadius: 14,
    gap: 8,
  },
  backHomeBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sosActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    paddingHorizontal: 20,
    backgroundColor: Colors.danger,
    borderRadius: 14,
    gap: 6,
    ...Shadows.card,
  },
  sosActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
});

