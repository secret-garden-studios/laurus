import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lightSourceChain,
  resolveTargetsAt,
  writeLightSourceKeyframe,
  type KeyframeIO,
  type LightSourceTargets,
} from "./keyframe-writer.ts";
import type {
  LaurusEffect,
  LaurusLightSourceEquation,
  LaurusLightSourceResult,
  LaurusLoopType,
  LaurusMixState,
} from "./workspace.server.ts";

const INPUT = "mask-1:1";
const NO_LOOP = "none" as LaurusLoopType;
const NO_MIX = "none" as LaurusMixState;

function targets(intensity: number): LightSourceTargets {
  return {
    light_intensity: intensity,
    light_spread: 0,
    light_shadow: 0,
    object_elevation: 0,
    object_falloff: 2,
    object_fill_r: 0,
    object_fill_g: 0,
    object_fill_b: 0,
    object_fill_a: 0,
    object_fill_h: 0,
    object_fill_s: 0,
  };
}

function equation(intensity: number, time: number): LaurusLightSourceEquation {
  return {
    ...targets(intensity),
    input_id: INPUT,
    time,
    loop: NO_LOOP,
    solution: [],
    limit_factor: 0.1,
  };
}

function unit(key: string, start: number, end: number, order: number, eq: LaurusLightSourceEquation): LaurusEffect {
  const value: LaurusLightSourceResult = {
    timestamp: "now",
    last_active: "now",
    light_source_id: key,
    start,
    end,
    project_id: "proj-1",
    effect_group_id: "group-1",
    order,
    locked: false,
    disabled: false,
    description: "",
    mix: false,
    math: new Map([[INPUT, eq]]),
    creator: "t",
    last_editor: "t",
    mixState: NO_MIX,
  };
  return { type: "light_source", key, value };
}

function harness() {
  const updates: LaurusLightSourceResult[] = [];
  const creates: LaurusLightSourceResult[] = [];
  let nextId = 0;
  const io: KeyframeIO = {
    create: async (_origin, _token, source) => {
      nextId += 1;
      creates.push({ ...source, light_source_id: `new-${nextId}` } as unknown as LaurusLightSourceResult);
      return {
        ...source,
        timestamp: "now",
        last_active: "now",
        light_source_id: `new-${nextId}`,
        creator: "t",
        last_editor: "t",
        math: new Map(source.math),
      } as unknown as LaurusLightSourceResult;
    },
    update: async (_origin, _token, _id, source) => {
      updates.push(source as LaurusLightSourceResult);
      return true;
    },
  };
  return { io, updates, creates };
}

async function run(
  effects: LaurusEffect[],
  timeSeconds: number,
  patch: Partial<LightSourceTargets>,
  options: { timelineEnd?: number; mode?: "hold" | "ramp" } = {},
) {
  const h = harness();
  const result = await writeLightSourceKeyframe({
    apiOrigin: "http://x",
    accessToken: "t",
    projectId: "proj-1",
    effectGroupId: "group-1",
    inputId: INPUT,
    timeSeconds,
    resting: targets(0.25),
    patch,
    defaultLimitFactor: 0.1,
    timelineEnd: options.timelineEnd ?? 10,
    mode: options.mode ?? ("hold" as const),
    effects,
    io: h.io,
  });
  return { ...h, outcome: result.outcome, units: result.units };
}

describe("writeLightSourceKeyframe", () => {
  it("defers to the resting state at the timeline origin", async () => {
    const r = await run([], 0, { light_intensity: 0.8 });

    assert.equal(r.outcome, "resting");
    assert.equal(r.creates.length, 0);
    assert.equal(r.updates.length, 0);
  });

  it("spans a held keyframe from the playhead to the end of the animation", async () => {
    const r = await run([], 5, { light_intensity: 0.8 }, { timelineEnd: 12 });

    assert.equal(r.outcome, "written");
    assert.equal(r.creates.length, 1);
    assert.equal(r.creates[0].start, 5);
    assert.equal(r.creates[0].end, 12);
    assert.equal(r.creates[0].math.get(INPUT)!.time, 0);
    assert.equal(r.creates[0].math.get(INPUT)!.light_intensity, 0.8);
  });

  it("collapses onto the playhead when no other unit extends the timeline", async () => {
    const r = await run([], 5, { light_intensity: 0.8 }, { timelineEnd: 0 });

    assert.equal(r.creates[0].start, 5);
    assert.equal(r.creates[0].end, 5);
  });

  it("spans an into-keyframe from the timeline origin to the playhead", async () => {
    const r = await run([], 5, { light_intensity: 0.8 }, { timelineEnd: 10, mode: "ramp" });

    assert.equal(r.creates[0].start, 0);
    assert.equal(r.creates[0].end, 5);
    assert.equal(r.creates[0].math.get(INPUT)!.time, 5000);
  });

  it("leaves every unedited parameter at the state already in force", async () => {
    const r = await run([], 5, { object_fill_a: 0.5 });
    const written = r.creates[0].math.get(INPUT)!;

    assert.equal(written.object_fill_a, 0.5);
    assert.equal(written.light_intensity, 0.25);
    assert.equal(written.object_falloff, 2);
  });

  it("retargets in place when a keyframe already starts on the playhead", async () => {
    const effects = [unit("a", 5, 10, 0, equation(0.5, 800))];
    const r = await run(effects, 5, { light_intensity: 0.9 });

    assert.equal(r.creates.length, 0);
    assert.equal(r.updates.length, 1);
    assert.equal(r.updates[0].math.get(INPUT)!.light_intensity, 0.9);
    assert.equal(r.updates[0].math.get(INPUT)!.time, 800);
  });

  it("carries the created unit's math into the returned units", async () => {
    const r = await run([], 5, { object_fill_a: 0.5 });

    const created = r.units.find((u) => u.start === 5)!;
    assert.equal(created.math.size, 1);
    assert.equal(created.math.get(INPUT)!.object_fill_a, 0.5);
  });

  it("keeps order ascending with start after inserting an earlier keyframe", async () => {
    const effects = [unit("a", 8, 10, 5, equation(0.5, 1000))];
    const r = await run(effects, 3, { light_intensity: 0.9 });

    const inserted = r.units.find((u) => u.start === 3)!;
    const existing = r.units.find((u) => u.light_source_id === "a")!;
    assert.ok(inserted.order < existing.order);
  });
});

describe("lightSourceChain", () => {
  it("selects only light_source units carrying math for the input", () => {
    const effects = [unit("a", 0, 2, 0, equation(0.5, 2000))];

    assert.deepEqual(lightSourceChain(effects, INPUT), [{ key: "a", start: 0, end: 2 }]);
    assert.deepEqual(lightSourceChain(effects, "other"), []);
  });
});

describe("resolveTargetsAt", () => {
  const resting = targets(0.25);

  it("falls back to the resting state when the chain is empty", () => {
    assert.equal(resolveTargetsAt([], INPUT, 3, resting).light_intensity, 0.25);
  });

  it("inherits the keyframe in force at the playhead", () => {
    const effects = [unit("a", 0, 10, 0, equation(0.9, 1000)), unit("b", 6, 10, 1, equation(0.4, 1000))];

    assert.equal(resolveTargetsAt(effects, INPUT, 3, resting).light_intensity, 0.9);
    assert.equal(resolveTargetsAt(effects, INPUT, 8, resting).light_intensity, 0.4);
  });

  it("falls back to the resting state before the first keyframe starts", () => {
    const effects = [unit("a", 6, 10, 0, equation(0.9, 1000))];

    assert.equal(resolveTargetsAt(effects, INPUT, 3, resting).light_intensity, 0.25);
  });
});
