/**
 * Hiển thị năm chức năng camera theo lưới ba cột.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../../store/useThemeStore";
import ControlActionButton, { ControlAction } from "./ControlActionButton";

interface Props {
    onTalk: () => void;
    onPanTilt: () => void;
    onAlarm: () => void;
    alarmActive?: boolean;
    onPrivacy: () => void;
    privacyActive: boolean;
    onCare: () => void;
    careActive?: boolean;
}

/**
 * Ghép các nút Talk, Pan/Tilt, Alarm, Privacy và AI Care.
 * @param props - Trạng thái riêng tư/còi và callback tương ứng từng chức năng.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function FunctionGrid(props: Props) {
    const { colors } = useTheme();
    const actions: ControlAction[] = [
        { label: "Đàm thoại", icon: "mic", onPress: props.onTalk },
        { label: "Xoay camera", icon: "move", onPress: props.onPanTilt },
        {
            label:
                props.alarmActive == null
                    ? "Còi báo động"
                    : props.alarmActive
                      ? "Tắt còi"
                      : "Bật còi",
            icon: "notifications",
            onPress: props.onAlarm,
            active: props.alarmActive,
        },
        {
            label: "Chế độ riêng tư",
            icon: "eye-off-outline",
            onPress: props.onPrivacy,
            active: props.privacyActive,
        },
        {
            label: "Chăm sóc AI",
            icon: props.careActive ? "shield-checkmark" : "shield-checkmark-outline",
            onPress: props.onCare,
            active: props.careActive,
            activeColor: "#10B981",
        },
    ];
    return (
        <View style={[styles.grid, { backgroundColor: colors.card }]}>
            {actions.map((action) => (
                <ControlActionButton key={action.label} {...action} showLabel />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        borderRadius: 18,
        paddingVertical: 16,
    },
});
