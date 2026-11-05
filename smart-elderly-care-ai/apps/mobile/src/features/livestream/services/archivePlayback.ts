import type { HlsRecording } from "../../../services/camera";

export function playbackPosition(items: HlsRecording[], target: Date) {
    let offset = 0;
    for (const item of items) {
        const start = new Date(item.started_at).getTime();
        if (target.getTime() < start + item.duration * 1000) {
            return { item, seconds: offset + Math.max(0, (target.getTime() - start) / 1000) };
        }
        offset += item.duration;
    }
}

export function recordingAtProgress(items: HlsRecording[], seconds: number) {
    let offset = 0;
    for (const [index, item] of items.entries()) {
        if (seconds < offset + item.duration || index === items.length - 1) {
            return { item, time: new Date(new Date(item.started_at).getTime() + Math.max(0, Math.min(item.duration, seconds - offset)) * 1000) };
        }
        offset += item.duration;
    }
}
