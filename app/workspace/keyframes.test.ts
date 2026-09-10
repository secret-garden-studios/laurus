import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keyframeChain, planKeyframe, reindexByStart, type KeyframeChainEntry } from "./keyframes.ts";

function entry(key: string, start: number, end: number): KeyframeChainEntry {
  return { key, start, end };
}

describe("planKeyframe", () => {
  it("treats the playhead at zero as a resting-state edit", () => {
    assert.deepEqual(planKeyframe([], 0, 10, "hold"), { kind: "resting" });
    assert.deepEqual(planKeyframe([entry("a", 0, 2)], 0, 10, "hold"), { kind: "resting" });
  });

  it("spans the new keyframe from the playhead to the end of the animation", () => {
    assert.deepEqual(planKeyframe([], 5, 12, "hold"), { kind: "append", start: 5, end: 12, time: 0 });
  });

  it("collapses the unit onto the playhead when nothing else extends the timeline", () => {
    assert.deepEqual(planKeyframe([], 5, 0, "hold"), { kind: "append", start: 5, end: 5, time: 0 });
  });

  it("never ends the unit before the playhead", () => {
    assert.deepEqual(planKeyframe([], 5, 3, "hold"), { kind: "append", start: 5, end: 5, time: 0 });
  });

  it("retargets in place when a keyframe already starts on the playhead", () => {
    const chain = [entry("a", 0, 10), entry("b", 5, 10)];

    assert.deepEqual(planKeyframe(chain, 5, 10, "hold"), { kind: "retarget", key: "b" });
  });

  it("appends a second keyframe later in the chain", () => {
    assert.deepEqual(planKeyframe([entry("a", 5, 10)], 8, 10, "hold"), {
      kind: "append",
      start: 8,
      end: 10,
      time: 0,
    });
  });

  it("ramps an into-keyframe across the whole span so it arrives at the playhead", () => {
    assert.deepEqual(planKeyframe([], 5, 10, "ramp"), { kind: "append", start: 0, end: 5, time: 5000 });
  });

  it("ignores earlier keyframes when spanning an into-keyframe", () => {
    assert.deepEqual(planKeyframe([entry("a", 2, 10)], 5, 10, "ramp"), {
      kind: "append",
      start: 0,
      end: 5,
      time: 5000,
    });
  });

  it("tolerates float drift when matching an existing keyframe", () => {
    assert.deepEqual(planKeyframe([entry("a", 5, 10)], 5 + 1e-9, 10, "hold"), { kind: "retarget", key: "a" });
  });
});

describe("keyframeChain", () => {
  it("sorts by start without mutating the input", () => {
    const chain = [entry("b", 2, 5), entry("a", 0, 2)];
    const sorted = keyframeChain(chain);

    assert.deepEqual(
      sorted.map((e) => e.key),
      ["a", "b"],
    );
    assert.equal(chain[0].key, "b");
  });
});

describe("reindexByStart", () => {
  it("reassigns the existing order values in start order", () => {
    const units = [
      { key: "late", start: 5, order: 3 },
      { key: "early", start: 1, order: 7 },
    ];

    assert.deepEqual(reindexByStart(units), [
      { key: "early", start: 1, order: 3 },
      { key: "late", start: 5, order: 7 },
    ]);
  });

  it("leaves an already-ordered chain untouched", () => {
    const units = [
      { key: "a", start: 0, order: 2 },
      { key: "b", start: 3, order: 4 },
    ];

    assert.deepEqual(reindexByStart(units), units);
  });
});
