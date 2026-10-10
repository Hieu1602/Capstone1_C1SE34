// SettingsScreen.tsx
// Màn hình Cài Đặt (Settings) - Hỗ trợ chuẩn Dark Mode / Light Mode

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { LocalizedText } from '../../../i18n/LocalizedComponents';


export default function SettingsScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      edges={['top']}
    >
      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back-outline"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <LocalizedText
          style={[
            styles.headerTitle,
            { color: colors.textPrimary },
          ]}
        >
          Cài đặt
        </LocalizedText>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Khối 1: Hồ sơ người giám sát & Hồ sơ bệnh án người cao tuổi */}
        <View style={styles.sectionHeading}>
          <LocalizedText style={[styles.sectionLabel, { color: colors.textMuted }]}>TÀI KHOẢN & CHĂM SÓC</LocalizedText>
          <LocalizedText style={[styles.sectionCount, { color: colors.textMuted }]}>02</LocalizedText>
        </View>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Mục 1: Hồ sơ người giám sát */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate?.('Profile')}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' },
                ]}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color="#6366F1"
                />
              </View>
              <View>
                <LocalizedText
                  style={[
                    styles.itemTitle,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  Hồ sơ người giám sát
                </LocalizedText>
                <LocalizedText
                  style={[
                    styles.itemSubtitle,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Tài khoản người thân theo dõi, SĐT liên hệ khẩn cấp
                </LocalizedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
            ]}
          />

          {/* Mục 2: Hồ sơ bệnh án người cao tuổi */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate?.('PatientMedicalRecord')}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' },
                ]}
              >
                <Ionicons
                  name="medkit-outline"
                  size={20}
                  color="#0EA5E9"
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <LocalizedText
                    style={[
                      styles.itemTitle,
                      { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                    ]}
                  >
                    Hồ sơ bệnh án người cao tuổi
                  </LocalizedText>
                  <View style={[styles.aesBadge, { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' }]}>
                    <LocalizedText style={styles.aesBadgeText}>Bảo mật AES-256</LocalizedText>
                  </View>
                </View>
                <LocalizedText
                  style={[
                    styles.itemSubtitle,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Thông tin cụ, bệnh nền, nhóm máu &amp; đơn thuốc
                </LocalizedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Khối 2: Nhóm 3 mục (Cài đặt chung, Khả năng tiếp cận, Thông tin) */}
        <View style={styles.sectionHeading}>
          <LocalizedText style={[styles.sectionLabel, { color: colors.textMuted }]}>ỨNG DỤNG</LocalizedText>
          <LocalizedText style={[styles.sectionCount, { color: colors.textMuted }]}>03</LocalizedText>
        </View>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Mục 1: Cài đặt chung */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={isDarkMode ? '#94A3B8' : '#475569'}
                />
              </View>
              <LocalizedText
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Cài đặt chung
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Đường gạch phân cách */}
          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
            ]}
          />

          {/* Mục 2: Khả năng tiếp cận */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name="accessibility-outline"
                  size={20}
                  color={isDarkMode ? '#94A3B8' : '#475569'}
                />
              </View>
              <LocalizedText
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Khả năng tiếp cận
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Đường gạch phân cách */}
          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
            ]}
          />

          {/* Mục 3: Thông tin */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={isDarkMode ? '#94A3B8' : '#475569'}
                />
              </View>
              <LocalizedText
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Thông tin
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Khối 3: Nhóm 2 mục (Thiết lập thông báo, Rung) */}
        <View style={styles.sectionHeading}>
          <LocalizedText style={[styles.sectionLabel, { color: colors.textMuted }]}>CẢNH BÁO & PHẢN HỒI</LocalizedText>
          <LocalizedText style={[styles.sectionCount, { color: colors.textMuted }]}>02</LocalizedText>
        </View>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Mục 1: Thiết lập thông báo */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={isDarkMode ? '#94A3B8' : '#475569'}
                />
              </View>
              <LocalizedText
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Thiết lập thông báo
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Đường gạch phân cách */}
          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
            ]}
          />

          {/* Mục 2: Rung */}
          <View style={styles.menuItem}>
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={isDarkMode ? '#94A3B8' : '#475569'}
                />
              </View>
              <LocalizedText
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Rung
              </LocalizedText>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              trackColor={{ false: isDarkMode ? '#475569' : '#CBD5E1', true: colors.primary }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Bật hoặc tắt rung"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRightSpacer: {
    width: 38,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 10,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: -4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subText: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 66,
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  aesBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aesBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
});

