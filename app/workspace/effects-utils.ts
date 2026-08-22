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

export function maskCaptureInputId(maskKey: string, captureId: number): string {
  return `${maskKey}:${captureId}`;
}

export function maskObjectInputId(maskKey: string, objectId: number): string {
  return `${maskKey}:object:${objectId}`;
}

export function parseMaskObjectInputId(inputId: string): { maskKey: string; objectId: number | undefined } {
  const separatorIndex = inputId.indexOf(":object:");
  if (separatorIndex === -1) return { maskKey: inputId, objectId: undefined };
  const objectId = Number(inputId.slice(separatorIndex + ":object:".length));
  return {
    maskKey: inputId.slice(0, separatorIndex),
    objectId: Number.isFinite(objectId) ? objectId : undefined,
  };
}

export function parseMaskCaptureInputId(inputId: string): { maskKey: string; captureId: number | undefined } {
  const separatorIndex = inputId.indexOf(":");
  if (separatorIndex === -1) return { maskKey: inputId, captureId: undefined };
  const captureId = Number(inputId.slice(separatorIndex + 1));
  return {
    maskKey: inputId.slice(0, separatorIndex),
    captureId: Number.isFinite(captureId) ? captureId : undefined,
  };
}

export function carouselEntryMathKey(entry: CarouselEntry): string {
  switch (entry.type) {
    case "capture":
      return maskCaptureInputId(entry.key, entry.captureId);
    case "object":
      return maskObjectInputId(entry.key, entry.objectId);
    default:
      return entry.key;
  }
}

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

export async function deleteEffects(
  mediaKey: string,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  await deleteMathEntries(matchesMediaKey(mediaKey), apiOrigin, accessToken, effects, dispatch);
}

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

export async function deleteMaskObjectEffects(
  maskKey: string,
  objectId: number,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  const inputId = maskObjectInputId(maskKey, objectId);
  await deleteMathEntries((key) => key === inputId, apiOrigin, accessToken, effects, dispatch);
}
