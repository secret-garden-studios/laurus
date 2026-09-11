import { authFetch, FORBIDDEN_NAV, UNAUTHORIZED_EDIT } from "../landing.server";

const onNotOk = (status: number) => {
  if (typeof window === "undefined") return;
  switch (status) {
    case 401: {
      alert(UNAUTHORIZED_EDIT);
      return;
    }
    case 403: {
      alert(FORBIDDEN_NAV);
      return;
    }
  }
};

export interface AnalyticsRange_V1_0 {
  from: string;
  to: string;
  days: number;
}
export interface AnalyticsTotals_V1_0 {
  unique_visitors: number;
  new_visitors: number;
  returning_visitors: number;
  sessions: number;
  page_views: number;
  claimed: number;
  approved: number;
  activated: number;
  full_access_clicks: number;
  account_requests: number;
  bounced_sessions: number;
  bounce_rate: number;
  avg_session_seconds: number;
  views_per_session: number;
  approval_rate: number;
  activation_rate: number;
  full_access_rate: number;
  request_conversion_rate: number;
}
export interface AnalyticsActive_V1_0 {
  dau: number;
  wau: number;
  mau: number;
}
export interface AnalyticsSeriesPoint_V1_0 {
  day: string;
  unique_visitors: number;
  new_visitors: number;
  returning_visitors: number;
  sessions: number;
  page_views: number;
  claimed: number;
  approved: number;
  activated: number;
  full_access_clicks: number;
  account_requests: number;
}
export interface AnalyticsOverview_V1_0 {
  range: AnalyticsRange_V1_0;
  totals: AnalyticsTotals_V1_0;
  previous: AnalyticsTotals_V1_0;
  active: AnalyticsActive_V1_0;
  series: AnalyticsSeriesPoint_V1_0[];
}
export interface AnalyticsCohort_V1_0 {
  cohort_week: string;
  size: number;
  weeks: number[];
}
export interface AnalyticsRetention_V1_0 {
  weeks: number;
  cohorts: AnalyticsCohort_V1_0[];
}
export interface AnalyticsPage_V1_0 {
  path: string;
  page_views: number;
  visitors: number;
}
export interface AnalyticsReferrer_V1_0 {
  referrer: string;
  sessions: number;
  visitors: number;
}
export interface AnalyticsCampaign_V1_0 {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  visitors: number;
}
export interface AnalyticsFacet_V1_0 {
  name: string;
  sessions: number;
  visitors: number;
}
export interface AnalyticsBreakdowns_V1_0 {
  pages: AnalyticsPage_V1_0[];
  referrers: AnalyticsReferrer_V1_0[];
  campaigns: AnalyticsCampaign_V1_0[];
  browsers: AnalyticsFacet_V1_0[];
  operating_systems: AnalyticsFacet_V1_0[];
  devices: AnalyticsFacet_V1_0[];
}
export interface AnalyticsUserTotals_V1_0 {
  total_users: number;
  new_users: number;
  identified_visitors: number;
  unique_visitors: number;
  pending_approval: number;
  pending_activation: number;
  activated_users: number;
}
export interface AnalyticsActiveUser_V1_0 {
  username: string;
  email: string;
  role: string;
  sessions: number;
  page_views: number;
  last_seen_at: string | null;
}
export interface AnalyticsSignup_V1_0 {
  username: string;
  email: string;
  role: string;
  created_at: string | null;
}
export interface AnalyticsUsersReport_V1_0 {
  totals: AnalyticsUserTotals_V1_0;
  active_users: AnalyticsActiveUser_V1_0[];
  recent_signups: AnalyticsSignup_V1_0[];
}

export const REQUESTED = "requested";
export const AWAITING_PASSWORD = "awaiting_password";
export const READ_ONLY = "read_only";
export const ACTIVE = "active";

export const ROLE_READ = "read";
export const ROLE_READ_WRITE = "read_write";
export const ROLE_ADMIN = "admin";
export const ROLE_OPTIONS = [ROLE_READ, ROLE_READ_WRITE, ROLE_ADMIN] as const;

export const ROLE_LABELS: Record<string, string> = {
  [ROLE_READ]: "read only",
  [ROLE_READ_WRITE]: "full access",
  [ROLE_ADMIN]: "admin",
};

export interface ManagedAccount_V1_0 {
  username: string;
  email: string;
  role: string;
  requested_at: string | null;
  approved_at: string | null;
  activated: boolean;
  state: string;
}
export interface ManagedAccounts_V1_0 {
  accounts: ManagedAccount_V1_0[];
}
export interface SetAccountRoleResult_V1_0 {
  success: boolean;
  message: string;
  username: string;
  role: string;
  email: string | null;
  email_sent: boolean;
}
export interface ApproveAccountResult_V1_0 {
  success: boolean;
  message: string;
  username: string;
  email: string | null;
  email_sent: boolean;
}
export interface EmailCheckResult_V1_0 {
  success: boolean;
  transport: string;
  sent_to: string | null;
  message: string;
}

export interface MetricsDependencies {
  overview: AnalyticsOverview_V1_0 | undefined;
  retention: AnalyticsRetention_V1_0 | undefined;
  breakdowns: AnalyticsBreakdowns_V1_0 | undefined;
  users: AnalyticsUsersReport_V1_0 | undefined;
  accounts: ManagedAccounts_V1_0 | undefined;
}

export const RANGE_OPTIONS = [7, 30, 90] as const;
export const DEFAULT_RANGE_DAYS = 30;
export const RETENTION_WEEKS = 8;
export const BREAKDOWN_LIMIT = 8;

async function getJson<T>(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  url: string,
): Promise<T | undefined> {
  try {
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "GET");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "GET");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return undefined;
    }
    const result: T = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function getOverview(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  days: number,
): Promise<AnalyticsOverview_V1_0 | undefined> {
  return getJson<AnalyticsOverview_V1_0>(baseUrl, accessToken, `${baseUrl}/analytics/overview?days=${days}`);
}

export async function getRetention(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  weeks: number,
): Promise<AnalyticsRetention_V1_0 | undefined> {
  return getJson<AnalyticsRetention_V1_0>(baseUrl, accessToken, `${baseUrl}/analytics/retention?weeks=${weeks}`);
}

export async function getBreakdowns(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  days: number,
  limit: number,
): Promise<AnalyticsBreakdowns_V1_0 | undefined> {
  return getJson<AnalyticsBreakdowns_V1_0>(
    baseUrl,
    accessToken,
    `${baseUrl}/analytics/breakdowns?days=${days}&limit=${limit}`,
  );
}

export async function getUsersReport(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  days: number,
  limit: number,
): Promise<AnalyticsUsersReport_V1_0 | undefined> {
  return getJson<AnalyticsUsersReport_V1_0>(
    baseUrl,
    accessToken,
    `${baseUrl}/analytics/users?days=${days}&limit=${limit}`,
  );
}

export async function getAccounts(
  baseUrl: string | undefined,
  accessToken: string | undefined,
): Promise<ManagedAccounts_V1_0 | undefined> {
  return getJson<ManagedAccounts_V1_0>(baseUrl, accessToken, `${baseUrl}/accounts`);
}

async function postJson<T>(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  url: string,
  body: string | undefined,
): Promise<T | undefined> {
  try {
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return undefined;
    }
    const result: T = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function approveAccount(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  username: string,
): Promise<ApproveAccountResult_V1_0 | undefined> {
  return postJson<ApproveAccountResult_V1_0>(
    baseUrl,
    accessToken,
    `${baseUrl}/accounts/approve`,
    JSON.stringify({ username }),
  );
}

export async function setAccountRole(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  username: string,
  role: string,
): Promise<SetAccountRoleResult_V1_0 | undefined> {
  return postJson<SetAccountRoleResult_V1_0>(
    baseUrl,
    accessToken,
    `${baseUrl}/accounts/role`,
    JSON.stringify({ username, role }),
  );
}

export async function checkEmailDelivery(
  baseUrl: string | undefined,
  accessToken: string | undefined,
): Promise<EmailCheckResult_V1_0 | undefined> {
  return postJson<EmailCheckResult_V1_0>(baseUrl, accessToken, `${baseUrl}/accounts/email-check`, undefined);
}

export async function getMetrics(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  days: number,
): Promise<MetricsDependencies> {
  const [overview, retention, breakdowns, users, accounts] = await Promise.all([
    getOverview(baseUrl, accessToken, days),
    getRetention(baseUrl, accessToken, RETENTION_WEEKS),
    getBreakdowns(baseUrl, accessToken, days, BREAKDOWN_LIMIT),
    getUsersReport(baseUrl, accessToken, days, BREAKDOWN_LIMIT),
    getAccounts(baseUrl, accessToken),
  ]);
  return { overview, retention, breakdowns, users, accounts };
}
