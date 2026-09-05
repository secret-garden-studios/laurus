import { useCallback, useEffect, useRef } from "react";
import { freshAccessToken, renewRefusedAccessToken } from "@/app/auth-session";

const WS_POLICY_VIOLATION = 1008;

type UpdateOutcome<TDelta> = { ok: true; delta: TDelta } | { ok: false; unauthorized: boolean };

interface SocketEntry<TDelta> {
  socket: WebSocket;
  token: string;
  queue: Array<(outcome: UpdateOutcome<TDelta>) => void>;
  gone: UpdateOutcome<TDelta> | undefined;
}

interface UpdateAttempt<TDelta> {
  outcome: UpdateOutcome<TDelta>;
  token: string | undefined;
}

export interface MaskUpdateSocketConfig<TMessage, TDelta> {
  toUrl: (baseUrl: string, maskMediaId: string, accessToken: string) => string;
  readDelta: (message: TMessage) => TDelta | undefined;
}

export function useMaskUpdateSockets<TRequest, TMessage, TDelta>(
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  config: MaskUpdateSocketConfig<TMessage, TDelta>,
) {
  const socketsRef = useRef<Map<string, SocketEntry<TDelta>>>(new Map());

  const closeSocket = useCallback((maskMediaId: string) => {
    const entry = socketsRef.current.get(maskMediaId);
    if (!entry) return;
    socketsRef.current.delete(maskMediaId);
    entry.socket.close();
    entry.queue.splice(0).forEach((resolve) => resolve({ ok: false, unauthorized: false }));
  }, []);

  useEffect(() => {
    const sockets = socketsRef.current;
    return () => {
      sockets.forEach((entry) => entry.socket.close());
    };
  }, []);

  const openSocket = useCallback(
    async (maskMediaId: string, refusedToken: string | undefined): Promise<SocketEntry<TDelta> | undefined> => {
      const existing = socketsRef.current.get(maskMediaId);
      if (
        existing &&
        existing.socket.readyState !== WebSocket.CLOSING &&
        existing.socket.readyState !== WebSocket.CLOSED
      ) {
        return existing;
      }
      if (!apiOrigin) return undefined;
      const token = refusedToken
        ? await renewRefusedAccessToken(apiOrigin, refusedToken)
        : await freshAccessToken(apiOrigin, accessToken);
      if (!token || token === refusedToken) return undefined;

      let socket: WebSocket;
      try {
        socket = new WebSocket(config.toUrl(apiOrigin, maskMediaId, token));
      } catch (error) {
        console.log({ error });
        return undefined;
      }
      const entry: SocketEntry<TDelta> = { socket, token, queue: [], gone: undefined };

      socket.onmessage = (event: MessageEvent<string>) => {
        let message: TMessage;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          console.log({ error });
          entry.queue.shift()?.({ ok: false, unauthorized: false });
          return;
        }
        const delta = config.readDelta(message);
        entry.queue.shift()?.(delta === undefined ? { ok: false, unauthorized: false } : { ok: true, delta });
      };
      const onGone = (unauthorized: boolean) => {
        if (socketsRef.current.get(maskMediaId) === entry) socketsRef.current.delete(maskMediaId);
        entry.gone = { ok: false, unauthorized };
        entry.queue.splice(0).forEach((resolve) => resolve({ ok: false, unauthorized }));
      };
      socket.onerror = () => onGone(false);
      socket.onclose = (event: CloseEvent) => onGone(event.code === WS_POLICY_VIOLATION);
      socketsRef.current.set(maskMediaId, entry);
      return entry;
    },
    [apiOrigin, accessToken, config],
  );

  const attempt = useCallback(
    async (
      maskMediaId: string,
      request: TRequest,
      refusedToken: string | undefined,
    ): Promise<UpdateAttempt<TDelta>> => {
      const entry = await openSocket(maskMediaId, refusedToken);
      if (!entry) return { outcome: { ok: false, unauthorized: false }, token: undefined };
      if (entry.gone) return { outcome: entry.gone, token: entry.token };
      const outcome = await new Promise<UpdateOutcome<TDelta>>((resolve) => {
        entry.queue.push(resolve);
        const send = () => entry.socket.send(JSON.stringify(request));
        if (entry.socket.readyState === WebSocket.OPEN) {
          send();
        } else {
          entry.socket.addEventListener("open", send, { once: true });
        }
      });
      return { outcome, token: entry.token };
    },
    [openSocket],
  );

  const sendUpdate = useCallback(
    async (maskMediaId: string, request: TRequest): Promise<TDelta | undefined> => {
      const first = await attempt(maskMediaId, request, undefined);
      if (first.outcome.ok) return first.outcome.delta;
      if (!first.outcome.unauthorized || !first.token) return undefined;
      closeSocket(maskMediaId);
      const second = await attempt(maskMediaId, request, first.token);
      return second.outcome.ok ? second.outcome.delta : undefined;
    },
    [attempt, closeSocket],
  );

  return { sendUpdate, closeSocket };
}
