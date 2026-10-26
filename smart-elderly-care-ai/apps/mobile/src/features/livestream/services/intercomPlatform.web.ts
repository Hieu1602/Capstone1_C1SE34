/**
 * Adapter WebRTC trình duyệt: xin mic và phát remote audio qua phần tử audio.
 */
import type { IntercomPlatform } from "./intercomSession";

/**
 * Tạo adapter web khi trình duyệt hỗ trợ WebRTC và secure context.
 * @returns Các hàm tạo peer, lấy mic và điều khiển phần tử audio.
 * @remarks Tác động: Tạo phần tử audio; ném lỗi nếu không chạy qua HTTPS/localhost.
 */
export function createIntercomPlatform(): IntercomPlatform {
    if (
        typeof RTCPeerConnection === "undefined" ||
        !globalThis.isSecureContext
    ) {
        throw new Error(
            "Trình duyệt cần HTTPS hoặc localhost để sử dụng đàm thoại.",
        );
    }
    const audio = document.createElement("audio");
    audio.autoplay = true;
    return {
        /**
         * Tạo peer trình duyệt cho kết nối WebRTC trong LAN.
         * @returns RTCPeerConnection mới, chưa trao đổi SDP.
         */
        createPeer: () => new RTCPeerConnection({ iceServers: [] }),
        /**
         * Lấy mic với khử vọng, giảm nhiễu và tự điều chỉnh mức thu.
         * @returns Promise chứa local MediaStream.
         * @remarks Tác động: Xin quyền microphone và bắt đầu thu; có thể bị trình duyệt từ chối.
         */
        getMicrophone: () =>
            navigator.mediaDevices.getUserMedia({
                video: false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            }),
        /**
         * Gắn remote track vào phần tử audio rồi thử phát.
         * @param track - Audio track nhận từ camera.
         * @returns Không có giá trị trả về.
         * @remarks Tác động: Thay srcObject và gọi play; lỗi autoplay có thể thử lại bằng nút loa.
         */
        playRemote: (track) => {
            audio.srcObject = new MediaStream([track]);
            void audio.play().catch(() => {
                /* Có thể thử lại bằng nút bật loa. */
            });
        },
        /**
         * Tắt/bật tiếng của phần tử audio, thử phát lại khi bật.
         * @param muted - true để tắt tiếng, false để nghe.
         * @returns Không có giá trị trả về.
         * @remarks Tác động: Thay thuộc tính muted và có thể gọi play.
         */
        mutePlayback: (muted) => {
            audio.muted = muted;
            if (!muted && audio.srcObject) void audio.play().catch(() => {});
        },
        /**
         * Dừng phát và bỏ tham chiếu tới remote stream.
         * @returns Không có giá trị trả về.
         * @remarks Tác động: Pause phần tử audio và xóa srcObject.
         */
        closePlayback: () => {
            audio.pause();
            audio.srcObject = null;
        },
    };
}
