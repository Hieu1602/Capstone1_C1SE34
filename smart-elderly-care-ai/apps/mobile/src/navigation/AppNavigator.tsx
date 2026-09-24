// AppNavigator.tsx
// React Navigation – 5 Tabs chuẩn phong cách Imou / SmartCare AI & Stack Screens

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../theme/colors';
import AIBotIcon from '../components/AIBotIcon';
import { useAuthStore, useVitalStore } from '../store/useVitalStore';

// Auth screens
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';

// 5 Main Tab screens
import HomeScreen from '../features/dashboard/screens/HomeScreen';
import DevicesScreen from '../features/dashboard/screens/DevicesScreen';
import AIAssistantScreen from '../features/dashboard/screens/AIAssistantScreen';
import AlertsListScreen from '../features/alerts/screens/AlertsListScreen';
import ProfileScreen from '../features/auth/screens/ProfileScreen';

// Sub / Detail screens
import CameraDetailScreen from '../features/livestream/screens/CameraDetailScreen';
import MultiViewScreen from '../features/livestream/screens/MultiViewScreen';
import HouseDetailScreen from '../features/dashboard/screens/HouseDetailScreen';
import AIModelDetailScreen from '../features/dashboard/screens/AIModelDetailScreen';
import AlgoConfigScreen from '../features/dashboard/screens/AlgoConfigScreen';
import MedicalReportScreen from '../features/history/MedicalReportScreen';
import IncidentDetailScreen from '../features/alerts/screens/IncidentDetailScreen';
import AddDeviceScreen from '../features/dashboard/screens/AddDeviceScreen';
import CreateGroupScreen from '../features/dashboard/screens/CreateGroupScreen';
import SmartbandDetailScreen from '../features/dashboard/screens/SmartbandDetailScreen';
import HealthDetailScreen from '../features/dashboard/screens/HealthDetailScreen';
import PatientMedicalRecordScreen from '../features/dashboard/screens/PatientMedicalRecordScreen';
import MedicationReminderScreen from '../features/dashboard/screens/MedicationReminderScreen';
import SettingsScreen from '../features/auth/screens/SettingsScreen';
import { useTheme } from '../store/useThemeStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ---- 5-Tab Navigator (Trang chủ, Thiết bị, Bot AI, Cảnh báo, Tôi) ----
function MainTabNavigator() {
  const { isDarkMode, colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // Thiết kế hiện đại tinh gọn như ảnh mẫu
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ],
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: isDarkMode ? '#64748B' : '#94A3B8',
        tabBarIcon: ({ focused, color, size }) => {
          // Tab giữa: Robot AI Bot
          if (route.name === 'AIAssistant') {
            return <AIBotIcon size={46} focused={focused} />;
          }

          let iconName: any = 'ellipse';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Devices') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          const iconSize = route.name === 'Alerts' ? 24 : 26;

          return (
            <View style={styles.iconContainer}>
              <Ionicons
                name={iconName}
                size={iconSize}
                color={focused ? Colors.primary : (isDarkMode ? '#64748B' : '#94A3B8')}
              />
              {/* Chấm tròn đỏ cho thông báo mới */}
              {route.name === 'Alerts' && (
                <View style={[styles.tabBadgeDot, { borderColor: colors.card }]} />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Devices" component={DevicesScreen} />
      <Tab.Screen name="AIAssistant" component={AIAssistantScreen} />
      <Tab.Screen name="Alerts" component={AlertsListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ---- Root Stack Navigator ----
export default function AppNavigator() {
  const { accessToken } = useAuthStore();
  const isAuthenticated = Boolean(accessToken);
  const { isDarkMode, colors } = useTheme();

  return (
    <NavigationContainer
      theme={{
        dark: isDarkMode,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.textPrimary,
          border: colors.border,
          notification: '#EF4444',
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          // Main App Stack
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="Devices" component={DevicesScreen} />
            <Stack.Screen name="CameraDetail" component={CameraDetailScreen} />
            <Stack.Screen name="MultiView" component={MultiViewScreen} />
            <Stack.Screen name="HouseDetail" component={HouseDetailScreen} />
            <Stack.Screen name="AIModelDetail" component={AIModelDetailScreen} />
            <Stack.Screen name="AlgoConfig" component={AlgoConfigScreen} />
            <Stack.Screen name="MedicalReport" component={MedicalReportScreen} />
            <Stack.Screen name="AddDevice" component={AddDeviceScreen} />
            <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
            <Stack.Screen name="SmartbandDetail" component={SmartbandDetailScreen} />
            <Stack.Screen name="HealthDetail" component={HealthDetailScreen} />
            <Stack.Screen name="PatientMedicalRecord" component={PatientMedicalRecordScreen} />
            <Stack.Screen name="MedicationReminder" component={MedicationReminderScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="IncidentDetail"
              component={IncidentDetailScreen}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    height: 62,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabBadgeDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
