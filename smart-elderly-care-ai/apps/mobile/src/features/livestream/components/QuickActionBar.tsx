/**
 * Hiển thị bốn thao tác nhanh: chụp ảnh, ghi hình, nghe audio và Voice Call.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../../store/useThemeStore";
import ControlActionButton, { ControlAction } from "./ControlActionButton";

interface Props {
    recording: boolean;
    speakerEnabled: boolean;
    callSelected: boolean;
    onSnapshot: () => void;
    onRecord: () => void;
    onSpeakerToggle: () => void;
    onCall: () => void;
}

/**
 * Dựng thanh thao tác dưới video với trạng thái ghi hình và loa.
 * @param props - Trạng thái nút và callback do màn hình cung cấp.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function QuickActionBar(props: Props) {
    const { colors } = useTheme();
    const actions: ControlAction[] = [
        { label: "Chụp ảnh", icon: "camera", onPress: props.onSnapshot },
        {
            label: "Ghi hình",
            icon: "videocam",
            onPress: props.onRecord,
            active: props.recording,
            activeColor: "#F15B67",
        },
        {
            label: "Loa camera",
            icon: props.speakerEnabled ? "volume-high-outline" : "volume-mute",
            onPress: props.onSpeakerToggle,
            active: props.speakerEnabled,
        },
        {
            label: "Voice Call",
            icon: "call-outline",
            onPress: props.onCall,
            active: props.callSelected,
        },
    ];
    return (
        <View style={[styles.toolbar, { backgroundColor: colors.card }]}>
            {actions.map((action) => (
                <ControlActionButton key={action.label} {...action} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    toolbar: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: 12,
    },
});
