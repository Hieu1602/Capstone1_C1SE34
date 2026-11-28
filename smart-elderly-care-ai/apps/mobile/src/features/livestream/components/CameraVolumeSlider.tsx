/**
 * Thanh kéo điều chỉnh âm lượng nghe camera (0-100%) phủ ở đáy khung video.
 */
import React, { useRef } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";

interface Props {
    volume: number;
    onChange: (volume: number) => void;
}

/**
 * Hiển thị lớp phủ tối ở đáy video với nút tắt tiếng và thanh kéo âm lượng trắng.
 * @param props - Mức âm lượng hiện tại (0..100) và callback cập nhật.
 */
export default function CameraVolumeSlider({ volume, onChange }: Props) {
    const trackWidth = useRef(0);
    const startVal = useRef(volume);
    const lastNonZero = useRef(volume > 0 ? volume : 100);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    if (volume > 0) {
        lastNonZero.current = volume;
    }

    const responder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const w = trackWidth.current;
                if (!w) return;
                const pct = Math.round(
                    Math.max(0, Math.min(1, evt.nativeEvent.locationX / w)) * 100,
                );
                startVal.current = pct;
                onChangeRef.current(pct);
            },
            onPanResponderMove: (_, gestureState) => {
                const w = trackWidth.current;
                if (!w) return;
                const deltaPct = Math.round((gestureState.dx / w) * 100);
                onChangeRef.current(
                    Math.max(0, Math.min(100, startVal.current + deltaPct)),
                );
            },
        }),
    ).current;

    const iconName =
        volume === 0 ? "volume-mute" : volume < 50 ? "volume-low" : "volume-high";

    return (
        <View style={styles.overlay}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={volume === 0 ? "Bật âm lượng" : "Tắt âm lượng"}
                onPress={() => onChange(volume === 0 ? lastNonZero.current : 0)}
                hitSlop={10}
                style={styles.iconBtn}
            >
                <Ionicons name={iconName} size={22} color="#FFFFFF" />
            </Pressable>
            <View style={styles.rightCol}>
                <View style={styles.labelRow}>
                    <Text style={styles.label}>Âm lượng camera</Text>
                    <Text style={styles.value}>{volume}%</Text>
                </View>
                <View
                    style={styles.trackTouch}
                    onLayout={(e) => {
                        trackWidth.current = e.nativeEvent.layout.width;
                    }}
                    {...responder.panHandlers}
                >
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${volume}%` }]} />
                    </View>
                    <View style={[styles.thumb, { left: `${volume}%` }]} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 14,
    },
    iconBtn: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    rightCol: {
        flex: 1,
        gap: 2,
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    label: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "500",
    },
    value: {
        color: "rgba(255, 255, 255, 0.8)",
        fontSize: 12,
        fontWeight: "600",
    },
    trackTouch: {
        height: 26,
        justifyContent: "center",
    },
    track: {
        height: 3,
        borderRadius: 2,
        backgroundColor: "rgba(255, 255, 255, 0.35)",
        overflow: "hidden",
    },
    fill: {
        height: "100%",
        borderRadius: 2,
        backgroundColor: "#FFFFFF",
    },
    thumb: {
        position: "absolute",
        width: 16,
        height: 16,
        borderRadius: 8,
        marginLeft: -8,
        backgroundColor: "#FFFFFF",
    },
});
