/** Khung xem ngang: video ở giữa, công cụ dọc thu gọn và các nút nằm trong ảnh. */
import React, { useRef, useState } from "react";
import {
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { cameraViewport, clampCameraPan } from "../services/cameraViewport";

interface Props {
    children: React.ReactNode;
    actions: React.ReactNode;
    bottomLeft: React.ReactNode;
    bottomRight: React.ReactNode;
    panel?: React.ReactNode;
    options?: React.ReactNode;
    zoomEnabled: boolean;
    zoom: number;
    onZoom: () => void;
    onClose: () => void;
    onHideActions: () => void;
    status?: string;
}
/**
 * @param props Video, callback và công cụ của camera đang chọn.
 * @returns Bố cục ngang theo vùng an toàn, xoay UI dự phòng nếu OS không khóa ngang được.
 * @remarks Zoom 2x cho phép kéo ảnh; viewport thật xoay ngang thì bỏ phép xoay UI dự phòng.
 */
export default function CameraLandscapeView(props: Props) {
    const window = useWindowDimensions();
    const [size, setSize] = useState({
        width: window.width,
        height: window.height,
    });
    const [actionsVisible, setActionsVisible] = useState(true);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const viewport = cameraViewport(size.width, size.height, actionsVisible);
    // Gesture giữ thông số mới nhất mà không tạo lại responder giữa lúc kéo.
    const gesture = useRef({
        pan,
        viewport,
        zoom: props.zoom,
        enabled: props.zoomEnabled,
    });
    gesture.current = {
        pan,
        viewport,
        zoom: props.zoom,
        enabled: props.zoomEnabled,
    };
    const origin = useRef({ x: 0, y: 0 });
    const responder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, state) =>
                gesture.current.enabled &&
                gesture.current.zoom > 1 &&
                Math.abs(state.dx) + Math.abs(state.dy) > 6,
            onPanResponderGrant: () => {
                origin.current = gesture.current.pan;
            },
            onPanResponderMove: (_, state) => {
                const { viewport: frame, zoom } = gesture.current;
                // Đổi vector chạm vật lý về trục ngang của UI khi đang xoay dự phòng.
                const dx = frame.rotated ? state.dy : state.dx;
                const dy = frame.rotated ? -state.dx : state.dy;
                setPan({
                    x: clampCameraPan(
                        origin.current.x + dx,
                        frame.videoWidth,
                        zoom,
                    ),
                    y: clampCameraPan(
                        origin.current.y + dy,
                        frame.videoHeight,
                        zoom,
                    ),
                });
            },
            onPanResponderTerminationRequest: () => true,
        }),
    ).current;
    const zoom = props.zoomEnabled ? props.zoom : 1;
    const x = clampCameraPan(pan.x, viewport.videoWidth, zoom);
    const y = clampCameraPan(pan.y, viewport.videoHeight, zoom);
    return (
        <View
            testID="camera-landscape-viewport"
            style={styles.viewport}
            onLayout={({ nativeEvent: { layout } }) =>
                setSize({ width: layout.width, height: layout.height })
            }
        >
            <View
                style={[
                    styles.landscape,
                    {
                        width: viewport.width,
                        height: viewport.height,
                        left: viewport.left,
                        top: viewport.top,
                        transform: [
                            { rotate: viewport.rotated ? "90deg" : "0deg" },
                        ],
                    },
                ]}
            >
                <View style={styles.videoArea}>
                    <View
                        style={[
                            styles.frame,
                            {
                                width: viewport.videoWidth,
                                height: viewport.videoHeight,
                            },
                        ]}
                    >
                        <View
                            style={[
                                StyleSheet.absoluteFill,
                                {
                                    transform: [
                                        { translateX: x },
                                        { translateY: y },
                                        { scale: zoom },
                                    ],
                                },
                            ]}
                        >
                            {props.children}
                        </View>
                        {zoom > 1 && (
                            <View
                                testID="camera-zoom-pan"
                                style={StyleSheet.absoluteFill}
                                {...responder.panHandlers}
                            />
                        )}
                        <View pointerEvents="box-none" style={styles.top}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Thoát toàn màn hình"
                                onPress={props.onClose}
                                style={styles.button}
                            >
                                <Ionicons
                                    name="chevron-back"
                                    size={32}
                                    color="#FFF"
                                />
                            </Pressable>
                            {props.zoomEnabled && (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        zoom > 1
                                            ? "Thu về kích thước gốc"
                                            : "Phóng to 2 lần"
                                    }
                                    onPress={() => {
                                        setPan({ x: 0, y: 0 });
                                        props.onZoom();
                                    }}
                                    style={styles.button}
                                >
                                    <Text
                                        style={{
                                            color:
                                                zoom > 1 ? "#ff7a00" : "#FFF",
                                            fontWeight: "600",
                                        }}
                                    >
                                        {zoom > 1 ? "2×" : "1×"}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                        <Svg
                            pointerEvents="none"
                            width="100%"
                            height={110}
                            style={styles.shade}
                        >
                            <Defs>
                                <LinearGradient
                                    id="camera-landscape-shade"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <Stop
                                        offset="0"
                                        stopColor="#000"
                                        stopOpacity={0}
                                    />
                                    <Stop
                                        offset="1"
                                        stopColor="#000"
                                        stopOpacity={0.7}
                                    />
                                </LinearGradient>
                            </Defs>
                            <Rect
                                width="100%"
                                height="100%"
                                fill="url(#camera-landscape-shade)"
                            />
                        </Svg>
                        <View pointerEvents="box-none" style={styles.bottom}>
                            <View style={styles.tools}>{props.bottomLeft}</View>
                            <View style={styles.tools}>
                                {props.bottomRight}
                            </View>
                        </View>
                        {props.panel}
                        {props.status ? (
                            <Text
                                accessibilityLiveRegion="polite"
                                numberOfLines={2}
                                style={styles.status}
                            >
                                {props.status}
                            </Text>
                        ) : null}
                    </View>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                        actionsVisible
                            ? "Thu gọn thanh thao tác"
                            : "Mở thanh thao tác"
                    }
                    accessibilityState={{ expanded: actionsVisible }}
                    onPress={() => {
                        if (actionsVisible) props.onHideActions();
                        setActionsVisible((value) => !value);
                    }}
                    style={[styles.handle, { right: viewport.railWidth }]}
                >
                    <Ionicons
                        name={
                            actionsVisible ? "chevron-forward" : "chevron-back"
                        }
                        size={24}
                        color="#FFF"
                    />
                </Pressable>
                {actionsVisible && (
                    <ScrollView
                        style={[
                            styles.railScroll,
                            { width: viewport.railWidth },
                        ]}
                        contentContainerStyle={[
                            styles.rail,
                            { minHeight: viewport.height },
                        ]}
                    >
                        {props.actions}
                    </ScrollView>
                )}
                {props.options}
            </View>
        </View>
    );
}
const styles = StyleSheet.create({
    viewport: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
    landscape: {
        position: "absolute",
        flexDirection: "row",
        backgroundColor: "#000",
    },
    videoArea: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: "center",
        alignItems: "center",
    },
    frame: { backgroundColor: "#000", overflow: "hidden" },
    shade: { position: "absolute", bottom: 0, left: 0 },
    top: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    button: {
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 24,
    },
    bottom: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 6,
    },
    tools: { flexDirection: "row", alignItems: "center" },
    rail: {
        justifyContent: "space-evenly",
        alignItems: "center",
        paddingVertical: 12,
        backgroundColor: "#000",
    },
    railScroll: {
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        backgroundColor: "#000",
    },
    handle: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#080808",
        borderTopLeftRadius: 60,
        borderBottomLeftRadius: 60,
    },
    status: {
        position: "absolute",
        left: 54,
        right: 54,
        top: 8,
        color: "#FFF",
        textAlign: "center",
        fontSize: 12,
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 4,
        borderRadius: 6,
    },
});
