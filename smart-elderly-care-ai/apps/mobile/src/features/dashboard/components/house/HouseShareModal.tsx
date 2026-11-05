import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../../../../theme/colors';

interface HouseShareModalProps {
  visible: boolean;
  houseName: string;
  householdId?: string | number | null;
  selectedInviteRole: 'MEMBER' | 'ADMIN';
  copySuccessToast: string | null;
  triggerToast: (msg: string) => void;
  onNativeShare: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: {
    bgCard: string;
    borderCol: string;
    textTitle: string;
    textSub: string;
  };
}

export const HouseShareModal: React.FC<HouseShareModalProps> = ({
  visible,
  houseName,
  householdId,
  selectedInviteRole,
  copySuccessToast,
  triggerToast,
  onNativeShare,
  onClose,
  isDarkMode,
  colors: { bgCard, borderCol, textTitle, textSub },
}) => {
  const inviteCode = `CARE-${householdId ? String(householdId).slice(-4).toUpperCase() : '8869'}`;
  const inviteMsg = `Chào bạn! Bạn nhận được lời mời tham gia "${houseName || 'Nhà của tôi'}" với vai trò ${
    selectedInviteRole === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'
  }. Mã mời: ${inviteCode}. Tải app Smart Elderly Care AI để kết nối!`;

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
    } catch {
      // fallback
    }
    triggerToast(successMessage);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.shareModalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
          {/* Header */}
          <View style={styles.shareHeaderRow}>
            <View style={[styles.shareIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="share-social" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shareModalTitle, { color: textTitle }]}>
                Chia sẻ lời mời gia đình
              </Text>
              <Text style={[styles.shareModalSub, { color: textSub }]}>
                Mời người thân vào căn nhà trực tiếp trên app
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.shareCloseBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={textSub} />
            </TouchableOpacity>
          </View>

          {/* Thông tin căn nhà & vai trò */}
          <View
            style={[
              styles.shareHouseBox,
              { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol },
            ]}
          >
            <View style={styles.shareHouseRow}>
              <View style={styles.shareHouseIconSmall}>
                <Ionicons name="home" size={16} color="#3B82F6" />
              </View>
              <Text style={[styles.shareHouseNameText, { color: textTitle }]}>
                {houseName || 'Nhà của tôi'}
              </Text>
              <View
                style={[
                  styles.shareRolePill,
                  { backgroundColor: selectedInviteRole === 'ADMIN' ? '#FEF3C7' : '#EFF6FF' },
                ]}
              >
                <Text
                  style={[
                    styles.shareRolePillText,
                    { color: selectedInviteRole === 'ADMIN' ? '#B45309' : '#2563EB' },
                  ]}
                >
                  {selectedInviteRole === 'ADMIN' ? '👑 Quản trị viên' : '👤 Thành viên'}
                </Text>
              </View>
            </View>

            {/* Mã mời nổi bật */}
            <View style={[styles.inviteCodeContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#FFF' }]}>
              <Text style={[styles.inviteCodeLabel, { color: textSub }]}>MÃ MỜI THAM GIA NHÀ</Text>
              <View style={styles.inviteCodeValueRow}>
                <Text style={[styles.inviteCodeText, { color: Colors.primary }]}>
                  {inviteCode}
                </Text>
                <TouchableOpacity
                  style={styles.copyCodeMiniBtn}
                  onPress={() => copyToClipboard(inviteCode, 'Đã sao chép mã mời vào bộ nhớ tạm!')}
                >
                  <Ionicons name="copy-outline" size={14} color="#FFF" />
                  <Text style={styles.copyCodeMiniText}>Sao chép mã</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inviteCodeExpireText}>⏱️ Mã có hiệu lực trong 48 giờ</Text>
            </View>
          </View>

          {/* Khung nội dung lời mời mẫu */}
          <View style={[styles.shareMessagePreviewBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
            <Text style={[styles.shareMessagePreviewLabel, { color: textSub }]}>Nội dung tin nhắn sẽ gửi:</Text>
            <Text
              style={[styles.shareMessagePreviewContent, { color: isDarkMode ? '#E2E8F0' : '#334155' }]}
              numberOfLines={3}
            >
              {inviteMsg}
            </Text>
          </View>

          {/* Kênh chia sẻ nhanh trực tiếp */}
          <Text style={[styles.shareChannelsTitle, { color: textSub }]}>CHỌN ỨNG DỤNG CHIA SẺ:</Text>
          <View style={styles.shareChannelsRow}>
            {/* Kênh 1: Tin nhắn SMS */}
            <TouchableOpacity
              style={styles.shareChannelItem}
              onPress={() => {
                const msg = `Mời bạn tham gia căn nhà "${houseName || 'Nhà của tôi'}" trên Smart Elderly Care AI. Mã mời: ${inviteCode}. Tải ứng dụng tại: https://smartcare.vn/app`;
                Linking.openURL(`sms:?body=${encodeURIComponent(msg)}`).catch(() => {
                  copyToClipboard(msg, 'Đã sao chép nội dung tin nhắn!');
                });
              }}
            >
              <View style={[styles.shareChannelIconBox, { backgroundColor: '#34D399' }]}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#FFF" />
              </View>
              <Text style={[styles.shareChannelName, { color: textTitle }]}>Tin nhắn</Text>
            </TouchableOpacity>

            {/* Kênh 2: Zalo */}
            <TouchableOpacity
              style={styles.shareChannelItem}
              onPress={() => {
                Linking.openURL('https://zalo.me').catch(() => {
                  // Fallback
                });
                copyToClipboard(inviteMsg, 'Đã sao chép nội dung để gửi qua Zalo!');
              }}
            >
              <View style={[styles.shareChannelIconBox, { backgroundColor: '#0284C7' }]}>
                <Ionicons name="paper-plane" size={22} color="#FFF" />
              </View>
              <Text style={[styles.shareChannelName, { color: textTitle }]}>Zalo</Text>
            </TouchableOpacity>

            {/* Kênh 3: Sao chép toàn bộ */}
            <TouchableOpacity
              style={styles.shareChannelItem}
              onPress={() => copyToClipboard(inviteMsg, 'Đã sao chép toàn bộ nội dung lời mời!')}
            >
              <View style={[styles.shareChannelIconBox, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="copy" size={22} color="#FFF" />
              </View>
              <Text style={[styles.shareChannelName, { color: textTitle }]}>Sao chép</Text>
            </TouchableOpacity>

            {/* Kênh 4: Hệ thống khác */}
            <TouchableOpacity
              style={styles.shareChannelItem}
              onPress={onNativeShare}
            >
              <View style={[styles.shareChannelIconBox, { backgroundColor: '#F97316' }]}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
              </View>
              <Text style={[styles.shareChannelName, { color: textTitle }]}>Khác</Text>
            </TouchableOpacity>
          </View>

          {/* Toast thông báo đã copy */}
          {copySuccessToast && (
            <View style={styles.shareToastBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.shareToastText}>{copySuccessToast}</Text>
            </View>
          )}

          {/* Nút hành động chính */}
          <View style={styles.shareModalBtnRow}>
            <TouchableOpacity
              style={[
                styles.shareModalCancelBtn,
                { borderColor: borderCol, backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.shareModalCancelText, { color: textSub }]}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareModalPrimaryBtn}
              onPress={() => copyToClipboard(inviteMsg, 'Đã sao chép lời mời thành công!')}
            >
              <Ionicons name="copy" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.shareModalPrimaryText}>Sao chép lời mời</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shareModalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  shareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  shareIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  shareModalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  shareCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHouseBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  shareHouseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shareHouseIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHouseNameText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  shareRolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shareRolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inviteCodeContainer: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inviteCodeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  inviteCodeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  inviteCodeText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  copyCodeMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  copyCodeMiniText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inviteCodeExpireText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  shareMessagePreviewBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  shareMessagePreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  shareMessagePreviewContent: {
    fontSize: 12,
    lineHeight: 18,
  },
  shareChannelsTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  shareChannelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  shareChannelItem: {
    alignItems: 'center',
    gap: 6,
    width: 68,
  },
  shareChannelIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shareChannelName: {
    fontSize: 12,
    fontWeight: '600',
  },
  shareToastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    marginBottom: 14,
  },
  shareToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  shareModalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shareModalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  shareModalPrimaryBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
