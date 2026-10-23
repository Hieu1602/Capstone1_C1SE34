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

interface LanguageSettingsModalProps {
    visible: boolean;
    isDarkMode: boolean;
    languageMode: "vi" | "en";
    onSelectLanguage: (lang: "vi" | "en") => void;
    onClose: () => void;
}

export const LanguageSettingsModal: React.FC<LanguageSettingsModalProps> = ({
    visible,
    isDarkMode,
    languageMode,
    onSelectLanguage,
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
                    styles.appearanceOverlay,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.appearanceSheet,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.appearanceHeader}>
                        <TouchableOpacity
                            style={[
                                styles.appearanceCloseButton,
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
                                color={isDarkMode ? "#F8FAFC" : "#111827"}
                            />
                        </TouchableOpacity>

                        <Text
                            style={[
                                styles.appearanceTitle,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Ngôn ngữ
                        </Text>
                        <View style={styles.appearanceHeaderSpacer} />
                    </View>

                    <View
                        style={[
                            styles.appearanceCard,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.appearanceOptionRow,
                                isDarkMode
                                    ? {
                                          backgroundColor: "#1E293B",
                                          borderBottomColor: "#334155",
                                      }
                                    : {
                                          backgroundColor: "#FFFFFF",
                                          borderBottomColor: "#E5E7EB",
                                      },
                                languageMode === "vi" &&
                                    (isDarkMode
                                        ? { backgroundColor: "#0F172A" }
                                        : styles.appearanceOptionRowSelected),
                            ]}
                            activeOpacity={0.8}
                            onPress={() => {
                                onSelectLanguage("vi");
                                onClose();
                            }}
                        >
                            <Text
                                style={[
                                    styles.appearanceOptionLabel,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Việt Nam
                            </Text>
                            {languageMode === "vi" && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={22}
                                    color={Colors.primary}
                                />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.appearanceOptionRow,
                                isDarkMode
                                    ? {
                                          backgroundColor: "#1E293B",
                                          borderBottomColor: "#334155",
                                          borderBottomWidth: 0,
                                      }
                                    : {
                                          backgroundColor: "#FFFFFF",
                                          borderBottomColor: "#E5E7EB",
                                          borderBottomWidth: 0,
                                      },
                                languageMode === "en" &&
                                    (isDarkMode
                                        ? { backgroundColor: "#0F172A" }
                                        : styles.appearanceOptionRowSelected),
                            ]}
                            activeOpacity={0.8}
                            onPress={() => {
                                onSelectLanguage("en");
                                onClose();
                            }}
                        >
                            <Text
                                style={[
                                    styles.appearanceOptionLabel,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                English
                            </Text>
                            {languageMode === "en" && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={22}
                                    color={Colors.primary}
                                />
                            )}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    appearanceOverlay: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    appearanceSheet: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    appearanceHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    appearanceCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
    },
    appearanceTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
    },
    appearanceHeaderSpacer: {
        width: 40,
    },
    appearanceCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    appearanceOptionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    appearanceOptionRowSelected: {
        backgroundColor: "#FFF7ED",
    },
    appearanceOptionLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
});

