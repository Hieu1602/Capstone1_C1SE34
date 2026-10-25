/**
 * Liệt kê camera dạng lưới/danh sách, xem luồng được backend hỗ trợ và mở chi tiết.
 */
import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Shadows } from "../../../theme/colors";
import { useDeviceStore } from "../../../store/useDeviceStore";
import { useCameraConnection } from "../hooks/useCameraConnection";
import { CameraLiveView } from "../components/CameraLiveView";
import { useTheme } from "../../../store/useThemeStore";
import {
    LocalizedAlert,
    LocalizedText,
} from "../../../i18n/LocalizedComponents";
import { launchEmergencyCall } from "../../../services/emergency";
// Cấu trúc dữ liệu cho một kênh truyền phát Camera trong chế độ Multi-View
interface CameraFeed {
    id: string;
    name: string;
    room: string;
    isOnline: boolean;
}
interface Props {
    navigation: {
        goBack: () => void;
        canGoBack: () => boolean;
        navigate: (
            screen: "Main" | "CameraDetail",
            params: {
                screen?: "Home" | "Devices";
                cameraId?: string;
                cameraName?: string;
                room?: string;
            },
        ) => void;
    };
}
/**
 * Dựng danh sách thiết bị camera và gắn live vào ID khớp backend.
 * @param props - Điều hướng của màn hình giám sát.
 * @param props.navigation - Mở camera chi tiết, Trang chủ hoặc Thiết bị.
 * @returns Cây giao diện React theo props và theme hiện tại.
 * @remarks Tải trạng thái nguồn mặc định để xem trước; mở Camera Detail để chọn nhiều nguồn.
 */
export default function MultiViewScreen({ navigation }: Props) {
    const { isDarkMode } = useTheme();
    const { house, iotDevices } = useDeviceStore();
    const connection = useCameraConnection();
    // Bố cục danh sách camera: lưới hoặc danh sách dọc.
    const [layoutMode, setLayoutMode] = useState<"GRID" | "LIST">("GRID");
    // Lọc danh sách các thiết bị thuộc nhóm Camera từ danh sách thiết bị IoT thực tế
    const configuredCameras = (iotDevices || []).filter(
        (d) => d.type.toLowerCase() === "camera",
    );
    const cameraFeeds: CameraFeed[] = configuredCameras.map((dev) => ({
        id: dev.id,
        name: dev.name,
        room: dev.location || "Phòng giám sát",
        isOnline: dev.isOnline,
    }));
    /**
     * Mở Camera Detail với camera được chọn từ danh sách.
     * @param feed - ID, tên và phòng của camera được chạm.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Điều hướng sang màn hình CameraDetail.
     */
    const handleOpenDetail = (feed: CameraFeed) => {
        navigation.navigate("CameraDetail", {
            cameraId: feed.id,
            cameraName: feed.name,
            room: feed.room,
        });
    };
    const isGrid = layoutMode === "GRID";
    const bgMain = isDarkMode ? "#0F172A" : "#F1F5F9";
    const bgCard = isDarkMode ? "#1E293B" : "#FFFFFF";
    const borderCol = isDarkMode ? "#334155" : "#E2E8F0";
    const textTitle = isDarkMode ? "#FFF" : "#0F172A";
    const textSub = isDarkMode ? "#94A3B8" : "#64748B";
    return (
        <SafeAreaView
            style={[styles.safeArea, { backgroundColor: bgMain }]}
            edges={["top", "bottom"]}
        >
            {/* 1. Header */}
            <View
                style={[
                    styles.headerRow,
                    {
                        backgroundColor: isDarkMode ? "#111827" : "#FFFFFF",
                        borderBottomColor: borderCol,
                    },
                ]}
            >
                <View style={styles.headerLeftGroup}>
                    <TouchableOpacity
                        style={[
                            styles.backBtn,
                            {
                                backgroundColor: isDarkMode
                                    ? "#1F2937"
                                    : "#F1F5F9",
                            },
                        ]}
                        onPress={() =>
                            navigation.canGoBack()
                                ? navigation.goBack()
                                : navigation.navigate("Main", {
                                      screen: "Home",
                                  })
                        }
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={24}
                            color={textTitle}
                        />
                    </TouchableOpacity>

                    <View style={{ marginLeft: 8 }}>
                        <LocalizedText
                            style={[styles.headerTitle, { color: textTitle }]}
                        >
                            Nhiều Chế Độ Xem
                        </LocalizedText>
                        <LocalizedText
                            style={[styles.headerSub, { color: textSub }]}
                        >
                            {house?.name || "Nhà của tôi"} •{" "}
                            {cameraFeeds.length} Kênh Camera
                        </LocalizedText>
                    </View>
                </View>

                <View style={styles.headerRightActions}>
                    <TouchableOpacity
                        style={[
                            styles.headerActionBtn,
                            isGrid
                                ? styles.btnActiveGrid
                                : {
                                      backgroundColor: isDarkMode
                                          ? "#1F2937"
                                          : "#F1F5F9",
                                      borderColor: borderCol,
                                  },
                        ]}
                        onPress={() => setLayoutMode("GRID")}
                        activeOpacity={0.8}
                        accessibilityLabel="Lưới 2x2"
                    >
                        <Ionicons
                            name="grid"
                            size={18}
                            color={isGrid ? "#FFF" : textSub}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.headerActionBtn,
                            { marginLeft: 8 },
                            !isGrid
                                ? styles.btnActiveList
                                : {
                                      backgroundColor: isDarkMode
                                          ? "#1F2937"
                                          : "#F1F5F9",
                                      borderColor: borderCol,
                                  },
                        ]}
                        onPress={() => setLayoutMode("LIST")}
                        activeOpacity={0.8}
                        accessibilityLabel="Danh sách"
                    >
                        <Ionicons
                            name="list"
                            size={20}
                            color={!isGrid ? "#FFF" : textSub}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. Container */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                    isGrid ? styles.gridContainer : styles.listContainer
                }
            >
                {cameraFeeds.length === 0 ? (
                    <View
                        style={[
                            styles.emptyContainer,
                            { backgroundColor: bgCard, borderColor: borderCol },
                        ]}
                    >
                        <View style={styles.emptyIconCircle}>
                            <Ionicons
                                name="videocam-outline"
                                size={40}
                                color={isDarkMode ? "#64748B" : "#94A3B8"}
                            />
                        </View>
                        <LocalizedText
                            style={[styles.emptyTitle, { color: textTitle }]}
                        >
                            Chưa có Camera nào được kết nối
                        </LocalizedText>
                        <LocalizedText
                            style={[styles.emptyDesc, { color: textSub }]}
                        >
                            Hệ thống chưa ghi nhận luồng camera giám sát trong
                            căn nhà này. Bạn có thể thêm thiết bị mới tại tab
                            Thiết bị.
                        </LocalizedText>
                        <TouchableOpacity
                            style={styles.addDeviceBtn}
                            onPress={() =>
                                navigation.navigate("Main", {
                                    screen: "Devices",
                                })
                            }
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={18} color="#FFF" />
                            <LocalizedText style={styles.addDeviceBtnText}>
                                Thêm Camera Giám Sát
                            </LocalizedText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    cameraFeeds.map((feed) => {
                        // Backend hiện chỉ cung cấp một camera, đối chiếu ID trước khi phát.
                        const matchesConnection = [
                            connection.status?.id,
                            connection.status?.device_id,
                        ].includes(feed.id);
                        return (
                            <TouchableOpacity
                                key={feed.id}
                                style={[
                                    isGrid ? styles.gridCard : styles.listCard,
                                    {
                                        backgroundColor: bgCard,
                                        borderColor: borderCol,
                                    },
                                ]}
                                activeOpacity={0.9}
                                onPress={() => handleOpenDetail(feed)}
                            >
                                <View
                                    style={[
                                        styles.videoBox,
                                        isGrid
                                            ? styles.videoBoxGrid
                                            : styles.videoBoxList,
                                    ]}
                                >
                                    {matchesConnection ? (
                                        <CameraLiveView
                                            connection={connection}
                                        />
                                    ) : (
                                        <View style={styles.placeholderBox}>
                                            <Ionicons
                                                name="videocam-outline"
                                                size={32}
                                                color="#64748B"
                                            />
                                            <LocalizedText
                                                style={[
                                                    styles.placeholderText,
                                                    { color: textSub },
                                                ]}
                                            >
                                                {feed.name}
                                            </LocalizedText>
                                        </View>
                                    )}

                                    {/* Top Overlay */}
                                    <View
                                        style={[
                                            styles.feedTopOverlay,
                                            { padding: isGrid ? 5 : 8 },
                                        ]}
                                    >
                                        <View style={styles.roomBadge}>
                                            <View
                                                style={[
                                                    styles.statusDot,
                                                    {
                                                        backgroundColor:
                                                            feed.isOnline
                                                                ? "#10B981"
                                                                : "#EF4444",
                                                    },
                                                ]}
                                            />
                                            <LocalizedText
                                                style={[
                                                    styles.badgeText,
                                                    {
                                                        fontSize: isGrid
                                                            ? 10
                                                            : 11,
                                                    },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {feed.room}
                                            </LocalizedText>
                                        </View>
                                    </View>
                                </View>

                                {/* Footer for List Mode */}
                                {!isGrid && (
                                    <View
                                        style={[
                                            styles.listCardFooter,
                                            {
                                                backgroundColor: isDarkMode
                                                    ? "#1E293B"
                                                    : "#F8FAFC",
                                            },
                                        ]}
                                    >
                                        <LocalizedText
                                            style={[
                                                styles.listCardTitle,
                                                { color: textTitle },
                                            ]}
                                        >
                                            {feed.name}
                                        </LocalizedText>
                                        <LocalizedText
                                            style={[
                                                styles.listCardSub,
                                                { color: textSub },
                                            ]}
                                        >
                                            {feed.room}
                                        </LocalizedText>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}

                {/* Info Banner */}
                {cameraFeeds.length > 0 && (
                    <View
                        style={[
                            styles.noticeBox,
                            {
                                backgroundColor: isDarkMode
                                    ? "rgba(255,122,0,0.12)"
                                    : "#FFF0E0",
                                borderColor: isDarkMode
                                    ? "rgba(255,122,0,0.25)"
                                    : "#FFD5AD",
                            },
                        ]}
                    >
                        <Ionicons
                            name="information-circle-outline"
                            size={18}
                            color={isDarkMode ? "#ff7a00" : "#ff7a00"}
                        />
                        <LocalizedText
                            style={[
                                styles.noticeText,
                                { color: isDarkMode ? "#FFD5AD" : "#C45E00" },
                            ]}
                        >
                            {isGrid
                                ? "Chạm vào ô camera bất kỳ để phóng to & xem chi tiết."
                                : "Ch?m v?o camera ?? m? m?n h?nh chi ti?t."}
                        </LocalizedText>
                    </View>
                )}
            </ScrollView>

            {/* 3. Bottom Bar */}
            <View
                style={[
                    styles.bottomBar,
                    {
                        backgroundColor: isDarkMode ? "#111827" : "#FFFFFF",
                        borderTopColor: borderCol,
                    },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.backHomeBtn,
                        { backgroundColor: isDarkMode ? "#374151" : "#F1F5F9" },
                    ]}
                    onPress={() =>
                        navigation.navigate("Main", { screen: "Home" })
                    }
                    activeOpacity={0.8}
                >
                    <Ionicons name="home-outline" size={19} color={textTitle} />
                    <LocalizedText
                        style={[styles.backHomeBtnText, { color: textTitle }]}
                    >
                        Quay Về Trang Chủ
                    </LocalizedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.sosActionBtn}
                    onPress={() => {
                        LocalizedAlert.alert(
                            "🚨 KÍCH HOẠT SOS 115",
                            "Thông báo người thân và gọi cấp cứu 115 ngay bây giờ?",
                            [
                                { text: "Hủy", style: "cancel" },
                                {
                                    text: "Gọi 115",
                                    style: "destructive",
                                    onPress: () => {
                                        void launchEmergencyCall()
                                            .then(() =>
                                                LocalizedAlert.alert(
                                                    "Đã kích hoạt",
                                                    "Đang mở trình gọi khẩn cấp 115.",
                                                ),
                                            )
                                            .catch((err) =>
                                                console.warn(
                                                    "[MultiViewScreen] Emergency call error:",
                                                    err,
                                                ),
                                            );
                                    },
                                },
                            ],
                        );
                    }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="call" size={18} color="#FFF" />
                    <LocalizedText style={styles.sosActionBtnText}>
                        SOS 115
                    </LocalizedText>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerLeftGroup: { flexDirection: "row", alignItems: "center", flex: 1 },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: { fontSize: 17, fontWeight: "800" },
    headerSub: { fontSize: 11, marginTop: 2 },
    headerRightActions: { flexDirection: "row", alignItems: "center" },
    headerActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
    },
    btnActiveGrid: {
        backgroundColor: "#F97316",
        borderColor: "#FB923C",
        ...Shadows.soft,
    },
    btnActiveList: {
        backgroundColor: "#ff7a00",
        borderColor: "#ff7a00",
        ...Shadows.soft,
    },
    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 10,
    },
    listContainer: { padding: 14, paddingBottom: 10 },
    gridCard: {
        width: "48.8%",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 10,
        borderWidth: 1,
        ...Shadows.card,
    },
    listCard: {
        width: "100%",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 16,
        borderWidth: 1,
        ...Shadows.card,
    },
    videoBox: {
        width: "100%",
        position: "relative",
        backgroundColor: "#0B0F19",
    },
    videoBoxGrid: { aspectRatio: 4 / 3 },
    videoBoxList: { height: 190 },
    placeholderBox: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        padding: 10,
    },
    placeholderText: {
        fontSize: 10,
        textAlign: "center",
        marginTop: 6,
        fontWeight: "600",
    },
    feedTopOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 2,
    },
    roomBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(15,23,42,0.85)",
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        maxWidth: "65%",
    },
    statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
    badgeText: { fontWeight: "700", color: "#FFF" },
    listCardFooter: { padding: 12 },
    listCardTitle: { fontSize: 15, fontWeight: "800" },
    listCardSub: { fontSize: 11, marginTop: 2 },
    noticeBox: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        padding: 10,
        marginVertical: 8,
        borderWidth: 1,
    },
    noticeText: { flex: 1, marginLeft: 8, fontSize: 11.5, lineHeight: 16 },
    emptyContainer: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        borderRadius: 18,
        borderWidth: 1,
        marginVertical: 20,
    },
    emptyIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "rgba(148,163,184,0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: "800",
        marginBottom: 6,
        textAlign: "center",
    },
    emptyDesc: {
        fontSize: 12,
        textAlign: "center",
        lineHeight: 18,
        marginBottom: 16,
        paddingHorizontal: 12,
    },
    addDeviceBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ff7a00",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    addDeviceBtnText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
    bottomBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        gap: 12,
    },
    backHomeBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 46,
        borderRadius: 14,
        gap: 8,
    },
    backHomeBtnText: { fontSize: 14, fontWeight: "700" },
    sosActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 46,
        paddingHorizontal: 20,
        backgroundColor: Colors.danger,
        borderRadius: 14,
        gap: 6,
        ...Shadows.card,
    },
    sosActionBtnText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});
