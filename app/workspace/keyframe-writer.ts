import type {
  LaurusEffect,
  LaurusLightSource,
  LaurusLightSourceEquation,
  LaurusLightSourceResult,
  LaurusLoopType,
  LaurusMixState,
  createLightSource,
  updateLightSource,
} from "./workspace.server.ts";
import {
  keyframeChain,
  planKeyframe,
  reindexByStart,
  type KeyframeChainEntry,
  type KeyframeMode,
} from "./keyframes.ts";

const NO_LOOP = "none" as LaurusLoopType;
const NO_MIX = "none" as LaurusMixState;

export type LightSourceTargets = Pick<
  LaurusLightSourceEquation,
  | "light_intensity"
  | "light_spread"
  | "light_shadow"
  | "object_elevation"
  | "object_falloff"
  | "object_fill_r"
  | "object_fill_g"
  | "object_fill_b"
  | "object_fill_a"
  | "object_fill_h"
  | "object_fill_s"
>;

export interface KeyframeIO {
  create: typeof createLightSource;
  update: typeof updateLightSource;
}

export interface KeyframeWriteRequest {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  projectId: string;
  effectGroupId: string;
  inputId: string;
  timeSeconds: number;
  resting: LightSourceTargets;
  patch: Partial<LightSourceTargets>;
  timelineEnd: number;
  mode: KeyframeMode;
  defaultLimitFactor: number;
  effects: LaurusEffect[];
  io: KeyframeIO;
}

export type KeyframeWriteOutcome = "resting" | "written" | "failed";

export interface KeyframeWriteResult {
  outcome: KeyframeWriteOutcome;
  units: LaurusLightSourceResult[];
}

export function lightSourceChain(effects: LaurusEffect[], inputId: string): KeyframeChainEntry[] {
  return effects
    .filter((effect) => effect.type === "light_source" && effect.value.math.has(inputId))
    .map((effect) => ({ key: effect.key, start: effect.value.start, end: effect.value.end }));
}

function lightSourceEffect(effects: LaurusEffect[], key: string) {
  const found = effects.find((effect) => effect.type === "light_source" && effect.key === key);
  return found?.type === "light_source" ? found.value : undefined;
}

function withEquation(
  unit: LaurusLightSourceResult,
  inputId: string,
  equation: LaurusLightSourceEquation,
): LaurusLightSourceResult {
  const math = new Map(unit.math);
  math.set(inputId, equation);
  return { ...unit, math };
}

function nextOrder(effects: LaurusEffect[]): number {
  return Math.max(-1, ...effects.map((effect) => effect.value.order)) + 1;
}

export function equationTargets(equation: LaurusLightSourceEquation): LightSourceTargets {
  return {
    light_intensity: equation.light_intensity,
    light_spread: equation.light_spread,
    light_shadow: equation.light_shadow,
    object_elevation: equation.object_elevation,
    object_falloff: equation.object_falloff,
    object_fill_r: equation.object_fill_r,
    object_fill_g: equation.object_fill_g,
    object_fill_b: equation.object_fill_b,
    object_fill_a: equation.object_fill_a,
    object_fill_h: equation.object_fill_h,
    object_fill_s: equation.object_fill_s,
  };
}

export function resolveTargetsAt(
  effects: LaurusEffect[],
  inputId: string,
  timeSeconds: number,
  resting: LightSourceTargets,
): LightSourceTargets {
  const chain = keyframeChain(lightSourceChain(effects, inputId));
  const owning =
    chain.find((entry) => Math.abs(entry.start - timeSeconds) <= 1e-6) ??
    chain.filter((entry) => entry.start <= timeSeconds + 1e-6).pop();
  const equation = owning ? lightSourceEffect(effects, owning.key)?.math.get(inputId) : undefined;
  return equation ? equationTargets(equation) : resting;
}

export async function writeLightSourceKeyframe(request: KeyframeWriteRequest): Promise<KeyframeWriteResult> {
  const { apiOrigin, accessToken, inputId, timeSeconds, effects } = request;
  const io = request.io;
  const plan = planKeyframe(lightSourceChain(effects, inputId), timeSeconds, request.timelineEnd, request.mode);
  if (plan.kind === "resting") return { outcome: "resting", units: [] };

  const targets: LightSourceTargets = {
    ...resolveTargetsAt(effects, inputId, timeSeconds, request.resting),
    ...request.patch,
  };

  const touched: LaurusLightSourceResult[] = [];
  const created: LaurusLightSourceResult[] = [];

  if (plan.kind === "retarget") {
    const unit = lightSourceEffect(effects, plan.key);
    const existing = unit?.math.get(inputId);
    if (!unit || !existing) return { outcome: "failed", units: [] };
    touched.push(withEquation(unit, inputId, { ...existing, ...targets }));
  } else {
    const template = keyframeChain(lightSourceChain(effects, inputId))
      .map((entry) => lightSourceEffect(effects, entry.key)?.math.get(inputId))
      .filter((equation) => equation !== undefined)
      .pop();
    const unit: LaurusLightSource = {
      start: plan.start,
      end: plan.end,
      project_id: request.projectId,
      effect_group_id: request.effectGroupId,
      order: nextOrder(effects),
      locked: false,
      disabled: false,
      description: "",
      mix: false,
      math: new Map([
        [
          inputId,
          {
            ...targets,
            input_id: inputId,
            time: plan.time,
            loop: template?.loop ?? NO_LOOP,
            limit_factor: template?.limit_factor ?? request.defaultLimitFactor,
            solution: [],
          },
        ],
      ]),
    };
    const savedUnit = await io.create(apiOrigin, accessToken, unit);
    if (!savedUnit) return { outcome: "failed", units: [] };
    const appended: LaurusLightSourceResult = {
      ...savedUnit,
      math: new Map(savedUnit.math),
      mixState: NO_MIX,
    };
    created.push(appended);
    touched.push(appended);
  }

  const serverState = new Map<string, LaurusLightSourceResult>();
  const desired = new Map<string, LaurusLightSourceResult>();
  for (const effect of effects) {
    if (effect.type !== "light_source") continue;
    serverState.set(effect.key, effect.value);
    desired.set(effect.key, effect.value);
  }
  for (const unit of created) serverState.set(unit.light_source_id, unit);
  for (const unit of touched) desired.set(unit.light_source_id, unit);

  const chainKeys = new Set([
    ...lightSourceChain(effects, inputId).map((entry) => entry.key),
    ...touched.map((unit) => unit.light_source_id),
  ]);
  const chainUnits = [...chainKeys].map((key) => desired.get(key)).filter((unit) => unit !== undefined);

  const written: LaurusLightSourceResult[] = [];
  for (const unit of reindexByStart(chainUnits)) {
    const before = serverState.get(unit.light_source_id);
    const alreadyCurrent =
      before !== undefined &&
      before.order === unit.order &&
      before.start === unit.start &&
      before.end === unit.end &&
      before.math.get(inputId) === unit.math.get(inputId);
    if (!alreadyCurrent) {
      const saved = await io.update(apiOrigin, accessToken, unit.light_source_id, unit);
      if (!saved) return { outcome: "failed", units: [] };
    }
    written.push(unit);
  }

  return { outcome: "written", units: written };
}
