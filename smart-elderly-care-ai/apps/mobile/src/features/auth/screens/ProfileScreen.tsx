// ProfileScreen.tsx
// Màn hình Cá nhân / Quản trị hệ thống (Phong cách Elderly Care AI)

import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../theme/colors";
import { useAuthStore } from "../../../store/useAuthStore";
import { useVitalStore } from "../../../store/useVitalStore";
import { useTheme } from "../../../store/useThemeStore";
import {
    LocalizedAlert as Alert,
    LocalizedText as Text,
} from "../../../i18n/LocalizedComponents";
import api, { usersApi, BASE_URL } from "../../../services/api";
import {
    launchEmergencyCall,
    launchSupportCall,
    SUPPORT_HOTLINE_NUMBER,
} from "../../../services/emergency";
import {
    LogoutConfirmModal,
    CustomerSupportModal,
    AvatarPickerModal,
    ChangePasswordModal,
    ProfileInfoModal,
    SecurityCenterModal,
    FontSizeSettingsModal,
    NotificationSettingsModal,
    AppearanceSettingsModal,
} from "../components";

const resolveAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("data:") ||
        url.startsWith("file:") ||
        url.startsWith("blob:")
    ) {
        return url;
    }
    const hostOrigin = BASE_URL.replace(/\/api\/v1\/?$/, "");
    return `${hostOrigin}${url.startsWith("/") ? "" : "/"}${url}`;
};

const FONT_SCALE_LEVELS = [0.85, 1, 1.15, 1.3, 1.5];

export default function ProfileScreen({ navigation, route }: any) {
    const {
        userId,
        userName,
        full_name,
        userPhone,
        phone_number,
        avatarUrl,
        avatar_url,
        setAvatar,
        logout,
        updateUserName,
        toggleViewRole,
        setProfile,
    } = useAuthStore();
    const { house } = useVitalStore();
    const {
        isDarkMode,
        colors,
        setDarkMode,
        setFontScale,
        fontSizeMode: storeFontSizeMode,
        setFontSizeMode: setStoreFontSizeMode,
    } = useTheme();

    const [profileName, setProfileName] = useState(
        full_name || userName || "",
    );
    const [profilePhone, setProfilePhone] = useState(
        phone_number || userPhone || "",
    );
    const [showMoreGrid, setShowMoreGrid] = useState(false);
    const [isHelpExpanded, setIsHelpExpanded] = useState(false);
    const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

    // Modal Visibility States
    const [isUserMenuVisible, setUserMenuVisible] = useState(false);
    const [isAvatarPickerVisible, setAvatarPickerVisible] = useState(false);
    const [isLogoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
    const [isChangePasswordVisible, setChangePasswordVisible] = useState(false);
    const [isCustomerSupportVisible, setCustomerSupportVisible] = useState(false);
    const [isSecurityCenterVisible, setSecurityCenterVisible] = useState(false);
    const [isFontSizeVisible, setFontSizeVisible] = useState(false);
    const [isNotificationSettingsVisible, setNotificationSettingsVisible] =
        useState(false);
    const [isAppearanceVisible, setAppearanceVisible] = useState(false);

    // Settings States
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [alertSoundEnabled, setAlertSoundEnabled] = useState(true);
    const [criticalAlertEnabled, setCriticalAlertEnabled] = useState(true);
    const [fontSizeMode, setFontSizeMode] = useState<"system" | "custom">(
        storeFontSizeMode || "system",
    );
    const [customFontScale, setCustomFontScale] = useState(1);
    const [avatarUri, setAvatarUri] = useState<string | null>(() => {
        const raw = avatarUrl || avatar_url;
        if (raw && !raw.startsWith("blob:")) {
            return resolveAvatarUrl(raw);
        }
        return null;
    });

    useEffect(() => {
        if (full_name || userName) {
            setProfileName(full_name || userName || "");
        }
        if (phone_number || userPhone) {
            setProfilePhone(phone_number || userPhone || "");
        }
    }, [userName, full_name, userPhone, phone_number]);

    useEffect(() => {
        const raw = avatarUrl || avatar_url;
        if (raw && !raw.startsWith("blob:")) {
            setAvatarUri(resolveAvatarUrl(raw));
        }
    }, [avatarUrl, avatar_url]);

    useEffect(() => {
        if (route?.params?.openUserMenu) {
            setUserMenuVisible(true);
            navigation?.setParams?.({ openUserMenu: undefined });
        }
    }, [route?.params?.openUserMenu, navigation]);

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const res = await api.get("/users/me");
                if (res.data) {
                    if (
                        typeof res.data.full_name === "string" &&
                        res.data.full_name.trim()
                    ) {
                        setProfileName(res.data.full_name);
                    }
                    const phone = res.data.phone_number || res.data.phone;
                    if (typeof phone === "string") {
                        setProfilePhone(phone);
                    }
                    if (res.data.avatar_url) {
                        const resolved = resolveAvatarUrl(res.data.avatar_url);
                        if (resolved) {
                            setAvatarUri(resolved);
                            setAvatar(resolved);
                        }
                    }
                    if (
                        typeof res.data.notifications_enabled === "boolean"
                    ) {
                        setNotificationsEnabled(
                            res.data.notifications_enabled,
                        );
                    }
                    if (typeof res.data.alert_sound_enabled === "boolean") {
                        setAlertSoundEnabled(res.data.alert_sound_enabled);
                    }
                    if (
                        typeof res.data.critical_alert_enabled === "boolean"
                    ) {
                        setCriticalAlertEnabled(
                            res.data.critical_alert_enabled,
                        );
                    }
                    if (
                        Number.isInteger(res.data.custom_font_scale) &&
                        res.data.custom_font_scale >= 0 &&
                        res.data.custom_font_scale <= 4
                    ) {
                        setCustomFontScale(res.data.custom_font_scale);
                    }
                    setProfile({
                        user_id: res.data.user_id || res.data.id,
                        full_name: res.data.full_name,
                        phone_number: phone,
                        role: res.data.role,
                        household_id: res.data.household_id,
                        avatar_url: res.data.avatar_url,
                    });
                }
            } catch (error) {
                console.warn(
                    "[Profile] Không thể tải hồ sơ từ database:",
                    error,
                );
            }
        };
        void fetchUserProfile();
    }, [setProfile, setAvatar]);

    const performLogout = async () => {
        setLogoutConfirmVisible(false);
        setUserMenuVisible(false);
        logout();
        await useAuthStore.persist.clearStorage();

        if (Platform.OS !== "web") {
            navigation.getParent()?.reset({
                index: 0,
                routes: [{ name: "Login" }],
            });
        }
    };

    const handleSaveName = async (newName: string): Promise<boolean> => {
        try {
            const res = await usersApi.updateMe({ full_name: newName });
            const savedName =
                typeof res?.data?.full_name === "string" &&
                res.data.full_name.trim()
                    ? res.data.full_name.trim()
                    : newName;
            const resolvedId = String(
                res?.data?.id || res?.data?.user_id || userId || "demo-user-001",
            );

            setProfileName(savedName);
            updateUserName(resolvedId, savedName);
            setProfile({
                user_id:
                    res?.data?.id || res?.data?.user_id || userId || undefined,
                full_name: savedName,
            });
            return true;
        } catch (error: any) {
            const detail =
                error?.response?.data?.detail ||
                error?.response?.data?.message ||
                "Không thể lưu tên vào cơ sở dữ liệu. Vui lòng thử lại.";
            throw new Error(
                typeof detail === "string"
                    ? detail
                    : "Không thể lưu tên vào cơ sở dữ liệu.",
            );
        }
    };

    const handleChangePassword = async (
        currPass: string,
        newPass: string,
        confPass: string,
    ): Promise<boolean> => {
        await usersApi.changePassword({
            current_password: currPass,
            new_password: newPass,
            confirm_new_password: confPass,
        });
        return true;
    };

    const convertAssetToDataUri = async (
        asset: ImagePicker.ImagePickerAsset,
    ): Promise<string> => {
        if (asset.base64) {
            return asset.base64.startsWith("data:")
                ? asset.base64
                : `data:image/jpeg;base64,${asset.base64}`;
        }
        try {
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            return await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === "string") {
                        resolve(reader.result);
                    } else {
                        resolve(asset.uri);
                    }
                };
                reader.onerror = () => resolve(asset.uri);
                reader.readAsDataURL(blob);
            });
        } catch {
            return asset.uri;
        }
    };

    const handleSaveAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
        try {
            const dataUri = await convertAssetToDataUri(asset);
            setAvatarUri(dataUri);
            setAvatar(dataUri);

            let uploadRes;
            try {
                uploadRes = await usersApi.uploadAvatarBase64(dataUri);
            } catch (uploadErr) {
                console.warn(
                    "[ProfileScreen] uploadAvatarBase64 error, attempting updateMe fallback:",
                    uploadErr,
                );
                try {
                    uploadRes = await usersApi.updateMe({
                        avatar_url: dataUri,
                    });
                } catch (updateErr) {
                    console.warn(
                        "[ProfileScreen] updateMe fallback failed:",
                        updateErr,
                    );
                }
            }

            const returnedAvatarUrl = uploadRes?.data?.avatar_url;
            if (returnedAvatarUrl) {
                const resolvedServerUrl = resolveAvatarUrl(returnedAvatarUrl);
                if (resolvedServerUrl) {
                    setAvatarUri(resolvedServerUrl);
                    setAvatar(resolvedServerUrl);
                }
                setProfile({ avatar_url: returnedAvatarUrl });
            } else {
                setProfile({ avatar_url: dataUri });
            }
        } catch (error) {
            console.warn("[ProfileScreen] Không thể lưu avatar:", error);
        }
    };

    const pickAvatarFromCamera = async () => {
        setAvatarPickerVisible(false);
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(
                "Quyền bị từ chối",
                "Bạn cần cho phép truy cập máy ảnh để chụp ảnh.",
            );
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets?.[0]) {
            void handleSaveAvatar(result.assets[0]);
        }
    };

    const pickAvatarFromLibrary = async () => {
        setAvatarPickerVisible(false);
        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(
                "Quyền bị từ chối",
                "Bạn cần cho phép truy cập thư viện ảnh để chọn ảnh.",
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets?.[0]) {
            void handleSaveAvatar(result.assets[0]);
        }
    };

    const saveFontPreferences = useCallback(
        async (mode: "system" | "custom", scale: number) => {
            try {
                await usersApi.updateFontPreferences(mode, scale);
            } catch (err) {
                console.warn(
                    "[ProfileScreen] Could not save font-size preferences:",
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
                "[ProfileScreen] Không thể lưu cài đặt thông báo:",
                err,
            );
        }
    };

    const callEmergencyService = async () => {
        try {
            await launchEmergencyCall();
        } catch (error) {
            console.warn(
                "[ProfileScreen] Could not open emergency dialer:",
                error,
            );
            Alert.alert(
                "Không thể mở cuộc gọi",
                "Vui lòng gọi cấp cứu 115 trực tiếp.",
            );
        }
    };

    const callCustomerSupportService = async () => {
        try {
            await launchSupportCall("Hỗ trợ kết nối camera, vòng tay, hub AI");
        } catch (error) {
            console.warn(
                "[ProfileScreen] Could not open customer support dialer:",
                error,
            );
            Alert.alert(
                "Không thể mở cuộc gọi",
                `Vui lòng gọi tổng đài hỗ trợ ${SUPPORT_HOTLINE_NUMBER} trực tiếp.`,
            );
        }
    };

    const resolvedDisplayName =
        profileName || full_name || userName || "Người giám sát";

    return (
        <SafeAreaView
            style={[
                styles.safeArea,
                isDarkMode && { backgroundColor: colors.background },
            ]}
            edges={["top"]}
        >
            {/* Modal Xác nhận Đăng xuất */}
            <LogoutConfirmModal
                visible={isLogoutConfirmVisible}
                isDarkMode={isDarkMode}
                onClose={() => setLogoutConfirmVisible(false)}
                onConfirm={performLogout}
            />

            {/* Modal Thông tin người giám sát */}
            <ProfileInfoModal
                visible={isUserMenuVisible}
                isDarkMode={isDarkMode}
                displayName={resolvedDisplayName}
                phone={profilePhone}
                avatarUri={avatarUri}
                onClose={() => setUserMenuVisible(false)}
                onAvatarPress={() => setAvatarPickerVisible(true)}
                onChangePasswordPress={() => {
                    setUserMenuVisible(false);
                    setChangePasswordVisible(true);
                }}
                onLogoutPress={() => setLogoutConfirmVisible(true)}
                onSaveName={handleSaveName}
            />

            {/* Modal Chọn ảnh đại diện */}
            <AvatarPickerModal
                visible={isAvatarPickerVisible}
                isDarkMode={isDarkMode}
                onClose={() => setAvatarPickerVisible(false)}
                onPickFromCamera={pickAvatarFromCamera}
                onPickFromLibrary={pickAvatarFromLibrary}
            />

            {/* Modal CSKH Hotline 24/7 */}
            <CustomerSupportModal
                visible={isCustomerSupportVisible}
                isDarkMode={isDarkMode}
                hotlineNumber={SUPPORT_HOTLINE_NUMBER}
                onClose={() => setCustomerSupportVisible(false)}
                onCall={callCustomerSupportService}
            />

            {/* Modal Đổi mật khẩu */}
            <ChangePasswordModal
                visible={isChangePasswordVisible}
                isDarkMode={isDarkMode}
                onClose={() => setChangePasswordVisible(false)}
                onSubmit={handleChangePassword}
            />

            {/* Modal Trung tâm bảo mật */}
            <SecurityCenterModal
                visible={isSecurityCenterVisible}
                isDarkMode={isDarkMode}
                onClose={() => setSecurityCenterVisible(false)}
                onChangePasswordPress={() => {
                    setSecurityCenterVisible(false);
                    setChangePasswordVisible(true);
                }}
            />

            {/* Modal Kích thước phông chữ */}
            <FontSizeSettingsModal
                visible={isFontSizeVisible}
                isDarkMode={isDarkMode}
                fontSizeMode={fontSizeMode}
                customFontScale={customFontScale}
                onApplyMode={applyFontScaleMode}
                onUpdateScale={handleUpdateFontScale}
                onClose={() => setFontSizeVisible(false)}
            />

            {/* Modal Thiết lập thông báo */}
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
                onClose={() => setNotificationSettingsVisible(false)}
            />

            {/* Modal Vẻ bề ngoài / Chế độ tối */}
            <AppearanceSettingsModal
                visible={isAppearanceVisible}
                isDarkMode={isDarkMode}
                appearanceMode={isDarkMode ? "dark" : "light"}
                onSelectMode={(mode) => setDarkMode(mode === "dark")}
                onClose={() => setAppearanceVisible(false)}
            />

            {/* MÀN HÌNH CHÍNH PROFILE / MENU */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    isDarkMode && { backgroundColor: colors.background },
                ]}
            >
                {/* HEADER: TITLE "Menu" & CÀI ĐẶT NHANH */}
                <View style={styles.fbHeaderRow}>
                    <Text
                        style={[
                            styles.fbHeaderTitle,
                            isDarkMode && { color: colors.textPrimary },
                        ]}
                    >
                        Menu
                    </Text>
                    <View style={styles.fbHeaderActionIcons}>
                        <TouchableOpacity
                            style={[
                                styles.fbHeaderCircleBtn,
                                isDarkMode && { backgroundColor: colors.card },
                            ]}
                            onPress={() => navigation.navigate("Settings")}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="search"
                                size={20}
                                color={
                                    isDarkMode ? colors.textPrimary : "#1E293B"
                                }
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.fbHeaderCircleBtn,
                                isDarkMode && { backgroundColor: colors.card },
                            ]}
                            onPress={() => navigation.navigate("Settings")}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="settings-sharp"
                                size={20}
                                color={
                                    isDarkMode ? colors.textPrimary : "#1E293B"
                                }
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* THẺ THÔNG TIN TÀI KHOẢN NGƯỜI GIÁM SÁT */}
                <View
                    style={[
                        styles.fbProfileCard,
                        isDarkMode && {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.fbProfileInfoRow}
                        activeOpacity={0.8}
                        onPress={() => setUserMenuVisible(true)}
                    >
                        <View style={styles.fbAvatarCircle}>
                            {avatarUri ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    style={styles.fbAvatarImg}
                                />
                            ) : (
                                <Ionicons
                                    name="person"
                                    size={26}
                                    color="#FFFFFF"
                                />
                            )}
                        </View>
                        <View
                            style={{
                                flex: 1,
                                marginLeft: 12,
                                justifyContent: "center",
                            }}
                        >
                            <Text
                                style={[
                                    styles.fbProfileName,
                                    isDarkMode && {
                                        color: colors.textPrimary,
                                    },
                                ]}
                            >
                                {resolvedDisplayName}
                            </Text>
                        </View>
                        <View style={styles.fbProfileRightBadge}>
                            <Ionicons
                                name="chevron-forward"
                                size={20}
                                color="#64748B"
                            />
                        </View>
                    </TouchableOpacity>

                    <View
                        style={[
                            styles.fbCardDivider,
                            isDarkMode && { backgroundColor: colors.border },
                        ]}
                    />

                    <TouchableOpacity
                        style={styles.fbSubActionRow}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate("HouseDetail")}
                    >
                        <View style={styles.fbPlusCircleBtn}>
                            <Ionicons name="add" size={20} color="#FFFFFF" />
                        </View>
                        <Text
                            style={[
                                styles.fbSubActionText,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Thêm thành viên gia đình & Cụ cần chăm sóc
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* LƯỚI TÍNH NĂNG CHÍNH CỦA HỆ THỐNG */}
                <View style={styles.fbGridContainer}>
                    {/* Ô 1: Hồ sơ giám sát */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setUserMenuVisible(true)}
                    >
                        <View
                            style={[
                                styles.fbGridIconBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? "#1E1B4B"
                                        : "#EEF2FF",
                                },
                            ]}
                        >
                            <Ionicons
                                name="person-circle-outline"
                                size={24}
                                color="#6366F1"
                            />
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Hồ sơ giám sát
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Tài khoản người thân & SĐT khẩn cấp
                        </Text>
                    </TouchableOpacity>

                    {/* Ô 2: Hồ sơ bệnh án người cao tuổi */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                            navigation.navigate("PatientMedicalRecord")
                        }
                    >
                        <View style={styles.fbGridCardTopRow}>
                            <View
                                style={[
                                    styles.fbGridIconBox,
                                    {
                                        backgroundColor: isDarkMode
                                            ? "#082F49"
                                            : "#E0F2FE",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="medkit-outline"
                                    size={24}
                                    color="#0EA5E9"
                                />
                            </View>
                            <View style={styles.fbAesBadge}>
                                <Text style={styles.fbAesBadgeText}>
                                    AES-256
                                </Text>
                            </View>
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Hồ sơ bệnh án
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Bệnh nền, nhóm máu & đơn thuốc
                        </Text>
                    </TouchableOpacity>

                    {/* Ô 3: Nhà của tôi */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("HouseDetail")}
                    >
                        <View
                            style={[
                                styles.fbGridIconBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? "#064E3B"
                                        : "#ECFDF5",
                                },
                            ]}
                        >
                            <Ionicons
                                name="home-outline"
                                size={24}
                                color="#10B981"
                            />
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            {house.name || "Nhà của tôi"}
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Thành viên: {house.membersCount || 1} • Quản lý
                            phòng
                        </Text>
                    </TouchableOpacity>

                    {/* Ô 4: Thiết bị kết nối */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("Devices")}
                    >
                        <View
                            style={[
                                styles.fbGridIconBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? "#451A03"
                                        : "#FFF7ED",
                                },
                            ]}
                        >
                            <Ionicons
                                name="hardware-chip-outline"
                                size={24}
                                color="#FF7A00"
                            />
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Thiết bị kết nối
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Camera AI, Vòng BLE & Cảm biến
                        </Text>
                    </TouchableOpacity>

                    {/* Ô 5: Cấu hình AI & Ngưỡng cảnh báo */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("AlgoConfig")}
                    >
                        <View
                            style={[
                                styles.fbGridIconBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? "#3B1D54"
                                        : "#F5F3FF",
                                },
                            ]}
                        >
                            <Ionicons
                                name="color-wand-outline"
                                size={24}
                                color="#8B5CF6"
                            />
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Cấu hình AI
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Độ nhạy té ngã, ngưỡng nhịp tim & SpO2
                        </Text>
                    </TouchableOpacity>

                    {/* Ô 6: Báo cáo sức khỏe */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("MedicalReport")}
                    >
                        <View
                            style={[
                                styles.fbGridIconBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? "#1E293B"
                                        : "#EFF6FF",
                                },
                            ]}
                        >
                            <Ionicons
                                name="document-text-outline"
                                size={24}
                                color="#2563EB"
                            />
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Báo cáo sức khỏe
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Xuất file PDF & Excel gửi bác sĩ
                        </Text>
                    </TouchableOpacity>

                    {/* Ô 7: Lịch nhắc thuốc */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                            navigation.navigate("MedicationReminder")
                        }
                    >
                        <View
                            style={[
                                styles.fbGridIconBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? "#451A03"
                                        : "#FEF3C7",
                                },
                            ]}
                        >
                            <Ionicons
                                name="calendar-outline"
                                size={24}
                                color="#D97706"
                            />
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Lịch nhắc thuốc
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Đơn thuốc & Lịch tái khám bác sĩ
                        </Text>
                    </TouchableOpacity>

                    {/* Ô 8: Nhật ký cảnh báo */}
                    <TouchableOpacity
                        style={[
                            styles.fbGridCard,
                            isDarkMode && {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("Alerts")}
                    >
                        <View
                            style={[
                                styles.fbGridIconBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? "#450A0A"
                                        : "#FEE2E2",
                                },
                            ]}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={24}
                                color="#EF4444"
                            />
                        </View>
                        <Text
                            style={[
                                styles.fbGridCardTitle,
                                isDarkMode && { color: colors.textPrimary },
                            ]}
                        >
                            Nhật ký cảnh báo
                        </Text>
                        <Text
                            style={[
                                styles.fbGridCardSub,
                                isDarkMode && { color: colors.textSecondary },
                            ]}
                        >
                            Sự kiện té ngã & Sinh hiệu bất thường
                        </Text>
                    </TouchableOpacity>

                    {/* HIỂN THỊ THÊM */}
                    {showMoreGrid && (
                        <>
                            {/* Ô 9: Trợ lý Bác sĩ AI */}
                            <TouchableOpacity
                                style={[
                                    styles.fbGridCard,
                                    isDarkMode && {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                    },
                                ]}
                                activeOpacity={0.8}
                                onPress={() =>
                                    navigation.navigate("AIAssistant")
                                }
                            >
                                <View
                                    style={[
                                        styles.fbGridIconBox,
                                        {
                                            backgroundColor: isDarkMode
                                                ? "#164E63"
                                                : "#ECFEFF",
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="chatbubble-ellipses-outline"
                                        size={24}
                                        color="#06B6D4"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.fbGridCardTitle,
                                        isDarkMode && {
                                            color: colors.textPrimary,
                                        },
                                    ]}
                                >
                                    Trợ lý Bác sĩ AI
                                </Text>
                                <Text
                                    style={[
                                        styles.fbGridCardSub,
                                        isDarkMode && {
                                            color: colors.textSecondary,
                                        },
                                    ]}
                                >
                                    Tư vấn dinh dưỡng & Vận động 24/7
                                </Text>
                            </TouchableOpacity>

                            {/* Ô 10: Multi-View Camera */}
                            <TouchableOpacity
                                style={[
                                    styles.fbGridCard,
                                    isDarkMode && {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                    },
                                ]}
                                activeOpacity={0.8}
                                onPress={() =>
                                    navigation.navigate("MultiView")
                                }
                            >
                                <View
                                    style={[
                                        styles.fbGridIconBox,
                                        {
                                            backgroundColor: isDarkMode
                                                ? "#2E1065"
                                                : "#F3E8FF",
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="grid-outline"
                                        size={24}
                                        color="#7C3AED"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.fbGridCardTitle,
                                        isDarkMode && {
                                            color: colors.textPrimary,
                                        },
                                    ]}
                                >
                                    Multi-View Camera
                                </Text>
                                <Text
                                    style={[
                                        styles.fbGridCardSub,
                                        isDarkMode && {
                                            color: colors.textSecondary,
                                        },
                                    ]}
                                >
                                    Xem nhiều góc quay camera cùng lúc
                                </Text>
                            </TouchableOpacity>

                            {/* Ô 11: Chuyển vai trò Bác sĩ */}
                            <TouchableOpacity
                                style={[
                                    styles.fbGridCard,
                                    isDarkMode && {
                                        backgroundColor: colors.card,
                                        borderColor: "#0284C7",
                                    },
                                ]}
                                activeOpacity={0.8}
                                onPress={() => {
                                    Alert.alert(
                                        "Chuyển sang Chế độ Bác sĩ",
                                        "Bạn muốn chuyển sang giao diện chuyên môn của Bác sĩ gia đình (Danh sách bệnh nhân, Kê đơn thuốc, Báo cáo y tế)?",
                                        [
                                            {
                                                text: "Hủy",
                                                style: "cancel",
                                            },
                                            {
                                                text: "Chuyển ngay",
                                                onPress: () => toggleViewRole(),
                                            },
                                        ],
                                    );
                                }}
                            >
                                <View
                                    style={[
                                        styles.fbGridIconBox,
                                        {
                                            backgroundColor: isDarkMode
                                                ? "#082F49"
                                                : "#E0F2FE",
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="medical-outline"
                                        size={24}
                                        color="#0284C7"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.fbGridCardTitle,
                                        isDarkMode && {
                                            color: colors.textPrimary,
                                        },
                                    ]}
                                >
                                    Chế độ Bác sĩ
                                </Text>
                                <Text
                                    style={[
                                        styles.fbGridCardSub,
                                        isDarkMode && {
                                            color: colors.textSecondary,
                                        },
                                    ]}
                                >
                                    Bệnh án, Kê đơn & Báo cáo y tế
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* NÚT XEM THÊM / THU GỌN */}
                <TouchableOpacity
                    style={[
                        styles.fbViewMoreBtn,
                        isDarkMode && {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setShowMoreGrid(!showMoreGrid)}
                >
                    <Text
                        style={[
                            styles.fbViewMoreText,
                            isDarkMode && { color: colors.textPrimary },
                        ]}
                    >
                        {showMoreGrid ? "Ẩn bớt" : "Xem thêm"}
                    </Text>
                    <Ionicons
                        name={showMoreGrid ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={isDarkMode ? colors.textPrimary : "#1E293B"}
                    />
                </TouchableOpacity>

                {/* ACCORDION 1: TRỢ GIÚP VÀ HỖ TRỢ */}
                <View
                    style={[
                        styles.fbAccordionCard,
                        isDarkMode && {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.fbAccordionHeader}
                        activeOpacity={0.7}
                        onPress={() => setIsHelpExpanded(!isHelpExpanded)}
                    >
                        <View style={styles.fbAccordionHeaderLeft}>
                            <Ionicons
                                name="help-circle-outline"
                                size={24}
                                color={
                                    isDarkMode ? colors.textPrimary : "#0F172A"
                                }
                            />
                            <Text
                                style={[
                                    styles.fbAccordionTitle,
                                    isDarkMode && { color: colors.textPrimary },
                                ]}
                            >
                                Trợ giúp và hỗ trợ
                            </Text>
                        </View>
                        <Ionicons
                            name={isHelpExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#64748B"
                        />
                    </TouchableOpacity>

                    {isHelpExpanded && (
                        <View style={styles.fbAccordionBody}>
                            {/* Cấp cứu 115 */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={callEmergencyService}
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#FEE2E2" },
                                    ]}
                                >
                                    <Ionicons
                                        name="call"
                                        size={18}
                                        color="#EF4444"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            {
                                                color: "#EF4444",
                                                fontWeight: "800",
                                            },
                                        ]}
                                    >
                                        Gọi cấp cứu y tế khẩn cấp 115
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        Kết nối trực tiếp đường dây nóng y tế
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>

                            <View
                                style={[
                                    styles.fbSubDivider,
                                    isDarkMode && {
                                        backgroundColor: colors.border,
                                    },
                                ]}
                            />

                            {/* Dịch vụ CSKH 24/7 */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={() => setCustomerSupportVisible(true)}
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#EFF6FF" },
                                    ]}
                                >
                                    <Ionicons
                                        name="headset"
                                        size={18}
                                        color="#2563EB"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            isDarkMode && {
                                                color: colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        Tổng đài hỗ trợ kỹ thuật CSKH 24/7
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        Hỗ trợ kết nối camera, vòng tay, hub AI
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>

                            <View
                                style={[
                                    styles.fbSubDivider,
                                    isDarkMode && {
                                        backgroundColor: colors.border,
                                    },
                                ]}
                            />

                            {/* Hướng dẫn sử dụng & Giới thiệu đồ án */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate("AppInfo")}
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#F3E8FF" },
                                    ]}
                                >
                                    <Ionicons
                                        name="book-outline"
                                        size={18}
                                        color="#8B5CF6"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            isDarkMode && {
                                                color: colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        Hướng dẫn sử dụng & Giới thiệu đồ án
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        Tài liệu kỹ thuật Smart Elderly Care AI
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ACCORDION 2: CÀI ĐẶT VÀ QUYỀN RIÊNG TƯ */}
                <View
                    style={[
                        styles.fbAccordionCard,
                        isDarkMode && {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.fbAccordionHeader}
                        activeOpacity={0.7}
                        onPress={() => setIsSettingsExpanded(!isSettingsExpanded)}
                    >
                        <View style={styles.fbAccordionHeaderLeft}>
                            <Ionicons
                                name="settings-outline"
                                size={24}
                                color={
                                    isDarkMode ? colors.textPrimary : "#0F172A"
                                }
                            />
                            <Text
                                style={[
                                    styles.fbAccordionTitle,
                                    isDarkMode && { color: colors.textPrimary },
                                ]}
                            >
                                Cài đặt và quyền riêng tư
                            </Text>
                        </View>
                        <Ionicons
                            name={
                                isSettingsExpanded
                                    ? "chevron-up"
                                    : "chevron-down"
                            }
                            size={20}
                            color="#64748B"
                        />
                    </TouchableOpacity>

                    {isSettingsExpanded && (
                        <View style={styles.fbAccordionBody}>
                            {/* Cài đặt thông báo & Âm thanh */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={() =>
                                    setNotificationSettingsVisible(true)
                                }
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#FEF3C7" },
                                    ]}
                                >
                                    <Ionicons
                                        name="notifications-outline"
                                        size={18}
                                        color="#D97706"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            isDarkMode && {
                                                color: colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        Cài đặt thông báo & Âm thanh báo động
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        Chuông còi hú, rung, thông báo đẩy
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>

                            <View
                                style={[
                                    styles.fbSubDivider,
                                    isDarkMode && {
                                        backgroundColor: colors.border,
                                    },
                                ]}
                            />

                            {/* Kích thước chữ cho người cao tuổi */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={() => setFontSizeVisible(true)}
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#ECFDF5" },
                                    ]}
                                >
                                    <Ionicons
                                        name="text-outline"
                                        size={18}
                                        color="#10B981"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            isDarkMode && {
                                                color: colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        Cỡ chữ lớn (Dành cho người cao tuổi)
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        Điều chỉnh độ phóng to chữ đọc dễ dàng
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>

                            <View
                                style={[
                                    styles.fbSubDivider,
                                    isDarkMode && {
                                        backgroundColor: colors.border,
                                    },
                                ]}
                            />

                            {/* Chế độ Sáng / Tối */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={() => setAppearanceVisible(true)}
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#F1F5F9" },
                                    ]}
                                >
                                    <Ionicons
                                        name="contrast-outline"
                                        size={18}
                                        color="#475569"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            isDarkMode && {
                                                color: colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        Chế độ giao diện Sáng / Tối
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        {isDarkMode
                                            ? "Đang dùng Giao diện Tối"
                                            : "Đang dùng Giao diện Sáng"}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>

                            <View
                                style={[
                                    styles.fbSubDivider,
                                    isDarkMode && {
                                        backgroundColor: colors.border,
                                    },
                                ]}
                            />

                            {/* Trung tâm bảo mật */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={() => setSecurityCenterVisible(true)}
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#F0FDF4" },
                                    ]}
                                >
                                    <Ionicons
                                        name="shield-checkmark-outline"
                                        size={18}
                                        color="#16A34A"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            isDarkMode && {
                                                color: colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        Trung tâm bảo mật
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        Xác thực 2 bước, quản lý thiết bị &
                                        đăng nhập
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>

                            <View
                                style={[
                                    styles.fbSubDivider,
                                    isDarkMode && {
                                        backgroundColor: colors.border,
                                    },
                                ]}
                            />

                            {/* Đổi mật khẩu */}
                            <TouchableOpacity
                                style={styles.fbAccordionSubRow}
                                activeOpacity={0.7}
                                onPress={() => setChangePasswordVisible(true)}
                            >
                                <View
                                    style={[
                                        styles.fbSubIconBox,
                                        { backgroundColor: "#FEE2E2" },
                                    ]}
                                >
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={18}
                                        color="#EF4444"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.fbSubRowTitle,
                                            isDarkMode && {
                                                color: colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        Đổi mật khẩu tài khoản
                                    </Text>
                                    <Text style={styles.fbSubRowSub}>
                                        Cập nhật mã bảo mật đăng nhập
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color="#CBD5E1"
                                />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* NÚT ĐĂNG XUẤT */}
                <TouchableOpacity
                    style={[
                        styles.fbLogoutBtn,
                        isDarkMode && {
                            backgroundColor: "rgba(239, 68, 68, 0.15)",
                            borderColor: "#EF4444",
                        },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setLogoutConfirmVisible(true)}
                >
                    <Ionicons
                        name="log-out-outline"
                        size={20}
                        color="#EF4444"
                    />
                    <Text style={styles.fbLogoutBtnText}>Đăng xuất</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 30,
        paddingBottom: 40,
    },
    // Header
    fbHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        marginBottom: 16,
        marginTop: 4,
    },
    fbHeaderTitle: {
        fontSize: 28,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.5,
    },
    fbHeaderActionIcons: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    fbHeaderCircleBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#E4E6EB",
        alignItems: "center",
        justifyContent: "center",
    },

    // User Profile Card
    fbProfileCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    fbProfileInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 12,
    },
    fbAvatarCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    fbAvatarImg: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    fbProfileName: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
    },
    fbProfileRightBadge: {
        padding: 4,
    },
    fbCardDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginBottom: 10,
    },
    fbSubActionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 4,
    },
    fbPlusCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#475569",
        alignItems: "center",
        justifyContent: "center",
    },
    fbSubActionText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0F172A",
    },

    // 2-Column Grid
    fbGridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 12,
    },
    fbGridCard: {
        width: "48.5%",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        minHeight: 120,
        justifyContent: "space-between",
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    fbGridCardTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    fbGridIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    fbAesBadge: {
        backgroundColor: "#E0F2FE",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#BAE6FD",
    },
    fbAesBadgeText: {
        fontSize: 9,
        fontWeight: "700",
        color: "#0284C7",
    },
    fbGridCardTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 4,
        lineHeight: 20,
    },
    fbGridCardSub: {
        fontSize: 11,
        color: "#64748B",
        lineHeight: 15,
    },

    // View More Button
    fbViewMoreBtn: {
        height: 44,
        backgroundColor: "#E4E6EB",
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    fbViewMoreText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
    },

    // Accordion Sections
    fbAccordionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        overflow: "hidden",
    },
    fbAccordionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    fbAccordionHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    fbAccordionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    fbAccordionBody: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    fbAccordionSubRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        gap: 12,
    },
    fbSubIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    fbSubRowTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0F172A",
    },
    fbSubRowSub: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    fbSubDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginLeft: 46,
    },

    // Logout Button
    fbLogoutBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 48,
        backgroundColor: "#FEF2F2",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#FECACA",
        marginTop: 8,
        marginBottom: 20,
    },
    fbLogoutBtnText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#EF4444",
    },
});
