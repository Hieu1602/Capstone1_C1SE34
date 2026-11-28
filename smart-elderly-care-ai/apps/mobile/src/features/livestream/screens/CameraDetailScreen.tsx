/**
 * Ghép Header, Live View, thanh thao tác, lưới chức năng, danh sách Playback và SOS.
 */
import React, { useState, useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import ArchivePlayer from "../components/ArchivePlayer";
import downloadVideo from "../services/downloadVideo";
import { cameraApi, type VideoQuality, type ArchivedRecording } from "../../../services/camera";
import { useCameraConnection } from "../hooks/useCameraConnection";
import { useCameraIntercom } from "../hooks/useCameraIntercom";
import CameraDetailHeader from "../components/CameraDetailHeader";
import CameraSettings from "../components/CameraSettings";
import CameraAiCareSettings from "../components/CameraAiCareSettings";
import { useDeviceStore } from "../../../store/useDeviceStore";
import { devicesApi } from "../../../services/deviceService";
import { StepCameraRtspConfig } from "../../dashboard/components/add-device/StepCameraRtspConfig";
import { DeleteDeviceConfirmModal } from "../../dashboard/components/devices/DeleteDeviceConfirmModal";
import QuickActionBar from "../components/QuickActionBar";
import FunctionGrid from "../components/FunctionGrid";
import CameraControlPanel, {
    CameraPanel,
} from "../components/CameraControlPanel";
import CameraControlIcon from "../components/CameraControlIcon";
import type { CameraMoveDirection } from "../hooks/useCameraConnection";
import { getAlertConfig, formatFriendlyTime } from "../../alerts/utils/alertConfig";
import { cameraDetailStyles as styles } from "./cameraDetailStyles";
interface Props {
    navigation: {
        goBack: () => void;
        navigate?: (screen: string, params?: any) => void;
    };
    route?: {
        params?: {
            cameraId?: string;
            cameraName?: string;
            room?: string;
            streamUrl?: string;
            tab?: "playback";
        };
    };
}
type DetailSheet = "settings" | "recordings" | "ai_care" | null;
/**
 * Ghép các component với hook video/audio và modal bản ghi/cài đặt.
 * @param props - Điều hướng và tham số camera.
 * @param props.navigation - Bộ điều hướng dùng cho thao tác quay lại.
 * @param props.route - ID, tên và phòng của camera được chọn.
 * @returns Cây giao diện React theo props và theme hiện tại.
 * @remarks Tác động: Các hook quản lý kết nối; thao tác SOS và mở video sự kiện có thể rời ứng dụng.
 */
export default function CameraDetailScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const { colors, isDarkMode } = useTheme();
    const [showRtspConfigModal, setShowRtspConfigModal] = useState<boolean>(false);
    const { permissions, userRole, role } = useAuthStore();
    const isOwnerOrAdmin =
        userRole === 'admin' ||
        role === 'admin' ||
        userRole === 'owner' ||
        role === 'owner' ||
        permissions?.is_owner === true ||
        permissions?.role_in_house === 'OWNER';
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
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const removeIoTDevice = useDeviceStore((state) => state.removeIoTDevice);
    const handleDeleteCamera = () => {
        setSheet(null);
        setShowDeleteModal(true);
    };
    const handleConfirmDeleteCamera = () => {
        const targetId = selectedCameraId || route?.params?.cameraId;
        if (targetId) {
            removeIoTDevice(targetId);
        }
        setShowDeleteModal(false);
        navigation.goBack();
    };

    const storeCamera = useDeviceStore((state) => state.camera);
    const iotDevices = useDeviceStore((state) => state.iotDevices);
    const defaultCam = (iotDevices || []).find((d) => d.type === "camera");

    const effectiveCameraId =
        route?.params?.cameraId ||
        storeCamera?.id ||
        defaultCam?.id ||
        undefined;
    const effectiveCameraName = (
        route?.params?.cameraName ||
        storeCamera?.name ||
        defaultCam?.name ||
        "Camera"
    ).replace(/^Camera\s+Camera\s+/i, "Camera ");
    const effectiveRoom =
        route?.params?.room ||
        storeCamera?.room ||
        defaultCam?.location ||
        "Phòng khách";
    const effectiveStreamUrl =
        route?.params?.streamUrl ||
        storeCamera?.streamUrl ||
        defaultCam?.streamUrl ||
        "";

    const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(
        effectiveCameraId,
    );
    const [quality, setQuality] = useState<VideoQuality>("auto");
    const connection = useCameraConnection(selectedCameraId, quality);
    const intercom = useCameraIntercom(connection, selectedCameraId);
    const incidents = useAlertStore((state) => state.incidents);
    // Panel Talk/Call/Pan-Tilt đang mở; null để hiện Function Grid.
    const [panel, setPanel] = useState<CameraPanel>(null);
    // Hiện/ẩn thanh kéo âm lượng khi nhấn nút loa trên QuickActionBar.
    const [showVolumeControl, setShowVolumeControl] = useState(false);
    // Modal cài đặt hoặc danh sách Playback đang hiển thị.
    const [sheet, setSheet] = useState<DetailSheet>(route?.params?.tab === "playback" ? "recordings" : null);
    const [recordingUri, setRecordingUri] = useState("");
    const [previewImageUri, setPreviewImageUri] = useState("");
    const [archiveTab, setArchiveTab] = useState<"playback" | "download">("playback");
    const [archiveFiles, setArchiveFiles] = useState<ArchivedRecording[]>([]);
    const [loadingArchive, setLoadingArchive] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const recordingRequest = useRef(0);
    const archiveFade = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (sheet === "recordings") {
            archiveFade.setValue(0.35);
            Animated.timing(archiveFade, {
                toValue: 1,
                duration: 200,
                useNativeDriver: Platform.OS !== "web",
            }).start();
        }
    }, [sheet, archiveTab]);
    useEffect(() => {
        if (route?.params?.tab === "playback") {
            intercom.stop();
            setSheet("recordings");
        }
    }, [route?.params]);
    useEffect(() => {
        setRecordingUri("");
        setPreviewImageUri("");
        return () => { recordingRequest.current++; };
    }, [selectedCameraId, sheet]);
    const loadArchiveFiles = async () => {
        if (!cameraApi.timeline) return;
        setLoadingArchive(true);
        try {
            const now = new Date();
            const past = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
            const { data } = await cameraApi.timeline(
                past.toISOString(),
                now.toISOString(),
                selectedCameraId,
                undefined,
                "manual_snapshot,manual_clip",
            );
            const items = [...(data?.items || [])].sort(
                (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
            );
            setArchiveFiles(items);
        } catch {
            // Không ngắt giao diện khi chưa tải được danh sách lưu trữ
        } finally {
            setLoadingArchive(false);
        }
    };

    useEffect(() => {
        if (sheet === "recordings" && archiveTab === "download") {
            void loadArchiveFiles();
            void connection.refresh?.();
        }
    }, [sheet, archiveTab, selectedCameraId]);

    const openArchiveRecording = async (item: ArchivedRecording, download = false) => {
        const request = ++recordingRequest.current;
        if (download) setDownloadingId(item.id);
        try {
            const result = await cameraApi.playback?.(item.id, selectedCameraId, download);
            if (result?.data?.url && request === recordingRequest.current) {
                if (download) {
                    await downloadVideo(result.data.url);
                    LocalizedAlert.alert("Tải xuống", "Đang bắt đầu tải tệp xuống thiết bị.");
                } else if (item.kind === "manual_snapshot" || item.kind === "snapshot") {
                    setRecordingUri("");
                    setPreviewImageUri(result.data.url);
                } else {
                    setPreviewImageUri("");
                    setRecordingUri(result.data.url);
                }
            }
        } catch {
            if (request === recordingRequest.current)
                LocalizedAlert.alert(download ? "Tải xuống" : "Xem lại", "Không tải được tệp. Vui lòng thử lại.");
        } finally {
            if (download && request === recordingRequest.current) setDownloadingId(null);
        }
    };

    const deleteArchiveRecording = async (item: ArchivedRecording) => {
        if (deletingId) return;
        setDeletingId(item.id);
        try {
            await cameraApi.deleteArchive(item.id, selectedCameraId);
            setArchiveFiles((prev) => prev.filter((f) => f.id !== item.id));
        } catch {
            LocalizedAlert.alert("Xóa tệp", "Không xóa được tệp. Vui lòng thử lại.");
        } finally {
            setDeletingId(null);
        }
    };

    const openRecording = async (file: string, download = false) => {
        const request = ++recordingRequest.current;
        if (download) setDownloadingId(file);
        try {
            const uri = await cameraApi.media("recordings/" + file, selectedCameraId);
            if (request === recordingRequest.current) {
                if (download) await downloadVideo(uri);
                else setRecordingUri(uri);
            }
        } catch {
            if (request === recordingRequest.current)
                LocalizedAlert.alert(download ? "Tải xuống" : "Xem lại", "Không tải được video. Vui lòng thử lại.");
        } finally {
            if (download && request === recordingRequest.current) setDownloadingId(null);
        }
    };
    // Thông báo xác nhận lệnh PTZ trong panel.
    const [feedback, setFeedback] = useState<string | null>(null);
    /**
     * Mở/đóng modal cài đặt hoặc Playback sau khi dừng audio.
     * @param next - settings, recordings hoặc null để đóng.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Đóng intercom và cập nhật modal đang chọn.
     */
    const handleApplyRtspConfig = async (deviceData: {
        name: string;
        brand: string;
        streamUrl: string;
        location: string;
        ip: string;
        isDefault: boolean;
    }) => {
        try {
            setShowRtspConfigModal(false);
            if (selectedCameraId) {
                await devicesApi.updateDeviceConfig(selectedCameraId, {
                    stream_url: deviceData.streamUrl,
                });
            }
            if (deviceData.isDefault) {
                useDeviceStore.getState().setCameraDefault({
                    id: selectedCameraId || "cam-default",
                    name: deviceData.name,
                    room: deviceData.location,
                    streamUrl: deviceData.streamUrl,
                    isOnline: true,
                });
            }
            LocalizedAlert.alert(
                "Áp dụng thành công",
                `Đã cập nhật nguồn camera: ${deviceData.streamUrl}`
            );
            connection.refresh();
        } catch {
            LocalizedAlert.alert(
                "Lưu cấu hình",
                `Đã áp dụng cấu hình camera: ${deviceData.streamUrl}`
            );
            connection.refresh();
        }
    };

    const openSheet = (next: DetailSheet) => {
        if (next === "recordings") {
            intercom.stop();
            setShowVolumeControl(false);
            setArchiveTab("playback");
        }
        setSheet(next);
    };
    /**
     * Chuyển panel Talk/Voice Call/Pan-Tilt hoặc đóng panel.
     * @param next - Panel mới; null để trở về Function Grid.
     * @returns Không có giá trị trả về.
     */
    const changePanel = (next: CameraPanel) => {
        setPanel(next);
        setFeedback(null);
    };
    const name = (
        connection.status?.name ||
        effectiveCameraName ||
        "Camera"
    ).replace(/^Camera\s+Camera\s+/i, "Camera ");
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
     * Chuyển trực tiếp sang màn hình khẩn cấp EmergencySOS, không bật alert trình duyệt.
     */
    const sos = () => {
        if (navigation?.navigate) {
            navigation.navigate("EmergencySOS");
            return;
        }
        void launchEmergencyCall().catch(() => {});
    };
    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: colors.background }]}
            edges={["top", "bottom"]}
        >
            <CameraDetailHeader
                name={name}
                onBack={() => navigation.goBack()}
                onSettings={isOwnerOrAdmin ? () => openSheet("settings") : undefined}
            />
            <CameraViewer
                connection={connection}
                intercom={intercom}
                quality={quality}
                onQuality={setQuality}
                onSelectCamera={setSelectedCameraId}
                selectedCameraId={selectedCameraId}
                showVolumeControl={!panel && showVolumeControl}
            />
            <QuickActionBar
                recording={connection.isRecording}
                speakerEnabled={
                    showVolumeControl ||
                    (intercom.speakerEnabled && intercom.speakerVolume > 0)
                }
                speakerMuted={intercom.speakerVolume === 0}
                callSelected={panel === "call"}
                onSnapshot={() => {
                    void connection.captureSnapshot();
                }}
                onRecord={() => {
                    void connection.record();
                }}
                onSpeakerToggle={() => setShowVolumeControl((prev) => !prev)}
                onCall={() => changePanel("call")}
            />
            <View style={styles.controls}>
                {!panel && connection.isRecording && (
                    <Text
                        accessibilityLiveRegion="polite"
                        style={[styles.feedback, { color: "#EF4444", fontWeight: "600" }]}
                    >
                        {`Đang quay video camera (${connection.recordingSeconds}s)… Bấm lại nút quay để dừng và lưu.`}
                    </Text>
                )}
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
                    onSettings={isOwnerOrAdmin ? () => openSheet("settings") : () => {
                        LocalizedAlert.alert("Quyền truy cập bị giới hạn", "Tài khoản Thành viên chỉ có quyền xem trực tiếp camera, không được phép thay đổi cài đặt.");
                    }}
                    feedback={feedback}
                />
                {!panel && (
                    <ScrollView contentContainerStyle={styles.dashboard}>
                        <FunctionGrid
                            onTalk={() => changePanel("talk")}
                            onPanTilt={() => changePanel("pan")}
                            onAlarm={() => {
                                void connection.toggleAlarm();
                            }}
                            alarmActive={connection.alarm === true}
                            onPrivacy={() => {
                                intercom.stop();
                                setShowVolumeControl(false);
                                void connection.togglePrivacy();
                            }}
                            privacyActive={connection.privacy === true}
                            onCare={() => {
                                void connection.refreshFallDetection();
                                openSheet("ai_care");
                            }}
                            careActive={connection.fallDetection === true}
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
                                Xem lại & Tải xuống
                            </Text>
                            <CameraControlIcon
                                name="chevron-forward"
                                size={20}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>

                        <View style={[styles.card, cardStyle, styles.alertCard]}>
                            <View style={styles.alertCardHeader}>
                                <View style={styles.alertHeaderTitleGroup}>
                                    <View style={[styles.alertHeaderIconBadge, { backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2" }]}>
                                        <Ionicons name="notifications" size={16} color="#EF4444" />
                                    </View>
                                    <Text style={[styles.sectionTitle, textStyle]}>
                                        Cảnh báo gần đây
                                    </Text>
                                    {incidents.length > 0 && (
                                        <View style={[styles.alertCountBadge, { backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.25)" : "#FEE2E2" }]}>
                                            <Text style={styles.alertCountText}>{incidents.length}</Text>
                                        </View>
                                    )}
                                </View>
                                {incidents.length > 0 && (
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        accessibilityLabel="Xem tất cả cảnh báo"
                                        onPress={() => navigation.navigate?.("Alerts")}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.seeAllText, { color: colors.primary }]}>
                                            Xem tất cả
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {incidents.length === 0 ? (
                                <View style={styles.alertEmptyState}>
                                    <Ionicons name="shield-checkmark" size={36} color="#10B981" />
                                    <Text style={[styles.alertEmptyText, { color: colors.textSecondary }]}>
                                        Không có sự cố hoặc cảnh báo bất thường nào gần đây.
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.alertList}>
                                    {incidents.slice(0, 5).map((incident) => {
                                        const config = getAlertConfig(
                                            incident.alert_type,
                                            (incident.notes || incident.note) ?? undefined,
                                            incident.message,
                                        );
                                        const friendlyTime = formatFriendlyTime(
                                            incident.created_at,
                                            (key, count) => count !== undefined ? key.replace("{{count}}", String(count)) : key,
                                        );
                                        const cleanMsg = incident.message?.replace(/^Cảnh báo:\s*/i, "") || "";
                                        const isCritical = config.isCritical || incident.alert_level === "CRITICAL";

                                        return (
                                            <View
                                                key={incident.id}
                                                style={[
                                                    styles.alertItem,
                                                    {
                                                        backgroundColor: isDarkMode
                                                            ? "rgba(255, 255, 255, 0.04)"
                                                            : "#F8FAFC",
                                                        borderColor: isCritical
                                                            ? isDarkMode
                                                                ? "rgba(239, 68, 68, 0.4)"
                                                                : "#FCA5A5"
                                                            : colors.border,
                                                    },
                                                ]}
                                            >
                                                <View style={styles.alertItemTop}>
                                                    <View
                                                        style={[
                                                            styles.alertItemIcon,
                                                            {
                                                                backgroundColor: isDarkMode
                                                                    ? "rgba(255, 255, 255, 0.08)"
                                                                    : config.iconBg,
                                                            },
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name={config.iconName}
                                                            size={18}
                                                            color={config.iconColor}
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={styles.alertItemTitleRow}>
                                                            <Text
                                                                style={[
                                                                    styles.alertItemTitle,
                                                                    textStyle,
                                                                ]}
                                                                numberOfLines={1}
                                                            >
                                                                {config.title}
                                                            </Text>
                                                            <View
                                                                style={[
                                                                    styles.alertBadge,
                                                                    {
                                                                        backgroundColor: isDarkMode
                                                                            ? "rgba(255, 255, 255, 0.08)"
                                                                            : config.badgeBg,
                                                                    },
                                                                ]}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.alertBadgeText,
                                                                        { color: config.badgeColor },
                                                                    ]}
                                                                >
                                                                    {config.badgeText}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <Text style={styles.alertItemTime}>
                                                            {friendlyTime}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <Text
                                                    style={[
                                                        styles.alertItemMessage,
                                                        { color: colors.textSecondary },
                                                    ]}
                                                >
                                                    {cleanMsg}
                                                </Text>

                                                {incident.video_clip_url && (
                                                    <TouchableOpacity
                                                        accessibilityRole="button"
                                                        style={[
                                                            styles.alertClipButton,
                                                            {
                                                                backgroundColor: isDarkMode
                                                                    ? "rgba(2, 132, 199, 0.2)"
                                                                    : "#E0F2FE",
                                                            },
                                                        ]}
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
                                                        <Ionicons
                                                            name="play-circle"
                                                            size={16}
                                                            color="#0284C7"
                                                        />
                                                        <Text style={styles.alertClipText}>
                                                            Xem video ghi hình sự kiện
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                )}
            </View>
            <TouchableOpacity
                accessibilityRole="button"
                style={styles.sos}
                onPress={sos}
                activeOpacity={0.85}
            >
                <Ionicons name="call" size={18} color="#FFF" />
                <Text style={styles.sosText}>SOS 115</Text>
            </TouchableOpacity>
            <Modal
                visible={sheet !== null}
                transparent={sheet !== "recordings"}
                animationType="slide"
                onRequestClose={() => setSheet(null)}
            >
                {sheet === "recordings" ? (
                    <View
                        style={[
                            styles.screen,
                            cardStyle,
                            {
                                paddingTop: insets.top,
                                paddingBottom: insets.bottom,
                            },
                        ]}
                    >
                        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
                        <View style={styles.archiveHeader}>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Đóng"
                                style={styles.iconButton}
                                onPress={() => setSheet(null)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <Ionicons
                                    name="chevron-back"
                                    size={28}
                                    color={colors.textPrimary}
                                />
                            </TouchableOpacity>
                                {(
                                    [
                                        { id: "playback", label: "Xem lại" },
                                        { id: "download", label: "Tải xuống" },
                                    ] as const
                                ).map((tab) => (
                                    <TouchableOpacity
                                        key={tab.id}
                                        activeOpacity={1}
                                        accessibilityRole="tab"
                                        accessibilityState={{ selected: archiveTab === tab.id }}
                                        accessibilityLabel={tab.label}
                                        style={[styles.archiveTab, archiveTab === tab.id && { borderBottomColor: colors.primary }]}
                                        onPress={() => { setRecordingUri(""); setPreviewImageUri(""); recordingRequest.current++; setArchiveTab(tab.id); }}
                                    >
                                        <Text style={[styles.archiveTabText, { color: archiveTab === tab.id ? colors.primary : colors.textSecondary }]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Animated.View style={[{ flex: 1 }, { opacity: archiveFade }]}>
                                <ScrollView contentContainerStyle={styles.archiveContent}>
                                    {archiveTab === "playback" ? (
                                        <CameraTimeline key={selectedCameraId || "default"} cameraId={selectedCameraId} />
                                    ) : (
                                        <View style={styles.downloadContent}>
                                            {previewImageUri ? <>
                                                <Image
                                                    source={{ uri: previewImageUri }}
                                                    style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: "#000" }}
                                                    resizeMode="contain"
                                                />
                                                <TouchableOpacity accessibilityRole="button" style={styles.iconButton}
                                                    accessibilityLabel="Đóng ảnh xem trước" onPress={() => setPreviewImageUri("")}>
                                                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                                                </TouchableOpacity>
                                            </> : null}
                                            {recordingUri ? <>
                                                <ArchivePlayer key={recordingUri} uri={recordingUri}
                                                    onEnd={() => {}}
                                                    onError={() => LocalizedAlert.alert("Xem lại", "Không phát được video. Vui lòng thử lại.")} />
                                                <TouchableOpacity accessibilityRole="button" style={styles.iconButton}
                                                    accessibilityLabel="Quay lại danh sách bản ghi" onPress={() => setRecordingUri("")}>
                                                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                                                </TouchableOpacity>
                                            </> : null}
                                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                                <Text style={[styles.sectionTitle, textStyle]}>
                                                    Ảnh chụp & Video đã tải
                                                </Text>
                                                <TouchableOpacity
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Làm mới danh sách bản ghi"
                                                    style={styles.iconButton}
                                                    onPress={() => {
                                                        void loadArchiveFiles();
                                                    }}
                                                >
                                                    <Ionicons name="refresh" size={20} color={colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                            {/* Danh sách ảnh chụp & video đã lưu trên AWS S3 */}
                                            {archiveFiles.map((item) => {
                                                const isSnap = item.kind === "manual_snapshot" || item.kind === "snapshot";
                                                const kindLabel = item.kind === "manual_snapshot"
                                                    ? "Ảnh tự chụp"
                                                    : item.kind === "manual_clip"
                                                    ? `${Math.round(item.duration)}s • Video đã quay`
                                                    : `${item.duration}s • Sự kiện AI`;
                                                return (
                                                <View
                                                    key={item.id}
                                                    style={[
                                                        styles.row,
                                                        { borderColor: colors.border },
                                                    ]}
                                                >
                                                    <TouchableOpacity
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Xem lưu trữ ${item.id}`}
                                                        style={styles.iconButton}
                                                        onPress={() => { void openArchiveRecording(item); }}
                                                    >
                                                        <Ionicons
                                                            name={isSnap ? "image-outline" : "play-circle-outline"}
                                                            size={25}
                                                            color={colors.primary}
                                                        />
                                                    </TouchableOpacity>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={textStyle}>
                                                            {new Date(item.started_at).toLocaleString("vi-VN", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                                second: "2-digit",
                                                            })}
                                                        </Text>
                                                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                                                            {kindLabel}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Tải xuống lưu trữ ${item.id}`}
                                                        style={styles.iconButton}
                                                        disabled={deletingId === item.id}
                                                        onPress={() => { void openArchiveRecording(item, true); }}
                                                    >
                                                        <Ionicons
                                                            name="download-outline"
                                                            size={22}
                                                            color={colors.primary}
                                                        />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Xóa lưu trữ ${item.id}`}
                                                        style={styles.iconButton}
                                                        disabled={deletingId === item.id}
                                                        onPress={() => { void deleteArchiveRecording(item); }}
                                                    >
                                                        {deletingId === item.id ? (
                                                            <ActivityIndicator size="small" color="#EF4444" />
                                                        ) : (
                                                            <Ionicons
                                                                name="trash-outline"
                                                                size={20}
                                                                color="#EF4444"
                                                            />
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                                );
                                            })}
                                            {archiveFiles.length === 0 && !loadingArchive && (
                                                <View style={styles.downloadEmpty}>
                                                    <Ionicons name="download-outline" size={60} color={colors.textMuted} />
                                                    <Text style={[styles.sectionTitle, textStyle]}>Chưa có ảnh hoặc video đã lưu</Text>
                                                    <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Ảnh chụp và video tải xuống từ Xem lại sẽ xuất hiện tại đây.</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </ScrollView>
                            </Animated.View>
                        </View>
                ) : (
                    <View style={styles.overlay}>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={() => setSheet(null)}
                        />
                        <View style={[styles.sheet, cardStyle, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                            <View style={styles.header}>
                                <View style={{ width: 44 }} />
                                <Text style={[styles.title, textStyle]}>
                                    {sheet === "ai_care"
                                        ? "Chăm sóc AI"
                                        : "Cài đặt camera"}
                                </Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Đóng"
                                    style={styles.iconButton}
                                    onPress={() => setSheet(null)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons
                                        name="close"
                                        size={26}
                                        color={colors.textPrimary}
                                    />
                                </TouchableOpacity>
                            </View>
                            <Animated.View style={{ flex: 1 }}>
                                <ScrollView contentContainerStyle={styles.sheetContent}>
                                    {sheet === "ai_care" ? (
                                        <CameraAiCareSettings
                                            enabled={connection.fallDetection}
                                            stats={connection.fallStats}
                                            audioEnabled={connection.audioDetection}
                                            audioStats={connection.audioStats}
                                            connected={!!connection.status?.connected}
                                            overlay={connection.overlay}
                                            onToggle={async () => {
                                                await connection.toggleFallDetection();
                                            }}
                                            onToggleAudio={async () => {
                                                await connection.toggleAudioDetection();
                                            }}
                                            onToggleOverlay={connection.toggleOverlay}
                                            onViewIncidents={() => {
                                                openSheet("recordings");
                                            }}
                                        />
                                    ) : (
                                        <CameraSettings
                                            name={name}
                                            room={effectiveRoom}
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
                                            onConfigureSource={isOwnerOrAdmin ? () => {
                                                setSheet(null);
                                                setShowRtspConfigModal(true);
                                            } : undefined}
                                            onDeleteDevice={isOwnerOrAdmin ? handleDeleteCamera : undefined}
                                        />
                                    )}
                                </ScrollView>
                            </Animated.View>
                        </View>
                    </View>
                )}
            </Modal>
            {/* Modal Cấu hình nguồn camera RTSP theo ảnh mẫu */}
            <Modal
                visible={showRtspConfigModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowRtspConfigModal(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border
                    }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                            Cấu Hình Nguồn Camera
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowRtspConfigModal(false)}
                            style={{ padding: 6 }}
                        >
                            <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    <StepCameraRtspConfig
                        isDarkMode={isDarkMode}
                        colors={colors}
                        initialValues={{
                            name,
                            streamUrl: effectiveStreamUrl,
                            location: effectiveRoom,
                        }}
                        onApplyCamera={handleApplyRtspConfig}
                    />
                </SafeAreaView>
            </Modal>

            {/* Modal Xác nhận xóa Camera */}
            <DeleteDeviceConfirmModal
                visible={showDeleteModal}
                device={{
                    id: selectedCameraId || route?.params?.cameraId || "camera",
                    name: connection.status?.name || route?.params?.cameraName || "Camera",
                    sub: effectiveRoom || "Camera an ninh",
                    type: "camera",
                    status: connection.status?.connected ? "Trực tuyến" : "Ngoại tuyến",
                    isOnline: !!connection.status?.connected,
                    icon: "videocam",
                    color: "#0284C7",
                }}
                onClose={() => setShowDeleteModal(false)}
                onConfirmDelete={handleConfirmDeleteCamera}
                isDarkMode={isDarkMode}
                colors={colors}
            />
        </SafeAreaView>
    );
}
