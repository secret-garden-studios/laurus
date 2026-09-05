"use client";
import { useEffect, useState } from "react";
import {
  currentAccessToken,
  isSessionEnded,
  msUntilRenewal,
  rememberAccessToken,
  renewAccessToken,
} from "../auth-session";

const MAX_SLEEP_MS = 60_000;
const RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

export function useAccessToken(apiOrigin: string | undefined, renderedToken: string | undefined): string | undefined {
  const [token, setToken] = useState<string | undefined>(renderedToken);

  useEffect(() => {
    rememberAccessToken(renderedToken);
    setToken(renderedToken);
  }, [renderedToken]);

  useEffect(() => {
    if (!apiOrigin || !renderedToken) return;
    let cancelled = false;
    let running = false;
    let retryMs = RETRY_MS;
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), Math.max(ms, 0));
    };

    const tick = async () => {
      if (cancelled || running || isSessionEnded()) return;
      running = true;
      try {
        const held = currentAccessToken();
        if (held) {
          const due = msUntilRenewal(held);
          if (due > 0) {
            schedule(Math.min(due, MAX_SLEEP_MS));
            return;
          }
        }
        const renewed = await renewAccessToken(apiOrigin);
        if (cancelled) return;
        if (!renewed) {
          if (isSessionEnded()) return;
          schedule(retryMs);
          retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
          return;
        }
        retryMs = RETRY_MS;
        setToken(renewed);
        schedule(Math.min(msUntilRenewal(renewed), MAX_SLEEP_MS));
      } finally {
        running = false;
      }
    };

    const wake = () => {
      if (!document.hidden) void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [apiOrigin, renderedToken]);

  return token;
}
