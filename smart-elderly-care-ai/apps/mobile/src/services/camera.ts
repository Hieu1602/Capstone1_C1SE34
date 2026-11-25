/**
 * Định nghĩa API camera qua backend: liên kết, PTZ, cài đặt, bản ghi và signaling WebRTC.
 */
import api, { BASE_URL } from "./api";

export type VideoQuality = "1080p" | "720p" | "auto";
export type VideoMode = "day" | "night" | "auto";
export interface CameraSource {
    id: string;
    name: string;
}
/** @param cameraId ID nguồn đã đăng ký trên backend. @returns Query định tuyến, không chứa credential. */
const sourceConfig = (cameraId?: string) => ({
    params: cameraId ? { camera_id: cameraId } : {},
});

export interface CameraStatus {
    id: string;
    device_id: string;
    name: string;
    connected: boolean;
    can_control: boolean;
}
export interface CameraRecordings {
    active: string | null;
    error: string | null;
    files: string[];
}

export interface ArchivedRecording {
    id: string;
    device_id: string;
    kind: "segment" | "incident" | "snapshot";
    started_at: string;
    duration: number;
    incident_id: string | null;
}
export interface FallDetectionStatus {
    enabled: boolean;
    detected: boolean;
    last_fall: number | null;
    fall_count: number;
    latest_clip: string | null;
}
export interface AudioDetectionStatus {
    enabled: boolean;
    model_loaded: boolean;
    detected: boolean;
    last_event: number | null;
    event_count: number;
    last_class: string | null;
    last_category: "IMPACT" | "DISTRESS" | null;
    last_confidence: number | null;
}
export interface ArchiveCursor { after_time: string; after_id: string }
export interface ArchiveCoverage { start: string; end: string }
export interface HlsRecording { id: string; started_at: string; duration: number }
export interface HlsSession { url: string; expires_at: number; items: HlsRecording[] }
export const cameraApi = {
    hls: async (start: string, end: string, cameraId?: string): Promise<HlsSession> => {
        const { data } = await api.get<{ path: string; expires_at: number; items: HlsRecording[] }>("/camera/archive/hls", {
            params: { camera_id: cameraId, start, end },
        });
        return { ...data, url: BASE_URL.replace(/\/$/, "") + data.path };
    },
    timeline: (start: string, end: string, cameraId?: string, cursor?: ArchiveCursor) =>
        api.get<{ items: ArchivedRecording[]; next: ArchiveCursor | null }>("/camera/archive", {
            params: { camera_id: cameraId, start, end, ...cursor },
        }),
    coverage: (start: string, end: string, cameraId?: string) =>
        api.get<{ items: ArchiveCoverage[] }>("/camera/archive/coverage", {
            params: { camera_id: cameraId, start, end },
        }),
    playback: (id: string, cameraId?: string, download = false) =>
        api.get<{ url: string; expires_in: number }>(`/camera/archive/${id}/playback`, {
            params: { ...sourceConfig(cameraId).params, download },
        }),
    /**
     * Kiểm tra camera đã được liên kết trong hệ thống hay chưa.
     * @returns Promise chứa cờ paired từ backend.
     */
    setup: (cameraId?: string) =>
        api.get<{ paired: boolean }>("/camera/setup", sourceConfig(cameraId)),
    /** @returns Các nguồn camera đã cấu hình mà người dùng được phép xem. */
    sources: () => api.get<CameraSource[]>("/camera/sources"),
    /** Dò quét camera RTSP/ONVIF trong mạng nội bộ */
    discover: () =>
        api.get<{
            found: Array<{
                ip: string;
                name: string;
                brand: string;
                port: number;
                status: string;
                rtsp_url?: string;
            }>;
        }>("/camera/discover"),
    /** Kiểm tra kết nối RTSP của camera trực tiếp qua cổng mạng */
    probe: (streamUrl: string) =>
        api.post<{
            success: boolean;
            reachable: boolean;
            message: string;
            brand?: string;
        }>("/camera/probe", { stream_url: streamUrl }),
    /** @param cameraId Nguồn cần đọc. @returns Chế độ ngày/đêm thực tế. */
    videoMode: (cameraId?: string) =>
        api.get<{ mode: VideoMode }>(
            "/camera/video-mode",
            sourceConfig(cameraId),
        ),
    /** @param mode Chế độ ngày/đêm. @param cameraId Nguồn cần đổi. @returns Chế độ camera xác nhận; gửi lệnh tới Tapo. */
    setVideoMode: (mode: VideoMode, cameraId?: string) =>
        api.post<{ mode: VideoMode }>(
            "/camera/video-mode",
            { mode },
            sourceConfig(cameraId),
        ),
    /**
     * Gửi mã liên kết camera cho tài khoản đang đăng nhập.
     * @param code - Mã liên kết được cấu hình trên server.
     * @returns Promise phản hồi liên kết từ backend.
     * @remarks Tác động: Có thể tạo thiết bị và gắn camera vào nhà của chủ tài khoản.
     */
    pair: (code: string) => api.post("/camera/pair", { code }),
    /**
     * Đọc metadata, trạng thái kết nối và quyền camera.
     * @returns Promise chứa trạng thái và quyền của camera.
     */
    status: (cameraId?: string) =>
        api.get<CameraStatus>("/camera", sourceConfig(cameraId)),
    /**
     * Gửi bước quay ngang/dọc của camera.
     * @param x - Bước quay ngang trong giới hạn backend.
     * @param y - Bước quay dọc trong giới hạn backend.
     * @returns Promise phản hồi PTZ.
     * @remarks Tác động: Xoay camera; backend yêu cầu quyền quản lý thiết bị.
     */
    move: (x: number, y: number, cameraId?: string) =>
        api.post("/camera/ptz", { x, y }, sourceConfig(cameraId)),
    /**
     * Đọc cài đặt che ống kính của Tapo.
     * @returns Promise chứa enabled dạng on/off.
     */
    privacy: (cameraId?: string) =>
        api.get<{ result: { enabled: string } }>(
            "/camera/privacy",
            sourceConfig(cameraId),
        ),
    /**
     * Đặt trạng thái riêng tư của camera.
     * @param enabled - true để che ống kính, false để bật lại hình.
     * @returns Promise phản hồi thay đổi cài đặt.
     * @remarks Tác động: Thay đổi cài đặt trên camera sau khi backend kiểm tra quyền.
     */
    setPrivacy: (enabled: boolean, cameraId?: string) =>
        api.post("/camera/privacy", { enabled }, sourceConfig(cameraId)),
    /**
     * Đọc cài đặt phát hiện chuyển động Tapo.
     * @returns Promise chứa enabled dạng on/off.
     */
    motion: (cameraId?: string) =>
        api.get<{ result: { enabled: string } }>(
            "/camera/motion",
            sourceConfig(cameraId),
        ),
    /**
     * Bật/tắt phát hiện chuyển động Tapo, độc lập AI YOLO.
     * @param enabled - Trạng thái phát hiện chuyển động mong muốn.
     * @returns Promise phản hồi thay đổi cài đặt.
     * @remarks Tác động: Ghi cấu hình camera có kiểm tra quyền quản lý.
     */
    setMotion: (enabled: boolean, cameraId?: string) =>
        api.post("/camera/motion", { enabled }, sourceConfig(cameraId)),
    fallDetection: (cameraId?: string) =>
        api.get<FallDetectionStatus>(
            "/camera/fall-detection",
            sourceConfig(cameraId),
        ),
    setFallDetection: (enabled: boolean, cameraId?: string) =>
        api.post<{ enabled: boolean }>(
            "/camera/fall-detection",
            { enabled },
            sourceConfig(cameraId),
        ),
    audioDetection: (cameraId?: string) =>
        api.get<AudioDetectionStatus>(
            "/camera/audio-detection",
            sourceConfig(cameraId),
        ),
    setAudioDetection: (enabled: boolean, cameraId?: string) =>
        api.post<{ enabled: boolean }>(
            "/camera/audio-detection",
            { enabled },
            sourceConfig(cameraId),
        ),
    /**
     * Lấy bản ghi đang chạy, lỗi và danh sách tệp hoàn tất trên server.
     * @returns Promise chứa CameraRecordings.
     */
    recordings: (cameraId?: string) =>
        api.get<CameraRecordings>("/camera/recordings", sourceConfig(cameraId)),
    /**
     * Yêu cầu dịch vụ camera ghi video RTSP trong 30 giây.
     * @returns Promise phản hồi bắt đầu ghi hình.
     * @remarks Tác động: Server chạy FFmpeg và tạo tệp MP4.
     */
    record: (cameraId?: string) =>
        api.post("/camera/recordings", { seconds: 30 }, sourceConfig(cameraId)),
    /**
     * Trao đổi SDP audio qua backend đã xác thực.
     * @param cameraId - ID camera phải khớp camera được cấu hình.
     * @param mode - listen chỉ nhận âm thanh; talk cho phép truyền mic.
     * @param sdp - Offer audio chứa ICE candidate.
     * @param signal - Tín hiệu hủy request khi đóng phiên.
     * @returns Promise chứa SDP answer từ go2rtc.
     * @remarks Tác động: Mở thương lượng WebRTC; backend kiểm tra quyền nghe/nói và riêng tư.
     */
    intercomOffer: (
        cameraId: string,
        mode: "listen" | "talk",
        sdp: string,
        signal?: AbortSignal,
    ) =>
        api.post<{ type: "answer"; sdp: string }>(
            "/camera/intercom/offer",
            {
                camera_id: cameraId,
                mode,
                sdp,
            },
            { ...sourceConfig(cameraId), signal, timeout: 25000 },
        ),
    /**
     * Phát câu nhắc nhở giọng nói tiếng Việt qua loa camera.
     */
    speak: (text: string, cameraId?: string, force: boolean = true, volume?: number) =>
        api.post<{ ok: boolean; dst?: string; bytes?: number }>(
            "/camera/speaker/speak",
            { text, force, ...(volume !== undefined ? { volume } : {}) },
            { ...sourceConfig(cameraId), timeout: 25000 },
        ),
    getSpeakerVolume: (cameraId?: string) =>
        api.get<{ volume: number }>("/camera/speaker/volume", sourceConfig(cameraId)),
    setSpeakerVolume: (volume: number, cameraId?: string) =>
        api.put<{ volume: number }>("/camera/speaker/volume", { volume }, sourceConfig(cameraId)),
    // WebView/trình duyệt không giữ mật khẩu camera hoặc JWT đăng nhập.
    /**
     * Xin ticket ngắn hạn cho một tài nguyên và ghép URL để trình phát mở.
     * @param resource - live.mjpg, snapshot.jpg hoặc recordings/<tệp hợp lệ>.
     * @returns Promise chứa URL media có ticket giới hạn tài nguyên.
     * @remarks Tác động: Gọi API cấp ticket; URL không chứa credential Tapo hoặc JWT đăng nhập.
     */
    media: async (
        resource: string,
        cameraId?: string,
        quality: VideoQuality = "auto",
        overlay: boolean = false,
    ) => {
        const { data } = await api.post<{ path: string }>(
            "/camera/ticket",
            {
                resource,
                quality,
                overlay,
            },
            sourceConfig(cameraId),
        );
        return BASE_URL.replace(/\/$/, "") + data.path;
    },
};

/**
 * Chuyển đổi đường dẫn media sự cố (`/recordings/...`, `/api/v1/.../playback`, hoặc URL đầy đủ)
 * thành URL trực tiếp (presigned S3 hoặc ticket camera) để `<Image>` / `<Video>` phát được.
 */
export async function resolveIncidentMediaUrl(
    rawUrl?: string | null,
    cameraId?: string,
): Promise<string | null> {
    if (!rawUrl || !rawUrl.trim()) return null;
    const clean = rawUrl.trim();
    if (/^(https?:|data:|file:)/i.test(clean)) return clean;

    const archiveMatch = clean.match(/\/camera\/archive\/([0-9a-fA-F-]{36})\/playback/);
    if (archiveMatch) {
        try {
            const { data } = await cameraApi.playback(archiveMatch[1], cameraId);
            if (data?.url) return data.url;
        } catch {
            // Fallback xuống ghép URL gốc nếu không lấy được presigned URL
        }
    }

    if (clean.startsWith("/recordings/")) {
        try {
            return await cameraApi.media(clean.slice(1), cameraId);
        } catch {
            // Fallback xuống ghép URL gốc nếu không xin được ticket
        }
    }

    const origin = (BASE_URL || "").replace(/\/api\/v1\/?$/, "");
    return `${origin}${clean.startsWith("/") ? "" : "/"}${clean}`;
}
