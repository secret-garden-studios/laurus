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
  signups: number;
  bounced_sessions: number;
  bounce_rate: number;
  avg_session_seconds: number;
  views_per_session: number;
  signup_rate: number;
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
  signups: number;
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
  visitor_to_signup_rate: number;
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

export interface MetricsDependencies {
  overview: AnalyticsOverview_V1_0 | undefined;
  retention: AnalyticsRetention_V1_0 | undefined;
  breakdowns: AnalyticsBreakdowns_V1_0 | undefined;
  users: AnalyticsUsersReport_V1_0 | undefined;
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

export async function getMetrics(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  days: number,
): Promise<MetricsDependencies> {
  const [overview, retention, breakdowns, users] = await Promise.all([
    getOverview(baseUrl, accessToken, days),
    getRetention(baseUrl, accessToken, RETENTION_WEEKS),
    getBreakdowns(baseUrl, accessToken, days, BREAKDOWN_LIMIT),
    getUsersReport(baseUrl, accessToken, days, BREAKDOWN_LIMIT),
  ]);
  return { overview, retention, breakdowns, users };
}
