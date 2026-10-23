import { useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import axios from "axios";
import {
    cameraApi,
    CameraRecordings,
    CameraStatus,
} from "../../services/camera";
import { useDeviceStore } from "../../store/useDeviceStore";
import { LocalizedAlert } from "../../i18n/LocalizedComponents";

export function useCameraConnection(cameraId?: string) {
    const focused = useIsFocused();
    const [foreground, setForeground] = useState(
        AppState.currentState === "active",
    );
    const [status, setStatus] = useState<CameraStatus | null>(null);
    const [privacy, setPrivacy] = useState<boolean | null>(null);
    const [liveUrl, setLiveUrl] = useState("");
    const [error, setError] = useState("");
    const [needsPairing, setNeedsPairing] = useState(false);
    const [revision, setRevision] = useState(0);
    const [recordings, setRecordings] = useState<CameraRecordings>({
        active: null,
        error: null,
        files: [],
    });
    const busy = useRef(false);
    const active = focused && foreground;
    const refresh = () => setRevision((v) => v + 1);
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) =>
            setForeground(state === "active"),
        );
        return () => subscription.remove();
    }, []);
    useEffect(() => {
        if (!active) {
            setLiveUrl("");
            return;
        }
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        let ticketAt = 0;
        let settingsAt = 0;
        setLiveUrl("");
        setStatus(null);
        setError("");
        const poll = async () => {
            try {
                const setup = await cameraApi.setup();
                if (cancelled) return;
                setNeedsPairing(!setup.data.paired);
                if (!setup.data.paired) return;
                const { data } = await cameraApi.status();
                if (cameraId && ![data.id, data.device_id].includes(cameraId))
                    throw new Error(
                        "Camera được chọn chưa được kết nối với dịch vụ Tapo.",
                    );
                if (cancelled) return;
                setStatus(data);
                if (data.connected && Date.now() - ticketAt > 240000) {
                    const url = await cameraApi.media("live.mjpg");
                    if (cancelled) return;
                    setLiveUrl(url);
                    ticketAt = Date.now();
                } else if (!data.connected) {
                    setLiveUrl("");
                    ticketAt = 0;
                }
                if (Date.now() - settingsAt > 15000) {
                    try {
                        const result = await cameraApi.privacy();
                        if (!cancelled)
                            setPrivacy(result.data.result.enabled === "on");
                    } catch {
                        /* RTSP vẫn hoạt động khi API điều khiển không khả dụng. */
                    }
                    settingsAt = Date.now();
                }
                const result = await cameraApi.recordings();
                if (!cancelled) {
                    setRecordings(result.data);
                    setError(result.data.error || "");
                }
            } catch (err) {
                if (!cancelled) {
                    setError(errorMessage(err));
                    setLiveUrl("");
                    setStatus(null);
                    ticketAt = 0;
                }
            } finally {
                if (!cancelled) timer = setTimeout(poll, 5000);
            }
        };
        void poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, cameraId, revision]);

    async function run(operation: () => Promise<unknown>, control = false) {
        if (busy.current) return false;
        if (control && !status?.can_control) {
            LocalizedAlert.alert(
                "Camera",
                "Bạn cần quyền quản lý thiết bị để điều khiển camera.",
            );
            return false;
        }
        busy.current = true;
        try {
            await operation();
            return true;
        } catch (err) {
            LocalizedAlert.alert("Camera", errorMessage(err));
            return false;
        } finally {
            busy.current = false;
        }
    }
    async function pair(code: string) {
        return run(async () => {
            await cameraApi.pair(code.trim());
            setNeedsPairing(false);
            refresh();
            await useDeviceStore.getState().fetchDevicesFromBackend();
        });
    }
    async function togglePrivacy() {
        await run(async () => {
            const current =
                (await cameraApi.privacy()).data.result.enabled === "on";
            await cameraApi.setPrivacy(!current);
            setPrivacy(!current);
            refresh();
        }, true);
    }
    function open(resource: string) {
        return run(async () => {
            await Linking.openURL(await cameraApi.media(resource));
        });
    }
    async function record() {
        return run(async () => {
            await cameraApi.record();
            setRecordings((await cameraApi.recordings()).data);
        }, true);
    }
    return {
        status,
        privacy,
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
        togglePrivacy,
    };
}

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
