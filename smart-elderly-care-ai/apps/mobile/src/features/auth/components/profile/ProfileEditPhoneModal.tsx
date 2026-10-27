import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";
import { authApi } from "../../../../services/api";
import { validatePhoneNumber } from "../../utils/phoneValidation";

interface ProfileEditPhoneModalProps {
    visible: boolean;
    isDarkMode: boolean;
    currentPhone: string;
    onClose: () => void;
    onSave: (newPhone: string, otpCode: string) => Promise<boolean>;
}

export const ProfileEditPhoneModal: React.FC<ProfileEditPhoneModalProps> = ({
    visible,
    isDarkMode,
    currentPhone,
    onClose,
    onSave,
}) => {
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [draftPhone, setDraftPhone] = useState("");
    const [normalizedTargetPhone, setNormalizedTargetPhone] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [countdown, setCountdown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state khi modal mở lại
    useEffect(() => {
        if (visible) {
            setStep("PHONE");
            setDraftPhone("");
            setNormalizedTargetPhone("");
            setOtpCode("");
            setCountdown(0);
            setError(null);
            setIsLoading(false);
        }
    }, [visible]);

    // Bộ đếm thời gian gửi lại OTP (60s)
    useEffect(() => {
        if (countdown <= 0) return undefined;
        const timer = setInterval(() => {
            setCountdown((prev) => Math.max(prev - 1, 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // Bước 1: Gửi mã OTP tới số điện thoại mới
    const handleSendOtp = async () => {
        setError(null);
        const clean = draftPhone.trim();
        const validation = validatePhoneNumber(clean);
        if (!validation.isValid || !validation.formattedPhone) {
            setError(validation.message || "Số điện thoại không hợp lệ.");
            return;
        }

        const newTarget = validation.formattedPhone;
        // Kiểm tra xem số mới có trùng với số hiện tại không
        const currentClean = currentPhone.trim().replace(/[\s().-]/g, "");
        if (
            newTarget === currentPhone ||
            newTarget === currentClean ||
            newTarget.replace("+84", "0") === currentClean.replace("+84", "0")
        ) {
            setError("Số điện thoại mới phải khác với số điện thoại hiện tại của bạn.");
            return;
        }

        setIsLoading(true);
        try {
            await authApi.requestOtp(newTarget);
            setNormalizedTargetPhone(newTarget);
            setStep("OTP");
            setOtpCode("");
            setCountdown(60);
        } catch (err: any) {
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                "Không thể gửi mã xác thực SMS. Vui lòng thử lại sau.";
            setError(typeof msg === "string" ? msg : "Không thể gửi mã OTP.");
        } finally {
            setIsLoading(false);
        }
    };

    // Gửi lại mã OTP
    const handleResendOtp = async () => {
        if (countdown > 0 || isLoading) return;
        setError(null);
        setIsLoading(true);
        try {
            await authApi.requestOtp(normalizedTargetPhone);
            setCountdown(60);
        } catch (err: any) {
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                "Không thể gửi lại mã xác thực.";
            setError(typeof msg === "string" ? msg : "Không thể gửi lại mã.");
        } finally {
            setIsLoading(false);
        }
    };

    // Bước 2: Xác nhận OTP và lưu SĐT mới
    const handleConfirmOtp = async () => {
        setError(null);
        const cleanOtp = otpCode.trim();
        if (!/^\d{6}$/.test(cleanOtp)) {
            setError("Mã OTP phải gồm đúng 6 chữ số.");
            return;
        }

        setIsLoading(true);
        try {
            const success = await onSave(normalizedTargetPhone, cleanOtp);
            if (success) {
                Alert.alert(
                    "Thành công",
                    `Đã cập nhật số điện thoại mới ${normalizedTargetPhone} thành công.`,
                );
                onClose();
            }
        } catch (err: any) {
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                "Mã xác thực OTP không đúng hoặc đã hết hạn.";
            setError(typeof msg === "string" ? msg : "Không thể đổi số điện thoại.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                style={[
                    styles.editorOverlay,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.editorSheet,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.editorHeader}>
                        <TouchableOpacity
                            style={[
                                styles.editorBackButton,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                            onPress={() => {
                                if (step === "OTP") {
                                    setStep("PHONE");
                                    setError(null);
                                } else {
                                    onClose();
                                }
                            }}
                            activeOpacity={0.7}
                            disabled={isLoading}
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
                                styles.editorTitle,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            {step === "PHONE"
                                ? "Thay đổi số điện thoại"
                                : "Xác thực mã OTP"}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.editorCard,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                    >
                        {step === "PHONE" ? (
                            <>
                                <View style={styles.editorFieldHeader}>
                                    <View
                                        style={[
                                            styles.editorFieldIconBadge,
                                            isDarkMode && {
                                                backgroundColor:
                                                    "rgba(255, 122, 0, 0.16)",
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name="call-outline"
                                            size={20}
                                            color={Colors.primary}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={[
                                                styles.editorFieldLabel,
                                                isDarkMode && {
                                                    color: "#F8FAFC",
                                                },
                                            ]}
                                        >
                                            Số điện thoại mới
                                        </Text>
                                        <Text
                                            style={[
                                                styles.editorFieldDesc,
                                                isDarkMode && {
                                                    color: "#94A3B8",
                                                },
                                            ]}
                                        >
                                            Hệ thống sẽ gửi mã xác thực OTP 6 số đến số điện thoại mới này để xác minh chính chủ.
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={[
                                        styles.editorInputWrap,
                                        isDarkMode && {
                                            backgroundColor: "#0F172A",
                                            borderColor: Colors.primary,
                                        },
                                        error
                                            ? { borderColor: Colors.danger }
                                            : null,
                                    ]}
                                >
                                    <TextInput
                                        value={draftPhone}
                                        onChangeText={(val) => {
                                            setDraftPhone(val);
                                            if (error) setError(null);
                                        }}
                                        style={[
                                            styles.editorInput,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                        placeholder="Nhập SĐT mới (VD: 0912345678)"
                                        placeholderTextColor="#94A3B8"
                                        autoFocus
                                        keyboardType="phone-pad"
                                        returnKeyType="done"
                                        editable={!isLoading}
                                        onSubmitEditing={handleSendOtp}
                                    />
                                    {draftPhone.length > 0 && !isLoading && (
                                        <TouchableOpacity
                                            onPress={() => setDraftPhone("")}
                                            hitSlop={{
                                                top: 8,
                                                bottom: 8,
                                                left: 8,
                                                right: 8,
                                            }}
                                        >
                                            <Ionicons
                                                name="close-circle"
                                                size={20}
                                                color={
                                                    isDarkMode
                                                        ? "#64748B"
                                                        : "#94A3B8"
                                                }
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.editorFieldHeader}>
                                    <View
                                        style={[
                                            styles.editorFieldIconBadge,
                                            {
                                                backgroundColor:
                                                    "rgba(16, 185, 129, 0.16)",
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name="shield-checkmark-outline"
                                            size={20}
                                            color="#10B981"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={[
                                                styles.editorFieldLabel,
                                                isDarkMode && {
                                                    color: "#F8FAFC",
                                                },
                                            ]}
                                        >
                                            Nhập mã OTP 6 chữ số
                                        </Text>
                                        <Text
                                            style={[
                                                styles.editorFieldDesc,
                                                isDarkMode && {
                                                    color: "#94A3B8",
                                                },
                                            ]}
                                        >
                                            Mã xác thực đã được gửi tới số{" "}
                                            <Text style={{ fontWeight: "700", color: Colors.primary }}>
                                                {normalizedTargetPhone}
                                            </Text>
                                            . Vui lòng nhập mã để hoàn tất.
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={[
                                        styles.editorInputWrap,
                                        styles.otpInputWrap,
                                        isDarkMode && {
                                            backgroundColor: "#0F172A",
                                            borderColor: Colors.primary,
                                        },
                                        error
                                            ? { borderColor: Colors.danger }
                                            : null,
                                    ]}
                                >
                                    <TextInput
                                        value={otpCode}
                                        onChangeText={(val) => {
                                            const cleanVal = val.replace(/[^0-9]/g, "").slice(0, 6);
                                            setOtpCode(cleanVal);
                                            if (error) setError(null);
                                        }}
                                        style={[
                                            styles.editorInput,
                                            styles.otpInput,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                        placeholder="••••••"
                                        placeholderTextColor="#94A3B8"
                                        autoFocus
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        returnKeyType="done"
                                        editable={!isLoading}
                                        onSubmitEditing={handleConfirmOtp}
                                    />
                                </View>

                                {/* Gửi lại mã OTP */}
                                <View style={styles.resendContainer}>
                                    {countdown > 0 ? (
                                        <Text
                                            style={[
                                                styles.resendCountdownText,
                                                isDarkMode && {
                                                    color: "#94A3B8",
                                                },
                                            ]}
                                        >
                                            Gửi lại mã sau ({countdown}s)
                                        </Text>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={handleResendOtp}
                                            disabled={isLoading}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.resendBtnText}>
                                                Gửi lại mã OTP
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        )}

                        {error && (
                            <View
                                style={[
                                    styles.editorErrorBox,
                                    isDarkMode && {
                                        backgroundColor:
                                            "rgba(239, 68, 68, 0.15)",
                                        borderColor: "#7F1D1D",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="alert-circle"
                                    size={18}
                                    color={Colors.danger}
                                />
                                <Text
                                    style={[
                                        styles.editorErrorText,
                                        isDarkMode && { color: "#FCA5A5" },
                                    ]}
                                >
                                    {error}
                                </Text>
                            </View>
                        )}

                        <View style={styles.editorActions}>
                            <TouchableOpacity
                                style={[
                                    styles.editorCancel,
                                    isDarkMode && {
                                        backgroundColor: "#0F172A",
                                        borderColor: "#334155",
                                    },
                                ]}
                                onPress={() => {
                                    if (step === "OTP") {
                                        setStep("PHONE");
                                        setError(null);
                                    } else {
                                        onClose();
                                    }
                                }}
                                activeOpacity={0.8}
                                disabled={isLoading}
                            >
                                <Text
                                    style={[
                                        styles.editorCancelText,
                                        isDarkMode && { color: "#CBD5E1" },
                                    ]}
                                >
                                    {step === "OTP" ? "Quay lại" : "Hủy"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.editorSave,
                                    isLoading && { opacity: 0.75 },
                                ]}
                                onPress={step === "PHONE" ? handleSendOtp : handleConfirmOtp}
                                activeOpacity={0.85}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#FFFFFF"
                                    />
                                ) : (
                                    <>
                                        <Ionicons
                                            name={
                                                step === "PHONE"
                                                    ? "paper-plane-outline"
                                                    : "checkmark-circle-outline"
                                            }
                                            size={18}
                                            color="#FFFFFF"
                                        />
                                        <Text style={styles.editorSaveText}>
                                            {step === "PHONE"
                                                ? "Gửi mã OTP"
                                                : "Xác nhận thay đổi"}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    editorOverlay: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    editorSheet: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    editorHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },
    editorBackButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    editorTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
    },
    editorCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    editorFieldHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 14,
    },
    editorFieldIconBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: "#FFF7ED",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 2,
    },
    editorFieldLabel: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
    },
    editorFieldDesc: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 3,
        lineHeight: 17,
    },
    editorInputWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: Colors.primary,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 52,
    },
    editorInput: {
        flex: 1,
        fontSize: 15,
        color: "#0F172A",
    },
    otpInputWrap: {
        justifyContent: "center",
        alignItems: "center",
        marginTop: 6,
    },
    otpInput: {
        textAlign: "center",
        letterSpacing: 8,
        fontSize: 22,
        fontWeight: "700",
    },
    resendContainer: {
        marginTop: 12,
        alignItems: "center",
    },
    resendCountdownText: {
        fontSize: 13,
        color: "#64748B",
    },
    resendBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: Colors.primary,
    },
    editorErrorBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#FEF2F2",
        borderRadius: 12,
        padding: 10,
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    editorErrorText: {
        fontSize: 13,
        color: "#EF4444",
        flex: 1,
    },
    editorActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 20,
    },
    editorCancel: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        justifyContent: "center",
        alignItems: "center",
    },
    editorCancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#64748B",
    },
    editorSave: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    editorSaveText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});
