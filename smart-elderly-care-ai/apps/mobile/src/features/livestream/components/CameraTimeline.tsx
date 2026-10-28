import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { LocalizedText as Text } from "../../../i18n/LocalizedComponents";
import {
    ArchiveCoverage,
    HlsRecording,
    HlsSession,
    cameraApi,
} from "../../../services/camera";
import { useTheme } from "../../../store/useThemeStore";
import {
    DAY_SECONDS,
    localDayWindow,
    secondsFromLocalMidnight,
    timeAtSeconds,
} from "../services/archiveTimeline";
import {
    playbackPosition,
    recordingAtProgress,
} from "../services/archivePlayback";
import ArchivePlayer from "./ArchivePlayer";
import downloadVideo from "../services/downloadVideo";

const HOUR_WIDTHS = [50, 75, 100, 150, 225, 300, 400];
const TICK_MINUTES_BY_ZOOM = [60, 60, 60, 30, 15, 10, 5];

const sameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const formatTime = (value: Date) =>
    value.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

export default function CameraTimeline({ cameraId }: { cameraId?: string }) {
    const { colors } = useTheme();
    const initial = new Date();
    const [day, setDay] = useState(
        () =>
            new Date(
                initial.getFullYear(),
                initial.getMonth(),
                initial.getDate(),
            ),
    );
    const [playhead, setPlayhead] = useState(initial);
    const [coverage, setCoverage] = useState<ArchiveCoverage[]>([]);
    const [selected, setSelected] = useState<HlsRecording>();
    const [uri, setUri] = useState("");
    const [startAt, setStartAt] = useState(0);
    const [session, setSession] = useState<HlsSession>();
    const [seekVersion, setSeekVersion] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [viewport, setViewport] = useState(0);
    const [zoomIndex, setZoomIndex] = useState(2);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState("");
    const timeline = useRef<React.ElementRef<typeof ScrollView>>(null);
    const coverageRequest = useRef(0);
    const playbackRequest = useRef(0);
    const scrollSeekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const playheadRef = useRef(playhead);
    playheadRef.current = playhead;
    const hourWidth = HOUR_WIDTHS[zoomIndex];
    const dayWidth = 24 * hourWidth;
    const tickMinutes = TICK_MINUTES_BY_ZOOM[zoomIndex];
    const dayRange = localDayWindow(day);

    function scrollTo(value: Date, animated = false) {
        timeline.current?.scrollTo({
            x: (secondsFromLocalMidnight(value) / DAY_SECONDS) * dayWidth,
            animated,
        });
    }

    async function loadCoverage() {
        const current = ++coverageRequest.current;
        const playbackVersion = playbackRequest.current;
        setCoverage([]);
        setBusy(true);
        setError("");
        try {
            const { data } = await cameraApi.coverage(
                dayRange.start,
                dayRange.end,
                cameraId,
            );
            if (current === coverageRequest.current) {
                setCoverage(data.items);
                const latest = data.items[data.items.length - 1];
                if (latest && playbackRequest.current === playbackVersion) {
                    const target = new Date(
                        Math.max(
                            new Date(latest.start).getTime(),
                            new Date(latest.end).getTime() - 30_000,
                        ),
                    );
                    scrollTo(target);
                    await seek(target);
                }
                if (!latest) setError("Chưa có bản ghi trong ngày này.");
            }
        } catch {
            if (current === coverageRequest.current)
                setError("Không tải được dữ liệu ghi hình. Vui lòng thử lại.");
        } finally {
            if (current === coverageRequest.current) setBusy(false);
        }
    }

    async function seek(value: Date, refresh = false) {
        const current = ++playbackRequest.current;
        setBusy(true);
        setError("");
        setPlayhead(value);
        try {
            let loaded = session;
            const first = loaded?.items[0];
            const last = loaded?.items[loaded.items.length - 1];
            if (
                refresh ||
                !loaded ||
                loaded.expires_at * 1000 <= Date.now() + 60_000 ||
                !first ||
                !last ||
                value.getTime() < new Date(first.started_at).getTime() ||
                value.getTime() >=
                    new Date(last.started_at).getTime() + last.duration * 1000
            ) {
                const start = new Date(
                    Math.max(
                        new Date(dayRange.start).getTime(),
                        value.getTime() - 60_000,
                    ),
                );
                const end = new Date(
                    Math.min(
                        new Date(dayRange.end).getTime(),
                        start.getTime() + 30 * 60_000,
                    ),
                );
                loaded = await cameraApi.hls(
                    start.toISOString(),
                    end.toISOString(),
                    cameraId,
                );
            }
            const position = playbackPosition(loaded.items, value);
            if (!position) throw new Error("missing");
            if (current === playbackRequest.current) {
                setSession(loaded);
                setSelected(position.item);
                setStartAt(position.seconds);
                setSeekVersion(current);
                setUri(loaded.url);
                const actual = recordingAtProgress(
                    loaded.items,
                    position.seconds,
                )!.time;
                setPlayhead(actual);
                scrollTo(actual);
            }
        } catch {
            if (current === playbackRequest.current) {
                setSelected(undefined);
                setUri("");
                setError(
                    "Không tải được video tại thời điểm này. Hãy chọn thời gian khác hoặc thử lại.",
                );
            }
        } finally {
            if (current === playbackRequest.current) setBusy(false);
        }
    }

    function seekFromScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const seconds = Math.max(
            0,
            Math.min(
                DAY_SECONDS - 0.001,
                (event.nativeEvent.contentOffset.x / dayWidth) * DAY_SECONDS,
            ),
        );
        clearTimeout(scrollSeekTimer.current);
        setDragging(false);
        void seek(timeAtSeconds(day, seconds));
    }

    function changeDay(amount: number) {
        const next = new Date(day);
        next.setDate(next.getDate() + amount);
        const now = new Date();
        const target = sameLocalDay(next, now)
            ? now
            : timeAtSeconds(next, 12 * 3600);
        setDay(next);
        setPlayhead(target);
        setSelected(undefined);
        setUri("");
        setSession(undefined);
        playbackRequest.current++;
        clearTimeout(scrollSeekTimer.current);
        setDragging(false);
    }

    async function downloadSelected() {
        if (!selected) return;
        const request = playbackRequest.current;
        try {
            const { data } = await cameraApi.playback(
                selected.id,
                cameraId,
                true,
            );
            if (request === playbackRequest.current)
                await downloadVideo(data.url);
        } catch {
            if (request === playbackRequest.current)
                setError("Không tải được video. Vui lòng thử lại.");
        }
    }

    useEffect(() => {
        void loadCoverage();
        return () => {
            coverageRequest.current++;
            playbackRequest.current++;
            clearTimeout(scrollSeekTimer.current);
        };
    }, [cameraId, day.getTime()]);

    useEffect(() => {
        if (viewport) requestAnimationFrame(() => scrollTo(playhead));
    }, [viewport, day.getTime(), zoomIndex]);

    useEffect(() => {
        if (!session) return;
        const timer = setTimeout(
            () => {
                void seek(playheadRef.current, true);
            },
            Math.max(0, session.expires_at * 1000 - Date.now() - 60_000),
        );
        return () => clearTimeout(timer);
    }, [session]);

    const midnight = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
    ).getTime();
    const dayLabel = day.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

    return (
        <View style={styles.container}>
            {uri && selected ? (
                <ArchivePlayer
                    uri={uri}
                    hls
                    startAt={startAt}
                    seekVersion={seekVersion}
                    paused={busy || dragging}
                    onProgress={(seconds) => {
                        if (busy || dragging || !session) return;
                        const position = recordingAtProgress(
                            session.items,
                            seconds,
                        );
                        if (!position) return;
                        setSelected(position.item);
                        setPlayhead(position.time);
                        scrollTo(position.time);
                    }}
                    onEnd={() => {
                        const last = session?.items[session.items.length - 1];
                        if (!busy && !dragging && last)
                            void seek(
                                new Date(
                                    new Date(last.started_at).getTime() +
                                        last.duration * 1000,
                                ),
                            );
                    }}
                    onError={() =>
                        setError(
                            "Video chưa tải được hoặc liên kết đã hết hạn.",
                        )
                    }
                />
            ) : (
                <View style={styles.emptyPlayer}>
                    {busy ? (
                        <ActivityIndicator
                            color="#FFF"
                            accessibilityLabel="Đang tải video"
                        />
                    ) : (
                        <Ionicons
                            name="videocam-off-outline"
                            size={44}
                            color="#FFF"
                        />
                    )}
                    <Text style={styles.playerMessage}>
                        {busy ? "Đang tải bản ghi…" : "Không có video để phát"}
                    </Text>
                </View>
            )}

            <View style={styles.dayPicker}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Ngày trước"
                    onPress={() => changeDay(-1)}
                    style={styles.dayButton}
                >
                    <Ionicons
                        name="chevron-back"
                        size={24}
                        color={colors.textPrimary}
                    />
                </TouchableOpacity>
                <Text style={[styles.dayLabel, { color: colors.textPrimary }]}>
                    {dayLabel}
                </Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Ngày sau"
                    disabled={sameLocalDay(day, new Date())}
                    onPress={() => changeDay(1)}
                    style={styles.dayButton}
                >
                    <Ionicons
                        name="chevron-forward"
                        size={24}
                        color={
                            sameLocalDay(day, new Date())
                                ? colors.textMuted
                                : colors.textPrimary
                        }
                    />
                </TouchableOpacity>
                <View
                    style={[
                        styles.storageBadge,
                        { backgroundColor: colors.primaryLight },
                    ]}
                >
                    <Ionicons
                        name="cloud-outline"
                        size={24}
                        color={colors.primary}
                    />
                </View>
            </View>

            {coverage.length > 0 ? (
                <>
                    <View style={styles.zoomControls}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Thu nhỏ thanh tua"
                            disabled={zoomIndex === 0}
                            onPress={() =>
                                setZoomIndex((index) => Math.max(0, index - 1))
                            }
                            style={[
                                styles.zoomButton,
                                {
                                    backgroundColor: colors.surface,
                                    opacity: zoomIndex === 0 ? 0.45 : 1,
                                },
                            ]}
                        >
                            <Ionicons
                                name="remove"
                                size={22}
                                color={colors.textPrimary}
                            />
                        </TouchableOpacity>
                        <Text
                            style={[
                                styles.zoomLevel,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {hourWidth / 100}×
                        </Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Phóng to thanh tua"
                            disabled={zoomIndex === HOUR_WIDTHS.length - 1}
                            onPress={() =>
                                setZoomIndex((index) =>
                                    Math.min(HOUR_WIDTHS.length - 1, index + 1),
                                )
                            }
                            style={[
                                styles.zoomButton,
                                {
                                    backgroundColor: colors.surface,
                                    opacity:
                                        zoomIndex === HOUR_WIDTHS.length - 1
                                            ? 0.45
                                            : 1,
                                },
                            ]}
                        >
                            <Ionicons
                                name="add"
                                size={22}
                                color={colors.textPrimary}
                            />
                        </TouchableOpacity>
                    </View>
                    <View
                        onLayout={(event) =>
                            setViewport(event.nativeEvent.layout.width)
                        }
                        style={[
                            styles.timelineViewport,
                            { backgroundColor: colors.primaryLight },
                        ]}
                    >
                        <ScrollView
                            ref={timeline}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            scrollEventThrottle={16}
                            contentContainerStyle={{
                                paddingHorizontal: viewport / 2,
                            }}
                            onScrollBeginDrag={() => {
                                clearTimeout(scrollSeekTimer.current);
                                setDragging(true);
                            }}
                            onScrollEndDrag={(event) => {
                                const offset =
                                    event.nativeEvent.contentOffset.x;
                                scrollSeekTimer.current = setTimeout(() => {
                                    setDragging(false);
                                    void seek(
                                        timeAtSeconds(
                                            day,
                                            (offset / dayWidth) * DAY_SECONDS,
                                        ),
                                    );
                                }, 150);
                            }}
                            onMomentumScrollBegin={() =>
                                clearTimeout(scrollSeekTimer.current)
                            }
                            onMomentumScrollEnd={seekFromScroll}
                        >
                            <View
                                testID="camera-timeline-content"
                                style={[
                                    styles.timeline,
                                    {
                                        width: dayWidth,
                                        backgroundColor: colors.surface,
                                    },
                                ]}
                            >
                                {Array.from(
                                    {
                                        length: (24 * 60) / tickMinutes + 1,
                                    },
                                    (_, index) => {
                                        const totalMinutes =
                                            index * tickMinutes;
                                        const hour = Math.floor(
                                            totalMinutes / 60,
                                        );
                                        const minute = totalMinutes % 60;
                                        const isHour = minute === 0;
                                        const label =
                                            tickMinutes === 5 && !isHour
                                                ? String(minute).padStart(
                                                      2,
                                                      "0",
                                                  )
                                                : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                                        return (
                                            <View
                                                key={totalMinutes}
                                                testID="timeline-tick"
                                                style={[
                                                    styles.hour,
                                                    {
                                                        left:
                                                            (totalMinutes /
                                                                (24 * 60)) *
                                                            dayWidth,
                                                    },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.tick,
                                                        isHour &&
                                                            styles.majorTick,
                                                        {
                                                            backgroundColor:
                                                                colors.textSecondary,
                                                        },
                                                    ]}
                                                />
                                                {totalMinutes < 24 * 60 &&
                                                    (tickMinutes !== 60 ||
                                                        isHour) && (
                                                        <Text
                                                            testID="timeline-tick-label"
                                                            style={[
                                                                styles.hourText,
                                                                {
                                                                    color: colors.textSecondary,
                                                                },
                                                            ]}
                                                        >
                                                            {label}
                                                        </Text>
                                                    )}
                                            </View>
                                        );
                                    },
                                )}
                                {coverage.map((band, index) => {
                                    const start = Math.max(
                                        0,
                                        new Date(band.start).getTime() -
                                            midnight,
                                    );
                                    const end = Math.min(
                                        86_400_000,
                                        new Date(band.end).getTime() - midnight,
                                    );
                                    return (
                                        <View
                                            key={`${band.start}-${index}`}
                                            style={[
                                                styles.coverage,
                                                {
                                                    backgroundColor:
                                                        colors.primary,
                                                    left:
                                                        (start / 86_400_000) *
                                                        dayWidth,
                                                    width: Math.max(
                                                        2,
                                                        ((end - start) /
                                                            86_400_000) *
                                                            dayWidth,
                                                    ),
                                                },
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                        </ScrollView>
                        <View pointerEvents="none" style={styles.playhead}>
                            <View style={styles.playheadTip} />
                            <View style={styles.playheadLine} />
                            <View
                                style={[
                                    styles.playheadTip,
                                    styles.playheadTipBottom,
                                ]}
                            />
                        </View>
                    </View>

                    <View style={styles.controls}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Lùi 10 giây"
                            style={[
                                styles.seekButton,
                                { backgroundColor: colors.surface },
                            ]}
                            onPress={() => {
                                const value = new Date(
                                    playhead.getTime() - 10_000,
                                );
                                scrollTo(value, true);
                                void seek(value);
                            }}
                        >
                            <Ionicons
                                name="play-back-outline"
                                size={25}
                                color={colors.textPrimary}
                            />
                            <Text style={{ color: colors.textPrimary }}>
                                10s
                            </Text>
                        </TouchableOpacity>
                        <View
                            style={[
                                styles.clock,
                                { backgroundColor: colors.surface },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.clockText,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                {formatTime(playhead)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Tới 10 giây"
                            style={[
                                styles.seekButton,
                                { backgroundColor: colors.surface },
                            ]}
                            onPress={() => {
                                const value = new Date(
                                    playhead.getTime() + 10_000,
                                );
                                scrollTo(value, true);
                                void seek(value);
                            }}
                        >
                            <Text style={{ color: colors.textPrimary }}>
                                10s
                            </Text>
                            <Ionicons
                                name="play-forward-outline"
                                size={25}
                                color={colors.textPrimary}
                            />
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                !busy && (
                    <View style={styles.emptyArchive}>
                        <View style={styles.emptyIcon}>
                            <Ionicons
                                name="cloud-offline-outline"
                                size={64}
                                color="#54718A"
                            />
                        </View>
                        <Text
                            style={[
                                styles.emptyTitle,
                                { color: colors.textPrimary },
                            ]}
                        >
                            Chưa tải được bản ghi
                        </Text>
                        <Text
                            style={[
                                styles.emptyText,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {error || "Chọn ngày khác để tìm video đã lưu."}
                        </Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => {
                                void loadCoverage();
                            }}
                            style={styles.retryButton}
                        >
                            <Text
                                style={[
                                    styles.retryText,
                                    { color: colors.primary },
                                ]}
                            >
                                Tải lại bản ghi
                            </Text>
                        </TouchableOpacity>
                    </View>
                )
            )}
            {selected && (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Tải xuống đoạn video đang chọn"
                    style={styles.controls}
                    onPress={() => {
                        void downloadSelected();
                    }}
                >
                    <Ionicons
                        name="download-outline"
                        size={24}
                        color={colors.textPrimary}
                    />
                    <Text style={{ color: colors.textPrimary }}>
                        Tải xuống đoạn video
                    </Text>
                </TouchableOpacity>
            )}
            {busy && !!uri && (
                <ActivityIndicator accessibilityLabel="Đang tải video" />
            )}
            {!!error && coverage.length > 0 && (
                <Text
                    accessibilityRole="alert"
                    style={{ color: "#D32F2F", textAlign: "center" }}
                >
                    {error}
                </Text>
            )}
            {!!error && coverage.length > 0 && (
                <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.retryButton}
                    onPress={() => {
                        void seek(playhead, true);
                    }}
                >
                    <Text style={[styles.retryText, { color: colors.primary }]}>
                        Thử lại
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 12 },
    dayPicker: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    dayButton: {
        width: 44,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    dayLabel: { fontSize: 18, fontWeight: "500" },
    storageBadge: {
        marginLeft: "auto",
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    zoomControls: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
        paddingHorizontal: 12,
    },
    zoomButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
    },
    zoomLevel: {
        minWidth: 44,
        textAlign: "center",
        fontSize: 14,
        fontWeight: "600",
        fontVariant: ["tabular-nums"],
    },
    emptyPlayer: {
        width: "100%",
        aspectRatio: 16 / 9,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
    },
    playerMessage: { color: "#CCC", fontSize: 16 },
    emptyArchive: {
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 36,
        gap: 16,
    },
    emptyIcon: { backgroundColor: "#F3F7FA", padding: 26, borderRadius: 24 },
    emptyTitle: { fontSize: 18, fontWeight: "600" },
    emptyText: { fontSize: 15, textAlign: "center", lineHeight: 23 },
    retryButton: { padding: 12, minHeight: 48 },
    retryText: { fontSize: 17, fontWeight: "600" },
    timelineViewport: { height: 112, overflow: "hidden" },
    timeline: { height: 112, position: "relative" },
    hour: { position: "absolute", top: 0 },
    tick: { width: 1, height: 7 },
    majorTick: { height: 12 },
    hourText: { marginTop: 3, marginLeft: 6, fontSize: 13 },
    coverage: { position: "absolute", top: 43, height: 69 },
    playhead: {
        position: "absolute",
        left: "50%",
        top: 0,
        bottom: 0,
        width: 2,
        marginLeft: -1,
        alignItems: "center",
    },
    playheadLine: { width: 3, flex: 1, backgroundColor: "#FF5252" },
    playheadTip: {
        width: 0,
        height: 0,
        borderLeftWidth: 7,
        borderRightWidth: 7,
        borderTopWidth: 8,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: "#FF5252",
    },
    playheadTipBottom: { transform: [{ rotate: "180deg" }] },
    controls: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },
    seekButton: {
        minWidth: 76,
        height: 50,
        borderRadius: 25,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
    },
    clock: {
        paddingHorizontal: 18,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
    },
    clockText: {
        fontSize: 24,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
    },
});
