// App.tsx
// Entry point React Native – Smart Elderly Care AI Mobile App

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { registerRootComponent } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './src/i18n/config';
import AppNavigator from './src/navigation/AppNavigator';
import { fcmService } from './src/services/fcm';
import api from './src/services/api';
import { useAuthStore } from './src/store/useAuthStore';
import i18n from './src/i18n/config';

export default function App() {
  const accessToken = useAuthStore((state: any) => state.accessToken);

  useEffect(() => {
    // Khởi tạo FCM push notifications khi app khởi động
    fcmService.initialize();

    return () => {
      fcmService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      void i18n.changeLanguage('vi');
      return undefined;
    }

    let isActive = true;
    api.get('/users/me')
      .then(({ data }) => {
        const language = data.preferred_language === 'en' ? 'en' : 'vi';
        if (isActive) void i18n.changeLanguage(language);
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(App);
