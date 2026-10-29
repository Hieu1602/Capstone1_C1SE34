import React, { useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";
import { SlideRightModal } from "./SlideRightModal";

const FONT_SCALE_LEVELS = [0.85, 1, 1.15, 1.3, 1.5];

interface FontSizeSettingsModalProps {
    visible: boolean;
    isDarkMode: boolean;
    fontSizeMode: "system" | "custom";
    customFontScale: number;
    onApplyMode: (mode: "system" | "custom") => void;
    onUpdateScale: (scaleIndex: number) => void;
    onClose: () => void;
}

export const FontSizeSettingsModal: React.FC<FontSizeSettingsModalProps> = ({
    visible,
    isDarkMode,
    fontSizeMode,
    customFontScale,
    onApplyMode,
    onUpdateScale,
    onClose,
}) => {
    const [sliderWidth, setSliderWidth] = useState(0);
    const sliderTrackPosition = useRef(0);

    const fontSliderResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const touchX = evt.nativeEvent.locationX;
                updateFontScaleByTouch(touchX);
            },
            onPanResponderMove: (evt) => {
                const touchX = evt.nativeEvent.locationX;
                updateFontScaleByTouch(touchX);
            },
        }),
    ).current;

    const updateFontScaleByTouch = (touchX: number) => {
        if (!sliderWidth) return;
        const clampedX = Math.max(0, Math.min(sliderWidth, touchX));
        const fraction = clampedX / sliderWidth;
        const targetIndex = Math.min(
            FONT_SCALE_LEVELS.length - 1,
            Math.max(0, Math.round(fraction * (FONT_SCALE_LEVELS.length - 1))),
        );
        onUpdateScale(targetIndex);
    };

    return (
        <SlideRightModal visible={visible} onClose={onClose} isDarkMode={isDarkMode}>
            <Pressable
                style={[
                    styles.settingsOverlay,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.settingsSheet,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.settingsHeaderRow}>
                        <TouchableOpacity
                            style={[
                                styles.backButton,
                                styles.settingsBackButton,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="chevron-back-outline"
                                size={24}
                                color={
                                    isDarkMode ? "#F8FAFC" : Colors.textPrimary
                                }
                            />
                        </TouchableOpacity>
                        <Text
                            style={[
                                styles.settingsTitle,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Kích thước phông chữ
                        </Text>
                    </View>

                    <View style={styles.fontSizeList}>
                        <TouchableOpacity
                            style={[
                                styles.fontSizeOption,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                                fontSizeMode === "system" && {
                                    borderColor: Colors.primary,
                                    borderWidth: 1.5,
                                },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => onApplyMode("system")}
                        >
                            <Text
                                style={[
                                    styles.fontSizeOptionText,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Theo hệ thống
                            </Text>
                            {fontSizeMode === "system" && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={22}
                                    color={Colors.primary}
                                />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.fontSizeOption,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                                fontSizeMode === "custom" && {
                                    borderColor: Colors.primary,
                                    borderWidth: 1.5,
                                },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => onApplyMode("custom")}
                        >
                            <Text
                                style={[
                                    styles.fontSizeOptionText,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                            >
                                Tùy chỉnh
                            </Text>
                            {fontSizeMode === "custom" && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={22}
                                    color={Colors.primary}
                                />
                            )}
                        </TouchableOpacity>

                        {fontSizeMode === "custom" && (
                            <View
                                style={[
                                    styles.customFontSliderPanel,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                        borderWidth: 1,
                                        borderRadius: 18,
                                        padding: 16,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.customFontSliderTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Xem trước cỡ chữ
                                </Text>
                                <Text
                                    style={[
                                        styles.customFontSliderTitle,
                                        {
                                            fontSize:
                                                18 *
                                                FONT_SCALE_LEVELS[
                                                    customFontScale
                                                ],
                                            lineHeight:
                                                24 *
                                                FONT_SCALE_LEVELS[
                                                    customFontScale
                                                ],
                                            marginBottom: 12,
                                        },
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Aa - Văn bản mẫu
                                </Text>

                                <View style={styles.customFontSliderRow}>
                                    <Text
                                        style={[
                                            styles.customFontSmall,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        Aa
                                    </Text>

                                    <View
                                        style={styles.customFontTrackWrap}
                                        onLayout={(event) => {
                                            const { width, x } =
                                                event.nativeEvent.layout;
                                            setSliderWidth(width);
                                            sliderTrackPosition.current = x;
                                        }}
                                        {...fontSliderResponder.panHandlers}
                                    >
                                        <View
                                            style={[
                                                styles.customFontTrack,
                                                isDarkMode && {
                                                    backgroundColor: "#334155",
                                                },
                                            ]}
                                        >
                                            {[0, 1, 2, 3, 4].map((value) => (
                                                <View
                                                    key={value}
                                                    style={[
                                                        styles.customFontTick,
                                                        customFontScale ===
                                                            value &&
                                                            styles.customFontTickSelected,
                                                    ]}
                                                />
                                            ))}

                                            <View
                                                style={[
                                                    styles.customFontThumb,
                                                    {
                                                        left: `${(customFontScale / 4) * 100}%`,
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </View>

                                    <Text
                                        style={[
                                            styles.customFontLarge,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Aa
                                    </Text>
                                </View>
                            </View>
                        )}

                        <Text
                            style={[
                                styles.fontSizeNote,
                                isDarkMode && { color: "#94A3B8" },
                            ]}
                        >
                            Nếu một số văn bản hoặc nội dung không được phóng
                            to, hãy nhấn và giữ màn hình để kích hoạt tính năng
                            Zoom.
                        </Text>

                        <Text
                            style={[
                                styles.fontSizeLink,
                                { color: Colors.primary },
                            ]}
                        >
                            Cách sử dụng tính năng Zoom
                        </Text>
                    </View>
                </Pressable>
            </Pressable>
        </SlideRightModal>
    );
};

const styles = StyleSheet.create({
    settingsOverlay: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    settingsSheet: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    settingsHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    settingsBackButton: {
        marginRight: 12,
    },
    settingsTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
    },
    fontSizeList: {
        gap: 12,
    },
    fontSizeOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    fontSizeOptionText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
    customFontSliderPanel: {
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: 18,
        marginTop: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    customFontSliderTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 8,
    },
    customFontSliderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginTop: 8,
    },
    customFontSmall: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748B",
    },
    customFontLarge: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
    },
    customFontTrackWrap: {
        flex: 1,
        height: 36,
        justifyContent: "center",
    },
    customFontTrack: {
        height: 6,
        backgroundColor: "#E2E8F0",
        borderRadius: 3,
        position: "relative",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 2,
    },
    customFontTick: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#94A3B8",
    },
    customFontTickSelected: {
        backgroundColor: Colors.primary,
    },
    customFontThumb: {
        position: "absolute",
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.primary,
        marginLeft: -11,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    fontSizeNote: {
        fontSize: 13,
        color: "#64748B",
        lineHeight: 18,
        marginTop: 12,
    },
    fontSizeLink: {
        fontSize: 13.5,
        fontWeight: "600",
        marginTop: 4,
    },
});

