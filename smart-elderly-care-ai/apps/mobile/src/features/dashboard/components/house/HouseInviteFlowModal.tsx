import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface HouseInviteFlowModalProps {
  visible: boolean;
  step: 1 | 2;
  setStep: (step: 1 | 2) => void;
  selectedInviteRole: 'MEMBER' | 'ADMIN';
  setSelectedInviteRole: (role: 'MEMBER' | 'ADMIN') => void;
  houseName: string;
  onOpenAccountInvite: () => void;
  onShareInvite: () => void;
  onCopyLink: () => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export const HouseInviteFlowModal: React.FC<HouseInviteFlowModalProps> = ({
  visible,
  step,
  setStep,
  selectedInviteRole,
  setSelectedInviteRole,
  houseName,
  onOpenAccountInvite,
  onShareInvite,
  onCopyLink,
  onClose,
  isDarkMode,
}) => {
  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleBack}
    >
      <SafeAreaView
        style={[styles.inviteSafeArea, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}
        edges={['top', 'bottom']}
      >
        {/* Top Bar with Back Arrow */}
        <View style={styles.inviteTopBar}>
          <TouchableOpacity
            style={styles.inviteBackBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={26} color={isDarkMode ? '#F8FAFC' : '#111827'} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.inviteScrollContent} showsVerticalScrollIndicator={false}>
          {/* Screen Title */}
          <Text style={[styles.inviteMainTitle, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
            Mời thành viên gia đình
          </Text>

          {/* House Card */}
          <View
            style={[
              styles.inviteHouseCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={[styles.inviteHouseIconBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
              <Ionicons name="home" size={22} color="#3B82F6" />
            </View>
            <Text style={[styles.inviteHouseName, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {houseName || 'Nhà của tôi'}
            </Text>
          </View>

          {step === 1 ? (
            /* STEP 1: CHỌN QUYỀN TRUY CẬP */
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.inviteSectionSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Chọn Quyền truy cập
              </Text>

              <View
                style={[
                  styles.inviteOptionsGroup,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                {/* Option 1: Thành viên */}
                <TouchableOpacity
                  style={styles.inviteRoleOptionItem}
                  activeOpacity={0.8}
                  onPress={() => setSelectedInviteRole('MEMBER')}
                >
                  <View style={styles.inviteRoleHeaderRow}>
                    <Text style={[styles.inviteRoleTitle, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                      Thành viên
                    </Text>
                    {selectedInviteRole === 'MEMBER' ? (
                      <View style={styles.radioChecked}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.radioUnchecked} />
                    )}
                  </View>
                  <Text style={[styles.inviteRoleDesc, { color: isDarkMode ? '#94A3B8' : '#4B5563' }]}>
                    Cho phép người dùng này có thể sử dụng thiết bị và có một số quyền quản lý thiết bị
                  </Text>
                </TouchableOpacity>

                <View style={[styles.inviteOptionDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

                {/* Option 2: Quản trị viên */}
                <TouchableOpacity
                  style={styles.inviteRoleOptionItem}
                  activeOpacity={0.8}
                  onPress={() => setSelectedInviteRole('ADMIN')}
                >
                  <View style={styles.inviteRoleHeaderRow}>
                    <Text style={[styles.inviteRoleTitle, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                      Quản trị viên
                    </Text>
                    {selectedInviteRole === 'ADMIN' ? (
                      <View style={styles.radioChecked}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.radioUnchecked} />
                    )}
                  </View>
                  <Text style={[styles.inviteRoleDesc, { color: isDarkMode ? '#94A3B8' : '#4B5563' }]}>
                    Ngoài quyền của thành viên, quản trị viên còn có quyền quản lý thành viên và nhóm, cũng như các quyền đối với thiết bị, trừ các thao tác liên kết, xóa, chuyển giao và chia sẻ thiết bị.
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* STEP 2: MỜI THÀNH VIÊN VỚI */
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.inviteSectionSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Mời thành viên với
              </Text>

              <View
                style={[
                  styles.inviteOptionsGroup,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                {/* 1. Tài khoản */}
                <TouchableOpacity
                  style={styles.inviteMethodRow}
                  activeOpacity={0.7}
                  onPress={onOpenAccountInvite}
                >
                  <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#FB923C' }]}>
                    <Ionicons name="person" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.inviteMethodLabel, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                    Tài khoản
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={[styles.inviteMethodDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

                {/* 2. Chia sẻ */}
                <TouchableOpacity
                  style={styles.inviteMethodRow}
                  activeOpacity={0.7}
                  onPress={onShareInvite}
                >
                  <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#10B981' }]}>
                    <Ionicons name="share-social" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.inviteMethodLabel, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                    Chia sẻ
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={[styles.inviteMethodDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

                {/* 3. Sao chép liên kết */}
                <TouchableOpacity
                  style={styles.inviteMethodRow}
                  activeOpacity={0.7}
                  onPress={onCopyLink}
                >
                  <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#6366F1' }]}>
                    <Ionicons name="link" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.inviteMethodLabel, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                    Sao chép liên kết
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Button cho Step 1: "Tiếp theo" */}
        {step === 1 && (
          <View style={[styles.inviteBottomBtnContainer, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}>
            <TouchableOpacity
              style={styles.inviteNextBtn}
              activeOpacity={0.85}
              onPress={() => setStep(2)}
            >
              <Text style={styles.inviteNextBtnText}>Tiếp theo</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  inviteSafeArea: {
    flex: 1,
  },
  inviteTopBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteBackBtn: {
    padding: 6,
    marginLeft: -6,
  },
  inviteScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inviteMainTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  inviteHouseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  inviteHouseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  inviteHouseName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  inviteSectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
  },
  inviteOptionsGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inviteRoleOptionItem: {
    padding: 16,
  },
  inviteRoleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inviteRoleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inviteRoleDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  radioChecked: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnchecked: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  inviteOptionDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  inviteMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  inviteMethodIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  inviteMethodLabel: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  inviteMethodDivider: {
    height: 1,
    marginLeft: 70,
  },
  inviteBottomBtnContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  inviteNextBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteNextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

