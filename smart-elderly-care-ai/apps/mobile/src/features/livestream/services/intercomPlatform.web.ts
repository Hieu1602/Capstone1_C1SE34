/**
 * Adapter WebRTC trình duyệt: xin mic và phát remote audio qua phần tử audio.
 */
import type { IntercomPlatform } from "./intercomSession";

/**
 * Tạo adapter web khi trình duyệt hỗ trợ WebRTC.
 * @returns Các hàm tạo peer, lấy mic và điều khiển phần tử audio.
 */
export function createIntercomPlatform(): IntercomPlatform {
    if (typeof RTCPeerConnection === "undefined") {
        throw new Error("Trình duyệt không hỗ trợ WebRTC.");
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
         */
        getMicrophone: () => {
            if (!navigator?.mediaDevices?.getUserMedia) {
                throw new Error(
                    "Trình duyệt cần HTTPS hoặc localhost để cấp quyền microphone.",
                );
            }
            return navigator.mediaDevices.getUserMedia({
                video: false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
        },
        /**
         * Gắn remote track vào phần tử audio rồi thử phát.
         * @param track - Audio track nhận từ camera.
         */
        playRemote: (track) => {
            audio.srcObject = new MediaStream([track]);
            void audio.play().catch(() => {});
        },
        /**
         * Tắt/bật tiếng của phần tử audio, thử phát lại khi bật.
         * @param muted - true để tắt tiếng, false để nghe.
         */
        mutePlayback: (muted) => {
            audio.muted = muted;
            if (!muted && audio.srcObject) void audio.play().catch(() => {});
        },
        /**
         * Dừng phát và bỏ tham chiếu tới remote stream.
         */
        closePlayback: () => {
            audio.pause();
            audio.srcObject = null;
        },
    };
}
