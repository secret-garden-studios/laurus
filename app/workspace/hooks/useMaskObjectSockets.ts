import { useCallback, useEffect, useRef } from "react";
import {
  MaskObjectSocketMessage_V1_0,
  MaskObjectUpdateRequest_V1_0,
  ObjectUpdateDelta_V1_0,
  normalizeObject,
  toMaskObjectSocketUrl,
} from "../workspace.server";

export function useMaskObjectSockets(apiOrigin: string | undefined, accessToken: string | undefined) {
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const queuesRef = useRef<Map<string, Array<(delta: ObjectUpdateDelta_V1_0 | undefined) => void>>>(new Map());

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
        socket = new WebSocket(toMaskObjectSocketUrl(apiOrigin, maskMediaId, accessToken));
      } catch (error) {
        console.log({ error });
        return undefined;
      }
      const resolveNext = (delta: ObjectUpdateDelta_V1_0 | undefined) => {
        queuesRef.current.get(maskMediaId)?.shift()?.(delta);
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        let message: MaskObjectSocketMessage_V1_0;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          console.log({ error });
          resolveNext(undefined);
          return;
        }
        if (message.type === "object_update_complete") {
          resolveNext({
            ...message.delta,
            object: message.delta.object ? normalizeObject(message.delta.object) : null,
          });
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

  const sendObjectUpdate = useCallback(
    (maskMediaId: string, update: MaskObjectUpdateRequest_V1_0): Promise<ObjectUpdateDelta_V1_0 | undefined> => {
      const socket = getSocket(maskMediaId);
      if (!socket) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        queuesRef.current.get(maskMediaId)?.push(resolve);
        const send = () => socket.send(JSON.stringify(update));
        if (socket.readyState === WebSocket.OPEN) {
          send();
        } else {
          socket.addEventListener("open", send, { once: true });
        }
      });
    },
    [getSocket],
  );

  return { sendObjectUpdate, closeSocket };
}

export type UseMaskObjectSockets = ReturnType<typeof useMaskObjectSockets>;
