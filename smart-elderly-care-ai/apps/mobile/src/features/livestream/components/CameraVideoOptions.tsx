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
    icon?: React.ComponentProps<typeof Ionicons>["name"];
    disabled?: boolean;
}
interface Props {
    title: string;
    visible: boolean;
    options: VideoOption[];
    selected?: string | null;
    busy?: boolean;
    message?: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}
/** @param props Dữ liệu lựa chọn và callback. @returns Bottom sheet có lựa chọn hiện tại màu cam. */
export default function CameraVideoOptions(props: Props) {
    const { colors } = useTheme();
    return (
        <Modal
            visible={props.visible}
            transparent
            animationType="slide"
            onRequestClose={props.onClose}
            supportedOrientations={["portrait", "landscape"]}
        >
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    accessibilityLabel="Đóng bảng lựa chọn"
                    onPress={props.onClose}
                />
                <View style={[styles.sheet, { backgroundColor: colors.card }]}>
                    <View style={styles.header}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Đóng"
                            onPress={props.onClose}
                            style={styles.close}
                        >
                            <Ionicons
                                name="close"
                                size={28}
                                color={colors.textPrimary}
                            />
                        </Pressable>
                        <Text
                            style={[
                                styles.title,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {props.title}
                        </Text>
                    </View>
                    <ScrollView contentContainerStyle={styles.content}>
                        {props.busy && <ActivityIndicator color="#ff7a00" />}
                        {props.message ? (
                            <Text
                                accessibilityLiveRegion="polite"
                                style={{
                                    color: colors.textSecondary,
                                    textAlign: "center",
                                }}
                            >
                                {props.message}
                            </Text>
                        ) : null}
                        {props.options.map((option) => {
                            const selected = props.selected === option.value;
                            const color = selected
                                ? "#ff7a00"
                                : colors.textPrimary;
                            return (
                                <Pressable
                                    key={option.value}
                                    accessibilityRole="radio"
                                    accessibilityState={{
                                        selected,
                                        disabled: props.busy || option.disabled,
                                    }}
                                    disabled={props.busy || option.disabled}
                                    onPress={() => props.onSelect(option.value)}
                                    style={[
                                        styles.option,
                                        selected && styles.selected,
                                        option.disabled && { opacity: 0.4 },
                                    ]}
                                >
                                    {option.icon && (
                                        <Ionicons
                                            name={option.icon}
                                            size={26}
                                            color={color}
                                        />
                                    )}
                                    <Text
                                        style={{
                                            color,
                                            fontSize: 20,
                                            fontWeight: selected
                                                ? "600"
                                                : "400",
                                        }}
                                    >
                                        {option.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    sheet: {
        maxHeight: "70%",
        minHeight: "45%",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 24,
    },
    header: { height: 64, alignItems: "center", justifyContent: "center" },
    close: { position: "absolute", left: 12, padding: 10, zIndex: 1 },
    title: { fontSize: 21, fontWeight: "600" },
    content: { padding: 20, gap: 12 },
    option: {
        minHeight: 68,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 14,
    },
    selected: { backgroundColor: "rgba(255,122,0,0.14)" },
});
