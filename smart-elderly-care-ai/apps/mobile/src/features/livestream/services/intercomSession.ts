/**
 * Quản lý một phiên WebRTC audio: SDP/ICE, track mic/loa, hủy tác vụ và giới hạn thời gian.
 */
export type IntercomMode = "listen" | "talk";
export type IntercomState = "idle" | "connecting" | "connected" | "error";

export interface IntercomPlatform {
    createPeer: () => RTCPeerConnection;
    getMicrophone: () => Promise<MediaStream>;
    playRemote: (track: MediaStreamTrack) => void;
    mutePlayback: (muted: boolean) => void;
    closePlayback: () => void;
}

interface Options {
    mode: IntercomMode;
    platform: IntercomPlatform;
    exchange: (sdp: string, signal: AbortSignal) => Promise<string>;
    onState: (state: IntercomState, error?: unknown) => void;
}

/** Một phiên audio sở hữu toàn bộ peer, mic, timer và request đang chạy. */
export class IntercomSession {
    // Kết nối WebRTC duy nhất của phiên.
    private peer: RTCPeerConnection | null = null;
    // Local stream cần dừng khi nhả nút hoặc đóng cuộc gọi.
    private microphone: MediaStream | null = null;
    // Các track nhận từ camera để tắt/bật loa và dọn khi đóng.
    private remoteTracks: MediaStreamTrack[] = [];
    // Hủy request SDP và bước chờ gom ICE khi phiên bị đóng.
    private abort = new AbortController();
    // Chỉ khi peer kết nối mới cho phép truyền mic.
    private connected = false;
    // Ngăn start() chạy lặp khi còn chờ quyền mic.
    private started = false;
    // Cờ dọn tài nguyên một lần và bỏ kết quả bất đồng bộ trả về muộn.
    private closed = false;
    // Yêu cầu truyền mic, được giữ cả trong lúc đang kết nối.
    private micEnabled = false;
    // Yêu cầu nghe audio, áp dụng cả cho track nhận sau này.
    private speakerEnabled = true;
    // Giới hạn thời gian thiết lập kết nối audio.
    private timeout: ReturnType<typeof setTimeout> | undefined;
    // Giới hạn thời lượng cuộc gọi sau khi đã kết nối.
    private lifetime: ReturnType<typeof setTimeout> | undefined;

    /**
     * Lưu cấu hình một phiên audio chưa khởi động.
     * @param options - Chế độ nghe/nói, adapter, hàm trao đổi SDP và callback trạng thái.
     * @returns Đối tượng session; chưa mở mic hoặc kết nối.
     */
    constructor(private options: Options) {}

    /**
     * Xin mic nếu cần, tạo peer và thương lượng audio với camera.
     * @returns Promise hoàn tất bước signaling; trạng thái connected đến từ sự kiện peer.
     * @remarks Tác động: Đăng ký listener/timer, gọi signaling; lỗi đóng phiên và báo qua onState.
     */
    async start() {
        if (this.closed || this.started) return;
        this.started = true;
        this.options.onState("connecting");
        this.timeout = setTimeout(
            () =>
                this.fail(
                    new Error(
                        "Kết nối âm thanh quá thời gian. Kiểm tra cổng WebRTC 8555.",
                    ),
                ),
            30000,
        );
        try {
            const platform = this.options.platform;
            if (this.options.mode === "talk") {
                const stream = await platform.getMicrophone();
                if (this.closed) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                this.microphone = stream;
                stream.getAudioTracks().forEach((track) => {
                    track.enabled = false;
                });
            }
            if (this.closed) return;
            // Kết nối WebRTC duy nhất của phiên.
            const peer = platform.createPeer();
            this.peer = peer;
            peer.addEventListener("connectionstatechange", () => {
                if (this.closed) return;
                if (peer.connectionState === "connected") {
                    if (this.connected) return;
                    this.connected = true;
                    clearTimeout(this.timeout);
                    this.setMicEnabled(this.micEnabled);
                    this.options.onState("connected");
                    // Giới hạn một cuộc gọi để không giữ microphone vô thời hạn.
                    this.lifetime = setTimeout(
                        () =>
                            this.fail(
                                new Error(
                                    "Cuộc đàm thoại đã đạt giới hạn 5 phút.",
                                ),
                            ),
                        300000,
                    );
                } else if (
                    ["failed", "disconnected", "closed"].includes(
                        peer.connectionState,
                    )
                ) {
                    this.fail(new Error("Kết nối âm thanh đã bị ngắt."));
                }
            });
            peer.addEventListener("track", (event) => {
                if (this.closed) {
                    event.track.stop();
                    return;
                }
                this.remoteTracks.push(event.track);
                event.track.enabled = this.speakerEnabled;
                platform.playRemote(event.track);
                platform.mutePlayback(!this.speakerEnabled);
            });
            // Mở preview trước để go2rtc dành kết nối Tapo thứ hai cho backchannel.
            peer.addTransceiver("audio", { direction: "recvonly" });
            this.microphone
                ?.getAudioTracks()
                .forEach((track) =>
                    peer.addTransceiver(track, { direction: "sendonly" }),
                );
            await peer.setLocalDescription(await peer.createOffer());
            if (this.closed) return;
            await this.gatherIce(peer);
            if (this.closed) return;
            const answer = await this.options.exchange(
                peer.localDescription!.sdp,
                this.abort.signal,
            );
            if (this.closed) return;
            await peer.setRemoteDescription({ type: "answer", sdp: answer });
            // Không báo thành công nếu camera từ chối kênh gửi microphone.
            if (
                this.options.mode === "talk" &&
                !answer
                    .split(/(?=^m=)/m)
                    .some(
                        (section) =>
                            /^m=audio [1-9]\d* /.test(section) &&
                            /^a=(recvonly|sendrecv)\r?$/m.test(section),
                    )
            ) {
                throw new Error(
                    "Camera không chấp nhận kênh đàm thoại. Kiểm tra firmware và tài khoản Tapo cloud.",
                );
            }
        } catch (error) {
            if (!this.closed) this.fail(error);
        }
    }

    /**
     * Ghi nhận yêu cầu truyền mic và áp dụng khi peer đã kết nối.
     * @param enabled - true để cho phép truyền local audio track.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Thay trạng thái enabled của track; không tự xin quyền mic.
     */
    setMicEnabled(enabled: boolean) {
        this.micEnabled = enabled;
        this.microphone?.getAudioTracks().forEach((track) => {
            track.enabled = enabled && this.connected && !this.closed;
        });
    }

    /**
     * Áp dụng yêu cầu nghe cho remote track và adapter phát âm.
     * @param enabled - true để nghe audio từ camera.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Thay enabled của remote track và trạng thái tắt tiếng của adapter.
     */
    setSpeakerEnabled(enabled: boolean) {
        this.speakerEnabled = enabled;
        this.remoteTracks.forEach((track) => {
            track.enabled = enabled && !this.closed;
        });
        this.options.platform.mutePlayback(!enabled);
    }

    /**
     * Đóng phiên một lần và giải phóng toàn bộ tài nguyên audio.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Hủy request SDP, timer, track, peer và phần tử phát; không tự phát sự kiện lỗi.
     */
    close() {
        if (this.closed) return;
        this.closed = true;
        this.abort.abort();
        clearTimeout(this.timeout);
        clearTimeout(this.lifetime);
        this.microphone?.getTracks().forEach((track) => track.stop());
        this.remoteTracks.forEach((track) => track.stop());
        this.peer?.close();
        this.options.platform.closePlayback();
    }

    /**
     * Dọn phiên lỗi rồi thông báo nguyên nhân cho hook.
     * @param error - Lỗi kết nối, timeout hoặc signaling.
     * @returns Không có giá trị trả về.
     * @remarks Tác động: Đóng tài nguyên và gọi onState với trạng thái error.
     */
    private fail(error: unknown) {
        this.close();
        this.options.onState("error", error);
    }

    /**
     * Chờ gom đủ ICE candidate để gửi SDP bằng một request HTTP.
     * @param peer - Peer đang gom địa chỉ kết nối.
     * @returns Promise hoàn tất khi ICE complete; bị reject nếu hủy hoặc quá hạn.
     * @remarks Tác động: Tạo listener và timer tạm, dọn cả hai khi kết thúc.
     */
    private gatherIce(peer: RTCPeerConnection): Promise<void> {
        if (peer.iceGatheringState === "complete") return Promise.resolve();
        return new Promise((resolve, reject) => {
            /**
             * Kết thúc bước gom ICE và dọn các listener/timer tạm.
             * @param error - Có lỗi thì reject; bỏ trống để resolve.
             * @returns Không có giá trị trả về.
             */
            const finish = (error?: Error) => {
                clearTimeout(timer);
                peer.removeEventListener("icegatheringstatechange", changed);
                this.abort.signal.removeEventListener("abort", cancelled);
                if (error) reject(error);
                else resolve();
            };
            /**
             * Kiểm tra sự kiện ICE và kết thúc khi đã gom xong candidate.
             * @returns Không có giá trị trả về.
             */
            const changed = () => {
                if (peer.iceGatheringState === "complete") finish();
            };
            /**
             * Chuyển tín hiệu hủy phiên thành lỗi của bước gom ICE.
             * @returns Không có giá trị trả về.
             */
            const cancelled = () =>
                finish(new Error("Đã hủy kết nối âm thanh."));
            const timer = setTimeout(
                () =>
                    finish(new Error("Không lấy được địa chỉ kết nối WebRTC.")),
                10000,
            );
            peer.addEventListener("icegatheringstatechange", changed);
            this.abort.signal.addEventListener("abort", cancelled, {
                once: true,
            });
            if (this.abort.signal.aborted) cancelled();
            else changed();
        });
    }
}
