import React, { useEffect, useRef } from "react";
// @ts-ignore
import Hls from "hls.js/dist/hls.min.js";
import type { ArchivePlayerProps } from "./ArchivePlayer";

export default function ArchivePlayer({ uri, startAt = 0, onEnd, onError, onProgress, paused = false, hls = false, seekVersion = 0 }: ArchivePlayerProps) {
    const player = useRef<HTMLVideoElement>(null);
    const latest = useRef({ onError, startAt, paused });
    latest.current = { onError, startAt, paused };
    useEffect(() => {
        const video = player.current!;
        let stream: any | undefined;
        if (hls && Hls.isSupported()) {
            stream = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, backBufferLength: 60, startPosition: latest.current.startAt });
            stream.on(Hls.Events.ERROR, (_: any, data: any) => { if (data.fatal) latest.current.onError(); });
            stream.loadSource(uri);
            stream.attachMedia(video);
        } else if (!hls || video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = uri;
        } else {
            latest.current.onError();
        }
        return () => {
            stream?.destroy();
            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [uri, hls]);
    useEffect(() => {
        if (player.current && player.current.readyState > 0) player.current.currentTime = startAt;
    }, [startAt, seekVersion]);
    useEffect(() => {
        if (paused) player.current?.pause();
        else void player.current?.play().catch(() => {});
    }, [paused]);
    return <video ref={player} controls autoPlay={!paused} playsInline preload="auto" onEnded={onEnd} onError={onError}
        onLoadedMetadata={() => {
            if (!player.current) return;
            player.current.currentTime = latest.current.startAt;
            if (!latest.current.paused) void player.current.play().catch(() => {});
        }}
        onTimeUpdate={() => onProgress?.(player.current?.currentTime ?? 0)}
        style={{ display: "block", width: "100%", aspectRatio: "16 / 9", backgroundColor: "black" }} />;
}
