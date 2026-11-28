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

const WEBVIEW_PLAYER_HTML = `<!DOCTYPE html>
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
    <video id="v" playsinline webkit-playsinline muted controls preload="auto"></video>
    <script>
        var v = document.getElementById('v');
        var lastTimeSent = 0;
        var currentUri = '';
        var desiredPaused = false;
        var pendingSeek = null;
        var lastSeekVersion = -1;

        function safePlay() {
            if (desiredPaused) return;
            var p = v.play();
            if (p && p.catch) {
                p.catch(function() {
                    v.muted = true;
                    v.play().catch(function(){});
                });
            }
        }

        window.__syncPlayer = function(state) {
            desiredPaused = !!state.paused;
            var uriChanged = state.uri && currentUri !== state.uri;
            if (uriChanged) {
                currentUri = state.uri;
                pendingSeek = state.startAt > 0 ? state.startAt : null;
                lastSeekVersion = state.seekVersion;
                v.src = state.uri;
                v.load();
            } else if (state.seekVersion !== lastSeekVersion || Math.abs((v.currentTime || 0) - state.startAt) > 0.5) {
                lastSeekVersion = state.seekVersion;
                if (v.readyState >= 1) {
                    try { v.currentTime = state.startAt; } catch(e) {}
                    pendingSeek = null;
                } else {
                    pendingSeek = state.startAt;
                }
            }
            if (desiredPaused) {
                v.pause();
            } else {
                safePlay();
            }
        };

        v.addEventListener('loadedmetadata', function() {
            if (pendingSeek !== null && Math.abs((v.currentTime || 0) - pendingSeek) > 0.35) {
                try { v.currentTime = pendingSeek; } catch(e) {}
            }
            pendingSeek = null;
            safePlay();
        });
        v.addEventListener('seeked', function() {
            pendingSeek = null;
            safePlay();
        });
        v.addEventListener('canplay', function() {
            if (v.paused && !desiredPaused) safePlay();
        });
        v.addEventListener('timeupdate', function() {
            if (v.seeking) return;
            if (pendingSeek !== null && Math.abs((v.currentTime || 0) - pendingSeek) > 1.5) return;
            var now = Date.now();
            if (now - lastTimeSent >= 250) {
                lastTimeSent = now;
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', currentTime: v.currentTime }));
                }
            }
        });
        v.addEventListener('ended', function() {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
            }
        });
        v.addEventListener('error', function() {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
            }
        });
    </script>
</body>
</html>`;

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

export default function ArchivePlayer({
    uri,
    startAt = 0,
    onEnd,
    onError,
    onProgress,
    paused = false,
    hls = false,
    seekVersion = 0,
}: ArchivePlayerProps) {
    const player = useRef<any>(null);
    const webViewRef = useRef<any>(null);
    const htmlVideoRef = useRef<HTMLVideoElement | null>(null);
    const lastProgressTime = useRef(0);
    const latestStartAt = useRef(startAt);
    const latestPaused = useRef(paused);
    const loadedUri = useRef("");
    latestStartAt.current = startAt;
    latestPaused.current = paused;
    const source = useMemo(() => ({ uri, ...(hls ? { type: "m3u8" } : {}) }), [uri, hls]);

    const syncWebView = () => {
        if (!webViewRef.current) return;
        const payload = JSON.stringify({ uri, startAt, seekVersion, paused });
        webViewRef.current.injectJavaScript(`window.__syncPlayer && window.__syncPlayer(${payload}); true;`);
    };

    // Chuyển luồng mượt mà khi URL video thay đổi (không reload WebView/component)
    useEffect(() => {
        if (Platform.OS === "web" && htmlVideoRef.current) {
            const v = htmlVideoRef.current;
            if (v.src !== uri) {
                loadedUri.current = "";
                v.src = uri;
                v.load();
                if (!paused) {
                    v.play().catch(() => {
                        v.muted = true;
                        v.play().catch(() => {});
                    });
                }
            }
        } else if (webViewRef.current) {
            syncWebView();
        }
    }, [uri]);

    // Xử lý tua mượt (seek) mà không re-mount player
    useEffect(() => {
        if (Platform.OS === "web" && htmlVideoRef.current) {
            const v = htmlVideoRef.current;
            if (v.readyState >= 1 && loadedUri.current === uri && Math.abs(v.currentTime - startAt) > 0.35) {
                try { v.currentTime = startAt; } catch {}
            }
            if (!paused) {
                v.play().catch(() => {
                    v.muted = true;
                    v.play().catch(() => {});
                });
            }
        } else if (webViewRef.current) {
            syncWebView();
        } else if (player.current && loadedUri.current === uri) {
            player.current?.seek?.(startAt);
        }
    }, [startAt, seekVersion]);

    // Bật/tắt tạm dừng
    useEffect(() => {
        if (Platform.OS === "web" && htmlVideoRef.current) {
            const v = htmlVideoRef.current;
            if (paused) {
                v.pause();
            } else {
                v.play().catch(() => {
                    v.muted = true;
                    v.play().catch(() => {});
                });
            }
        } else if (webViewRef.current) {
            syncWebView();
        }
    }, [paused]);

    if (Platform.OS === "web") {
        return (
            <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "black", borderRadius: 12, overflow: "hidden" }}>
                <video
                    ref={(el: any) => {
                        htmlVideoRef.current = el;
                    }}
                    src={uri}
                    controls
                    playsInline
                    preload="auto"
                    autoPlay={!paused}
                    style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#000" } as any}
                    onLoadedMetadata={(e: any) => {
                        loadedUri.current = uri;
                        const target = latestStartAt.current;
                        if (target > 0 && Math.abs(e.target.currentTime - target) > 0.35) {
                            try { e.target.currentTime = target; } catch {}
                        }
                        if (!latestPaused.current) {
                            e.target.play().catch(() => {
                                e.target.muted = true;
                                e.target.play().catch(() => {});
                            });
                        }
                    }}
                    onSeeked={(e: any) => {
                        if (!latestPaused.current) {
                            e.target.play().catch(() => {
                                e.target.muted = true;
                                e.target.play().catch(() => {});
                            });
                        }
                    }}
                    onCanPlay={(e: any) => {
                        if (!latestPaused.current && e.target.paused) {
                            e.target.play().catch(() => {
                                e.target.muted = true;
                                e.target.play().catch(() => {});
                            });
                        }
                    }}
                    onTimeUpdate={(e: any) => {
                        const now = Date.now();
                        if (now - lastProgressTime.current >= 250) {
                            lastProgressTime.current = now;
                            onProgress?.(e.target.currentTime);
                        }
                    }}
                    onEnded={onEnd}
                    onError={onError}
                />
            </View>
        );
    }

    if (!Video) {
        return (
            <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "black", borderRadius: 12, overflow: "hidden" }}>
                <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={{ html: WEBVIEW_PLAYER_HTML }}
                    onLoadEnd={syncWebView}
                    onMessage={(event) => {
                        try {
                            const data = JSON.parse(event.nativeEvent.data);
                            if (data.type === 'progress') onProgress?.(data.currentTime);
                            else if (data.type === 'ended') onEnd();
                            else if (data.type === 'error') onError();
                        } catch {}
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
            bufferConfig={{ minBufferMs: 1500, maxBufferMs: 15000, bufferForPlaybackMs: 250, bufferForPlaybackAfterRebufferMs: 500 }}
            onEnd={onEnd}
            onError={onError}
            onLoadStart={() => {
                lastProgressTime.current = 0;
                loadedUri.current = "";
            }}
            onLoad={() => {
                loadedUri.current = uri;
                if (latestStartAt.current > 0) {
                    player.current?.seek?.(latestStartAt.current);
                }
            }}
            onProgress={({ currentTime }: any) => {
                const now = Date.now();
                if (now - lastProgressTime.current >= 250) {
                    lastProgressTime.current = now;
                    onProgress?.(currentTime);
                }
            }}
            style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "black" }}
        />
    );
}
