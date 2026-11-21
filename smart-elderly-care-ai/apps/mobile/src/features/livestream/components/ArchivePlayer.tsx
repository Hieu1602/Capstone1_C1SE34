import React, { useEffect, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { WebView } from "react-native-webview";

let Video: any = null;
const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as any).appOwnership === "expo";

if (Platform.OS !== "web" && !isExpoGo) {
    try {
        Video = require("react-native-video").default;
    } catch {}
}

export interface ArchivePlayerProps {
    uri: string;
    startAt?: number;
    onEnd: () => void;
    onError: () => void;
    onProgress?: (seconds: number) => void;
    paused?: boolean;
    hls?: boolean;
    seekVersion?: number;
}

export default function ArchivePlayer({ uri, startAt = 0, onEnd, onError, onProgress, paused = false, hls = false, seekVersion = 0 }: ArchivePlayerProps) {
    const player = useRef<any>(null);
    const loadedUri = useRef("");
    const source = useMemo(() => ({ uri, ...(hls ? { type: "m3u8" } : {}) }), [uri, hls]);

    useEffect(() => {
        if (loadedUri.current === uri) player.current?.seek?.(startAt);
    }, [uri, startAt, seekVersion]);

    if (!Video) {
        return (
            <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "black", borderRadius: 12, overflow: "hidden" }}>
                <WebView
                    source={{
                        html: `
                            <!DOCTYPE html>
                            <html>
                                <head>
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                    <style>
                                        * { margin: 0; padding: 0; box-sizing: border-box; }
                                        body { background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
                                        video { width: 100%; height: 100%; object-fit: contain; }
                                    </style>
                                </head>
                                <body>
                                    <video src="${uri}" controls autoplay playsinline></video>
                                </body>
                            </html>
                        `
                    }}
                    style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    scrollEnabled={false}
                />
            </View>
        );
    }

    return (
        <Video
            ref={player}
            source={source}
            controls
            paused={paused}
            resizeMode="contain"
            automaticallyWaitsToMinimizeStalling
            bufferConfig={{ minBufferMs: 5000, maxBufferMs: 30000, bufferForPlaybackMs: 1000, bufferForPlaybackAfterRebufferMs: 2000 }}
            onEnd={onEnd}
            onError={onError}
            onLoadStart={() => { loadedUri.current = ""; }}
            onLoad={() => { loadedUri.current = uri; player.current?.seek?.(startAt); }}
            onProgress={({ currentTime }: any) => onProgress?.(currentTime)}
            style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "black" }}
        />
    );
}
