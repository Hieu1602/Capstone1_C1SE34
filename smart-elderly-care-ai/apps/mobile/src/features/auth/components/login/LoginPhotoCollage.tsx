import React from "react";
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Image,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText } from "../../../../i18n/LocalizedComponents";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const COLLAGE_ITEMS = [
    {
        key: "topLeft",
        uri: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80",
        style: {
            top: -15,
            left: -20,
            width: SCREEN_WIDTH * 0.38,
            height: 220,
            borderRadius: 24,
        },
    },
    {
        key: "topRight",
        uri: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80",
        style: {
            top: -25,
            right: -25,
            width: SCREEN_WIDTH * 0.52,
            height: 145,
            borderRadius: 24,
        },
    },
    {
        key: "center",
        uri: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80",
        style: {
            top: 50,
            left: SCREEN_WIDTH * 0.22,
            width: SCREEN_WIDTH * 0.56,
            height: 275,
            borderRadius: 26,
            zIndex: 10,
            borderWidth: 3,
            borderColor: "#FFFFFF",
        },
    },
    {
        key: "midRight",
        uri: "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=500&q=80",
        style: {
            top: 130,
            right: -30,
            width: SCREEN_WIDTH * 0.35,
            height: 120,
            borderRadius: 22,
            zIndex: 5,
        },
    },
    {
        key: "bottomLeft",
        uri: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80",
        style: {
            bottom: -20,
            left: -15,
            width: SCREEN_WIDTH * 0.44,
            height: 170,
            borderRadius: 24,
            zIndex: 5,
        },
    },
    {
        key: "bottomRight",
        uri: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80",
        style: {
            bottom: -15,
            right: -20,
            width: SCREEN_WIDTH * 0.42,
            height: 155,
            borderRadius: 24,
            zIndex: 4,
        },
    },
] as const;

interface LoginPhotoCollageProps {
    onBack: () => void;
}

export const LoginPhotoCollage: React.FC<LoginPhotoCollageProps> = ({
    onBack,
}) => {
    return (
        <View style={styles.collageContainer}>
            <TouchableOpacity
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Quay lại"
                onPress={onBack}
            >
                <Ionicons name="arrow-back" size={20} color="#0F172A" />
                <LocalizedText style={styles.backButtonText}>Quay lại</LocalizedText>
            </TouchableOpacity>

            {COLLAGE_ITEMS.map((item) => (
                <View key={item.key} style={[styles.card, item.style]}>
                    <Image
                        source={{ uri: item.uri }}
                        style={styles.cardImage}
                        resizeMode="cover"
                    />
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    collageContainer: {
        height: 260,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
    },
    backButton: {
        position: "absolute",
        top: 14,
        left: 16,
        zIndex: 50,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backButtonText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: "600",
        color: "#0F172A",
    },
    card: {
        position: "absolute",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
        backgroundColor: "#F1F5F9",
    },
    cardImage: {
        width: "100%",
        height: "100%",
    },
});
