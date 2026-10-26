import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";

interface NotificationSettingsModalProps {
    visible: boolean;
    isDarkMode: boolean;
    notificationsEnabled: boolean;
    alertSoundEnabled: boolean;
    criticalAlertEnabled: boolean;
    onToggleNotifications: (val: boolean) => void;
    onToggleAlertSound: (val: boolean) => void;
    onToggleCriticalAlert: (val: boolean) => void;
    onClose: () => void;
}

export const NotificationSettingsModal: React.FC<
    NotificationSettingsModalProps
> = ({
    visible,
    isDarkMode,
    notificationsEnabled,
    alertSoundEnabled,
    criticalAlertEnabled,
    onToggleNotifications,
    onToggleAlertSound,
    onToggleCriticalAlert,
    onClose,
}) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                style={[
                    styles.settingsOverlay,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.settingsSheet,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    onPress={() => {}}
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
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="chevron-back-outline"
                                size={24}
                                color={
                                    isDarkMode ? "#F8FAFC" : Colors.textPrimary
                                }
                            />
                        </TouchableOpacity>
                        <Text
                            style={[
                                styles.settingsTitle,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Thiết lập thông báo
                        </Text>
                    </View>

                    <View style={styles.notificationSettingsContent}>
                        <Text
                            style={[
                                styles.notificationSettingsIntro,
                                isDarkMode && { color: "#94A3B8" },
                            ]}
                        >
                            Chọn cách bạn muốn nhận cảnh báo từ hệ thống.
                        </Text>

                        <View
                            style={[
                                styles.notificationSettingsCard,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                        >
                            <View style={styles.notificationSettingRow}>
                                <View style={styles.notificationSettingText}>
                                    <Text
                                        style={[
                                            styles.notificationSettingTitle,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Thông báo cảnh báo
                                    </Text>
                                    <Text
                                        style={[
                                            styles.notificationSettingDescription,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        Nhận cảnh báo sức khỏe mới
                                    </Text>
                                </View>
                                <Switch
                                    value={notificationsEnabled}
                                    onValueChange={onToggleNotifications}
                                    trackColor={{
                                        false: isDarkMode
                                            ? "#334155"
                                            : "#CBD5E1",
                                        true: "#FDBA74",
                                    }}
                                    thumbColor={
                                        notificationsEnabled
                                            ? Colors.primary
                                            : "#FFFFFF"
                                    }
                                />
                            </View>
                            <View
                                style={[
                                    styles.notificationSettingDivider,
                                    isDarkMode && {
                                        backgroundColor: "#334155",
                                    },
                                ]}
                            />

                            <View style={styles.notificationSettingRow}>
                                <View style={styles.notificationSettingText}>
                                    <Text
                                        style={[
                                            styles.notificationSettingTitle,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Âm thanh cảnh báo
                                    </Text>
                                    <Text
                                        style={[
                                            styles.notificationSettingDescription,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        Phát âm thanh khi có cảnh báo
                                    </Text>
                                </View>
                                <Switch
                                    value={alertSoundEnabled}
                                    onValueChange={onToggleAlertSound}
                                    trackColor={{
                                        false: isDarkMode
                                            ? "#334155"
                                            : "#CBD5E1",
                                        true: "#FDBA74",
                                    }}
                                    thumbColor={
                                        alertSoundEnabled
                                            ? Colors.primary
                                            : "#FFFFFF"
                                    }
                                />
                            </View>
                            <View
                                style={[
                                    styles.notificationSettingDivider,
                                    isDarkMode && {
                                        backgroundColor: "#334155",
                                    },
                                ]}
                            />

                            <View style={styles.notificationSettingRow}>
                                <View style={styles.notificationSettingText}>
                                    <Text
                                        style={[
                                            styles.notificationSettingTitle,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Cảnh báo khẩn cấp
                                    </Text>
                                    <Text
                                        style={[
                                            styles.notificationSettingDescription,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        Luôn ưu tiên cảnh báo nguy hiểm
                                    </Text>
                                </View>
                                <Switch
                                    value={criticalAlertEnabled}
                                    onValueChange={onToggleCriticalAlert}
                                    trackColor={{
                                        false: isDarkMode
                                            ? "#334155"
                                            : "#CBD5E1",
                                        true: "#FDBA74",
                                    }}
                                    thumbColor={
                                        criticalAlertEnabled
                                            ? Colors.primary
                                            : "#FFFFFF"
                                    }
                                />
                            </View>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    settingsOverlay: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    settingsSheet: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    settingsHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    settingsBackButton: {
        marginRight: 12,
    },
    settingsTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
    },
    notificationSettingsContent: {
        gap: 16,
    },
    notificationSettingsIntro: {
        fontSize: 14,
        color: "#64748B",
        lineHeight: 20,
    },
    notificationSettingsCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    notificationSettingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
    },
    notificationSettingText: {
        flex: 1,
        marginRight: 16,
    },
    notificationSettingTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1E293B",
        marginBottom: 2,
    },
    notificationSettingDescription: {
        fontSize: 12.5,
        color: "#64748B",
    },
    notificationSettingDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#E2E8F0",
    },
});

