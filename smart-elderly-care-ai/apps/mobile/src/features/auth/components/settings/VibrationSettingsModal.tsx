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

interface VibrationSettingsModalProps {
    visible: boolean;
    isDarkMode: boolean;
    vibrationEnabled: boolean;
    onToggleVibration: (val: boolean) => void;
    onClose: () => void;
}

export const VibrationSettingsModal: React.FC<VibrationSettingsModalProps> = ({
    visible,
    isDarkMode,
    vibrationEnabled,
    onToggleVibration,
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
                        styles.vibrationDetailSheet,
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
                            Rung
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.vibrationDetailRow,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.vibrationDetailLabel,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Rung
                        </Text>
                        <Switch
                            value={vibrationEnabled}
                            onValueChange={onToggleVibration}
                            trackColor={{
                                false: isDarkMode ? "#334155" : "#CBD5E1",
                                true: "#FDBA74",
                            }}
                            thumbColor={
                                vibrationEnabled ? Colors.primary : "#FFFFFF"
                            }
                        />
                    </View>

                    <Text
                        style={[
                            styles.vibrationDetailDescription,
                            isDarkMode && { color: "#94A3B8" },
                        ]}
                    >
                        Khi được bật, điện thoại / máy tính bảng của bạn sẽ rung
                        khi có cảnh báo hoặc thông báo mới từ hệ thống.
                    </Text>
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
    vibrationDetailSheet: {
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
    vibrationDetailRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        paddingVertical: 18,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    vibrationDetailLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
    vibrationDetailDescription: {
        fontSize: 13,
        color: "#64748B",
        lineHeight: 18,
        marginTop: 12,
        paddingHorizontal: 4,
    },
});
