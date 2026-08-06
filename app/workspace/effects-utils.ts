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

// Lives in its own module (rather than context-menu.tsx, its original home) so
// workspace.client.tsx can import it too without a circular import -- context-menu.tsx already
// imports CoreContext/UIContext from workspace.client.tsx, so the reverse import would cycle.
export async function deleteEffects(
  mediaKey: string,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (!effect.value.math.has(mediaKey)) continue;
    switch (effect.type) {
      case "scale": {
        const newMath = new Map(effect.value.math);
        newMath.delete(mediaKey);
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
        newMath.delete(mediaKey);
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
        newMath.delete(mediaKey);
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
        newMath.delete(mediaKey);
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
