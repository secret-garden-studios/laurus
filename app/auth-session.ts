export interface Token_V1_0 {
  access_token: string;
  token_type: string;
}
export interface LaurusToken extends Token_V1_0 {
  success: boolean;
  message: string;
}

const inBrowser = typeof window !== "undefined";

let browserAccessToken: string | undefined = undefined;
let refreshInFlight: Promise<string | undefined> | undefined = undefined;
let sessionEnded = false;

const EXPIRY_SKEW_SECONDS = 30;
const RENEW_LEAD_SECONDS = 90;

function tokenExpirySeconds(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const exp: unknown = JSON.parse(atob(padded)).exp;
    return typeof exp === "number" ? exp : undefined;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

function isSpent(token: string | undefined): boolean {
  if (!token) return true;
  const expiry = tokenExpirySeconds(token);
  if (expiry === undefined) return false;
  return expiry - EXPIRY_SKEW_SECONDS <= Date.now() / 1000;
}

export function msUntilRenewal(token: string): number {
  const expiry = tokenExpirySeconds(token);
  if (expiry === undefined) return 60_000;
  return Math.max((expiry - RENEW_LEAD_SECONDS) * 1000 - Date.now(), 1_000);
}

export function currentAccessToken(): string | undefined {
  return inBrowser ? browserAccessToken : undefined;
}

export function isSessionEnded(): boolean {
  return sessionEnded;
}

export function rememberAccessToken(token: string | undefined): void {
  if (!inBrowser) return;
  if (!token) {
    browserAccessToken = undefined;
    return;
  }

  const heldExpiry = browserAccessToken ? tokenExpirySeconds(browserAccessToken) : undefined;
  const incomingExpiry = tokenExpirySeconds(token);
  if (heldExpiry !== undefined && incomingExpiry !== undefined && incomingExpiry < heldExpiry) return;
  browserAccessToken = token;
  sessionEnded = false;
}

export function forgetAccessToken(): void {
  if (!inBrowser) return;
  browserAccessToken = undefined;
  refreshInFlight = undefined;
  sessionEnded = false;
}

interface RefreshOutcome {
  token: string | undefined;
  ended: boolean;
}

async function postRefresh(baseUrl: string | undefined): Promise<RefreshOutcome> {
  try {
    const raw_response = await fetch(`${baseUrl}/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!raw_response.ok) {
      return { token: undefined, ended: raw_response.status === 401 || raw_response.status === 403 };
    }
    const response: Token_V1_0 = await raw_response.json();
    return { token: response.access_token, ended: false };
  } catch (error) {
    console.log({ error });
    return { token: undefined, ended: false };
  }
}

export function renewAccessToken(baseUrl: string | undefined): Promise<string | undefined> {
  if (!inBrowser) return Promise.resolve(undefined);
  if (!refreshInFlight) {
    refreshInFlight = postRefresh(baseUrl)
      .then(({ token, ended }) => {
        if (token) {
          browserAccessToken = token;
          sessionEnded = false;
        } else if (ended) {
          browserAccessToken = undefined;
          sessionEnded = true;
        }
        return token;
      })
      .finally(() => {
        refreshInFlight = undefined;
      });
  }
  return refreshInFlight;
}

export async function freshAccessToken(
  baseUrl: string | undefined,
  fallback: string | undefined,
): Promise<string | undefined> {
  if (!inBrowser) return fallback;
  const held = browserAccessToken ?? fallback;
  if (!isSpent(held)) {
    browserAccessToken = held;
    return held;
  }
  return (await renewAccessToken(baseUrl)) ?? held;
}

export async function renewRefusedAccessToken(
  baseUrl: string | undefined,
  refused: string | undefined,
): Promise<string | undefined> {
  if (!inBrowser) return undefined;
  if (browserAccessToken && browserAccessToken !== refused && !isSpent(browserAccessToken)) {
    return browserAccessToken;
  }
  return renewAccessToken(baseUrl);
}

export async function exchangeRefreshCookie(
  baseUrl: string | undefined,
  refreshToken: string,
): Promise<string | undefined> {
  try {
    const raw_response = await fetch(`${baseUrl}/token`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshToken}` },
      cache: "no-store",
    });
    if (!raw_response.ok) return undefined;
    const response: Token_V1_0 = await raw_response.json();
    return response.access_token;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
