import type { ArchivedRecording } from "../../../services/camera";

export function archiveWindow(day: string, hour: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{1,2}$/.test(hour) || Number(hour) > 23)
        throw new Error("Ngày hoặc giờ không hợp lệ");
    const start = new Date(`${day}T${hour.padStart(2, "0")}:00:00`);
    if (Number.isNaN(start.getTime()) || start.getDate() !== Number(day.slice(8)))
        throw new Error("Ngày không hợp lệ");
    return { start: start.toISOString(), end: new Date(start.getTime() + 3600000).toISOString() };
}

export function nextSegment(items: ArchivedRecording[], selected: string) {
    const index = items.findIndex(item => item.id === selected);
    return index < 0 ? undefined : items.slice(index + 1).find(item => item.kind === "segment");
}

export const DAY_SECONDS = 24 * 60 * 60;

export function localDayWindow(day: Date) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
}

export function secondsFromLocalMidnight(value: Date) {
    const midnight = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    return (value.getTime() - midnight.getTime()) / 1000;
}

export function timeAtSeconds(day: Date, seconds: number) {
    const value = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    value.setSeconds(Math.max(0, Math.min(DAY_SECONDS - 0.001, seconds)));
    return value;
}
