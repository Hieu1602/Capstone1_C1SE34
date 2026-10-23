import React, { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText as Text } from "../../i18n/LocalizedComponents";
import { Colors, Shadows } from "../../theme/colors";
import { useTheme } from "../../store/useThemeStore";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
interface Props {
    visible: boolean;
    feedback: string | null;
    onClose: () => void;
    onSettings: () => void;
    onMove: (direction: Direction) => void;
    onAddPreset: (index: number) => void;
}

export default function PanTiltControlSheet({
    visible,
    feedback,
    onClose,
    onSettings,
    onMove,
    onAddPreset,
}: Props) {
    const { colors, isDarkMode } = useTheme();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [tab, setTab] = useState<"pan" | "patrol">("pan");
    const diameter = Math.min(240, width - 80, Math.max(176, height * 0.28));
    const mutedSurface = isDarkMode ? colors.background : Colors.surfaceSubtle;
    const directions: {
        direction: Direction;
        icon: "caret-up" | "caret-down" | "caret-back" | "caret-forward";
        label: string;
        position: object;
    }[] = [
        {
            direction: "UP",
            icon: "caret-up",
            label: "Xoay lên",
            position: { top: 4, left: "50%", marginLeft: -24 },
        },
        {
            direction: "DOWN",
            icon: "caret-down",
            label: "Xoay xuống",
            position: { bottom: 4, left: "50%", marginLeft: -24 },
        },
        {
            direction: "LEFT",
            icon: "caret-back",
            label: "Xoay trái",
            position: { left: 4, top: "50%", marginTop: -24 },
        },
        {
            direction: "RIGHT",
            icon: "caret-forward",
            label: "Xoay phải",
            position: { right: 4, top: "50%", marginTop: -24 },
        },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            onShow={() => setTab("pan")}
        >
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng bảng điều khiển"
                />
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            maxHeight: height * 0.78,
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Đóng điều khiển"
                            onPress={onClose}
                            style={styles.iconButton}
                        >
                            <Ionicons
                                name="close"
                                size={26}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                        <View style={styles.tabs} accessibilityRole="tablist">
                            {(
                                [
                                    { id: "pan", label: "Pan/Tilt" },
                                    { id: "patrol", label: "Patrol" },
                                ] as const
                            ).map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    accessibilityRole="tab"
                                    accessibilityState={{
                                        selected: tab === item.id,
                                    }}
                                    onPress={() => setTab(item.id)}
                                    style={[
                                        styles.tab,
                                        {
                                            borderBottomColor:
                                                tab === item.id
                                                    ? Colors.primary
                                                    : "transparent",
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.tabText,
                                            {
                                                color:
                                                    tab === item.id
                                                        ? Colors.primary
                                                        : colors.textSecondary,
                                            },
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Cài đặt camera"
                            onPress={onSettings}
                            style={styles.iconButton}
                        >
                            <Ionicons
                                name="options-outline"
                                size={24}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        bounces={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.content}
                    >
                        {tab === "pan" ? (
                            <>
                                <View style={styles.controllerArea}>
                                    <View
                                        style={[
                                            styles.dial,
                                            {
                                                width: diameter,
                                                height: diameter,
                                                borderRadius: diameter / 2,
                                                backgroundColor: mutedSurface,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                    >
                                        {/* Bốn vạch chia hướng và vòng tâm không mang chức năng Home giả. */}
                                        {[45, 135, 225, 315].map((angle) => (
                                            <View
                                                key={angle}
                                                pointerEvents="none"
                                                style={[
                                                    styles.dividerArm,
                                                    {
                                                        width:
                                                            diameter * 0.5 - 16,
                                                        transform: [
                                                            {
                                                                rotate: `${angle}deg`,
                                                            },
                                                        ],
                                                    },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.divider,
                                                        {
                                                            backgroundColor:
                                                                colors.border,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        ))}
                                        <View
                                            pointerEvents="none"
                                            style={[
                                                styles.centerRing,
                                                {
                                                    backgroundColor:
                                                        colors.card,
                                                    borderColor: Colors.primary,
                                                },
                                            ]}
                                        />
                                        {directions.map((item) => (
                                            <TouchableOpacity
                                                key={item.direction}
                                                accessibilityRole="button"
                                                accessibilityLabel={item.label}
                                                activeOpacity={0.55}
                                                onPress={() =>
                                                    onMove(item.direction)
                                                }
                                                style={[
                                                    styles.direction,
                                                    item.position,
                                                ]}
                                            >
                                                <Ionicons
                                                    name={item.icon}
                                                    size={24}
                                                    color={Colors.primary}
                                                />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <Text
                                    accessibilityLiveRegion="polite"
                                    numberOfLines={2}
                                    style={[
                                        styles.feedback,
                                        { color: colors.textSecondary },
                                    ]}
                                >
                                    {feedback || " "}
                                </Text>
                                <View style={styles.presets}>
                                    {[0, 1, 2, 3].map((index) => (
                                        <TouchableOpacity
                                            key={index}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Thêm vị trí ${index + 1}`}
                                            onPress={() => onAddPreset(index)}
                                            activeOpacity={0.65}
                                            style={[
                                                styles.preset,
                                                {
                                                    borderColor: colors.border,
                                                    backgroundColor:
                                                        mutedSurface,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="add"
                                                size={30}
                                                color={colors.textMuted}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        ) : (
                            <View
                                style={[
                                    styles.patrol,
                                    { minHeight: diameter + 100 },
                                ]}
                            >
                                <Ionicons
                                    name="scan-outline"
                                    size={38}
                                    color={Colors.primary}
                                />
                                <Text
                                    style={[
                                        styles.patrolTitle,
                                        { color: colors.textPrimary },
                                    ]}
                                >
                                    Tuần tra camera
                                </Text>
                                <Text
                                    style={[
                                        styles.patrolDescription,
                                        { color: colors.textSecondary },
                                    ]}
                                >
                                    Chức năng tuần tra chưa được kết nối với
                                    camera này.
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end" },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        paddingTop: 8,
        ...Shadows.card,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
    },
    iconButton: {
        width: 44,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    tabs: { flex: 1, flexDirection: "row", justifyContent: "center" },
    tab: {
        minHeight: 48,
        paddingHorizontal: 16,
        justifyContent: "center",
        borderBottomWidth: 3,
    },
    tabText: { fontSize: 16, fontWeight: "700" },
    content: { paddingHorizontal: 20, paddingBottom: 8 },
    controllerArea: {
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 30,
        paddingBottom: 12,
    },
    dial: { borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    direction: {
        position: "absolute",
        width: 48,
        height: 48,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 24,
    },
    centerRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 5 },
    dividerArm: { position: "absolute", height: 1, alignItems: "flex-end" },
    divider: { height: 1, width: 18 },
    feedback: {
        minHeight: 36,
        textAlign: "center",
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 12,
    },
    presets: { flexDirection: "row", gap: 10 },
    preset: {
        flex: 1,
        height: 60,
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    patrol: {
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
    },
    patrolTitle: { fontSize: 16, fontWeight: "700" },
    patrolDescription: { fontSize: 13, lineHeight: 20, textAlign: "center" },
});
