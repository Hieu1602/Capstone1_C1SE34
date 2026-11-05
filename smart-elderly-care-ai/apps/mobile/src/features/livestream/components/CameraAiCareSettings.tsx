/**
 * Giao diện cài đặt và quản trị tính năng Chăm sóc AI / Phát hiện té ngã (YOLOv8-Pose).
 */
import React, { useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import { useTheme } from "../../../store/useThemeStore";
import type { FallDetectionStatus } from "../../../services/camera";

interface Props {
    enabled: boolean | null;
    stats: FallDetectionStatus | null;
    connected: boolean;
    overlay?: boolean;
    onToggle: () => Promise<void>;
    onToggleOverlay?: () => void;
    onViewIncidents?: () => void;
}

export default function CameraAiCareSettings({
    enabled,
    stats,
    connected,
    overlay = false,
    onToggle,
    onToggleOverlay,
    onViewIncidents,
}: Props) {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await onToggle();
        } finally {
            setLoading(false);
        }
    };

    const isEnabled = enabled === true;
    const accentColor = isEnabled ? "#10B981" : "#64748B";
    const textStyle = { color: colors.textPrimary };

    const formatTimestamp = (ts: number | null) => {
        if (!ts) return "Chưa có sự cố";
        const date = new Date(ts * 1000);
        return date.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
        });
    };

    return (
        <View style={styles.container}>
            {/* 1. Thẻ trạng thái nhận diện té ngã */}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: isEnabled ? "#10B981" : colors.border,
                    },
                ]}
            >
                <View style={styles.cardHeader}>
                    <View
                        style={[
                            styles.iconWrapper,
                            {
                                backgroundColor: isEnabled
                                    ? isDarkMode
                                        ? "rgba(16, 185, 129, 0.2)"
                                        : "rgba(16, 185, 129, 0.1)"
                                    : colors.surfaceSubtle,
                            },
                        ]}
                    >
                        <Ionicons
                            name={isEnabled ? "shield-checkmark" : "shield-outline"}
                            size={28}
                            color={accentColor}
                        />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.title, textStyle]}>
                            Nhận diện té ngã AI
                        </Text>
                        <View style={styles.badgeRow}>
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: isEnabled ? "#10B981" : "#94A3B8" },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.statusBadge,
                                    { color: isEnabled ? "#10B981" : "#94A3B8" },
                                ]}
                            >
                                {enabled === null
                                    ? "ĐANG TẢI..."
                                    : isEnabled
                                      ? "ĐANG BẬT"
                                      : "ĐÃ TẮT"}
                            </Text>
                        </View>
                    </View>
                </View>

                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    Mô hình YOLOv8-Pose liên tục phân tích tư thế cơ thể người cao tuổi
                    qua camera. Khi phát hiện té ngã, camera tự động cắt video 5s và
                    phát chuông cảnh báo khẩn cấp đến điện thoại người thân.
                </Text>

                {/* Nút bấm bật/tắt nhận diện */}
                <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    style={[
                        styles.toggleButton,
                        {
                            backgroundColor: isEnabled
                                ? isDarkMode
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : "rgba(239, 68, 68, 0.1)"
                                : "#10B981",
                            borderColor: isEnabled ? "#EF4444" : "#10B981",
                        },
                    ]}
                    onPress={handleToggle}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator
                            size="small"
                            color={isEnabled ? "#EF4444" : "#FFFFFF"}
                        />
                    ) : (
                        <>
                            <Ionicons
                                name={isEnabled ? "power" : "checkmark-circle"}
                                size={20}
                                color={isEnabled ? "#EF4444" : "#FFFFFF"}
                            />
                            <Text
                                style={[
                                    styles.toggleButtonText,
                                    { color: isEnabled ? "#EF4444" : "#FFFFFF" },
                                ]}
                            >
                                {isEnabled
                                    ? "Tắt tính năng nhận diện té ngã"
                                    : "Bật tính năng nhận diện té ngã"}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* 2. Thẻ Hiển thị khung xương AI (Skeleton Overlay) */}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: overlay ? "#0284C7" : colors.border,
                    },
                ]}
            >
                <View style={styles.cardHeader}>
                    <View
                        style={[
                            styles.iconWrapper,
                            {
                                backgroundColor: overlay
                                    ? isDarkMode
                                        ? "rgba(2, 132, 199, 0.2)"
                                        : "rgba(2, 132, 199, 0.1)"
                                    : colors.surfaceSubtle,
                            },
                        ]}
                    >
                        <Ionicons
                            name={overlay ? "body" : "body-outline"}
                            size={28}
                            color={overlay ? "#0284C7" : "#64748B"}
                        />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.title, textStyle]}>
                            Khung xương AI trực tiếp
                        </Text>
                        <View style={styles.badgeRow}>
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: overlay ? "#0284C7" : "#94A3B8" },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.statusBadge,
                                    { color: overlay ? "#0284C7" : "#94A3B8" },
                                ]}
                            >
                                {overlay ? "ĐANG HIỂN THỊ" : "ĐANG TẮT"}
                            </Text>
                        </View>
                    </View>
                </View>

                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    Vẽ các khớp nối khung xương và khung nhận diện cơ thể trực tiếp
                    lên luồng video camera thời gian thực để quan sát hoạt động của AI.
                </Text>

                <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    style={[
                        styles.toggleButton,
                        {
                            backgroundColor: overlay
                                ? isDarkMode
                                    ? "rgba(2, 132, 199, 0.15)"
                                    : "rgba(2, 132, 199, 0.1)"
                                : colors.surfaceSubtle,
                            borderColor: overlay ? "#0284C7" : colors.border,
                        },
                    ]}
                    onPress={onToggleOverlay}
                >
                    <Ionicons
                        name={overlay ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={overlay ? "#0284C7" : colors.textPrimary}
                    />
                    <Text
                        style={[
                            styles.toggleButtonText,
                            { color: overlay ? "#0284C7" : colors.textPrimary },
                        ]}
                    >
                        {overlay
                            ? "Tắt hiển thị khung xương AI"
                            : "Bật hiển thị khung xương AI"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 3. Cảnh báo nếu camera vật lý chưa kết nối */}
            {!connected && (
                <View
                    style={[
                        styles.noticeCard,
                        {
                            backgroundColor: isDarkMode
                                ? "rgba(245, 158, 11, 0.12)"
                                : "rgba(245, 158, 11, 0.08)",
                            borderColor: "rgba(245, 158, 11, 0.3)",
                        },
                    ]}
                >
                    <Ionicons name="alert-circle" size={22} color="#F59E0B" />
                    <Text
                        style={[
                            styles.noticeText,
                            { color: isDarkMode ? "#FCD34D" : "#B45309" },
                        ]}
                    >
                        Camera vật lý hiện chưa truyền hình ảnh. Bạn vẫn có thể bật trước
                        tính năng AI; hệ thống sẽ tự động giám sát ngay khi camera được kết nối.
                    </Text>
                </View>
            )}

            {/* 4. Thống kê giám sát AI */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, textStyle]}>Thống kê giám sát</Text>

                <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary }}>Số sự cố phát hiện:</Text>
                    <Text style={[styles.statValue, textStyle]}>
                        {stats?.fall_count ?? 0} lần
                    </Text>
                </View>

                <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary }}>Lần ngã gần nhất:</Text>
                    <Text style={[styles.statValue, textStyle]}>
                        {formatTimestamp(stats?.last_fall ?? null)}
                    </Text>
                </View>

                <View style={styles.statRow}>
                    <Text style={{ color: colors.textSecondary }}>Clip ghi lại:</Text>
                    <Text
                        style={[styles.statValue, { color: colors.primary }]}
                        numberOfLines={1}
                    >
                        {stats?.latest_clip ? stats.latest_clip : "Chưa có clip"}
                    </Text>
                </View>

                {onViewIncidents && (
                    <TouchableOpacity
                        accessibilityRole="button"
                        style={[styles.viewIncidentsBtn, { borderColor: colors.primary }]}
                        onPress={onViewIncidents}
                    >
                        <Ionicons
                            name="videocam-outline"
                            size={18}
                            color={colors.primary}
                        />
                        <Text style={[styles.viewIncidentsText, { color: colors.primary }]}>
                            Xem danh sách video sự cố AI
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        gap: 12,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    headerInfo: {
        flex: 1,
        gap: 4,
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusBadge: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
    },
    toggleButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1.5,
        marginTop: 4,
    },
    toggleButtonText: {
        fontSize: 15,
        fontWeight: "600",
    },
    noticeCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    noticeText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 4,
    },
    statRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    statValue: {
        fontSize: 14,
        fontWeight: "600",
    },
    viewIncidentsBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 6,
    },
    viewIncidentsText: {
        fontSize: 14,
        fontWeight: "600",
    },
});
