// AppNavigator.tsx
// React Navigation – 4 Tabs chuẩn phong cách SmartCare AI & Stack Screens

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../theme/colors';
import AIBotIcon from '../components/AIBotIcon';
import { useVitalStore } from '../store/useVitalStore';

// Auth screens
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';

// 5 Main Tab screens
import HomeScreen from '../features/dashboard/screens/HomeScreen';
import AlertsListScreen from '../features/alerts/screens/AlertsListScreen';
import AIAssistantScreen from '../features/dashboard/screens/AIAssistantScreen';
import ProfileScreen from '../features/auth/screens/ProfileScreen';

// Sub / Detail screens
import DevicesScreen from '../features/dashboard/screens/DevicesScreen';
import CameraDetailScreen from '../features/livestream/screens/CameraDetailScreen';
import MultiViewScreen from '../features/livestream/screens/MultiViewScreen';
import HouseDetailScreen from '../features/dashboard/screens/HouseDetailScreen';
import AIModelDetailScreen from '../features/dashboard/screens/AIModelDetailScreen';
import AlgoConfigScreen from '../features/dashboard/screens/AlgoConfigScreen';
import MedicalReportScreen from '../features/history/MedicalReportScreen';
import IncidentDetailScreen from '../features/alerts/screens/IncidentDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ---- 4-Tab Navigator (Trang chủ, Cảnh báo sự cố, Trợ lý AI, Tài khoản) ----
function MainTabNavigator() {
  const { incidents } = useVitalStore();
  const hasUnreadAlerts = incidents.some((inc) => !inc.is_acknowledged);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarIcon: ({ focused, color, size }) => {
          // Tab 3: Robot AI Bot
          if (route.name === 'AIAssistant') {
            return <AIBotIcon size={46} focused={focused} />;
          }

          let iconName: any = 'ellipse';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={25} color={color} />
              {/* Chấm tròn đỏ cho sự cố khẩn cấp chưa xử lý */}
              {route.name === 'Alerts' && hasUnreadAlerts && <View style={styles.tabBadgeDot} />}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Alerts" component={AlertsListScreen} />
      <Tab.Screen name="AIAssistant" component={AIAssistantScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ---- Root Stack Navigator ----
export default function AppNavigator() {
  return (
    <NavigationContainer key={isAuthenticated ? 'authenticated' : 'unauthenticated'}>
      <Stack.Navigator
        key={isAuthenticated ? 'authenticated' : 'unauthenticated'}
        screenOptions={{ headerShown: false }}
      >
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
