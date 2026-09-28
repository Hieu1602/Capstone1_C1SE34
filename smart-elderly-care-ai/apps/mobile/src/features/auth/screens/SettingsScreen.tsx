// SettingsScreen.tsx
// Màn hình Cài Đặt (Settings) - Hỗ trợ chuẩn Dark Mode / Light Mode

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';

export default function SettingsScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' },
      ]}
      edges={['top']}
    >
      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC',
            borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back-outline"
            size={24}
            color={isDarkMode ? '#F8FAFC' : '#0F172A'}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
          ]}
        >
          Cài đặt
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Khối 1: Hồ sơ của tôi */}
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#F1F5F9',
            },
          ]}
        >
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate?.('Profile')}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color={isDarkMode ? '#94A3B8' : '#475569'}
                />
              </View>
              <Text
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Hồ sơ của tôi
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Khối 2: Nhóm 3 mục (Cài đặt chung, Khả năng tiếp cận, Thông tin) */}
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#F1F5F9',
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
              <Text
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Cài đặt chung
              </Text>
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
              <Text
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Khả năng tiếp cận
              </Text>
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
              <Text
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Thông tin
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Khối 3: Nhóm 2 mục (Thiết lập thông báo, Rung) */}
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#F1F5F9',
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
              <Text
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Thiết lập thông báo
              </Text>
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
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setVibrationEnabled(!vibrationEnabled)}
          >
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
              <Text
                style={[
                  styles.itemTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Rung
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text
                style={[
                  styles.subText,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {vibrationEnabled ? 'Mở' : 'Tắt'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    marginLeft: 62,
  },
});
