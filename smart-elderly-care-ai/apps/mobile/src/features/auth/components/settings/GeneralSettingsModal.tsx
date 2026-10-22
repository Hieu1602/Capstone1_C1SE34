import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";

interface GeneralSettingsModalProps {
    visible: boolean;
    isDarkMode: boolean;
    languageMode: "vi" | "en";
    appearanceMode: "light" | "dark";
    onOpenLanguage: () => void;
    onOpenAppearance: () => void;
    onClose: () => void;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({
    visible,
    isDarkMode,
    languageMode,
    appearanceMode,
    onOpenLanguage,
    onOpenAppearance,
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
                            Cài đặt chung
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.generalSettingsList,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                                borderWidth: 1,
                                borderRadius: 18,
                                overflow: "hidden",
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.generalRow,
                                isDarkMode && { borderBottomColor: "#334155" },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.generalRowLabel,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Vùng
                            </Text>
                            <Text
                                style={[
                                    styles.generalRowValue,
                                    isDarkMode && { color: "#94A3B8" },
                                ]}
                            >
                                Vietnam
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.generalRow,
                                isDarkMode && { borderBottomColor: "#334155" },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => {
                                onClose();
                                onOpenLanguage();
                            }}
                        >
                            <Text
                                style={[
                                    styles.generalRowLabel,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Ngôn ngữ
                            </Text>
                            <View style={styles.generalValueWrap}>
                                <Text
                                    style={[
                                        styles.generalRowValue,
                                        {
                                            color: Colors.primary,
                                            fontWeight: "600",
                                        },
                                    ]}
                                >
                                    {languageMode === "vi"
                                        ? "Việt Nam"
                                        : "English"}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={Colors.primary}
                                />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.generalRow,
                                { borderBottomWidth: 0 },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => {
                                onClose();
                                onOpenAppearance();
                            }}
                        >
                            <Text
                                style={[
                                    styles.generalRowLabel,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Chế độ tối
                            </Text>
                            <View style={styles.generalValueWrap}>
                                <Text
                                    style={[
                                        styles.generalRowValue,
                                        {
                                            color: Colors.primary,
                                            fontWeight: "600",
                                        },
                                    ]}
                                >
                                    {appearanceMode === "light"
                                        ? "Màu sáng"
                                        : "Tối"}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={Colors.primary}
                                />
                            </View>
                        </TouchableOpacity>
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
    generalSettingsList: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    generalRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    generalRowLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
    generalRowValue: {
        fontSize: 15,
        color: "#64748B",
    },
    generalValueWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
});

