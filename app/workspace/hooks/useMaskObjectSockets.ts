import { useMemo } from "react";
import {
  MaskObjectSocketMessage_V1_0,
  MaskObjectUpdateRequest_V1_0,
  ObjectUpdateDelta_V1_0,
  normalizeObject,
  toMaskObjectSocketUrl,
} from "../workspace.server";
import { MaskUpdateSocketConfig, useMaskUpdateSockets } from "./useMaskUpdateSockets";

const config: MaskUpdateSocketConfig<MaskObjectSocketMessage_V1_0, ObjectUpdateDelta_V1_0> = {
  toUrl: toMaskObjectSocketUrl,
  readDelta: (message) => {
    if (message.type !== "object_update_complete") {
      console.log({ error: message.message });
      return undefined;
    }
    return {
      ...message.delta,
      object: message.delta.object ? normalizeObject(message.delta.object) : null,
    };
  },
};

export function useMaskObjectSockets(apiOrigin: string | undefined, accessToken: string | undefined) {
  const { sendUpdate, closeSocket } = useMaskUpdateSockets<
    MaskObjectUpdateRequest_V1_0,
    MaskObjectSocketMessage_V1_0,
    ObjectUpdateDelta_V1_0
  >(apiOrigin, accessToken, config);
  return useMemo(() => ({ sendObjectUpdate: sendUpdate, closeSocket }), [sendUpdate, closeSocket]);
}

export type UseMaskObjectSockets = ReturnType<typeof useMaskObjectSockets>;
