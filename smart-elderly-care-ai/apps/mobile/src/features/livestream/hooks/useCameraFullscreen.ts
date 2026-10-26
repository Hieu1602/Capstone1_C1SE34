/** Quản lý toàn màn hình và khóa ngang, phục hồi hướng khi đóng hoặc rời màn hình. */
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

/** @param active Màn hình camera còn hoạt động. @returns Trạng thái và thao tác mở/đóng toàn màn hình. */
export function useCameraFullscreen(active: boolean) {
    const [fullscreen, setFullscreen] = useState(false);
    const requested = useRef(false);
    const browserEntered = useRef(false);
    const browserRequest = useRef<Promise<void>>(Promise.resolve());
    // Tuần tự hóa khóa/khôi phục khi người dùng mở rồi đóng liên tiếp.
    const orientationQueue = useRef<Promise<void>>(Promise.resolve());
    useEffect(() => {
        if (!active) {
            requested.current = false;
            setFullscreen(false);
        }
    }, [active]);
    useEffect(() => {
        if (!fullscreen) return;
        let disposed = false;
        let previous = ScreenOrientation.OrientationLock.PORTRAIT_UP;
        // Nối cleanup sau tác vụ khóa để tránh request khóa ngang hoàn tất sau khi đã thoát.
        const rotation = orientationQueue.current
            .catch(() => {})
            .then(async () => {
                if (Platform.OS === "web") {
                    await browserRequest.current;
                    if (
                        !disposed &&
                        requested.current &&
                        document.fullscreenElement
                    ) {
                        await ScreenOrientation.lockAsync(
                            ScreenOrientation.OrientationLock.LANDSCAPE,
                        );
                    }
                    return;
                }
                previous = await ScreenOrientation.getOrientationLockAsync();
                if (!disposed)
                    await ScreenOrientation.lockAsync(
                        ScreenOrientation.OrientationLock.LANDSCAPE,
                    );
            });
        orientationQueue.current = rotation;
        void rotation.catch(() => {});
        const onExit = () => {
            if (document.fullscreenElement) browserEntered.current = true;
            else if (browserEntered.current) {
                requested.current = false;
                setFullscreen(false);
            }
        };
        if (Platform.OS === "web")
            document.addEventListener("fullscreenchange", onExit);
        return () => {
            disposed = true;
            if (Platform.OS === "web") {
                document.removeEventListener("fullscreenchange", onExit);
                // Không để request fullscreen trả về muộn mở lại trình duyệt sau khi modal đóng.
                void browserRequest.current.then(async () => {
                    if (requested.current) return;
                    await rotation.catch(() => {});
                    if (browserEntered.current) {
                        await ScreenOrientation.unlockAsync().catch(() => {});
                    }
                    if (
                        document.fullscreenElement === document.documentElement
                    ) {
                        await document.exitFullscreen().catch(() => {});
                    }
                    browserEntered.current = false;
                });
            } else {
                orientationQueue.current = rotation
                    .catch(() => {})
                    .then(() => ScreenOrientation.lockAsync(previous))
                    .catch(() => {});
            }
        };
    }, [fullscreen]);
    /** @returns Không có; web yêu cầu fullscreen ngay trong sự kiện nhấn để giữ user gesture. */
    const open = () => {
        if (!active || requested.current) return;
        requested.current = true;
        setFullscreen(true);
        if (
            Platform.OS === "web" &&
            document.documentElement.requestFullscreen
        ) {
            // Trình duyệt không hỗ trợ vẫn xem được bằng modal phủ viewport.
            browserRequest.current = document.documentElement
                .requestFullscreen()
                .then(() => {
                    browserEntered.current = true;
                    if (
                        !requested.current &&
                        document.fullscreenElement === document.documentElement
                    ) {
                        return document.exitFullscreen();
                    }
                })
                .catch(() => {});
        }
    };
    /** @returns Không có; cleanup tuần tự phục hồi hướng và thoát fullscreen của trình duyệt. */
    const close = () => {
        requested.current = false;
        setFullscreen(false);
    };
    // Cleanup khi màn hình bị tháo trong lúc toàn màn hình vẫn đang mở.
    useEffect(
        () => () => {
            requested.current = false;
        },
        [],
    );
    return { fullscreen, open, close };
}
