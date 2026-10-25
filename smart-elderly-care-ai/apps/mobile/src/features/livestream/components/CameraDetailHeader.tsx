/**
 * Hiển thị tên camera cùng nút quay lại và mở cài đặt.
 */
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import { useTheme } from "../../../store/useThemeStore";

interface Props {
    name: string;
    onBack: () => void;
    onSettings: () => void;
}

/**
 * Dựng Header của màn hình chi tiết camera.
 * @param props - Thông tin và callback của Header.
 * @param props.name - Tên camera hiển thị.
 * @param props.onBack - Callback quay về màn hình trước.
 * @param props.onSettings - Callback mở cài đặt camera.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function CameraDetailHeader({
    name,
    onBack,
    onSettings,
}: Props) {
    const { colors } = useTheme();
    return (
        <View style={[styles.header, { backgroundColor: colors.card }]}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Quay lại"
                style={styles.button}
                onPress={onBack}
            >
                <Ionicons
                    name="chevron-back"
                    size={28}
                    color={colors.textPrimary}
                />
            </TouchableOpacity>
            <Text
                numberOfLines={1}
                style={[styles.title, { color: colors.textPrimary }]}
            >
                {name}
            </Text>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cài đặt camera"
                style={styles.button}
                onPress={onSettings}
            >
                <Ionicons
                    name="settings-outline"
                    size={25}
                    color={colors.textPrimary}
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
    button: {
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
});
