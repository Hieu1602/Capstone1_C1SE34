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

interface LogoutConfirmModalProps {
    visible: boolean;
    isDarkMode: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
    visible,
    isDarkMode,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.confirmModalOverlay} onPress={onClose}>
                <Pressable
                    style={[
                        styles.confirmModalCard,
                        isDarkMode && {
                            backgroundColor: "#1E293B",
                            borderColor: "#334155",
                            borderWidth: 1,
                        },
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.confirmModalIconCircle}>
                        <Ionicons
                            name="log-out-outline"
                            size={32}
                            color="#EF4444"
                        />
                    </View>
                    <Text
                        style={[
                            styles.confirmModalTitle,
                            isDarkMode && { color: "#F8FAFC" },
                        ]}
                    >
                        Đăng xuất tài khoản
                    </Text>
                    <Text
                        style={[
                            styles.confirmModalMessage,
                            isDarkMode && { color: "#94A3B8" },
                        ]}
                    >
                        Bạn có chắc chắn muốn đăng xuất khỏi hệ thống giám sát Smart Elderly Care?
                    </Text>
                    <View style={styles.confirmModalButtonRow}>
                        <TouchableOpacity
                            style={[
                                styles.confirmModalCancelBtn,
                                isDarkMode && {
                                    backgroundColor: "#0F172A",
                                    borderColor: "#334155",
                                    borderWidth: 1,
                                },
                            ]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={[
                                    styles.confirmModalCancelText,
                                    isDarkMode && { color: "#94A3B8" },
                                ]}
                            >
                                Hủy
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.confirmModalLogoutBtn}
                            onPress={onConfirm}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.confirmModalLogoutText}>
                                Đăng xuất
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    confirmModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    confirmModalCard: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    confirmModalIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#FEE2E2",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    confirmModalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 8,
        textAlign: "center",
    },
    confirmModalMessage: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 20,
    },
    confirmModalButtonRow: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    confirmModalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    confirmModalCancelText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#475569",
    },
    confirmModalLogoutBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: "#EF4444",
        alignItems: "center",
        justifyContent: "center",
    },
    confirmModalLogoutText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});

