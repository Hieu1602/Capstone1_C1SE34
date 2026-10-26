/**
 * Điều phối phiên nghe, giữ để nói và Voice Call; đồng bộ trạng thái mic/loa với UI.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { cameraApi } from "../../../services/camera";
import { useCameraConnection } from "./useCameraConnection";
import { createIntercomPlatform } from "../services/intercomPlatform";
import { IntercomSession, IntercomState } from "../services/intercomSession";

type Mode = "listen" | "ptt" | "call";

/**
 * Quản lý một phiên audio gắn với camera đang được xem.
 * @param connection - Trạng thái camera, quyền điều khiển và vòng đời màn hình.
 * @param selectedCameraId - ID được chọn để tránh đàm thoại nhầm camera.
 * @returns Trạng thái audio, lỗi và các callback Talk/Call/mic/loa/dừng.
 * @remarks Tác động: Xin quyền mic khi cần, trao đổi SDP và đóng audio khi rời màn hình/đổi camera/bật riêng tư.
 */
export function useCameraIntercom(
    connection: ReturnType<typeof useCameraConnection>,
    selectedCameraId?: string,
) {
    // Trạng thái signaling/kết nối audio dùng để hiển thị trong panel.
    const [state, setState] = useState<IntercomState>("idle");
    // Phân biệt nghe, PTT và Voice Call của phiên hiện tại.
    const [mode, setMode] = useState<Mode | null>(null);
    // Lỗi quyền mic hoặc signaling để người dùng biết vì sao audio chưa mở.
    const [error, setError] = useState("");
    // Ý định truyền mic của UI; session chỉ bật track sau khi kết nối.
    const [micEnabled, setMicEnabled] = useState(false);
    // Ý định nghe remote audio, đồng bộ với track và adapter phát.
    const [speakerEnabled, setSpeakerEnabled] = useState(false);
    // Phiên sở hữu peer, track và request cần hủy khi đổi màn hình.
    const session = useRef<IntercomSession | null>(null);
    // Chế độ cập nhật đồng bộ để nhả nút PTT không phụ thuộc render tiếp theo.
    const modeRef = useRef<Mode | null>(null);
    const cameraId = connection.status?.id;
    const available =
        connection.active &&
        connection.status?.connected &&
        connection.privacy !== true &&
        (!selectedCameraId ||
            [connection.status.id, connection.status.device_id].includes(
                selectedCameraId,
            ));

    /**
     * Dừng phiên hiện tại và đưa trạng thái mic/loa về nghỉ.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Đóng peer, hủy request và giải phóng microphone qua session.
     */
    const stop = useCallback(() => {
        const previous = session.current;
        session.current = null;
        previous?.close();
        modeRef.current = null;
        setState("idle");
        setMode(null);
        setMicEnabled(false);
        setSpeakerEnabled(false);
    }, []);

    /**
     * Thay phiên audio hiện tại sau khi kiểm tra camera và quyền truyền mic.
     * @param nextMode - listen chỉ nghe, ptt giữ để nói, call đàm thoại liên tục.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Tạo adapter/session, gọi signaling và cập nhật state; lỗi được giữ để UI hiển thị.
     */
    const begin = useCallback(
        (nextMode: Mode) => {
            stop();
            setError("");
            if (!available || !cameraId) {
                setState("error");
                setError("Camera chưa sẵn sàng hoặc đang bật chế độ riêng tư.");
                return;
            }
            if (nextMode !== "listen" && !connection.status?.can_control) {
                setState("error");
                setError("Bạn cần quyền quản lý thiết bị để đàm thoại.");
                return;
            }
            try {
                const platform = createIntercomPlatform();
                const next = new IntercomSession({
                    mode: nextMode === "listen" ? "listen" : "talk",
                    platform,
                    /**
                     * Gửi offer audio tới backend để nhận SDP answer.
                     * @param sdp - Offer đã gom đủ ICE candidate.
                     * @param signal - Tín hiệu hủy khi người dùng dừng phiên.
                     * @returns Promise chứa SDP answer của go2rtc.
                     * @remarks Tác động: Gọi API intercom có JWT; không gửi credential Tapo từ app.
                     */
                    exchange: async (sdp, signal) =>
                        (
                            await cameraApi.intercomOffer(
                                cameraId,
                                nextMode === "listen" ? "listen" : "talk",
                                sdp,
                                signal,
                            )
                        ).data.sdp,
                    /**
                     * Nhận sự kiện từ session còn hiệu lực và cập nhật giao diện.
                     * @param nextState - Trạng thái kết nối audio mới.
                     * @param failure - Nguyên nhân thất bại nếu nextState là error.
                     * @returns Không có giá trị trả về.
                     * @remarks Tác động: Bỏ callback phiên cũ; xóa trạng thái mic/loa khi phiên lỗi.
                     */
                    onState: (nextState, failure) => {
                        if (session.current !== next) return;
                        setState(nextState);
                        if (nextState === "error") {
                            session.current = null;
                            modeRef.current = null;
                            setMode(null);
                            setMicEnabled(false);
                            setSpeakerEnabled(false);
                            setError(intercomError(failure));
                        }
                    },
                });
                session.current = next;
                modeRef.current = nextMode;
                setMode(nextMode);
                const transmit = nextMode !== "listen";
                const listen = nextMode !== "ptt";
                setMicEnabled(transmit);
                setSpeakerEnabled(listen);
                next.setMicEnabled(transmit);
                next.setSpeakerEnabled(listen);
                void next.start();
            } catch (failure) {
                setState("error");
                setError(intercomError(failure));
            }
        },
        [available, cameraId, connection.status?.can_control, stop],
    );

    /**
     * Khởi động phiên PTT khi người dùng nhấn giữ.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Yêu cầu mic và bắt đầu kết nối; loa điện thoại mặc định tắt để giảm phản hồi âm.
     */
    const startTalk = () => begin("ptt");
    // stop() hủy cả yêu cầu quyền mic/SDP đang chờ khi người dùng nhả nút sớm.
    /**
     * Dừng audio nếu thao tác hiện tại là PTT.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Hủy cả bước xin quyền/signaling còn chờ khi nhả nút sớm.
     */
    const endTalk = () => {
        if (modeRef.current === "ptt") stop();
    };
    /**
     * Bắt đầu Voice Call hoặc kết thúc cuộc gọi đang có.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Tạo/đóng session và thay đổi trạng thái mic, loa.
     */
    const toggleCall = () => {
        if (modeRef.current === "call") stop();
        else begin("call");
    };
    /**
     * Đảo trạng thái truyền mic trong phiên Voice Call.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Bật/tắt local audio track; không mở phiên mới nếu chưa gọi.
     */
    const toggleMic = () => {
        if (modeRef.current !== "call" || !session.current) return;
        setMicEnabled((enabled) => {
            session.current?.setMicEnabled(!enabled);
            return !enabled;
        });
    };
    /**
     * Bật/tắt phiên nghe hoặc tắt/bật loa trong cuộc gọi.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Tạo phiên listen nếu chưa có session; đóng phiên listen khi chạm lần nữa.
     */
    const toggleSpeaker = () => {
        if (!session.current) {
            begin("listen");
            return;
        }
        if (modeRef.current === "listen") {
            stop();
            return;
        }
        setSpeakerEnabled((enabled) => {
            session.current?.setSpeakerEnabled(!enabled);
            return !enabled;
        });
    };

    useEffect(() => {
        if (
            !available ||
            (modeRef.current &&
                modeRef.current !== "listen" &&
                !connection.status?.can_control)
        )
            stop();
    }, [available, cameraId, connection.status?.can_control, stop]);
    useEffect(() => {
        stop();
        return () => {
            session.current?.close();
            session.current = null;
        };
    }, [cameraId, stop]);

    return {
        state,
        mode,
        error,
        micEnabled,
        speakerEnabled,
        startTalk,
        endTalk,
        toggleCall,
        toggleMic,
        toggleSpeaker,
        stop,
    };
}

/**
 * Đổi lỗi signaling hoặc quyền microphone thành thông báo UI.
 * @param error - Lỗi chưa xác định từ adapter/session/API.
 * @returns Chuỗi lỗi phù hợp với quyền mic, backend hoặc môi trường chạy.
 */
function intercomError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        return typeof detail === "string"
            ? detail
            : "Không kết nối được dịch vụ đàm thoại.";
    }
    if (error instanceof Error) {
        if (
            ["NotAllowedError", "SecurityError"].includes(error.name) ||
            /permission|denied/i.test(error.message)
        ) {
            return "Chưa có quyền microphone. Hãy cho phép microphone trong cài đặt ứng dụng/trình duyệt.";
        }
        return error.message;
    }
    return "Không mở được âm thanh camera.";
}

export type CameraIntercom = ReturnType<typeof useCameraIntercom>;
