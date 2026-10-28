/**
 * Ghép Header, Live View, thanh thao tác, lưới chức năng, danh sách Playback và SOS.
 */
import React, { useState, useEffect } from "react";
import {
    Linking,
    Modal,
    ScrollView,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
    LocalizedAlert,
    LocalizedText as Text,
} from "../../../i18n/LocalizedComponents";
import { useTheme } from "../../../store/useThemeStore";
import { useAlertStore } from "../../../store/useAlertStore";
import { useAuthStore } from "../../../store/useAuthStore";
import { launchEmergencyCall } from "../../../services/emergency";
import CameraViewer from "../components/CameraViewer";
import CameraTimeline from "../components/CameraTimeline";
import type { VideoQuality } from "../../../services/camera";
import { useCameraConnection } from "../hooks/useCameraConnection";
import { useCameraIntercom } from "../hooks/useCameraIntercom";
import CameraDetailHeader from "../components/CameraDetailHeader";
import CameraSettings from "../components/CameraSettings";
import QuickActionBar from "../components/QuickActionBar";
import FunctionGrid from "../components/FunctionGrid";
import CameraControlPanel, {
    CameraPanel,
} from "../components/CameraControlPanel";
import CameraControlIcon from "../components/CameraControlIcon";
import type { CameraMoveDirection } from "../hooks/useCameraConnection";
import { cameraDetailStyles as styles } from "./cameraDetailStyles";
interface Props {
    navigation: {
        goBack: () => void;
    };
    route?: {
        params?: {
            cameraId?: string;
            cameraName?: string;
            room?: string;
        };
    };
}
type DetailSheet = "settings" | "recordings" | null;
/**
 * Ghép các component với hook video/audio và modal bản ghi/cài đặt.
 * @param props - Điều hướng và tham số camera.
 * @param props.navigation - Bộ điều hướng dùng cho thao tác quay lại.
 * @param props.route - ID, tên và phòng của camera được chọn.
 * @returns Cây giao diện React theo props và theme hiện tại.
 * @remarks Tác động: Các hook quản lý kết nối; thao tác SOS và mở video sự kiện có thể rời ứng dụng.
 */
export default function CameraDetailScreen({ navigation, route }: Props) {
    const { colors } = useTheme();
    const { permissions, userRole, role } = useAuthStore();
    const isOwnerOrAdmin = userRole === 'admin' || role === 'admin' || permissions?.is_owner === true || permissions?.role_in_house === 'OWNER';
    const canViewCamera = isOwnerOrAdmin || Boolean(permissions?.can_view_camera);

    useEffect(() => {
        if (!canViewCamera) {
            LocalizedAlert.alert(
                "Không có quyền truy cập",
                "Chủ hộ đã tắt quyền xem camera đối với tài khoản này. Vui lòng liên hệ Chủ hộ để được mở quyền."
            );
            navigation.goBack();
        }
    }, [canViewCamera]);

    // Camera viền cam là đích chung của PTZ, ghi hình, snapshot và đàm thoại.
    const [selectedCameraId, setSelectedCameraId] = useState(
        route?.params?.cameraId,
    );
    const [quality, setQuality] = useState<VideoQuality>("auto");
    const connection = useCameraConnection(selectedCameraId, quality);
    const intercom = useCameraIntercom(connection, selectedCameraId);
    const incidents = useAlertStore((state) => state.incidents);
    // Panel Talk/Call/Pan-Tilt đang mở; null để hiện Function Grid.
    const [panel, setPanel] = useState<CameraPanel>(null);
    // Modal cài đặt hoặc danh sách Playback đang hiển thị.
    const [sheet, setSheet] = useState<DetailSheet>(null);
    // Thông báo xác nhận lệnh PTZ trong panel.
    const [feedback, setFeedback] = useState<string | null>(null);
    /**
     * Mở/đóng modal cài đặt hoặc Playback sau khi dừng audio.
     * @param next - settings, recordings hoặc null để đóng.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Đóng intercom và cập nhật modal đang chọn.
     */
    const openSheet = (next: DetailSheet) => {
        intercom.stop();
        setSheet(next);
    };
    /**
     * Chuyển panel Talk/Voice Call/Pan-Tilt hoặc đóng panel.
     * @param next - Panel mới; null để trở về Function Grid.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Dừng intercom và xóa phản hồi PTZ cũ.
     */
    const changePanel = (next: CameraPanel) => {
        intercom.stop();
        setPanel(next);
        setFeedback(null);
    };
    const name =
        connection.status?.name || route?.params?.cameraName || "Camera";
    const textStyle = { color: colors.textPrimary };
    const cardStyle = { backgroundColor: colors.card };
    /**
     * Thông báo một chức năng chưa được dịch vụ camera hỗ trợ.
     * @param feature - Tên chức năng để làm tiêu đề thông báo.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Hiển thị hộp thoại thông tin.
     */
    const unsupported = (feature: string) =>
        LocalizedAlert.alert(
            feature,
            "Chức năng này chưa được dịch vụ camera hỗ trợ.",
        );
    /**
     * Chuyển thao tác Pan/Tilt sang hook và hiện phản hồi khi thành công.
     * @param direction - Hướng camera cần xoay.
     * @returns Promise hoàn tất việc gửi lệnh và cập nhật phản hồi.
     * @remarks Tác động: Hook gửi lệnh PTZ; cập nhật thông báo trong panel.
     */
    const move = async (direction: CameraMoveDirection) => {
        if (await connection.move(direction))
            setFeedback("Đã gửi lệnh xoay tới camera");
    };
    /**
     * Yêu cầu xác nhận trước khi mở trình gọi cấp cứu 115.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Chỉ mở trình quay số khi người dùng chọn Gọi 115.
     */
    const sos = () =>
        LocalizedAlert.alert(
            "Gọi cấp cứu 115?",
            "Mở trình gọi điện với số 115.",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Gọi 115",
                    style: "destructive",
                    onPress: () => {
                        void launchEmergencyCall().catch(() =>
                            LocalizedAlert.alert(
                                "SOS",
                                "Không mở được trình gọi điện.",
                            ),
                        );
                    },
                },
            ],
        );
    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: colors.background }]}
            edges={["top", "bottom"]}
        >
            <CameraDetailHeader
                name={name}
                onBack={() => navigation.goBack()}
                onSettings={() => openSheet("settings")}
            />
            <CameraViewer
                connection={connection}
                intercom={intercom}
                quality={quality}
                onQuality={setQuality}
                onSelectCamera={setSelectedCameraId}
            />
            <QuickActionBar
                recording={!!connection.recordings.active}
                speakerEnabled={intercom.speakerEnabled}
                callSelected={panel === "call"}
                onSnapshot={() => {
                    void connection.open("snapshot.jpg");
                }}
                onRecord={() => {
                    void connection.record();
                }}
                onSpeakerToggle={intercom.toggleSpeaker}
                onCall={() => changePanel("call")}
            />
            <View style={styles.controls}>
                {!panel &&
                    (intercom.state === "connecting" ||
                        intercom.state === "connected" ||
                        Boolean(intercom.error)) && (
                        <Text
                            accessibilityLiveRegion="polite"
                            style={[
                                styles.feedback,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {intercom.error ||
                                (intercom.state === "connecting"
                                    ? "Đang kết nối âm thanh…"
                                    : "Đang nghe âm thanh camera")}
                        </Text>
                    )}
                <CameraControlPanel
                    panel={panel}
                    onPanelChange={changePanel}
                    intercom={intercom}
                    onMove={move}
                    onSettings={() => openSheet("settings")}
                    feedback={feedback}
                />
                {!panel && (
                    <ScrollView contentContainerStyle={styles.dashboard}>
                        <FunctionGrid
                            onTalk={() => changePanel("talk")}
                            onPanTilt={() => changePanel("pan")}
                            onAlarm={() => unsupported("Còi camera")}
                            onPrivacy={() => {
                                intercom.stop();
                                void connection.togglePrivacy();
                            }}
                            privacyActive={connection.privacy === true}
                            onCare={() =>
                                LocalizedAlert.alert(
                                    "AI Care",
                                    "Các cảnh báo hiện có được hiển thị bên dưới nhóm chức năng.",
                                )
                            }
                        />
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => openSheet("recordings")}
                            style={[styles.playback, cardStyle]}
                        >
                            <CameraControlIcon
                                name="play-back-circle-outline"
                                size={34}
                                color={colors.textPrimary}
                            />
                            <Text style={[styles.playbackText, textStyle]}>
                                Playback & Download
                            </Text>
                            <CameraControlIcon
                                name="chevron-forward"
                                size={20}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>

                        <View style={[styles.card, cardStyle]}>
                            <Text style={[styles.sectionTitle, textStyle]}>
                                Cảnh báo gần đây
                            </Text>
                            {incidents.length === 0 && (
                                <Text style={{ color: colors.textSecondary }}>
                                    Chưa có cảnh báo.
                                </Text>
                            )}
                            {incidents.map((incident) => (
                                <View
                                    key={incident.id}
                                    style={[
                                        styles.incident,
                                        { borderColor: colors.border },
                                    ]}
                                >
                                    <Text style={textStyle}>
                                        {incident.message}
                                    </Text>
                                    <Text
                                        style={{ color: colors.textSecondary }}
                                    >
                                        {incident.created_at}
                                    </Text>
                                    {incident.video_clip_url && (
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            onPress={() => {
                                                void Linking.openURL(
                                                    incident.video_clip_url!,
                                                ).catch(() =>
                                                    LocalizedAlert.alert(
                                                        "Video sự kiện",
                                                        "Không mở được video.",
                                                    ),
                                                );
                                            }}
                                        >
                                            <Text style={textStyle}>
                                                Xem video sự kiện
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>
            <TouchableOpacity
                accessibilityRole="button"
                style={styles.sos}
                onPress={sos}
            >
                <Ionicons name="call" size={18} color="#FFF" />
                <Text style={styles.sosText}>SOS 115</Text>
            </TouchableOpacity>
            <Modal
                visible={sheet !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setSheet(null)}
            >
                <SafeAreaView style={styles.overlay}>
                    <View style={[styles.sheet, cardStyle]}>
                        <View style={styles.header}>
                            <Text style={[styles.title, textStyle]}>
                                {sheet === "recordings"
                                    ? "Playback & Download"
                                    : "Cài đặt camera"}
                            </Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Đóng"
                                style={styles.iconButton}
                                onPress={() => setSheet(null)}
                            >
                                <Ionicons
                                    name="close"
                                    size={26}
                                    color={colors.textPrimary}
                                />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.sheetContent}>
                            {sheet === "recordings" ? (
                                <>
                                    <CameraTimeline key={selectedCameraId || "default"} cameraId={selectedCameraId} />
                                    {connection.recordings.active && (
                                        <Text style={textStyle}>
                                            Đang ghi hình…
                                        </Text>
                                    )}
                                    {!!connection.recordings.error && (
                                        <Text style={styles.error}>
                                            {connection.recordings.error}
                                        </Text>
                                    )}
                                    {connection.recordings.files.length ===
                                        0 && (
                                        <Text style={textStyle}>
                                            Chưa có bản ghi hoàn tất.
                                        </Text>
                                    )}
                                    {/* Chỉ mở các tệp do server trả về. */}
                                    {[...connection.recordings.files]
                                        .reverse()
                                        .map((file) => (
                                            <TouchableOpacity
                                                key={file}
                                                accessibilityRole="button"
                                                style={[
                                                    styles.row,
                                                    {
                                                        borderColor:
                                                            colors.border,
                                                    },
                                                ]}
                                                onPress={() => {
                                                    void connection.open(
                                                        "recordings/" + file,
                                                    );
                                                }}
                                            >
                                                <Ionicons
                                                    name="play-circle-outline"
                                                    size={25}
                                                    color={colors.textPrimary}
                                                />
                                                <Text
                                                    style={[
                                                        styles.rowText,
                                                        textStyle,
                                                    ]}
                                                >
                                                    {file}
                                                </Text>
                                                <Ionicons
                                                    name="download-outline"
                                                    size={22}
                                                    color={colors.textPrimary}
                                                />
                                            </TouchableOpacity>
                                        ))}
                                </>
                            ) : (
                                <CameraSettings
                                    name={name}
                                    room={route?.params?.room}
                                    connected={!!connection.status?.connected}
                                    privacy={connection.privacy}
                                    motion={connection.motion}
                                    onPrivacy={() => {
                                        void connection.togglePrivacy();
                                    }}
                                    onReconnect={connection.refresh}
                                    onMotion={() => {
                                        void connection.toggleMotion();
                                    }}
                                />
                            )}
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
