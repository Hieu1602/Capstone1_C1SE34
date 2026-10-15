// AlarmSnoozeModal.tsx
// BottomSheet Modal tạm dừng chuông báo động (Snooze Alarm ActionSheet)

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';

interface AlarmSnoozeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  selectedDuration: number;
  setSelectedDuration: (val: number) => void;
  selectedMode: 'VIBRATE' | 'SILENT';
  setSelectedMode: (val: 'VIBRATE' | 'SILENT') => void;
  syncAllFamily: boolean;
  setSyncAllFamily: (val: boolean) => void;
  isSnoozeActive: boolean;
  remainingMinutes: number;
  alarmSnooze: any;
  colors: any;
  isDarkMode: boolean;
}

export function AlarmSnoozeModal({
  visible,
  onClose,
  onConfirm,
  onCancel,
  selectedDuration,
  setSelectedDuration,
  selectedMode,
  setSelectedMode,
  syncAllFamily,
  setSyncAllFamily,
  isSnoozeActive,
  remainingMinutes,
  alarmSnooze,
  colors,
  isDarkMode,
}: AlarmSnoozeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.bottomSheetContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Thanh kéo nhỏ (Handle) */}
          <View style={[styles.sheetHandle, isDarkMode && { backgroundColor: '#475569' }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Tạm dừng chuông báo động</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                Tạm tắt âm thanh còi hú mà vẫn duy trì giám sát AI & ghi hình 24/7
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.sheetCloseBtn, { backgroundColor: isDarkMode ? colors.surfaceSubtle : '#F1F5F9' }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Banner trạng thái nếu đang tạm tắt */}
          {isSnoozeActive && (
            <View
              style={[
                styles.activeSnoozeBanner,
                {
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Ionicons name="time" size={20} color="#D97706" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.activeSnoozeBannerTitle, { color: isDarkMode ? '#FBBF24' : '#B45309' }]}>
                  Chuông báo động đang tạm tắt
                </Text>
                <Text style={[styles.activeSnoozeBannerSub, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
                  {alarmSnooze?.until
                    ? `Thời gian còn lại: ${remainingMinutes} phút`
                    : 'Chế độ: Đến khi bật lại'} • {alarmSnooze?.mode === 'VIBRATE' ? 'Chỉ rung' : 'Tắt hoàn toàn âm thanh'}
                </Text>
              </View>
            </View>
          )}

          {/* 1. Tùy chọn thời gian */}
          <Text style={[styles.sheetSectionTitle, { color: colors.textPrimary }]}>
            1. Tùy chọn thời gian tạm tắt:
          </Text>
          <View style={styles.durationOptionsGrid}>
            {[
              { label: 'Tắt 15 phút', value: 15 },
              { label: 'Tắt 1 giờ', value: 60 },
              { label: 'Tắt 2 giờ', value: 120 },
              { label: 'Đến khi bật lại', value: 0 },
            ].map((item) => {
              const isSelected = selectedDuration === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.durationOptionBtn,
                    {
                      backgroundColor: isSelected
                        ? (isDarkMode ? 'rgba(14, 165, 233, 0.2)' : '#E0F2FE')
                        : (isDarkMode ? colors.surfaceSubtle : '#F8FAFC'),
                      borderColor: isSelected ? '#0284C7' : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedDuration(item.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={isSelected ? '#0284C7' : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.durationOptionText,
                      {
                        color: isSelected ? (isDarkMode ? '#38BDF8' : '#0369A1') : colors.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 2. Tùy chọn kiểu báo */}
          <Text style={[styles.sheetSectionTitle, { color: colors.textPrimary }]}>
            2. Tùy chọn kiểu báo khi có sự cố:
          </Text>
          <View style={styles.modeOptionList}>
            {[
              {
                key: 'VIBRATE',
                title: 'Chỉ rung (Vibrate Mode)',
                desc: 'Rung điện thoại người nhà, không phát còi loa Hub tại nhà',
                icon: 'phone-portrait-outline',
              },
              {
                key: 'SILENT',
                title: 'Tắt hoàn toàn âm thanh',
                desc: 'Không phát còi hú và không rung chuông, chỉ gửi thông báo đẩy',
                icon: 'volume-mute-outline',
              },
            ].map((item) => {
              const isSelected = selectedMode === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.modeOptionCard,
                    {
                      backgroundColor: isSelected
                        ? (isDarkMode ? 'rgba(14, 165, 233, 0.15)' : '#F0F9FF')
                        : (isDarkMode ? colors.surfaceSubtle : '#F8FAFC'),
                      borderColor: isSelected ? '#0284C7' : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedMode(item.key as any)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.modeOptionIconCircle,
                      {
                        backgroundColor: isSelected
                          ? '#0284C7'
                          : (isDarkMode ? '#334155' : '#E2E8F0'),
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={isSelected ? '#FFF' : colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[
                        styles.modeOptionCardTitle,
                        {
                          color: isSelected
                            ? (isDarkMode ? '#38BDF8' : '#0369A1')
                            : colors.textPrimary,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.modeOptionCardDesc, { color: colors.textSecondary }]}>
                      {item.desc}
                    </Text>
                  </View>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? '#0284C7' : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. Tùy chọn đồng bộ */}
          <View
            style={[
              styles.syncSectionRow,
              {
                backgroundColor: isDarkMode ? colors.surfaceSubtle : '#F8FAFC',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.syncTitle, { color: colors.textPrimary }]}>
                Đồng bộ tất cả tài khoản
              </Text>
              <Text style={[styles.syncSubtitle, { color: colors.textSecondary }]}>
                Áp dụng cho tất cả tài khoản người nhà đang theo dõi
              </Text>
            </View>
            <Switch
              value={syncAllFamily}
              onValueChange={setSyncAllFamily}
              trackColor={{ false: '#CBD5E1', true: '#38BDF8' }}
              thumbColor={syncAllFamily ? '#0284C7' : '#F1F5F9'}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.sheetActionRow}>
            {isSnoozeActive && (
              <TouchableOpacity
                style={styles.cancelSnoozeBtn}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications" size={18} color="#EF4444" />
                <Text style={styles.cancelSnoozeBtnText}>Bật lại chuông</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.confirmSnoozeBtn, { flex: 1 }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={20} color="#FFF" />
              <Text style={styles.confirmSnoozeBtnText}>
                {isSnoozeActive ? 'Cập nhật tạm dừng' : 'Xác nhận tạm dừng'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  activeSnoozeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  activeSnoozeBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeSnoozeBannerSub: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '500',
  },
  sheetSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  durationOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  durationOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
    minWidth: '47%',
    flex: 1,
  },
  durationOptionText: {
    fontSize: 13,
  },
  modeOptionList: {
    gap: 8,
    marginBottom: 16,
  },
  modeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  modeOptionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionCardTitle: {
    fontSize: 13.5,
    marginBottom: 2,
  },
  modeOptionCardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  syncSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  syncTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  syncSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmSnoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmSnoozeBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelSnoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 6,
  },
  cancelSnoozeBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AlarmSnoozeModal;
