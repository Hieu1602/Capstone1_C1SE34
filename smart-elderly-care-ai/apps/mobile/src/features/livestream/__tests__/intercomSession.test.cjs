/**
 * Kiểm thử vòng đời WebRTC, quyền mic, hủy signaling và dọn track bằng adapter giả lập.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const exportsObject = {};
vm.runInNewContext(
    ts.transpileModule(
        readFileSync(join(__dirname, "../services/intercomSession.ts"), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
            },
        },
    ).outputText,
    {
        exports: exportsObject,
        AbortController,
        setTimeout,
        clearTimeout,
        Error,
    },
);
const { IntercomSession } = exportsObject;
const ANSWER = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 8\r\na=recvonly\r\n";
/**
 * Tạo Promise có thể chủ động hoàn tất để tái hiện tác vụ trả về muộn.
 * @returns Promise và hàm resolve để điều khiển trong kiểm thử.
 */
const deferred = () => {
    let resolve;
    const promise = new Promise((r) => {
        resolve = r;
    });
    return { promise, resolve };
};
/**
 * Cho các tác vụ Promise đang chờ hoàn tất trong kiểm thử bất đồng bộ.
 * @returns Promise hoàn tất sau một số lượt microtask.
 */
const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

/**
 * Tạo peer/track giả và session để kiểm thử mà không mở mic thật.
 * @param t - Ngữ cảnh test dùng đăng ký đóng session sau kiểm thử.
 * @param options - Ghi đè chế độ, cấp quyền mic hoặc signaling.
 * @returns Session, peer, track và bộ đếm thao tác.
 * @remarks Tác động: Đăng ký cleanup với test; không kết nối camera.
 */
function harness(t, options = {}) {
    const mic = {
        enabled: true,
        stopped: 0,
        stop() {
            this.stopped++;
        },
    };
    const stream = { getTracks: () => [mic], getAudioTracks: () => [mic] };
    const states = [];
    const directions = [];
    let microphoneRequests = 0;
    let exchanged = 0;
    let muted = false;
    let playbackClosed = 0;
    const peer = new EventTarget();
    Object.assign(peer, {
        iceGatheringState: "complete",
        connectionState: "new",
        remoteDescription: null,
        closed: false,
        addTransceiver: (_, init) => directions.push(init.direction),
        createOffer: async () => ({ type: "offer", sdp: "offer-sdp" }),
        setLocalDescription: async (description) => {
            peer.localDescription = description;
        },
        setRemoteDescription: async (description) => {
            peer.remoteDescription = description;
        },
        close: () => {
            peer.closed = true;
        },
    });
    const session = new IntercomSession({
        mode: options.mode || "talk",
        platform: {
            createPeer: () => peer,
            getMicrophone: () => {
                microphoneRequests++;
                return options.microphone
                    ? options.microphone()
                    : Promise.resolve(stream);
            },
            playRemote() {},
            mutePlayback: (value) => {
                muted = value;
            },
            closePlayback: () => {
                playbackClosed++;
            },
        },
        exchange: (sdp, signal) => {
            exchanged++;
            return options.exchange
                ? options.exchange(sdp, signal)
                : Promise.resolve(ANSWER);
        },
        onState: (state, error) => states.push({ state, error }),
    });
    t.after(() => session.close());
    return {
        session,
        peer,
        mic,
        stream,
        states,
        directions,
        get microphoneRequests() {
            return microphoneRequests;
        },
        get exchanged() {
            return exchanged;
        },
        get muted() {
            return muted;
        },
        get playbackClosed() {
            return playbackClosed;
        },
        connect() {
            peer.connectionState = "connected";
            peer.dispatchEvent(new Event("connectionstatechange"));
        },
    };
}

test("mic stays silent until connected; mute and close release resources", async (t) => {
    const h = harness(t);
    h.session.setMicEnabled(true);
    await h.session.start();
    assert.equal(h.mic.enabled, false);
    assert.deepEqual(h.directions, ["recvonly", "sendonly"]);
    h.connect();
    assert.equal(h.mic.enabled, true);
    h.session.setMicEnabled(false);
    assert.equal(h.mic.enabled, false);
    h.session.close();
    assert.equal(h.mic.stopped, 1);
    assert.equal(h.peer.closed, true);
});

test("release while permission dialog is pending stops late microphone tracks", async (t) => {
    const permission = deferred();
    const h = harness(t, { microphone: () => permission.promise });
    const starting = h.session.start();
    h.session.close();
    permission.resolve(h.stream);
    await starting;
    assert.equal(h.mic.stopped, 1);
    assert.equal(h.exchanged, 0);
    assert.equal(
        h.states.some((item) => item.state === "connected"),
        false,
    );
});

test("closing during SDP exchange aborts the request and ignores the answer", async (t) => {
    const answer = deferred();
    let signal;
    const h = harness(t, {
        exchange: (_, requestSignal) => {
            signal = requestSignal;
            return answer.promise;
        },
    });
    const starting = h.session.start();
    await settle();
    h.session.close();
    assert.equal(signal.aborted, true);
    answer.resolve(ANSWER);
    await starting;
    assert.equal(h.peer.remoteDescription, null);
});

test("listen mode never opens the microphone and speaker toggle affects remote tracks", async (t) => {
    const h = harness(t, { mode: "listen" });
    await h.session.start();
    assert.equal(h.microphoneRequests, 0);
    assert.deepEqual(h.directions, ["recvonly"]);
    const remote = { enabled: true, stop() {} };
    const event = new Event("track");
    event.track = remote;
    h.peer.dispatchEvent(event);
    h.session.setSpeakerEnabled(false);
    assert.equal(remote.enabled, false);
    assert.equal(h.muted, true);
    h.session.setSpeakerEnabled(true);
    assert.equal(remote.enabled, true);
});

test("permission denial reports an error without creating a signaling request", async (t) => {
    const h = harness(t, {
        microphone: async () => {
            throw new Error("Permission denied");
        },
    });
    await h.session.start();
    assert.equal(h.states.at(-1).state, "error");
    assert.equal(h.exchanged, 0);
    assert.equal(h.playbackClosed, 1);
});

test("rejected backchannel cannot be reported as a successful call", async (t) => {
    const h = harness(t, {
        exchange: async () => ANSWER.replace("audio 9", "audio 0"),
    });
    await h.session.start();
    assert.equal(h.states.at(-1).state, "error");
    assert.equal(h.mic.stopped, 1);
    assert.equal(h.peer.closed, true);
});

test("connection failure closes microphone and playback", async (t) => {
    const h = harness(t);
    await h.session.start();
    h.connect();
    h.peer.connectionState = "failed";
    h.peer.dispatchEvent(new Event("connectionstatechange"));
    assert.equal(h.states.at(-1).state, "error");
    assert.equal(h.mic.stopped, 1);
    assert.equal(h.playbackClosed, 1);
});
