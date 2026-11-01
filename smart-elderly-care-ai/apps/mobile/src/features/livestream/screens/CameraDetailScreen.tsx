/**
 * Ghép Header, Live View, thanh thao tác, lưới chức năng, danh sách Playback và SOS.
 */
import React, { useState, useEffect, useRef } from "react";
import {
    Animated,
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
import ArchivePlayer from "../components/ArchivePlayer";
import downloadVideo from "../services/downloadVideo";
import { cameraApi, type VideoQuality, type ArchivedRecording } from "../../../services/camera";
import { useCameraConnection } from "../hooks/useCameraConnection";
import { useCameraIntercom } from "../hooks/useCameraIntercom";
import CameraDetailHeader from "../components/CameraDetailHeader";
import CameraSettings from "../components/CameraSettings";
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
            tab?: "playback";
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
    const { colors, isDarkMode } = useTheme();
    const [showRtspConfigModal, setShowRtspConfigModal] = useState<boolean>(false);
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
    const [sheet, setSheet] = useState<DetailSheet>(route?.params?.tab === "playback" ? "recordings" : null);
    const [recordingUri, setRecordingUri] = useState("");
    const [archiveTab, setArchiveTab] = useState<"playback" | "download">("playback");
    const [archiveFiles, setArchiveFiles] = useState<ArchivedRecording[]>([]);
    const [loadingArchive, setLoadingArchive] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const recordingRequest = useRef(0);
    const archiveFade = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (sheet === "recordings") {
            archiveFade.setValue(0.35);
            Animated.timing(archiveFade, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
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
        return () => { recordingRequest.current++; };
    }, [selectedCameraId, sheet]);
    const loadArchiveFiles = async () => {
        if (!cameraApi.timeline) return;
        setLoadingArchive(true);
        try {
            const now = new Date();
            const past = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
            const { data } = await cameraApi.timeline(
                past.toISOString(),
                now.toISOString(),
                selectedCameraId,
            );
            setArchiveFiles(data?.items || []);
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
                    LocalizedAlert.alert("Tải xuống", "Đang bắt đầu tải video xuống thiết bị.");
                } else {
                    setRecordingUri(result.data.url);
                }
            }
        } catch {
            if (request === recordingRequest.current)
                LocalizedAlert.alert(download ? "Tải xuống" : "Playback", "Không tải được video. Vui lòng thử lại.");
        } finally {
            if (download && request === recordingRequest.current) setDownloadingId(null);
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
                LocalizedAlert.alert(download ? "Tải xuống" : "Playback", "Không tải được video. Vui lòng thử lại.");
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
        intercom.stop();
        if (next === "recordings") setArchiveTab("playback");
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
                <SafeAreaView style={sheet === "recordings" ? [styles.screen, cardStyle] : styles.overlay}>
                    <View style={[sheet === "recordings" ? styles.screen : styles.sheet, cardStyle]}>
                        {sheet === "recordings" ? <View style={styles.archiveHeader}>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng" style={styles.iconButton} onPress={() => setSheet(null)}>
                                <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                            </TouchableOpacity>
                            {(["playback", "download"] as const).map(tab => <TouchableOpacity key={tab}
                                activeOpacity={1}
                                accessibilityRole="tab" accessibilityState={{ selected: archiveTab === tab }}
                                accessibilityLabel={tab === "playback" ? "Playback" : "Download"}
                                style={[styles.archiveTab, archiveTab === tab && { borderBottomColor: colors.primary }]}
                                onPress={() => { setRecordingUri(""); recordingRequest.current++; setArchiveTab(tab); }}>
                                <Text style={[styles.archiveTabText, { color: archiveTab === tab ? colors.primary : colors.textSecondary }]}>
                                    {tab === "playback" ? "Playback" : "Download"}
                                </Text>
                            </TouchableOpacity>)}
                        </View> :
                        <View style={styles.header}>
                            <Text style={[styles.title, textStyle]}>
                                Cài đặt camera
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
                        </View>}
                        <Animated.View style={[{ flex: 1 }, sheet === "recordings" && { opacity: archiveFade }]}>
                            <ScrollView contentContainerStyle={sheet === "recordings" ? styles.archiveContent : styles.sheetContent}>
                            {sheet === "recordings" ? (
                                archiveTab === "playback" ? <CameraTimeline key={selectedCameraId || "default"} cameraId={selectedCameraId} /> : <View style={styles.downloadContent}>
                                    {recordingUri ? <>
                                        <ArchivePlayer key={recordingUri} uri={recordingUri}
                                            onEnd={() => {}}
                                            onError={() => LocalizedAlert.alert("Playback", "Không phát được video. Vui lòng thử lại.")} />
                                        <TouchableOpacity accessibilityRole="button" style={styles.iconButton}
                                            accessibilityLabel="Quay lại danh sách bản ghi" onPress={() => setRecordingUri("")}>
                                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                                        </TouchableOpacity>
                                    </> : null}
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={[styles.sectionTitle, textStyle]}>
                                            Bản ghi khả dụng
                                        </Text>
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel="Làm mới danh sách bản ghi"
                                            style={styles.iconButton}
                                            onPress={() => {
                                                void loadArchiveFiles();
                                                void connection.refresh?.();
                                            }}
                                        >
                                            <Ionicons name="refresh" size={20} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
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
                                    {/* Chỉ mở các tệp do server trả về. */}
                                    {[...connection.recordings.files]
                                        .reverse()
                                        .map((file) => (
                                            <View
                                                key={file}
                                                style={[
                                                    styles.row,
                                                    {
                                                        borderColor:
                                                            colors.border,
                                                    },
                                                ]}
                                            >
                                                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Phát ${file}`}
                                                    style={styles.iconButton} onPress={() => { void openRecording(file); }}>
                                                    <Ionicons
                                                        name="play-circle-outline"
                                                        size={25}
                                                        color={colors.textPrimary}
                                                    />
                                                </TouchableOpacity>
                                                <Text
                                                    style={[
                                                        styles.rowText,
                                                        textStyle,
                                                    ]}
                                                >
                                                    {file}
                                                </Text>
                                                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Tải xuống ${file}`}
                                                    style={styles.iconButton} onPress={() => { void openRecording(file, true); }}>
                                                    <Ionicons
                                                        name="download-outline"
                                                        size={22}
                                                        color={colors.textPrimary}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    {/* Danh sách bản ghi từ Cloud / Edge Hub Archive */}
                                    {archiveFiles.map((item) => (
                                        <View
                                            key={item.id}
                                            style={[
                                                styles.row,
                                                { borderColor: colors.border },
                                            ]}
                                        >
                                            <TouchableOpacity
                                                accessibilityRole="button"
                                                accessibilityLabel={`Phát lưu trữ ${item.id}`}
                                                style={styles.iconButton}
                                                onPress={() => { void openArchiveRecording(item); }}
                                            >
                                                <Ionicons
                                                    name="play-circle-outline"
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
                                                    {item.duration}s • {item.kind === "incident" ? "Sự kiện AI" : "Đoạn lưu trữ"}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                accessibilityRole="button"
                                                accessibilityLabel={`Tải xuống lưu trữ ${item.id}`}
                                                style={styles.iconButton}
                                                onPress={() => { void openArchiveRecording(item, true); }}
                                            >
                                                <Ionicons
                                                    name="download-outline"
                                                    size={22}
                                                    color={colors.primary}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    {connection.recordings.files.length === 0 && archiveFiles.length === 0 && !loadingArchive && (
                                        <View style={styles.downloadEmpty}>
                                            <Ionicons name="download-outline" size={60} color={colors.textMuted} />
                                            <Text style={[styles.sectionTitle, textStyle]}>Chưa có bản ghi để tải</Text>
                                            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Các bản ghi hoàn tất sẽ xuất hiện tại đây.</Text>
                                        </View>
                                    )}
                                </View>
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
                                    onConfigureSource={() => {
                                        setSheet(null);
                                        setShowRtspConfigModal(true);
                                    }}
                                    onDeleteDevice={handleDeleteCamera}
                                />
                            )}
                        </ScrollView>
                        </Animated.View>
                    </View>
                </SafeAreaView>
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
                            location: route?.params?.room,
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
                    sub: route?.params?.room || "Camera an ninh",
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
