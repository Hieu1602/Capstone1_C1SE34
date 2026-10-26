// ============================================================================
// MÀN HÌNH CÀI ĐẶT HỆ THỐNG (SETTINGS SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Giao diện: Đồng bộ tông cam chủ đạo (Colors.primary) & hỗ trợ Sáng / Tối
// Chức năng:
//   - Quản trị hồ sơ người giám sát & Hồ sơ bệnh án người cao tuổi (Bảo mật AES-256)
//   - Cài đặt chung (Vùng, Ngôn ngữ Tiếng Việt / Tiếng Anh, Chế độ Sáng / Tối)
//   - Khả năng tiếp cận (Kích thước phông chữ tùy chỉnh & Độ tương phản hiển thị)
//   - Thông tin (Điều khoản sử dụng & Phiên bản ứng dụng)
//   - Thiết lập thông báo & Phản hồi rung khi có cảnh báo hệ thống
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, Shadows } from "../../../theme/colors";
import { useTheme } from "../../../store/useThemeStore";
import i18n from "../../../i18n/config";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import { usersApi, supportApi } from "../../../services/api";
import {
    AccessibilitySettingsModal,
    FontSizeSettingsModal,
    AboutAppModal,
    VibrationSettingsModal,
    NotificationSettingsModal,
    GeneralSettingsModal,
    LanguageSettingsModal,
    AppearanceSettingsModal,
} from "../components/settings";

const FONT_SCALE_LEVELS = [0.85, 1, 1.15, 1.3, 1.5];

export default function SettingsScreen({ navigation, route }: any) {
    const {
        isDarkMode,
        setDarkMode,
        fontSizeMode: storeFontSizeMode,
        setFontScale,
        setFontSizeMode: setStoreFontSizeMode,
    } = useTheme();

    // Modal Visibility States
    const [isNotificationSettingsVisible, setNotificationSettingsVisible] =
        useState(false);
    const [isVibrationDetailVisible, setVibrationDetailVisible] = useState(false);
    const [isAboutInfoVisible, setAboutInfoVisible] = useState(false);
    const [isGeneralSettingsVisible, setGeneralSettingsVisible] = useState(false);
    const [isLanguageVisible, setLanguageVisible] = useState(false);
    const [isAccessibilityVisible, setAccessibilityVisible] = useState(false);
    const [isFontSizeVisible, setFontSizeVisible] = useState(false);
    const [isAppearanceVisible, setAppearanceVisible] = useState(false);

    // Configuration States
    const [languageMode, setLanguageMode] = useState<"vi" | "en">(
        (i18n.language === "en" ? "en" : "vi") as "vi" | "en",
    );
    const [fontSizeMode, setFontSizeMode] = useState<"system" | "custom">(
        storeFontSizeMode || "system",
    );
    const [customFontScale, setCustomFontScale] = useState(1);
    const [highContrastEnabled, setHighContrastEnabled] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [alertSoundEnabled, setAlertSoundEnabled] = useState(true);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [criticalAlertEnabled, setCriticalAlertEnabled] = useState(true);
    const [docData, setDocData] = useState<any>(null);

    const isFromProfileRef = useRef(false);

    useEffect(() => {
        if (i18n.language === "en" || i18n.language === "vi") {
            setLanguageMode(i18n.language as "vi" | "en");
        }
        usersApi
            .getMe()
            .then((res: any) => {
                const backendLang =
                    res?.data?.preferred_language || res?.data?.language;
                if (
                    backendLang &&
                    (backendLang === "vi" || backendLang === "en")
                ) {
                    setLanguageMode(backendLang);
                    if (i18n.language !== backendLang) {
                        void i18n.changeLanguage(backendLang);
                        void AsyncStorage.setItem(
                            "smartcare-user-language",
                            backendLang,
                        );
                    }
                }
                const backendFontScale = res?.data?.custom_font_scale;
                if (
                    Number.isInteger(backendFontScale) &&
                    backendFontScale >= 0 &&
                    backendFontScale <= 4
                ) {
                    setCustomFontScale(backendFontScale);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const initialModal = route?.params?.initialModal;
        if (route?.params?.fromProfile || initialModal) {
            isFromProfileRef.current = true;
        }
        if (!initialModal) return;

        if (initialModal === "appInfo") {
            navigation?.replace?.("AppInfo");
            return;
        } else if (initialModal === "notifications") {
            setNotificationSettingsVisible(true);
        } else if (initialModal === "fontSize") {
            setFontSizeVisible(true);
        } else if (initialModal === "appearance") {
            setAppearanceVisible(true);
        }
        navigation?.setParams?.({
            initialModal: undefined,
            fromProfile: undefined,
        });
    }, [route?.params?.initialModal, route?.params?.fromProfile, navigation]);

    const closeWithProfileReturn = useCallback(
        (closeFn?: () => void) => {
            if (closeFn) closeFn();
            if (isFromProfileRef.current) {
                isFromProfileRef.current = false;
                navigation?.goBack?.();
            }
        },
        [navigation],
    );

    useEffect(() => {
        if (isAboutInfoVisible && !docData) {
            supportApi
                .getDocumentation()
                .then((res) => {
                    if (res?.data) {
                        setDocData(res.data);
                    }
                })
                .catch((err) => {
                    console.warn(
                        "[SettingsScreen] Không thể tải tài liệu hướng dẫn:",
                        err,
                    );
                });
        }
    }, [isAboutInfoVisible, docData]);

    const handleLanguageChange = async (lang: "vi" | "en") => {
        try {
            setLanguageMode(lang);
            await i18n.changeLanguage(lang);
            await AsyncStorage.setItem("smartcare-user-language", lang);
            setLanguageVisible(false);

            try {
                await usersApi.updateLanguage(lang);
            } catch {
                await usersApi.updateMe({
                    preferred_language: lang,
                    language: lang,
                });
            }
        } catch (err) {
            console.warn("[SettingsScreen] Error changing language:", err);
            setLanguageVisible(false);
        }
    };

    const saveFontPreferences = useCallback(
        async (mode: "system" | "custom", scale: number) => {
            try {
                await usersApi.updateFontPreferences(mode, scale);
            } catch (err) {
                console.warn(
                    "[SettingsScreen] Could not save font-size preferences:",
                    err,
                );
            }
        },
        [],
    );

    const applyFontScaleMode = (mode: "system" | "custom") => {
        setFontSizeMode(mode);
        setStoreFontSizeMode(mode);
        setFontScale(mode === "custom" ? FONT_SCALE_LEVELS[customFontScale] : 1);
        void saveFontPreferences(mode, customFontScale);
    };

    const handleUpdateFontScale = (scaleIndex: number) => {
        setCustomFontScale(scaleIndex);
        setFontScale(FONT_SCALE_LEVELS[scaleIndex]);
        void saveFontPreferences("custom", scaleIndex);
    };

    const handleVibrationToggle = (value: boolean) => {
        setVibrationEnabled(value);
        if (value) {
            Vibration.vibrate(80);
        } else {
            Vibration.cancel();
        }
    };

    const handleToggleNotification = async (
        key:
            | "notifications_enabled"
            | "alert_sound_enabled"
            | "critical_alert_enabled",
        value: boolean,
    ) => {
        if (key === "notifications_enabled") setNotificationsEnabled(value);
        if (key === "alert_sound_enabled") setAlertSoundEnabled(value);
        if (key === "critical_alert_enabled") setCriticalAlertEnabled(value);

        try {
            await usersApi.updateNotificationPreferences({ [key]: value });
        } catch (err) {
            console.warn(
                "[SettingsScreen] Không thể lưu cài đặt thông báo:",
                err,
            );
        }
    };

    return (
        <SafeAreaView
            style={[
                styles.settingsOverlay,
                isDarkMode && { backgroundColor: "#0B0F19" },
            ]}
            edges={["top"]}
        >
            <View
                style={[
                    styles.settingsSheet,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
            >
                <View style={styles.settingsHeaderRow}>
                    <TouchableOpacity
                        style={[
                            styles.backButton,
                            styles.settingsBackButton,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                        onPress={() => navigation?.goBack?.()}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="chevron-back-outline"
                            size={24}
                            color={isDarkMode ? "#F8FAFC" : Colors.textPrimary}
                        />
                    </TouchableOpacity>
                    <Text
                        style={[
                            styles.settingsTitle,
                            isDarkMode && { color: "#F8FAFC" },
                        ]}
                    >
                        Cài đặt
                    </Text>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                >
                    <View style={styles.settingsCard}>
                        <View style={styles.settingsList}>
                            {/* Khối 1: Hồ sơ người giám sát & Hồ sơ bệnh án người cao tuổi */}
                            <View
                                style={[
                                    styles.settingsGroupCard,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.settingsItem,
                                        isDarkMode && {
                                            borderBottomColor: "#334155",
                                        },
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        navigation.navigate("Main", {
                                            screen: "Profile",
                                            params: { openUserMenu: true },
                                        });
                                    }}
                                >
                                    <View style={styles.settingsLeft}>
                                        <View
                                            style={[
                                                styles.settingsIconWrap,
                                                {
                                                    backgroundColor: isDarkMode
                                                        ? "rgba(255, 122, 0, 0.16)"
                                                        : Colors.primaryLight,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="person-circle-outline"
                                                size={22}
                                                color={Colors.primary}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.settingsLabel,
                                                    isDarkMode
                                                        ? { color: "#F8FAFC" }
                                                        : { color: "#0F172A" },
                                                ]}
                                            >
                                                Hồ sơ người giám sát
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.settingsItemSub,
                                                    {
                                                        color: isDarkMode
                                                            ? "#94A3B8"
                                                            : "#64748B",
                                                    },
                                                ]}
                                            >
                                                Tài khoản người thân theo dõi,
                                                SĐT liên hệ khẩn cấp
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={Colors.primary}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.settingsItem,
                                        styles.settingsItemLast,
                                        isDarkMode && {
                                            borderBottomColor: "#334155",
                                        },
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                        navigation.navigate(
                                            "PatientMedicalRecord",
                                        )
                                    }
                                >
                                    <View style={styles.settingsLeft}>
                                        <View
                                            style={[
                                                styles.settingsIconWrap,
                                                {
                                                    backgroundColor: isDarkMode
                                                        ? "#082F49"
                                                        : "#E0F2FE",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="medkit-outline"
                                                size={21}
                                                color="#0284C7"
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    flexWrap: "wrap",
                                                    gap: 6,
                                                }}
                                            >
                                                <Text
                                                    style={[
                                                        styles.settingsLabel,
                                                        isDarkMode
                                                            ? {
                                                                  color: "#F8FAFC",
                                                              }
                                                            : {
                                                                  color: "#0F172A",
                                                              },
                                                    ]}
                                                >
                                                    Hồ sơ bệnh án người cao tuổi
                                                </Text>
                                                <View
                                                    style={[
                                                        styles.profileAesBadge,
                                                        isDarkMode && {
                                                            backgroundColor:
                                                                "rgba(255, 122, 0, 0.16)",
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.profileAesBadgeText,
                                                            isDarkMode && {
                                                                color: Colors.primary,
                                                            },
                                                        ]}
                                                    >
                                                        Bảo mật AES-256
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text
                                                style={[
                                                    styles.settingsItemSub,
                                                    {
                                                        color: isDarkMode
                                                            ? "#94A3B8"
                                                            : "#64748B",
                                                    },
                                                ]}
                                            >
                                                Thông tin cụ, bệnh nền, nhóm máu
                                                & đơn thuốc
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={Colors.primary}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Khối 2: Nhóm 3 mục */}
                            <View
                                style={[
                                    styles.settingsGroupCard,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.settingsItem,
                                        isDarkMode && {
                                            borderBottomColor: "#334155",
                                        },
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                        setGeneralSettingsVisible(true)
                                    }
                                >
                                    <View style={styles.settingsLeft}>
                                        <View
                                            style={[
                                                styles.settingsIconWrap,
                                                {
                                                    backgroundColor: isDarkMode
                                                        ? "rgba(255, 122, 0, 0.16)"
                                                        : Colors.primaryLight,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="settings-outline"
                                                size={21}
                                                color={Colors.primary}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.settingsLabel,
                                                    isDarkMode
                                                        ? { color: "#F8FAFC" }
                                                        : { color: "#0F172A" },
                                                ]}
                                            >
                                                Cài đặt chung
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.settingsItemSub,
                                                    {
                                                        color: isDarkMode
                                                            ? "#94A3B8"
                                                            : "#64748B",
                                                    },
                                                ]}
                                            >
                                                Vùng, ngôn ngữ giao diện & chế
                                                độ Sáng / Tối
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={Colors.primary}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.settingsItem,
                                        isDarkMode && {
                                            borderBottomColor: "#334155",
                                        },
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                        setAccessibilityVisible(true)
                                    }
                                >
                                    <View style={styles.settingsLeft}>
                                        <View
                                            style={[
                                                styles.settingsIconWrap,
                                                {
                                                    backgroundColor: isDarkMode
                                                        ? "#064E3B"
                                                        : "#ECFDF5",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="accessibility-outline"
                                                size={21}
                                                color="#10B981"
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.settingsLabel,
                                                    isDarkMode
                                                        ? { color: "#F8FAFC" }
                                                        : { color: "#0F172A" },
                                                ]}
                                            >
                                                Khả năng tiếp cận
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.settingsItemSub,
                                                    {
                                                        color: isDarkMode
                                                            ? "#94A3B8"
                                                            : "#64748B",
                                                    },
                                                ]}
                                            >
                                                Kích thước phông chữ & độ
                                                tương phản hiển thị
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={Colors.primary}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.settingsItem,
                                        styles.settingsItemLast,
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() => setAboutInfoVisible(true)}
                                >
                                    <View style={styles.settingsLeft}>
                                        <View
                                            style={[
                                                styles.settingsIconWrap,
                                                {
                                                    backgroundColor: isDarkMode
                                                        ? "#1E1B4B"
                                                        : "#EEF2FF",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="information-circle-outline"
                                                size={21}
                                                color="#6366F1"
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.settingsLabel,
                                                    isDarkMode
                                                        ? { color: "#F8FAFC" }
                                                        : { color: "#0F172A" },
                                                ]}
                                            >
                                                Thông tin
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.settingsItemSub,
                                                    {
                                                        color: isDarkMode
                                                            ? "#94A3B8"
                                                            : "#64748B",
                                                    },
                                                ]}
                                            >
                                                Điều khoản sử dụng & phiên bản
                                                ứng dụng
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={Colors.primary}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Khối 3: Nhóm 2 mục */}
                            <View
                                style={[
                                    styles.settingsGroupCard,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.settingsItem,
                                        isDarkMode && {
                                            borderBottomColor: "#334155",
                                        },
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                        setNotificationSettingsVisible(true)
                                    }
                                >
                                    <View style={styles.settingsLeft}>
                                        <View
                                            style={[
                                                styles.settingsIconWrap,
                                                {
                                                    backgroundColor: isDarkMode
                                                        ? "#451A03"
                                                        : "#FEF3C7",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="notifications-outline"
                                                size={21}
                                                color="#F59E0B"
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.settingsLabel,
                                                    isDarkMode
                                                        ? { color: "#F8FAFC" }
                                                        : { color: "#0F172A" },
                                                ]}
                                            >
                                                Thiết lập thông báo
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.settingsItemSub,
                                                    {
                                                        color: isDarkMode
                                                            ? "#94A3B8"
                                                            : "#64748B",
                                                    },
                                                ]}
                                            >
                                                Cảnh báo sức khỏe, âm thanh &
                                                trường hợp khẩn cấp
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.settingsRightStatus}>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={18}
                                            color={Colors.primary}
                                        />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.settingsItem,
                                        styles.settingsItemLast,
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                        setVibrationDetailVisible(true)
                                    }
                                >
                                    <View style={styles.settingsLeft}>
                                        <View
                                            style={[
                                                styles.settingsIconWrap,
                                                {
                                                    backgroundColor: isDarkMode
                                                        ? "rgba(255, 122, 0, 0.16)"
                                                        : Colors.primaryLight,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="phone-portrait-outline"
                                                size={21}
                                                color={Colors.primary}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.settingsLabel,
                                                    isDarkMode
                                                        ? { color: "#F8FAFC" }
                                                        : { color: "#0F172A" },
                                                ]}
                                            >
                                                Rung
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.settingsItemSub,
                                                    {
                                                        color: isDarkMode
                                                            ? "#94A3B8"
                                                            : "#64748B",
                                                    },
                                                ]}
                                            >
                                                Phản hồi rung khi có cảnh báo hệ
                                                thống
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.settingsRightStatus}>
                                        <View
                                            style={[
                                                styles.settingsStatusPill,
                                                vibrationEnabled
                                                    ? isDarkMode
                                                        ? {
                                                              backgroundColor:
                                                                  "rgba(255, 122, 0, 0.18)",
                                                          }
                                                        : {
                                                              backgroundColor:
                                                                  Colors.primaryLight,
                                                          }
                                                    : isDarkMode
                                                      ? {
                                                            backgroundColor:
                                                                "#0F172A",
                                                        }
                                                      : {
                                                            backgroundColor:
                                                                "#F1F5F9",
                                                        },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.settingsValueText,
                                                    vibrationEnabled
                                                        ? {
                                                              color: Colors.primary,
                                                              fontWeight: "700",
                                                          }
                                                        : isDarkMode
                                                          ? {
                                                                color: "#94A3B8",
                                                            }
                                                          : {
                                                                color: "#64748B",
                                                            },
                                                ]}
                                            >
                                                {vibrationEnabled ? "Mở" : "Tắt"}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={18}
                                            color={Colors.primary}
                                        />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>

            {/* MODALS */}
            <AccessibilitySettingsModal
                visible={isAccessibilityVisible}
                isDarkMode={isDarkMode}
                fontSizeMode={fontSizeMode}
                highContrastEnabled={highContrastEnabled}
                onToggleHighContrast={setHighContrastEnabled}
                onOpenFontSize={() => setFontSizeVisible(true)}
                onClose={() => setAccessibilityVisible(false)}
            />

            <FontSizeSettingsModal
                visible={isFontSizeVisible}
                isDarkMode={isDarkMode}
                fontSizeMode={fontSizeMode}
                customFontScale={customFontScale}
                onApplyMode={applyFontScaleMode}
                onUpdateScale={handleUpdateFontScale}
                onClose={() =>
                    closeWithProfileReturn(() => setFontSizeVisible(false))
                }
            />

            <AboutAppModal
                visible={isAboutInfoVisible}
                isDarkMode={isDarkMode}
                docData={docData}
                onClose={() =>
                    closeWithProfileReturn(() => setAboutInfoVisible(false))
                }
            />

            <VibrationSettingsModal
                visible={isVibrationDetailVisible}
                isDarkMode={isDarkMode}
                vibrationEnabled={vibrationEnabled}
                onToggleVibration={handleVibrationToggle}
                onClose={() => setVibrationDetailVisible(false)}
            />

            <NotificationSettingsModal
                visible={isNotificationSettingsVisible}
                isDarkMode={isDarkMode}
                notificationsEnabled={notificationsEnabled}
                alertSoundEnabled={alertSoundEnabled}
                criticalAlertEnabled={criticalAlertEnabled}
                onToggleNotifications={(val) =>
                    handleToggleNotification("notifications_enabled", val)
                }
                onToggleAlertSound={(val) =>
                    handleToggleNotification("alert_sound_enabled", val)
                }
                onToggleCriticalAlert={(val) =>
                    handleToggleNotification("critical_alert_enabled", val)
                }
                onClose={() =>
                    closeWithProfileReturn(() =>
                        setNotificationSettingsVisible(false),
                    )
                }
            />

            <GeneralSettingsModal
                visible={isGeneralSettingsVisible}
                isDarkMode={isDarkMode}
                languageMode={languageMode}
                appearanceMode={isDarkMode ? "dark" : "light"}
                onOpenLanguage={() => setLanguageVisible(true)}
                onOpenAppearance={() => setAppearanceVisible(true)}
                onClose={() => setGeneralSettingsVisible(false)}
            />

            <LanguageSettingsModal
                visible={isLanguageVisible}
                isDarkMode={isDarkMode}
                languageMode={languageMode}
                onSelectLanguage={handleLanguageChange}
                onClose={() => setLanguageVisible(false)}
            />

            <AppearanceSettingsModal
                visible={isAppearanceVisible}
                isDarkMode={isDarkMode}
                appearanceMode={isDarkMode ? "dark" : "light"}
                onSelectMode={(mode) => setDarkMode(mode === "dark")}
                onClose={() =>
                    closeWithProfileReturn(() => setAppearanceVisible(false))
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    settingsOverlay: {
        flex: 1,
        backgroundColor: "#F3F4F6",
        justifyContent: "flex-start",
    },
    settingsSheet: {
        flex: 1,
        width: "100%",
        backgroundColor: "#F3F4F6",
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 20,
    },
    settingsHeaderRow: {
        position: "relative",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
        marginBottom: 10,
        paddingTop: 6,
        paddingBottom: 6,
        minHeight: 44,
    },
    settingsTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        position: "absolute",
        left: 0,
        right: 0,
        textAlign: "center",
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
        ...Shadows.soft,
    },
    settingsBackButton: {
        position: "absolute",
        left: 0,
        top: 0,
    },
    settingsCard: {
        backgroundColor: "transparent",
        marginTop: 0,
    },
    settingsList: {
        gap: 14,
        paddingBottom: 8,
    },
    settingsGroupCard: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 18,
        backgroundColor: Colors.surface,
        overflow: "hidden",
        ...Shadows.card,
    },
    settingsItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 68,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: "transparent",
    },
    settingsItemLast: {
        borderBottomWidth: 0,
    },
    settingsLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        paddingRight: 8,
    },
    settingsIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.primaryLight,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    settingsLabel: {
        fontSize: 15.5,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    settingsItemSub: {
        fontSize: 11,
        marginTop: 2,
        lineHeight: 15,
    },
    profileAesBadge: {
        backgroundColor: "#E0F2FE",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    profileAesBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#0284C7",
    },
    settingsRightStatus: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        minWidth: 32,
    },
    settingsStatusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    settingsValueText: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "600",
    },
});
