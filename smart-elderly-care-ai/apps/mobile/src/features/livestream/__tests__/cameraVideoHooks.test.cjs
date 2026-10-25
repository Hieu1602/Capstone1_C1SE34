/** Kiểm thử kết quả muộn của Video Mode và vòng đời khóa hướng toàn màn hình. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

/** @returns Promise và bộ điều khiển để mô phỏng request chưa hoàn tất. */
function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
/** @returns Chờ các continuation của effect và request giả. */
async function settle() {
    for (let i = 0; i < 30; i++) await Promise.resolve();
}

/** @param name Hook cần chạy. @param modules Adapter giả. @returns Renderer lifecycle, không dùng native runtime. */
function harness(name, modules) {
    const slots = [],
        effects = [],
        timers = new Set();
    let cursor = 0;
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
        useEffect(effect, deps) {
            const index = cursor++,
                previous = slots[index];
            if (
                previous &&
                previous.deps.every((value, i) => Object.is(value, deps[i]))
            )
                return;
            effects.push(() => {
                previous?.cleanup?.();
                slots[index] = { deps, cleanup: effect() };
            });
        },
    };
    const exports = {};
    const source = ts.transpileModule(
        readFileSync(join(__dirname, `../hooks/${name}.ts`), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
            },
        },
    ).outputText;
    vm.runInNewContext(source, {
        exports,
        require: (module) => (module === "react" ? react : modules[module]),
        setTimeout: (callback) => {
            timers.add(callback);
            return callback;
        },
        clearTimeout: (callback) => timers.delete(callback),
    });
    return {
        render(argument) {
            cursor = 0;
            const value = exports[name](argument);
            effects.splice(0).forEach((effect) => effect());
            return value;
        },
        timers,
    };
}

test("fullscreen restores prior orientation after normal exit", async () => {
    const calls = [];
    const h = harness("useCameraFullscreen", {
        "react-native": { Platform: { OS: "android" } },
        "expo-screen-orientation": {
            OrientationLock: { PORTRAIT_UP: 1, LANDSCAPE: 2 },
            getOrientationLockAsync: async () => 3,
            lockAsync: async (value) => {
                calls.push(value);
            },
        },
    });
    h.render(true).open();
    h.render(true);
    await settle();
    h.render(true).close();
    h.render(true);
    await settle();
    assert.deepEqual(calls, [2, 3]);
});

test("exiting before orientation lookup finishes never locks landscape late", async () => {
    const pending = deferred(),
        calls = [];
    const h = harness("useCameraFullscreen", {
        "react-native": { Platform: { OS: "ios" } },
        "expo-screen-orientation": {
            OrientationLock: { PORTRAIT_UP: 1, LANDSCAPE: 2 },
            getOrientationLockAsync: () => pending.promise,
            lockAsync: async (value) => {
                calls.push(value);
            },
        },
    });
    h.render(true).open();
    h.render(true).close();
    h.render(true);
    pending.resolve(3);
    await settle();
    assert.deepEqual(calls, [3]);
});

test("Video Mode ignores an older GET after a confirmed POST", async () => {
    const read = deferred();
    const api = {
        videoMode: () => read.promise,
        setVideoMode: async () => ({ data: { mode: "night" } }),
    };
    const h = harness("useCameraVideoMode", {
        "../../../services/camera": { cameraApi: api },
    });
    const connection = {
        active: true,
        status: { id: "first" },
        run: async (operation) => {
            await operation();
            return true;
        },
    };
    h.render(connection);
    assert.equal(await h.render(connection).change("night"), true);
    read.resolve({ data: { mode: "day" } });
    await settle();
    assert.equal(h.render(connection).mode, "night");
});

test("Video Mode drops previous camera response and stops timer on blur", async () => {
    const first = deferred();
    const h = harness("useCameraVideoMode", {
        "../../../services/camera": {
            cameraApi: {
                videoMode: (id) =>
                    id === "first"
                        ? first.promise
                        : Promise.resolve({ data: { mode: "auto" } }),
            },
        },
    });
    h.render({ active: true, status: { id: "first" } });
    const second = { active: true, status: { id: "second" } };
    h.render(second);
    await settle();
    first.resolve({ data: { mode: "day" } });
    await settle();
    assert.equal(h.render(second).mode, "auto");
    h.render({ ...second, active: false });
    assert.equal(h.timers.size, 0);
});
