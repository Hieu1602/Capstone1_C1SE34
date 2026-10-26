/** Quản lý toàn màn hình và khóa ngang, phục hồi hướng khi đóng hoặc rời màn hình. */
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

/** @param active Màn hình camera còn hoạt động. @returns Trạng thái và thao tác mở/đóng toàn màn hình. */
export function useCameraFullscreen(active: boolean) {
    const [fullscreen, setFullscreen] = useState(false);
    // Tuần tự hóa khóa/khôi phục khi người dùng mở rồi đóng liên tiếp.
    const orientationQueue = useRef<Promise<void>>(Promise.resolve());
    useEffect(() => {
        if (!active) setFullscreen(false);
    }, [active]);
    useEffect(() => {
        if (!fullscreen) return;
        let disposed = false;
        let previous = ScreenOrientation.OrientationLock.PORTRAIT_UP;
        // Nối cleanup sau tác vụ khóa để tránh request khóa ngang hoàn tất sau khi đã thoát.
        const rotation = orientationQueue.current
            .catch(() => {})
            .then(async () => {
                if (Platform.OS === "web") return;
                previous = await ScreenOrientation.getOrientationLockAsync();
                if (!disposed)
                    await ScreenOrientation.lockAsync(
                        ScreenOrientation.OrientationLock.LANDSCAPE,
                    );
            });
        orientationQueue.current = rotation;
        void rotation.catch(() => {});
        const onExit = () => {
            if (!document.fullscreenElement) setFullscreen(false);
        };
        if (Platform.OS === "web")
            document.addEventListener("fullscreenchange", onExit);
        return () => {
            disposed = true;
            if (Platform.OS === "web") {
                document.removeEventListener("fullscreenchange", onExit);
                if (document.fullscreenElement)
                    void document.exitFullscreen().catch(() => {});
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
        if (!active) return;
        setFullscreen(true);
        if (
            Platform.OS === "web" &&
            document.documentElement.requestFullscreen
        ) {
            // Trình duyệt không hỗ trợ vẫn xem được bằng modal phủ viewport.
            void document.documentElement.requestFullscreen().catch(() => {});
        }
    };
    return { fullscreen, open, close: () => setFullscreen(false) };
}
