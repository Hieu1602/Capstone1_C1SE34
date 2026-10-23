import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileHelpAccordionProps {
  isExpanded: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
  colors: any;
  onCallEmergency: () => void;
  onOpenSupport: () => void;
  onNavigateAppInfo: () => void;
}

export const ProfileHelpAccordion: React.FC<ProfileHelpAccordionProps> = ({
  isExpanded,
  onToggle,
  isDarkMode,
  colors,
  onCallEmergency,
  onOpenSupport,
  onNavigateAppInfo,
}) => {
  return (
    <View
      style={[
        styles.fbAccordionCard,
        isDarkMode && {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.fbAccordionHeader}
        activeOpacity={0.7}
        onPress={onToggle}
      >
        <View style={styles.fbAccordionHeaderLeft}>
          <Ionicons
            name="help-circle-outline"
            size={24}
            color={isDarkMode ? colors.textPrimary : '#0F172A'}
          />
          <Text
            style={[
              styles.fbAccordionTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Trợ giúp và hỗ trợ
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748B"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.fbAccordionBody}>
          {/* Cấp cứu 115 */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onCallEmergency}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#FEE2E2' },
              ]}
            >
              <Ionicons name="call" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  {
                    color: '#EF4444',
                    fontWeight: '800',
                  },
                ]}
              >
                Gọi cấp cứu y tế khẩn cấp 115
              </Text>
              <Text style={styles.fbSubRowSub}>
                Kết nối trực tiếp đường dây nóng y tế
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>

          <View
            style={[
              styles.fbSubDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          {/* Dịch vụ CSKH 24/7 */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onOpenSupport}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#EFF6FF' },
              ]}
            >
              <Ionicons name="headset" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Tổng đài hỗ trợ kỹ thuật CSKH 24/7
              </Text>
              <Text style={styles.fbSubRowSub}>
                Hỗ trợ kết nối camera, vòng tay, hub AI
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>

          <View
            style={[
              styles.fbSubDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          {/* Hướng dẫn sử dụng & Giới thiệu đồ án */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onNavigateAppInfo}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#F3E8FF' },
              ]}
            >
              <Ionicons name="book-outline" size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Hướng dẫn sử dụng & Giới thiệu đồ án
              </Text>
              <Text style={styles.fbSubRowSub}>
                Tài liệu kỹ thuật Smart Elderly Care AI
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fbAccordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fbAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fbAccordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fbAccordionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  fbAccordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  fbAccordionSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  fbSubIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbSubRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  fbSubRowSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fbSubDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 46,
  },
});

