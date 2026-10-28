import React, { useRef } from "react";

export interface ArchivePlayerProps {
    uri: string;
    startAt?: number;
    onEnd: () => void;
    onError: () => void;
    onProgress?: (seconds: number) => void;
}

export default function ArchivePlayer({ uri, startAt = 0, onEnd, onError, onProgress }: ArchivePlayerProps) {
    const player = useRef<HTMLVideoElement>(null);
    return <video ref={player} src={uri} controls autoPlay playsInline onEnded={onEnd} onError={onError}
        onLoadedMetadata={() => { if (player.current) player.current.currentTime = startAt; }}
        onTimeUpdate={() => onProgress?.(player.current?.currentTime ?? 0)}
        style={{ width: "100%", height: 210, backgroundColor: "black" }} />;
}
