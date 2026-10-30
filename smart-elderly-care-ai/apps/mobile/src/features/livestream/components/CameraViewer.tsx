/** Khung live có lưới tối đa bốn camera, thanh tùy chọn và chế độ xem ngang toàn màn hình. */
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Modal,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
    cameraApi,
    CameraSource,
    VideoQuality,
} from "../../../services/camera";
import { useCameraConnection } from "../hooks/useCameraConnection";
import { useCameraIntercom } from "../hooks/useCameraIntercom";
import { useCameraVideoMode } from "../hooks/useCameraVideoMode";
import { useCameraFullscreen } from "../hooks/useCameraFullscreen";
import { CameraLiveView } from "./CameraLiveView";
import CameraVideoOptions from "./CameraVideoOptions";
import PanTiltControl from "./PanTiltControl";
import CameraLandscapeView from "./CameraLandscapeView";
import CameraControlIcon from "./CameraControlIcon";

type Connection = ReturnType<typeof useCameraConnection>;
interface Props {
    connection: Connection;
    intercom: ReturnType<typeof useCameraIntercom>;
    quality: VideoQuality;
    onQuality: (quality: VideoQuality) => void;
    onSelectCamera: (id: string) => void;
}

/** @param props Nguồn phụ chưa được chọn. @returns Luồng riêng, tự dừng khi ô bị gỡ hoặc màn hình mất focus. */
function AdditionalFeed({
    id,
    quality,
}: {
    id: string;
    quality: VideoQuality;
}) {
    const connection = useCameraConnection(id, quality);
    return <CameraLiveView connection={connection} />;
}

/**
 * @param props Kết nối chính, intercom và lựa chọn chất lượng từ màn hình.
 * @returns Live view với bốn thao tác trên video và thanh công cụ khi xem ngang.
 * @remarks Các ô phụ chỉ phát video; audio/PTZ/ghi hình luôn trỏ tới ô viền cam đang chọn.
 */
export default function CameraViewer({
    connection,
    intercom,
    quality,
    onQuality,
    onSelectCamera,
}: Props) {
    const fullscreen = useCameraFullscreen(connection.active);
    const videoMode = useCameraVideoMode(connection);
    // Danh sách ID độc lập với trạng thái bố cục; thu lưới chỉ tháo các luồng phụ.
    const [slots, setSlots] = useState<string[]>([]);
    const [grid, setGrid] = useState(false);
    const [sheet, setSheet] = useState<"sources" | "quality" | "mode" | null>(
        null,
    );
    const [sources, setSources] = useState<CameraSource[]>([]);
    const [loading, setLoading] = useState(false);
    const [sourceError, setSourceError] = useState("");
    const [showPan, setShowPan] = useState(false);
    const [zoom, setZoom] = useState(1);
    // Hủy kết quả tải danh sách sau khi đóng bảng hoặc mất focus.
    const sourceRequest = useRef(0);
    const activeId = connection.status?.id;
    const intercomRef = useRef(intercom);
    intercomRef.current = intercom;
    const [toolbarVisible, setToolbarVisible] = useState(true);
    const toolbarOpacity = useRef(new Animated.Value(1)).current;
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isVisible = useRef(true);

    const resetTimer = () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            isVisible.current = false;
            Animated.timing(toolbarOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setToolbarVisible(false);
            });
        }, 4000);
    };

    const showToolbar = () => {
        if (!isVisible.current) {
            isVisible.current = true;
            setToolbarVisible(true);
            Animated.timing(toolbarOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
        resetTimer();
    };

    useEffect(() => {
        if (sheet) {
            if (hideTimer.current) clearTimeout(hideTimer.current);
            isVisible.current = true;
            setToolbarVisible(true);
            toolbarOpacity.setValue(1);
        } else {
            resetTimer();
        }
    }, [sheet]);

    useEffect(() => {
        resetTimer();
        return () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, []);
    useEffect(
        () => () => {
            // Nhả PTT kể cả khi modal biến mất mà native không gửi onPressOut.
            intercomRef.current.endTalk();
        },
        [fullscreen.fullscreen],
    );
    useEffect(() => {
        if (activeId)
            setSlots((current) =>
                current.includes(activeId)
                    ? current
                    : [activeId, ...current].slice(0, 4),
            );
        setZoom(1);
    }, [activeId]);
    useEffect(() => {
        if (!connection.active) {
            setSheet(null);
            setShowPan(false);
        }
    }, [connection.active]);
    useEffect(() => {
        const request = ++sourceRequest.current;
        if (sheet !== "sources") return;
        setLoading(true);
        setSourceError("");
        void cameraApi
            .sources()
            .then(({ data }) => {
                if (sourceRequest.current === request) setSources(data);
            })
            .catch(() => {
                if (sourceRequest.current === request)
                    setSourceError(
                        "Không tải được danh sách nguồn camera. Vui lòng thử lại.",
                    );
            })
            .finally(() => {
                if (sourceRequest.current === request) setLoading(false);
            });
        return () => {
            sourceRequest.current++;
        };
    }, [sheet]);

    /** @returns Không có; chuyển sang lưới hoặc trở về luồng đang chọn. */
    const toggleGrid = () => {
        setGrid((value) => !value);
        setZoom(1);
    };
    /** @param id ID nguồn được backend cấp quyền. @returns Không có; gắn nguồn vào ô trống tiếp theo. */
    const addSource = (id: string) => {
        if (!sources.some((source) => source.id === id)) return;
        setSlots((current) =>
            current.includes(id) ? current : [...current, id].slice(0, 4),
        );
        setGrid(true);
        setSheet(null);
    };
    /** @param id Ô camera muốn điều khiển. @returns Không có; dừng audio cũ trước khi chuyển đích thao tác. */
    const select = (id: string) => {
        intercom.stop();
        onSelectCamera(id);
        setZoom(1);
    };
    /** @param icon Biểu tượng. @param label Nhãn trợ năng. @param onPress Thao tác. @returns Nút trên nền video. */
    const tool = (
        icon: React.ComponentProps<typeof Ionicons>["name"],
        label: string,
        onPress: () => void,
        selected = false,
    ) => (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={onPress}
            style={styles.tool}
        >
            <CameraControlIcon
                name={icon}
                size={25}
                color={selected ? "#ff7a00" : "#FFF"}
            />
        </Pressable>
    );
    const displayedSlots: (string | null)[] = grid
        ? Array.from(
              { length: 4 },
              (_, index) =>
                  slots[index] || (index === 0 ? activeId || null : null),
          )
        : [activeId || null];
    const modeIcon =
        videoMode.mode === "night"
            ? "moon-outline"
            : videoMode.mode === "auto"
              ? "contrast-outline"
              : "sunny-outline";
    const feeds = (
        <View style={styles.feeds}>
            {displayedSlots.map((id, index) => (
                <View
                    key={id || `empty-${index}`}
                    style={[
                        grid ? styles.tile : styles.single,
                        grid && id === activeId && styles.activeTile,
                    ]}
                >
                    {id === activeId || (!id && index === 0 && !activeId) ? (
                        <CameraLiveView connection={connection} />
                    ) : id ? (
                        <AdditionalFeed id={id} quality={quality} />
                    ) : (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Thêm camera vào ô ${index + 1}`}
                            onPress={() => setSheet("sources")}
                            style={styles.empty}
                        >
                            <Ionicons
                                name="add-circle"
                                size={42}
                                color="#DDD"
                            />
                        </Pressable>
                    )}
                    {grid && id && (
                        <>
                            {id !== activeId && (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="Chọn camera để điều khiển"
                                    onPress={() => select(id)}
                                    style={StyleSheet.absoluteFill}
                                />
                            )}
                            <Text
                                numberOfLines={1}
                                pointerEvents="none"
                                style={styles.feedName}
                            >
                                {sources.find((source) => source.id === id)
                                    ?.name ||
                                    (id === activeId
                                        ? connection.status?.name
                                        : `Camera ${index + 1}`)}
                            </Text>
                            {id !== activeId && (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="Gỡ luồng camera"
                                    style={styles.remove}
                                    onPress={() =>
                                        setSlots((current) =>
                                            current.filter(
                                                (value) => value !== id,
                                            ),
                                        )
                                    }
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={24}
                                        color="#FFF"
                                    />
                                </Pressable>
                            )}
                        </>
                    )}
                </View>
            ))}
        </View>
    );
    const options = (
        <>
            <CameraVideoOptions
                inline={fullscreen.fullscreen}
                visible={sheet === "quality"}
                title="Video Quality"
                selected={quality}
                onClose={() => setSheet(null)}
                options={[
                    { value: "1080p", label: "1080P" },
                    { value: "720p", label: "720P" },
                    { value: "auto", label: "Auto" },
                ]}
                onSelect={(value) => {
                    intercom.stop();
                    onQuality(value as VideoQuality);
                    setSheet(null);
                }}
            />
            <CameraVideoOptions
                inline={fullscreen.fullscreen}
                visible={sheet === "mode"}
                title="Video Mode"
                selected={videoMode.mode}
                busy={videoMode.pending}
                message={
                    videoMode.error ||
                    (!connection.status?.can_control
                        ? "Bạn chỉ có quyền xem chế độ camera."
                        : undefined)
                }
                onClose={() => setSheet(null)}
                options={[
                    {
                        value: "day",
                        label: "Day Mode",
                        icon: "sunny-outline",
                        disabled: !connection.status?.can_control,
                    },
                    {
                        value: "night",
                        label: "Night Mode",
                        icon: "moon-outline",
                        disabled: !connection.status?.can_control,
                    },
                    {
                        value: "auto",
                        label: "Auto",
                        disabled: !connection.status?.can_control,
                    },
                ]}
                onSelect={(value) => {
                    void videoMode.change(value as "day" | "night" | "auto");
                }}
            />
            <CameraVideoOptions
                inline={fullscreen.fullscreen}
                visible={sheet === "sources"}
                title="Thêm luồng camera"
                busy={loading}
                message={
                    sourceError ||
                    (!loading &&
                    !sources.some((source) => !slots.includes(source.id))
                        ? "Chưa có camera khác được cấu hình và cấp quyền xem."
                        : undefined)
                }
                onClose={() => setSheet(null)}
                options={sources.map((source) => ({
                    value: source.id,
                    label: source.name,
                    icon: "videocam-outline",
                    disabled: slots.includes(source.id),
                }))}
                onSelect={addSource}
            />
        </>
    );
    const qualityButton = (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Video Quality"
            onPress={() => setSheet("quality")}
            style={styles.tool}
        >
            <Text style={styles.quality}>
                {quality === "auto" ? "Auto" : quality.toUpperCase()}
            </Text>
        </Pressable>
    );
    const modeButton = tool(modeIcon, "Video Mode", () => setSheet("mode"));
    const gridButton = tool(
        grid ? "square-outline" : "duplicate-outline",
        grid ? "Xem một camera" : "Xem nhiều camera",
        toggleGrid,
        grid,
    );
    const speakerButton = tool(
        intercom.speakerEnabled ? "volume-high-outline" : "volume-mute",
        "Bật/tắt loa camera",
        intercom.toggleSpeaker,
        intercom.speakerEnabled,
    );
    const actions = (
        <>
            {tool("camera", "Chụp ảnh", () => {
                void connection.open("snapshot.jpg");
            })}
            {tool(
                "videocam",
                "Ghi hình",
                () => {
                    void connection.record();
                },
                !!connection.recordings.active,
            )}
            {tool(
                "move",
                "Pan/Tilt",
                () => setShowPan((value) => !value),
                showPan,
            )}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                    intercom.mode === "call"
                        ? "Bật/tắt microphone"
                        : "Giữ để nói"
                }
                onPress={
                    intercom.mode === "call" ? intercom.toggleMic : undefined
                }
                onPressIn={
                    intercom.mode !== "call" ? intercom.startTalk : undefined
                }
                onPressOut={intercom.endTalk}
                style={styles.tool}
            >
                <Ionicons
                    name={
                        intercom.mode === "call" && !intercom.micEnabled
                            ? "mic-off-outline"
                            : "mic-outline"
                    }
                    size={26}
                    color={intercom.micEnabled ? "#ff7a00" : "#FFF"}
                />
            </Pressable>
            {tool(
                "call-outline",
                "Bắt đầu/kết thúc Voice Call",
                intercom.toggleCall,
                intercom.mode === "call",
            )}
        </>
    );
    const closeFullscreen = () => {
        intercom.endTalk();
        setSheet(null);
        setShowPan(false);
        setZoom(1);
        fullscreen.close();
    };
    // Back đóng bảng đang mở trước, sau đó mới rời toàn màn hình.
    const handleBack = () => {
        if (sheet) setSheet(null);
        else if (showPan) setShowPan(false);
        else closeFullscreen();
    };
    const panPanel = showPan ? (
        <View style={styles.pan}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng Pan/Tilt"
                onPress={() => setShowPan(false)}
                style={styles.panClose}
            >
                <Ionicons name="close" size={24} color="#FFF" />
            </Pressable>
            <View style={styles.panDial}>
                <View style={{ transform: [{ scale: 160 / 210 }] }}>
                    <PanTiltControl
                        onMove={(direction) => {
                            void connection.move(direction);
                        }}
                    />
                </View>
            </View>
        </View>
    ) : null;
    return (
        <>
            <View style={styles.preview}>
                {!fullscreen.fullscreen && (
                    <View
                        style={styles.videoArea}
                        onTouchStart={showToolbar}
                        onPointerDown={showToolbar}
                        onPointerMove={showToolbar}
                        onPointerEnter={showToolbar}
                        onStartShouldSetResponderCapture={() => {
                            showToolbar();
                            return false;
                        }}
                    >
                        {feeds}
                        <Animated.View
                            pointerEvents={toolbarVisible ? "auto" : "none"}
                            style={[
                                styles.toolbar,
                                { opacity: toolbarOpacity },
                            ]}
                        >
                            {gridButton}
                            {qualityButton}
                            {modeButton}
                            {tool(
                                "expand-outline",
                                "Phóng to và xoay ngang",
                                fullscreen.open,
                            )}
                        </Animated.View>
                    </View>
                )}
            </View>
            {fullscreen.fullscreen && (
                <Modal
                    visible
                    animationType="fade"
                    presentationStyle="fullScreen"
                    hardwareAccelerated
                    statusBarTranslucent
                    navigationBarTranslucent
                    supportedOrientations={[
                        "portrait",
                        "landscape",
                        "landscape-left",
                        "landscape-right",
                    ]}
                    onRequestClose={handleBack}
                >
                    <SafeAreaView
                        style={styles.fullscreen}
                        edges={["top", "bottom", "left", "right"]}
                    >
                        <StatusBar hidden />
                        <CameraLandscapeView
                            actions={actions}
                            bottomLeft={gridButton}
                            bottomRight={
                                <>
                                    {modeButton}
                                    {qualityButton}
                                    {speakerButton}
                                </>
                            }
                            onClose={closeFullscreen}
                            zoom={zoom}
                            zoomEnabled={!grid}
                            onZoom={() =>
                                setZoom((value) => (value === 1 ? 2 : 1))
                            }
                            onHideActions={() => {
                                intercom.endTalk();
                                setShowPan(false);
                            }}
                            panel={panPanel}
                            options={options}
                            status={
                                intercom.error ||
                                (intercom.state === "connecting"
                                    ? "Đang kết nối âm thanh…"
                                    : intercom.mode === "call"
                                      ? `Đang đàm thoại • Mic ${intercom.micEnabled ? "bật" : "tắt"}`
                                      : intercom.micEnabled
                                        ? "Đang nói…"
                                        : undefined)
                            }
                        >
                            {feeds}
                        </CameraLandscapeView>
                    </SafeAreaView>
                </Modal>
            )}
            {!fullscreen.fullscreen && options}
        </>
    );
}
const styles = StyleSheet.create({
    preview: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
    fullscreen: { flex: 1, backgroundColor: "#000" },
    videoArea: { flex: 1, overflow: "hidden" },
    feeds: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
    single: { width: "100%", height: "100%" },
    tile: {
        width: "50%",
        height: "50%",
        borderWidth: 2,
        borderColor: "transparent",
    },
    activeTile: { borderColor: "#ff7a00" },
    empty: {
        flex: 1,
        backgroundColor: "#454B4F",
        alignItems: "center",
        justifyContent: "center",
    },
    feedName: {
        position: "absolute",
        left: 4,
        top: 4,
        right: 30,
        color: "#FFF",
        fontSize: 11,
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    remove: { position: "absolute", top: 2, right: 2, padding: 4 },
    toolbar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: "rgba(0,0,0,0.35)",
        minHeight: 44,
    },
    tool: {
        minWidth: 48,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
    },
    quality: { color: "#FFF", fontSize: 16 },
    panDial: {
        width: 160,
        height: 160,
        alignItems: "center",
        justifyContent: "center",
    },
    panClose: {
        alignSelf: "flex-end",
        minWidth: 44,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    pan: {
        position: "absolute",
        bottom: 54,
        right: 8,
        backgroundColor: "rgba(0,0,0,0.75)",
        borderRadius: 20,
        padding: 8,
    },
});
