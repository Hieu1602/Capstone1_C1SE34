/**
 * Hiển thị trạng thái camera và các thao tác riêng tư, kết nối lại, phát hiện chuyển động.
 */
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import { useTheme } from "../../../store/useThemeStore";

interface Props {
    name: string;
    room?: string;
    connected: boolean;
    privacy: boolean | null;
    motion: boolean | null;
    onPrivacy: () => void;
    onReconnect: () => void;
    onMotion: () => void;
    onConfigureSource?: () => void;
    onDeleteDevice?: () => void;
}

/**
 * Đổi trạng thái tùy chọn sang nhãn hiển thị.
 * @param value - Trạng thái đọc từ camera; null khi chưa xác định.
 * @returns Bật, Tắt hoặc Chưa xác định.
 */
const stateLabel = (value: boolean | null) =>
    value === null ? "Chưa xác định" : value ? "Bật" : "Tắt";

/**
 * Dựng nội dung cài đặt từ trạng thái và callback của màn hình.
 * @param props - Tên/phòng camera, trạng thái kết nối và callback cài đặt.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function CameraSettings(props: Props) {
    const { colors } = useTheme();
    const textStyle = { color: colors.textPrimary };
    return (
        <>
            <Text style={[styles.title, textStyle]}>{props.name}</Text>
            <Text style={textStyle}>
                {props.connected ? "Đã kết nối" : "Chưa kết nối"}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
                {props.room || "Camera giám sát"}
            </Text>
            <TouchableOpacity
                accessibilityRole="button"
                style={styles.row}
                onPress={props.onPrivacy}
            >
                <Text style={[styles.rowText, textStyle]}>Chế độ riêng tư</Text>
                <Text style={textStyle}>{stateLabel(props.privacy)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                accessibilityRole="button"
                style={styles.row}
                onPress={props.onReconnect}
            >
                <Text style={textStyle}>Kết nối lại camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
                accessibilityRole="button"
                style={styles.row}
                onPress={props.onMotion}
            >
                <Text style={[styles.rowText, textStyle]}>
                    Phát hiện chuyển động
                </Text>
                <Text style={textStyle}>{stateLabel(props.motion)}</Text>
            </TouchableOpacity>
            {props.onConfigureSource && (
                <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.row, { borderBottomWidth: 0 }]}
                    onPress={props.onConfigureSource}
                >
                    <Ionicons name="videocam" size={20} color="#0284C7" />
                    <Text style={[styles.rowText, textStyle, { color: "#0284C7", fontWeight: "600" }]}>
                        Cấu hình nguồn Camera (RTSP)
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
            )}
            {props.onDeleteDevice && (
                <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.row, { borderBottomWidth: 0, marginTop: 4 }]}
                    onPress={props.onDeleteDevice}
                >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <Text style={[styles.rowText, textStyle, { color: "#EF4444", fontWeight: "600" }]}>
                        Gỡ bỏ camera này
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                </TouchableOpacity>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 17, fontWeight: "600" },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowText: { flex: 1 },
});
