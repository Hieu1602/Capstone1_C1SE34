import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';

interface HealthMedicalRecordLinkProps {
  onPress: () => void;
  isDarkMode?: boolean;
  colors?: any;
}

export const HealthMedicalRecordLink: React.FC<HealthMedicalRecordLinkProps> = ({
  onPress,
  isDarkMode = false,
  colors = {},
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.recordLinkCard,
        isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.recordLinkLeft}>
        <View style={styles.recordLinkIconCircle}>
          <Ionicons name="medical" size={20} color="#2563EB" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.recordLinkTitle, { color: colors.textPrimary }]}>
            Hồ Sơ Bệnh Án Điện Tử (Chuẩn AES-256)
          </Text>
          <Text style={[styles.recordLinkSub, { color: colors.textMuted }]}>
            Xem tiền sử tim mạch, huyết áp, đơn thuốc và nhật ký bác sĩ điều trị
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#2563EB" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  recordLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    ...Shadows.soft,
  },
  recordLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  recordLinkIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordLinkTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  recordLinkSub: {
    fontSize: 11,
    lineHeight: 15,
  },
});

