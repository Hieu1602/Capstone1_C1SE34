import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

export interface GroupActionModalProps {
  visible: boolean;
  selectedGroup?: string | null;
  groupName?: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDeletePrompt?: () => void;
  onDelete?: () => void;
  isDarkMode?: boolean;
  colors?: any;
}

export const GroupActionModal: React.FC<GroupActionModalProps> = ({
  visible,
  selectedGroup,
  groupName,
  onClose,
  onEdit,
  onDeletePrompt,
  onDelete,
  isDarkMode = false,
  colors = {},
}) => {
  const currentGroupName = groupName ?? selectedGroup;
  const handleDelete = onDelete ?? onDeletePrompt;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.actionModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.actionModalCard, isDarkMode && { backgroundColor: colors.card }]}>
              {/* Header action modal */}
              <View style={styles.actionModalHeader}>
                <View style={styles.actionModalIconBox}>
                  <Ionicons name="folder" size={22} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <LocalizedText style={styles.actionModalSubtitle}>TÙY CHỌN NHÓM THIẾT BỊ</LocalizedText>
                  <LocalizedText style={[styles.actionModalTitle, isDarkMode && { color: colors.textPrimary }]}>
                    {currentGroupName}
                  </LocalizedText>
                </View>
                <TouchableOpacity
                  style={styles.actionModalCloseBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              </View>

              <View style={[styles.actionMenuDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Option 1: Chỉnh sửa */}
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={onEdit}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionMenuIconCircle,
                    { backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.2)' : '#F5F3FF' },
                  ]}
                >
                  <Ionicons name="create-outline" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <LocalizedText style={[styles.actionMenuText, isDarkMode && { color: colors.textPrimary }]}>
                    Chỉnh sửa
                  </LocalizedText>
                  <LocalizedText style={[styles.actionMenuSub, isDarkMode && { color: colors.textSecondary }]}>
                    Đổi tên nhóm hoặc thay đổi các thiết bị thuộc nhóm
                  </LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
              </TouchableOpacity>

              <View style={[styles.actionMenuDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Option 2: Xóa */}
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionMenuIconCircle,
                    { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2' },
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <LocalizedText style={[styles.actionMenuText, { color: '#DC2626' }]}>
                    Xóa
                  </LocalizedText>
                  <LocalizedText style={[styles.actionMenuSub, isDarkMode && { color: colors.textSecondary }]}>
                    Xóa nhóm này, thiết bị sẽ chuyển về trạng thái Chưa nhóm
                  </LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
              </TouchableOpacity>

              <View style={[styles.actionMenuDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Nút Đóng */}
              <TouchableOpacity
                style={[styles.actionCancelBtn, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <LocalizedText style={[styles.actionCancelBtnText, isDarkMode && { color: colors.textSecondary }]}>
                  Hủy bỏ
                </LocalizedText>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  actionModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  actionModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 20,
    ...Shadows.card,
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionModalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionModalSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.6,
  },
  actionModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  actionModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionMenuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionMenuSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  actionCancelBtn: {
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
});
