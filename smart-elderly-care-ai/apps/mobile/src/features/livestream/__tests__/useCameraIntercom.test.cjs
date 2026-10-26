/**
 * Kiểm thử điều phối Talk/Call, quyền truyền mic và đóng audio theo vòng đời màn hình.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(
    readFileSync(join(__dirname, "../hooks/useCameraIntercom.ts"), "utf8"),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
        },
    },
).outputText;

/**
 * Giả lập React và session audio để kiểm thử hook intercom.
 * @param control - Quyền quản lý camera của người dùng giả.
 * @returns Bộ render, kết nối giả và các session đã tạo.
 */
function harness(control = true) {
    const slots = [];
    const effects = [];
    const sessions = [];
    let cursor = 0;
    /**
     * So sánh dependencies để giả lập useEffect/useCallback.
     * @param a - Danh sách dependency trước đó.
     * @param b - Danh sách dependency mới.
     * @returns true nếu các dependency không thay đổi.
     */
    const equalDeps = (a, b) => a && b.every((value, i) => value === a[i]);
    const react = {
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = initial;
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
        useCallback(callback, deps) {
            const index = cursor++;
            if (!equalDeps(slots[index]?.deps, deps))
                slots[index] = { callback, deps };
            return slots[index].callback;
        },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!equalDeps(slots[index]?.deps, deps))
                effects.push(() => {
                    slots[index]?.cleanup?.();
                    slots[index] = { deps, cleanup: effect() };
                });
        },
    };
    class Session {
        constructor(options) {
            this.options = options;
            this.closed = false;
            sessions.push(this);
        }
        start() {
            this.options.onState("connecting");
            return Promise.resolve();
        }
        close() {
            this.closed = true;
        }
        setMicEnabled(enabled) {
            this.mic = enabled;
        }
        setSpeakerEnabled(enabled) {
            this.speaker = enabled;
        }
    }
    const modules = {
        react,
        axios: { isAxiosError: () => false },
        "../../../services/camera": { cameraApi: {} },
        "../services/intercomPlatform": { createIntercomPlatform: () => ({}) },
        "../services/intercomSession": { IntercomSession: Session },
    };
    const exports = {};
    vm.runInNewContext(source, {
        exports,
        Error,
        require: (name) => {
            assert.ok(name in modules, name);
            return modules[name];
        },
    });
    const connection = {
        active: true,
        privacy: false,
        status: {
            id: "camera-1",
            device_id: "TAPO_1",
            connected: true,
            can_control: control,
        },
    };
    /**
     * Chạy lại hook intercom và thực thi các effect được lên lịch.
     * @returns Trạng thái và callback hiện tại của hook.
     */
    const render = () => {
        cursor = 0;
        const value = exports.useCameraIntercom(connection, "camera-1");
        effects.splice(0).forEach((effect) => effect());
        return value;
    };
    render();
    return { render, connection, sessions };
}

test("PTT release cancels connecting session and ignores late connected callback", () => {
    const h = harness();
    h.render().startTalk();
    const session = h.sessions[0];
    h.render().endTalk();
    session.options.onState("connected");
    assert.equal(session.closed, true);
    assert.equal(h.render().state, "idle");
    assert.equal(h.render().micEnabled, false);
});

test("backgrounding and privacy changes stop active audio", () => {
    for (const change of [
        (c) => {
            c.active = false;
        },
        (c) => {
            c.privacy = true;
        },
    ]) {
        const h = harness();
        h.render().toggleCall();
        h.sessions[0].options.onState("connected");
        change(h.connection);
        h.render();
        assert.equal(h.sessions[0].closed, true);
        assert.equal(h.render().mode, null);
        assert.equal(h.render().speakerEnabled, false);
    }
});

test("viewer can listen but cannot create a microphone session", () => {
    const h = harness(false);
    h.render().toggleCall();
    assert.equal(h.sessions.length, 0);
    assert.equal(h.render().state, "error");
    h.render().toggleSpeaker();
    assert.equal(h.sessions[0].options.mode, "listen");
    assert.equal(h.sessions[0].mic, false);
    h.render().toggleSpeaker();
    assert.equal(h.sessions[0].closed, true);
});

test("revoking manage permission closes the transmitting session", () => {
    const h = harness();
    h.render().toggleCall();
    h.connection.status.can_control = false;
    h.render();
    assert.equal(h.sessions[0].closed, true);
    assert.equal(h.render().micEnabled, false);
});

test("mic and speaker toggles affect the live call independently", () => {
    const h = harness();
    h.render().toggleCall();
    h.render().toggleMic();
    assert.equal(h.sessions[0].mic, false);
    assert.equal(h.sessions[0].speaker, true);
    h.render().toggleSpeaker();
    assert.equal(h.sessions[0].speaker, false);
    h.render().toggleCall();
    assert.equal(h.sessions[0].closed, true);
});
