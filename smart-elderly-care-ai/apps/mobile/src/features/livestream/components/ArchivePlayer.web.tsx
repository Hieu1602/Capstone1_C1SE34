import React, { useEffect, useRef } from "react";
import Hls from "hls.js";
import type { ArchivePlayerProps } from "./ArchivePlayer";

export default function ArchivePlayer({ uri, startAt = 0, onEnd, onError, onProgress, paused = false, hls = false, seekVersion = 0 }: ArchivePlayerProps) {
    const player = useRef<HTMLVideoElement>(null);
    const latest = useRef({ onError, startAt, paused });
    const usingHlsJs = useRef(false);
    const loadedUri = useRef("");
    const lastProgressAt = useRef(0);
    const pendingSeek = useRef<number | null>(startAt > 0 ? startAt : null);
    latest.current = { onError, startAt, paused };
    useEffect(() => {
        const video = player.current!;
        let stream: any | undefined;
        loadedUri.current = "";
        pendingSeek.current = latest.current.startAt > 0 ? latest.current.startAt : null;
        if (hls && Hls.isSupported()) {
            usingHlsJs.current = true;
            stream = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 15,
                maxBufferLength: 10,
                maxMaxBufferLength: 20,
                maxBufferHole: 0.5,
                highBufferWatchdogPeriod: 2,
                nudgeMaxRetry: 5,
                startPosition: latest.current.startAt,
            });
            stream.on(Hls.Events.ERROR, (_: any, data: any) => { if (data.fatal) latest.current.onError(); });
            stream.loadSource(uri);
            stream.attachMedia(video);
        } else if (!hls || video.canPlayType("application/vnd.apple.mpegurl")) {
            usingHlsJs.current = false;
            video.src = uri;
        } else {
            usingHlsJs.current = false;
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
        const video = player.current;
        pendingSeek.current = startAt;
        if (video && video.readyState > 0 && loadedUri.current === uri && Math.abs(video.currentTime - startAt) > 0.35) {
            video.currentTime = startAt;
        } else if (video && video.readyState > 0 && Math.abs(video.currentTime - startAt) <= 0.35) {
            pendingSeek.current = null;
        }
    }, [startAt, seekVersion]);
    useEffect(() => {
        if (paused) player.current?.pause();
        else void player.current?.play().catch(() => {});
    }, [paused]);
    return <video ref={player} controls autoPlay={!paused} playsInline preload="auto" onEnded={onEnd} onError={onError}
        onLoadedMetadata={() => {
            if (!player.current) return;
            loadedUri.current = uri;
            if (!usingHlsJs.current && latest.current.startAt > 0 && Math.abs(player.current.currentTime - latest.current.startAt) > 0.35) {
                pendingSeek.current = latest.current.startAt;
                player.current.currentTime = latest.current.startAt;
            } else {
                pendingSeek.current = null;
            }
            if (!latest.current.paused) void player.current.play().catch(() => {});
        }}
        onSeeked={() => {
            pendingSeek.current = null;
            if (!latest.current.paused) void player.current?.play().catch(() => {});
        }}
        onTimeUpdate={() => {
            const v = player.current;
            if (!v || v.seeking) return;
            if (pendingSeek.current !== null) {
                if (Math.abs(v.currentTime - pendingSeek.current) > 1.5) return;
                pendingSeek.current = null;
            }
            const now = Date.now();
            if (now - lastProgressAt.current >= 250) {
                lastProgressAt.current = now;
                onProgress?.(v.currentTime ?? 0);
            }
        }}
        style={{ display: "block", width: "100%", aspectRatio: "16 / 9", backgroundColor: "black" }} />;
}
