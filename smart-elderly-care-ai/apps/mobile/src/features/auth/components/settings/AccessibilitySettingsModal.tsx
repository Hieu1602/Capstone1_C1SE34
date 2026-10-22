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

interface AccessibilitySettingsModalProps {
    visible: boolean;
    isDarkMode: boolean;
    fontSizeMode: "system" | "custom";
    highContrastEnabled: boolean;
    onToggleHighContrast: (val: boolean) => void;
    onOpenFontSize: () => void;
    onClose: () => void;
}

export const AccessibilitySettingsModal: React.FC<
    AccessibilitySettingsModalProps
> = ({
    visible,
    isDarkMode,
    fontSizeMode,
    highContrastEnabled,
    onToggleHighContrast,
    onOpenFontSize,
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
                            Khả năng tiếp cận
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.accessibilityList,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.accessibilityRow,
                                isDarkMode && { borderBottomColor: "#334155" },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => {
                                onClose();
                                onOpenFontSize();
                            }}
                        >
                            <Text
                                style={[
                                    styles.accessibilityLabel,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Kích thước phông chữ
                            </Text>
                            <View style={styles.accessibilityValueWrap}>
                                <Text
                                    style={[
                                        styles.accessibilityValue,
                                        {
                                            color: Colors.primary,
                                            fontWeight: "600",
                                            fontSize: 15,
                                        },
                                    ]}
                                >
                                    {fontSizeMode === "system"
                                        ? "Theo hệ thống"
                                        : "Tùy chỉnh"}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={Colors.primary}
                                />
                            </View>
                        </TouchableOpacity>

                        <View
                            style={[
                                styles.accessibilityRow,
                                styles.accessibilityRowLast,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.accessibilityLabel,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Tăng độ tương phản
                            </Text>
                            <Switch
                                value={highContrastEnabled}
                                onValueChange={onToggleHighContrast}
                                trackColor={{
                                    false: isDarkMode ? "#334155" : "#CBD5E1",
                                    true: "#FDBA74",
                                }}
                                thumbColor={
                                    highContrastEnabled
                                        ? Colors.primary
                                        : "#FFFFFF"
                                }
                            />
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
    accessibilityList: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    accessibilityRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    accessibilityRowLast: {
        borderBottomWidth: 0,
    },
    accessibilityLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
    accessibilityValueWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    accessibilityValue: {
        fontSize: 15,
        color: "#64748B",
    },
});
