import React from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RegisterVerifyOtpStepProps {
    otp: string;
    setOtp: (val: string) => void;
    resendSeconds: number;
    loading: boolean;
    onResendOtp: () => void;
    onSubmit: () => void;
}

export const RegisterVerifyOtpStep: React.FC<RegisterVerifyOtpStepProps> = ({
    otp,
    setOtp,
    resendSeconds,
    loading,
    onResendOtp,
    onSubmit,
}) => {
    return (
        <View style={styles.formContainer}>
            <View style={styles.verifyContainer}>
                <View style={styles.inputContainer}>
                    <Ionicons
                        name="key-outline"
                        size={20}
                        color="#FF7A00"
                        style={styles.inputIcon}
                    />
                    <TextInput
                        style={[
                            styles.input,
                            {
                                fontSize: 20,
                                letterSpacing: 8,
                                textAlign: "center",
                                fontWeight: "700",
                            },
                        ]}
                        placeholder="• • • • • •"
                        placeholderTextColor="#CBD5E1"
                        value={otp}
                        onChangeText={(val) =>
                            setOtp(val.replace(/\D/g, "").slice(0, 6))
                        }
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                    />
                </View>

                <TouchableOpacity
                    style={styles.resendButton}
                    onPress={onResendOtp}
                    disabled={resendSeconds > 0 || loading}
                >
                    <Text
                        style={[
                            styles.resendText,
                            resendSeconds > 0 && styles.resendDisabled,
                        ]}
                    >
                        {resendSeconds > 0
                            ? `Gửi lại mã sau ${resendSeconds}s`
                            : "Gửi lại mã xác minh OTP"}
                    </Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.submitButton}
                onPress={onSubmit}
                disabled={loading}
                activeOpacity={0.88}
            >
                {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.submitButtonText}>
                        Xác nhận & Hoàn tất
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    formContainer: {
        gap: 12,
        marginBottom: 20,
    },
    verifyContainer: {
        gap: 14,
        paddingVertical: 10,
    },
    inputContainer: {
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 14,
        backgroundColor: "#FFFFFF",
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: "#0F172A",
        fontSize: 14.5,
        paddingVertical: 8,
    },
    resendButton: {
        alignItems: "center",
        marginTop: 8,
    },
    resendText: {
        color: "#EA580C",
        fontSize: 14,
        fontWeight: "600",
    },
    resendDisabled: {
        color: "#94A3B8",
    },
    submitButton: {
        backgroundColor: "#FF7A00",
        borderRadius: 26,
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        shadowColor: "#EA580C",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
        marginTop: 8,
    },
    submitButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
});
