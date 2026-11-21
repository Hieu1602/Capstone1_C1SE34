/**
 * Adapter WebRTC native; chỉ nạp module khi bắt đầu audio để vẫn xem video bằng Expo Go.
 */
import { NativeModules } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { IntercomPlatform } from "./intercomSession";

/**
 * Kiểm tra xem nền tảng hiện tại có hỗ trợ WebRTC native hay không.
 * Expo Go không đóng gói react-native-webrtc nên sẽ trả về false.
 */
export function isIntercomSupported(): boolean {
    const isExpoGo =
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
        (Constants as any).appOwnership === "expo";
    if (isExpoGo) return false;
    return Boolean(NativeModules.WebRTCModule);
}

/**
 * Tạo adapter WebRTC cho development/native build.
 * @returns Các hàm tạo peer, xin mic và quản lý phát audio native.
 * @remarks Tác động: Nạp module native; ném lỗi hướng dẫn nếu module không có trong bản build.
 */
export function createIntercomPlatform(): IntercomPlatform {
    if (!isIntercomSupported()) {
        throw new Error(
            "Đàm thoại cần development build có react-native-webrtc; Expo Go không hỗ trợ.",
        );
    }
    // Nạp khi người dùng gọi; Expo Go vẫn xem video được khi thiếu module native.
    let rtc: typeof import("react-native-webrtc");
    try {
        rtc = require("react-native-webrtc");
    } catch {
        throw new Error(
            "Đàm thoại cần development build có react-native-webrtc; Expo Go không hỗ trợ.",
        );
    }
    return {
        /**
         * Tạo peer native dùng các ICE candidate trong LAN.
         * @returns RTCPeerConnection dùng chung giao diện với session.
         */
        createPeer: () =>
            new rtc.RTCPeerConnection({
                iceServers: [],
            }) as unknown as RTCPeerConnection,
        /**
         * Xin microphone và lấy audio stream native, không lấy camera điện thoại.
         * @returns Promise chứa local MediaStream.
         * @remarks Tác động: Có thể hiện hộp thoại quyền và bắt đầu thu mic; session chịu trách nhiệm dừng track.
         */
        getMicrophone: async () =>
            (await rtc.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            })) as unknown as MediaStream,
        // WebRTC native tự phát remote audio; bật/tắt qua remote track trong session.
        /**
         * Giữ giao diện adapter; WebRTC native tự phát remote audio.
         * @returns Không có giá trị trả về.
         */
        playRemote: () => {},
        /**
         * Giữ giao diện adapter; session tắt/bật remote track trên native.
         * @returns Không có giá trị trả về.
         */
        mutePlayback: () => {},
        /**
         * Giữ giao diện adapter; peer và track native được session dọn.
         * @returns Không có giá trị trả về.
         */
        closePlayback: () => {},
    };
}
