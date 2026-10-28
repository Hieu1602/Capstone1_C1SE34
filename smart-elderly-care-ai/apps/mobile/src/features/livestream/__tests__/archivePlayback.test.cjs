const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const api = {};
vm.runInNewContext(ts.transpileModule(readFileSync(join(__dirname, "../services/archivePlayback.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: api });
const items = [0, 2, 10].map((seconds, index) => ({ id: String(index), duration: 2, started_at: new Date(1_000_000 + seconds * 1000).toISOString() }));

test("seeking uses the same playlist offsets in both directions", () => {
    assert.equal(api.playbackPosition(items, new Date(1_003_000)).seconds, 3);
    assert.equal(api.playbackPosition(items, new Date(1_001_000)).seconds, 1);
    assert.equal(api.playbackPosition(items, new Date(1_012_000)), undefined);
});
test("gaps advance wall-clock time without adding fake video duration", () => {
    assert.equal(api.playbackPosition(items, new Date(1_008_000)).seconds, 4);
    assert.equal(api.recordingAtProgress(items, 4).time.getTime(), 1_010_000);
    assert.equal(api.recordingAtProgress(items, 6).time.getTime(), 1_012_000);
    assert.equal(api.recordingAtProgress(items, 2).item.id, "1");
});
