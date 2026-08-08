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

// A mask's own project key isn't a fine-grained enough `math` input_id on its own: a mask can
// carry several captures (see project-mask-item.tsx/CarouselEntry), each wireable to its own move/
// light_source equation, and "move"/"light_source" are the only two effect types masks support
// (scale/rotate act on a whole element's transform, which a mask's captures don't have -- see
// move-unit.tsx/light-source-unit.tsx's carouselEntryKey, the only other place this format is
// built). Server-side, input_id is an opaque dict key everywhere except one seed lookup in
// input_math.py's solve_input, which strips this same ":"-suffix back off before treating it as a
// literal mask key -- keep that in sync if this format ever changes.
export function maskCaptureInputId(maskKey: string, captureId: number): string {
  return `${maskKey}:${captureId}`;
}

// Inverse of maskCaptureInputId -- recovers the mask's own element key (what maskHandlesRef is
// keyed by, see project-mask-item.tsx's mount ref-callback) and the specific capture a caller
// meant, from an input_id built by the function above. captureId comes back undefined for an
// img/svg's own bare key (no ":" at all) or a mask input_id predating per-capture math.
export function parseMaskCaptureInputId(inputId: string): { maskKey: string; captureId: number | undefined } {
  const separatorIndex = inputId.indexOf(":");
  if (separatorIndex === -1) return { maskKey: inputId, captureId: undefined };
  const captureId = Number(inputId.slice(separatorIndex + 1));
  return {
    maskKey: inputId.slice(0, separatorIndex),
    captureId: Number.isFinite(captureId) ? captureId : undefined,
  };
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
