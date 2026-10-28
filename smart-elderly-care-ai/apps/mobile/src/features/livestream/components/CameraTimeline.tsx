import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import { ArchiveCoverage, ArchivedRecording, cameraApi } from "../../../services/camera";
import { useTheme } from "../../../store/useThemeStore";
import { DAY_SECONDS, localDayWindow, secondsFromLocalMidnight, timeAtSeconds } from "../services/archiveTimeline";
import ArchivePlayer from "./ArchivePlayer";

const HOUR_WIDTH = 100;
const DAY_WIDTH = 24 * HOUR_WIDTH;
const SEEK_WINDOW_MS = 45_000;

const sameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatTime = (value: Date) => value.toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

export default function CameraTimeline({ cameraId }: { cameraId?: string }) {
    const { colors } = useTheme();
    const initial = new Date();
    const [day, setDay] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), initial.getDate()));
    const [playhead, setPlayhead] = useState(initial);
    const [coverage, setCoverage] = useState<ArchiveCoverage[]>([]);
    const [selected, setSelected] = useState<ArchivedRecording>();
    const [uri, setUri] = useState("");
    const [startAt, setStartAt] = useState(0);
    const [viewport, setViewport] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const timeline = useRef<ScrollView>(null);
    const coverageRequest = useRef(0);
    const playbackRequest = useRef(0);
    const lastUserSeek = useRef(-1);
    const dayRange = localDayWindow(day);

    function scrollTo(value: Date, animated = false) {
        timeline.current?.scrollTo({ x: secondsFromLocalMidnight(value) / DAY_SECONDS * DAY_WIDTH, animated });
    }

    async function loadCoverage() {
        const current = ++coverageRequest.current;
        setBusy(true);
        setError("");
        try {
            const { data } = await cameraApi.coverage(dayRange.start, dayRange.end, cameraId);
            if (current === coverageRequest.current) setCoverage(data.items);
        } catch {
            if (current === coverageRequest.current) setError("Không tải được dữ liệu ghi hình. Vui lòng thử lại.");
        } finally {
            if (current === coverageRequest.current) setBusy(false);
        }
    }

    async function seek(value: Date) {
        const current = ++playbackRequest.current;
        setBusy(true);
        setError("");
        setPlayhead(value);
        try {
            const start = new Date(value.getTime() - SEEK_WINDOW_MS);
            const end = new Date(value.getTime() + SEEK_WINDOW_MS);
            const { data } = await cameraApi.timeline(start.toISOString(), end.toISOString(), cameraId);
            const segments = data.items.filter(item => item.kind === "segment");
            const target = value.getTime();
            const item = segments.find(candidate => {
                const itemStart = new Date(candidate.started_at).getTime();
                return itemStart <= target && target < itemStart + candidate.duration * 1000;
            }) ?? segments.reduce<ArchivedRecording | undefined>((nearest, candidate) =>
                !nearest || Math.abs(new Date(candidate.started_at).getTime() - target) <
                    Math.abs(new Date(nearest.started_at).getTime() - target) ? candidate : nearest, undefined);
            if (!item) throw new Error("missing");
            const offset = Math.max(0, Math.min(item.duration - 0.05, (target - new Date(item.started_at).getTime()) / 1000));
            const playback = await cameraApi.playback(item.id, cameraId);
            if (current === playbackRequest.current) {
                setSelected(item);
                setStartAt(offset);
                setUri(playback.data.url);
            }
        } catch {
            if (current === playbackRequest.current) {
                setSelected(undefined);
                setUri("");
                setError("Không có video tại thời điểm này.");
            }
        } finally {
            if (current === playbackRequest.current) setBusy(false);
        }
    }

    function seekFromScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const seconds = Math.max(0, Math.min(DAY_SECONDS - 0.001,
            event.nativeEvent.contentOffset.x / DAY_WIDTH * DAY_SECONDS));
        if (Math.abs(seconds - lastUserSeek.current) < 0.5) return;
        lastUserSeek.current = seconds;
        void seek(timeAtSeconds(day, seconds));
    }

    function changeDay(amount: number) {
        const next = new Date(day);
        next.setDate(next.getDate() + amount);
        const now = new Date();
        const target = sameLocalDay(next, now) ? now : timeAtSeconds(next, 12 * 3600);
        setDay(next);
        setPlayhead(target);
        setSelected(undefined);
        setUri("");
    }

    useEffect(() => {
        void loadCoverage();
        void seek(playhead);
        return () => { coverageRequest.current++; playbackRequest.current++; };
    }, [cameraId, day.getTime()]);

    useEffect(() => {
        if (viewport) requestAnimationFrame(() => scrollTo(playhead));
    }, [viewport, day.getTime()]);

    const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayLabel = sameLocalDay(day, new Date()) ? "Hôm nay" : day.toLocaleDateString("vi-VN");

    return <View style={styles.container}>
        <View style={styles.dayPicker}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ngày trước" onPress={() => changeDay(-1)} style={styles.dayButton}>
                <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.dayLabel, { color: colors.textPrimary }]}>{dayLabel}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ngày sau" onPress={() => changeDay(1)} style={styles.dayButton}>
                <Ionicons name="chevron-forward" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
        </View>

        {uri && selected
            ? <ArchivePlayer key={uri} uri={uri} startAt={startAt}
                onProgress={seconds => {
                    const value = new Date(new Date(selected.started_at).getTime() + seconds * 1000);
                    setPlayhead(value);
                    scrollTo(value);
                }}
                onEnd={() => { void seek(new Date(new Date(selected.started_at).getTime() + selected.duration * 1000 + 100)); }}
                onError={() => setError("Video chưa tải được hoặc liên kết đã hết hạn.")} />
            : <View style={styles.emptyPlayer}><Ionicons name="videocam-outline" size={36} color={colors.textSecondary} /></View>}

        <View onLayout={event => setViewport(event.nativeEvent.layout.width)} style={styles.timelineViewport}>
            <ScrollView ref={timeline} horizontal showsHorizontalScrollIndicator={false}
                decelerationRate="fast" scrollEventThrottle={16}
                contentContainerStyle={{ paddingHorizontal: viewport / 2 }}
                onScrollEndDrag={seekFromScroll} onMomentumScrollEnd={seekFromScroll}>
                <View style={[styles.timeline, { width: DAY_WIDTH, backgroundColor: colors.surface }]}> 
                    {Array.from({ length: 25 }, (_, hour) => <View key={hour} style={[styles.hour, { left: hour * HOUR_WIDTH }]}> 
                        <View style={[styles.tick, { backgroundColor: colors.textSecondary }]} />
                        {hour < 24 && <Text style={[styles.hourText, { color: colors.textSecondary }]}>{String(hour).padStart(2, "0")}:00</Text>}
                    </View>)}
                    {coverage.map((band, index) => {
                        const start = Math.max(0, new Date(band.start).getTime() - midnight);
                        const end = Math.min(86_400_000, new Date(band.end).getTime() - midnight);
                        return <View key={`${band.start}-${index}`} style={[styles.coverage, {
                            left: start / 86_400_000 * DAY_WIDTH,
                            width: Math.max(2, (end - start) / 86_400_000 * DAY_WIDTH),
                        }]} />;
                    })}
                </View>
            </ScrollView>
            <View pointerEvents="none" style={styles.playhead}>
                <View style={styles.playheadTip} />
                <View style={styles.playheadLine} />
                <View style={[styles.playheadTip, styles.playheadTipBottom]} />
            </View>
        </View>

        <View style={styles.controls}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Lùi 10 giây" style={[styles.seekButton, { backgroundColor: colors.surface }]}
                onPress={() => { const value = new Date(playhead.getTime() - 10_000); scrollTo(value, true); void seek(value); }}>
                <Ionicons name="play-back-outline" size={25} color={colors.textPrimary} /><Text style={{ color: colors.textPrimary }}>10s</Text>
            </TouchableOpacity>
            <View style={[styles.clock, { backgroundColor: colors.surface }]}><Text style={[styles.clockText, { color: colors.textPrimary }]}>{formatTime(playhead)}</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tới 10 giây" style={[styles.seekButton, { backgroundColor: colors.surface }]}
                onPress={() => { const value = new Date(playhead.getTime() + 10_000); scrollTo(value, true); void seek(value); }}>
                <Text style={{ color: colors.textPrimary }}>10s</Text><Ionicons name="play-forward-outline" size={25} color={colors.textPrimary} />
            </TouchableOpacity>
        </View>
        {busy && <ActivityIndicator accessibilityLabel="Đang tải video" />}
        {!!error && <Text accessibilityRole="alert" style={{ color: "#D32F2F", textAlign: "center" }}>{error}</Text>}
    </View>;
}

const styles = StyleSheet.create({
    container: { gap: 12 },
    dayPicker: { alignSelf: "center", flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D7D7D7", borderRadius: 28, paddingHorizontal: 6 },
    dayButton: { padding: 8 },
    dayLabel: { minWidth: 120, textAlign: "center", fontSize: 20, fontWeight: "700", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#D7D7D7" },
    emptyPlayer: { height: 210, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
    timelineViewport: { height: 112, overflow: "hidden", backgroundColor: "#E9F4FC" },
    timeline: { height: 112, position: "relative" },
    hour: { position: "absolute", top: 0, width: HOUR_WIDTH },
    tick: { width: 1, height: 12 },
    hourText: { marginTop: 3, marginLeft: 6, fontSize: 13 },
    coverage: { position: "absolute", top: 43, height: 69, backgroundColor: "#2196E8" },
    playhead: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, marginLeft: -1, alignItems: "center" },
    playheadLine: { width: 3, flex: 1, backgroundColor: "#FF5252" },
    playheadTip: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#FF5252" },
    playheadTipBottom: { transform: [{ rotate: "180deg" }] },
    controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12 },
    seekButton: { minWidth: 76, height: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
    clock: { paddingHorizontal: 18, height: 50, borderRadius: 25, justifyContent: "center" },
    clockText: { fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
