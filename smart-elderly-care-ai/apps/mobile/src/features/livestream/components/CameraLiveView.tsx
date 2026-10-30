/**
 * Hiển thị luồng MJPEG trên web/native, giao diện liên kết và lỗi xem video.
 */
import React, { useState, useEffect } from "react";
import {
    Platform,
    TextInput,
    TouchableOpacity,
    View,
    Text,
    StyleProp,
    ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import { useCameraConnection } from "../hooks/useCameraConnection";
/**
 * Chọn giao diện liên kết, phát MJPEG hoặc thông báo tạm dừng/riêng tư/lỗi.
 * @param props - Kết nối camera và cấu hình hiển thị.
 * @param props.connection - Trạng thái, URL media và thao tác do hook kết nối cung cấp.
 * @param props.paused - Tạm tháo luồng video khi true.
 * @param props.style - Style bổ sung cho khung video.
 * @returns Cây giao diện React theo props và theme hiện tại.
 * @remarks Tác động: img/WebView tải media; nút liên kết và thử lại gọi hook, không xử lý audio.
 */
export function CameraLiveView({
    connection,
    paused = false,
    style,
}: {
    connection: ReturnType<typeof useCameraConnection>;
    paused?: boolean;
    style?: StyleProp<ViewStyle>;
}) {
    // Mã liên kết người dùng đang nhập; xóa sau khi liên kết thành công.
    const [code, setCode] = useState("");
    // URL media đã lỗi để ngừng thử tải lại cùng ticket trong mỗi render.
    const [failed, setFailed] = useState("");
    const uri = connection.liveUrl;

    useEffect(() => {
        if (connection.active) {
            setFailed("");
        }
    }, [connection.active, uri]);

    const handleMediaError = () => {
        setFailed(uri);
        if (connection.active && connection.privacy !== true) {
            const timer = setTimeout(() => {
                setFailed("");
                connection.refresh?.();
            }, 3000);
            return () => clearTimeout(timer);
        }
    };
    /**
     * Tạo nút liên kết hoặc thử kết nối lại trong khung live.
     * @param label - Nhãn hiển thị và mô tả thao tác.
     * @param action - Callback được gọi khi nhấn nút.
     * @returns Cây giao diện React theo props và theme hiện tại.
     */
    const button = (label: string, action: () => void) => (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={action}
            style={{ padding: 10, backgroundColor: "#ff7a00", borderRadius: 8 }}
        >
            <Text style={{ color: "#fff" }}>{label}</Text>
        </TouchableOpacity>
    );
    return (
        <View style={[{ flex: 1, backgroundColor: "#000" }, style]}>
            {connection.needsPairing ? (
                <View
                    style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: 16,
                        gap: 8,
                    }}
                >
                    <Text style={{ color: "#fff" }}>
                        Liên kết camera với tài khoản chủ nhà
                    </Text>
                    <TextInput
                        placeholder="Mã liên kết camera"
                        placeholderTextColor="#94a3b8"
                        value={code}
                        onChangeText={setCode}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={{
                            color: "#fff",
                            borderWidth: 1,
                            borderColor: "#64748b",
                            padding: 8,
                        }}
                    />
                    {button("Liên kết", () => {
                        void connection.pair(code).then((ok) => {
                            if (ok) setCode("");
                        });
                    })}
                </View>
            ) : connection.active &&
              uri &&
              !paused &&
              connection.privacy !== true &&
              failed !== uri ? (
                Platform.OS === "web" ? (
                    <img
                        src={uri}
                        alt="Camera trực tiếp"
                        onError={handleMediaError}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                        }}
                    />
                ) : (
                    <WebView
                        key={uri}
                        originWhitelist={["*"]}
                        scrollEnabled={false}
                        mixedContentMode="always"
                        source={{
                            html: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;background:black;height:100%;overflow:hidden}img{width:100%;height:100%;object-fit:contain}</style><img src="${uri.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" onerror="window.ReactNativeWebView.postMessage('error')">`,
                        }}
                        onMessage={(event) => {
                            if (event.nativeEvent.data === "error")
                                handleMediaError();
                        }}
                        onError={handleMediaError}
                        onHttpError={handleMediaError}
                        style={{ flex: 1, backgroundColor: "#000" }}
                    />
                )
            ) : (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                        gap: 8,
                    }}
                >
                    <Text style={{ color: "#fff", textAlign: "center" }}>
                        {connection.privacy === true
                            ? "Camera đang bật chế độ riêng tư"
                            : paused
                              ? "Đã tạm dừng"
                              : connection.error ||
                                "Chưa nhận được hình từ camera"}
                    </Text>
                    {!paused &&
                        button("Kết nối lại", () => {
                            setFailed("");
                            connection.refresh();
                        })}
                </View>
            )}
        </View>
    );
}
