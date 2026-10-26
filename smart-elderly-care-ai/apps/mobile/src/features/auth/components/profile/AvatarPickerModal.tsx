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

interface AvatarPickerModalProps {
    visible: boolean;
    isDarkMode: boolean;
    onClose: () => void;
    onPickFromCamera: () => void;
    onPickFromLibrary: () => void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
    visible,
    isDarkMode,
    onClose,
    onPickFromCamera,
    onPickFromLibrary,
}) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.avatarPickerOverlay} onPress={onClose}>
                <Pressable
                    style={[
                        styles.avatarPickerSheet,
                        isDarkMode && {
                            backgroundColor: "#1E293B",
                            borderColor: "#334155",
                            borderWidth: 1,
                        },
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.avatarPickerOptions}>
                        <TouchableOpacity
                            style={[
                                styles.avatarPickerRow,
                                isDarkMode && { borderBottomColor: "#334155" },
                            ]}
                            activeOpacity={0.8}
                            onPress={onPickFromCamera}
                        >
                            <Ionicons
                                name="camera-outline"
                                size={24}
                                color={isDarkMode ? "#F8FAFC" : "#111827"}
                            />
                            <Text
                                style={[
                                    styles.avatarPickerText,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Chụp ảnh
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.avatarPickerRow,
                                styles.avatarPickerLastRow,
                            ]}
                            activeOpacity={0.8}
                            onPress={onPickFromLibrary}
                        >
                            <Ionicons
                                name="images-outline"
                                size={24}
                                color={isDarkMode ? "#F8FAFC" : "#111827"}
                            />
                            <Text
                                style={[
                                    styles.avatarPickerText,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Chọn từ Thư viện
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    avatarPickerOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        justifyContent: "flex-end",
    },
    avatarPickerSheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 34,
    },
    avatarPickerOptions: {
        width: "100%",
    },
    avatarPickerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    avatarPickerLastRow: {
        borderBottomWidth: 0,
    },
    avatarPickerText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
});

