import { toEquationObjectFill } from "./workspace.server";
import type { KeyframePreview } from "./canvas-media/project-mask-item";
import type { LightSourceTargets } from "./keyframe-writer";

export function toKeyframePreview(
  subject: "light" | "object",
  id: number,
  resting: LightSourceTargets,
  targets: Partial<LightSourceTargets>,
): KeyframePreview {
  const touchesFill =
    targets.object_fill_r !== undefined ||
    targets.object_fill_g !== undefined ||
    targets.object_fill_b !== undefined ||
    targets.object_fill_a !== undefined;
  return {
    subject,
    id,
    ...(targets.light_intensity !== undefined ? { light_intensity: targets.light_intensity } : {}),
    ...(targets.light_spread !== undefined ? { light_spread: targets.light_spread } : {}),
    ...(targets.light_shadow !== undefined ? { light_shadow: targets.light_shadow } : {}),
    ...(targets.object_elevation !== undefined ? { object_elevation: targets.object_elevation } : {}),
    ...(targets.object_falloff !== undefined ? { object_falloff: targets.object_falloff } : {}),
    ...(touchesFill ? { object_fill: toEquationObjectFill({ ...resting, ...targets }) } : {}),
  };
}
