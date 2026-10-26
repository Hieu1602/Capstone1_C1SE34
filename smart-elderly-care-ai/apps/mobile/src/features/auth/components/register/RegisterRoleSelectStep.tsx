import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";

interface RegisterRoleSelectStepProps {
    accountType: "user" | "doctor";
    onSelectRole: (role: "user" | "doctor") => void;
    onContinue: (role: "user" | "doctor") => void;
    onBack: () => void;
    onGoToLogin: () => void;
}

export const RegisterRoleSelectStep: React.FC<RegisterRoleSelectStepProps> = ({
    accountType,
    onSelectRole,
    onContinue,
    onBack,
    onGoToLogin,
}) => {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.selectRoleScreen}>
                {/* Top Bar: Nút quay lại & Badge bước */}
                <View style={styles.selectRoleTopBar}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onBack}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Quay lại"
                    >
                        <Ionicons
                            name="arrow-back"
                            size={24}
                            color="#0F172A"
                        />
                    </TouchableOpacity>


                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.selectRoleScrollContent}
                    bounces={false}
                >
                    {/* Header Tiêu đề */}
                    <View style={styles.selectRoleHeaderBox}>
                        <Text style={styles.selectRoleTitle}>
                            Bạn muốn đăng ký với vai trò nào?
                        </Text>
                        <Text style={styles.selectRoleSubtitle}>
                            Chọn vai trò phù hợp để hệ thống thiết lập giao
                            diện và công cụ tối ưu cho bạn.
                        </Text>
                    </View>

                    {/* 2 Thẻ chọn vai trò */}
                    <View style={styles.selectRoleCardsList}>
                        {/* Thẻ 1: Người thân / Gia đình */}
                        <TouchableOpacity
                            style={[
                                styles.modernRoleCard,
                                accountType === "user" &&
                                    styles.modernRoleCardActive,
                            ]}
                            activeOpacity={0.88}
                            onPress={() => onSelectRole("user")}
                        >
                            <View
                                style={[
                                    styles.modernRoleIconBox,
                                    {
                                        backgroundColor:
                                            accountType === "user"
                                                ? "#FFEDD5"
                                                : "#FFF7ED",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="people"
                                    size={26}
                                    color={Colors.primary}
                                />
                            </View>

                            <View style={styles.modernRoleTextBox}>
                                <View style={styles.modernRoleTitleRow}>
                                    <Text style={styles.modernRoleTitle}>
                                        Người thân / Gia đình
                                    </Text>
                                    {accountType === "user" && (
                                        <View style={styles.activePillTag}>
                                            <Text
                                                style={styles.activePillTagText}
                                            >
                                                Đang chọn
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.modernRoleDesc}>
                                    Theo dõi sức khỏe và nhận cảnh báo chăm sóc người thân trong gia đình.
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.modernRadioCircle,
                                    accountType === "user" &&
                                        styles.modernRadioCircleActive,
                                ]}
                            >
                                {accountType === "user" && (
                                    <Ionicons
                                        name="checkmark"
                                        size={15}
                                        color="#FFFFFF"
                                    />
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Thẻ 2: Bác sĩ gia đình */}
                        <TouchableOpacity
                            style={[
                                styles.modernRoleCard,
                                accountType === "doctor" &&
                                    styles.modernRoleCardActive,
                            ]}
                            activeOpacity={0.88}
                            onPress={() => onSelectRole("doctor")}
                        >
                            <View
                                style={[
                                    styles.modernRoleIconBox,
                                    {
                                        backgroundColor:
                                            accountType === "doctor"
                                                ? "#D1FAE5"
                                                : "#ECFDF5",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="medical"
                                    size={24}
                                    color="#059669"
                                />
                            </View>

                            <View style={styles.modernRoleTextBox}>
                                <View style={styles.modernRoleTitleRow}>
                                    <Text style={styles.modernRoleTitle}>
                                        Bác sĩ gia đình
                                    </Text>
                                    {accountType === "doctor" && (
                                        <View
                                            style={[
                                                styles.activePillTag,
                                                {
                                                    backgroundColor: "#ECFDF5",
                                                    borderColor: "#A7F3D0",
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.activePillTagText,
                                                    { color: "#059669" },
                                                ]}
                                            >
                                                Đang chọn
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.modernRoleDesc}>
                                    Theo dõi hồ sơ bệnh nhân, tư vấn và hỗ trợ chăm sóc sức khỏe từ xa.
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.modernRadioCircle,
                                    accountType === "doctor" &&
                                        styles.modernRadioCircleActive,
                                ]}
                            >
                                {accountType === "doctor" && (
                                    <Ionicons
                                        name="checkmark"
                                        size={15}
                                        color="#FFFFFF"
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Huy hiệu bảo mật y tế */}
                    <View style={styles.securityInfoBanner}>
                        <Ionicons
                            name="shield-checkmark"
                            size={18}
                            color="#0D9488"
                        />
                        <Text style={styles.securityInfoBannerText}>
                            Bảo mật dữ liệu y tế theo chuẩn Bộ Y tế & HIPAA
                        </Text>
                    </View>

                    {/* Khoảng trống đẩy nút xuống */}
                    <View style={{ flex: 1, minHeight: 48 }} />

                    {/* Nút Tiếp tục chuẩn phong cách SECA */}
                    <TouchableOpacity
                        style={styles.mobileContinueBtn}
                        activeOpacity={0.88}
                        onPress={() => onContinue(accountType)}
                    >
                        <Text style={styles.mobileContinueBtnText}>Tiếp tục</Text>
                    </TouchableOpacity>

                    {/* Dòng liên kết sang Đăng nhập */}
                    <View style={styles.mobileLoginLinkRow}>
                        <Text style={styles.mobileLoginLinkText}>
                            Đã có tài khoản?{" "}
                        </Text>
                        <TouchableOpacity onPress={onGoToLogin}>
                            <Text style={styles.mobileLoginLinkHighlight}>
                                Đăng nhập
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#FAFAFC",
    },
    selectRoleScreen: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    selectRoleTopBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
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
    selectRoleScrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 28,
    },
    selectRoleHeaderBox: {
        marginTop: 8,
        marginBottom: 24,
    },
    selectRoleTitle: {
        fontSize: 26,
        fontWeight: "800",
        color: "#0F172A",
        lineHeight: 34,
        letterSpacing: -0.4,
        marginBottom: 8,
    },
    selectRoleSubtitle: {
        fontSize: 14,
        color: "#64748B",
        lineHeight: 20,
    },
    selectRoleCardsList: {
        gap: 16,
        marginBottom: 20,
    },
    modernRoleCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    modernRoleCardActive: {
        borderColor: Colors.primary,
        backgroundColor: "#FFFBF7",
        shadowColor: Colors.primary,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    modernRoleIconBox: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    modernRoleTextBox: {
        flex: 1,
        marginRight: 10,
    },
    modernRoleTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
        gap: 8,
    },
    modernRoleTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    activePillTag: {
        backgroundColor: "#FFF7ED",
        borderWidth: 1,
        borderColor: "#FED7AA",
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    activePillTagText: {
        fontSize: 10.5,
        fontWeight: "700",
        color: Colors.primary,
    },
    modernRoleDesc: {
        fontSize: 12.5,
        color: "#64748B",
        lineHeight: 18,
    },
    modernRadioCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
    },
    modernRadioCircleActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    securityInfoBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F0FDFA",
        borderWidth: 1,
        borderColor: "#CCFBF1",
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 8,
        marginTop: 4,
    },
    securityInfoBannerText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#0F766E",
    },
    mobileContinueBtn: {
        backgroundColor: Colors.primary,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 16,
    },
    mobileContinueBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
    mobileLoginLinkRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
    },
    mobileLoginLinkText: {
        fontSize: 14,
        color: "#64748B",
    },
    mobileLoginLinkHighlight: {
        fontSize: 14,
        fontWeight: "700",
        color: Colors.primary,
    },
});

