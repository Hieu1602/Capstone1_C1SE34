// DoctorTabNavigator.tsx
// 4-Tab Taskbar chuyên dụng dành riêng cho Bác sĩ gia đình (Icon-only, căn đều, hiệu ứng active rõ ràng)

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../store/useThemeStore';

import DoctorHomeScreen from '../features/doctor/screens/DoctorHomeScreen';
import DoctorAppointmentsScreen from '../features/doctor/screens/DoctorAppointmentsScreen';
import DoctorPatientsScreen from '../features/doctor/screens/DoctorPatientsScreen';
import DoctorProfileScreen from '../features/doctor/screens/DoctorProfileScreen';

const Tab = createBottomTabNavigator();

export default function DoctorTabNavigator() {
  const { isDarkMode, colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="DoctorHome"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // Ẩn hoàn toàn nhãn chữ theo yêu cầu
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ],
        tabBarActiveTintColor: '#0284C7',
        tabBarInactiveTintColor: isDarkMode ? '#64748B' : '#94A3B8',
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused, color }) => {
          let iconName: any = 'ellipse';

          // 1. Trang chủ (Home)
          if (route.name === 'DoctorHome') {
            iconName = focused ? 'home' : 'home-outline';
          }
          // 2. Lịch khám (Calendar)
          else if (route.name === 'DoctorAppointments') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          }
          // 3. Bệnh nhân (Users / People)
          else if (route.name === 'DoctorPatients') {
            iconName = focused ? 'people' : 'people-outline';
          }
          // 4. Cài đặt (Settings / Cog)
          else if (route.name === 'DoctorProfile') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return (
            <View
              style={[
                styles.iconWrapper,
                focused && {
                  backgroundColor: isDarkMode ? '#0284C72B' : '#E0F2FE',
                },
              ]}
            >
              <Ionicons
                name={iconName}
                size={focused ? 24 : 22}
                color={focused ? '#0284C7' : color}
              />
              {/* Chỉ báo active tinh tế */}
              {focused && <View style={styles.activeDot} />}
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
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 52,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0284C7',
  },
});
