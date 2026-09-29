// App.tsx
// Entry point React Native – Smart Elderly Care AI Mobile App

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, LogBox, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import { fcmService } from './src/services/fcm';

// Bỏ qua các cảnh báo tương thích style không nghiêm trọng trên nền tảng Web
LogBox.ignoreLogs([
  '"shadow*" style props are deprecated',
  '"textShadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
]);

if (Platform.OS === 'web') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('style props are deprecated') ||
        args[0].includes('pointerEvents is deprecated'))
    ) {
      return;
    }
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('style props are deprecated') ||
        args[0].includes('pointerEvents is deprecated'))
    ) {
      return;
    }
    originalError(...args);
  };
}

export default function App() {
  useEffect(() => {
    // Khởi tạo FCM push notifications khi app khởi động
    fcmService.initialize();

    return () => {
      fcmService.cleanup();
    };
  }, []);

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
