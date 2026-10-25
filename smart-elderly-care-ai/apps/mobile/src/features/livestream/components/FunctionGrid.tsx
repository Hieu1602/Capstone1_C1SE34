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
}

/**
 * Ghép các nút Talk, Pan/Tilt, Alarm, Privacy và AI Care.
 * @param props - Trạng thái riêng tư/còi và callback tương ứng từng chức năng.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function FunctionGrid(props: Props) {
    const { colors } = useTheme();
    const actions: ControlAction[] = [
        { label: "Talk", icon: "mic", onPress: props.onTalk },
        { label: "Pan & Tilt", icon: "move", onPress: props.onPanTilt },
        {
            label:
                props.alarmActive == null
                    ? "Alarm"
                    : props.alarmActive
                      ? "Alarm On"
                      : "Alarm Off",
            icon: "notifications",
            onPress: props.onAlarm,
            active: props.alarmActive,
        },
        {
            label: "Privacy Mode",
            icon: "eye-off-outline",
            onPress: props.onPrivacy,
            active: props.privacyActive,
        },
        {
            label: "AI Care",
            icon: "shield-checkmark-outline",
            onPress: props.onCare,
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
