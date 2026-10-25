/**
 * Kiểm thử polling, quyền camera, liên kết, ghi hình và kết quả trả về muộn bằng API giả.
 */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(
    readFileSync(join(__dirname, "../hooks/useCameraConnection.ts"), "utf8"),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
        },
    },
).outputText;

// Chạy hook với API và lifecycle giả lập, không cần camera hay React Native runtime.
/**
 * Giả lập React lifecycle, AppState và API cho hook kết nối.
 * @param overrides - Các API cần thay đổi cho tình huống kiểm thử.
 * @param cameraId - ID camera đưa vào hook.
 * @returns Bộ render, điều khiển lifecycle và dữ liệu quan sát.
 * @remarks Tác động: Dùng timer và request giả; không mở camera thật.
 */
function createHarness(overrides = {}, cameraId, quality = "auto") {
    const slots = [];
    const effects = [];
    const timers = new Set();
    const alerts = [];
    const opened = [];
    let cursor = 0;
    let focused = true;
    let appStateListener;
    const api = {
        setup: async () => ({ data: { paired: true } }),
        status: async () => ({
            data: {
                id: "camera-1",
                device_id: "device-1",
                connected: true,
                can_control: true,
            },
        }),
        media: async () => "https://camera.test/live.mjpg",
        privacy: async () => ({ data: { result: { enabled: "off" } } }),
        motion: async () => ({ data: { result: { enabled: "on" } } }),
        recordings: async () => ({
            data: { active: null, error: null, files: ["clip.mp4"] },
        }),
        pair: async () => {},
        ...overrides,
    };
    const react = {
        useState(initial) {
            const index = cursor++;
            if (!(index in slots))
                slots[index] =
                    typeof initial === "function" ? initial() : initial;
            return [
                slots[index],
                (value) => {
                    slots[index] =
                        typeof value === "function"
                            ? value(slots[index])
                            : value;
                },
            ];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { current: initial };
            return slots[index];
        },
        useEffect(effect, deps) {
            const index = cursor++;
            const previous = slots[index];
            if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
                effects.push(() => {
                    previous?.cleanup?.();
                    slots[index] = { deps, cleanup: effect() };
                });
            }
        },
    };
    const modules = {
        react,
        "react-native": {
            AppState: {
                currentState: "active",
                addEventListener: (_, listener) => {
                    appStateListener = listener;
                    return { remove() {} };
                },
            },
            Linking: { openURL: async (url) => opened.push(url) },
        },
        "@react-navigation/native": { useIsFocused: () => focused },
        axios: { isAxiosError: () => false },
        "../../../services/camera": { cameraApi: api },
        "../../../store/useDeviceStore": {
            useDeviceStore: {
                getState: () => ({ fetchDevicesFromBackend: async () => {} }),
            },
        },
        "../../../i18n/LocalizedComponents": {
            LocalizedAlert: { alert: (...args) => alerts.push(args) },
        },
    };
    const exports = {};
    vm.runInNewContext(source, {
        exports,
        Error,
        require: (name) => {
            assert.ok(name in modules, name);
            return modules[name];
        },
        setTimeout: (callback) => {
            timers.add(callback);
            return callback;
        },
        clearTimeout: (timer) => timers.delete(timer),
    });
    /**
     * Chạy lại hook và các effect đã thay đổi để đọc state mới.
     * @returns Giá trị hiện tại của hook.
     */
    const render = () => {
        cursor = 0;
        const value = exports.useCameraConnection(cameraId, quality);
        effects.splice(0).forEach((effect) => effect());
        return value;
    };
    return {
        render,
        setQuality(value) {
            quality = value;
            return render();
        },
        alerts,
        opened,
        timers,
        async settle() {
            for (let i = 0; i < 20; i++) await Promise.resolve();
            return render();
        },
        blur() {
            focused = false;
            return render();
        },
        background() {
            appStateListener("background");
            return render();
        },
    };
}

test("quality change replaces ticket and keeps selected camera on control requests", async () => {
    const requests = [],
        moves = [];
    const h = createHarness(
        {
            media: async (...args) => {
                requests.push(args);
                return `https://camera.test/${args[2]}`;
            },
            move: async (...args) => {
                moves.push(args);
            },
        },
        "camera-1",
        "720p",
    );
    h.render();
    let connection = await h.settle();
    assert.equal(connection.liveUrl, "https://camera.test/720p");
    assert.equal(await connection.move("LEFT"), true);
    assert.deepEqual(moves, [[-10, 0, "camera-1"]]);
    h.setQuality("1080p");
    connection = await h.settle();
    assert.equal(connection.liveUrl, "https://camera.test/1080p");
    assert.deepEqual(requests, [
        ["live.mjpg", "camera-1", "720p"],
        ["live.mjpg", "camera-1", "1080p"],
    ]);
});

test("recordings failure preserves live video and reports a library error", async () => {
    const h = createHarness({
        recordings: async () => {
            throw new Error("library unavailable");
        },
    });
    h.render();
    const connection = await h.settle();
    assert.equal(connection.liveUrl, "https://camera.test/live.mjpg");
    assert.equal(connection.error, "");
    assert.equal(connection.recordings.error, "library unavailable");
});

test("successful recording is preserved when library refresh fails", async () => {
    let reads = 0;
    let recorded = false;
    const h = createHarness({
        record: async () => {
            recorded = true;
        },
        recordings: async () => {
            if (++reads > 1) throw new Error("refresh failed");
            return { data: { active: null, error: null, files: [] } };
        },
    });
    h.render();
    const connection = await h.settle();
    assert.equal(await connection.record(), true);
    assert.equal(recorded, true);
    assert.equal((await h.settle()).recordings.error, "refresh failed");
});

test("wrong camera ID cannot stream or send control commands", async () => {
    const h = createHarness({}, "other-camera");
    h.render();
    const connection = await h.settle();
    assert.equal(connection.liveUrl, "");
    assert.ok(connection.error.includes("Camera"));
    let called = false;
    assert.equal(
        await connection.run(async () => {
            called = true;
        }, true),
        false,
    );
    assert.equal(called, false);
});

test("viewer access cannot issue a control operation", async () => {
    const h = createHarness({
        status: async () => ({
            data: { id: "camera-1", connected: true, can_control: false },
        }),
    });
    h.render();
    const connection = await h.settle();
    let called = false;
    assert.equal(
        await connection.run(async () => {
            called = true;
        }, true),
        false,
    );
    assert.equal(called, false);
    assert.equal(connection.liveUrl, "https://camera.test/live.mjpg");
});

test("privacy request does not send a command after leaving the screen", async () => {
    let resolvePrivacy;
    let reads = 0;
    let writes = 0;
    const h = createHarness({
        privacy: () =>
            ++reads === 1
                ? Promise.resolve({ data: { result: { enabled: "off" } } })
                : new Promise((resolve) => {
                      resolvePrivacy = resolve;
                  }),
        setPrivacy: async () => {
            writes++;
        },
    });
    h.render();
    const connection = await h.settle();
    const toggling = connection.togglePrivacy();
    h.blur();
    resolvePrivacy({ data: { result: { enabled: "off" } } });
    assert.equal(await toggling, false);
    assert.equal(writes, 0);
});

test("pairing accepts a code before status is available and rejects empty input", async () => {
    let received;
    const h = createHarness(
        {
            setup: async () => ({ data: { paired: false } }),
            pair: async (code) => {
                received = code;
            },
        },
        "camera-1",
    );
    h.render();
    const connection = await h.settle();
    assert.equal(connection.needsPairing, true);
    assert.equal(await connection.pair("  "), false);
    assert.equal(await connection.pair(" code "), true);
    assert.equal(received, "code");
});

test("leaving the screen ignores an in-flight response and stops polling", async () => {
    let resolveStatus;
    const h = createHarness({
        status: () =>
            new Promise((resolve) => {
                resolveStatus = resolve;
            }),
    });
    h.render();
    await h.settle();
    h.blur();
    resolveStatus({ data: { id: "camera-1", connected: true } });
    const connection = await h.settle();
    assert.equal(connection.liveUrl, "");
    assert.equal(connection.status, null);
    assert.equal(h.timers.size, 0);
});

test("backgrounding clears the stream and prevents a pending media ticket from opening", async () => {
    let resolveTicket;
    let mediaCalls = 0;
    const h = createHarness({
        media: () =>
            ++mediaCalls === 1
                ? Promise.resolve("live-url")
                : new Promise((resolve) => {
                      resolveTicket = resolve;
                  }),
    });
    h.render();
    const connection = await h.settle();
    const opening = connection.open("snapshot.jpg");
    h.background();
    resolveTicket("snapshot-url");
    assert.equal(await opening, false);
    assert.equal(h.opened.length, 0);
    assert.equal((await h.settle()).liveUrl, "");
});
