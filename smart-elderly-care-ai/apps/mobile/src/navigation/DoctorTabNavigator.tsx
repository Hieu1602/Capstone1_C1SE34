// DoctorTabNavigator.tsx
// Thanh điều hướng đáy dạng nổi bo tròn mềm (Floating Bottom Tab Bar - Lấy cảm hứng Ảnh 2)
// Tab đang chọn hiển thị dạng viên thuốc xanh dương (#2563EB) nổi bật kèm tên tab

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../store/useThemeStore';

import DoctorHomeScreen from '../features/doctor/screens/DoctorHomeScreen';
import DoctorAppointmentsScreen from '../features/doctor/screens/DoctorAppointmentsScreen';
import DoctorPatientsScreen from '../features/doctor/screens/DoctorPatientsScreen';
import DoctorProfileScreen from '../features/doctor/screens/DoctorProfileScreen';

const Tab = createBottomTabNavigator();

export default function DoctorTabNavigator() {
  const { isDarkMode, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const tabLabels: Record<string, string> = {
    DoctorHome: 'Trang chủ',
    DoctorAppointments: 'Lịch khám',
    DoctorPatients: 'Bệnh nhân',
    DoctorProfile: 'Cài đặt',
  };

  const tabIcons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
    DoctorHome: { active: 'home', inactive: 'home-outline' },
    DoctorAppointments: { active: 'calendar', inactive: 'calendar-outline' },
    DoctorPatients: { active: 'people', inactive: 'people-outline' },
    DoctorProfile: { active: 'settings', inactive: 'settings-outline' },
  };

  return (
    <Tab.Navigator
      initialRouteName="DoctorHome"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: isDarkMode ? '#334155' : 'rgba(226, 232, 240, 0.8)',
            bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 14,
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused }) => {
          const icons = tabIcons[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
          const iconName = focused ? icons.active : icons.inactive;
          const label = tabLabels[route.name] || '';

          if (focused) {
            return (
              <View style={styles.activePill}>
                <Ionicons name={iconName} size={18} color="#FFFFFF" />
                <Text style={styles.activePillText} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            );
          }

          return (
            <View style={styles.inactiveIconWrap}>
              <Ionicons
                name={iconName}
                size={22}
                color={isDarkMode ? '#94A3B8' : '#64748B'}
              />
            </View>
          );
        },
      })}
    >
      {/* 1. Trang chủ */}
      <Tab.Screen name="DoctorHome" component={DoctorHomeScreen} />

      {/* 2. Lịch khám */}
      <Tab.Screen name="DoctorAppointments" component={DoctorAppointmentsScreen} />

      {/* 3. Bệnh nhân */}
      <Tab.Screen name="DoctorPatients" component={DoctorPatientsScreen} />

      {/* 4. Cài đặt */}
      <Tab.Screen name="DoctorProfile" component={DoctorProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    ...(Platform.OS === 'web' ? { width: 'calc(100% - 32px)' as any } : {}),
  },
  tabBarItem: {
    flex: 1,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
    gap: 5,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  inactiveIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
