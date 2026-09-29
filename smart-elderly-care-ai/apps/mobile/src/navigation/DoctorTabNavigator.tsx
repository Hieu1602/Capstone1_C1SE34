// DoctorTabNavigator.tsx
// 4-Tab Navigator dành riêng cho Bác sĩ gia đình

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../theme/colors';
import { useTheme } from '../store/useThemeStore';

import DoctorPatientsScreen from '../features/doctor/screens/DoctorPatientsScreen';
import DoctorPrescriptionsScreen from '../features/doctor/screens/DoctorPrescriptionsScreen';
import DoctorAnalyticsReportScreen from '../features/doctor/screens/DoctorAnalyticsReportScreen';
import DoctorProfileScreen from '../features/doctor/screens/DoctorProfileScreen';

const Tab = createBottomTabNavigator();

export default function DoctorTabNavigator() {
  const { isDarkMode, colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="DoctorPatients"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ],
        tabBarActiveTintColor: '#0284C7',
        tabBarInactiveTintColor: isDarkMode ? '#64748B' : '#94A3B8',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = 'ellipse';

          if (route.name === 'DoctorPatients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'DoctorPrescriptions') {
            iconName = focused ? 'medkit' : 'medkit-outline';
          } else if (route.name === 'DoctorAnalytics') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'DoctorProfile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={22} color={focused ? '#0284C7' : color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="DoctorPatients"
        component={DoctorPatientsScreen}
        options={{ tabBarLabel: 'Bệnh nhân' }}
      />
      <Tab.Screen
        name="DoctorPrescriptions"
        component={DoctorPrescriptionsScreen}
        options={{ tabBarLabel: 'Đơn thuốc' }}
      />
      <Tab.Screen
        name="DoctorAnalytics"
        component={DoctorAnalyticsReportScreen}
        options={{ tabBarLabel: 'Báo cáo' }}
      />
      <Tab.Screen
        name="DoctorProfile"
        component={DoctorProfileScreen}
        options={{ tabBarLabel: 'Bác sĩ' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
