import { currentAccessToken } from "../auth-session";

const VISITOR_KEY = "laurus_visitor_id";
const SESSION_KEY = "laurus_session_id";

export const PAGE_VIEW = "page_view";
export const FULL_ACCESS_CLICK = "full_access_click";
export const ACCOUNT_REQUEST = "account_request";
export const ACCOUNT_ACTIVATED = "account_activated";
export const CONTACT_CLICK = "contact_click";
export const CONTACT_MESSAGE = "contact_message";

export interface AnalyticsEvent_V1_0 {
  event_id: string;
  visitor_id: string | null;
  session_id: string | null;
  event_name: string;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  occurred_at: string;
}
export interface AnalyticsCollectResult_V1_0 {
  visitor_id: string;
  session_id: string;
  accepted: boolean;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function currentVisitorId(): string | null {
  return readStored(VISITOR_KEY);
}

function visitorId(): string | null {
  const held = readStored(VISITOR_KEY);
  if (held) return held;
  const minted = newId();
  writeStored(VISITOR_KEY, minted);
  return readStored(VISITOR_KEY);
}

export function trackedEvent(eventName: string, path: string): AnalyticsEvent_V1_0 {
  const params = new URLSearchParams(window.location.search);
  return {
    event_id: newId(),
    visitor_id: visitorId(),
    session_id: readStored(SESSION_KEY),
    event_name: eventName,
    path,
    referrer: document.referrer || null,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    occurred_at: new Date().toISOString(),
  };
}

export async function track(baseUrl: string | undefined, eventName: string, path: string): Promise<void> {
  if (!baseUrl || typeof window === "undefined") return;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = currentAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}/analytics/collect`, {
      method: "POST",
      headers,
      body: JSON.stringify(trackedEvent(eventName, path)),
      keepalive: true,
    });
    if (!response.ok) return;
    const result: AnalyticsCollectResult_V1_0 = await response.json();
    if (result.visitor_id) writeStored(VISITOR_KEY, result.visitor_id);
    if (result.session_id) writeStored(SESSION_KEY, result.session_id);
  } catch {
    return;
  }
}
