import { useMemo } from "react";
import {
  LightUpdateDelta_V1_0,
  MaskLightSocketMessage_V1_0,
  MaskLightUpdateRequest_V1_0,
  normalizeLight,
  toMaskLightSocketUrl,
} from "../workspace.server";
import { MaskUpdateSocketConfig, useMaskUpdateSockets } from "./useMaskUpdateSockets";

const config: MaskUpdateSocketConfig<MaskLightSocketMessage_V1_0, LightUpdateDelta_V1_0> = {
  toUrl: toMaskLightSocketUrl,
  readDelta: (message) => {
    if (message.type !== "light_update_complete") {
      console.log({ error: message.message });
      return undefined;
    }
    return {
      ...message.delta,
      light: message.delta.light ? normalizeLight(message.delta.light) : null,
    };
  },
};

export function useMaskLightSockets(apiOrigin: string | undefined, accessToken: string | undefined) {
  const { sendUpdate, closeSocket } = useMaskUpdateSockets<
    MaskLightUpdateRequest_V1_0,
    MaskLightSocketMessage_V1_0,
    LightUpdateDelta_V1_0
  >(apiOrigin, accessToken, config);
  return useMemo(() => ({ sendLightUpdate: sendUpdate, closeSocket }), [sendUpdate, closeSocket]);
}

export type UseMaskLightSockets = ReturnType<typeof useMaskLightSockets>;
