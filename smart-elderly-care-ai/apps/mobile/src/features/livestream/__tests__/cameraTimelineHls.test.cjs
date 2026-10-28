const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function compile(file, modules, timerApi = {}) {
    const exports = {};
    const code = ts.transpileModule(
        readFileSync(join(__dirname, file), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                jsx: ts.JsxEmit.React,
                esModuleInterop: true,
                target: ts.ScriptTarget.ES2020,
            },
        },
    ).outputText;
    vm.runInNewContext(code, {
        exports,
        require: (name) => {
            assert.ok(name in modules, name);
            return modules[name];
        },
        setTimeout: timerApi.setTimeout ?? (() => 1),
        clearTimeout: timerApi.clearTimeout ?? (() => {}),
        requestAnimationFrame: (fn) => fn(),
    });
    return exports;
}

function harness() {
    const slots = [],
        effects = [],
        calls = [],
        timers = new Map();
    let cursor = 0,
        timerId = 0;
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    const items = Array.from({ length: 20 }, (_, index) => ({
        id: String(index),
        duration: 2,
        started_at: new Date(start.getTime() + index * 2000).toISOString(),
    }));
    const react = {
        ...React,
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
            return (slots[index] ??= { current: initial });
        },
        useEffect(fn, deps) {
            const index = cursor++;
            const previous = slots[index];
            if (!previous || deps.some((dep, i) => dep !== previous.deps[i]))
                effects.push(() => {
                    previous?.cleanup?.();
                    slots[index] = { deps, cleanup: fn() };
                });
        },
    };
    const Component = compile(
        "../components/CameraTimeline.tsx",
        {
            react,
            "react-native": {
                View: "view",
                ScrollView: "scroll",
                TouchableOpacity: "button",
                ActivityIndicator: "spinner",
                StyleSheet: { create: (value) => value },
            },
            "@expo/vector-icons": { Ionicons: "icon" },
            "../../../i18n/LocalizedComponents": { LocalizedText: "text" },
            "../../../store/useThemeStore": {
                useTheme: () => ({ colors: {} }),
            },
            "../../../services/camera": {
                cameraApi: {
                    coverage: async () => ({
                        data: {
                            items: [
                                {
                                    start: start.toISOString(),
                                    end: new Date(
                                        start.getTime() + 40_000,
                                    ).toISOString(),
                                },
                            ],
                        },
                    }),
                    hls: async (...args) => {
                        calls.push(args);
                        return {
                            items,
                            url: "https://test/manifest.m3u8",
                            expires_at: Date.now() / 1000 + 3600,
                        };
                    },
                },
            },
            "../services/archiveTimeline": compile(
                "../services/archiveTimeline.ts",
                {},
            ),
            "../services/archivePlayback": compile(
                "../services/archivePlayback.ts",
                {},
            ),
            "./ArchivePlayer": { __esModule: true, default: "player" },
            "../services/downloadVideo": { __esModule: true, default() {} },
        },
        {
            setTimeout: (fn, delay = 0) => {
                const id = ++timerId;
                timers.set(id, { fn, delay });
                return id;
            },
            clearTimeout: (id) => timers.delete(id),
        },
    ).default;
    function render() {
        cursor = 0;
        const tree = Component({ cameraId: "camera-1" });
        while (effects.length) effects.shift()();
        return tree;
    }
    return {
        render,
        calls,
        fireTimer(delay) {
            const entry = [...timers.entries()].find(
                ([, timer]) => timer.delay === delay,
            );
            assert.ok(entry, `No ${delay}ms timer is pending`);
            timers.delete(entry[0]);
            entry[1].fn();
        },
        async settle() {
            await new Promise((resolve) => setImmediate(resolve));
            return render();
        },
    };
}

function find(node, typeOrLabel) {
    if (!node || typeof node !== "object") return;
    if (
        node.type === typeOrLabel ||
        node.props?.accessibilityLabel === typeOrLabel ||
        node.props?.testID === typeOrLabel
    )
        return node;
    for (const child of React.Children.toArray(node.props?.children)) {
        const found = find(child, typeOrLabel);
        if (found) return found;
    }
}

function findAll(node, testID) {
    if (!node || typeof node !== "object") return [];
    const matches = node.props?.testID === testID ? [node] : [];
    for (const child of React.Children.toArray(node.props?.children)) {
        matches.push(...findAll(child, testID));
    }
    return matches;
}

test("HLS progress crosses segments and backward seek keeps one player and playlist", async () => {
    const h = harness();
    h.render();
    let tree = await h.settle();
    let player = find(tree, "player");
    assert.ok(player.props.hls);
    const originalKey = player.key;
    assert.equal(h.calls.length, 1);
    player.props.onProgress(25);
    tree = h.render();
    find(tree, "Lùi 10 giây").props.onPress();
    tree = await h.settle();
    player = find(tree, "player");
    assert.equal(player.props.startAt, 15);
    assert.equal(player.props.uri, "https://test/manifest.m3u8");
    assert.equal(player.key, originalKey);
    assert.equal(h.calls.length, 1);
    player.props.onProgress(17);
    tree = h.render();
    assert.equal(h.calls.length, 1);
    assert.ok(find(tree, "player"));
});

test("dragging pauses playback so progress does not fight the timeline", async () => {
    const h = harness();
    h.render();
    let tree = await h.settle();
    find(tree, "scroll").props.onScrollBeginDrag();
    tree = h.render();
    assert.equal(find(tree, "player").props.paused, true);
    find(tree, "player").props.onProgress(30);
    tree = h.render();
    assert.equal(find(tree, "player").props.startAt, 10);
});

test("drag release seeks the player when no momentum event follows", async () => {
    const h = harness();
    h.render();
    let tree = await h.settle();
    const seconds = 8 * 3600 + 20;
    const offset = (2400 * seconds) / (24 * 3600);
    const scroll = find(tree, "scroll");
    scroll.props.onScrollBeginDrag();
    scroll.props.onScrollEndDrag({
        nativeEvent: { contentOffset: { x: offset } },
    });
    h.fireTimer(150);
    tree = await h.settle();
    assert.equal(find(tree, "player").props.startAt, 20);
    assert.equal(h.calls.length, 1);
});

test("momentum completion seeks to the final timeline offset", async () => {
    const h = harness();
    h.render();
    let tree = await h.settle();
    const scroll = find(tree, "scroll");
    const offsetAt = (seconds) => (2400 * seconds) / (24 * 3600);
    scroll.props.onScrollBeginDrag();
    scroll.props.onScrollEndDrag({
        nativeEvent: { contentOffset: { x: offsetAt(8 * 3600 + 20) } },
    });
    scroll.props.onMomentumScrollBegin();
    scroll.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: offsetAt(8 * 3600 + 36) } },
    });
    tree = await h.settle();
    assert.equal(find(tree, "player").props.startAt, 36);
    assert.equal(h.calls.length, 1);
});

test("zooming expands the timeline around the current playback position", async () => {
    const h = harness();
    h.render();
    let tree = await h.settle();
    const widthOf = (node) =>
        node.props.style.find((style) => typeof style?.width === "number")
            .width;
    const player = find(tree, "player");
    const uri = player.props.uri;
    const startAt = player.props.startAt;
    assert.equal(widthOf(find(tree, "camera-timeline-content")), 2400);

    find(tree, "Phóng to thanh tua").props.onPress();
    tree = h.render();

    assert.equal(widthOf(find(tree, "camera-timeline-content")), 3600);
    assert.equal(find(tree, "player").props.uri, uri);
    assert.equal(find(tree, "player").props.startAt, startAt);
    assert.equal(h.calls.length, 1);
});

test("zooming adds minute-specific timeline labels", async () => {
    const h = harness();
    h.render();
    let tree = await h.settle();
    const labels = () =>
        findAll(tree, "timeline-tick-label").map((node) => node.props.children);
    assert.ok(labels().includes("08:00"));
    assert.ok(!labels().includes("08:30"));

    find(tree, "Phóng to thanh tua").props.onPress();
    tree = h.render();
    assert.ok(labels().includes("08:30"));

    for (let level = 0; level < 3; level++) {
        find(tree, "Phóng to thanh tua").props.onPress();
        tree = h.render();
    }
    assert.ok(labels().includes("05"));
});
