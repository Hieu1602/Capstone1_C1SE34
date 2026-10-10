// ==============================================================================
// AlertsListScreen.tsx – Màn hình Danh sách Cảnh báo & Thông báo Sự kiện Khẩn cấp
// ------------------------------------------------------------------------------
// Hệ thống giám sát người cao tuổi Smart Elderly Care AI (C1SE.34)
//
// Trách nhiệm của màn hình:
// 1. Hiển thị danh sách sự cố/cảnh báo được đồng bộ từ Cloud Backend theo thời gian thực.
// 2. Phân loại mức độ nguy hiểm: Cực kỳ nguy hiểm (Té ngã, Tiếng kêu cứu) & Cảnh báo sinh hiệu (Nhịp tim, SpO2).
// 3. Cung cấp bộ lọc (Filter Chips) để người nhà/bác sĩ dễ dàng tra cứu nhanh sự kiện.
// 4. Cho phép đánh dấu đã đọc tập trung hoặc xem chi tiết clip bằng chứng 5 giây.
// ==============================================================================

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
import { useAlertStore } from '../../../store';
import { useTheme } from '../../../store/useThemeStore';

// ------------------------------------------------------------------------------
// 1. Interface cấu hình giao diện hiển thị cho từng loại sự kiện
// ------------------------------------------------------------------------------
interface AlertConfig {
  title: string;                               // Tiêu đề sự kiện chuẩn hóa tiếng Việt
  badgeText: string;                           // Chữ hiển thị trên huy hiệu (Badge)
  badgeBg: string;                             // Màu nền của huy hiệu
  badgeColor: string;                          // Màu chữ của huy hiệu
  iconName: keyof typeof Ionicons.glyphMap;   // Tên biểu tượng Ionicons
  iconColor: string;                           // Màu biểu tượng
  iconBg: string;                              // Màu nền tròn bao quanh biểu tượng
  isCritical: boolean;                         // Cờ xác định mức độ nguy kịch (Red Alert)
}

/**
 * getAlertConfig: Ánh xạ mã sự kiện từ Backend (alert_type) sang cấu hình giao diện tương ứng.
 * Giúp giao diện hiển thị đồng nhất về màu sắc và icon nhận diện.
 */
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
        title: 'Nhịp tim tăng cao bất thường',
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
      // Các loại sự kiện mở rộng khác (Cảm biến nhiệt, ngắt kết nối...)
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

/**
 * formatFriendlyTime: Định dạng mốc thời gian ISO thành định dạng thân thiện với người dùng
 * (Vừa xong, X phút trước, Hôm qua, hoặc giờ:phút ngày/tháng).
 */
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

// ------------------------------------------------------------------------------
// 2. Component chính: AlertsListScreen
// ------------------------------------------------------------------------------
export default function AlertsListScreen({ navigation }: any) {
  // Lấy trạng thái giao diện Sáng / Tối từ ThemeStore
  const { isDarkMode, colors } = useTheme();

  // Kết nối trực tiếp vào Domain Store useAlertStore để lấy danh sách cảnh báo từ Backend
  const { incidents, setIncidents, fetchNotifications } = useAlertStore();

  // State cục bộ quản lý hiệu ứng kéo để tải lại (Pull-to-refresh)
  const [refreshing, setRefreshing] = useState(false);

  // State bộ lọc: 'ALL' (Tất cả), 'CRITICAL' (Nguy kịch), 'VITAL' (Sức khỏe)
  const [filterType, setFilterType] = useState<'ALL' | 'CRITICAL' | 'VITAL'>('ALL');

  // Khi màn hình được mở: Tự động kéo danh sách thông báo mới nhất từ API
  React.useEffect(() => {
    fetchNotifications();
  }, []);

  // Xử lý kéo xuống để làm mới danh sách
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  // Đếm tổng số thông báo chưa được xác nhận / chưa đọc
  const unreadCount = incidents.filter((item) => !item.is_acknowledged).length;

  // Lọc danh sách sự cố theo tab đang chọn
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

  // Xử lý bấm "Đã đọc tất cả": Đánh dấu trạng thái acknowledged cho toàn bộ danh sách
  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) {
      Alert.alert('Thông báo', 'Tất cả sự kiện đều đã được đánh dấu đọc.');
      return;
    }
    setIncidents(incidents.map((i) => ({ ...i, is_acknowledged: true })));
    Alert.alert('Thành công', 'Đã đánh dấu đã đọc tất cả thông báo.');
  };

  /**
   * handlePressCard: Xử lý khi người dùng chạm vào một thẻ cảnh báo cụ thể.
   * - Đánh dấu thẻ đó là đã đọc (is_acknowledged = true).
   * - Điều hướng thông minh đến màn hình tương ứng với loại sự kiện.
   */
  const handlePressCard = (item: any) => {
    // Tự động đánh dấu đã đọc khi người dùng bấm xem
    if (!item.is_acknowledged) {
      setIncidents(
        incidents.map((i) => (i.id === item.id ? { ...i, is_acknowledged: true } : i))
      );
    }

    // Trường hợp 1: Chuyển động người -> Mở Camera xem lại phát lại (Playback)
    if (item.alert_type === 'PERSON_DETECTED') {
      navigation.navigate('CameraDetail', {
        cameraId: item.device_id || 'cam_living_room',
        tab: 'playback',
      });
      return;
    }

    // Trường hợp 2: Cảnh báo sinh hiệu (Nhịp tim, SpO2, Thân nhiệt) -> Mở màn hình Sức khỏe chi tiết
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

    // Trường hợp 3: Sự cố té ngã khẩn cấp -> Mở màn hình Chi tiết Sự cố (IncidentDetail)
    if (item.alert_type === 'FALL_DETECTED') {
      navigation.navigate('IncidentDetail', {
        incidentId: item.id,
        id: item.id,
        type: 'FALL',
        alert_type: 'FALL_DETECTED',
        alert_level: 'CRITICAL',
        confidence: item.confidence != null ? `${Math.round(Number(item.confidence) * 100)}%` : undefined,
        time: item.created_at ?? new Date().toISOString(),
        created_at: item.created_at ?? new Date().toISOString(),
        message: item.message,
        clipAvailable: Boolean(item.video_clip_url || item.thumbnail_url),
        video_clip_url: item.video_clip_url ?? null,
        is_acknowledged: item.is_acknowledged ?? false,
      });
      return;
    }

    // Trường hợp 4: Cảnh báo âm thanh kêu cứu hoặc các sự cố khác
    navigation.navigate('IncidentDetail', {
      incidentId: item.id,
      id: item.id,
      type: item.alert_type === 'ACOUSTIC_DISTRESS' ? 'ACOUSTIC' : item.alert_type,
      alert_type: item.alert_type,
      alert_level: item.alert_level ?? 'CRITICAL',
      confidence: item.confidence != null ? `${Math.round(Number(item.confidence) * 100)}%` : undefined,
      time: item.created_at ?? new Date().toISOString(),
      created_at: item.created_at ?? new Date().toISOString(),
      message: item.message,
      clipAvailable: Boolean(item.video_clip_url || item.thumbnail_url),
      video_clip_url: item.video_clip_url ?? null,
      is_acknowledged: item.is_acknowledged ?? false,
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top']}>
      {/* ---------------------------------------------------------------------- */}
      {/* 1. Header trên cùng: Tiêu đề, số lượng chưa đọc, thao tác nhanh       */}
      {/* ---------------------------------------------------------------------- */}
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, isDarkMode && { color: colors.textPrimary }]}>Thông Báo &amp; Sự Kiện</Text>
          <Text style={[styles.headerSubtitle, isDarkMode && { color: colors.textSecondary }]}>
            {unreadCount > 0 ? `${unreadCount} thông báo mới chưa đọc` : 'Tất cả đã được xử lý'}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Nút đánh dấu đã đọc tất cả */}
          <TouchableOpacity
            style={[styles.markAllReadBtn, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
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

          {/* Nút xem trực tiếp camera */}
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

      {/* ---------------------------------------------------------------------- */}
      {/* 2. Thanh bộ lọc phân loại (Filter Chips)                               */}
      {/* ---------------------------------------------------------------------- */}
      <View style={[styles.filterBar, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Tab Tất cả */}
        <TouchableOpacity
          style={[
            styles.filterPill,
            isDarkMode && filterType !== 'ALL' && { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'ALL' && styles.filterPillActive,
            filterType === 'ALL' && isDarkMode && { backgroundColor: 'rgba(255, 107, 0, 0.15)', borderColor: '#FF6B00' },
          ]}
          onPress={() => setFilterType('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, isDarkMode && filterType !== 'ALL' && { color: colors.textSecondary }, filterType === 'ALL' && styles.filterTextActive]}>
            Tất cả ({incidents.length})
          </Text>
        </TouchableOpacity>

        {/* Tab Nguy kịch (Red Alert: Té ngã & Tiếng kêu cứu) */}
        <TouchableOpacity
          style={[
            styles.filterPill,
            isDarkMode && filterType !== 'CRITICAL' && { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'CRITICAL' && styles.filterPillActive,
            filterType === 'CRITICAL' && isDarkMode && { backgroundColor: 'rgba(255, 107, 0, 0.15)', borderColor: '#FF6B00' },
          ]}
          onPress={() => setFilterType('CRITICAL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, isDarkMode && filterType !== 'CRITICAL' && { color: colors.textSecondary }, filterType === 'CRITICAL' && styles.filterTextActive]}>
            🚨 Nguy kịch (Red Alert)
          </Text>
        </TouchableOpacity>

        {/* Tab Sức khỏe (Nhịp tim, SpO2, Thân nhiệt) */}
        <TouchableOpacity
          style={[
            styles.filterPill,
            isDarkMode && filterType !== 'VITAL' && { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'VITAL' && styles.filterPillActive,
            filterType === 'VITAL' && isDarkMode && { backgroundColor: 'rgba(255, 107, 0, 0.15)', borderColor: '#FF6B00' },
          ]}
          onPress={() => setFilterType('VITAL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, isDarkMode && filterType !== 'VITAL' && { color: colors.textSecondary }, filterType === 'VITAL' && styles.filterTextActive]}>
            Sức khoẻ
          </Text>
        </TouchableOpacity>
      </View>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. Danh sách thông báo (FlatList tối ưu cuộn + Pull-to-refresh)       */}
      {/* ---------------------------------------------------------------------- */}
      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          // Lấy cấu hình màu sắc, icon và tiêu đề theo alert_type
          const config = getAlertConfig(item.alert_type);
          const friendlyTime = formatFriendlyTime(item.created_at);

          return (
            <TouchableOpacity
              style={[
                styles.card,
                isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
                config.isCritical && styles.cardCritical,
                config.isCritical && isDarkMode && { backgroundColor: '#3F1219', borderColor: '#7F1D1D' },
                !item.is_acknowledged && styles.cardUnread,
              ]}
              onPress={() => handlePressCard(item)}
              activeOpacity={0.8}
            >
              {/* Cột trái: Biểu tượng phân loại tròn có màu nền theo mức độ */}
              <View style={[styles.categoryIconCircle, { backgroundColor: isDarkMode ? (config.isCritical ? 'rgba(220, 38, 38, 0.25)' : 'rgba(255, 255, 255, 0.08)') : config.iconBg }]}>
                <Ionicons name={config.iconName} size={22} color={config.iconColor} />
              </View>

              {/* Cột giữa: Chi tiết thông tin sự kiện */}
              <View style={styles.cardCenter}>
                {/* Hàng huy hiệu (Badge) loại cảnh báo & nhãn MỚI */}
                <View style={styles.cardMetaRow}>
                  <View style={[styles.typeBadge, { backgroundColor: isDarkMode && config.badgeBg === '#FFF7ED' ? 'rgba(234, 88, 12, 0.2)' : config.badgeBg }]}>
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
                    isDarkMode && { color: colors.textPrimary },
                    config.isCritical && styles.cardTitleCritical,
                  ]}
                  numberOfLines={2}
                >
                  {config.title}
                </Text>

                {/* Chi tiết thông điệp sự kiện từ AI / cảm biến */}
                <Text style={[styles.cardMsg, isDarkMode && { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.message}
                </Text>

                {/* Dòng thời gian và định danh nguồn thiết bị phát hiện */}
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={12} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                  <Text style={[styles.cardTime, isDarkMode && { color: colors.textSecondary }]}>{friendlyTime}</Text>
                  <Text style={[styles.dotSeparator, isDarkMode && { color: colors.border }]}>•</Text>
                  <Text style={[styles.deviceLocationText, isDarkMode && { color: colors.textSecondary }]}>
                    {item.device_id ? `Thiết bị: ${item.device_id}` : 'Hệ thống AI'}
                  </Text>
                </View>
              </View>

              {/* Cột phải: Ảnh chụp bằng chứng hoặc clip 5 giây trích xuất (nếu có) */}
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
        // Giao diện khi danh sách trống: Thông báo an toàn
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="shield-checkmark-outline" size={36} color="#10B981" />
            </View>
            <Text style={[styles.emptyTitle, isDarkMode && { color: colors.textPrimary }]}>Không có cảnh báo bất thường nào</Text>
            <Text style={[styles.emptySub, isDarkMode && { color: colors.textSecondary }]}>
              Hệ thống AI đang giám sát an toàn 24/7 và mọi chỉ số sức khoẻ đều trong ngưỡng chuẩn.
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
  themeToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
