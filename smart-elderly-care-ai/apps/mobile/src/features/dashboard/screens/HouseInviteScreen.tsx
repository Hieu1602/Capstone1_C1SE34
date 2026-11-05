import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import * as Clipboard from 'expo-clipboard';
import { householdApi } from '../../../services/api';
import {
  HouseAccountInviteModal,
  HouseShareModal,
} from '../components/house';

export default function HouseInviteScreen({ navigation }: any) {
  const { house, fetchHouseFromBackend } = useVitalStore();
  const { household_id } = useAuthStore();
  const { isDarkMode } = useTheme();

  const [selectedInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [isAccountInviteModalVisible, setIsAccountInviteModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [copySuccessToast, setCopySuccessToast] = useState<string | null>(null);

  // State form mời qua SĐT
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newCanViewHealth, setNewCanViewHealth] = useState(true);
  const [newCanViewCamera, setNewCanViewCamera] = useState(true);
  const [newCanManageDevices, setNewCanManageDevices] = useState(false);
  const [newCanManageRecords, setNewCanManageRecords] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [toastInfo, setToastInfo] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastInfo({ message: msg, type });
    setCopySuccessToast(msg);
    setTimeout(() => {
      setToastInfo(null);
      setCopySuccessToast(null);
    }, 3200);
  };

  const handleAddMember = async () => {
    const phoneToSubmit = newMemberPhone.trim();
    if (!phoneToSubmit) {
      triggerToast('Vui lòng nhập số điện thoại người thân hoặc bác sĩ.', 'error');
      return;
    }

    try {
      setIsAddingMember(true);
      const targetHId = household_id || 'current';
      await householdApi.addMember(targetHId, {
        phone_number: phoneToSubmit,
        full_name: newMemberName.trim() || 'Thành viên',
        role_in_house: 'MEMBER',
        role: 'user',
        can_view_health: newCanViewHealth,
        can_view_camera: newCanViewCamera,
        can_handle_emergency: true,
        can_manage_devices: newCanManageDevices,
        can_manage_records: newCanManageRecords,
      });

      setIsAccountInviteModalVisible(false);
      setNewMemberPhone('');
      setNewMemberName('');
      triggerToast(`Đã gửi lời mời tham gia tới ${phoneToSubmit} . Đang chờ thành viên xác nhận.`);
      await fetchHouseFromBackend?.();
    } catch (error: any) {
      const errDetail =
        error.response?.data?.detail || error.message || 'Không thể thêm thành viên. Vui lòng kiểm tra lại.';
      triggerToast(errDetail, 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleNativeShare = async () => {
    try {
      const roleName = selectedInviteRole === 'ADMIN' ? 'Quản trị viên' : 'Thành viên';
      await Share.share({
        title: 'Mời thành viên gia đình',
        message: `Chào bạn, bạn nhận được lời mời tham gia căn nhà "${
          house?.name || 'Nhà của tôi'
        }" với vai trò ${roleName} trên ứng dụng Smart Elderly Care AI để cùng chăm sóc và bảo vệ người thân. Mã mời: CARE-${
          household_id ? String(household_id).slice(-4).toUpperCase() : '8869'
        }. Vui lòng tải ứng dụng và đăng nhập bằng số điện thoại của bạn.`,
      });
    } catch {
      Alert.alert('Thông báo', 'Không thể mở trình chia sẻ.');
    }
  };

  const handleCopyLink = async () => {
    const roleSlug = selectedInviteRole === 'ADMIN' ? 'admin' : 'member';
    const codeSuffix = household_id ? String(household_id).slice(-4).toUpperCase() : '8869';
    const inviteCode = `CARE-${codeSuffix}`;
    const link = `https://smartcare.vn/invite?houseId=${household_id || 'current'}&code=${inviteCode}&role=${roleSlug}`;

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        await Clipboard.setStringAsync(link);
      }
    } catch {
      // fallback
    }

    setCopySuccessToast('Đã sao chép liên kết mời!');
    setTimeout(() => setCopySuccessToast(null), 3000);
  };

  const bgScreen = isDarkMode ? '#0B0F19' : '#F8FAFC';
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : '#111827';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const colors = { bgCard, borderCol, textTitle, textSub };

  return (
    <SafeAreaView style={[styles.inviteSafeArea, { backgroundColor: bgScreen }]} edges={['top', 'bottom']}>
      {/* Top Bar with Back Arrow */}
      <View style={styles.inviteTopBar}>
        <TouchableOpacity
          style={styles.inviteBackBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={textTitle} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inviteScrollContent} showsVerticalScrollIndicator={false}>
        {/* Screen Title */}
        <Text style={[styles.inviteMainTitle, { color: textTitle }]}>
          Mời thành viên gia đình
        </Text>

        {/* House Card */}
        <View
          style={[
            styles.inviteHouseCard,
            {
              backgroundColor: bgCard,
              borderColor: borderCol,
            },
          ]}
        >
          <View style={[styles.inviteHouseIconBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
            <Ionicons name="home" size={22} color="#3B82F6" />
          </View>
          <Text style={[styles.inviteHouseName, { color: textTitle }]}>
            {house?.name || 'Nhà của tôi'}
          </Text>
        </View>

        {/* MỜI THÀNH VIÊN VỚI */}
        <View style={{ marginTop: 22 }}>
          <Text style={[styles.inviteSectionSubtitle, { color: textSub }]}>
            Mời thành viên với
          </Text>

          <View
            style={[
              styles.inviteOptionsGroup,
              {
                backgroundColor: bgCard,
                borderColor: borderCol,
              },
            ]}
          >
            {/* 1. Tài khoản */}
            <TouchableOpacity
              style={styles.inviteMethodRow}
              activeOpacity={0.7}
              onPress={() => setIsAccountInviteModalVisible(true)}
            >
              <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#FB923C' }]}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.inviteMethodLabel, { color: textTitle }]}>
                Tài khoản
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={[styles.inviteMethodDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

            {/* 2. Chia sẻ */}
            <TouchableOpacity
              style={styles.inviteMethodRow}
              activeOpacity={0.7}
              onPress={() => setIsShareModalVisible(true)}
            >
              <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#10B981' }]}>
                <Ionicons name="share-social" size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.inviteMethodLabel, { color: textTitle }]}>
                Chia sẻ
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={[styles.inviteMethodDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

            {/* 3. Sao chép liên kết */}
            <TouchableOpacity
              style={styles.inviteMethodRow}
              activeOpacity={0.7}
              onPress={handleCopyLink}
            >
              <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#6366F1' }]}>
                <Ionicons name="link" size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.inviteMethodLabel, { color: textTitle }]}>
                Sao chép liên kết
              </Text>
              {copySuccessToast ? (
                <View style={styles.copiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.copiedBadgeText}>Đã chép</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal: Nhập SĐT mời qua tài khoản */}
      <HouseAccountInviteModal
        visible={isAccountInviteModalVisible}
        selectedInviteRole={selectedInviteRole}
        newMemberName={newMemberName}
        setNewMemberName={setNewMemberName}
        newMemberPhone={newMemberPhone}
        setNewMemberPhone={setNewMemberPhone}
        newCanViewCamera={newCanViewCamera}
        setNewCanViewCamera={setNewCanViewCamera}
        newCanViewHealth={newCanViewHealth}
        setNewCanViewHealth={setNewCanViewHealth}
        newCanManageDevices={newCanManageDevices}
        setNewCanManageDevices={setNewCanManageDevices}
        newCanManageRecords={newCanManageRecords}
        setNewCanManageRecords={setNewCanManageRecords}
        isAddingMember={isAddingMember}
        onAddMember={handleAddMember}
        onClose={() => setIsAccountInviteModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
        toastInfo={toastInfo}
      />

      {/* Modal: Popup chia sẻ trực tiếp trên app */}
      <HouseShareModal
        visible={isShareModalVisible}
        houseName={house?.name || 'Nhà của tôi'}
        householdId={household_id}
        selectedInviteRole={selectedInviteRole}
        copySuccessToast={copySuccessToast}
        triggerToast={triggerToast}
        onNativeShare={handleNativeShare}
        onClose={() => setIsShareModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* IN-APP MOBILE FLOATING TOAST NOTIFICATION */}
      {toastInfo && (
        <View style={styles.appToastContainer} pointerEvents="none">
          <View
            style={[
              styles.appToastCard,
              toastInfo.type === 'error' && styles.appToastCardError,
            ]}
          >
            <Ionicons
              name={toastInfo.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.appToastText}>{toastInfo.message}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inviteSafeArea: {
    flex: 1,
  },
  appToastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  appToastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    maxWidth: '92%',
  },
  appToastCardError: {
    backgroundColor: '#DC2626',
  },
  appToastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  inviteTopBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  inviteBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  inviteMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  inviteHouseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  inviteHouseIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  inviteHouseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  inviteSectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inviteOptionsGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inviteMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inviteMethodIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  inviteMethodLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  inviteMethodDivider: {
    height: 1,
    marginLeft: 66,
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  copiedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
});

