/** Bảng chọn chất lượng, chế độ ngày/đêm và nguồn thêm vào lưới camera. */
import React from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../store/useThemeStore";

export interface VideoOption {
    value: string;
    label: string;
    subtitle?: string;
    badge?: string;
    icon?: React.ComponentProps<typeof Ionicons>["name"];
    disabled?: boolean;
}
interface Props {
    title: string;
    visible: boolean;
    options: VideoOption[];
    selected?: string | null;
    busy?: boolean;
    inline?: boolean;
    message?: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}
/** @param props Dữ liệu lựa chọn và callback. @returns Bottom sheet có lựa chọn hiện tại màu cam. */
export default function CameraVideoOptions(props: Props) {
    const { colors, isDarkMode } = useTheme();
    const borderSubtle = isDarkMode ? colors.border : "#E2E8F0";

    const content = (
        <View style={[styles.overlay, props.inline && styles.landscapeOverlay]}>
            <Pressable
                style={StyleSheet.absoluteFill}
                accessibilityLabel="Đóng bảng lựa chọn"
                onPress={props.onClose}
            />
            <View
                style={[
                    styles.sheet,
                    props.inline && styles.landscapeSheet,
                    { backgroundColor: colors.card },
                ]}
            >
                <View
                    style={[
                        styles.handle,
                        { backgroundColor: isDarkMode ? colors.border : "#CBD5E1" },
                    ]}
                />
                <View
                    style={[
                        styles.header,
                        { borderBottomColor: borderSubtle },
                    ]}
                >
                    <View style={styles.headerSpacer} />
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {props.title}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Đóng"
                        onPress={props.onClose}
                        style={[
                            styles.close,
                            {
                                backgroundColor: isDarkMode
                                    ? colors.surfaceSubtle
                                    : "#F1F5F9",
                            },
                        ]}
                    >
                        <Ionicons
                            name="close"
                            size={20}
                            color={colors.textPrimary}
                        />
                    </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.content}>
                    {props.busy && <ActivityIndicator color="#FF7A00" />}
                    {props.message ? (
                        <View
                            style={[
                                styles.messageBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? colors.surfaceSubtle
                                        : "#F8FAFC",
                                    borderColor: borderSubtle,
                                },
                            ]}
                        >
                            <Ionicons
                                name="information-circle-outline"
                                size={18}
                                color={colors.textSecondary}
                            />
                            <Text
                                accessibilityLiveRegion="polite"
                                style={[
                                    styles.messageText,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                {props.message}
                            </Text>
                        </View>
                    ) : null}
                    {props.options.map((option) => {
                        const selected = props.selected === option.value;
                        const disabled = Boolean(props.busy || option.disabled);
                        const cardBg = selected
                            ? isDarkMode
                                ? "rgba(255,122,0,0.16)"
                                : "#FFF7ED"
                            : option.disabled
                              ? isDarkMode
                                  ? colors.surfaceSubtle
                                  : "#F8FAFC"
                              : isDarkMode
                                ? colors.surfaceSubtle
                                : "#FFFFFF";
                        const cardBorder = selected ? "#FF7A00" : borderSubtle;
                        const iconBg = selected
                            ? isDarkMode
                                ? "rgba(255,122,0,0.22)"
                                : "#FFEDD5"
                            : option.disabled
                              ? isDarkMode
                                  ? "#1E293B"
                                  : "#E2E8F0"
                              : isDarkMode
                                ? "#082F49"
                                : "#E0F2FE";
                        const iconColor = selected
                            ? "#FF7A00"
                            : option.disabled
                              ? colors.textSecondary
                              : isDarkMode
                                ? "#38BDF8"
                                : "#0284C7";
                        const labelColor = selected
                            ? isDarkMode
                                ? "#FDBA74"
                                : "#C2410C"
                            : option.disabled
                              ? colors.textSecondary
                              : colors.textPrimary;

                        return (
                            <Pressable
                                key={option.value}
                                accessibilityRole="radio"
                                accessibilityState={{
                                    selected,
                                    disabled,
                                }}
                                disabled={disabled}
                                onPress={() => props.onSelect(option.value)}
                                style={({ pressed }) => [
                                    styles.option,
                                    !isDarkMode &&
                                        !option.disabled &&
                                        styles.optionShadow,
                                    {
                                        backgroundColor: cardBg,
                                        borderColor: cardBorder,
                                    },
                                    pressed && !disabled && { opacity: 0.85 },
                                ]}
                            >
                                <View style={styles.optionLeft}>
                                    {option.icon && (
                                        <View
                                            style={[
                                                styles.iconBox,
                                                { backgroundColor: iconBg },
                                            ]}
                                        >
                                            <Ionicons
                                                name={option.icon}
                                                size={20}
                                                color={iconColor}
                                            />
                                        </View>
                                    )}
                                    <View style={styles.optionTextWrap}>
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.optionLabel,
                                                { color: labelColor },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                        {option.subtitle ? (
                                            <Text
                                                numberOfLines={1}
                                                style={[
                                                    styles.optionSub,
                                                    {
                                                        color: colors.textSecondary,
                                                    },
                                                ]}
                                            >
                                                {option.subtitle}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                                {option.badge ? (
                                    <View
                                        style={[
                                            styles.badge,
                                            {
                                                backgroundColor: isDarkMode
                                                    ? "#1E293B"
                                                    : "#E2E8F0",
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.badgeText,
                                                { color: colors.textSecondary },
                                            ]}
                                        >
                                            {option.badge}
                                        </Text>
                                    </View>
                                ) : selected ? (
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={22}
                                        color="#FF7A00"
                                    />
                                ) : !option.disabled ? (
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={colors.textMuted}
                                    />
                                ) : null}
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
    // Bảng nằm trong modal toàn màn hình để không tạo modal thứ hai trên iOS.
    if (props.inline)
        return props.visible ? (
            <View style={styles.inline}>{content}</View>
        ) : null;
    return (
        <Modal
            visible={props.visible}
            transparent
            animationType="slide"
            onRequestClose={props.onClose}
            supportedOrientations={["portrait", "landscape"]}
        >
            {content}
        </Modal>
    );
}
const styles = StyleSheet.create({
    inline: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    landscapeOverlay: {
        justifyContent: "center",
        alignItems: "flex-end",
        padding: 12,
    },
    landscapeSheet: {
        width: 360,
        maxWidth: "90%",
        maxHeight: "100%",
        borderRadius: 20,
        paddingBottom: 12,
    },
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(15, 23, 42, 0.4)",
    },
    sheet: {
        maxHeight: "70%",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 24,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: "center",
        marginTop: 10,
    },
    header: {
        height: 54,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerSpacer: {
        width: 36,
    },
    close: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
    },
    content: {
        padding: 16,
        gap: 10,
    },
    messageBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
    },
    messageText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    option: {
        minHeight: 62,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    optionShadow: {
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 1,
    },
    optionLeft: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    optionTextWrap: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 15,
        fontWeight: "700",
    },
    optionSub: {
        fontSize: 12,
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "600",
    },
});
