/**
 * Hiển thị panel Talk, Voice Call và Pan/Tilt bên dưới video trực tiếp.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import { useTheme } from "../../../store/useThemeStore";
import type { CameraIntercom } from "../hooks/useCameraIntercom";
import CameraControlIcon from "./CameraControlIcon";
import PanTiltControl, { PanTiltDirection } from "./PanTiltControl";
import ControlActionButton, { ControlAction } from "./ControlActionButton";

export type CameraPanel = "talk" | "call" | "pan" | null;
interface Props {
    panel: CameraPanel;
    onPanelChange: (panel: CameraPanel) => void;
    intercom: CameraIntercom;
    onMove: (direction: PanTiltDirection) => void;
    onSettings: () => void;
    feedback: string | null;
}
const ACCENT = "#ff7a00";

/**
 * Ghép các tab điều khiển và trạng thái audio vào panel đang được chọn.
 * @param props - Tab hiện tại, trạng thái intercom và callback điều khiển.
 * @returns Giao diện panel; null khi panel đóng.
 * @remarks Tác động: Nhớ tab audio gần nhất; thao tác người dùng gọi callback từ màn hình.
 */
export default function CameraControlPanel(props: Props) {
    const { colors } = useTheme();
    // Nhớ Talk/Voice Call gần nhất khi chuyển sang tab Pan/Tilt.
    const [audioTab, setAudioTab] = useState<"talk" | "call">("talk");
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;
    const contentAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (props.panel) {
            fadeAnim.setValue(0);
            slideAnim.setValue(24);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 9,
                    tension: 65,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [props.panel !== null]);

    useEffect(() => {
        if (props.panel) {
            contentAnim.setValue(0.35);
            Animated.timing(contentAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }).start();
        }
    }, [props.panel]);

    useEffect(() => {
        if (props.panel === "talk" || props.panel === "call")
            setAudioTab(props.panel);
    }, [props.panel]);
    if (!props.panel) return null;
    const surface = { backgroundColor: colors.card };
    const textColor = { color: colors.textPrimary };
    /**
     * Tạo nút điều khiển dùng chung trong panel.
     * @param item - Nhãn, icon, trạng thái chọn và callback của nút.
     * @returns Cây giao diện React theo props và theme hiện tại.
     */
    const action = (item: ControlAction) => (
        <ControlActionButton key={item.label} {...item} />
    );
    const tabs = [
        { id: audioTab, label: audioTab === "call" ? "Voice Call" : "Talk" },
        { id: "pan", label: "Pan/Tilt" },
    ] as const;
    return (
        <Animated.View
            style={[
                styles.panel,
                surface,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <View style={styles.panelHeader}>
                {action({
                    label: "Đóng điều khiển",
                    icon: "close",
                    onPress: () => props.onPanelChange(null),
                })}
                <View style={styles.tabs}>
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: props.panel === tab.id,
                            }}
                            onPress={() => props.onPanelChange(tab.id)}
                            style={[
                                styles.tab,
                                props.panel === tab.id && styles.selectedTab,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    textColor,
                                    props.panel === tab.id && {
                                        color: ACCENT,
                                    },
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {action({
                    label: "Cài đặt điều khiển",
                    icon: "options-outline",
                    onPress: props.onSettings,
                })}
            </View>
            <Animated.View style={{ flex: 1, opacity: contentAnim }}>
            <ScrollView contentContainerStyle={styles.panelBody}>
                {props.panel === "pan" ? (
                    <PanTiltControl onMove={props.onMove} />
                ) : props.panel === "call" ? (
                    <View style={styles.callControls}>
                        {(
                            [
                                {
                                    label: "Mic",
                                    icon: props.intercom.micEnabled
                                        ? "mic"
                                        : "mic-off",
                                    enabled: props.intercom.micEnabled,
                                    onPress: props.intercom.toggleMic,
                                },
                                {
                                    label: "Speaker",
                                    icon: props.intercom.speakerEnabled
                                        ? "volume-high-outline"
                                        : "volume-mute",
                                    enabled: props.intercom.speakerEnabled,
                                    onPress: props.intercom.toggleSpeaker,
                                },
                            ] as const
                        ).map((item) => (
                            <View key={item.label} style={styles.callControl}>
                                {action({
                                    label: item.label,
                                    icon: item.icon,
                                    onPress: item.onPress,
                                    active: item.enabled,
                                })}
                                <Text style={[styles.label, textColor]}>
                                    {item.label}
                                </Text>
                                <Text style={{ color: colors.textMuted }}>
                                    {item.enabled ? "On" : "Off"}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.talkIllustration}>
                        <CameraControlIcon
                            name="chatbubble-ellipses"
                            size={86}
                            color={ACCENT}
                        />
                    </View>
                )}
                {props.panel !== "pan" && (
                    <Text
                        style={[
                            styles.feedback,
                            { color: colors.textSecondary },
                        ]}
                    >
                        {props.intercom.state === "connecting"
                            ? "Đang kết nối âm thanh…"
                            : props.intercom.state === "connected"
                              ? props.intercom.mode === "ptt"
                                  ? "Đang truyền giọng nói…"
                                  : "Đã kết nối âm thanh"
                              : props.intercom.error ||
                                "Giữ nút để nói hoặc bắt đầu Voice Call."}
                    </Text>
                )}
                {props.feedback && (
                    <Text
                        accessibilityLiveRegion="polite"
                        style={[
                            styles.feedback,
                            { color: colors.textSecondary },
                        ]}
                    >
                        {props.feedback}
                    </Text>
                )}
            </ScrollView>
            {props.panel !== "pan" && (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                        props.panel === "call" ? "Voice Call" : "Talk"
                    }
                    onPress={
                        props.panel === "call"
                            ? props.intercom.toggleCall
                            : undefined
                    }
                    onPressIn={
                        props.panel === "talk"
                            ? props.intercom.startTalk
                            : undefined
                    }
                    onPressOut={
                        props.panel === "talk"
                            ? props.intercom.endTalk
                            : undefined
                    }
                    style={[
                        styles.primaryButton,
                        props.intercom.mode !== "listen" &&
                            props.intercom.mode !== null && {
                                backgroundColor: "#DC4444",
                            },
                    ]}
                >
                    <CameraControlIcon
                        name={props.panel === "call" ? "call" : "mic"}
                        size={25}
                        color="#FFF"
                    />
                    <Text style={styles.buttonText}>
                        {props.panel === "call"
                            ? props.intercom.mode === "call"
                                ? "End Call"
                                : "Tap to Call"
                            : props.intercom.mode === "ptt"
                              ? "Release To Stop"
                              : "Hold To Talk"}
                    </Text>
                </TouchableOpacity>
            )}
            </Animated.View>
        </Animated.View>
    );
}
const styles = StyleSheet.create({
    label: { fontSize: 14, textAlign: "center" },
    panel: {
        flex: 1,
        marginTop: 14,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingBottom: 18,
    },
    panelHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    tabs: { flex: 1, flexDirection: "row", justifyContent: "center" },
    tab: {
        paddingHorizontal: 12,
        paddingVertical: 16,
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    selectedTab: { borderBottomColor: ACCENT },
    tabText: { fontSize: 17 },
    panelBody: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 16,
    },
    callControls: {
        flexDirection: "row",
        width: "100%",
        justifyContent: "space-evenly",
    },
    callControl: { alignItems: "center", gap: 8 },
    talkIllustration: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: "#FFF0E0",
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButton: {
        marginHorizontal: 16,
        backgroundColor: ACCENT,
        borderRadius: 18,
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    buttonText: { color: "#FFF", fontSize: 20 },
    feedback: { textAlign: "center", fontSize: 13 },
});
