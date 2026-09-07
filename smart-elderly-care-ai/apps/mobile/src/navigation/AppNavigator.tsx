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
import { useAuthStore } from '../store/useVitalStore';

// Auth screens
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';

// 5 Main Tab screens
import HomeScreen from '../features/dashboard/screens/HomeScreen';
import DevicesScreen from '../features/dashboard/screens/DevicesScreen';
import AIAssistantScreen from '../features/dashboard/screens/AIAssistantScreen';
import AlertsListScreen from '../features/alerts/screens/AlertsListScreen';
import ProfileScreen from '../features/auth/screens/ProfileScreen';

// Sub / Detail screens
import CameraDetailScreen from '../features/livestream/screens/CameraDetailScreen';
import HouseDetailScreen from '../features/dashboard/screens/HouseDetailScreen';
import AIModelDetailScreen from '../features/dashboard/screens/AIModelDetailScreen';
import AlgoConfigScreen from '../features/dashboard/screens/AlgoConfigScreen';
import MedicalReportScreen from '../features/history/MedicalReportScreen';
import IncidentDetailScreen from '../features/alerts/screens/IncidentDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ---- 5-Tab Navigator (Trang chủ, Thiết bị, Bot AI, Cảnh báo, Tôi) ----
function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // Thiết kế hiện đại tinh gọn như ảnh mẫu
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarIcon: ({ focused, color, size }) => {
          // Tab giữa: Robot AI Bot
          if (route.name === 'AIAssistant') {
            return <AIBotIcon size={46} focused={focused} />;
          }

          let iconName: any = 'ellipse';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Devices') {
            iconName = focused ? 'bag-handle' : 'bag-handle-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={26} color={focused ? Colors.primary : '#94A3B8'} />
              {/* Chấm tròn đỏ cho thông báo mới */}
              {route.name === 'Alerts' && !focused && <View style={styles.tabBadgeDot} />}
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

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // Main App Stack
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="CameraDetail" component={CameraDetailScreen} />
            <Stack.Screen name="HouseDetail" component={HouseDetailScreen} />
            <Stack.Screen name="AIModelDetail" component={AIModelDetailScreen} />
            <Stack.Screen name="AlgoConfig" component={AlgoConfigScreen} />
            <Stack.Screen name="MedicalReport" component={MedicalReportScreen} />
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
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
  },
});
