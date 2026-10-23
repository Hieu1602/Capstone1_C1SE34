import api, { BASE_URL } from "./api";

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

export const cameraApi = {
    setup: () => api.get<{ paired: boolean }>("/camera/setup"),
    pair: (code: string) => api.post("/camera/pair", { code }),
    status: () => api.get<CameraStatus>("/camera"),
    move: (x: number, y: number) => api.post("/camera/ptz", { x, y }),
    privacy: () => api.get<{ result: { enabled: string } }>("/camera/privacy"),
    setPrivacy: (enabled: boolean) => api.post("/camera/privacy", { enabled }),
    motion: () => api.get<{ result: { enabled: string } }>("/camera/motion"),
    setMotion: (enabled: boolean) => api.post("/camera/motion", { enabled }),
    recordings: () => api.get<CameraRecordings>("/camera/recordings"),
    record: () => api.post("/camera/recordings", { seconds: 30 }),
    // WebView/trình duyệt không giữ mật khẩu camera hoặc JWT đăng nhập.
    media: async (resource: string) => {
        const { data } = await api.post<{ path: string }>("/camera/ticket", {
            resource,
        });
        return BASE_URL.replace(/\/$/, "") + data.path;
    },
};
