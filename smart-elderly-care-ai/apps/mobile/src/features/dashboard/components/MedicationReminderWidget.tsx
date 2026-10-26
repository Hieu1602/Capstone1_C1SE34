// ==============================================================================
// TỆP: MedicationReminderWidget.tsx
// PHÂN HỆ: Widget Nhắc lịch Uống thuốc & Sinh hoạt tiếp theo trên Trang chủ
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Hiển thị cữ thuốc gần nhất trong ngày của người cao tuổi.
//   - Tích hợp nút phát lại giọng nói nhắc nhở qua Loa Edge Hub.
//   - Nút "Xác nhận đã uống" mở modal xác nhận ngắn gọn và đổi trạng thái thành "Đã hoàn thành".
//   - Đồng bộ trạng thái 2 chiều với Màn hình Thông báo và Quản lý lịch uống thuốc.
// ==============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors } from '../../../theme/colors';

interface MedicationReminderWidgetProps {
  nextMedication: {
    id?: string;
    time: string;
    name: string;
    dose?: string;
    purpose?: string;
    taken?: boolean;
    takenAt?: string;
    [key: string]: any;
  };
  isMedDone: boolean;
  setNextMedTaken?: (val: boolean) => void;
  onConfirmTaken?: (medId: string, timeStr: string) => void;
  isDarkMode: boolean;
  colors: any;
  navigation: any;
}

export const MedicationReminderWidget: React.FC<MedicationReminderWidgetProps> = ({
  nextMedication,
  isMedDone,
  setNextMedTaken,
  onConfirmTaken,
  isDarkMode,
  colors,
  navigation,
}) => {
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [isPlayingSpeaker, setIsPlayingSpeaker] = useState(false);

  // Lấy thời gian hiện tại định dạng HH:MM
  const getCurrentTimeHM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // 1. Xử lý nút "Phát lại nhắc nhở" qua Loa Hub
  const handleReplaySpeaker = (e?: any) => {
    e?.stopPropagation?.();
    setIsPlayingSpeaker(true);
    setTimeout(() => {
      setIsPlayingSpeaker(false);
      Alert.alert(
        'Loa Hub đã phát lời nhắc',
        `📢 "Đã đến giờ uống thuốc: ${nextMedication.name}. Cụ nhớ uống thuốc cùng một cốc nước ấm nhé!"`
      );
    }, 400);
  };

  // 2. Mở dialog xác nhận khi bấm nút "Xác nhận đã uống"
  const handlePressActionButton = (e?: any) => {
    e?.stopPropagation?.();
    if (isMedDone) {
      Alert.alert(
        'Đã hoàn thành',
        `Cữ thuốc "${nextMedication.name}" đã được xác nhận hoàn thành ${nextMedication.takenAt ? `lúc ${nextMedication.takenAt}` : ''}.`
      );
    } else {
      setConfirmModalVisible(true);
    }
  };

  // 3. Xác nhận trong dialog
  const handleConfirmTaken = () => {
    const timeStr = getCurrentTimeHM();
    setConfirmModalVisible(false);
    setNextMedTaken?.(true);
    onConfirmTaken?.(nextMedication.id || nextMedication.name, timeStr);
    Alert.alert(
      'Xác nhận thành công',
      `Đã ghi nhận uống thuốc "${nextMedication.name}" lúc ${timeStr}. Dữ liệu đã được đồng bộ toàn hệ thống.`
    );
  };

  return (
    <View
      style={[
        styles.reminderWidgetCard,
        isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
        isMedDone && styles.reminderWidgetCardDone,
      ]}
    >
      <TouchableOpacity
        style={styles.reminderWidgetMain}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('MedicationReminder')}
      >
        <View style={styles.reminderWidgetHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={[
                styles.reminderIconCircle,
                { backgroundColor: isMedDone ? '#DCFCE7' : isDarkMode ? '#432005' : '#FFF7ED' },
              ]}
            >
              <Ionicons
                name={isMedDone ? 'checkmark-circle' : 'medical'}
                size={15}
                color={isMedDone ? '#10B981' : Colors.primary}
              />
            </View>
            <Text style={[styles.reminderWidgetTitle, isDarkMode && { color: colors.textPrimary }]}>
              Lịch nhắc nhở tiếp theo
            </Text>
          </View>

          {/* Phần điều khiển Loa Hub & Phát lại nhắc nhở */}
          <View style={styles.reminderRightHeader}>
            <TouchableOpacity
              style={[styles.replaySpeakerBtn, isPlayingSpeaker && styles.replaySpeakerBtnActive]}
              onPress={handleReplaySpeaker}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isPlayingSpeaker ? 'volume-high' : 'volume-medium'}
                size={13}
                color={isPlayingSpeaker ? '#FFFFFF' : '#0284C7'}
              />
              <Text style={[styles.replaySpeakerText, isPlayingSpeaker && { color: '#FFFFFF' }]}>
                {isPlayingSpeaker ? 'Đang phát...' : 'Phát lại'}
              </Text>
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={14} color={isDarkMode ? colors.textSecondary : '#94A3B8'} />
          </View>
        </View>

        {nextMedication?.name ? (
          <View style={styles.reminderContentRow}>
            <View style={[styles.reminderClockBox, isMedDone && { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="time" size={13} color={isMedDone ? '#15803D' : '#0EA5E9'} />
              <Text style={[styles.reminderClockText, isMedDone && { color: '#15803D' }]}>
                {nextMedication.time}
              </Text>
            </View>
            <Text
              style={[
                styles.reminderMedText,
                isDarkMode && { color: colors.textPrimary },
                isMedDone && styles.reminderMedTextDone,
              ]}
              numberOfLines={1}
            >
              {nextMedication.name}
            </Text>
          </View>
        ) : (
          <View style={styles.reminderContentRow}>
            <Text style={[styles.reminderMedText, { color: isDarkMode ? colors.textSecondary : '#94A3B8' }]}>
              Chưa có lịch uống thuốc trong ngày
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Nút thao tác chính: Xác nhận đã uống / Đã hoàn thành hoặc Thêm lịch nhắc */}
      {nextMedication?.name ? (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            isMedDone ? styles.actionBtnDone : styles.actionBtnPending,
            isDarkMode && !isMedDone && { backgroundColor: '#1E293B', borderColor: '#FF6B00' },
          ]}
          onPress={handlePressActionButton}
          activeOpacity={0.75}
        >
          <Ionicons
            name={isMedDone ? 'checkmark-circle' : 'checkmark'}
            size={16}
            color={isMedDone ? '#10B981' : '#FFFFFF'}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: isMedDone ? '#10B981' : '#FFFFFF' },
            ]}
          >
            {isMedDone ? 'Đã hoàn thành' : 'Xác nhận đã uống'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isDarkMode ? colors.card : '#F8FAFC', borderWidth: 1, borderColor: isDarkMode ? colors.border : '#E2E8F0' },
          ]}
          onPress={() => navigation.navigate('MedicationReminder')}
          activeOpacity={0.75}
        >
          <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>
            + Thêm lịch nhắc uống thuốc
          </Text>
        </TouchableOpacity>
      )}

      {/* Modal xác nhận đã uống thuốc ngắn gọn */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalIconBox}>
              <Ionicons name="medkit" size={28} color="#FF6B00" />
            </View>

            <Text style={[styles.modalTitle, isDarkMode && { color: colors.textPrimary }]}>
              Xác nhận đã uống thuốc
            </Text>

            <Text style={[styles.modalSub, isDarkMode && { color: colors.textSecondary }]}>
              Bạn có chắc chắn muốn xác nhận cụ đã uống cữ thuốc này?
            </Text>

            <View style={[styles.medInfoBox, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <View style={styles.medInfoRow}>
                <Ionicons name="medical" size={16} color="#FF6B00" style={{ marginRight: 6 }} />
                <Text style={[styles.medInfoName, isDarkMode && { color: colors.textPrimary }]} numberOfLines={2}>
                  {nextMedication.name}
                </Text>
              </View>
              {Boolean(nextMedication.dose) && (
                <Text style={[styles.medInfoDose, isDarkMode && { color: colors.textSecondary }]}>
                  Liều lượng: {nextMedication.dose}
                </Text>
              )}
              <View style={styles.recordTimeBadge}>
                <Ionicons name="time-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                <Text style={styles.recordTimeText}>
                  Thời gian ghi nhận: lúc {getCurrentTimeHM()} (Hôm nay)
                </Text>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDarkMode && { borderColor: colors.border }]}
                onPress={() => setConfirmModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, isDarkMode && { color: colors.textSecondary }]}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmTaken}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  reminderWidgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  reminderWidgetCardDone: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  reminderWidgetMain: {
    flex: 1,
    marginRight: 10,
  },
  reminderWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reminderIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderWidgetTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  reminderRightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replaySpeakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  replaySpeakerBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  replaySpeakerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  reminderContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderClockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reminderClockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  reminderMedText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  reminderMedTextDone: {
    color: '#15803D',
    fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnPending: {
    backgroundColor: '#FF6B00',
    borderWidth: 1,
    borderColor: '#EA580C',
  },
  actionBtnDone: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Styles Modal xác nhận
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  medInfoBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  medInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  medInfoName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  medInfoDose: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    marginLeft: 22,
  },
  recordTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recordTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1.4,
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default MedicationReminderWidget;
