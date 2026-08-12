import { Dispatch } from "react";
import {
  updateScale,
  updateMove,
  updateRotate,
  updateLightSource,
  LaurusEffect,
  LaurusLightSourceResult,
  LaurusMoveResult,
  LaurusRotateResult,
  LaurusScaleResult,
} from "./workspace.server";
import { CoreAction, CoreActionType } from "./states/core-state";
import { CarouselEntry } from "./states/ui-state";

// A mask's own project key isn't a fine-grained enough `math` input_id for a *capture's* own
// equation: a mask can carry several captures (see project-mask-item.tsx/CarouselEntry), each
// wireable to its own move/light_source/scale equation -- "rotate" is the one effect type
// captures don't support (it acts on a whole element's transform, which a capture doesn't have --
// see move-unit.tsx/scale-unit.tsx/rotate-unit.tsx's carouselEntryKey, the only other place this
// format is built). The mask's own bare key is reserved for a *different* thing: CarouselEntry's
// "mask" variant wires the whole element (move/scale/rotate alike) via workspace.client.tsx's
// maskElementsRef, the same way an img/svg uses its own bare key -- never collides with this
// format since maskCaptureInputId always has a ":" suffix. Server-side, input_id is an opaque
// dict key everywhere except one seed lookup in input_math.py's solve_input, which strips this
// same ":"-suffix back off before treating it as a literal mask key -- keep that in sync if this
// format ever changes.
export function maskCaptureInputId(maskKey: string, captureId: number): string {
  return `${maskKey}:${captureId}`;
}

// The math input_id one of a mask's own topology peaks wires its "light_source" equation under --
// the peak flavor of maskCaptureInputId above, and just as distinct from the mask's own bare key.
// A peak equation ramps the peak's elevation/radius/falloff (see LightSourceEquation_V1_0's own
// peak_* fields) rather than the four light_source_* dials, starting from that peak's own
// persisted shape; the "peak:" infix is what the server keys that seed lookup off
// (light_source_math.py's resolve_light_source_seed), so keep the two in sync. Never collides with
// a capture's own input_id, whose suffix is always numeric.
export function maskPeakInputId(maskKey: string, peakId: number): string {
  return `${maskKey}:peak:${peakId}`;
}

// Inverse of maskPeakInputId -- peakId comes back undefined for anything that isn't peak-flavored
// (an img/svg key, a bare mask key, or a capture's own input_id), so this doubles as the test for
// which flavor an input_id is.
export function parseMaskPeakInputId(inputId: string): { maskKey: string; peakId: number | undefined } {
  const separatorIndex = inputId.indexOf(":peak:");
  if (separatorIndex === -1) return { maskKey: inputId, peakId: undefined };
  const peakId = Number(inputId.slice(separatorIndex + ":peak:".length));
  return {
    maskKey: inputId.slice(0, separatorIndex),
    peakId: Number.isFinite(peakId) ? peakId : undefined,
  };
}

// Inverse of maskCaptureInputId -- recovers the mask's own element key (what maskHandlesRef and
// maskElementsRef are both keyed by, see project-mask-item.tsx's mount ref-callback) and the
// specific capture a caller meant, from an input_id built by the function above. captureId comes
// back undefined for an img/svg's own bare key (no ":" at all), a whole-mask's own bare key
// (CarouselEntry's "mask" variant), a mask input_id predating per-capture math, or a peak's own
// input_id (whose non-numeric "peak:" suffix parses to NaN -- see maskPeakInputId), leaving the
// maskKey correct for every flavor.
export function parseMaskCaptureInputId(inputId: string): { maskKey: string; captureId: number | undefined } {
  const separatorIndex = inputId.indexOf(":");
  if (separatorIndex === -1) return { maskKey: inputId, captureId: undefined };
  const captureId = Number(inputId.slice(separatorIndex + 1));
  return {
    maskKey: inputId.slice(0, separatorIndex),
    captureId: Number.isFinite(captureId) ? captureId : undefined,
  };
}

// The math key a given carousel entry's own equation lives under (see move-unit.tsx's own
// carouselEntryKey, which this mirrors) -- a "capture" entry's math is keyed by
// maskCaptureInputId, not the entry's bare mask key, so callers matching entries against
// LaurusEffect.math.keys() (e.g. effect-unit.tsx's initial carouselIndex pick) need this rather
// than entry.key directly.
export function carouselEntryMathKey(entry: CarouselEntry): string {
  switch (entry.type) {
    case "capture":
      return maskCaptureInputId(entry.key, entry.captureId);
    case "peak":
      return maskPeakInputId(entry.key, entry.peakId);
    default:
      return entry.key;
  }
}

// True for `key` if it's this mediaKey's own bare identity (an img/svg, or a mask with no
// capture-scoped math left over from before captures existed) or one of this mask's own
// capture-scoped identities (see maskCaptureInputId).
function matchesMediaKey(mediaKey: string): (key: string) => boolean {
  const prefix = `${mediaKey}:`;
  return (key) => key === mediaKey || key.startsWith(prefix);
}

async function deleteMathEntries(
  matchesKey: (key: string) => boolean,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    const keysToDelete = Array.from(effect.value.math.keys()).filter(matchesKey);
    if (keysToDelete.length === 0) continue;
    switch (effect.type) {
      case "scale": {
        const newMath = new Map(effect.value.math);
        keysToDelete.forEach((key) => newMath.delete(key));
        const newScale: LaurusScaleResult = { ...effect.value, math: newMath };
        const updated = await updateScale(apiOrigin, accessToken, effect.key, newScale);
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffect,
            value: { type: "scale", key: effect.key, value: { ...newScale } },
          });
        }
        break;
      }
      case "move": {
        const newMath = new Map(effect.value.math);
        keysToDelete.forEach((key) => newMath.delete(key));
        const newMove: LaurusMoveResult = { ...effect.value, math: newMath };
        const updated = await updateMove(apiOrigin, accessToken, effect.key, {
          ...newMove,
        });
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffect,
            value: { type: "move", key: effect.key, value: { ...newMove } },
          });
        }
        break;
      }
      case "rotate": {
        const newMath = new Map(effect.value.math);
        keysToDelete.forEach((key) => newMath.delete(key));
        const newRotate: LaurusRotateResult = {
          ...effect.value,
          math: newMath,
        };
        const updated = await updateRotate(apiOrigin, accessToken, effect.key, {
          ...newRotate,
        });
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffect,
            value: { type: "rotate", key: effect.key, value: { ...newRotate } },
          });
        }
        break;
      }
      case "light_source": {
        const newMath = new Map(effect.value.math);
        keysToDelete.forEach((key) => newMath.delete(key));
        const newLightSource: LaurusLightSourceResult = {
          ...effect.value,
          math: newMath,
        };
        const updated = await updateLightSource(apiOrigin, accessToken, effect.key, {
          ...newLightSource,
        });
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffect,
            value: { type: "light_source", key: effect.key, value: { ...newLightSource } },
          });
        }
        break;
      }
    }
  }
}

// Lives in its own module (rather than context-menu.tsx, its original home) so
// workspace.client.tsx can import it too without a circular import -- context-menu.tsx already
// imports CoreContext/UIContext from workspace.client.tsx, so the reverse import would cycle.
//
// Called on whole-element deletion (img/svg/mask), so it clears every math entry wired to
// mediaKey -- for a mask that includes every one of its own captures' own equations (see
// matchesMediaKey), not just a bare mediaKey entry.
export async function deleteEffects(
  mediaKey: string,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  await deleteMathEntries(matchesMediaKey(mediaKey), apiOrigin, accessToken, effects, dispatch);
}

// Called on a single capture's own deletion (the mask itself survives, along with any of its
// other captures) -- clears only that one capture's move/light_source equations rather than
// every capture's, which deleteEffects(maskKey, ...) would do.
export async function deleteMaskCaptureEffects(
  maskKey: string,
  captureId: number,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  const inputId = maskCaptureInputId(maskKey, captureId);
  await deleteMathEntries((key) => key === inputId, apiOrigin, accessToken, effects, dispatch);
}

// Mirrors deleteMaskCaptureEffects exactly, for one of a mask's own topology peaks -- called when
// a peak is removed (workspace.client.tsx's deleteMaskPeak), so its light_source equation doesn't
// outlive the peak it was ramping. Peak ids are reused (nextPeakId fills the lowest free one), so
// a left-behind equation wouldn't stay orphaned -- it would silently attach itself to the next
// peak drawn.
export async function deleteMaskPeakEffects(
  maskKey: string,
  peakId: number,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  const inputId = maskPeakInputId(maskKey, peakId);
  await deleteMathEntries((key) => key === inputId, apiOrigin, accessToken, effects, dispatch);
}
