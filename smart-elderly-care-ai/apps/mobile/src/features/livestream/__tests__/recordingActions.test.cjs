const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function load(file, modules, globals = {}) {
    const exports = {};
    const source = ts.transpileModule(readFileSync(join(__dirname, file), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, { exports, ...globals, require: name => {
        assert.ok(name in modules, `Unexpected import: ${name}`);
        return modules[name];
    } });
    return exports.default;
}

function harness(media) {
    const slots = [], effects = [], downloads = [], alerts = [];
    let cursor = 0;
    const react = {
        ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
            return [slots[index], value => { slots[index] = value; }];
        },
        useRef(initial) {
            const index = cursor++;
            return slots[index] ??= { current: initial };
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
        "react-native": { Linking: {}, Modal: "modal", ScrollView: "scroll", TouchableOpacity: "button", View: "view" },
        "react-native-safe-area-context": { SafeAreaView: "safe" },
        "@expo/vector-icons": { Ionicons: "icon" },
        "../../../i18n/LocalizedComponents": { LocalizedText: "text", LocalizedAlert: { alert: (...args) => alerts.push(args) } },
        "../../../store/useThemeStore": { useTheme: () => ({ colors: {} }) },
        "../../../store/useAuthStore": { useAuthStore: () => ({ userRole: "admin" }) },
        "../../../store/useAlertStore": { useAlertStore: selector => selector({ incidents: [] }) },
        "../../../services/emergency": {},
        "../../../services/camera": { cameraApi: { media } },
        "../hooks/useCameraConnection": { useCameraConnection: () => ({ recordings: { files: ["clip.mp4"] } }) },
        "../hooks/useCameraIntercom": { useCameraIntercom: () => ({ stop() {} }) },
        "../services/downloadVideo": { __esModule: true, default: async url => downloads.push(url) },
        "./cameraDetailStyles": { cameraDetailStyles: {} },
    };
    for (const name of ["CameraViewer", "CameraTimeline", "ArchivePlayer", "CameraDetailHeader", "CameraSettings", "QuickActionBar", "FunctionGrid", "CameraControlPanel", "CameraControlIcon"])
        modules[`../components/${name}`] = { __esModule: true, default: name };
    const Screen = load("../screens/CameraDetailScreen.tsx", modules);
    const props = { navigation: { goBack() {} }, route: { params: { cameraId: "camera-1", tab: "playback" } } };
    function render() {
        cursor = 0;
        const tree = Screen(props);
        while (effects.length) effects.shift()();
        return tree;
    }
    return { render, downloads, alerts };
}

function find(tree, predicate) {
    if (!tree || typeof tree !== "object") return;
    if (predicate(tree)) return tree;
    for (const child of React.Children.toArray(tree.props?.children)) {
        const found = find(child, predicate);
        if (found) return found;
    }
}

test("recordings play inside the sheet and download through a separate action", async () => {
    const calls = [];
    const h = harness(async (...args) => { calls.push(args); return "https://camera.test/clip"; });
    const tree = h.render();
    assert.equal(find(tree, node => node.type === "modal").props.visible, true);
    assert.equal(find(tree, node => node.type === "modal").props.transparent, false);
    assert.ok(find(tree, node => node.type === "CameraTimeline"));
    assert.equal(find(tree, node => node.props?.accessibilityLabel === "Phát clip.mp4"), undefined);
    find(tree, node => node.props?.accessibilityLabel === "Download").props.onPress();
    const downloads = h.render();
    assert.equal(find(downloads, node => node.type === "CameraTimeline"), undefined);
    assert.equal(find(downloads, node => node.props?.accessibilityLabel === "Download").props.accessibilityState.selected, true);
    find(downloads, node => node.props?.accessibilityLabel === "Phát clip.mp4").props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(find(h.render(), node => node.type === "ArchivePlayer").props.uri, "https://camera.test/clip");
    assert.equal(h.downloads.length, 0);
    find(h.render(), node => node.props?.accessibilityLabel === "Tải xuống clip.mp4").props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.downloads, ["https://camera.test/clip"]);
    assert.deepEqual(calls, [["recordings/clip.mp4", "camera-1"], ["recordings/clip.mp4", "camera-1"]]);
});

test("closing the sheet discards a pending download", async () => {
    let resolve;
    const h = harness(() => new Promise(done => { resolve = done; }));
    find(h.render(), node => node.props?.accessibilityLabel === "Download").props.onPress();
    const tree = h.render();
    find(tree, node => node.props?.accessibilityLabel === "Tải xuống clip.mp4").props.onPress();
    find(tree, node => node.props?.accessibilityLabel === "Đóng").props.onPress();
    h.render();
    resolve("https://camera.test/late");
    await new Promise(done => setImmediate(done));
    assert.equal(h.downloads.length, 0);
});

test("web downloads use an attachment link without opening a popup", async () => {
    let clicked = false, removed = false;
    const link = { click() { clicked = true; }, remove() { removed = true; } };
    const download = load("../services/downloadVideo.web.ts", {}, {
        document: { createElement: () => link, body: { appendChild() {} } },
    });
    await download("https://camera.test/attachment");
    assert.equal(link.href, "https://camera.test/attachment");
    assert.equal(link.download, "");
    assert.ok(clicked && removed);
});
