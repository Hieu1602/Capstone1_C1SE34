// ProfileScreen.tsx
// Màn hình Cá nhân / Quản trị hệ thống khớp chính xác Hình 2 (Phong cách Imou Protect & Elderly Care AI)

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';

export default function ProfileScreen({ navigation }: any) {
  const { userId, userEmail, userName, logout } = useAuthStore();
  const { house } = useVitalStore();

  const handleQRScan = () => {
    Alert.alert('Quét mã QR', 'Quét mã QR trên thân Hub Orange Pi 5 hoặc Vòng đeo tay BLE để ghép nối tự động.');
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống giám sát?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Top Header: Avatar, User ID "1057", QR Scanner */}
        <View style={styles.topProfileRow}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={38} color="#CBD5E1" />
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.userIdText}>1057</Text>
              <Text style={styles.userRoleText}>{userName || 'Người chăm sóc chính'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.qrScanBtn}
            onPress={handleQRScan}
            activeOpacity={0.7}
          >
            <Ionicons name="scan-outline" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 2. Banner Cards Carousel: Imou Protect & EventSmart */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bannerContainer}
        >
          {/* Card 1: Elderly Care Protect */}
          <TouchableOpacity
            style={styles.protectBannerCard}
            onPress={() => Alert.alert('Elderly Care Protect', 'Hệ thống bảo vệ AI 24/7 đang kích hoạt với độ tin cậy TPR ≥ 95% theo chuẩn Capstone Proposal.')}
            activeOpacity={0.9}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.protectBannerTitle}>Imou Protect</Text>
              <Text style={styles.protectBannerSub}>
                Ưu đãi nhận miễn phí trong thời gian có hạn. Nhận ngay người bảo vệ AI hoạt động 24/7!
              </Text>
            </View>
            {/* 3D Shield Medal icon */}
            <View style={styles.medalShieldWrapper}>
              <Ionicons name="shield-checkmark" size={32} color="#2563EB" />
            </View>
          </TouchableOpacity>

          {/* Card 2: EventSmart */}
          <TouchableOpacity
            style={styles.eventSmartBannerCard}
            onPress={() => navigation.navigate('Alerts')}
            activeOpacity={0.9}
          >
            <Text style={styles.eventSmartTitle}>EventSmart</Text>
            <Text style={styles.eventSmartSub}>
              24/7 AI-empowered anomaly alerts. Trích xuất clip 5s khi có té ngã.
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 3. Card "Nhà của tôi" (Thành viên: 1, icon add user -> mở Hình 3) */}
        <TouchableOpacity
          style={styles.houseCard}
          onPress={() => navigation.navigate('HouseDetail')}
          activeOpacity={0.9}
        >
          <View>
            <Text style={styles.houseCardTitle}>{house.name}</Text>
            <Text style={styles.houseCardSub}>Thành viên: {house.membersCount}</Text>
          </View>
          <View style={styles.addMemberCircleBtn}>
            <Ionicons name="person-add" size={18} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* 4. Menu Card 1: AI, Tự động hóa, Thuật toán, Cảm biến IoT */}
        <View style={styles.menuGroupCard}>
          {/* Row 1: Mô hình AI */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('AIModelDetail')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="sparkles" size={20} color="#0284C7" />
            </View>
            <Text style={styles.menuTitleText}>Mô hình AI</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 2: Tự động hóa */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => Alert.alert('Tự động hóa (Automation)', '1. Phát loa tiếng Việt khi người già rời giường quên đeo vòng (FR12).\n2. Tự động gửi clip 5s lên Cloud MinIO khi có Red Alert (FR08).\n3. Tự động sao chép địa chỉ khi bấm SOS 115 (FR11).')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#E0F7FA' }]}>
              <Ionicons name="cube" size={20} color="#00ACC1" />
            </View>
            <Text style={styles.menuTitleText}>Tự động hóa</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 3: Chơi Algo (Thuật toán cảnh báo) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('AlgoConfig')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="color-wand" size={20} color="#A855F7" />
            </View>
            <Text style={styles.menuTitleText}>Chơi Algo</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 4: Hoạt động với (Thiết bị IoT) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Devices')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FFEDD5' }]}>
              <Ionicons name="hardware-chip" size={20} color="#F97316" />
            </View>
            <Text style={styles.menuTitleText}>Hoạt động với</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* 5. Menu Card 2: Báo cáo y tế & Cài Đặt */}
        <View style={styles.menuGroupCard}>
          {/* Row 1: Đơn hàng của tôi / Báo cáo y tế xuất PDF/Excel */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('MedicalReport')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="bag-handle" size={20} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitleText}>Đơn hàng của tôi</Text>
              <Text style={styles.menuSubText}>Báo cáo y tế &amp; Xuất file (FR13)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 2: Cài Đặt (Có chấm đỏ thông báo cập nhật) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => Alert.alert('Cài Đặt', 'Phiên bản hệ thống: Smart Elderly Care AI v1.0\nRockchip RK3588S NPU Firmware: v2.3\nTrạng thái kết nối MQTT: Tốt (<500ms)')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="settings" size={20} color="#D97706" />
            </View>
            <Text style={styles.menuTitleText}>Cài Đặt</Text>
            <View style={styles.redUpdateDot} />
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* 6. Nút Đăng xuất */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  // Top Profile
  topProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 6,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIdText: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  userRoleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qrScanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  // Banners
  bannerContainer: {
    gap: 12,
    paddingBottom: 16,
  },
  protectBannerCard: {
    width: 270,
    backgroundColor: '#DDEEFE',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  protectBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  protectBannerSub: {
    fontSize: 11,
    color: '#3B82F6',
    lineHeight: 16,
  },
  medalShieldWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  eventSmartBannerCard: {
    width: 220,
    backgroundColor: '#F3E8FF',
    borderRadius: 18,
    padding: 16,
  },
  eventSmartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6B21A8',
    marginBottom: 4,
  },
  eventSmartSub: {
    fontSize: 11,
    color: '#9333EA',
    lineHeight: 16,
  },
  // House Card
  houseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    ...Shadows.card,
  },
  houseCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  houseCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  addMemberCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Menu Groups
  menuGroupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
    ...Shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTitleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  menuSubText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 50,
  },
  redUpdateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    marginRight: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  },
});
