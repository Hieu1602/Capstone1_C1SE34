/**
 * Cung cấp nút icon thống nhất cho Quick Action Bar, Function Grid và panel.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
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
 * @param props.activeColor - Màu khi active; mặc định cam theo theme.
 * @param props.showLabel - Hiện nhãn và kích thước ô của Function Grid.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function ControlActionButton({
    label,
    icon,
    onPress,
    active,
    activeColor,
    showLabel = false,
}: ControlAction & { showLabel?: boolean }) {
    const { colors, isDarkMode } = useTheme();
    const { t } = useTranslation();
    const [focused, setFocused] = useState(false);
    const accent = activeColor ?? (isDarkMode ? "#FFAD66" : "#B54708");
    return (
        <Pressable
            accessible
            focusable
            accessibilityRole="button"
            accessibilityLabel={t(label, { defaultValue: label })}
            accessibilityState={active == null ? undefined : { selected: active }}
            onPress={onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={({ pressed }) => [
                showLabel ? styles.gridAction : styles.iconAction,
                styles.interaction,
                focused && { borderColor: colors.textPrimary },
                pressed && {
                    backgroundColor: colors.surfaceSubtle,
                    transform: [{ scale: 0.96 }],
                },
            ]}
        >
            <View
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                    styles.iconSurface,
                    {
                        backgroundColor: active
                            ? activeColor
                                ? colors.card
                                : colors.primaryLight
                            : colors.surfaceSubtle,
                        borderColor: active ? accent : "transparent",
                    },
                ]}
            >
                <CameraControlIcon
                    name={icon}
                    size={26}
                    color={active ? accent : colors.textPrimary}
                />
                {active && (
                    <View
                        style={[styles.activeDot, { backgroundColor: accent }]}
                    />
                )}
            </View>
            {showLabel && (
                <Text
                    accessible={false}
                    style={[
                        styles.label,
                        { color: colors.textPrimary },
                        active && styles.activeLabel,
                    ]}
                >
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    iconAction: {
        minWidth: 56,
        minHeight: 56,
        alignItems: "center",
        justifyContent: "center",
    },
    interaction: {
        borderWidth: 2,
        borderColor: "transparent",
        borderRadius: 20,
    },
    gridAction: {
        width: "33.333%",
        minHeight: 108,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        paddingVertical: 12,
        gap: 8,
    },
    iconSurface: {
        width: 52,
        height: 52,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    activeDot: {
        position: "absolute",
        top: 6,
        right: 6,
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    label: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "500",
        textAlign: "center",
        alignSelf: "stretch",
    },
    activeLabel: { fontWeight: "600" },
});
