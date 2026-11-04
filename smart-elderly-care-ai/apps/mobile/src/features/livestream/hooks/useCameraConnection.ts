/**
 * Quản lý polling, ticket video và các thao tác camera qua backend đã phân quyền.
 */
import { useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import axios from "axios";
import {
    cameraApi,
    CameraRecordings,
    CameraStatus,
    VideoQuality,
} from "../../../services/camera";
import { useDeviceStore } from "../../../store/useDeviceStore";
import { LocalizedAlert } from "../../../i18n/LocalizedComponents";
const POLL_INTERVAL_MS = 5000;
const SETTINGS_INTERVAL_MS = 15000;
const TICKET_RENEW_INTERVAL_MS = 240000;
export type CameraMoveDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";
const MOVE_STEPS: Record<CameraMoveDirection, readonly [number, number]> = {
    UP: [0, 10],
    DOWN: [0, -10],
    LEFT: [-10, 0],
    RIGHT: [10, 0],
};
/**
 * Đồng bộ trạng thái camera khi màn hình có focus và ứng dụng ở foreground.
 * @param cameraId - ID hoặc device_id cần khớp với camera được backend cấu hình; có thể bỏ trống.
 * @param quality - Preset MJPEG; đổi preset sẽ cấp lại ticket và bỏ ảnh từ phiên cũ.
 * @returns Trạng thái video/cài đặt/bản ghi cùng các hàm thao tác camera.
 * @remarks Tác động: Gọi API định kỳ, đăng ký AppState và dọn timer; một số thao tác hiển thị thông báo.
 */
export function useCameraConnection(
    cameraId?: string,
    quality: VideoQuality = "auto",
) {
    const focused = useIsFocused();
    // Theo dõi ứng dụng ở foreground để tạm dừng polling khi xuống nền.
    const [foreground, setForeground] = useState(
        AppState.currentState == null || AppState.currentState === "active",
    );
    // Metadata và quyền của camera thực; null khi chưa kết nối hoặc bị lỗi.
    const [status, setStatus] = useState<CameraStatus | null>(null);
    // Trạng thái riêng tư đọc từ camera; null nghĩa là chưa biết.
    const [privacy, setPrivacy] = useState<boolean | null>(null);
    // Phát hiện chuyển động của Tapo, độc lập AI; null khi chưa đọc được.
    const [motion, setMotion] = useState<boolean | null>(null);
    // URL MJPEG có ticket ngắn hạn để img/WebView phát video.
    const [liveUrl, setLiveUrl] = useState("");
    // Lỗi chung ảnh hưởng kết nối video, tách khỏi lỗi thư viện bản ghi.
    const [error, setError] = useState("");
    // Yêu cầu hiện ô nhập mã khi camera chưa được liên kết.
    const [needsPairing, setNeedsPairing] = useState(false);
    // Thay đổi giá trị này để effect tạo lại vòng polling/ticket.
    const [revision, setRevision] = useState(0);
    // Bản ghi đang chạy, lỗi ghi/tải thư viện và tên tệp hoàn tất.
    const [recordings, setRecordings] = useState<CameraRecordings>({
        active: null,
        error: null,
        files: [],
    });
    // Khóa các thao tác API để tránh gửi lệnh điều khiển chồng nhau.
    const busy = useRef(false);
    // Phân biệt các vòng kết nối; kết quả thuộc vòng cũ không được cập nhật UI.
    const generation = useRef(0);
    const active = focused && foreground;
    /**
     * Yêu cầu tạo lại vòng polling và ticket xem video.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Tăng revision, khiến effect xóa dữ liệu cũ rồi tải lại.
     */
    const refresh = () => setRevision((v) => v + 1);
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) =>
            setForeground(state === "active"),
        );
        return () => subscription.remove();
    }, []);
    useEffect(() => {
        // Bỏ kết quả cũ khi đổi camera, rời màn hình hoặc kết nối lại.
        const currentGeneration = ++generation.current;
        setLiveUrl("");
        setStatus(null);
        setPrivacy(null);
        setMotion(null);
        setRecordings({ active: null, error: null, files: [] });
        setNeedsPairing(false);
        setError("");
        if (!active) {
            return;
        }
        // Đánh dấu effect đã dọn, ngăn request cũ cập nhật state.
        let cancelled = false;
        // Lịch polling tiếp theo; được hủy khi rời màn hình.
        let timer: ReturnType<typeof setTimeout>;
        // Mốc cấp ticket gần nhất để gia hạn trước giới hạn 5 phút.
        let ticketAt = 0;
        // Mốc đọc cài đặt, giúp giảm tần suất gọi API Tapo.
        let settingsAt = 0;
        /**
         * Tải lần lượt trạng thái liên kết, camera, ticket, cài đặt và thư viện bản ghi.
         * @returns Promise hoàn tất một vòng đồng bộ.
         * @remarks Tác động: Cập nhật state và đặt lịch vòng tiếp theo; bỏ kết quả nếu effect đã hủy.
         */
        const poll = async () => {
            let isConnected = false;
            try {
                // Tải song song setup và status để tiết kiệm thời gian mạng
                const [setupRes, statusRes] = await Promise.allSettled([
                    cameraApi.setup(cameraId),
                    cameraApi.status(cameraId),
                ]);
                if (cancelled) return;

                if (setupRes.status === "fulfilled") {
                    setNeedsPairing(!setupRes.value.data.paired);
                    if (!setupRes.value.data.paired) {
                        setLiveUrl("");
                        setStatus(null);
                        setPrivacy(null);
                        setMotion(null);
                        setRecordings({ active: null, error: null, files: [] });
                        ticketAt = 0;
                        return;
                    }
                }

                if (statusRes.status !== "fulfilled") {
                    throw statusRes.reason;
                }
                const data = statusRes.value.data;
                if (cameraId && ![data.id, data.device_id].includes(cameraId)) {
                    throw new Error(
                        "Camera được chọn chưa được kết nối với dịch vụ Tapo.",
                    );
                }
                setStatus(data);
                isConnected = Boolean(data.connected);

                // Ưu tiên cấp và tải URL luồng video ngay lập tức
                if (
                    data.connected &&
                    (!ticketAt ||
                        Date.now() - ticketAt > TICKET_RENEW_INTERVAL_MS)
                ) {
                    const url = await cameraApi.media(
                        "live.mjpg",
                        cameraId,
                        quality,
                    );
                    if (cancelled) return;
                    setLiveUrl(url);
                    ticketAt = Date.now();
                } else if (!data.connected) {
                    setLiveUrl("");
                    ticketAt = 0;
                }

                // Tải các thông số phụ (riêng tư, chuyển động, bản ghi) nền không chặn hiển thị video
                if (
                    !settingsAt ||
                    Date.now() - settingsAt > SETTINGS_INTERVAL_MS
                ) {
                    settingsAt = Date.now();
                    Promise.allSettled([
                        cameraApi.privacy(cameraId),
                        cameraApi.motion(cameraId),
                        cameraApi.recordings(cameraId),
                    ]).then(([privRes, motRes, recRes]) => {
                        if (cancelled) return;
                        if (privRes.status === "fulfilled") {
                            setPrivacy(privRes.value.data?.result?.enabled === "on");
                        }
                        if (motRes.status === "fulfilled") {
                            setMotion(motRes.value.data?.result?.enabled === "on");
                        }
                        if (recRes.status === "fulfilled") {
                            setRecordings(recRes.value.data);
                        }
                    });
                }
                setError("");
            } catch (err) {
                if (!cancelled) {
                    setError(errorMessage(err));
                    setLiveUrl("");
                    setStatus(null);
                    setPrivacy(null);
                    setMotion(null);
                    ticketAt = 0;
                }
            } finally {
                if (!cancelled) {
                    // Nếu chưa kết nối (driver đang mở RTSP), retry nhanh sau 1s thay vì bắt người dùng chờ 5s
                    const delay = isConnected ? POLL_INTERVAL_MS : 1000;
                    timer = setTimeout(poll, delay);
                }
            }
        };
        void poll();
        return () => {
            cancelled = true;
            if (generation.current === currentGeneration) generation.current++;
            clearTimeout(timer);
        };
    }, [active, cameraId, revision, quality]);
    /**
     * Tuần tự hóa một thao tác và kiểm tra trạng thái/quyền trước khi thực thi.
     * @param operation - Tác vụ API cần thực thi.
     * @param control - Yêu cầu quyền quản lý thiết bị khi true.
     * @param pairing - Cho phép liên kết khi chưa đọc được ID camera từ status.
     * @returns Promise<boolean>: true khi thành công trong đúng thế hệ kết nối.
     * @remarks Tác động: Khóa thao tác đang chạy và hiển thị lỗi; backend vẫn kiểm tra quyền lần cuối.
     */
    async function run(
        operation: () => Promise<unknown>,
        control = false,
        pairing = false,
    ) {
        if (busy.current) return false;
        if (
            !active ||
            (!pairing &&
                cameraId &&
                ![status?.id, status?.device_id].includes(cameraId))
        ) {
            LocalizedAlert.alert(
                "Camera",
                "Camera được chọn chưa sẵn sàng. Hãy kết nối lại.",
            );
            return false;
        }
        if (control && !status?.can_control) {
            LocalizedAlert.alert(
                "Camera",
                "Bạn cần quyền quản lý thiết bị để điều khiển camera.",
            );
            return false;
        }
        busy.current = true;
        const operationGeneration = generation.current;
        try {
            await operation();
            return generation.current === operationGeneration;
        } catch (err) {
            if (generation.current === operationGeneration)
                LocalizedAlert.alert("Camera", errorMessage(err));
            return false;
        } finally {
            busy.current = false;
        }
    }
    /**
     * Liên kết camera bằng mã đã loại bỏ khoảng trắng hai đầu.
     * @param code - Mã liên kết do chủ hệ thống cấu hình.
     * @returns Promise<boolean> cho biết việc liên kết có thành công hay không.
     * @remarks Tác động: Gọi API liên kết, làm mới polling và đồng bộ danh sách thiết bị.
     */
    async function pair(code: string) {
        if (!code.trim()) {
            LocalizedAlert.alert("Camera", "Vui lòng nhập mã liên kết.");
            return false;
        }
        const paired = await run(
            async () => {
                await cameraApi.pair(code.trim());
            },
            false,
            true,
        );
        if (paired) {
            setNeedsPairing(false);
            refresh();
            void useDeviceStore.getState().fetchDevicesFromBackend();
        }
        return paired;
    }
    /**
     * Đọc trạng thái riêng tư thật rồi gửi giá trị đảo ngược.
     * @returns Promise<boolean> từ bộ thực thi thao tác.
     * @remarks Tác động: Đổi cài đặt trên camera, cập nhật state và làm mới kết nối.
     */
    async function togglePrivacy() {
        const operationGeneration = generation.current;
        return run(async () => {
            const current =
                (await cameraApi.privacy(cameraId)).data.result.enabled ===
                "on";
            if (generation.current !== operationGeneration) return;
            await cameraApi.setPrivacy(!current, cameraId);
            if (generation.current !== operationGeneration) return;
            setPrivacy(!current);
            refresh();
        }, true);
    }
    /**
     * Xin ticket giới hạn tài nguyên rồi mở media ngoài ứng dụng.
     * @param resource - snapshot.jpg hoặc recordings/<tên tệp> do server cung cấp.
     * @returns Promise<boolean> cho biết liên kết đã được mở trong đúng phiên hay chưa.
     * @remarks Tác động: Mở trình duyệt/trình xử lý liên kết; bỏ qua ticket trả về sau khi đổi phiên.
     */
    function open(resource: string) {
        const operationGeneration = generation.current;
        return run(async () => {
            const url = await cameraApi.media(resource, cameraId);
            if (generation.current === operationGeneration)
                await Linking.openURL(url);
        });
    }
    /**
     * Đảo trạng thái phát hiện chuyển động của Tapo.
     * @returns Promise<boolean> cho biết thao tác có thành công hay không.
     * @remarks Tác động: Đọc/ghi API motion và cập nhật state; không bật/tắt AI YOLO.
     */
    async function toggleMotion() {
        const operationGeneration = generation.current;
        return run(async () => {
            const current =
                (await cameraApi.motion(cameraId)).data.result.enabled === "on";
            if (generation.current !== operationGeneration) return;
            await cameraApi.setMotion(!current, cameraId);
            if (generation.current === operationGeneration) setMotion(!current);
        }, true);
    }
    /**
     * Đổi hướng UI thành bước PTZ và gửi lệnh có kiểm tra quyền.
     * @param direction - Một trong UP, DOWN, LEFT hoặc RIGHT.
     * @returns Promise<boolean> cho biết lệnh xoay đã được xác nhận hay chưa.
     * @remarks Tác động: Gửi lệnh xoay camera; không gửi lệnh mới khi đang bận.
     */
    function move(direction: CameraMoveDirection) {
        const [x, y] = MOVE_STEPS[direction];
        return run(() => cameraApi.move(x, y, cameraId), true);
    }
    /**
     * Bắt đầu bản ghi video 30 giây nếu chưa có bản ghi đang chạy.
     * @returns Promise<boolean> cho biết lệnh ghi hình có thành công hay không.
     * @remarks Tác động: Ghi tệp trên server, tải lại thư viện và hiển thị thông báo; lỗi tải thư viện không phủ nhận lệnh ghi thành công.
     */
    async function record() {
        if (recordings.active) {
            LocalizedAlert.alert(
                "Ghi hình",
                "Bản ghi hiện tại sẽ tự kết thúc sau 30 giây.",
            );
            return false;
        }
        const operationGeneration = generation.current;
        const started = await run(async () => {
            await cameraApi.record(cameraId);
            if (generation.current !== operationGeneration) return;
            // Lệnh ghi đã thành công dù bước tải lại thư viện có thể thất bại.
            try {
                const result = await cameraApi.recordings(cameraId);
                if (generation.current === operationGeneration)
                    setRecordings(result.data);
            } catch (err) {
                if (generation.current === operationGeneration)
                    setRecordings((previous) => ({
                        ...previous,
                        error: errorMessage(err),
                    }));
            }
        }, true);
        if (started)
            LocalizedAlert.alert(
                "Ghi hình",
                "Đã bắt đầu ghi 30 giây trên server.",
            );
        return started;
    }
    return {
        status,
        privacy,
        motion,
        liveUrl,
        error,
        active,
        needsPairing,
        recordings,
        refresh,
        pair,
        run,
        open,
        record,
        move,
        togglePrivacy,
        toggleMotion,
    };
}
/**
 * Chuẩn hóa lỗi API và lỗi thao tác để hiển thị cho người dùng.
 * @param error - Lỗi chưa xác định từ API hoặc trình xử lý liên kết.
 * @returns Thông báo ngắn, ưu tiên detail dạng chuỗi từ backend.
 */
function errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        return typeof detail === "string"
            ? detail
            : "Không kết nối được camera. Kiểm tra backend và mạng Wi-Fi.";
    }
    return error instanceof Error
        ? error.message
        : "Không thực hiện được thao tác camera.";
}
