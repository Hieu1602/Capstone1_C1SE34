import React, { useState } from "react";
import {
    Platform,
    TextInput,
    TouchableOpacity,
    View,
    Text,
} from "react-native";
import { WebView } from "react-native-webview";
import { useCameraConnection } from "./useCameraConnection";

export function CameraLiveView({
    connection,
    paused = false,
    style,
}: {
    connection: ReturnType<typeof useCameraConnection>;
    paused?: boolean;
    style?: any;
}) {
    const [code, setCode] = useState("");
    const [failed, setFailed] = useState("");
    const uri = connection.liveUrl;
    const button = (label: string, action: () => void) => (
        <TouchableOpacity
            onPress={action}
            style={{ padding: 10, backgroundColor: "#2563eb", borderRadius: 8 }}
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
            ) : connection.active && uri && !paused && failed !== uri ? (
                Platform.OS === "web" ? (
                    <img
                        src={uri}
                        alt="Camera trực tiếp"
                        onError={() => setFailed(uri)}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                        }}
                    />
                ) : (
                    <WebView
                        originWhitelist={["*"]}
                        scrollEnabled={false}
                        mixedContentMode="always"
                        source={{
                            html: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;background:black;height:100%;overflow:hidden}img{width:100%;height:100%;object-fit:contain}</style><img src="${uri.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" onerror="window.ReactNativeWebView.postMessage('error')">`,
                        }}
                        onMessage={() => setFailed(uri)}
                        onError={() => setFailed(uri)}
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
                        {paused
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
