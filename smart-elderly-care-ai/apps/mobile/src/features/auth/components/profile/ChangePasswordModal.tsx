import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";
import { SlideRightModal } from "../settings/SlideRightModal";

interface PasswordFeedback {
    type: "success" | "error";
    message: string;
}

interface ChangePasswordModalProps {
    visible: boolean;
    isDarkMode: boolean;
    onClose: () => void;
    onSubmit: (
        currentPass: string,
        newPass: string,
        confirmPass: string,
    ) => Promise<boolean>;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
    visible,
    isDarkMode,
    onClose,
    onSubmit,
}) => {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [feedback, setFeedback] = useState<PasswordFeedback | null>(null);

    const handleReset = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setFeedback(null);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const handleSave = async () => {
        if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            setFeedback({
                type: "error",
                message: "Vui lòng nhập đầy đủ các trường mật khẩu.",
            });
            return;
        }

        if (newPassword.length < 8 || newPassword.length > 16) {
            setFeedback({
                type: "error",
                message: "Mật khẩu mới phải dài từ 8 đến 16 ký tự.",
            });
            return;
        }

        const isComplex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(
                newPassword,
            );
        if (!isComplex) {
            setFeedback({
                type: "error",
                message:
                    "Mật khẩu cần bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.",
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setFeedback({
                type: "error",
                message: "Mật khẩu xác nhận không trùng khớp.",
            });
            return;
        }

        setIsChangingPassword(true);
        setFeedback(null);
        try {
            const success = await onSubmit(
                currentPassword,
                newPassword,
                confirmPassword,
            );
            if (success) {
                setFeedback({
                    type: "success",
                    message: "Mật khẩu của bạn đã được cập nhật thành công!",
                });
                setTimeout(() => {
                    handleClose();
                }, 1400);
            }
        } catch (error: any) {
            setFeedback({
                type: "error",
                message:
                    error?.response?.data?.detail ||
                    error?.message ||
                    "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.",
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <SlideRightModal visible={visible} onClose={handleClose} isDarkMode={isDarkMode}>
            <SafeAreaView
                style={[
                    styles.changePasswordScreen,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                edges={["top"]}
            >
                <View
                    style={[
                        styles.changePasswordHeader,
                        isDarkMode && { borderBottomColor: "#1E293B" },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.changePasswordBackButton,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                        onPress={handleClose}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="chevron-back-outline"
                            size={24}
                            color={isDarkMode ? "#F8FAFC" : Colors.textPrimary}
                        />
                    </TouchableOpacity>

                    <Text
                        style={[
                            styles.changePasswordTitle,
                            isDarkMode && { color: "#F8FAFC" },
                        ]}
                    >
                        Đổi mật khẩu
                    </Text>
                    <View style={styles.changePasswordHeaderRight} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.changePasswordContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View
                        style={[
                            styles.changePasswordCard,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                    >
                        <View style={styles.changePasswordHeroRow}>
                            <View
                                style={[
                                    styles.changePasswordIconBadge,
                                    isDarkMode && {
                                        backgroundColor:
                                            "rgba(255, 122, 0, 0.16)",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="key-outline"
                                    size={22}
                                    color={Colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.changePasswordCardHeading,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Bảo mật tài khoản
                                </Text>
                                <Text
                                    style={[
                                        styles.changePasswordIntro,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Tạo mật khẩu mới để bảo vệ tài khoản của bạn.
                                </Text>
                            </View>
                        </View>

                        {feedback && (
                            <View
                                accessibilityRole="alert"
                                style={[
                                    styles.passwordFeedbackBanner,
                                    feedback.type === "success"
                                        ? isDarkMode
                                            ? {
                                                  backgroundColor:
                                                      "rgba(16, 185, 129, 0.15)",
                                                  borderColor: "#065F46",
                                              }
                                            : {
                                                  backgroundColor: "#ECFDF5",
                                                  borderColor: "#A7F3D0",
                                              }
                                        : isDarkMode
                                          ? {
                                                backgroundColor:
                                                    "rgba(239, 68, 68, 0.15)",
                                                borderColor: "#7F1D1D",
                                            }
                                          : {
                                                backgroundColor: "#FEF2F2",
                                                borderColor: "#FECACA",
                                            },
                                ]}
                            >
                                <Ionicons
                                    name={
                                        feedback.type === "success"
                                            ? "checkmark-circle"
                                            : "alert-circle"
                                    }
                                    size={20}
                                    color={
                                        feedback.type === "success"
                                            ? "#10B981"
                                            : "#EF4444"
                                    }
                                />
                                <Text
                                    style={{
                                        flex: 1,
                                        fontSize: 13.5,
                                        fontWeight: "600",
                                        lineHeight: 19,
                                        color:
                                            feedback.type === "success"
                                                ? isDarkMode
                                                    ? "#A7F3D0"
                                                    : "#065F46"
                                                : isDarkMode
                                                  ? "#FCA5A5"
                                                  : "#B91C1C",
                                    }}
                                >
                                    {feedback.message}
                                </Text>
                            </View>
                        )}

                        <Text
                            style={[
                                styles.passwordLabel,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Mật khẩu hiện tại
                        </Text>
                        <View
                            style={[
                                styles.passwordInputWrap,
                                isDarkMode && {
                                    backgroundColor: "#0F172A",
                                    borderColor: "#334155",
                                },
                                currentPassword.length > 0 && {
                                    borderColor: Colors.primary,
                                },
                            ]}
                        >
                            <Ionicons
                                name="lock-closed-outline"
                                size={20}
                                color={
                                    currentPassword.length > 0
                                        ? Colors.primary
                                        : "#94A3B8"
                                }
                                style={styles.passwordLeadingIcon}
                            />
                            <TextInput
                                style={[
                                    styles.passwordInput,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                placeholder="Nhập mật khẩu hiện tại"
                                placeholderTextColor="#94A3B8"
                                secureTextEntry={!showCurrentPassword}
                            />
                            <TouchableOpacity
                                onPress={() =>
                                    setShowCurrentPassword(!showCurrentPassword)
                                }
                                hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                }}
                            >
                                <Ionicons
                                    name={
                                        showCurrentPassword
                                            ? "eye-off-outline"
                                            : "eye-outline"
                                    }
                                    size={21}
                                    color={isDarkMode ? "#94A3B8" : "#64748B"}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text
                            style={[
                                styles.passwordLabel,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Mật khẩu mới
                        </Text>
                        <View
                            style={[
                                styles.passwordInputWrap,
                                isDarkMode && {
                                    backgroundColor: "#0F172A",
                                    borderColor: "#334155",
                                },
                                newPassword.length > 0 && {
                                    borderColor: Colors.primary,
                                },
                            ]}
                        >
                            <Ionicons
                                name="key-outline"
                                size={20}
                                color={
                                    newPassword.length > 0
                                        ? Colors.primary
                                        : "#94A3B8"
                                }
                                style={styles.passwordLeadingIcon}
                            />
                            <TextInput
                                style={[
                                    styles.passwordInput,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                placeholder="Nhập mật khẩu mới"
                                placeholderTextColor="#94A3B8"
                                secureTextEntry={!showNewPassword}
                            />
                            <TouchableOpacity
                                onPress={() =>
                                    setShowNewPassword(!showNewPassword)
                                }
                                hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                }}
                            >
                                <Ionicons
                                    name={
                                        showNewPassword
                                            ? "eye-off-outline"
                                            : "eye-outline"
                                    }
                                    size={21}
                                    color={isDarkMode ? "#94A3B8" : "#64748B"}
                                />
                            </TouchableOpacity>
                        </View>

                        <View
                            style={[
                                styles.passwordRequirements,
                                isDarkMode && {
                                    backgroundColor: "#0F172A",
                                    borderColor: "#334155",
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.passwordRequirementsTitle,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Yêu cầu mật khẩu:
                            </Text>
                            <View style={styles.passwordRequirementRow}>
                                <Ionicons
                                    name={
                                        newPassword.length >= 8 &&
                                        newPassword.length <= 16
                                            ? "checkmark-circle"
                                            : "ellipse-outline"
                                    }
                                    size={16}
                                    color={
                                        newPassword.length >= 8 &&
                                        newPassword.length <= 16
                                            ? "#10B981"
                                            : Colors.primary
                                    }
                                />
                                <Text
                                    style={[
                                        styles.passwordRequirement,
                                        isDarkMode && { color: "#94A3B8" },
                                        newPassword.length >= 8 &&
                                            newPassword.length <= 16 && {
                                                color: "#10B981",
                                                fontWeight: "600",
                                            },
                                    ]}
                                >
                                    Dài 8-16 ký tự
                                </Text>
                            </View>
                            <View style={styles.passwordRequirementRow}>
                                <Ionicons
                                    name={
                                        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(
                                            newPassword,
                                        )
                                            ? "checkmark-circle"
                                            : "ellipse-outline"
                                    }
                                    size={16}
                                    color={
                                        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(
                                            newPassword,
                                        )
                                            ? "#10B981"
                                            : Colors.primary
                                    }
                                />
                                <Text
                                    style={[
                                        styles.passwordRequirement,
                                        isDarkMode && { color: "#94A3B8" },
                                        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(
                                            newPassword,
                                        ) && {
                                            color: "#10B981",
                                            fontWeight: "600",
                                        },
                                    ]}
                                >
                                    Bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.
                                </Text>
                            </View>
                        </View>

                        <Text
                            style={[
                                styles.passwordLabel,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Nhập lại mật khẩu mới
                        </Text>
                        <View
                            style={[
                                styles.passwordInputWrap,
                                isDarkMode && {
                                    backgroundColor: "#0F172A",
                                    borderColor: "#334155",
                                },
                                confirmPassword.length > 0 && {
                                    borderColor: Colors.primary,
                                },
                            ]}
                        >
                            <Ionicons
                                name="shield-checkmark-outline"
                                size={20}
                                color={
                                    confirmPassword.length > 0
                                        ? Colors.primary
                                        : "#94A3B8"
                                }
                                style={styles.passwordLeadingIcon}
                            />
                            <TextInput
                                style={[
                                    styles.passwordInput,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Nhập lại mật khẩu mới"
                                placeholderTextColor="#94A3B8"
                                secureTextEntry={!showConfirmPassword}
                            />
                            <TouchableOpacity
                                onPress={() =>
                                    setShowConfirmPassword(!showConfirmPassword)
                                }
                                hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                }}
                            >
                                <Ionicons
                                    name={
                                        showConfirmPassword
                                            ? "eye-off-outline"
                                            : "eye-outline"
                                    }
                                    size={21}
                                    color={isDarkMode ? "#94A3B8" : "#64748B"}
                                />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.changePasswordButton,
                                isChangingPassword && { opacity: 0.7 },
                            ]}
                            onPress={handleSave}
                            activeOpacity={0.85}
                            disabled={isChangingPassword}
                        >
                            {isChangingPassword ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons
                                        name="checkmark-circle-outline"
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.changePasswordButtonText}>
                                        Cập nhật mật khẩu
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </SlideRightModal>
    );
};

const styles = StyleSheet.create({
    changePasswordScreen: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    changePasswordHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    changePasswordBackButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    changePasswordTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
    },
    changePasswordHeaderRight: {
        width: 40,
    },
    changePasswordContent: {
        padding: 20,
    },
    changePasswordCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    changePasswordHeroRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
    },
    changePasswordIconBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "#FFF7ED",
        justifyContent: "center",
        alignItems: "center",
    },
    changePasswordCardHeading: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    changePasswordIntro: {
        fontSize: 13,
        color: "#64748B",
        marginTop: 2,
    },
    passwordFeedbackBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 16,
    },
    passwordLabel: {
        fontSize: 13.5,
        fontWeight: "600",
        color: "#1E293B",
        marginBottom: 8,
        marginTop: 10,
    },
    passwordInputWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 50,
    },
    passwordLeadingIcon: {
        marginRight: 10,
    },
    passwordInput: {
        flex: 1,
        fontSize: 14.5,
        color: "#0F172A",
    },
    passwordRequirements: {
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        gap: 6,
    },
    passwordRequirementsTitle: {
        fontSize: 12.5,
        fontWeight: "600",
        color: "#475569",
        marginBottom: 2,
    },
    passwordRequirementRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    passwordRequirement: {
        fontSize: 12,
        color: "#64748B",
        flex: 1,
    },
    changePasswordButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        height: 52,
        marginTop: 24,
    },
    changePasswordButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});

