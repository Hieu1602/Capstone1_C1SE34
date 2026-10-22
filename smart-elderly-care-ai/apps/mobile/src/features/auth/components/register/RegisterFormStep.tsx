import React from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface CchnVerifiedInfo {
    valid: boolean;
    official_name?: string;
    scope_of_practice?: string;
    status?: string;
    source?: string;
    message?: string;
}

interface RegisterFormStepProps {
    accountType: "user" | "doctor";
    fullName: string;
    setFullName: (val: string) => void;
    phone: string;
    setPhone: (val: string) => void;
    password: string;
    setPassword: (val: string) => void;
    confirmPassword: string;
    setConfirmPassword: (val: string) => void;
    showPassword: boolean;
    setShowPassword: (val: boolean) => void;
    showConfirmPassword: boolean;
    setShowConfirmPassword: (val: boolean) => void;
    cchnNumber: string;
    setCchnNumber: (val: string) => void;
    workplace: string;
    setWorkplace: (val: string) => void;
    specialty: string;
    setSpecialty: (val: string) => void;
    verifyingCchn: boolean;
    cchnVerifiedInfo: CchnVerifiedInfo | null;
    setCchnVerifiedInfo: (val: CchnVerifiedInfo | null) => void;
    loading: boolean;
    onCheckCchn: () => void;
    onSubmit: () => void;
    onChangeRole: () => void;
}

export const RegisterFormStep: React.FC<RegisterFormStepProps> = ({
    accountType,
    fullName,
    setFullName,
    phone,
    setPhone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    cchnNumber,
    setCchnNumber,
    workplace,
    setWorkplace,
    specialty,
    setSpecialty,
    verifyingCchn,
    cchnVerifiedInfo,
    setCchnVerifiedInfo,
    loading,
    onCheckCchn,
    onSubmit,
    onChangeRole,
}) => {
    return (
        <View style={styles.formContainer}>
            {/* Thanh hiển thị vai trò hiện tại kèm nút đổi vai trò */}
            <View style={styles.currentRoleBar}>
                <View
                    style={[
                        styles.currentRoleBadge,
                        {
                            backgroundColor:
                                accountType === "doctor" ? "#059669" : "#FF7A00",
                        },
                    ]}
                >
                    <Ionicons
                        name={accountType === "doctor" ? "medical" : "people"}
                        size={15}
                        color="#FFFFFF"
                    />
                    <Text style={styles.currentRoleText}>
                        {accountType === "doctor"
                            ? "Bác sĩ gia đình"
                            : "Người thân / Gia đình"}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.changeRoleBtn}
                    onPress={onChangeRole}
                    activeOpacity={0.7}
                >
                    <Text style={styles.changeRoleBtnText}>Đổi vai trò khác</Text>
                    <Ionicons
                        name="swap-horizontal"
                        size={14}
                        color="#EA580C"
                    />
                </TouchableOpacity>
            </View>

            {/* 1. Chọn Quốc gia / Mã vùng */}
            <TouchableOpacity
                style={styles.countryPickerBtn}
                activeOpacity={0.7}
                onPress={() =>
                    Alert.alert("Khu vực", "Đã chọn mặc định: Việt Nam (+84)")
                }
            >
                <View style={styles.countryInfoRow}>
                    <Ionicons
                        name="location-outline"
                        size={20}
                        color="#0F172A"
                        style={styles.countryIcon}
                    />
                    <Text style={styles.countryText}>Việt Nam (+84)</Text>
                </View>
                <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#64748B"
                />
            </TouchableOpacity>

            {/* 2. Họ và tên */}
            <View style={styles.inputContainer}>
                <Ionicons
                    name="person-outline"
                    size={20}
                    color="#94A3B8"
                    style={styles.inputIcon}
                />
                <TextInput
                    style={styles.input}
                    placeholder={
                        accountType === "doctor"
                            ? "Họ và tên Bác sĩ (trên CCHN)"
                            : "Họ và tên của bạn"
                    }
                    placeholderTextColor="#94A3B8"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                />
            </View>

            {/* CÁC TRƯỜNG DÀNH RIÊNG CHO ROLE: BÁC SĨ GIA ĐÌNH */}
            {accountType === "doctor" && (
                <View style={styles.doctorCardSection}>
                    <View style={styles.doctorHeaderRow}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Ionicons
                                name="ribbon-outline"
                                size={18}
                                color="#059669"
                                style={{ marginRight: 6 }}
                            />
                            <Text style={styles.doctorSectionTitle}>
                                Thông tin Chứng chỉ hành nghề y tế
                            </Text>
                        </View>
                    </View>

                    {/* Số CCHN & Nút Tra cứu */}
                    <View style={styles.cchnInputRow}>
                        <View
                            style={[
                                styles.inputContainer,
                                { flex: 1, marginBottom: 0 },
                            ]}
                        >
                            <Ionicons
                                name="document-text-outline"
                                size={20}
                                color="#059669"
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Số CCHN (VD: 001234/HCM-CCHN)"
                                placeholderTextColor="#94A3B8"
                                value={cchnNumber}
                                onChangeText={(val) => {
                                    setCchnNumber(val);
                                    setCchnVerifiedInfo(null);
                                }}
                                autoCapitalize="characters"
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.verifyCchnBtn}
                            onPress={onCheckCchn}
                            disabled={verifyingCchn}
                            activeOpacity={0.8}
                        >
                            {verifyingCchn ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#FFFFFF"
                                />
                            ) : (
                                <Text style={styles.verifyCchnBtnText}>Tra cứu</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Thẻ hiển thị kết quả xác minh CCHN */}
                    {cchnVerifiedInfo && (
                        <View
                            style={[
                                styles.cchnBadge,
                                cchnVerifiedInfo.valid
                                    ? styles.cchnBadgeSuccess
                                    : styles.cchnBadgeError,
                            ]}
                        >
                            <Ionicons
                                name={
                                    cchnVerifiedInfo.valid
                                        ? "checkmark-circle"
                                        : "alert-circle"
                                }
                                size={20}
                                color={
                                    cchnVerifiedInfo.valid ? "#059669" : "#DC2626"
                                }
                            />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                                <Text
                                    style={[
                                        styles.cchnBadgeTitle,
                                        {
                                            color: cchnVerifiedInfo.valid
                                                ? "#065F46"
                                                : "#991B1B",
                                        },
                                    ]}
                                >
                                    {cchnVerifiedInfo.valid
                                        ? "CCHN Hợp lệ (Sở Y tế TP.HCM)"
                                        : "Không đủ điều kiện"}
                                </Text>
                                {cchnVerifiedInfo.valid ? (
                                    <>
                                        <Text style={styles.cchnBadgeDetail}>
                                            • Người sở hữu:{" "}
                                            {cchnVerifiedInfo.official_name || fullName}
                                        </Text>
                                        <Text style={styles.cchnBadgeDetail}>
                                            • Phạm vi:{" "}
                                            {cchnVerifiedInfo.scope_of_practice ||
                                                "Khám chữa bệnh đa khoa"}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={styles.cchnBadgeDetail}>
                                        {cchnVerifiedInfo.message}
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Nơi công tác */}
                    <View style={styles.inputContainer}>
                        <Ionicons
                            name="business-outline"
                            size={20}
                            color="#94A3B8"
                            style={styles.inputIcon}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Nơi công tác (Bệnh viện / Phòng khám)"
                            placeholderTextColor="#94A3B8"
                            value={workplace}
                            onChangeText={setWorkplace}
                        />
                    </View>

                    {/* Chuyên khoa */}
                    <View style={styles.inputContainer}>
                        <Ionicons
                            name="fitness-outline"
                            size={20}
                            color="#94A3B8"
                            style={styles.inputIcon}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Chuyên khoa (Lão khoa, Tim mạch, Đa khoa...)"
                            placeholderTextColor="#94A3B8"
                            value={specialty}
                            onChangeText={setSpecialty}
                        />
                    </View>
                </View>
            )}

            {/* 3. Số điện thoại nhận OTP */}
            <View style={styles.inputContainer}>
                <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color="#94A3B8"
                    style={styles.inputIcon}
                />
                <Text style={styles.prefixText}>+84 </Text>
                <TextInput
                    style={styles.input}
                    placeholder="Số điện thoại nhận OTP"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                />
            </View>

            {/* 4. Mật khẩu */}
            <View style={styles.inputContainer}>
                <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#94A3B8"
                    style={styles.inputIcon}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#94A3B8"
                    />
                </TouchableOpacity>
            </View>

            {/* 5. Xác nhận lại mật khẩu */}
            <View style={styles.inputContainer}>
                <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#94A3B8"
                    style={styles.inputIcon}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Xác nhận lại mật khẩu"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                    <Ionicons
                        name={
                            showConfirmPassword
                                ? "eye-outline"
                                : "eye-off-outline"
                        }
                        size={20}
                        color="#94A3B8"
                    />
                </TouchableOpacity>
            </View>

            {/* Nút bấm Tiếp tục (Màu cam) */}
            <TouchableOpacity
                style={styles.submitButton}
                onPress={onSubmit}
                disabled={loading}
                activeOpacity={0.88}
            >
                {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.submitButtonText}>Tiếp tục</Text>
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
    currentRoleBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 4,
    },
    currentRoleBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 10,
        gap: 6,
    },
    currentRoleText: {
        color: "#FFFFFF",
        fontSize: 12.5,
        fontWeight: "700",
    },
    changeRoleBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    changeRoleBtnText: {
        color: "#EA580C",
        fontSize: 12.5,
        fontWeight: "600",
    },
    countryPickerBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: "#FFFFFF",
    },
    countryInfoRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    countryIcon: {
        marginRight: 10,
    },
    countryText: {
        fontSize: 14.5,
        fontWeight: "500",
        color: "#0F172A",
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
    prefixText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#0F172A",
        marginRight: 4,
    },
    input: {
        flex: 1,
        color: "#0F172A",
        fontSize: 14.5,
        paddingVertical: 8,
    },
    doctorCardSection: {
        backgroundColor: "#F0FDF4",
        borderWidth: 1,
        borderColor: "#DCFCE7",
        borderRadius: 14,
        padding: 12,
        gap: 10,
    },
    doctorHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    doctorSectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#059669",
    },
    cchnInputRow: {
        flexDirection: "row",
        gap: 8,
    },
    verifyCchnBtn: {
        backgroundColor: "#059669",
        borderRadius: 12,
        paddingHorizontal: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    verifyCchnBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },
    cchnBadge: {
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    cchnBadgeSuccess: {
        backgroundColor: "#ECFDF5",
        borderColor: "#A7F3D0",
    },
    cchnBadgeError: {
        backgroundColor: "#FEF2F2",
        borderColor: "#FECACA",
    },
    cchnBadgeTitle: {
        fontSize: 12.5,
        fontWeight: "700",
        marginBottom: 2,
    },
    cchnBadgeDetail: {
        fontSize: 12,
        color: "#374151",
        lineHeight: 16,
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

