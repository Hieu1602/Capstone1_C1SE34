/**
 * Cung cấp nút icon thống nhất cho Quick Action Bar, Function Grid và panel.
 */
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import { useTheme } from "../../../store/useThemeStore";
import CameraControlIcon, { CameraControlIconName } from "./CameraControlIcon";

export interface ControlAction {
    label: string;
    icon: CameraControlIconName;
    onPress: () => void;
    active?: boolean;
    activeColor?: string;
}

/**
 * Dựng nút icon, màu trạng thái chọn và nhãn tùy chọn.
 * @param props - Cấu hình icon và thao tác.
 * @param props.label - Nhãn hỗ trợ tiếp cận, đồng thời là chữ dưới icon nếu bật showLabel.
 * @param props.icon - Tên icon camera.
 * @param props.onPress - Callback khi người dùng chạm nút.
 * @param props.active - Đánh dấu nút đang được chọn.
 * @param props.activeColor - Màu khi active; mặc định xanh.
 * @param props.showLabel - Hiện nhãn và kích thước ô của Function Grid.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function ControlActionButton({
    label,
    icon,
    onPress,
    active,
    activeColor = "#ff7a00",
    showLabel = false,
}: ControlAction & { showLabel?: boolean }) {
    const { colors, isDarkMode } = useTheme();
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: !!active }}
            onPress={onPress}
            style={showLabel ? styles.gridAction : styles.iconAction}
        >
            <CameraControlIcon
                name={icon}
                size={showLabel ? 34 : 32}
                color={
                    active
                        ? activeColor
                        : isDarkMode
                          ? colors.textPrimary
                          : "#4D5052"
                }
            />
            {showLabel && (
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    iconAction: {
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    gridAction: {
        width: "33.333%",
        minHeight: 90,
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
        gap: 8,
    },
    label: { fontSize: 14, textAlign: "center" },
});
