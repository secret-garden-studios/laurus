"use client";
import { useEffect, useState } from "react";
import { msUntilRenewal, rememberAccessToken, renewAccessToken } from "../auth-session";

export function useAccessToken(apiOrigin: string | undefined, renderedToken: string | undefined): string | undefined {
  const [token, setToken] = useState<string | undefined>(renderedToken);

  useEffect(() => {
    rememberAccessToken(renderedToken);
    setToken(renderedToken);
  }, [renderedToken]);

  useEffect(() => {
    if (!apiOrigin || !token) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const renewed = await renewAccessToken(apiOrigin);
      if (!cancelled && renewed) setToken(renewed);
    }, msUntilRenewal(token));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [apiOrigin, token]);

  return token;
}
