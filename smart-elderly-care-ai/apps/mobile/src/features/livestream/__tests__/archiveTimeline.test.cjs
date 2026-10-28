const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const result = {};
vm.runInNewContext(ts.transpileModule(readFileSync(join(__dirname, "../services/archiveTimeline.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: result });

test("local hour becomes a bounded UTC range, invalid dates are rejected", () => {
    const window = result.archiveWindow("2026-10-27", "8");
    assert.equal(new Date(window.end) - new Date(window.start), 3600000);
    for (const [day, hour] of [["2026-02-30", "8"], ["2026-10-27", "24"], ["oops", "0"]])
        assert.throws(() => result.archiveWindow(day, hour));
});
test("automatic playback skips snapshots and incident clips", () => {
    const items = [{ id: "a", kind: "segment" }, { id: "b", kind: "snapshot" },
        { id: "c", kind: "incident" }, { id: "d", kind: "segment" }];
    assert.equal(result.nextSegment(items, "a").id, "d");
    assert.equal(result.nextSegment(items, "d"), undefined);
    assert.equal(result.nextSegment(items, "missing"), undefined);
});
test("24-hour timeline converts between a local day and seconds", () => {
    const day = new Date(2026, 9, 27, 4, 48, 25);
    assert.equal(result.secondsFromLocalMidnight(day), 4 * 3600 + 48 * 60 + 25);
    assert.equal(result.timeAtSeconds(day, 3600).getHours(), 1);
    const window = result.localDayWindow(day);
    assert.equal(new Date(window.end).getDate(), 28);
});
