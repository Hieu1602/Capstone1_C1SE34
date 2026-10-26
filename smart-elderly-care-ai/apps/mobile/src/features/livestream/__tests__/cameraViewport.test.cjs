/** Kiểm thử khung ngang dự phòng, ảnh đúng tỉ lệ và giới hạn kéo khi zoom. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const exportsValue = {};
vm.runInNewContext(
    ts.transpileModule(
        readFileSync(join(__dirname, "../services/cameraViewport.ts"), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
            },
        },
    ).outputText,
    { exports: exportsValue },
);
const { cameraViewport, clampCameraPan } = exportsValue;

test("landscape video stays centered at 16:9 with space for the action rail", () => {
    const frame = cameraViewport(1663, 768, true);
    assert.equal(frame.rotated, false);
    assert.equal(frame.videoHeight, 768);
    assert.ok(Math.abs(frame.videoWidth / frame.videoHeight - 16 / 9) < 0.0001);
    assert.ok((frame.width - frame.videoWidth) / 2 >= frame.railWidth + 28);
});

test("portrait browser fallback paints the same landscape bounds after rotation", () => {
    const frame = cameraViewport(390, 844, true);
    assert.equal(frame.rotated, true);
    assert.equal(frame.width, 844);
    assert.equal(frame.height, 390);
    assert.equal(frame.left + frame.width / 2, 195);
    assert.equal(frame.top + frame.height / 2, 422);
    assert.ok(frame.videoWidth <= frame.width - 2 * (frame.railWidth + 28));
    assert.ok(frame.videoHeight <= frame.height);
});

test("collapsing actions expands a constrained video without stretching", () => {
    const expanded = cameraViewport(640, 390, true);
    const collapsed = cameraViewport(640, 390, false);
    assert.ok(collapsed.videoWidth > expanded.videoWidth);
    assert.equal(collapsed.videoWidth / collapsed.videoHeight, 16 / 9);
});

test("zoom panning never reveals blank space beyond the enlarged frame", () => {
    assert.equal(clampCameraPan(500, 400, 2), 200);
    assert.equal(clampCameraPan(-500, 400, 2), -200);
    assert.equal(clampCameraPan(50, 400, 1), 0);
});
