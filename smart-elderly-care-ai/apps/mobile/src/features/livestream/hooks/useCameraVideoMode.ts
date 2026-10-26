/** Đọc và đổi chế độ ngày/đêm thực tế; bỏ kết quả thuộc camera đã rời khỏi. */
import { useEffect, useRef, useState } from "react";
import { cameraApi, VideoMode } from "../../../services/camera";
import { useCameraConnection } from "./useCameraConnection";

/**
 * @param connection Kết nối đang được chọn trên màn hình.
 * @returns Chế độ đã xác nhận, trạng thái tải/lỗi và thao tác đổi có kiểm tra quyền.
 * @remarks Gọi API khi camera đổi và mỗi 15 giây; dọn lịch khi mất focus.
 */
export function useCameraVideoMode(
    connection: ReturnType<typeof useCameraConnection>,
) {
    const [mode, setMode] = useState<VideoMode | null>(null);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const id = connection.status?.id;
    // Khóa kết quả muộn của request đọc/ghi khi đổi camera hoặc rời màn hình.
    const generation = useRef(0);
    const writing = useRef(false);
    // GET bắt đầu trước POST không được ghi đè kết quả đổi chế độ đã xác nhận.
    const changes = useRef(0);
    useEffect(() => {
        const current = ++generation.current;
        let timer: ReturnType<typeof setTimeout>;
        let cancelled = false;
        setMode(null);
        setError("");
        setPending(false);
        if (!id || !connection.active) return;
        const load = async () => {
            const version = changes.current;
            try {
                const response = await cameraApi.videoMode(id);
                if (
                    !cancelled &&
                    !writing.current &&
                    version === changes.current
                ) {
                    setMode(response.data.mode);
                    setError("");
                }
            } catch {
                if (!cancelled)
                    setError(
                        "Không đọc được chế độ ngày/đêm. Kiểm tra dịch vụ camera.",
                    );
            } finally {
                if (!cancelled) timer = setTimeout(load, 15000);
            }
        };
        void load();
        return () => {
            cancelled = true;
            clearTimeout(timer);
            if (generation.current === current) generation.current++;
        };
    }, [id, connection.active]);

    /** @param next Chế độ yêu cầu. @returns Promise xác nhận; chỉ cập nhật UI sau khi camera phản hồi. */
    const change = async (next: VideoMode) => {
        if (!id || writing.current) return false;
        const current = generation.current;
        changes.current++;
        writing.current = true;
        setPending(true);
        try {
            return await connection.run(async () => {
                const response = await cameraApi.setVideoMode(next, id);
                if (current === generation.current) {
                    setMode(response.data.mode);
                    setError("");
                }
            }, true);
        } finally {
            writing.current = false;
            if (current === generation.current) setPending(false);
        }
    };
    return { mode, error, pending, change };
}
