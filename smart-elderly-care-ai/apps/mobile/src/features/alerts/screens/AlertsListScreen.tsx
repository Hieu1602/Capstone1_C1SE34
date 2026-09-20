// AlertsListScreen.tsx – Danh sách cảnh báo sự kiện & Báo động khẩn cấp
// Bám sát phong cách Light Theme Smart Home và yêu cầu Proposal (FR07, FR08, FR10)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

interface AlertConfig {
  title: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  isCritical: boolean;
}

function getAlertConfig(alertType: string): AlertConfig {
  switch (alertType) {
    case 'FALL_DETECTED':
      return {
        title: 'CẢNH BÁO TÉ NGÃ KHẨN CẤP',
        badgeText: 'CỰC KỲ NGUY HIỂM',
        badgeBg: '#EF4444',
        badgeColor: '#FFFFFF',
        iconName: 'warning',
        iconColor: '#DC2626',
        iconBg: '#FEE2E2',
        isCritical: true,
      };
    case 'HIGH_HEART_RATE':
      return {
        title: 'Nhịp tim tăng cao bất thường (128 bpm)',
        badgeText: 'Cảnh báo tim',
        badgeBg: '#FFF7ED',
        badgeColor: '#EA580C',
        iconName: 'heart',
        iconColor: '#EA580C',
        iconBg: '#FFEDD5',
        isCritical: false,
      };
    case 'ACOUSTIC_DISTRESS':
      return {
        title: 'Phát hiện âm thanh kêu cứu',
        badgeText: 'Âm thanh YAMNet',
        badgeBg: '#F3E8FF',
        badgeColor: '#7C3AED',
        iconName: 'mic',
        iconColor: '#9333EA',
        iconBg: '#F3E8FF',
        isCritical: true,
      };
    case 'PERSON_DETECTED':
      return {
        title: 'Phát hiện chuyển động người',
        badgeText: 'Chuyển động',
        badgeBg: '#ECFDF5',
        badgeColor: '#059669',
        iconName: 'person',
        iconColor: '#10B981',
        iconBg: '#DCFCE7',
        isCritical: false,
      };
    default:
      return {
        title: alertType.replace(/_/g, ' '),
        badgeText: 'Thông báo',
        badgeBg: '#F1F5F9',
        badgeColor: '#64748B',
        iconName: 'notifications',
        iconColor: Colors.primary,
        iconBg: '#FFF4EC',
        isCritical: false,
      };
  }
}

function formatFriendlyTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs <= 60 * 1000) return 'Vừa xong';
    const diffMin = Math.floor(diffMs / (60 * 1000));
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 7) return `${diffDay} ngày trước`;

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${hours}:${minutes} • ${day}/${month}`;
  } catch {
    return dateStr;
  }
}

export default function AlertsListScreen({ navigation }: any) {
  const { incidents, setIncidents } = useVitalStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'CRITICAL' | 'VITAL'>('ALL');

  const unreadCount = incidents.filter((item) => !item.is_acknowledged).length;

  const filteredIncidents = incidents.filter((item) => {
    if (filterType === 'CRITICAL') {
      return (
        item.alert_level === 'CRITICAL' ||
        item.alert_type === 'FALL_DETECTED' ||
        item.alert_type === 'ACOUSTIC_DISTRESS'
      );
    }
    if (filterType === 'VITAL') {
      return (
        item.alert_type.includes('HEART') ||
        item.alert_type.includes('SPO2') ||
        item.alert_type.includes('TEMP')
      );
    }
    return true;
  });

  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) {
      Alert.alert('Thông báo', 'Tất cả sự kiện đều đã được đánh dấu đọc.');
      return;
    }
    setIncidents(incidents.map((i) => ({ ...i, is_acknowledged: true })));
    Alert.alert('Thành công', 'Đã đánh dấu đã đọc tất cả thông báo.');
  };

  const handlePressCard = (item: any) => {
    if (!item.is_acknowledged) {
      setIncidents(
        incidents.map((i) => (i.id === item.id ? { ...i, is_acknowledged: true } : i))
      );
    }

    // a. Thông báo "Phát hiện chuyển động người"
    if (item.alert_type === 'PERSON_DETECTED') {
      navigation.navigate('CameraDetail', {
        cameraId: 'cam_living_room',
        tab: 'playback',
      });
      return;
    }

    // b. Thông báo "Nhịp tim tăng cao bất thường" (hoặc các cảnh báo về sức khoẻ)
    if (
      item.alert_type === 'HIGH_HEART_RATE' ||
      item.alert_type.includes('HEART') ||
      item.alert_type.includes('SPO2') ||
      item.alert_type.includes('TEMP')
    ) {
      navigation.navigate('HealthDetail', {
        initialTab: 'today',
        focusMetric: 'heartRate',
        metric: 'heartRate',
      });
      return;
    }

    // c. Thông báo "CẢNH BÁO TÉ NGÃ KHẨN CẤP"
    if (item.alert_type === 'FALL_DETECTED') {
      navigation.navigate('IncidentDetail', {
        incidentId: item.id,
        id: item.id,
        type: 'FALL',
        alert_type: 'FALL_DETECTED',
        alert_level: 'CRITICAL',
        confidence: '92%',
        time: item.created_at ?? new Date().toISOString(),
        created_at: item.created_at ?? new Date().toISOString(),
        message: 'Phát hiện té ngã! Xác nhận bởi camera AI (YOLOv8-Pose 30 FPS) & Cảm biến âm thanh YAMNet.',
        clipAvailable: true,
        video_clip_url:
          item.video_clip_url ??
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        is_acknowledged: item.is_acknowledged ?? false,
      });
      return;
    }

    // Mặc định hoặc sự kiện âm thanh / sự cố khác
    navigation.navigate('IncidentDetail', {
      incidentId: item.id,
      id: item.id,
      type: item.alert_type === 'ACOUSTIC_DISTRESS' ? 'ACOUSTIC' : item.alert_type,
      alert_type: item.alert_type,
      alert_level: item.alert_level ?? 'CRITICAL',
      confidence: '90%',
      time: item.created_at ?? new Date().toISOString(),
      created_at: item.created_at ?? new Date().toISOString(),
      message: item.message,
      clipAvailable: Boolean(item.video_clip_url || item.thumbnail_url),
      video_clip_url:
        item.video_clip_url ??
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      is_acknowledged: item.is_acknowledged ?? false,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Thông Báo &amp; Sự Kiện</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} thông báo mới chưa đọc` : 'Tất cả đã được xử lý'}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.markAllReadBtn}
            onPress={handleMarkAllAsRead}
            activeOpacity={0.7}
          >
            <Ionicons
              name="checkmark-done"
              size={15}
              color={unreadCount > 0 ? '#EA580C' : '#94A3B8'}
            />
            <Text
              style={[
                styles.markAllReadText,
                unreadCount === 0 && { color: '#94A3B8' },
              ]}
            >
              Đã đọc tất cả
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cameraQuickBtn}
            onPress={() => navigation.navigate('CameraDetail')}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam" size={15} color="#FFF" />
            <Text style={styles.cameraQuickText}>Camera</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Filter Bar (Filter Chips) */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterPill, filterType === 'ALL' && styles.filterPillActive]}
          onPress={() => setFilterType('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterType === 'ALL' && styles.filterTextActive]}>
            Tất cả ({incidents.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filterType === 'CRITICAL' && styles.filterPillActive]}
          onPress={() => setFilterType('CRITICAL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterType === 'CRITICAL' && styles.filterTextActive]}>
            🚨 Nguy kịch (Red Alert)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filterType === 'VITAL' && styles.filterPillActive]}
          onPress={() => setFilterType('VITAL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterType === 'VITAL' && styles.filterTextActive]}>
            Sức khoẻ
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Notification Cards List */}
      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 800);
            }}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const config = getAlertConfig(item.alert_type);
          const friendlyTime = formatFriendlyTime(item.created_at);

          return (
            <TouchableOpacity
              style={[
                styles.card,
                config.isCritical && styles.cardCritical,
                !item.is_acknowledged && styles.cardUnread,
              ]}
              onPress={() => handlePressCard(item)}
              activeOpacity={0.8}
            >
              {/* Icon phân loại bên trái */}
              <View style={[styles.categoryIconCircle, { backgroundColor: config.iconBg }]}>
                <Ionicons name={config.iconName} size={22} color={config.iconColor} />
              </View>

              {/* Nội dung trung tâm */}
              <View style={styles.cardCenter}>
                {/* Hàng badge & trạng thái */}
                <View style={styles.cardMetaRow}>
                  <View style={[styles.typeBadge, { backgroundColor: config.badgeBg }]}>
                    <Text style={[styles.typeBadgeText, { color: config.badgeColor }]}>
                      {config.badgeText}
                    </Text>
                  </View>
                  {!item.is_acknowledged && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>MỚI</Text>
                    </View>
                  )}
                </View>

                {/* Tiêu đề sự kiện chuẩn hóa tiếng Việt */}
                <Text
                  style={[
                    styles.cardTitle,
                    config.isCritical && styles.cardTitleCritical,
                  ]}
                  numberOfLines={2}
                >
                  {config.title}
                </Text>

                {/* Chi tiết nội dung */}
                <Text style={styles.cardMsg} numberOfLines={2}>
                  {item.message}
                </Text>

                {/* Thời gian thân thiện */}
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={12} color="#94A3B8" />
                  <Text style={styles.cardTime}>{friendlyTime}</Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={styles.deviceLocationText}>Hub #01 (Phòng khách)</Text>
                </View>
              </View>

              {/* Hình ảnh/clip trích xuất 5s bên phải */}
              {item.thumbnail_url && (
                <View style={styles.thumbWrapper}>
                  <Image source={{ uri: item.thumbnail_url }} style={styles.thumbImg} />
                  <View style={styles.thumbOverlay}>
                    {item.video_clip_url && (
                      <View style={styles.playCenterBtn}>
                        <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginLeft: 2 }} />
                      </View>
                    )}
                    {item.video_clip_url && (
                      <View style={styles.playTag}>
                        <Text style={styles.playTagText}>5s Clip</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="shield-checkmark-outline" size={36} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>Không có cảnh báo bất thường nào</Text>
            <Text style={styles.emptySub}>
              Hệ thống AI đang giám sát an toàn 24/7 và mọi chỉ số sinh hiệu đều trong ngưỡng chuẩn.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  markAllReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  cameraQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  cameraQuickText: {
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#FFF4EC',
    borderColor: '#FF6B00',
    borderWidth: 1.5,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FF6B00',
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Shadows.soft,
  },
  cardCritical: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  cardUnread: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#FF6B00',
  },
  categoryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardCenter: {
    flex: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  newBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 19,
    marginBottom: 3,
  },
  cardTitleCritical: {
    color: '#DC2626',
    fontWeight: '800',
  },
  cardMsg: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dotSeparator: {
    fontSize: 10,
    color: '#CBD5E1',
    marginHorizontal: 2,
  },
  deviceLocationText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  thumbWrapper: {
    width: 76,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    marginTop: 2,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCenterBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  playTag: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  playTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
});
