const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

const source = ts.transpileModule(
    readFileSync(join(__dirname, "../components/ControlActionButton.tsx"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } },
).outputText;

function render(props, isDarkMode = false, focus = { value: false }) {
    const colors = {
        textPrimary: isDarkMode ? "#F8FAFC" : "#0F172A",
        surfaceSubtle: isDarkMode ? "#162032" : "#F1F5F9",
        card: isDarkMode ? "#1E293B" : "#FFFFFF",
        primaryLight: isDarkMode ? "rgba(255, 122, 0, 0.15)" : "#FFF7ED",
    };
    const modules = {
        react: { ...React, useState: () => [focus.value, (value) => { focus.value = value; }] },
        "react-native": { StyleSheet: { create: (styles) => styles }, Pressable: "button", View: "view" },
        "react-i18next": { useTranslation: () => ({ t: (label) => `translated:${label}` }) },
        "../../../i18n/LocalizedComponents": { LocalizedText: "text" },
        "../../../store/useThemeStore": { useTheme: () => ({ colors, isDarkMode }) },
        "./CameraControlIcon": { __esModule: true, default: "icon" },
    };
    const exports = {};
    vm.runInNewContext(source, { exports, require: (name) => {
        assert.ok(name in modules, `Unexpected import: ${name}`);
        return modules[name];
    } });
    return exports.default({ label: "Talk", icon: "mic", onPress() {}, ...props });
}

test("icon-only actions keep their callback, translated name and touch target", () => {
    let presses = 0;
    const button = render({ onPress: () => presses++ });
    assert.equal(button.props.accessibilityRole, "button");
    assert.equal(button.props.accessibilityLabel, "translated:Talk");
    assert.equal(button.props.accessibilityState, undefined);
    const layout = button.props.style({ pressed: false })[0];
    assert.ok(layout.minWidth >= 48);
    assert.ok(layout.minHeight >= 48);
    button.props.onPress();
    assert.equal(presses, 1);
});

test("active controls have a non-color cue and preserve custom recording colors in both themes", () => {
    for (const dark of [false, true]) {
        for (const active of [false, true]) {
            const button = render({ active, activeColor: "#F15B67" }, dark);
            const surface = button.props.children[0];
            assert.equal(button.props.accessibilityState.selected, active);
            assert.equal(surface.props.importantForAccessibility, "no-hide-descendants");
            const [icon, indicator] = surface.props.children;
            assert.equal(surface.props.style[1].borderColor, active ? "#F15B67" : "transparent");
            assert.equal(surface.props.style[1].backgroundColor, active ? (dark ? "#1E293B" : "#FFFFFF") : (dark ? "#162032" : "#F1F5F9"));
            assert.equal(icon.props.color, active ? "#F15B67" : (dark ? "#F8FAFC" : "#0F172A"));
            assert.equal(Boolean(indicator), active);
        }
    }
});

test("grid labels can wrap and default active colors adapt to the theme", () => {
    for (const dark of [false, true]) {
        const button = render({ showLabel: true, active: true }, dark);
        const [surface, label] = button.props.children;
        assert.equal(button.props.style({ pressed: false })[0].width, "33.333%");
        assert.equal(label.props.children, "Talk");
        assert.equal(label.props.numberOfLines, undefined);
        assert.equal(surface.props.children[0].props.color, dark ? "#FFAD66" : "#B54708");
        assert.equal(surface.props.style[1].backgroundColor, dark ? "rgba(255, 122, 0, 0.15)" : "#FFF7ED");
    }
});

test("press and keyboard focus feedback do not trigger camera actions", () => {
    for (const dark of [false, true]) {
        for (const showLabel of [false, true]) {
            let presses = 0;
            const props = { showLabel, onPress: () => presses++ };
            const focus = { value: false };
            let button = render(props, dark, focus);
            assert.equal(button.props.focusable, true);
            assert.equal(button.props.style({ pressed: false })[3], false);
            const pressedStyle = button.props.style({ pressed: true })[3];
            assert.equal(pressedStyle.transform[0].scale, 0.96);
            assert.equal(pressedStyle.backgroundColor, dark ? "#162032" : "#F1F5F9");

            button.props.onFocus();
            button = render(props, dark, focus);
            assert.equal(button.props.style({ pressed: false })[2].borderColor, dark ? "#F8FAFC" : "#0F172A");
            button.props.onBlur();
            button = render(props, dark, focus);
            assert.equal(button.props.style({ pressed: false })[2], false);
            assert.equal(presses, 0);
            button.props.onPress();
            assert.equal(presses, 1);
        }
    }
});
