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
    const source = useMemo(() => ({ uri, ...(hls ? { type: "m3u8" } : {}) }), [uri, hls]);

    // Chuyển luồng mượt mà khi URL video thay đổi (không unmount component, tránh chớp tắt)
    useEffect(() => {
        if (Platform.OS === "web" && htmlVideoRef.current) {
            const v = htmlVideoRef.current;
            if (v.src !== uri) {
                v.src = uri;
                if (startAt > 0) {
                    try { v.currentTime = startAt; } catch {}
                }
                v.load();
                if (!paused) {
                    v.play().catch(() => {
                        v.muted = true;
                        v.play().catch(() => {});
                    });
                }
            }
        } else if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
                (function() {
                    var v = document.getElementById('v');
                    if (v && v.src !== '${uri}') {
                        v.src = '${uri}';
                        v.load();
                        if (${startAt} > 0) {
                            try { v.currentTime = ${startAt}; } catch(e) {}
                        }
                        if (!${paused}) {
                            var p = v.play();
                            if (p && p.catch) {
                                p.catch(function() {
                                    v.muted = true;
                                    v.play().catch(function(){});
                                });
                            }
                        }
                    }
                })();
                true;
            `);
        }
    }, [uri]);

    // Xử lý tua mượt (seek) mà không re-mount player
    useEffect(() => {
        if (Platform.OS === "web" && htmlVideoRef.current) {
            const v = htmlVideoRef.current;
            if (Math.abs(v.currentTime - startAt) > 0.5) {
                try { v.currentTime = startAt; } catch {}
            }
            if (!paused) {
                v.play().catch(() => {
                    v.muted = true;
                    v.play().catch(() => {});
                });
            }
        } else if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
                (function() {
                    var v = document.getElementById('v');
                    if (v) {
                        if (Math.abs(v.currentTime - ${startAt}) > 0.5) {
                            try { v.currentTime = ${startAt}; } catch(e) {}
                        }
                        if (!${paused}) {
                            var p = v.play();
                            if (p && p.catch) {
                                p.catch(function() {
                                    v.muted = true;
                                    v.play().catch(function(){});
                                });
                            }
                        }
                    }
                })();
                true;
            `);
        } else if (player.current) {
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
            if (paused) {
                webViewRef.current.injectJavaScript("document.getElementById('v')?.pause(); true;");
            } else {
                webViewRef.current.injectJavaScript(`
                    (function() {
                        var v = document.getElementById('v');
                        if (v) {
                            var p = v.play();
                            if (p && p.catch) {
                                p.catch(function() {
                                    v.muted = true;
                                    v.play().catch(function(){});
                                });
                            }
                        }
                    })();
                    true;
                `);
            }
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
                    autoPlay={!paused}
                    style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#000" } as any}
                    onLoadedMetadata={(e: any) => {
                        if (startAt > 0) {
                            try { e.target.currentTime = startAt; } catch {}
                        }
                        if (!paused) {
                            e.target.play().catch(() => {
                                e.target.muted = true;
                                e.target.play().catch(() => {});
                            });
                        }
                    }}
                    onSeeked={(e: any) => {
                        if (!paused) {
                            e.target.play().catch(() => {
                                e.target.muted = true;
                                e.target.play().catch(() => {});
                            });
                        }
                    }}
                    onCanPlay={(e: any) => {
                        if (!paused && e.target.paused) {
                            e.target.play().catch(() => {
                                e.target.muted = true;
                                e.target.play().catch(() => {});
                            });
                        }
                    }}
                    onTimeUpdate={(e: any) => {
                        const now = Date.now();
                        if (now - lastProgressTime.current >= 200) {
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
                                    <video id="v" src="${uri}" autoplay playsinline webkit-playsinline muted controls></video>
                                    <script>
                                        const v = document.getElementById('v');
                                        var lastTimeSent = 0;
                                        function safePlay() {
                                            if (!${paused}) {
                                                var p = v.play();
                                                if (p && p.catch) {
                                                    p.catch(function() {
                                                        v.muted = true;
                                                        v.play().catch(function(){});
                                                    });
                                                }
                                            }
                                        }
                                        function initSeek() {
                                            if (${startAt} > 0 && Math.abs(v.currentTime - ${startAt}) > 0.5) {
                                                try { v.currentTime = ${startAt}; } catch(e) {}
                                            }
                                            safePlay();
                                        }
                                        v.addEventListener('loadedmetadata', initSeek);
                                        v.addEventListener('seeked', function() {
                                            safePlay();
                                        });
                                        v.addEventListener('canplay', function() {
                                            if (v.paused && !${paused}) {
                                                safePlay();
                                            }
                                        });
                                        if (v.readyState >= 1) {
                                            initSeek();
                                        }
                                        v.addEventListener('timeupdate', () => {
                                            var now = Date.now();
                                            if (now - lastTimeSent >= 200) {
                                                lastTimeSent = now;
                                                if (window.ReactNativeWebView) {
                                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', currentTime: v.currentTime }));
                                                }
                                            }
                                        });
                                        v.addEventListener('ended', () => {
                                            if (window.ReactNativeWebView) {
                                                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
                                            }
                                        });
                                        v.addEventListener('error', () => {
                                            if (window.ReactNativeWebView) {
                                                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
                                            }
                                        });
                                    </script>
                                </body>
                            </html>
                        `
                    }}
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
            bufferConfig={{ minBufferMs: 5000, maxBufferMs: 30000, bufferForPlaybackMs: 1000, bufferForPlaybackAfterRebufferMs: 2000 }}
            onEnd={onEnd}
            onError={onError}
            onLoadStart={() => { lastProgressTime.current = 0; }}
            onLoad={() => { player.current?.seek?.(startAt); }}
            onProgress={({ currentTime }: any) => onProgress?.(currentTime)}
            style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "black" }}
        />
    );
}
