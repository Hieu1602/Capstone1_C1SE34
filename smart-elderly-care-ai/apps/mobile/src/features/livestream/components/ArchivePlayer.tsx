import React, { useRef } from "react";
import Video, { VideoRef } from "react-native-video";

export interface ArchivePlayerProps {
    uri: string;
    startAt?: number;
    onEnd: () => void;
    onError: () => void;
    onProgress?: (seconds: number) => void;
}

export default function ArchivePlayer({ uri, startAt = 0, onEnd, onError, onProgress }: ArchivePlayerProps) {
    const player = useRef<VideoRef>(null);
    return <Video ref={player} source={{ uri }} controls resizeMode="contain" onEnd={onEnd} onError={onError}
        onLoad={() => { if (startAt > 0) player.current?.seek(startAt); }}
        onProgress={({ currentTime }) => onProgress?.(currentTime)}
        style={{ width: "100%", height: 210, backgroundColor: "black" }} />;
}
