"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PAGE_VIEW, track } from "./analytics.client";

interface AnalyticsTracker {
  apiOrigin: string | undefined;
}
export default function AnalyticsTracker({ apiOrigin }: AnalyticsTracker) {
  const pathname = usePathname();
  const lastTracked = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!apiOrigin || !pathname) return;
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    void track(apiOrigin, PAGE_VIEW, pathname);
  }, [apiOrigin, pathname]);

  return null;
}
