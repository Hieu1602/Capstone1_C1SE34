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
  step?: 1 | 2;
  setStep?: (step: 1 | 2) => void;
  selectedInviteRole?: 'MEMBER' | 'ADMIN';
  setSelectedInviteRole?: (role: 'MEMBER' | 'ADMIN') => void;
  houseName: string;
  onOpenAccountInvite: () => void;
  onShareInvite: () => void;
  onCopyLink: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  copySuccessToast?: string | null;
}

export const HouseInviteFlowModal: React.FC<HouseInviteFlowModalProps> = ({
  visible,
  houseName,
  onOpenAccountInvite,
  onShareInvite,
  onCopyLink,
  onClose,
  isDarkMode,
  copySuccessToast,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.inviteSafeArea, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}
        edges={['top', 'bottom']}
      >
        {/* Top Bar with Back Arrow */}
        <View style={styles.inviteTopBar}>
          <TouchableOpacity
            style={styles.inviteBackBtn}
            onPress={onClose}
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

          {/* MỜI THÀNH VIÊN VỚI */}
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

        {/* Floating Toast Notification */}
        {copySuccessToast && (
          <View style={styles.inviteToastBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.inviteToastText}>{copySuccessToast}</Text>
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inviteBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  inviteScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  inviteMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  inviteHouseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteHouseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteHouseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  inviteSectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'none',
  },
  inviteOptionsGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  inviteMethodIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteMethodLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  inviteMethodDivider: {
    height: 1,
    marginLeft: 70,
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  copiedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  inviteToastBadge: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  inviteToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
