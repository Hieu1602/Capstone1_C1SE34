// ==============================================================================
// RegisterVerifyOtpStep.tsx – Bước Xác minh mã OTP Đăng ký tài khoản
// ------------------------------------------------------------------------------
// Đồng bộ giao diện và kiến trúc với màn hình Quên mật khẩu (ForgotOtpStep):
// 1. Alert box thông báo số điện thoại đã nhận mã
// 2. Cụm 6 ô hiển thị số với 1 TextInput ngầm phủ lên trên chống race-condition
// 3. Nút Gửi lại mã xác minh bên trái
// 4. Nút bấm chính "Xác minh tiếp tục" màu cam
// ==============================================================================

import React, { useRef, useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RegisterVerifyOtpStepProps {
    phone: string;
    otp: string;
    setOtp: (val: string) => void;
    resendSeconds: number;
    loading: boolean;
    onResendOtp: () => void;
    onSubmit: () => void;
}

export const RegisterVerifyOtpStep: React.FC<RegisterVerifyOtpStepProps> = ({
    phone,
    otp,
    setOtp,
    resendSeconds,
    loading,
    onResendOtp,
    onSubmit,
}) => {
    const inputRef = useRef<any>(null);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        // Tự động focus sau khi component mount
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 150);
        return () => clearTimeout(timer);
    }, []);

    const handleContainerPress = () => {
        inputRef.current?.focus();
    };

    return (
        <View style={styles.container}>
            {/* Hộp thông báo đã gửi mã */}
            <View style={styles.feedbackInfo}>
                <Ionicons name="information-circle" size={20} color="#2563EB" />
                <Text style={styles.feedbackText}>
                    Đã gửi mã xác minh đến {phone}.
                </Text>
            </View>

            {/* Cụm 6 ô nhập mã OTP */}
            <Pressable onPress={handleContainerPress} style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((index) => {
                    const char = otp[index] || "";
                    const isActive =
                        isFocused &&
                        (otp.length === index || (index === 5 && otp.length === 6));

                    return (
                        <View
                            key={index}
                            style={[
                                styles.otpBox,
                                isActive && styles.otpBoxActive,
                            ]}
                        >
                            <Text style={styles.otpText}>{char}</Text>
                        </View>
                    );
                })}

                {/* Input ngầm hứng phím số, xóa lùi và dán mã OTP trực tiếp */}
                <TextInput
                    ref={inputRef}
                    value={otp}
                    onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, "").slice(0, 6);
                        setOtp(cleaned);
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    style={styles.hiddenInput}
                    caretHidden
                    autoFocus
                />
            </Pressable>

            {/* Nút gửi lại mã */}
            <TouchableOpacity
                style={styles.resend}
                onPress={onResendOtp}
                disabled={loading || resendSeconds > 0}
            >
                <Text
                    style={[
                        styles.resendText,
                        resendSeconds > 0 && styles.resendDisabled,
                    ]}
                >
                    {resendSeconds > 0
                        ? `Gửi lại mã sau ${resendSeconds}s`
                        : "Gửi lại mã xác minh"}
                </Text>
            </TouchableOpacity>

            {/* Nút xác nhận chính */}
            <TouchableOpacity
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={onSubmit}
                disabled={loading}
                activeOpacity={0.8}
            >
                {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                    <Text style={styles.primaryText}>Xác minh tiếp tục</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
        marginTop: 4,
    },
    feedbackInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 20,
        borderRadius: 12,
        backgroundColor: "#DBEAFE",
    },
    feedbackText: {
        flex: 1,
        color: "#1F2937",
        fontSize: 14,
        lineHeight: 20,
    },
    otpRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 0,
        marginBottom: 20,
        position: "relative",
    },
    otpBox: {
        width: 48,
        height: 64,
        borderWidth: 1,
        borderColor: "#E5E5E5",
        borderRadius: 13,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
    },
    otpBoxActive: {
        borderWidth: 2,
        borderColor: "#FF7A00",
    },
    otpText: {
        fontSize: 24,
        fontWeight: "700",
        color: "#2F2F2F",
        textAlign: "center",
    },
    hiddenInput: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity: 0.01,
        fontSize: 1,
        color: "transparent",
    },
    resend: {
        alignItems: "flex-start",
        marginBottom: 28,
    },
    resendText: {
        color: "#FF7A00",
        fontSize: 15,
        fontWeight: "500",
    },
    resendDisabled: {
        color: "#94A3B8",
    },
    primaryButton: {
        minHeight: 54,
        borderRadius: 14,
        backgroundColor: "#FF7A00",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
    },
    primaryText: {
        color: "#FFFFFF",
        fontSize: 17,
        fontWeight: "600",
    },
});
