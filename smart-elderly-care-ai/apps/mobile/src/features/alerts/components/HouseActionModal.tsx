import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';

export type HouseModalMode = 'invite' | 'join_request';

interface HouseActionModalProps {
  visible: boolean;
  mode: HouseModalMode;
  item: any;
  isResponding: boolean;
  isDarkMode: boolean;
  colors: any;
  onClose: () => void;
  onRespond: (item: any, action: 'accept' | 'reject') => void;
}

const MODAL_CONFIG: Record<
  HouseModalMode,
  {
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    title: string;
    subtitle: string;
    fallbackMessage: string;
    acceptLabel: string;
    acceptBg: string;
  }
> = {
  invite: {
    icon: 'home',
    iconBg: '#FFF7ED',
    iconColor: '#EA580C',
    title: 'Lời mời tham gia căn nhà',
    subtitle: 'Xác nhận vào ngôi nhà',
    fallbackMessage: 'Bạn nhận được lời mời tham gia căn nhà từ Chủ hộ.',
    acceptLabel: 'Xác nhận vào nhà',
    acceptBg: '#16A34A',
  },
  join_request: {
    icon: 'person-add',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    title: 'Yêu cầu gia nhập căn nhà',
    subtitle: 'Phê duyệt quyền thành viên',
    fallbackMessage: 'Có thành viên yêu cầu tham gia căn nhà của bạn.',
    acceptLabel: 'Cho phép vào nhà',
    acceptBg: '#2563EB',
  },
};

export const HouseActionModal: React.FC<HouseActionModalProps> = ({
  visible,
  mode,
  item,
  isResponding,
  isDarkMode,
  colors,
  onClose,
  onRespond,
}) => {
  const cfg = MODAL_CONFIG[mode];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeaderRow}>
            <View style={[styles.modalIconCircle, { backgroundColor: cfg.iconBg }]}>
              <Ionicons name={cfg.icon} size={24} color={cfg.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, isDarkMode && { color: colors.textPrimary }]}>{cfg.title}</Text>
              <Text style={[styles.modalSub, isDarkMode && { color: colors.textSecondary }]}>{cfg.subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalMessage, isDarkMode && { color: colors.textPrimary }]}>
            {item?.message || cfg.fallbackMessage}
          </Text>

          <View style={styles.modalActionRow}>
            <TouchableOpacity
              style={styles.modalBtnReject}
              onPress={() => onRespond(item, 'reject')}
              activeOpacity={0.7}
              disabled={isResponding}
            >
              <Text style={styles.modalBtnRejectText}>Từ chối</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnAccept, { backgroundColor: cfg.acceptBg }]}
              onPress={() => onRespond(item, 'accept')}
              activeOpacity={0.8}
              disabled={isResponding}
            >
              {isResponding ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.modalBtnAcceptText}>{cfg.acceptLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  modalIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalMessage: { fontSize: 14, lineHeight: 21, color: '#334155', marginBottom: 20 },
  modalActionRow: { flexDirection: 'row', gap: 12 },
  modalBtnReject: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  modalBtnRejectText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  modalBtnAccept: { flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  modalBtnAcceptText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
