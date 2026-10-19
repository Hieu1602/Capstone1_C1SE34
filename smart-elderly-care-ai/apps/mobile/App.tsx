// App.tsx
// Entry point React Native – Smart Elderly Care AI Mobile App

import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { StatusBar, LogBox, Platform } from "react-native";
import { registerRootComponent } from "expo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "./src/i18n/config";
import AppNavigator from "./src/navigation/AppNavigator";
import { fcmService } from "./src/services/fcm";
import api from "./src/services/api";
import { useAuthStore } from "./src/store/useAuthStore";
import i18n from "./src/i18n/config";

// Bỏ qua các cảnh báo tương thích style không nghiêm trọng trên nền tảng Web
LogBox.ignoreLogs([
    '"shadow*" style props are deprecated',
    '"textShadow*" style props are deprecated',
    "props.pointerEvents is deprecated",
]);

if (Platform.OS === "web") {
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
        if (
            typeof args[0] === "string" &&
            (args[0].includes("style props are deprecated") ||
                args[0].includes("pointerEvents is deprecated"))
        ) {
            return;
        }
        originalWarn(...args);
    };

    const originalError = console.error;
    console.error = (...args: any[]) => {
        if (
            typeof args[0] === "string" &&
            (args[0].includes("style props are deprecated") ||
                args[0].includes("pointerEvents is deprecated"))
        ) {
            return;
        }
        originalError(...args);
    };
}

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
        if (Platform.OS !== "web" || typeof document === "undefined")
            return undefined;

        // Load Google Fonts (Inter, Be Vietnam Pro & Plus Jakarta Sans) for full Vietnamese diacritics support
        const fontLinkId = "smartcare-vietnamese-google-fonts";
        if (!document.getElementById(fontLinkId)) {
            const link = document.createElement("link");
            link.id = fontLinkId;
            link.rel = "stylesheet";
            link.href =
                "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap";
            document.head.appendChild(link);
        }

        const styleId = "smartcare-web-typography-fix";
        if (document.getElementById(styleId)) return undefined;

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
      body {
        font-family: 'Inter', 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }

      input, textarea, select, button {
        font-family: 'Inter', 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }

      input:focus,
      input:focus-visible,
      textarea:focus,
      textarea:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }

      input[type="password"]::-ms-reveal,
      input[type="password"]::-ms-clear {
        display: none;
      }
    `;
        document.head.appendChild(style);

        return () => {
            style.remove();
        };
    }, []);

    useEffect(() => {
        if (!accessToken) {
            void i18n.changeLanguage("vi");
            return undefined;
        }

        let isActive = true;
        api.get("/users/me")
            .then(({ data }) => {
                const language = data.preferred_language === "en" ? "en" : "vi";
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
