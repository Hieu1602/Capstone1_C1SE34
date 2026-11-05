const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

test("CameraViewer toolbar auto-hides after 4s and shows on interaction", () => {
    const file = readFileSync(
        join(__dirname, "../components/CameraViewer.tsx"),
        "utf8",
    );

    // Verify 4000ms timer
    assert.match(file, /4000/);

    // Verify translucent toolbar background rgba(0,0,0,0.35)
    assert.match(file, /backgroundColor:\s*"rgba\(0,0,0,0\.35\)"/);

    // Verify touch & pointer event handlers on videoArea
    assert.match(file, /onTouchStart=\{showToolbar\}/);
    assert.match(file, /onPointerDown=\{showToolbar\}/);
    assert.match(file, /onPointerMove=\{showToolbar\}/);
    assert.match(file, /onPointerEnter=\{showToolbar\}/);

    // Verify Animated.View for toolbar opacity
    assert.match(file, /<Animated\.View[\s\S]*opacity:\s*toolbarOpacity/);
});

