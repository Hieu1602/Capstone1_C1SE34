import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    SafeAreaView,
    Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";

interface SecurityCenterModalProps {
    visible: boolean;
    isDarkMode: boolean;
    onClose: () => void;
    onChangePasswordPress: () => void;
}

export const SecurityCenterModal: React.FC<SecurityCenterModalProps> = ({
    visible,
    isDarkMode,
    onClose,
    onChangePasswordPress,
}) => {
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [securityDetail, setSecurityDetail] = useState<
        "twoFactor" | "devices" | "logins" | "question" | null
    >(null);
    const [selectedSecurityQuestion, setSelectedSecurityQuestion] = useState("");

    const openSecurityDetail = (
        type: "twoFactor" | "devices" | "logins" | "question",
    ) => {
        setSecurityDetail(type);
    };

    return (
        <>
            {/* SUB-MODAL: CHI TIẾT BẢO MẬT (2FA, DEVICES, LOGINS, FAQ) */}
            <Modal
                visible={securityDetail !== null}
                animationType="slide"
                onRequestClose={() => setSecurityDetail(null)}
            >
                <SafeAreaView
                    style={[
                        styles.securityDetailScreen,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    edges={["top"]}
                >
                    <View
                        style={[
                            styles.securityDetailHeader,
                            isDarkMode && {
                                backgroundColor: "#0F172A",
                                borderBottomColor: "#1E293B",
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.securityNavBackButton,
                                isDarkMode && { backgroundColor: "#1E293B" },
                            ]}
                            onPress={() => setSecurityDetail(null)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={22}
                                color={isDarkMode ? "#F8FAFC" : "#0F172A"}
                            />
                        </TouchableOpacity>
                        <Text
                            style={[
                                styles.securityDetailTitle,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                            numberOfLines={1}
                        >
                            {securityDetail === "twoFactor"
                                ? "Xác minh hai bước"
                                : securityDetail === "devices"
                                  ? "Quản lý đầu cuối"
                                  : securityDetail === "logins"
                                    ? "Nhật ký đăng nhập"
                                    : "Hướng dẫn bảo mật"}
                        </Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.securityDetailContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {securityDetail === "twoFactor" && (
                            <View
                                style={[
                                    styles.securityDetailCard,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                            >
                                <View style={styles.securityDetailHeroBadge}>
                                    <View
                                        style={[
                                            styles.securityTileIconSquircle,
                                            {
                                                backgroundColor: "#ECFDF5",
                                                width: 56,
                                                height: 56,
                                                borderRadius: 18,
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name="shield-checkmark"
                                            size={32}
                                            color="#059669"
                                        />
                                    </View>
                                </View>
                                <View style={styles.securityDetailRowHeader}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text
                                            style={[
                                                styles.securityDetailCardTitle,
                                                isDarkMode && {
                                                    color: "#F8FAFC",
                                                },
                                            ]}
                                        >
                                            Xác thực qua mã SMS
                                        </Text>
                                        <Text
                                            style={[
                                                styles.securityDetailSubText,
                                                isDarkMode && {
                                                    color: "#94A3B8",
                                                },
                                            ]}
                                        >
                                            {twoFactorEnabled
                                                ? "Trạng thái: Đang bảo vệ"
                                                : "Trạng thái: Chưa kích hoạt"}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={twoFactorEnabled}
                                        onValueChange={setTwoFactorEnabled}
                                        trackColor={{
                                            false: "#CBD5E1",
                                            true: "#7DD3FC",
                                        }}
                                        thumbColor={
                                            twoFactorEnabled
                                                ? "#0284C7"
                                                : "#FFFFFF"
                                        }
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityDetailDescription,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Để giữ an toàn tuyệt đối cho tài khoản giám
                                    sát người cao tuổi, hệ thống sẽ yêu cầu
                                    nhập mã OTP gửi về tin nhắn SMS khi bạn đăng
                                    nhập trên thiết bị mới hoặc thực hiện thao
                                    tác nhạy cảm.
                                </Text>
                                <View
                                    style={[
                                        styles.securityInfoBanner,
                                        isDarkMode && {
                                            backgroundColor:
                                                "rgba(2,132,199,0.12)",
                                            borderColor: "rgba(2,132,199,0.3)",
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="information-circle"
                                        size={22}
                                        color="#0284C7"
                                    />
                                    <Text
                                        style={[
                                            styles.securityInfoText,
                                            isDarkMode && { color: "#38BDF8" },
                                        ]}
                                    >
                                        {twoFactorEnabled
                                            ? "Tính năng xác thực 2 lớp đang kích hoạt trên số điện thoại đăng ký của bạn."
                                            : "Khuyến khích bật xác thực 2 bước để phòng ngừa truy cập trái phép."}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {securityDetail === "devices" && (
                            <View
                                style={[
                                    styles.securityDetailCard,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.securityDetailCardTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Thiết bị đáng tin cậy: 1
                                </Text>
                                <View
                                    style={[
                                        styles.securityDeviceItem,
                                        isDarkMode && {
                                            backgroundColor: "#0F172A",
                                            borderColor: "#334155",
                                        },
                                    ]}
                                >
                                    <View style={styles.securityDeviceIcon}>
                                        <Ionicons
                                            name="phone-portrait"
                                            size={22}
                                            color="#0284C7"
                                        />
                                    </View>
                                    <View style={styles.securityDeviceCopy}>
                                        <Text
                                            style={[
                                                styles.securityDeviceName,
                                                isDarkMode && {
                                                    color: "#F8FAFC",
                                                },
                                            ]}
                                        >
                                            Thiết bị này
                                        </Text>
                                        <Text
                                            style={[
                                                styles.securityDeviceMeta,
                                                isDarkMode && {
                                                    color: "#94A3B8",
                                                },
                                            ]}
                                        >
                                            Android App · Đang hoạt động
                                        </Text>
                                        <Text
                                            style={[
                                                styles.securityDeviceMeta,
                                                isDarkMode && {
                                                    color: "#94A3B8",
                                                },
                                            ]}
                                        >
                                            Đăng nhập gần nhất: Hôm nay 20:41
                                        </Text>
                                    </View>
                                    <View style={styles.securityActiveBadge}>
                                        <Text
                                            style={styles.securityActiveBadgeText}
                                        >
                                            Hiện tại
                                        </Text>
                                    </View>
                                </View>
                                <Text
                                    style={[
                                        styles.securityDetailDescription,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Nếu bạn thấy bất kỳ thiết bị lạ nào đăng nhập
                                    vào hệ thống, hãy đổi mật khẩu ngay lập tức.
                                    Các thiết bị không hoạt động trong 3 tháng sẽ
                                    tự động bị ngắt kết nối.
                                </Text>
                            </View>
                        )}

                        {securityDetail === "logins" && (
                            <View
                                style={[
                                    styles.securityDetailCard,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.securityDetailCardTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Lịch sử đăng nhập gần đây
                                </Text>
                                {[
                                    "Hôm nay · 20:41",
                                    "09-14 · 21:20",
                                    "09-14 · 21:08",
                                    "09-12 · 00:07",
                                ].map((loginItem, idx) => (
                                    <View
                                        key={loginItem}
                                        style={[
                                            styles.securityLoginItem,
                                            isDarkMode && {
                                                borderBottomColor: "#334155",
                                            },
                                            idx === 3 && {
                                                borderBottomWidth: 0,
                                            },
                                        ]}
                                    >
                                        <View style={styles.securityTimelineDot} />
                                        <View style={styles.securityDeviceCopy}>
                                            <Text
                                                style={[
                                                    styles.securityLoginName,
                                                    isDarkMode && {
                                                        color: "#F8FAFC",
                                                    },
                                                ]}
                                            >
                                                Đăng nhập ứng dụng
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.securityDeviceMeta,
                                                    isDarkMode && {
                                                        color: "#94A3B8",
                                                    },
                                                ]}
                                            >
                                                Thiết bị chính · Thành công
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.securityLoginTime,
                                                isDarkMode && {
                                                    color: "#94A3B8",
                                                },
                                            ]}
                                        >
                                            {loginItem}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {securityDetail === "question" && (
                            <View
                                style={[
                                    styles.securityDetailCard,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.securityTileIconSquircle,
                                        {
                                            backgroundColor: "#EFF6FF",
                                            marginBottom: 16,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="help-circle"
                                        size={24}
                                        color="#0284C7"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityQuestionDetailTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    {selectedSecurityQuestion}
                                </Text>
                                <View
                                    style={[
                                        styles.securityFaqDivider,
                                        { marginVertical: 14, marginLeft: 0 },
                                        isDarkMode && {
                                            backgroundColor: "#334155",
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.securityQuestionDetailDescription,
                                        isDarkMode && { color: "#CBD5E1" },
                                    ]}
                                >
                                    {selectedSecurityQuestion ===
                                    "Mật khẩu mã hóa thiết bị là gì?"
                                        ? "Mật khẩu mã hóa thiết bị là một mật khẩu đối xứng được sử dụng để mã hóa luồng video camera và dữ liệu cảm biến của thiết bị, với giá trị mặc định theo mã xác thực thiết bị. Bạn nên thay đổi mật khẩu mặc định thành một mật khẩu an toàn sau khi liên kết thiết bị lần đầu tiên. Mật khẩu mã hóa là chìa khóa bảo mật được cung cấp bởi Smart Elderly Care AI. Hệ thống hoàn toàn không ghi lại hoặc lưu trữ mật khẩu mã hóa trên máy chủ trung tâm. Mật khẩu chỉ được mã hóa lưu trữ trực tiếp trên thiết bị giám sát và ứng dụng di động của bạn. Đội ngũ kỹ thuật Smart Elderly Care AI không có khả năng lấy lại, đặt lại hoặc khôi phục mật khẩu mã hóa nhằm đảm bảo quyền riêng tư tuyệt đối cho gia đình bạn."
                                        : selectedSecurityQuestion ===
                                            "Có ràng buộc một thiết bị an toàn không?"
                                          ? "Để kết nối một thiết bị vào hệ thống Smart Elderly Care AI, ba điều kiện sau phải được đáp ứng đồng thời:\n\n1. Biết mã định danh (Serial) và mã xác thực an toàn của thiết bị;\n\n2. Thiết bị giám sát đang trực tuyến;\n\n3. Thiết bị chưa bị ràng buộc bởi một tài khoản quản trị khác;\n\nNếu một thiết bị đã được kết nối bởi chủ hộ gia đình, người khác tuyệt đối không thể kết nối hoặc xem trộm ngay cả khi biết mã serial. Chỉ có tài khoản chủ hộ đã liên kết thiết bị mới có quyền chia sẻ hoặc hủy liên kết. Smart Elderly Care AI khuyến nghị bạn cấu hình bảo mật thiết bị ngay sau khi hoàn tất kết nối mạng."
                                          : selectedSecurityQuestion ===
                                              "Việc sử dụng mã xác minh qua tin nhắn SMS"
                                            ? "Mã xác minh SMS (OTP) là lớp bảo mật hai bước nâng cao được cung cấp bởi Smart Elderly Care AI, vượt trội hơn so với việc chỉ dùng mật khẩu thông thường. Khi người dùng thực hiện các thao tác nhạy cảm (như đăng nhập trên thiết bị mới, thay đổi cấu hình cảnh báo SOS khẩn cấp, chia sẻ quyền giám sát, v.v.), hệ thống sẽ gửi mã SMS OTP để xác thực danh tính chính chủ. Điều này giúp ngăn chặn tối đa nguy cơ tài khoản bị xâm nhập trái phép. Hãy lưu ý không bao giờ tiết lộ mã OTP cho bất kỳ ai."
                                            : "Hệ thống Smart Elderly Care AI sử dụng nhiều lớp bảo vệ tài khoản, xác minh thiết bị và mã xác thực để hạn chế truy cập trái phép. Bạn nên bật xác minh hai bước và thường xuyên kiểm tra lịch sử đăng nhập."}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* MAIN SECURITY CENTER MODAL */}
            <Modal
                visible={visible}
                animationType="slide"
                onRequestClose={onClose}
            >
                <SafeAreaView
                    style={[
                        styles.securityScreen,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    edges={["top"]}
                >
                    {/* Header Bar */}
                    <View
                        style={[
                            styles.securityTopNav,
                            isDarkMode && {
                                backgroundColor: "#0F172A",
                                borderBottomColor: "#1E293B",
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.securityNavBackButton,
                                isDarkMode && { backgroundColor: "#1E293B" },
                            ]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={22}
                                color={isDarkMode ? "#F8FAFC" : "#0F172A"}
                            />
                        </TouchableOpacity>
                        <View style={styles.securityNavTitleBox}>
                            <Text
                                style={[
                                    styles.securityNavTitle,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Trung tâm bảo mật
                            </Text>
                            <Text style={styles.securityNavSubTitle}>
                                Smart Elderly Care AI
                            </Text>
                        </View>
                        <View style={styles.securityStatusPill}>
                            <View style={styles.securityStatusDot} />
                            <Text style={styles.securityStatusPillText}>
                                An toàn
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.securityScrollContent}
                    >
                        {/* HERO SCORE CARD */}
                        <View
                            style={[
                                styles.securityHeroModern,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                        >
                            <View style={styles.securityHeroLeft}>
                                <View style={styles.securityBadge}>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={13}
                                        color="#0284C7"
                                    />
                                    <Text style={styles.securityBadgeText}>
                                        MỨC ĐỘ BẢO VỆ: TỐT
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.securityHeroScoreTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    96
                                    <Text style={styles.securityHeroScoreSub}>
                                        /100
                                    </Text>
                                </Text>
                                <Text
                                    style={[
                                        styles.securityHeroDesc,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Hệ thống bảo vệ tài khoản và thiết bị giám
                                    sát người cao tuổi đang hoạt động an toàn.
                                </Text>
                                <TouchableOpacity
                                    style={styles.securityActionPill}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                        openSecurityDetail("twoFactor")
                                    }
                                >
                                    <Ionicons
                                        name="sparkles"
                                        size={15}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.securityActionPillText}>
                                        Cải thiện ngay (2 mục)
                                    </Text>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={15}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.securityHeroRight}>
                                <View style={styles.securityShieldOuter}>
                                    <View style={styles.securityShieldInner}>
                                        <Ionicons
                                            name="shield-checkmark"
                                            size={50}
                                            color="#0284C7"
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* QUICK STATS ROW */}
                        <View
                            style={[
                                styles.securityStatsRow,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                        >
                            <View style={styles.securityStatItem}>
                                <View
                                    style={[
                                        styles.securityStatIconBadge,
                                        { backgroundColor: "#EFF6FF" },
                                    ]}
                                >
                                    <Ionicons
                                        name="key-outline"
                                        size={18}
                                        color="#2563EB"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityStatLabel,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Mật khẩu
                                </Text>
                                <Text style={styles.securityStatValueSuccess}>
                                    Độ mạnh cao
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.securityStatDivider,
                                    isDarkMode && { backgroundColor: "#334155" },
                                ]}
                            />
                            <View style={styles.securityStatItem}>
                                <View
                                    style={[
                                        styles.securityStatIconBadge,
                                        {
                                            backgroundColor: twoFactorEnabled
                                                ? "#ECFDF5"
                                                : "#FFFBEB",
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="shield-checkmark-outline"
                                        size={18}
                                        color={
                                            twoFactorEnabled
                                                ? "#059669"
                                                : "#D97706"
                                        }
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityStatLabel,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Xác thực 2FA
                                </Text>
                                <Text
                                    style={
                                        twoFactorEnabled
                                            ? styles.securityStatValueSuccess
                                            : styles.securityStatValueWarning
                                    }
                                >
                                    {twoFactorEnabled ? "Đã bật" : "Chưa bật"}
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.securityStatDivider,
                                    isDarkMode && { backgroundColor: "#334155" },
                                ]}
                            />
                            <View style={styles.securityStatItem}>
                                <View
                                    style={[
                                        styles.securityStatIconBadge,
                                        { backgroundColor: "#F5F3FF" },
                                    ]}
                                >
                                    <Ionicons
                                        name="phone-portrait-outline"
                                        size={18}
                                        color="#7C3AED"
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityStatLabel,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Thiết bị
                                </Text>
                                <Text style={styles.securityStatValueSuccess}>
                                    1 tin cậy
                                </Text>
                            </View>
                        </View>

                        {/* 4 ACCOUNT SECURITY TILES */}
                        <View style={styles.securitySectionHeaderBox}>
                            <Text
                                style={[
                                    styles.securitySectionHeaderTitle,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Bảo mật tài khoản
                            </Text>
                            <Text style={styles.securitySectionHeaderBadge}>
                                4 thiết lập
                            </Text>
                        </View>

                        <View style={styles.securityGridModern}>
                            {/* Tile 1: Đổi mật khẩu */}
                            <TouchableOpacity
                                style={[
                                    styles.securityCardTile,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                                onPress={onChangePasswordPress}
                                activeOpacity={0.75}
                            >
                                <View style={styles.securityTileHeader}>
                                    <View
                                        style={[
                                            styles.securityTileIconSquircle,
                                            { backgroundColor: "#EFF6FF" },
                                        ]}
                                    >
                                        <Ionicons
                                            name="key"
                                            size={22}
                                            color="#2563EB"
                                        />
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={
                                            isDarkMode ? "#64748B" : "#94A3B8"
                                        }
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityTileModernTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Đổi mật khẩu
                                </Text>
                                <Text
                                    style={[
                                        styles.securityTileModernSub,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Cập nhật định kỳ
                                </Text>
                                <View style={styles.securityTileTag}>
                                    <View style={styles.securityDotGreen} />
                                    <Text style={styles.securityTagTextGreen}>
                                        Bảo vệ tốt
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Tile 2: Xác minh 2 bước */}
                            <TouchableOpacity
                                style={[
                                    styles.securityCardTile,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                                onPress={() => openSecurityDetail("twoFactor")}
                                activeOpacity={0.75}
                            >
                                <View style={styles.securityTileHeader}>
                                    <View
                                        style={[
                                            styles.securityTileIconSquircle,
                                            { backgroundColor: "#ECFDF5" },
                                        ]}
                                    >
                                        <Ionicons
                                            name="shield-checkmark"
                                            size={22}
                                            color="#059669"
                                        />
                                    </View>
                                    <Switch
                                        value={twoFactorEnabled}
                                        onValueChange={setTwoFactorEnabled}
                                        trackColor={{
                                            false: "#CBD5E1",
                                            true: "#7DD3FC",
                                        }}
                                        thumbColor={
                                            twoFactorEnabled
                                                ? "#0284C7"
                                                : "#FFFFFF"
                                        }
                                        style={{ transform: [{ scale: 0.8 }] }}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityTileModernTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Xác minh 2 bước
                                </Text>
                                <Text
                                    style={[
                                        styles.securityTileModernSub,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    {twoFactorEnabled
                                        ? "Đang bật qua SMS"
                                        : "Chưa kích hoạt"}
                                </Text>
                                <View style={styles.securityTileTag}>
                                    <View
                                        style={
                                            twoFactorEnabled
                                                ? styles.securityDotGreen
                                                : styles.securityDotOrange
                                        }
                                    />
                                    <Text
                                        style={
                                            twoFactorEnabled
                                                ? styles.securityTagTextGreen
                                                : styles.securityTagTextOrange
                                        }
                                    >
                                        {twoFactorEnabled
                                            ? "Đã bật SMS"
                                            : "Khuyên dùng"}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Tile 3: Quản lý thiết bị */}
                            <TouchableOpacity
                                style={[
                                    styles.securityCardTile,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                                onPress={() => openSecurityDetail("devices")}
                                activeOpacity={0.75}
                            >
                                <View style={styles.securityTileHeader}>
                                    <View
                                        style={[
                                            styles.securityTileIconSquircle,
                                            { backgroundColor: "#F5F3FF" },
                                        ]}
                                    >
                                        <Ionicons
                                            name="phone-portrait"
                                            size={22}
                                            color="#7C3AED"
                                        />
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={
                                            isDarkMode ? "#64748B" : "#94A3B8"
                                        }
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityTileModernTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Quản lý đầu cuối
                                </Text>
                                <Text
                                    style={[
                                        styles.securityTileModernSub,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    1 thiết bị tin cậy
                                </Text>
                                <View style={styles.securityTileTag}>
                                    <View style={styles.securityDotGreen} />
                                    <Text style={styles.securityTagTextGreen}>
                                        Android · Hiện tại
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Tile 4: Lịch sử đăng nhập */}
                            <TouchableOpacity
                                style={[
                                    styles.securityCardTile,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                    },
                                ]}
                                onPress={() => openSecurityDetail("logins")}
                                activeOpacity={0.75}
                            >
                                <View style={styles.securityTileHeader}>
                                    <View
                                        style={[
                                            styles.securityTileIconSquircle,
                                            { backgroundColor: "#FFFBEB" },
                                        ]}
                                    >
                                        <Ionicons
                                            name="time"
                                            size={22}
                                            color="#D97706"
                                        />
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={
                                            isDarkMode ? "#64748B" : "#94A3B8"
                                        }
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.securityTileModernTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Nhật ký đăng nhập
                                </Text>
                                <Text
                                    style={[
                                        styles.securityTileModernSub,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Xem các phiên truy cập
                                </Text>
                                <View style={styles.securityTileTag}>
                                    <View style={styles.securityDotBlue} />
                                    <Text style={styles.securityTagTextBlue}>
                                        4 phiên gần đây
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* AI CARE ADVISORY CARD */}
                        <View
                            style={[
                                styles.securityAdvisoryCard,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                        >
                            <View style={styles.securityAdvisoryIconBox}>
                                <Ionicons
                                    name="bulb-outline"
                                    size={24}
                                    color="#0284C7"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.securityAdvisoryTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Mẹo an toàn từ Trợ lý Care AI
                                </Text>
                                <Text
                                    style={[
                                        styles.securityAdvisoryText,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Không chia sẻ mật khẩu hay mã OTP SMS cho
                                    người khác. Hãy luôn bật xác thực hai bước để
                                    bảo vệ hình ảnh camera và dữ liệu sức khỏe của
                                    gia đình.
                                </Text>
                            </View>
                        </View>

                        {/* FAQ SECTION */}
                        <View
                            style={[
                                styles.securityFaqCard,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                        >
                            <View style={styles.securityFaqHeader}>
                                <View style={styles.securityFaqHeaderLeft}>
                                    <Ionicons
                                        name="help-circle-outline"
                                        size={22}
                                        color={Colors.primary}
                                    />
                                    <Text
                                        style={[
                                            styles.securityFaqHeaderTitle,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Bạn cũng có thể hỏi
                                    </Text>
                                </View>
                                <Text style={styles.securityFaqCount}>
                                    4 câu hỏi
                                </Text>
                            </View>

                            {[
                                {
                                    q: "Mật khẩu mã hóa thiết bị là gì?",
                                    icon: "lock-closed-outline",
                                },
                                {
                                    q: "Có ràng buộc một thiết bị an toàn không?",
                                    icon: "link-outline",
                                },
                                {
                                    q: "Bảo vệ quyền riêng tư của người dùng",
                                    icon: "shield-outline",
                                },
                                {
                                    q: "Việc sử dụng mã xác minh qua tin nhắn SMS",
                                    icon: "chatbox-ellipses-outline",
                                },
                            ].map((item, index) => (
                                <React.Fragment key={item.q}>
                                    {index > 0 && (
                                        <View
                                            style={[
                                                styles.securityFaqDivider,
                                                isDarkMode && {
                                                    backgroundColor: "#334155",
                                                },
                                            ]}
                                        />
                                    )}
                                    <TouchableOpacity
                                        style={styles.securityFaqRow}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            setSelectedSecurityQuestion(item.q);
                                            openSecurityDetail("question");
                                        }}
                                    >
                                        <View
                                            style={[
                                                styles.securityFaqIconBox,
                                                isDarkMode && {
                                                    backgroundColor: "#0F172A",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name={item.icon as any}
                                                size={18}
                                                color="#0284C7"
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.securityFaqQuestionText,
                                                isDarkMode && {
                                                    color: "#E2E8F0",
                                                },
                                            ]}
                                        >
                                            {item.q}
                                        </Text>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={18}
                                            color={
                                                isDarkMode
                                                    ? "#64748B"
                                                    : "#94A3B8"
                                            }
                                        />
                                    </TouchableOpacity>
                                </React.Fragment>
                            ))}
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    securityDetailScreen: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    securityDetailHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    securityNavBackButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
    },
    securityDetailTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    securityDetailContent: {
        padding: 16,
        gap: 16,
    },
    securityDetailCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    securityDetailHeroBadge: {
        alignItems: "center",
        marginBottom: 16,
    },
    securityTileIconSquircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    securityDetailRowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    securityDetailCardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    securityDetailSubText: {
        fontSize: 13,
        color: "#64748B",
        marginTop: 2,
    },
    securityDetailDescription: {
        fontSize: 13.5,
        color: "#64748B",
        lineHeight: 20,
        marginTop: 12,
    },
    securityInfoBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#F0F9FF",
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#BAE6FD",
        marginTop: 16,
    },
    securityInfoText: {
        fontSize: 13,
        color: "#0369A1",
        flex: 1,
        lineHeight: 18,
    },
    securityDeviceItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        padding: 14,
        marginTop: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    securityDeviceIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#E0F2FE",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    securityDeviceCopy: {
        flex: 1,
    },
    securityDeviceName: {
        fontSize: 14.5,
        fontWeight: "700",
        color: "#0F172A",
    },
    securityDeviceMeta: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    securityActiveBadge: {
        backgroundColor: "#ECFDF5",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    securityActiveBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#059669",
    },
    securityLoginItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    securityTimelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#0284C7",
        marginRight: 12,
    },
    securityLoginName: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0F172A",
    },
    securityLoginTime: {
        fontSize: 12.5,
        color: "#64748B",
    },
    securityQuestionDetailTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0F172A",
        lineHeight: 24,
    },
    securityQuestionDetailDescription: {
        fontSize: 14,
        color: "#475569",
        lineHeight: 22,
    },
    securityScreen: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    securityTopNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    securityNavTitleBox: {
        alignItems: "center",
    },
    securityNavTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    securityNavSubTitle: {
        fontSize: 11,
        color: "#64748B",
    },
    securityStatusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#ECFDF5",
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 14,
    },
    securityStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#059669",
    },
    securityStatusPillText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#059669",
    },
    securityScrollContent: {
        padding: 16,
        gap: 16,
    },
    securityHeroModern: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    securityHeroLeft: {
        flex: 1.4,
    },
    securityBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#E0F2FE",
        alignSelf: "flex-start",
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 8,
    },
    securityBadgeText: {
        fontSize: 10.5,
        fontWeight: "700",
        color: "#0284C7",
    },
    securityHeroScoreTitle: {
        fontSize: 34,
        fontWeight: "800",
        color: "#0F172A",
    },
    securityHeroScoreSub: {
        fontSize: 18,
        fontWeight: "600",
        color: "#94A3B8",
    },
    securityHeroDesc: {
        fontSize: 12.5,
        color: "#64748B",
        lineHeight: 18,
        marginVertical: 10,
    },
    securityActionPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#0284C7",
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignSelf: "flex-start",
    },
    securityActionPillText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    securityHeroRight: {
        flex: 0.8,
        justifyContent: "center",
        alignItems: "center",
    },
    securityShieldOuter: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: "#E0F2FE",
        justifyContent: "center",
        alignItems: "center",
    },
    securityShieldInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
    },
    securityStatsRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    securityStatItem: {
        flex: 1,
        alignItems: "center",
        gap: 4,
    },
    securityStatIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    securityStatLabel: {
        fontSize: 11.5,
        color: "#64748B",
    },
    securityStatValueSuccess: {
        fontSize: 12.5,
        fontWeight: "700",
        color: "#059669",
    },
    securityStatValueWarning: {
        fontSize: 12.5,
        fontWeight: "700",
        color: "#D97706",
    },
    securityStatDivider: {
        width: 1,
        height: 32,
        backgroundColor: "#E2E8F0",
    },
    securitySectionHeaderBox: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 6,
    },
    securitySectionHeaderTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    securitySectionHeaderBadge: {
        fontSize: 12,
        color: "#64748B",
    },
    securityGridModern: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    securityCardTile: {
        width: "48%",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    securityTileHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    securityTileModernTitle: {
        fontSize: 14.5,
        fontWeight: "700",
        color: "#0F172A",
    },
    securityTileModernSub: {
        fontSize: 11.5,
        color: "#64748B",
        marginTop: 2,
        marginBottom: 8,
    },
    securityTileTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    securityDotGreen: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#059669",
    },
    securityTagTextGreen: {
        fontSize: 11,
        fontWeight: "600",
        color: "#059669",
    },
    securityDotOrange: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#D97706",
    },
    securityTagTextOrange: {
        fontSize: 11,
        fontWeight: "600",
        color: "#D97706",
    },
    securityDotBlue: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#0284C7",
    },
    securityTagTextBlue: {
        fontSize: 11,
        fontWeight: "600",
        color: "#0284C7",
    },
    securityAdvisoryCard: {
        flexDirection: "row",
        gap: 12,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    securityAdvisoryIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#E0F2FE",
        justifyContent: "center",
        alignItems: "center",
    },
    securityAdvisoryTitle: {
        fontSize: 14.5,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 4,
    },
    securityAdvisoryText: {
        fontSize: 12.5,
        color: "#64748B",
        lineHeight: 18,
    },
    securityFaqCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    securityFaqHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    securityFaqHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    securityFaqHeaderTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
    },
    securityFaqCount: {
        fontSize: 12,
        color: "#64748B",
    },
    securityFaqRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
    },
    securityFaqIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
    },
    securityFaqQuestionText: {
        fontSize: 13.5,
        color: "#1E293B",
        flex: 1,
    },
    securityFaqDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#E2E8F0",
        marginLeft: 42,
    },
});
