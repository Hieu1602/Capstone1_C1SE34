/**
 * Hiển thị bàn phím bốn hướng cho thao tác xoay camera Pan/Tilt.
 */
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../store/useThemeStore";
import type { CameraMoveDirection } from "../hooks/useCameraConnection";
export type PanTiltDirection = CameraMoveDirection;
const DIRECTIONS = [
    {
        direction: "UP",
        icon: "caret-up",
        label: "Xoay lên",
        position: { top: 0, left: 80 },
    },
    {
        direction: "DOWN",
        icon: "caret-down",
        label: "Xoay xuống",
        position: { bottom: 0, left: 80 },
    },
    {
        direction: "LEFT",
        icon: "caret-back",
        label: "Xoay trái",
        position: { left: 0, top: 80 },
    },
    {
        direction: "RIGHT",
        icon: "caret-forward",
        label: "Xoay phải",
        position: { right: 0, top: 80 },
    },
] as const;
/**
 * Dựng bàn phím hướng; vòng tâm chỉ là hình trang trí.
 * @param props - Callback điều khiển hướng camera.
 * @param props.onMove - Nhận hướng được chạm; việc gọi API thuộc hook kết nối.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function PanTiltControl({
    onMove,
}: {
    onMove: (direction: PanTiltDirection) => void;
}) {
    const { colors } = useTheme();
    return (
        <View style={[styles.dial, { borderColor: colors.border }]}>
            <View
                pointerEvents="none"
                style={[styles.center, { borderColor: colors.border }]}
            />
            {DIRECTIONS.map((item) => (
                <TouchableOpacity
                    key={item.direction}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => onMove(item.direction)}
                    style={[styles.direction, item.position]}
                >
                    <Ionicons name={item.icon} size={28} color="#ff7a00" />
                </TouchableOpacity>
            ))}
        </View>
    );
}
const styles = StyleSheet.create({
    dial: {
        width: 210,
        height: 210,
        borderRadius: 105,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    center: { width: 64, height: 64, borderWidth: 7, borderRadius: 32 },
    direction: {
        position: "absolute",
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
});
