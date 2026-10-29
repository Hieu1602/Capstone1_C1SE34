import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileQuickGridProps {
  isDarkMode: boolean;
  colors: any;
  houseName: string;
  membersCount: number;
  hasHouse?: boolean;
  showMore: boolean;
  onToggleShowMore: () => void;
  onNavigate: (screen: string) => void;
  onOpenProfile: () => void;
}

export const ProfileQuickGrid: React.FC<ProfileQuickGridProps> = ({
  isDarkMode,
  colors,
  houseName,
  membersCount,
  hasHouse = true,
  showMore,
  onToggleShowMore,
  onNavigate,
  onOpenProfile,
}) => {
  return (
    <>
      <View style={styles.fbGridContainer}>
        {/* Ô 1: Hồ sơ giám sát */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={onOpenProfile}
        >
          <View
            style={[
              styles.fbGridIconBox,
              {
                backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF',
              },
            ]}
          >
            <Ionicons name="person-circle-outline" size={24} color="#6366F1" />
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Hồ sơ giám sát
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            Tài khoản người thân & SĐT khẩn cấp
          </Text>
        </TouchableOpacity>

        {/* Ô 2: Hồ sơ bệnh án người cao tuổi */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => onNavigate('PatientMedicalRecord')}
        >
          <View style={styles.fbGridCardTopRow}>
            <View
              style={[
                styles.fbGridIconBox,
                {
                  backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE',
                },
              ]}
            >
              <Ionicons name="medkit-outline" size={24} color="#0EA5E9" />
            </View>
            <View style={styles.fbAesBadge}>
              <Text style={styles.fbAesBadgeText}>AES-256</Text>
            </View>
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Hồ sơ bệnh án
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            Bệnh nền, nhóm máu & đơn thuốc
          </Text>
        </TouchableOpacity>

        {/* Ô 3: Nhà của tôi */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => onNavigate('HouseDetail')}
        >
          <View
            style={[
              styles.fbGridIconBox,
              {
                backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5',
              },
            ]}
          >
            <Ionicons name="home-outline" size={24} color="#10B981" />
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            {hasHouse ? (houseName || 'Nhà của tôi') : 'Chưa tham gia nhà'}
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            {hasHouse ? `Thành viên: ${membersCount || 1} • Quản lý phòng` : 'Nhấn để nhập mã mời'}
          </Text>
        </TouchableOpacity>

        {/* Ô 4: Thiết bị kết nối */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => onNavigate('Devices')}
        >
          <View
            style={[
              styles.fbGridIconBox,
              {
                backgroundColor: isDarkMode ? '#451A03' : '#FFF7ED',
              },
            ]}
          >
            <Ionicons name="hardware-chip-outline" size={24} color="#FF7A00" />
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Thiết bị kết nối
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            {hasHouse ? 'Camera AI, Vòng BLE & Cảm biến' : 'Chưa có thiết bị theo dõi'}
          </Text>
        </TouchableOpacity>

        {/* Ô 5: Cấu hình AI & Ngưỡng cảnh báo */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => onNavigate('AlgoConfig')}
        >
          <View
            style={[
              styles.fbGridIconBox,
              {
                backgroundColor: isDarkMode ? '#3B1D54' : '#F5F3FF',
              },
            ]}
          >
            <Ionicons name="color-wand-outline" size={24} color="#8B5CF6" />
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Cấu hình AI
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            Độ nhạy té ngã, ngưỡng nhịp tim & SpO2
          </Text>
        </TouchableOpacity>

        {/* Ô 6: Báo cáo sức khỏe */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => onNavigate('MedicalReport')}
        >
          <View
            style={[
              styles.fbGridIconBox,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
              },
            ]}
          >
            <Ionicons name="document-text-outline" size={24} color="#2563EB" />
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Báo cáo sức khỏe
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            Xuất file PDF & Excel gửi bác sĩ
          </Text>
        </TouchableOpacity>

        {/* Ô 7: Lịch nhắc thuốc */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => onNavigate('MedicationReminder')}
        >
          <View
            style={[
              styles.fbGridIconBox,
              {
                backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7',
              },
            ]}
          >
            <Ionicons name="calendar-outline" size={24} color="#D97706" />
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Lịch nhắc thuốc
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            Đơn thuốc & Lịch tái khám bác sĩ
          </Text>
        </TouchableOpacity>

        {/* Ô 8: Nhật ký cảnh báo */}
        <TouchableOpacity
          style={[
            styles.fbGridCard,
            isDarkMode && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => onNavigate('Alerts')}
        >
          <View
            style={[
              styles.fbGridIconBox,
              {
                backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2',
              },
            ]}
          >
            <Ionicons name="notifications-outline" size={24} color="#EF4444" />
          </View>
          <Text
            style={[
              styles.fbGridCardTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Nhật ký cảnh báo
          </Text>
          <Text
            style={[
              styles.fbGridCardSub,
              isDarkMode && { color: colors.textSecondary },
            ]}
          >
            Sự kiện té ngã & Sinh hiệu bất thường
          </Text>
        </TouchableOpacity>

        {/* HIỂN THỊ THÊM */}
        {showMore && (
          <>
            {/* Ô 9: Trợ lý Bác sĩ AI */}
            <TouchableOpacity
              style={[
                styles.fbGridCard,
                isDarkMode && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => onNavigate('AIAssistant')}
            >
              <View
                style={[
                  styles.fbGridIconBox,
                  {
                    backgroundColor: isDarkMode ? '#164E63' : '#ECFEFF',
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={24}
                  color="#06B6D4"
                />
              </View>
              <Text
                style={[
                  styles.fbGridCardTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Trợ lý Bác sĩ AI
              </Text>
              <Text
                style={[
                  styles.fbGridCardSub,
                  isDarkMode && { color: colors.textSecondary },
                ]}
              >
                Tư vấn dinh dưỡng & Vận động 24/7
              </Text>
            </TouchableOpacity>

            {/* Ô 10: Multi-View Camera */}
            <TouchableOpacity
              style={[
                styles.fbGridCard,
                isDarkMode && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => onNavigate('MultiView')}
            >
              <View
                style={[
                  styles.fbGridIconBox,
                  {
                    backgroundColor: isDarkMode ? '#2E1065' : '#F3E8FF',
                  },
                ]}
              >
                <Ionicons name="grid-outline" size={24} color="#7C3AED" />
              </View>
              <Text
                style={[
                  styles.fbGridCardTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Multi-View Camera
              </Text>
              <Text
                style={[
                  styles.fbGridCardSub,
                  isDarkMode && { color: colors.textSecondary },
                ]}
              >
                Xem nhiều góc quay camera cùng lúc
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* NÚT XEM THÊM / THU GỌN */}
      <TouchableOpacity
        style={[
          styles.fbViewMoreBtn,
          isDarkMode && {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        activeOpacity={0.8}
        onPress={onToggleShowMore}
      >
        <Text
          style={[
            styles.fbViewMoreText,
            isDarkMode && { color: colors.textPrimary },
          ]}
        >
          {showMore ? 'Ẩn bớt' : 'Xem thêm'}
        </Text>
        <Ionicons
          name={showMore ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={isDarkMode ? colors.textPrimary : '#1E293B'}
        />
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  fbGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  fbGridCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 120,
    justifyContent: 'space-between',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  fbGridCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fbGridIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  fbAesBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  fbAesBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284C7',
  },
  fbGridCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 20,
  },
  fbGridCardSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  fbViewMoreBtn: {
    height: 44,
    backgroundColor: '#E4E6EB',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  fbViewMoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
});

