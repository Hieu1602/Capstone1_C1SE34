import React, { useEffect, useMemo, useRef } from "react";
import Video, { VideoRef } from "react-native-video";

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
    const player = useRef<VideoRef>(null);
    const loadedUri = useRef("");
    const source = useMemo(() => ({ uri, ...(hls ? { type: "m3u8" } : {}) }), [uri, hls]);
    useEffect(() => {
        if (loadedUri.current === uri) player.current?.seek(startAt);
    }, [uri, startAt, seekVersion]);
    return <Video ref={player} source={source} controls paused={paused} resizeMode="contain" automaticallyWaitsToMinimizeStalling
        bufferConfig={{ minBufferMs: 15000, maxBufferMs: 45000, bufferForPlaybackMs: 1500, bufferForPlaybackAfterRebufferMs: 3000 }}
        onEnd={onEnd} onError={onError}
        onLoadStart={() => { loadedUri.current = ""; }}
        onLoad={() => { loadedUri.current = uri; player.current?.seek(startAt); }}
        onProgress={({ currentTime }) => onProgress?.(currentTime)}
        style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "black" }} />;
}
