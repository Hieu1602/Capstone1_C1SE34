import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Switch,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";
import { SlideRightModal } from "../settings/SlideRightModal";
import { usersApi } from "../../../../services/api";
import * as Location from "expo-location";

interface SecurityCenterModalProps {
    visible: boolean;
    isDarkMode: boolean;
    onClose: () => void;
    onChangePasswordPress?: () => void;
    onSubmitChangePassword?: (
        currentPass: string,
        newPass: string,
        confirmPass: string,
    ) => Promise<boolean>;
}

export const SecurityCenterModal: React.FC<SecurityCenterModalProps> = ({
    visible,
    isDarkMode,
    onClose,
    onChangePasswordPress,
    onSubmitChangePassword,
}) => {
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [securityDetail, setSecurityDetail] = useState<
        "twoFactor" | "devices" | "logins" | "question" | "changePassword" | null
    >(null);
    const [terminals, setTerminals] = useState<any[]>([]);
    const [loginHistories, setLoginHistories] = useState<any[]>([]);
    const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);
    const [isLoadingHistories, setIsLoadingHistories] = useState(false);

    const fetchTerminalsData = async () => {
        setIsLoadingTerminals(true);
        try {
            let currentLoc: string | undefined;
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === "granted") {
                    const pos = await Promise.race([
                        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                        new Promise<null>((r) => setTimeout(() => r(null), 1500)),
                    ]);
                    if (pos && pos.coords) {
                        const places = await Location.reverseGeocodeAsync({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                        });
                        if (places && places.length > 0) {
                            const p = places[0];
                            const parts = [
                                p.district || p.subregion,
                                p.city || p.region,
                                p.country || "Việt Nam",
                            ].filter(Boolean);
                            currentLoc = parts.join(", ");
                        }
                    }
                }
            } catch {}

            const res = await usersApi.getTerminals(currentLoc);
            if (Array.isArray(res.data) && res.data.length > 0) {
                setTerminals(res.data);
            }
        } catch (err) {
            console.warn("[SecurityCenter] Lỗi tải danh sách thiết bị:", err);
        } finally {
            setIsLoadingTerminals(false);
        }
    };

    const fetchLoginHistoriesData = async () => {
        setIsLoadingHistories(true);
        try {
            const res = await usersApi.getLoginHistory(20);
            if (Array.isArray(res.data) && res.data.length > 0) {
                setLoginHistories(res.data);
            }
        } catch (err) {
            console.warn("[SecurityCenter] Lỗi tải lịch sử đăng nhập:", err);
        } finally {
            setIsLoadingHistories(false);
        }
    };

    const formatLoginDate = (dateStr?: string | null) => {
        if (!dateStr) return "Hôm nay · Vừa xong";
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const hours = String(d.getHours()).padStart(2, "0");
            const mins = String(d.getMinutes()).padStart(2, "0");
            if (isToday) {
                return `Hôm nay · ${hours}:${mins}`;
            }
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            return `${day}/${month} · ${hours}:${mins}`;
        } catch {
            return dateStr;
        }
    };
    const [selectedSecurityQuestion, setSelectedSecurityQuestion] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const scrollRef = useRef<any>(null);

    useEffect(() => {
        if (visible) {
            scrollRef.current?.scrollTo({ y: 0, animated: false });
            fetchTerminalsData();
            fetchLoginHistoriesData();
        }
    }, [visible]);

    const resetPasswordForm = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setPasswordFeedback(null);
    };

    const openSecurityDetail = (
        type: "twoFactor" | "devices" | "logins" | "question" | "changePassword",
    ) => {
        if (type === "changePassword") {
            resetPasswordForm();
        }
        if (type === "devices") {
            fetchTerminalsData();
        }
        if (type === "logins") {
            fetchLoginHistoriesData();
        }
        setSecurityDetail(type);
    };

    const handleClose = () => {
        resetPasswordForm();
        setSecurityDetail(null);
        onClose();
    };

    const handleChangePasswordSubmit = async () => {
        if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            setPasswordFeedback({
                type: "error",
                message: "Vui lòng nhập đầy đủ các trường mật khẩu.",
            });
            return;
        }

        if (newPassword.length < 8 || newPassword.length > 16) {
            setPasswordFeedback({
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
            setPasswordFeedback({
                type: "error",
                message:
                    "Mật khẩu cần bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.",
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordFeedback({
                type: "error",
                message: "Mật khẩu xác nhận không trùng khớp.",
            });
            return;
        }

        if (!onSubmitChangePassword) {
            setPasswordFeedback({
                type: "error",
                message: "Tính năng đổi mật khẩu chưa sẵn sàng.",
            });
            return;
        }

        setIsChangingPassword(true);
        setPasswordFeedback(null);
        try {
            const success = await onSubmitChangePassword(
                currentPassword,
                newPassword,
                confirmPassword,
            );
            if (success) {
                setPasswordFeedback({
                    type: "success",
                    message: "Mật khẩu của bạn đã được cập nhật thành công!",
                });
                setTimeout(() => {
                    resetPasswordForm();
                    setSecurityDetail(null);
                }, 1400);
            }
        } catch (error: any) {
            setPasswordFeedback({
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
            {securityDetail !== null ? (
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
                            onPress={() => {
                                resetPasswordForm();
                                setSecurityDetail(null);
                            }}
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
                                    : securityDetail === "changePassword"
                                      ? "Đổi mật khẩu"
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
                                <View style={styles.securityDetailCardHeaderRow}>
                                    <Text
                                        style={[
                                            styles.securityDetailCardTitle,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Thiết bị đáng tin cậy: {terminals.length || 1}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={fetchTerminalsData}
                                        disabled={isLoadingTerminals}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons
                                            name="refresh-outline"
                                            size={18}
                                            color={isLoadingTerminals ? "#94A3B8" : Colors.primary}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {isLoadingTerminals && terminals.length === 0 ? (
                                    <View style={{ paddingVertical: 24, alignItems: "center" }}>
                                        <ActivityIndicator color={Colors.primary} size="small" />
                                    </View>
                                ) : (
                                    (terminals.length > 0 ? terminals : [
                                        {
                                            id: "current-dev",
                                            device_name: "Thiết bị này",
                                            os: "Android App",
                                            browser: "SECA Mobile App",
                                            ip_address: "127.0.0.1",
                                            location: "Đà Nẵng, Việt Nam",
                                            last_active_at: new Date().toISOString(),
                                            is_current: true,
                                        }
                                    ]).map((item) => (
                                        <View
                                            key={item.id || item.device_name}
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
                                                    name={
                                                        item.device_type === "desktop"
                                                            ? "desktop-outline"
                                                            : item.device_type === "tablet"
                                                              ? "tablet-portrait-outline"
                                                              : "phone-portrait"
                                                    }
                                                    size={22}
                                                    color="#0284C7"
                                                />
                                            </View>
                                            <View style={styles.securityDeviceCopy}>
                                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                                    <Text
                                                        style={[
                                                            styles.securityDeviceName,
                                                            isDarkMode && { color: "#F8FAFC" },
                                                        ]}
                                                    >
                                                        {item.is_current ? "Thiết bị này" : item.device_name}
                                                    </Text>
                                                    {item.is_current && (
                                                        <View style={styles.securityActiveBadge}>
                                                            <Text style={styles.securityActiveBadgeText}>
                                                                Hiện tại
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.securityDeviceMeta,
                                                        isDarkMode && { color: "#94A3B8" },
                                                    ]}
                                                >
                                                    {item.os || "Android App"} · {item.browser || "Đang hoạt động"}
                                                </Text>
                                                <View style={styles.securityLocationBadge}>
                                                    <Ionicons name="location-sharp" size={13} color="#EA580C" />
                                                    <Text
                                                        style={[
                                                            styles.securityLocationText,
                                                            isDarkMode && { color: "#FB923C" },
                                                        ]}
                                                    >
                                                        {item.location || "Đà Nẵng, Việt Nam"}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.securityDeviceMeta,
                                                        isDarkMode && { color: "#94A3B8" },
                                                    ]}
                                                >
                                                    🌐 IP: {item.ip_address || "127.0.0.1"}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.securityDeviceMeta,
                                                        isDarkMode && { color: "#94A3B8" },
                                                    ]}
                                                >
                                                    Đăng nhập gần nhất: {formatLoginDate(item.last_active_at)}
                                                </Text>
                                            </View>
                                        </View>
                                    ))
                                )}

                                <Text
                                    style={[
                                        styles.securityDetailDescription,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    Nếu bạn thấy bất kỳ thiết bị lạ nào đăng nhập vào hệ thống, hãy đổi mật khẩu ngay lập tức. Các thiết bị không hoạt động trong 3 tháng sẽ tự động bị ngắt kết nối.
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
                                <View style={styles.securityDetailCardHeaderRow}>
                                    <Text
                                        style={[
                                            styles.securityDetailCardTitle,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Lịch sử đăng nhập gần đây
                                    </Text>
                                    <TouchableOpacity
                                        onPress={fetchLoginHistoriesData}
                                        disabled={isLoadingHistories}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons
                                            name="refresh-outline"
                                            size={18}
                                            color={isLoadingHistories ? "#94A3B8" : Colors.primary}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {isLoadingHistories && loginHistories.length === 0 ? (
                                    <View style={{ paddingVertical: 24, alignItems: "center" }}>
                                        <ActivityIndicator color={Colors.primary} size="small" />
                                    </View>
                                ) : (
                                    (loginHistories.length > 0 ? loginHistories : [
                                        {
                                            id: "hist-1",
                                            device_name: "Thiết bị chính",
                                            location: "Đà Nẵng, Việt Nam",
                                            ip_address: "127.0.0.1",
                                            login_time: new Date().toISOString(),
                                            status: "success",
                                        }
                                    ]).map((loginItem, idx) => (
                                        <View
                                            key={loginItem.id || String(idx)}
                                            style={[
                                                styles.securityLoginItem,
                                                isDarkMode && {
                                                    borderBottomColor: "#334155",
                                                },
                                                idx === (loginHistories.length - 1) && {
                                                    borderBottomWidth: 0,
                                                },
                                            ]}
                                        >
                                            <View style={styles.securityTimelineDot} />
                                            <View style={styles.securityDeviceCopy}>
                                                <Text
                                                    style={[
                                                        styles.securityLoginName,
                                                        isDarkMode && { color: "#F8FAFC" },
                                                    ]}
                                                >
                                                    {loginItem.device_name || "Đăng nhập ứng dụng"}
                                                </Text>
                                                <View style={styles.securityLocationBadge}>
                                                    <Ionicons name="location-sharp" size={12} color="#EA580C" />
                                                    <Text
                                                        style={[
                                                            styles.securityLocationText,
                                                            isDarkMode && { color: "#FB923C" },
                                                        ]}
                                                    >
                                                        {loginItem.location || "Đà Nẵng, Việt Nam"}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.securityDeviceMeta,
                                                        isDarkMode && { color: "#94A3B8" },
                                                    ]}
                                                >
                                                    🌐 IP: {loginItem.ip_address || "127.0.0.1"} · Thành công
                                                </Text>
                                            </View>
                                            <Text
                                                style={[
                                                    styles.securityLoginTime,
                                                    isDarkMode && { color: "#94A3B8" },
                                                ]}
                                            >
                                                {formatLoginDate(loginItem.login_time)}
                                            </Text>
                                        </View>
                                    ))
                                )}
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

                        {securityDetail === "changePassword" && (
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

                                {passwordFeedback && (
                                    <View
                                        accessibilityRole="alert"
                                        style={[
                                            styles.passwordFeedbackBanner,
                                            passwordFeedback.type === "success"
                                                ? isDarkMode
                                                    ? {
                                                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                                                          borderColor: "#065F46",
                                                      }
                                                    : {
                                                          backgroundColor: "#ECFDF5",
                                                          borderColor: "#A7F3D0",
                                                      }
                                                : isDarkMode
                                                  ? {
                                                        backgroundColor: "rgba(239, 68, 68, 0.15)",
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
                                                passwordFeedback.type === "success"
                                                    ? "checkmark-circle"
                                                    : "alert-circle"
                                            }
                                            size={20}
                                            color={
                                                passwordFeedback.type === "success"
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
                                                    passwordFeedback.type === "success"
                                                        ? isDarkMode
                                                            ? "#A7F3D0"
                                                            : "#065F46"
                                                        : isDarkMode
                                                          ? "#FCA5A5"
                                                          : "#B91C1C",
                                            }}
                                        >
                                            {passwordFeedback.message}
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
                                        styles.changePasswordSubmitButton,
                                        isChangingPassword && { opacity: 0.7 },
                                    ]}
                                    onPress={handleChangePasswordSubmit}
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
                                            <Text style={styles.changePasswordSubmitButtonText}>
                                                Cập nhật mật khẩu
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            ) : (
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
                        ref={scrollRef}
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
                                onPress={() => openSecurityDetail("changePassword")}
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
                                            ? "Đang bảo vệ"
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
            )}
        </SlideRightModal>
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
    changePasswordSubmitButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        height: 52,
        marginTop: 24,
    },
    changePasswordSubmitButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    securityDetailCardHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    securityLocationBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
        marginBottom: 2,
    },
    securityLocationText: {
        fontSize: 12.5,
        fontWeight: "600",
        color: "#EA580C",
    },
});