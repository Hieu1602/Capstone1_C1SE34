// ProfileScreen.tsx
// Màn hình Cá nhân / Quản trị hệ thống (Phong cách Elderly Care AI)

import React from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../theme/colors";
import {
    LocalizedAlert as Alert,
    LocalizedText as Text,
} from "../../../i18n/LocalizedComponents";
import { SUPPORT_HOTLINE_NUMBER } from "../../../services/emergency";
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
    ProfileUserCard,
    ProfileQuickGrid,
    ProfileHelpAccordion,
    ProfileSettingsAccordion,
} from "../components";
import { useProfileManager } from "../hooks/useProfileManager";

export default function ProfileScreen({ navigation, route }: any) {
    const {
        isDarkMode,
        colors,
        setDarkMode,
        house,
        resolvedDisplayName,
        profilePhone,
        avatarUri,
        showMoreGrid,
        setShowMoreGrid,
        isHelpExpanded,
        setIsHelpExpanded,
        isSettingsExpanded,
        setIsSettingsExpanded,
        isUserMenuVisible,
        setUserMenuVisible,
        isAvatarPickerVisible,
        setAvatarPickerVisible,
        isLogoutConfirmVisible,
        setLogoutConfirmVisible,
        isChangePasswordVisible,
        setChangePasswordVisible,
        isCustomerSupportVisible,
        setCustomerSupportVisible,
        isSecurityCenterVisible,
        setSecurityCenterVisible,
        isFontSizeVisible,
        setFontSizeVisible,
        isNotificationSettingsVisible,
        setNotificationSettingsVisible,
        isAppearanceVisible,
        setAppearanceVisible,
        fontSizeMode,
        customFontScale,
        notificationsEnabled,
        alertSoundEnabled,
        criticalAlertEnabled,
        toggleViewRole,
        performLogout,
        handleSaveName,
        handleChangePassword,
        pickAvatarFromCamera,
        pickAvatarFromLibrary,
        applyFontScaleMode,
        handleUpdateFontScale,
        handleToggleNotification,
        callEmergencyService,
        callCustomerSupportService,
    } = useProfileManager(navigation, route);

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

                {/* 1. THẺ THÔNG TIN TÀI KHOẢN NGƯỜI GIÁM SÁT */}
                <ProfileUserCard
                    displayName={resolvedDisplayName}
                    avatarUri={avatarUri}
                    isDarkMode={isDarkMode}
                    colors={colors}
                    onPressProfile={() => setUserMenuVisible(true)}
                    onPressAddMember={() => navigation.navigate("HouseDetail")}
                />

                {/* 2. LƯỚI TÍNH NĂNG CHÍNH CỦA HỆ THỐNG */}
                <ProfileQuickGrid
                    isDarkMode={isDarkMode}
                    colors={colors}
                    houseName={house.name || "Nhà của tôi"}
                    membersCount={house.membersCount || 1}
                    showMore={showMoreGrid}
                    onToggleShowMore={() => setShowMoreGrid(!showMoreGrid)}
                    onNavigate={(screen) => navigation.navigate(screen)}
                    onOpenProfile={() => setUserMenuVisible(true)}
                    onToggleDoctorMode={() => {
                        Alert.alert(
                            "Chuyển sang Chế độ Bác sĩ",
                            "Bạn muốn chuyển sang giao diện chuyên môn của Bác sĩ gia đình (Danh sách bệnh nhân, Kê đơn thuốc, Báo cáo y tế)?",
                            [
                                { text: "Hủy", style: "cancel" },
                                {
                                    text: "Chuyển ngay",
                                    onPress: () => toggleViewRole(),
                                },
                            ],
                        );
                    }}
                />

                {/* 3. ACCORDION 1: TRỢ GIÚP VÀ HỖ TRỢ */}
                <ProfileHelpAccordion
                    isExpanded={isHelpExpanded}
                    onToggle={() => setIsHelpExpanded(!isHelpExpanded)}
                    isDarkMode={isDarkMode}
                    colors={colors}
                    onCallEmergency={callEmergencyService}
                    onOpenSupport={() => setCustomerSupportVisible(true)}
                    onNavigateAppInfo={() => navigation.navigate("AppInfo")}
                />

                {/* 4. ACCORDION 2: CÀI ĐẶT VÀ QUYỀN RIÊNG TƯ */}
                <ProfileSettingsAccordion
                    isExpanded={isSettingsExpanded}
                    onToggle={() => setIsSettingsExpanded(!isSettingsExpanded)}
                    isDarkMode={isDarkMode}
                    colors={colors}
                    onOpenNotifications={() =>
                        setNotificationSettingsVisible(true)
                    }
                    onOpenFontSize={() => setFontSizeVisible(true)}
                    onOpenAppearance={() => setAppearanceVisible(true)}
                    onOpenSecurityCenter={() => setSecurityCenterVisible(true)}
                    onOpenChangePassword={() => setChangePasswordVisible(true)}
                />

                {/* 5. NÚT ĐĂNG XUẤT */}
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
