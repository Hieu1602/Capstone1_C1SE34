// ==============================================================================
// TỆP: AdminMarqueeBanner.tsx
// PHÂN HỆ: Thanh thông báo từ Admin (Marquee / Chữ chạy từ trái sang phải)
// DÀNH CHO: Giao diện Bác sĩ (Doctor) & Người dùng gia đình (Owner, Member)
// LƯU Ý: Lấy 100% dữ liệu thực từ Backend API, không dùng mock frontend.
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../store/useThemeStore';
import { adminBroadcastsApi, SystemAnnouncement } from '../services/api';

interface AdminMarqueeBannerProps {
  /** Phân loại đối tượng nhận: 'doctors' | 'caregivers' | 'all' */
  targetAudience?: 'doctors' | 'caregivers' | 'all';
  /** Tốc độ chạy chữ (pixel mỗi giây, mặc định 45px/s cho tốc độ đọc tự nhiên) */
  speed?: number;
  /** Cho phép tắt/ẩn thanh thông báo tạm thời */
  allowDismiss?: boolean;
}

export default function AdminMarqueeBanner({
  targetAudience = 'all',
  speed = 45,
  allowDismiss = true,
}: AdminMarqueeBannerProps) {
  const { isDarkMode } = useTheme();

  // Dữ liệu lấy trực tiếp từ Backend
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SystemAnnouncement | null>(null);

  // Đo kích thước khung nhìn và độ dài chuỗi chữ
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  // Animated giá trị translateX cho chữ chạy từ trái sang phải
  const animatedTranslateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isPausedRef = useRef(false);

  // Tải danh sách thông báo hoạt động từ API Backend
  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await adminBroadcastsApi.getActive(targetAudience);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setAnnouncements(res.data);
      } else {
        setAnnouncements([]);
      }
    } catch {
      setAnnouncements([]);
    }
  }, [targetAudience]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Khởi động hoạt ảnh chạy chữ từ TRÁI sang PHẢI
  // - Vị trí xuất phát: Bắt đầu từ mép trái ngoài màn hình (-textWidth)
  // - Hướng di chuyển: Tăng dần translateX sang phải cho đến khi rời mép phải màn hình (+containerWidth)
  const startMarqueeAnimation = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }

    if (containerWidth <= 0 || textWidth <= 0) return;

    // Tổng quãng đường chữ di chuyển từ trái sang phải
    const distance = containerWidth + textWidth;
    const duration = Math.max((distance / speed) * 1000, 4000);

    const runLoop = () => {
      if (isPausedRef.current) return;

      // Đặt vị trí ban đầu ở mép trái (âm textWidth)
      animatedTranslateX.setValue(-textWidth);

      // Chạy trượt sang mép phải (+containerWidth)
      animationRef.current = Animated.timing(animatedTranslateX, {
        toValue: containerWidth,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      });

      animationRef.current.start(({ finished }) => {
        if (finished && !isPausedRef.current) {
          runLoop();
        }
      });
    };

    runLoop();
  }, [containerWidth, textWidth, speed, animatedTranslateX]);

  useEffect(() => {
    if (containerWidth > 0 && textWidth > 0 && announcements.length > 0) {
      startMarqueeAnimation();
    }
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [containerWidth, textWidth, announcements.length, startMarqueeAnimation]);

  // Nếu người dùng đã bấm tắt hoặc không có thông báo từ backend thì KHÔNG hiển thị
  if (dismissed || announcements.length === 0) {
    return null;
  }

  // Chuỗi hiển thị trên dải chữ chạy
  const tickerText = announcements
    .map((item) => {
      const typeTag = getTypeText(item.type);
      return `[${typeTag.toUpperCase()}] ${item.title}: ${item.body}`;
    })
    .join('      ✦      ');

  // Helper chuyển đổi loại thông báo sang nhãn tiếng Việt & màu sắc
  function getTypeText(type: string): string {
    switch (type) {
      case 'system_maintenance':
        return 'Bảo trì hệ thống';
      case 'emergency':
        return 'Khẩn cấp';
      case 'health_tip':
        return 'Lời khuyên sức khỏe';
      case 'feature_update':
        return 'Cập nhật tính năng';
      case 'info':
      default:
        return 'Thông báo Admin';
    }
  }

  function getTypeColors(type: string): { bg: string; text: string; icon: any } {
    switch (type) {
      case 'system_maintenance':
        return { bg: '#FEF3C7', text: '#D97706', icon: 'warning' };
      case 'emergency':
        return { bg: '#FEE2E2', text: '#DC2626', icon: 'alert-circle' };
      case 'health_tip':
        return { bg: '#DCFCE7', text: '#16A34A', icon: 'heart' };
      case 'feature_update':
        return { bg: '#F3E8FF', text: '#9333EA', icon: 'sparkles' };
      case 'info':
      default:
        return { bg: '#E0F2FE', text: '#0284C7', icon: 'megaphone' };
    }
  }

  const primaryType = announcements[0]?.type || 'info';
  const typeConfig = getTypeColors(primaryType);

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
          borderColor: isDarkMode ? '#334155' : '#BFDBFE',
        },
      ]}
    >
      {/* Huy hiệu cố định bên trái: Icon loa + nhãn ADMIN */}
      <TouchableOpacity
        style={[
          styles.badgeLeft,
          {
            backgroundColor: isDarkMode ? '#0369A1' : '#0284C7',
          },
        ]}
        onPress={() => {
          setSelectedAnnouncement(announcements[0] || null);
          setModalVisible(true);
        }}
        activeOpacity={0.8}
        accessibilityLabel="Xem chi tiết thông báo từ Admin"
      >
        <Ionicons name="megaphone" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.badgeText}>ADMIN</Text>
      </TouchableOpacity>

      {/* Vùng chữ chạy (Marquee Viewport) - Chạy từ TRÁI sang PHẢI */}
      <TouchableOpacity
        style={styles.marqueeViewport}
        activeOpacity={0.85}
        onPress={() => {
          setSelectedAnnouncement(announcements[0] || null);
          setModalVisible(true);
        }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== containerWidth) {
            setContainerWidth(w);
          }
        }}
      >
        <Animated.View
          style={[
            styles.animatedTextWrapper,
            {
              transform: [{ translateX: animatedTranslateX }],
            },
          ]}
        >
          <Text
            style={[
              styles.tickerText,
              {
                color: isDarkMode ? '#E2E8F0' : '#1E3A8A',
              },
            ]}
            numberOfLines={1}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && w !== textWidth) {
                setTextWidth(w);
              }
            }}
          >
            {tickerText}
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Nút hành động bên phải: Xem chi tiết & Nút đóng */}
      <View style={styles.actionsRight}>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => {
            setSelectedAnnouncement(announcements[0] || null);
            setModalVisible(true);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={isDarkMode ? '#94A3B8' : '#3B82F6'}
          />
        </TouchableOpacity>

        {allowDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => setDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel="Đóng thông báo"
          >
            <Ionicons
              name="close"
              size={15}
              color={isDarkMode ? '#64748B' : '#94A3B8'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* MODAL CHI TIẾT THÔNG BÁO TỪ ADMIN */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View
                  style={[
                    styles.modalIconBox,
                    { backgroundColor: isDarkMode ? '#0F172A' : typeConfig.bg },
                  ]}
                >
                  <Ionicons name={typeConfig.icon} size={20} color={typeConfig.text} />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text
                    style={[
                      styles.modalTitleText,
                      { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                    ]}
                  >
                    Thông báo từ Ban Quản trị
                  </Text>
                  <Text style={[styles.modalSubText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Hệ thống Smart Elderly Care AI
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Danh sách các thông báo */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {announcements.map((item, idx) => {
                const itemConfig = getTypeColors(item.type);
                return (
                  <View
                    key={item.id || idx}
                    style={[
                      styles.announcementItem,
                      {
                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.announcementTopRow}>
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: itemConfig.bg },
                        ]}
                      >
                        <Text style={[styles.typeBadgeText, { color: itemConfig.text }]}>
                          {getTypeText(item.type)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.dateText,
                          { color: isDarkMode ? '#64748B' : '#94A3B8' },
                        ]}
                      >
                        {item.published_at
                          ? new Date(item.published_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Vừa xong'}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.itemTitle,
                        { color: isDarkMode ? '#F1F5F9' : '#0F172A' },
                      ]}
                    >
                      {item.title}
                    </Text>

                    <Text
                      style={[
                        styles.itemBody,
                        { color: isDarkMode ? '#CBD5E1' : '#334155' },
                      ]}
                    >
                      {item.body}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer nút Đã hiểu */}
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    height: 38,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  marqueeViewport: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  animatedTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    whiteSpace: 'nowrap',
  } as any,
  tickerText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  detailButton: {
    padding: 3,
  },
  dismissButton: {
    padding: 3,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalScroll: {
    marginTop: 12,
    marginBottom: 16,
  },
  announcementItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  announcementTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalConfirmBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
