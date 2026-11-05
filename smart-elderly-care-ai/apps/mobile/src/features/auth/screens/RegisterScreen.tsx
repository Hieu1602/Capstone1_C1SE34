// ============================================================================
// MÀN HÌNH ĐĂNG KÝ TÀI KHOẢN (REGISTER SCREEN)
// Dự án: Smart Elderly Care AI (SECA)
// Thiết kế: Chuẩn UX/UI Healthtech hiện đại, bố cục cân đối, thuận mắt người dùng
// ============================================================================

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authApi } from "../../../services/api";
import {
    RegisterRoleSelectStep,
    RegisterFormStep,
    RegisterVerifyOtpStep,
    CchnVerifiedInfo,
} from "../components/register";
import { validateFullName } from "../utils/nameValidation";
import { useAuthStore } from "../../../store/useAuthStore";
import { useDeviceStore } from "../../../store/useDeviceStore";
import { useHealthStore } from "../../../store/useHealthStore";
import { usePatientStore } from "../../../store/usePatientStore";
import { useAlertStore } from "../../../store/useAlertStore";

export default function RegisterScreen({ route, navigation }: any) {
    // Trạng thái màn hình:
    // - 'select_role': Màn hình chọn vai trò trực quan (Người thân vs Bác sĩ)
    // - 'form': Màn hình form điền thông tin tương ứng của vai trò đã chọn
    // - 'verify': Màn hình xác thực OTP SMS
    const initialRole: "user" | "doctor" =
        route?.params?.role === "doctor" ? "doctor" : "user";
    const [step, setStep] = useState<"select_role" | "form" | "verify">(
        route?.params?.role ? "form" : "select_role",
    );
    const [accountType, setAccountType] = useState<"user" | "doctor">(
        initialRole,
    );

    // Form states
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Doctor-specific states
    const [cchnNumber, setCchnNumber] = useState("");
    const [workplace, setWorkplace] = useState("");
    const [specialty, setSpecialty] = useState("");
    const [verifyingCchn, setVerifyingCchn] = useState(false);
    const [cchnVerifiedInfo, setCchnVerifiedInfo] =
        useState<CchnVerifiedInfo | null>(null);

    // Password visibility
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // OTP & Loading states
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendSeconds, setResendSeconds] = useState(0);

    useEffect(() => {
        if (resendSeconds <= 0) return undefined;
        const timer = setInterval(() => {
            setResendSeconds((prev) => Math.max(prev - 1, 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendSeconds]);

    const startResendCountdown = () => setResendSeconds(60);

    const handleChooseRole = (role: "user" | "doctor") => {
        setAccountType(role);
        setStep("form");
    };

    const handleCheckCchn = async () => {
        const cleanCchn = cchnNumber.trim();
        const cleanName = fullName.trim();

        if (!cleanName) {
            Alert.alert(
                "Chưa nhập họ tên",
                "Vui lòng nhập Họ và tên Bác sĩ trước để đối soát với thông tin CCHN.",
            );
            return;
        }
        if (!cleanCchn) {
            Alert.alert(
                "Chưa nhập CCHN",
                "Vui lòng nhập Số Chứng chỉ hành nghề y tế (VD: 001234/HCM-CCHN).",
            );
            return;
        }

        setVerifyingCchn(true);
        setCchnVerifiedInfo(null);
        try {
            const response = await authApi.verifyCchn(cleanCchn, cleanName);
            const data = response.data;
            setCchnVerifiedInfo(data);

            if (data.scope_of_practice && !specialty) {
                setSpecialty(data.scope_of_practice);
            }
            if (data.workplace && !workplace) {
                setWorkplace(data.workplace);
            }

            Alert.alert(
                "Xác minh thành công",
                `Bác sĩ: ${data.official_name || cleanName}\nPhạm vi: ${data.scope_of_practice || "Khám chữa bệnh"}\nTrạng thái: ${data.status || "Đang hoạt động"}`,
            );
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.detail ||
                "Không thể xác minh CCHN trên Cổng Sở Y tế.";
            setCchnVerifiedInfo({ valid: false, message: errorMsg });
            Alert.alert("Xác minh thất bại", errorMsg);
        } finally {
            setVerifyingCchn(false);
        }
    };

    const handleRegister = async () => {
        setErrorMessage(null);
        const normalizedPhone = phone.trim().replace(/\s+/g, "");

        if (
            !fullName.trim() ||
            !normalizedPhone ||
            !password ||
            !confirmPassword
        ) {
            const msg = "Vui lòng điền đầy đủ họ tên, số điện thoại và mật khẩu.";
            setErrorMessage(msg);
            Alert.alert("Thiếu thông tin", msg);
            return;
        }

        const nameValidation = validateFullName(fullName);
        if (!nameValidation.isValid) {
            const msg = nameValidation.message || "Họ và tên không hợp lệ.";
            setErrorMessage(msg);
            Alert.alert("Họ và tên không hợp lệ", msg);
            return;
        }

        if (accountType === "doctor" && !cchnNumber.trim()) {
            const msg = "Vui lòng nhập Số Chứng chỉ hành nghề y khoa của Bác sĩ.";
            setErrorMessage(msg);
            Alert.alert("Thiếu CCHN", msg);
            return;
        }

        if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
            const msg = "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.";
            setErrorMessage(msg);
            Alert.alert("Lỗi", msg);
            return;
        }

        if (password.length < 8 || password.length > 16) {
            const msg = "Mật khẩu chưa đủ mạnh: Độ dài phải từ 8 đến 16 ký tự.";
            setErrorMessage(msg);
            Alert.alert("Mật khẩu chưa đủ mạnh", msg);
            return;
        }

        if (
            !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/.test(
                password,
            )
        ) {
            const msg =
                "Mật khẩu chưa đủ mạnh: Cần có cả chữ hoa, chữ thường, số và ký hiệu đặc biệt (ví dụ: Care@123).";
            setErrorMessage(msg);
            Alert.alert("Mật khẩu chưa đủ mạnh", msg);
            return;
        }

        if (password !== confirmPassword) {
            const msg = "Mật khẩu và xác nhận lại mật khẩu không trùng khớp.";
            setErrorMessage(msg);
            Alert.alert("Mật khẩu không khớp", msg);
            return;
        }

        const formattedPhone = normalizedPhone.startsWith("0")
            ? `+84${normalizedPhone.slice(1)}`
            : normalizedPhone.startsWith("+")
              ? normalizedPhone
              : `+84${normalizedPhone}`;

        setLoading(true);
        try {
            if (accountType === "doctor" && !cchnVerifiedInfo?.valid) {
                try {
                    const verifyRes = await authApi.verifyCchn(
                        cchnNumber.trim(),
                        fullName.trim(),
                    );
                    setCchnVerifiedInfo(verifyRes.data);
                } catch (_) {}
            }

            await authApi.requestOtp(formattedPhone);
            setStep("verify");
            startResendCountdown();
            Alert.alert(
                "Đã gửi mã OTP",
                `Mã xác minh đã được gửi tới số điện thoại ${formattedPhone}.`,
            );
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.detail ||
                "Không thể gửi mã xác minh. Vui lòng thử lại.";
            setErrorMessage(errorMsg);
            Alert.alert("Không thể tiếp tục", errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        if (resendSeconds > 0) return;

        const normalizedPhone = phone.trim().replace(/\s+/g, "");
        if (!normalizedPhone) {
            Alert.alert("Thiếu thông tin", "Vui lòng nhập số điện thoại trước.");
            return;
        }

        const formattedPhone = normalizedPhone.startsWith("0")
            ? `+84${normalizedPhone.slice(1)}`
            : normalizedPhone.startsWith("+")
              ? normalizedPhone
              : `+84${normalizedPhone}`;

        setLoading(true);
        try {
            await authApi.requestOtp(formattedPhone);
            startResendCountdown();
            Alert.alert(
                "Đã gửi lại mã",
                "Mã xác minh mới đã được gửi. Vui lòng kiểm tra tin nhắn.",
            );
        } catch (error: any) {
            Alert.alert(
                "Không gửi được mã",
                error.response?.data?.detail ||
                    "Không thể kết nối đến máy chủ SMS.",
            );
        } finally {
            setLoading(false);
        }
    };

    const completeRegistration = async () => {
        const normalizedPhone = phone.trim().replace(/\s+/g, "");

        if (otp.length !== 6) {
            Alert.alert(
                "Mã không hợp lệ",
                "Vui lòng nhập đủ 6 chữ số mã xác thực OTP.",
            );
            return;
        }

        const formattedPhone = normalizedPhone.startsWith("0")
            ? `+84${normalizedPhone.slice(1)}`
            : normalizedPhone.startsWith("+")
              ? normalizedPhone
              : `+84${normalizedPhone}`;

        setLoading(true);
        try {
            await authApi.verifyOtp(formattedPhone, otp);

            if (accountType === "doctor") {
                await authApi.registerDoctor({
                    phone: formattedPhone,
                    full_name: fullName.trim(),
                    password,
                    role: "doctor",
                    otp_code: otp,
                    cchn_number: cchnNumber.trim(),
                    workplace: workplace.trim() || undefined,
                    specialty: specialty.trim() || undefined,
                });

                navigation.replace("Login");
                Alert.alert(
                    "Đăng ký Bác sĩ thành công!",
                    "Tài khoản Bác sĩ gia đình đã được khởi tạo. Bạn có thể đăng nhập để bắt đầu kết nối bệnh nhân.",
                );
            } else {
                await authApi.register({
                    phone: formattedPhone,
                    full_name: fullName.trim() || "Thành viên",
                    password,
                    role: "member",
                    otp_code: otp,
                });

                try {
                    useAuthStore.getState().logout();
                    useDeviceStore.getState().resetDeviceStore?.();
                    usePatientStore.getState().resetPatientStore?.();
                    useHealthStore.getState().resetHealthStore?.();
                    useAlertStore.getState().resetAlertStore?.();
                } catch {}

                navigation.replace("Login");
                Alert.alert(
                    "Đăng ký thành công!",
                    "Tài khoản của bạn đã được khởi tạo thành công. Vui lòng đăng nhập để bắt đầu.",
                );
            }
        } catch (error: any) {
            Alert.alert(
                "Đăng ký thất bại",
                error.response?.data?.detail ||
                    "Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (step === "verify") {
            setStep("form");
            return;
        }
        if (step === "form") {
            setStep("select_role");
            return;
        }
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate("Login");
        }
    };

    // BƯỚC 1: MÀN HÌNH CHỌN VAI TRÒ
    if (step === "select_role") {
        return (
            <RegisterRoleSelectStep
                accountType={accountType}
                onSelectRole={setAccountType}
                onContinue={handleChooseRole}
                onBack={handleBack}
                onGoToLogin={() => navigation.navigate("Login")}
            />
        );
    }

    // BƯỚC 2 & 3: FORM ĐĂNG KÝ VÀ XÁC THỰC OTP
    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header & Nút Quay lại */}
                    <View style={styles.headerSection}>
                        <TouchableOpacity
                            style={styles.backButton}
                            accessibilityRole="button"
                            accessibilityLabel="Quay lại"
                            onPress={handleBack}
                        >
                            <Ionicons
                                name="arrow-back"
                                size={step === "verify" ? 28 : 24}
                                color="#2F2F2F"
                            />
                        </TouchableOpacity>

                        <Text
                            style={[
                                styles.welcomeTitle,
                                step === "verify" && styles.verifyTitle,
                            ]}
                        >
                            {step === "verify"
                                ? "Xác minh số điện thoại."
                                : accountType === "doctor"
                                  ? "Đăng ký Bác sĩ gia đình"
                                  : "Đăng ký tài khoản"}
                        </Text>

                        <Text
                            style={[
                                styles.subtitle,
                                step === "verify" && styles.verifySubtitle,
                            ]}
                        >
                            {step === "verify"
                                ? `Nhập mã xác minh gồm 6 chữ số được gửi tới số điện thoại ${phone}.`
                                : accountType === "doctor"
                                  ? "Dành cho Bác sĩ & Chuyên gia y tế đồng hành chăm sóc sức khỏe người cao tuổi."
                                  : "Hệ thống Smart Elderly Care AI kết nối người cao tuổi, gia đình và bác sĩ chăm sóc chuyên khoa."}
                        </Text>
                    </View>

                    {/* MÀN HÌNH 2: FORM ĐĂNG KÝ */}
                    {step === "form" && (
                        <RegisterFormStep
                            accountType={accountType}
                            fullName={fullName}
                            setFullName={(val) => {
                                setFullName(val);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            phone={phone}
                            setPhone={(val) => {
                                setPhone(val);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            password={password}
                            setPassword={(val) => {
                                setPassword(val);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            confirmPassword={confirmPassword}
                            setConfirmPassword={(val) => {
                                setConfirmPassword(val);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            showPassword={showPassword}
                            setShowPassword={setShowPassword}
                            showConfirmPassword={showConfirmPassword}
                            setShowConfirmPassword={setShowConfirmPassword}
                            cchnNumber={cchnNumber}
                            setCchnNumber={(val) => {
                                setCchnNumber(val);
                                if (errorMessage) setErrorMessage(null);
                            }}
                            workplace={workplace}
                            setWorkplace={setWorkplace}
                            specialty={specialty}
                            setSpecialty={setSpecialty}
                            verifyingCchn={verifyingCchn}
                            cchnVerifiedInfo={cchnVerifiedInfo}
                            setCchnVerifiedInfo={setCchnVerifiedInfo}
                            loading={loading}
                            errorMessage={errorMessage}
                            onCheckCchn={handleCheckCchn}
                            onSubmit={handleRegister}
                            onChangeRole={() => setStep("select_role")}
                        />
                    )}

                    {/* MÀN HÌNH 3: XÁC MINH OTP */}
                    {step === "verify" && (
                        <RegisterVerifyOtpStep
                            phone={phone}
                            otp={otp}
                            setOtp={setOtp}
                            resendSeconds={resendSeconds}
                            loading={loading}
                            onResendOtp={resendOtp}
                            onSubmit={completeRegistration}
                        />
                    )}

                    {/* Footer chuyển sang Đăng nhập */}
                    <View style={styles.footerContainer}>
                        <TouchableOpacity
                            style={styles.loginLink}
                            onPress={() => navigation.navigate("Login")}
                            activeOpacity={0.7}
                        >
                            {step === "verify" ? (
                                <Text
                                    style={[
                                        styles.loginHighlight,
                                        styles.verifyLoginText,
                                    ]}
                                >
                                    Quay lại màn hình đăng nhập
                                </Text>
                            ) : (
                                <Text style={styles.loginText}>
                                    Tôi đã có tài khoản.{" "}
                                    <Text style={styles.loginHighlight}>
                                        Đăng nhập
                                    </Text>
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#FAFAFC",
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 22,
        paddingTop: Platform.OS === "android" ? 24 : 12,
        paddingBottom: 36,
    },
    headerSection: {
        marginBottom: 20,
    },
    backButton: {
        height: 40,
        width: 40,
        justifyContent: "center",
        alignItems: "flex-start",
        marginBottom: 8,
    },
    stepBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: "#FFF7ED",
        borderWidth: 1,
        borderColor: "#FED7AA",
        borderRadius: 20,
        paddingVertical: 4,
        paddingHorizontal: 10,
        marginBottom: 10,
        gap: 6,
    },
    stepBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#FF7A00",
    },
    stepBadgeText: {
        fontSize: 11,
        fontWeight: "800",
        color: "#EA580C",
        letterSpacing: 0.5,
    },
    welcomeTitle: {
        color: "#0F172A",
        fontSize: 25,
        fontWeight: "800",
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    subtitle: {
        color: "#64748B",
        fontSize: 13.5,
        lineHeight: 20,
    },
    footerContainer: {
        marginTop: "auto",
        paddingTop: 20,
    },
    loginLink: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
    },
    loginText: {
        color: "#64748B",
        fontSize: 14,
    },
    loginHighlight: {
        color: "#FF7A00",
        fontWeight: "700",
    },
    verifyTitle: {
        fontSize: 28,
        fontWeight: "800",
        color: "#2F2F2F",
        marginBottom: 10,
    },
    verifySubtitle: {
        fontSize: 16,
        lineHeight: 23,
        color: "#4B5563",
        maxWidth: 350,
    },
    verifyLoginText: {
        fontSize: 16,
        fontWeight: "500",
    },
});
