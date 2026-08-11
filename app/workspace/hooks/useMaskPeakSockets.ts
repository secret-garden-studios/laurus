import { useCallback, useEffect, useRef } from "react";
import {
  LaurusMaskResult,
  MaskPeakSocketMessage_V1_0,
  MaskPeakUpdateRequest_V1_0,
  normalizeMaskResult,
  toMaskPeakSocketUrl,
} from "../workspace.server";

/**
 * Owns one persistent websocket per mask for peak create/move/reshape/delete,
 * opened lazily the first time sendPeakUpdate is called for a given
 * mask_media_id and kept open afterwards -- mirrors useMaskCaptureSockets
 * exactly (see its own doc comment for why a mask's peaks, like its
 * captures, are edited repeatedly over the life of an editing session
 * rather than through a one-shot socket, and why a simple FIFO queue of
 * resolvers is enough to pair replies back up without per-message ids).
 *
 * On that last point specifically, since peaks now get edited far more often
 * than captures do: the FIFO pairing stays sound because every producer awaits
 * its own send before issuing the next one for a given mask (Maskbar coalesces
 * slider edits through a queue that awaits, the drag commit awaits, and the
 * delete helper awaits), so at most one request per mask is ever in flight and
 * there is never an ordering for the queue to get wrong. What deliberately does
 * *not* come through here is the live preview a slider drag paints -- that's a
 * shader uniform update with no server round trip at all (see mask-gl.ts's
 * PEAK_FIELD_GLSL), which is exactly what keeps this socket's traffic down to
 * one message per committed edit.
 */
export function useMaskPeakSockets(apiOrigin: string | undefined, accessToken: string | undefined) {
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const queuesRef = useRef<Map<string, Array<(result: LaurusMaskResult | undefined) => void>>>(new Map());

  const closeSocket = useCallback((maskMediaId: string) => {
    socketsRef.current.get(maskMediaId)?.close();
    socketsRef.current.delete(maskMediaId);
    queuesRef.current.get(maskMediaId)?.forEach((resolve) => resolve(undefined));
    queuesRef.current.delete(maskMediaId);
  }, []);

  useEffect(() => {
    const sockets = socketsRef.current;
    return () => {
      sockets.forEach((socket) => socket.close());
    };
  }, []);

  const getSocket = useCallback(
    (maskMediaId: string): WebSocket | undefined => {
      const existing = socketsRef.current.get(maskMediaId);
      if (existing && existing.readyState !== WebSocket.CLOSING && existing.readyState !== WebSocket.CLOSED) {
        return existing;
      }
      if (!apiOrigin || !accessToken) return undefined;
      let socket: WebSocket;
      try {
        socket = new WebSocket(toMaskPeakSocketUrl(apiOrigin, maskMediaId, accessToken));
      } catch (error) {
        console.log({ error });
        return undefined;
      }
      const resolveNext = (result: LaurusMaskResult | undefined) => {
        queuesRef.current.get(maskMediaId)?.shift()?.(result);
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        let message: MaskPeakSocketMessage_V1_0;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          console.log({ error });
          resolveNext(undefined);
          return;
        }
        if (message.type === "peak_update_complete") {
          resolveNext(normalizeMaskResult(message.result));
        } else {
          console.log({ error: message.message });
          resolveNext(undefined);
        }
      };
      const onGone = () => {
        socketsRef.current.delete(maskMediaId);
        queuesRef.current.get(maskMediaId)?.forEach((resolve) => resolve(undefined));
        queuesRef.current.delete(maskMediaId);
      };
      socket.onerror = onGone;
      socket.onclose = onGone;
      socketsRef.current.set(maskMediaId, socket);
      queuesRef.current.set(maskMediaId, []);
      return socket;
    },
    [apiOrigin, accessToken],
  );

  // Takes the whole request as one object rather than as positional parameters (which the peak's
  // own growth to five geometric fields plus a delete flag had pushed to nine) for a specific
  // reason beyond arity: every field of a peak update is a number, and several of them can
  // legitimately be 0, so a positional call site offered no protection at all against a transposed
  // pair -- and the flavour of that bug is a peak that silently lands somewhere else or takes the
  // wrong shape, with nothing to catch it but the eye. MaskPeakUpdateRequest_V1_0 is already the
  // exact wire shape, so this is also the JSON body's own type rather than a parallel one to keep
  // in sync, and snake_case at the boundary is now the only transformation happening here.
  const sendPeakUpdate = useCallback(
    (maskMediaId: string, update: MaskPeakUpdateRequest_V1_0): Promise<LaurusMaskResult | undefined> => {
      const socket = getSocket(maskMediaId);
      if (!socket) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        queuesRef.current.get(maskMediaId)?.push(resolve);
        const send = () =>
          socket.send(
            JSON.stringify({
              peak_id: update.peak_id,
              cx: update.cx,
              cy: update.cy,
              radius: update.radius,
              elevation: update.elevation,
              falloff: update.falloff,
              remove: update.remove,
              polygon_indices: update.polygon_indices,
            }),
          );
        if (socket.readyState === WebSocket.OPEN) {
          send();
        } else {
          socket.addEventListener("open", send, { once: true });
        }
      });
    },
    [getSocket],
  );

  return { sendPeakUpdate, closeSocket };
}

export type UseMaskPeakSockets = ReturnType<typeof useMaskPeakSockets>;
