import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    ScrollView,
    Image,
    Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";

interface AboutAppModalProps {
    visible: boolean;
    isDarkMode: boolean;
    docData: any;
    onClose: () => void;
}

export const AboutAppModal: React.FC<AboutAppModalProps> = ({
    visible,
    isDarkMode,
    docData,
    onClose,
}) => {
    const [infoDetail, setInfoDetail] = useState<"terms" | "app" | null>(null);

    const handleClose = () => {
        setInfoDetail(null);
        onClose();
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <Pressable
                style={[
                    styles.infoOverlay,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                onPress={handleClose}
            >
                <Pressable
                    style={[
                        styles.infoScreen,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.infoHeaderRow}>
                        <TouchableOpacity
                            style={[
                                styles.backButton,
                                styles.infoBackButton,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                            onPress={() => {
                                if (infoDetail) {
                                    setInfoDetail(null);
                                } else {
                                    handleClose();
                                }
                            }}
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
                                styles.infoTitle,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            {infoDetail === "terms"
                                ? "Điều khoản sử dụng"
                                : infoDetail === "app"
                                  ? "Thông tin ứng dụng"
                                  : "Thông tin"}
                        </Text>
                    </View>

                    {infoDetail === null ? (
                        <View
                            style={[
                                styles.infoListCard,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.infoListRow,
                                    isDarkMode && {
                                        borderBottomColor: "#334155",
                                    },
                                ]}
                                activeOpacity={0.8}
                                onPress={() => setInfoDetail("terms")}
                            >
                                <Text
                                    style={[
                                        styles.infoRowText,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Điều khoản sử dụng
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={Colors.primary}
                                />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.infoListRow,
                                    { borderBottomWidth: 0 },
                                ]}
                                activeOpacity={0.8}
                                onPress={() => setInfoDetail("app")}
                            >
                                <Text
                                    style={[
                                        styles.infoRowText,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Thông tin ứng dụng
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={Colors.primary}
                                />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.infoDetailContent}
                        >
                            {infoDetail === "terms" ? (
                                <>
                                    <Text
                                        style={[
                                            styles.infoDetailHeading,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        Điều khoản sử dụng
                                    </Text>
                                    <Text
                                        style={[
                                            styles.infoDetailText,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        Ứng dụng Smart Elderly Care AI hỗ trợ
                                        theo dõi sức khoẻ, thiết bị và cảnh báo
                                        an toàn cho người cao tuổi. Người dùng
                                        cần cung cấp thông tin chính xác và sử
                                        dụng ứng dụng đúng mục đích.
                                    </Text>
                                    <Text
                                        style={[
                                            styles.infoDetailText,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        Người dùng chịu trách nhiệm bảo mật tài
                                        khoản, mã xác thực và các thiết bị đã
                                        liên kết. Không chia sẻ thông tin đăng
                                        nhập cho người khác.
                                    </Text>
                                    <Text
                                        style={[
                                            styles.infoDetailText,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        Các cảnh báo trong ứng dụng chỉ có tính
                                        chất hỗ trợ theo dõi, không thay thế cho
                                        chẩn đoán hoặc điều trị y tế chuyên môn.
                                    </Text>
                                </>
                            ) : (
                                <View style={styles.appInfoPanel}>
                                    <View
                                        style={[
                                            styles.appInfoIcon,
                                            isDarkMode && {
                                                backgroundColor: "#1E293B",
                                                borderColor: "#334155",
                                            },
                                        ]}
                                    >
                                        <Image
                                            source={require("../../../../../assets/logo.png")}
                                            style={styles.appInfoLogo}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.infoDetailHeading,
                                            isDarkMode && { color: "#F8FAFC" },
                                        ]}
                                    >
                                        {docData?.project_name ||
                                            "Smart Elderly Care AI"}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.appInfoVersion,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        {docData
                                            ? `${docData.project_code} • Phiên bản ${docData.version}`
                                            : "C1SE.34 • Phiên bản 1.0.0"}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.infoDetailText,
                                            isDarkMode && { color: "#94A3B8" },
                                        ]}
                                    >
                                        {docData?.description ||
                                            "Hệ thống giám sát thông minh giúp gia đình theo dõi sức khỏe, thiết bị và nhận cảnh báo kịp thời."}
                                    </Text>

                                    {/* Khối Tổng đài CSKH 24/7 */}
                                    <View
                                        style={[
                                            styles.docHotlineCard,
                                            isDarkMode && {
                                                backgroundColor: "#1E293B",
                                                borderColor: "#334155",
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.docHotlineIconWrap,
                                                { backgroundColor: "#EFF6FF" },
                                            ]}
                                        >
                                            <Ionicons
                                                name="headset"
                                                size={24}
                                                color="#2563EB"
                                            />
                                        </View>
                                        <View
                                            style={{
                                                flex: 1,
                                                marginLeft: 12,
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.docHotlineTitle,
                                                    isDarkMode && {
                                                        color: "#F8FAFC",
                                                    },
                                                ]}
                                            >
                                                Tổng đài hỗ trợ kỹ thuật CSKH
                                                24/7
                                            </Text>
                                            <Text style={styles.docHotlineSub}>
                                                Hỗ trợ kết nối camera, vòng tay,
                                                hub AI
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.docHotlineButton}
                                                activeOpacity={0.8}
                                                onPress={() =>
                                                    Linking.openURL(
                                                        "tel:0898230852",
                                                    )
                                                }
                                            >
                                                <Ionicons
                                                    name="call"
                                                    size={15}
                                                    color="#FFFFFF"
                                                />
                                                <Text
                                                    style={
                                                        styles.docHotlineButtonText
                                                    }
                                                >
                                                    Gọi ngay: 0898230852
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    infoOverlay: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    infoScreen: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    infoHeaderRow: {
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
    infoBackButton: {
        marginRight: 12,
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
    },
    infoListCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    infoListRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    infoRowText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
    infoDetailContent: {
        paddingBottom: 40,
    },
    infoDetailHeading: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 12,
    },
    infoDetailText: {
        fontSize: 14,
        color: "#64748B",
        lineHeight: 22,
        marginBottom: 14,
    },
    appInfoPanel: {
        alignItems: "center",
        paddingVertical: 10,
    },
    appInfoIcon: {
        width: 80,
        height: 80,
        borderRadius: 22,
        backgroundColor: "#FFF7ED",
        borderWidth: 1,
        borderColor: "#FED7AA",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 14,
    },
    appInfoLogo: {
        width: 52,
        height: 52,
    },
    appInfoVersion: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748B",
        marginBottom: 14,
    },
    docHotlineCard: {
        flexDirection: "row",
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: 16,
        width: "100%",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginTop: 10,
    },
    docHotlineIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    docHotlineTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 2,
    },
    docHotlineSub: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 8,
    },
    docHotlineButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#2563EB",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignSelf: "flex-start",
    },
    docHotlineButtonText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});

