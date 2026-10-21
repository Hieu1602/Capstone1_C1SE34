import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../../theme/colors';
import { IoTDeviceItem } from '../../../../store/useVitalStore';
import { LocalizedText, LocalizedTextInput } from '../../../../i18n/LocalizedComponents';

export interface EditGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editOldGroupName?: string;
  editNewGroupName: string;
  setEditNewGroupName: (val: string) => void;
  editSelectedDeviceIds: string[];
  setEditDeviceFilter: (tab: 'Tất cả' | 'Camera' | 'Đồng hồ') => void;
  editDeviceFilter: 'Tất cả' | 'Camera' | 'Đồng hồ';
  editAttempted: boolean;
  setEditAttempted?: (val: boolean) => void;
  allDevicesCount?: number;
  iotDevices?: IoTDeviceItem[];
  filteredEditDevices: IoTDeviceItem[];
  isAllEditTabSelected: boolean;
  handleToggleEditSelectAll?: () => void;
  onToggleSelectAll?: () => void;
  toggleEditDeviceSelection?: (id: string) => void;
  onToggleDevice?: (id: string) => void;
  isEditNameEmpty: boolean;
  isEditNameDuplicate: boolean;
  isEditNameValid: boolean;
  hasEditDevices?: boolean;
  isEditFormValid: boolean;
  trimmedEditName?: string;
  isDarkMode?: boolean;
  colors?: any;
}

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  visible,
  onClose,
  onSave,
  editNewGroupName,
  setEditNewGroupName,
  editSelectedDeviceIds,
  setEditDeviceFilter,
  editDeviceFilter,
  editAttempted,
  setEditAttempted,
  allDevicesCount,
  iotDevices,
  filteredEditDevices,
  isAllEditTabSelected,
  handleToggleEditSelectAll,
  onToggleSelectAll,
  toggleEditDeviceSelection,
  onToggleDevice,
  isEditNameEmpty,
  isEditNameDuplicate,
  isEditNameValid,
  hasEditDevices,
  isEditFormValid,
  trimmedEditName,
  isDarkMode = false,
  colors = {},
}) => {
  const actualTrimmedName = trimmedEditName ?? editNewGroupName.trim();
  const actualHasDevices = hasEditDevices ?? editSelectedDeviceIds.length >= 1;
  const totalCount = allDevicesCount ?? iotDevices?.length ?? filteredEditDevices.length;
  const onSelectAll = onToggleSelectAll ?? handleToggleEditSelectAll;
  const onDeviceToggle = onToggleDevice ?? toggleEditDeviceSelection;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.editModalSafeArea, isDarkMode && { backgroundColor: colors.background }]}>
        <View style={[styles.editModalHeader, isDarkMode && { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.editModalCloseBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={isDarkMode ? '#94A3B8' : '#1E293B'} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <LocalizedText style={[styles.editModalTitle, isDarkMode && { color: colors.textPrimary }]}>
              Chỉnh Sửa Nhóm
            </LocalizedText>
            <LocalizedText style={[styles.editModalSubtitle, isDarkMode && { color: colors.textSecondary }]}>
              Đổi tên và phân công thiết bị cho nhóm
            </LocalizedText>
          </View>
        </View>

        <ScrollView style={styles.editModalBody} showsVerticalScrollIndicator={false}>
          {/* Card 1: Tên nhóm */}
          <View style={[styles.editSectionCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.editSectionHeader}>
              <View style={[styles.editIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="folder-outline" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <LocalizedText style={[styles.editSectionTitle, isDarkMode && { color: colors.textPrimary }]}>
                  1. Tên nhóm *
                </LocalizedText>
                <LocalizedText style={[styles.editSectionSub, isDarkMode && { color: colors.textSecondary }]}>
                  Duy nhất và không được để trống
                </LocalizedText>
              </View>
              {isEditNameValid && (
                <View style={styles.editValidBadge}>
                  <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                  <LocalizedText style={styles.editValidBadgeText}>Hợp lệ</LocalizedText>
                </View>
              )}
            </View>

            <LocalizedTextInput
              style={[
                styles.editTextInput,
                isDarkMode && { backgroundColor: colors.surfaceSubtle, color: colors.textPrimary, borderColor: colors.border },
                editAttempted && (isEditNameEmpty || isEditNameDuplicate)
                  ? styles.editTextInputError
                  : isEditNameValid
                  ? styles.editTextInputValid
                  : null,
              ]}
              value={editNewGroupName}
              onChangeText={(t) => {
                setEditNewGroupName(t);
                if (editAttempted && setEditAttempted) setEditAttempted(false);
              }}
              placeholder="Nhập tên nhóm..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            />

            {isEditNameDuplicate && (
              <View style={styles.editFeedbackRow}>
                <Ionicons name="close-circle" size={15} color="#DC2626" />
                <LocalizedText style={styles.editFeedbackError}>
                  Tên nhóm "{actualTrimmedName}" đã tồn tại. Tên nhóm phải là duy nhất!
                </LocalizedText>
              </View>
            )}
            {editAttempted && isEditNameEmpty && (
              <View style={styles.editFeedbackRow}>
                <Ionicons name="alert-circle" size={15} color="#DC2626" />
                <LocalizedText style={styles.editFeedbackError}>
                  Tên nhóm không được để trống!
                </LocalizedText>
              </View>
            )}
          </View>

          {/* Card 2: Thiết bị trong nhóm */}
          <View style={[styles.editSectionCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.editSectionHeader}>
              <View style={[styles.editIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="hardware-chip-outline" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <LocalizedText style={[styles.editSectionTitle, isDarkMode && { color: colors.textPrimary }]}>
                  2. Thiết bị thuộc nhóm *
                </LocalizedText>
                <LocalizedText
                  style={[
                    styles.editSectionSub,
                    isDarkMode && { color: colors.textSecondary },
                    !actualHasDevices && editAttempted && styles.editSectionSubError,
                  ]}
                >
                  {!actualHasDevices
                    ? 'Cần ít nhất 1 thiết bị để duy trì nhóm'
                    : `Đã chọn ${editSelectedDeviceIds.length} / ${totalCount} thiết bị`}
                </LocalizedText>
              </View>
              <TouchableOpacity
                style={styles.editSelectAllBtn}
                onPress={onSelectAll}
                activeOpacity={0.7}
              >
                <LocalizedText style={styles.editSelectAllBtnText}>
                  {isAllEditTabSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
                </LocalizedText>
              </TouchableOpacity>
            </View>

            {/* Warning banner nếu 0 thiết bị */}
            {!actualHasDevices && editAttempted && (
              <View style={styles.editWarningBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <LocalizedText style={styles.editWarningText}>
                  Cần có ít nhất 1 thiết bị mới duy trì nhóm được. Vui lòng chọn thiết bị!
                </LocalizedText>
              </View>
            )}

            {/* 3 Tab lọc thiết bị */}
            <View style={styles.editFilterTabsRow}>
              {(['Tất cả', 'Camera', 'Đồng hồ'] as const).map((tab) => {
                const isActive = editDeviceFilter === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.editFilterTab,
                      isDarkMode && !isActive && { backgroundColor: colors.background, borderColor: colors.border },
                      isActive && styles.editFilterTabActive,
                    ]}
                    onPress={() => setEditDeviceFilter(tab)}
                    activeOpacity={0.7}
                  >
                    <LocalizedText
                      style={[
                        styles.editFilterTabText,
                        isDarkMode && !isActive && { color: colors.textSecondary },
                        isActive && styles.editFilterTabTextActive,
                      ]}
                    >
                      {tab}
                    </LocalizedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Danh sách thiết bị */}
            <View style={styles.editDeviceList}>
              {filteredEditDevices.map((dev) => {
                const isSelected = editSelectedDeviceIds.includes(dev.id);
                return (
                  <TouchableOpacity
                    key={dev.id}
                    style={[
                      styles.editDeviceCard,
                      isDarkMode && { backgroundColor: colors.background, borderColor: colors.border },
                      isSelected && styles.editDeviceCardSelected,
                      isSelected && isDarkMode && { backgroundColor: 'rgba(124, 58, 237, 0.15)', borderColor: '#7C3AED' },
                    ]}
                    onPress={() => onDeviceToggle?.(dev.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isSelected ? '#7C3AED' : '#94A3B8'}
                      style={{ marginRight: 10 }}
                    />
                    <View
                      style={[
                        styles.iconBoxSmall,
                        { backgroundColor: `${dev.color}18` },
                      ]}
                    >
                      <Ionicons name={dev.icon as any} size={18} color={dev.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <LocalizedText style={[styles.editDeviceName, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
                        {dev.name}
                      </LocalizedText>
                      <LocalizedText style={[styles.editDeviceSub, isDarkMode && { color: colors.textSecondary }]} numberOfLines={1}>
                        Vị trí hiện tại:{' '}
                        <LocalizedText style={{ fontWeight: '700', color: isDarkMode ? '#94A3B8' : '#475569' }}>
                          {dev.location || 'Chưa nhóm'}
                        </LocalizedText>
                      </LocalizedText>
                    </View>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: dev.isOnline ? Colors.success : '#CBD5E1' },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer Action */}
        <View style={[styles.editModalFooter, isDarkMode && { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.editModalCancelBtn, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <LocalizedText style={[styles.editModalCancelBtnText, isDarkMode && { color: colors.textSecondary }]}>
              Hủy
            </LocalizedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.editModalSaveBtn,
              !isEditFormValid && styles.editModalSaveBtnDisabled,
            ]}
            onPress={onSave}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <LocalizedText style={styles.editModalSaveBtnText}>Lưu Thay Đổi</LocalizedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  editModalSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editModalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  editModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  editModalBody: {
    flex: 1,
    padding: 16,
  },
  editSectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...Shadows.card,
  },
  editSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  editIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  editSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  editSectionSubError: {
    color: '#DC2626',
    fontWeight: '600',
  },
  editValidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  editValidBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  editTextInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  editTextInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  editTextInputValid: {
    borderColor: '#86EFAC',
  },
  editFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 5,
  },
  editFeedbackError: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  editSelectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
  },
  editSelectAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  editWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  editWarningText: {
    fontSize: 11,
    color: '#DC2626',
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  editFilterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  editFilterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  editFilterTabActive: {
    backgroundColor: '#7C3AED',
  },
  editFilterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  editFilterTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  editDeviceList: {
    gap: 8,
  },
  editDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editDeviceCardSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  iconBoxSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDeviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  editDeviceSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  editModalFooter: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  editModalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  editModalSaveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Shadows.sm,
  },
  editModalSaveBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  editModalSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
