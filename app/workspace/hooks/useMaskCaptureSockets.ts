import { useCallback, useEffect, useRef } from "react";
import { LaurusMaskResult, MaskCaptureSocketMessage_V1_0, toMaskCaptureSocketUrl } from "../workspace.server";

/**
 * Owns one persistent websocket per mask for capture create/move/delete,
 * opened lazily the first time sendCaptureUpdate is called for a given
 * mask_media_id and kept open afterwards -- unlike the one-shot mask-
 * creation socket in useMaskPreview, a mask's captures are edited
 * repeatedly over the life of an editing session, so there's no single
 * "complete" message that closes it. Each socket answers requests in the
 * order they were sent (guaranteed by both WebSocket's own delivery order
 * and the server's receive-process-send loop, which fully answers one
 * request before reading the next), so a simple FIFO queue of resolvers is
 * enough to pair replies back up without needing per-message ids.
 */
export function useMaskCaptureSockets(apiOrigin: string | undefined, accessToken: string | undefined) {
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
        socket = new WebSocket(toMaskCaptureSocketUrl(apiOrigin, maskMediaId, accessToken));
      } catch (error) {
        console.log({ error });
        return undefined;
      }
      const resolveNext = (result: LaurusMaskResult | undefined) => {
        queuesRef.current.get(maskMediaId)?.shift()?.(result);
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        let message: MaskCaptureSocketMessage_V1_0;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          console.log({ error });
          resolveNext(undefined);
          return;
        }
        if (message.type === "capture_update_complete") {
          resolveNext(message.result);
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

  const sendCaptureUpdate = useCallback(
    (
      maskMediaId: string,
      captureId: number,
      name: string,
      polygonIndices: number[],
    ): Promise<LaurusMaskResult | undefined> => {
      const socket = getSocket(maskMediaId);
      if (!socket) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        queuesRef.current.get(maskMediaId)?.push(resolve);
        const send = () =>
          socket.send(JSON.stringify({ capture_id: captureId, name, polygon_indices: polygonIndices }));
        if (socket.readyState === WebSocket.OPEN) {
          send();
        } else {
          socket.addEventListener("open", send, { once: true });
        }
      });
    },
    [getSocket],
  );

  return { sendCaptureUpdate, closeSocket };
}

export type UseMaskCaptureSockets = ReturnType<typeof useMaskCaptureSockets>;
