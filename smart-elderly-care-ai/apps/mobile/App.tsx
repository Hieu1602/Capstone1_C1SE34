// App.tsx
// Entry point React Native – Smart Elderly Care AI Mobile App

import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { StatusBar, LogBox, Platform, Alert as NativeAlert } from "react-native";
import { registerRootComponent } from "expo";
import * as ScreenOrientation from "expo-screen-orientation";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "./src/i18n/config";
import AppNavigator from "./src/navigation/AppNavigator";
import { InAppAlertModal } from "./src/components/InAppAlertModal";
import { LocalizedAlert } from "./src/i18n/LocalizedComponents";
import { fcmService } from "./src/services/fcm";
import api, { getCustomServerUrl } from "./src/services/api";
import { notificationService } from "./src/services/notificationService";
import { useAuthStore } from "./src/store/useAuthStore";
import i18n from "./src/i18n/config";

// Chuyển hướng toàn bộ Alert.alert và window.alert sang In-App Mobile Modal (không hiện pop-up trình duyệt "localhost says")
if (Platform.OS === "web") {
    NativeAlert.alert = (...args: any[]) => {
        (LocalizedAlert.alert as any)(...args);
    };
    if (typeof window !== "undefined") {
        window.alert = (msg?: any) => {
            (LocalizedAlert.alert as any)("Thông báo", String(msg ?? ""));
        };
    }
}

// Bỏ qua các cảnh báo tương thích style không nghiêm trọng trên nền tảng Web
LogBox.ignoreLogs([
    '"shadow*" style props are deprecated',
    '"textShadow*" style props are deprecated',
    "props.pointerEvents is deprecated",
]);

if (Platform.OS === "web") {
    // Ngăn chặn lỗi không đồng bộ DOM giữa React 19 và react-native-web khi unmount Portal / Modal / Style tag
    if (typeof Node !== "undefined" && Node.prototype) {
        const originalRemoveChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function <T extends Node>(child: T): T {
            try {
                return originalRemoveChild.call(this, child) as T;
            } catch (err: any) {
                if (err?.name === "NotFoundError" || String(err?.message || "").includes("not a child")) {
                    return child;
                }
                throw err;
            }
        };
    }

    const isIgnoredWebLog = (...args: unknown[]) => {
        const fullMsg = args
            .map((a) => {
                if (typeof a === "string") return a;
                if (a instanceof Error) return `${a.message} ${a.stack || ""}`;
                try {
                    return JSON.stringify(a);
                } catch {
                    return String(a);
                }
            })
            .join(" ");

        return (
            fullMsg.includes("Warning:") ||
            fullMsg.includes("style props are deprecated") ||
            fullMsg.includes("pointerEvents is deprecated") ||
            fullMsg.includes("does not recognize the") ||
            fullMsg.includes("Unknown event handler property") ||
            fullMsg.includes("Invalid DOM property") ||
            fullMsg.includes("Failed prop type") ||
            fullMsg.includes("Failed to execute 'removeChild'") ||
            fullMsg.includes("removeChild") ||
            fullMsg.includes("createRoot") ||
            fullMsg.includes("defaultProps")
        );
    };

    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
        if (isIgnoredWebLog(...args)) {
            return;
        }
        originalWarn(...args);
    };

    const originalError = console.error;
    console.error = (...args: any[]) => {
        if (isIgnoredWebLog(...args)) {
            return;
        }
        originalError(...args);
    };
}

export default function App() {
    const accessToken = useAuthStore((state: any) => state.accessToken);

    useEffect(() => {
        // Giữ giao diện dọc mặc định; trình xem camera tạm khóa ngang khi toàn màn hình.
        if (Platform.OS !== "web") {
            void ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.PORTRAIT_UP,
            ).catch(() => {});
        }
    }, []);

    useEffect(() => {
        // Khởi tạo FCM push notifications & Android Background Service khi app khởi động
        fcmService.initialize();
        notificationService.init();
        getCustomServerUrl().then((url) => {
            if (url) {
                notificationService.startBackgroundMonitor(url);
            }
        }).catch(() => {});

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

        // Tự động đồng bộ FCM push token lên máy chủ khi người dùng đăng nhập
        fcmService.syncTokenOnLogin().catch(() => {});

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
                <StatusBar barStyle="light-content"  />
                <AppNavigator />
                <InAppAlertModal />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

registerRootComponent(App);
