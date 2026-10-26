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

interface CustomerSupportModalProps {
    visible: boolean;
    isDarkMode: boolean;
    hotlineNumber: string;
    onClose: () => void;
    onCall: () => void;
}

export const CustomerSupportModal: React.FC<CustomerSupportModalProps> = ({
    visible,
    isDarkMode,
    hotlineNumber,
    onClose,
    onCall,
}) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.customerSupportOverlay} onPress={onClose}>
                <Pressable
                    style={[
                        styles.customerSupportDialog,
                        isDarkMode && {
                            backgroundColor: "#1E293B",
                            borderColor: "#334155",
                            borderWidth: 1,
                        },
                    ]}
                    onPress={() => {}}
                >
                    <Ionicons name="headset" size={28} color="#2563EB" />
                    <Text
                        style={[
                            styles.customerSupportTitle,
                            isDarkMode && { color: "#F8FAFC" },
                        ]}
                    >
                        Tổng đài hỗ trợ kỹ thuật CSKH 24/7
                    </Text>
                    <Text
                        style={[
                            styles.customerSupportMessage,
                            isDarkMode && { color: "#94A3B8" },
                        ]}
                    >
                        {`Kết nối trực tiếp tổng đài hỗ trợ kết nối camera, vòng tay, hub AI qua số ${hotlineNumber}?`}
                    </Text>
                    <View style={styles.customerSupportActions}>
                        <TouchableOpacity
                            style={[
                                styles.customerSupportCancelButton,
                                isDarkMode && {
                                    backgroundColor: "#0F172A",
                                    borderColor: "#334155",
                                    borderWidth: 1,
                                },
                            ]}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[
                                    styles.customerSupportCancelText,
                                    isDarkMode && { color: "#94A3B8" },
                                ]}
                            >
                                Hủy
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.customerSupportCallButton,
                                { backgroundColor: Colors.primary },
                            ]}
                            onPress={() => {
                                onClose();
                                onCall();
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="call" size={17} color="#FFFFFF" />
                            <Text
                                style={styles.customerSupportCallText}
                            >{`Gọi ${hotlineNumber}`}</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    customerSupportOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    customerSupportDialog: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 22,
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    customerSupportTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
        textAlign: "center",
        marginTop: 12,
        marginBottom: 8,
    },
    customerSupportMessage: {
        fontSize: 13.5,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 19,
        marginBottom: 20,
    },
    customerSupportActions: {
        flexDirection: "row",
        gap: 10,
        width: "100%",
    },
    customerSupportCancelButton: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    customerSupportCancelText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#475569",
    },
    customerSupportCallButton: {
        flex: 1.4,
        flexDirection: "row",
        gap: 6,
        paddingVertical: 11,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    customerSupportCallText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});

