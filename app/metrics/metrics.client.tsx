"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira, italiana, ubuntuMono } from "../fonts";
import Navbar from "../navbar";
import ToolbarButton from "../components/toolbar-button";
import { refresh200 } from "../svg-repo";
import { MeDependencies } from "../page";
import { ProjectsResolution } from "../projects/projects-resolution";
import {
  BlockedEmail_V1_0,
  ContactSender_V1_0,
  ManagedAccount_V1_0,
  MetricsDependencies,
  ACTIVE,
  AWAITING_PASSWORD,
  DEFAULT_RANGE_DAYS,
  RANGE_OPTIONS,
  READ_ONLY,
  REQUESTED,
  ROLE_LABELS,
  ROLE_OPTIONS,
  approveAccount,
  blockEmail,
  checkEmailDelivery,
  getAccounts,
  getContactBlocks,
  getMetrics,
  setAccountRole,
  unblockEmail,
} from "./metrics.server";
import {
  DataTable,
  Panel,
  RankedBars,
  RetentionGrid,
  StatTile,
  VIZ,
  VisitorsChart,
  formatCount,
  formatDuration,
  formatPercent,
} from "./metrics-charts";

export interface MetricsContextProps {
  resolution: ProjectsResolution;
}

export const MetricsContext = createContext<MetricsContextProps>({
  resolution: { type: "midhigh", value: { width: 2560, height: 1440 } },
});

interface Metrics {
  apiOrigin: string | undefined;
  me: MeDependencies;
  resolution: ProjectsResolution;
  metrics: MetricsDependencies;
}
export default function Metrics({ apiOrigin, me, resolution, metrics: initialMetrics }: Metrics) {
  const [days, setDays] = useState<number>(DEFAULT_RANGE_DAYS);
  const [metrics, setMetrics] = useState<MetricsDependencies>(initialMetrics);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          body: { padding: 20, gap: 20 },
          loading: { opacity: 0.55, transitionMs: 120 },
          accounts: { gap: 18, statGap: 8, sectionGap: 8 },
        };
      case "midhigh":
        return {
          body: { padding: 16, gap: 16 },
          loading: { opacity: 0.55, transitionMs: 120 },
          accounts: { gap: 14, statGap: 6, sectionGap: 6 },
        };
      case "low":
      case "midlow":
        return {
          body: { padding: 13, gap: 13 },
          loading: { opacity: 0.55, transitionMs: 120 },
          accounts: { gap: 12, statGap: 6, sectionGap: 5 },
        };
    }
  });

  const load = useCallback(
    async (nextDays: number) => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      setLoading(true);
      const next = await getMetrics(apiOrigin, me.accessToken, nextDays);
      if (request !== requestRef.current) return;
      setMetrics(next);
      setDays(nextDays);
      setLoading(false);
    },
    [apiOrigin, me.accessToken],
  );

  const changeRange = useCallback(
    (nextDays: number) => {
      if (loading || nextDays === days) return;
      void load(nextDays);
    },
    [days, loading, load],
  );

  const reload = useCallback(() => {
    if (loading) return;
    void load(days);
  }, [days, loading, load]);

  const refreshAccounts = useCallback(async () => {
    const next = await getAccounts(apiOrigin, me.accessToken);
    if (!next) return;
    setMetrics((held) => ({ ...held, accounts: next }));
  }, [apiOrigin, me.accessToken]);

  const refreshBlocks = useCallback(async () => {
    const next = await getContactBlocks(apiOrigin, me.accessToken);
    if (!next) return;
    setMetrics((held) => ({ ...held, blocks: next }));
  }, [apiOrigin, me.accessToken]);

  const metricsContextValue = useMemo(() => ({ resolution }), [resolution]);
  const { overview, retention, breakdowns, users, accounts, blocks } = metrics;

  return (
    <MetricsContext value={metricsContextValue}>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          gridTemplateRows: "min-content min-content 1fr min-content",
          gridTemplateColumns: "1fr min-content",
          overflow: "hidden",
        }}
      >
        <div style={{ gridRow: "1", gridColumn: "1 / -1", zIndex: 1000 }}>
          <Titlebar overview={overview} />
        </div>
        <div style={{ gridRow: "2", gridColumn: "1", zIndex: 1000 }}>
          <Rangebar days={days} onChange={changeRange} loading={loading} />
        </div>
        <div
          className={styles[resolution.type == "high" ? "noisy-background-20-3" : "noisy-background-20-3-low-res"]}
          style={{ gridRow: "3", gridColumn: "1", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
        >
          <div
            style={{
              padding: dynamicSizes.body.padding,
              display: "grid",
              gap: dynamicSizes.body.gap,
              opacity: loading ? dynamicSizes.loading.opacity : 1,
              transition: `opacity ${dynamicSizes.loading.transitionMs}ms linear`,
            }}
          >
            {overview ? (
              <>
                <Headline overview={overview} />
                <div
                  className={styles["metrics-panels"]}
                  style={{ "--grid-gap": `${dynamicSizes.body.gap}px` } as React.CSSProperties}
                >
                  <Panel
                    title="unique visitors"
                    subtitle={`${overview.range.from} to ${overview.range.to}, UTC days`}
                    style={{ gridArea: "chart" }}
                  >
                    <VisitorsChart series={overview.series} />
                  </Panel>
                  <Panel
                    title="sign-up funnel"
                    subtitle="from a full access click to an activated account"
                    style={{ gridArea: "funnel" }}
                  >
                    <div style={{ display: "grid", gap: dynamicSizes.accounts.gap }}>
                      <div style={{ display: "grid", gap: dynamicSizes.accounts.sectionGap }}>
                        <SectionLabel>visitors</SectionLabel>
                        <RankedBars
                          rows={[
                            {
                              label: "full access clicks",
                              value: overview.totals.full_access_clicks,
                              secondary: `${formatPercent(overview.totals.full_access_rate)} of visitors`,
                            },
                            {
                              label: "account requests",
                              value: overview.totals.account_requests,
                              secondary: `${formatPercent(overview.totals.request_conversion_rate)} of clicks`,
                            },
                          ]}
                          valueLabel="bar length is unique visitors"
                          emphasis
                          emptyMessage="Nobody reached the form in this range."
                        />
                      </div>
                      <div style={{ display: "grid", gap: dynamicSizes.accounts.sectionGap }}>
                        <SectionLabel>accounts</SectionLabel>
                        <RankedBars
                          rows={[
                            { label: "usernames claimed", value: overview.totals.claimed },
                            {
                              label: "approved",
                              value: overview.totals.approved,
                              secondary: `${formatPercent(overview.totals.approval_rate)} of claims`,
                            },
                            {
                              label: "activated",
                              value: overview.totals.activated,
                              secondary: `${formatPercent(overview.totals.activation_rate)} of approved`,
                            },
                          ]}
                          valueLabel="bar length is accounts"
                          emphasis
                          emptyMessage="No usernames claimed in this range."
                        />
                      </div>
                    </div>
                  </Panel>
                  <Panel
                    title="weekly retention"
                    subtitle="share of each week's first-time visitors seen again"
                    style={{ gridArea: "retention" }}
                  >
                    <RetentionGrid cohorts={retention?.cohorts ?? []} weeks={retention?.weeks ?? 8} />
                  </Panel>
                  <Panel title="top pages" subtitle="page views in range" style={{ gridArea: "pages" }}>
                    <RankedBars
                      rows={(breakdowns?.pages ?? []).map((p) => ({
                        label: p.path,
                        value: p.page_views,
                        secondary: `${formatCount(p.visitors)} visitors`,
                      }))}
                      valueLabel="bar length is page views"
                    />
                  </Panel>
                  <Panel title="referrers" subtitle="sessions by source" style={{ gridArea: "referrers" }}>
                    <RankedBars
                      rows={(breakdowns?.referrers ?? []).map((r) => ({
                        label: r.referrer,
                        value: r.sessions,
                        secondary: `${formatCount(r.visitors)} visitors`,
                      }))}
                      valueLabel="bar length is sessions"
                    />
                  </Panel>
                  <Panel title="devices" subtitle="visitors by hardware and software" style={{ gridArea: "devices" }}>
                    <div style={{ display: "grid", gap: dynamicSizes.accounts.gap }}>
                      <FacetList title="device" rows={breakdowns?.devices ?? []} />
                      <FacetList title="browser" rows={breakdowns?.browsers ?? []} />
                      <FacetList title="operating system" rows={breakdowns?.operating_systems ?? []} />
                    </div>
                  </Panel>
                  <Panel title="contact" subtitle="who reached out, and who wrote in" style={{ gridArea: "contact" }}>
                    <div style={{ display: "grid", gap: dynamicSizes.accounts.gap }}>
                      <div style={{ display: "grid", gap: dynamicSizes.accounts.sectionGap }}>
                        <SectionLabel>visitors</SectionLabel>
                        <RankedBars
                          rows={[
                            {
                              label: "contact opens",
                              value: overview.totals.contact_clicks,
                              secondary: `${formatPercent(overview.totals.contact_rate)} of visitors`,
                            },
                            {
                              label: "messages sent",
                              value: overview.totals.contact_messages,
                              secondary: `${formatPercent(overview.totals.contact_conversion_rate)} of opens`,
                            },
                          ]}
                          valueLabel="bar length is unique visitors"
                          emphasis
                          emptyMessage="Nobody opened the contact form in this range."
                        />
                      </div>
                      <ContactRoster
                        apiOrigin={apiOrigin}
                        accessToken={me.accessToken}
                        senders={blocks?.senders ?? []}
                        onChanged={refreshBlocks}
                      />
                    </div>
                  </Panel>
                  <Panel
                    title="blocked"
                    subtitle="addresses shut out of the contact form"
                    style={{ gridArea: "blocked" }}
                  >
                    <BlockRoster
                      apiOrigin={apiOrigin}
                      accessToken={me.accessToken}
                      blocked={blocks?.blocked ?? []}
                      onChanged={refreshBlocks}
                    />
                  </Panel>
                  <Panel title="campaigns" subtitle="tagged sessions (utm)" style={{ gridArea: "campaigns" }}>
                    <DataTable
                      columns={["Source", "Medium", "Campaign", "Sessions"]}
                      rows={(breakdowns?.campaigns ?? []).map((c) => [c.source, c.medium, c.campaign, c.sessions])}
                      numericFrom={3}
                      emptyMessage="No campaign-tagged traffic in this range."
                    />
                  </Panel>
                  <Panel
                    title="accounts"
                    subtitle="who is signed up, and what they may do"
                    style={{ gridArea: "accounts" }}
                  >
                    <div style={{ display: "grid", gap: dynamicSizes.accounts.gap }}>
                      <div
                        style={{
                          display: "grid",
                          gap: dynamicSizes.accounts.statGap,
                          gridTemplateColumns: "repeat(3, 1fr)",
                        }}
                      >
                        <MiniStat label="registered users" value={formatCount(users?.totals.total_users ?? 0)} />
                        <MiniStat label="new in range" value={formatCount(users?.totals.new_users ?? 0)} />
                        <MiniStat label="activated" value={formatCount(users?.totals.activated_users ?? 0)} />
                        <MiniStat label="awaiting approval" value={formatCount(users?.totals.pending_approval ?? 0)} />
                        <MiniStat
                          label="awaiting password"
                          value={formatCount(users?.totals.pending_activation ?? 0)}
                        />
                        <MiniStat
                          label="identified visitors"
                          value={formatCount(users?.totals.identified_visitors ?? 0)}
                        />
                      </div>
                      <AccountRoster
                        apiOrigin={apiOrigin}
                        accessToken={me.accessToken}
                        accounts={accounts?.accounts ?? []}
                        onChanged={refreshAccounts}
                      />
                      <div style={{ display: "grid", gap: dynamicSizes.accounts.sectionGap }}>
                        <SectionLabel>most active accounts</SectionLabel>
                        <DataTable
                          columns={["User", "Sessions", "Page views"]}
                          rows={(users?.active_users ?? []).map((u) => [u.username, u.sessions, u.page_views])}
                          numericFrom={1}
                          emptyMessage="No logged-in activity in this range."
                        />
                      </div>
                    </div>
                  </Panel>
                </div>
              </>
            ) : (
              <Unavailable onRetry={reload} />
            )}
          </div>
        </div>
        <div style={{ gridColumn: "2", gridRow: "2 / span 2", zIndex: 1000 }}>
          <Toolbar me={me} onReload={reload} />
        </div>
        <div style={{ gridColumn: "1 / -1", gridRow: "4", zIndex: 1000 }}>
          <Statusbar overview={metrics.overview} loading={loading} />
        </div>
      </div>
    </MetricsContext>
  );
}

const STATE_LABELS: Record<string, string> = {
  [REQUESTED]: "awaiting approval",
  [AWAITING_PASSWORD]: "awaiting password",
  [READ_ONLY]: "read only",
  [ACTIVE]: "active",
};

interface AccountRoster {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  accounts: ManagedAccount_V1_0[];
  onChanged: () => Promise<void>;
}
const VISIBLE_ROWS = 12;

function AccountRoster({ apiOrigin, accessToken, accounts, onChanged }: AccountRoster) {
  const { resolution } = useContext(MetricsContext);
  const [inFlight, setInFlight] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 14 },
          row: { gap: 10, padding: 9, height: 48 },
          label: { fontSize: 12 },
          meta: { fontSize: 10 },
          search: { height: 34, fontSize: 11 },
        };
      case "midhigh":
        return {
          container: { gap: 12 },
          row: { gap: 9, padding: 8, height: 44 },
          label: { fontSize: 11 },
          meta: { fontSize: 9 },
          search: { height: 32, fontSize: 10 },
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 10 },
          row: { gap: 8, padding: 7, height: 40 },
          label: { fontSize: 10 },
          meta: { fontSize: 9 },
          search: { height: 30, fontSize: 10 },
        };
    }
  });

  const busy = inFlight !== undefined;
  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(
    () => (trimmed ? accounts.filter((a) => a.username.toLowerCase().includes(trimmed)) : accounts),
    [accounts, trimmed],
  );
  const listMaxHeight = dynamicSizes.row.height * VISIBLE_ROWS + dynamicSizes.row.gap * (VISIBLE_ROWS - 1);

  const approve = useCallback(
    async (username: string) => {
      if (busy) return;
      setInFlight(username);
      setNotice("");
      const result = await approveAccount(apiOrigin, accessToken, username);
      if (!result) {
        setNotice("the approval did not go through");
      } else if (!result.success) {
        setNotice(result.message);
      } else {
        setNotice(
          result.email_sent
            ? `${result.username} approved, link emailed to ${result.email}`
            : `${result.username} approved, but the email failed: resend the link`,
        );
        await onChanged();
      }
      setInFlight(undefined);
    },
    [apiOrigin, accessToken, busy, onChanged],
  );

  const changeRole = useCallback(
    async (username: string, role: string) => {
      if (busy) return;
      setInFlight(username);
      setNotice("");
      const result = await setAccountRole(apiOrigin, accessToken, username, role);
      if (!result) {
        setNotice("the role could not be changed");
      } else if (!result.success) {
        setNotice(result.message);
      } else {
        setNotice(
          result.email_sent
            ? `${result.username} set to ${ROLE_LABELS[result.role] ?? result.role}, email sent`
            : `${result.username} set to ${ROLE_LABELS[result.role] ?? result.role}, but the email failed`,
        );
        await onChanged();
      }
      setInFlight(undefined);
    },
    [apiOrigin, accessToken, busy, onChanged],
  );

  const checkEmail = useCallback(async () => {
    if (busy) return;
    setInFlight("__email_check__");
    setNotice("");
    const result = await checkEmailDelivery(apiOrigin, accessToken);
    if (!result) {
      setNotice("the email check could not run");
    } else if (!result.success) {
      setNotice(`${result.transport}: ${result.message}`);
    } else {
      setNotice(`${result.transport}: test email sent to ${result.sent_to}`);
    }
    setInFlight(undefined);
  }, [apiOrigin, accessToken, busy]);

  return (
    <div style={{ display: "grid", gap: dynamicSizes.container.gap }}>
      {accounts.length === 0 ? (
        <span className={dellaRespira.className} style={{ fontSize: dynamicSizes.label.fontSize, color: VIZ.mutedInk }}>
          No accounts yet.
        </span>
      ) : (
        <>
          <input
            className={dellaRespira.className}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="filter by username"
            spellCheck={false}
            autoComplete="off"
            style={{
              height: dynamicSizes.search.height,
              fontSize: dynamicSizes.search.fontSize,
              letterSpacing: 1,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgb(25,25,25)",
              color: VIZ.primaryInk,
              boxSizing: "border-box",
              outline: "none",
              width: "100%",
            }}
          />
          <span
            className={dellaRespira.className}
            style={{ fontSize: dynamicSizes.meta.fontSize, color: VIZ.mutedInk }}
          >
            {`${matches.length === accounts.length ? accounts.length : `${matches.length} of ${accounts.length}`} accounts${
              matches.length > VISIBLE_ROWS ? " · scroll for more" : ""
            }`}
          </span>
          {matches.length === 0 ? (
            <span
              className={dellaRespira.className}
              style={{ fontSize: dynamicSizes.label.fontSize, color: VIZ.mutedInk }}
            >
              {`No username matches "${query.trim()}".`}
            </span>
          ) : (
            <div
              style={{
                display: "grid",
                gap: dynamicSizes.row.gap,
                maxHeight: listMaxHeight,
                overflowY: "auto",
                overflowX: "hidden",
                alignContent: "start",
              }}
            >
              {matches.map((account) => (
                <div
                  key={account.username}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: dynamicSizes.row.gap,
                    padding: `0 ${dynamicSizes.row.padding}px`,
                    height: dynamicSizes.row.height,
                    boxSizing: "border-box",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <span
                      className={dellaRespira.className}
                      style={{
                        fontSize: dynamicSizes.label.fontSize,
                        color: VIZ.primaryInk,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {account.username}
                    </span>
                    <span
                      className={ubuntuMono.className}
                      style={{
                        fontSize: dynamicSizes.meta.fontSize,
                        color: VIZ.mutedInk,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {`${account.email} · ${STATE_LABELS[account.state] ?? account.state}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: dynamicSizes.row.gap }}>
                    {account.activated ? (
                      <></>
                    ) : (
                      <div
                        className={dellaRespira.className}
                        onClick={() => void approve(account.username)}
                        style={{
                          fontSize: dynamicSizes.meta.fontSize,
                          letterSpacing: 1,
                          padding: "6px 10px",
                          borderRadius: 6,
                          whiteSpace: "nowrap",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: busy ? VIZ.mutedInk : VIZ.primaryInk,
                          cursor: busy ? "progress" : "pointer",
                        }}
                      >
                        {inFlight === account.username ? "sending" : account.approved_at ? "resend link" : "approve"}
                      </div>
                    )}
                    <select
                      className={dellaRespira.className}
                      value={account.role}
                      disabled={busy}
                      onChange={(event) => void changeRole(account.username, event.currentTarget.value)}
                      style={{
                        fontSize: dynamicSizes.meta.fontSize,
                        letterSpacing: 1,
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgb(25,25,25)",
                        color: busy ? VIZ.mutedInk : VIZ.primaryInk,
                        cursor: busy ? "progress" : "pointer",
                        outline: "none",
                      }}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span
          className={dellaRespira.className}
          style={{ fontSize: dynamicSizes.meta.fontSize, color: VIZ.mutedInk, minWidth: 0 }}
        >
          {notice}
        </span>
        <div
          className={dellaRespira.className}
          onClick={() => void checkEmail()}
          style={{
            fontSize: dynamicSizes.meta.fontSize,
            letterSpacing: 1,
            padding: "6px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            border: "1px solid rgba(255,255,255,0.12)",
            color: busy ? VIZ.mutedInk : VIZ.primaryInk,
            cursor: busy ? "progress" : "pointer",
          }}
        >
          {inFlight === "__email_check__" ? "sending" : "send test email"}
        </div>
      </div>
    </div>
  );
}

function useRosterSizes() {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 14 },
          row: { gap: 10, padding: 9, height: 48 },
          label: { fontSize: 12 },
          meta: { fontSize: 10 },
          search: { height: 34, fontSize: 11 },
        };
      case "midhigh":
        return {
          container: { gap: 12 },
          row: { gap: 9, padding: 8, height: 44 },
          label: { fontSize: 11 },
          meta: { fontSize: 9 },
          search: { height: 32, fontSize: 10 },
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 10 },
          row: { gap: 8, padding: 7, height: 40 },
          label: { fontSize: 10 },
          meta: { fontSize: 9 },
          search: { height: 30, fontSize: 10 },
        };
    }
  });
  return dynamicSizes;
}

type RosterSizes = ReturnType<typeof useRosterSizes>;

function rosterStyles(sizes: RosterSizes, busy: boolean) {
  return {
    actionStyle: {
      fontSize: sizes.meta.fontSize,
      letterSpacing: 1,
      padding: "6px 10px",
      borderRadius: 6,
      whiteSpace: "nowrap" as const,
      border: "1px solid rgba(255,255,255,0.12)",
      color: busy ? VIZ.mutedInk : VIZ.primaryInk,
      cursor: busy ? ("progress" as const) : ("pointer" as const),
    },
    rowStyle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: sizes.row.gap,
      padding: `0 ${sizes.row.padding}px`,
      height: sizes.row.height,
      boxSizing: "border-box" as const,
      borderRadius: 6,
      background: "rgba(255,255,255,0.03)",
    },
    truncated: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    listStyle: {
      display: "grid",
      gap: sizes.row.gap,
      maxHeight: sizes.row.height * VISIBLE_ROWS + sizes.row.gap * (VISIBLE_ROWS - 1),
      overflowY: "auto" as const,
      overflowX: "hidden" as const,
      alignContent: "start" as const,
    },
    inputStyle: {
      height: sizes.search.height,
      fontSize: sizes.search.fontSize,
      letterSpacing: 1,
      padding: "0 10px",
      borderRadius: 6,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgb(25,25,25)",
      color: VIZ.primaryInk,
      boxSizing: "border-box" as const,
      outline: "none",
    },
  };
}

function useBlocking(apiOrigin: string | undefined, accessToken: string | undefined, onChanged: () => Promise<void>) {
  const [inFlight, setInFlight] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string>("");
  const busy = inFlight !== undefined;

  const block = useCallback(
    async (email: string, why: string) => {
      if (busy) return false;
      const trimmed = email.trim();
      if (!trimmed) {
        setNotice("enter the address to block");
        return false;
      }
      setInFlight(trimmed);
      setNotice("");
      const result = await blockEmail(apiOrigin, accessToken, trimmed, why.trim());
      let blockedNow = false;
      if (!result) {
        setNotice("the block did not go through");
      } else if (!result.success) {
        setNotice(result.message);
      } else {
        setNotice(
          result.devices > 0
            ? `${result.email} blocked, with ${result.devices} ${result.devices === 1 ? "device" : "devices"} behind it`
            : `${result.email} blocked`,
        );
        blockedNow = true;
        await onChanged();
      }
      setInFlight(undefined);
      return blockedNow;
    },
    [apiOrigin, accessToken, busy, onChanged],
  );

  const unblock = useCallback(
    async (email: string) => {
      if (busy) return;
      setInFlight(email);
      setNotice("");
      const result = await unblockEmail(apiOrigin, accessToken, email);
      if (!result) {
        setNotice("the block could not be lifted");
      } else if (!result.success) {
        setNotice(result.message);
      } else {
        setNotice(`${result.email} unblocked`);
        await onChanged();
      }
      setInFlight(undefined);
    },
    [apiOrigin, accessToken, busy, onChanged],
  );

  return { inFlight, notice, busy, block, unblock };
}

interface BlockRoster {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  blocked: BlockedEmail_V1_0[];
  onChanged: () => Promise<void>;
}
function BlockRoster({ apiOrigin, accessToken, blocked, onChanged }: BlockRoster) {
  const sizes = useRosterSizes();
  const { inFlight, notice, busy, block, unblock } = useBlocking(apiOrigin, accessToken, onChanged);
  const [candidate, setCandidate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const { actionStyle, rowStyle, truncated, listStyle, inputStyle } = rosterStyles(sizes, busy);

  const submit = useCallback(async () => {
    if (await block(candidate, reason)) {
      setCandidate("");
      setReason("");
    }
  }, [block, candidate, reason]);

  return (
    <div style={{ display: "grid", gap: sizes.container.gap }}>
      <div style={{ display: "grid", gap: sizes.row.gap }}>
        <input
          className={ubuntuMono.className}
          value={candidate}
          onChange={(event) => setCandidate(event.currentTarget.value)}
          placeholder="email address to block"
          spellCheck={false}
          autoComplete="off"
          style={{ ...inputStyle, width: "100%" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: sizes.row.gap }}>
          <input
            className={dellaRespira.className}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder="why (optional)"
            spellCheck={false}
            autoComplete="off"
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <div className={dellaRespira.className} onClick={() => void submit()} style={actionStyle}>
            {busy && inFlight === candidate.trim() ? "blocking" : "block address"}
          </div>
        </div>
      </div>

      {blocked.length === 0 ? (
        <span className={dellaRespira.className} style={{ fontSize: sizes.label.fontSize, color: VIZ.mutedInk }}>
          No addresses are blocked.
        </span>
      ) : (
        <div style={listStyle}>
          {blocked.map((row) => (
            <div key={row.email} style={rowStyle}>
              <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span
                  className={ubuntuMono.className}
                  style={{ fontSize: sizes.label.fontSize, color: VIZ.primaryInk, ...truncated }}
                >
                  {row.email}
                </span>
                <span
                  className={ubuntuMono.className}
                  style={{ fontSize: sizes.meta.fontSize, color: VIZ.mutedInk, ...truncated }}
                >
                  {`${row.devices} ${row.devices === 1 ? "device" : "devices"} · ${row.hits} dropped${
                    row.reason ? ` · ${row.reason}` : ""
                  }`}
                </span>
              </div>
              <div className={dellaRespira.className} onClick={() => void unblock(row.email)} style={actionStyle}>
                {inFlight === row.email ? "lifting" : "unblock"}
              </div>
            </div>
          ))}
        </div>
      )}

      <span className={dellaRespira.className} style={{ fontSize: sizes.meta.fontSize, color: VIZ.mutedInk }}>
        {notice}
      </span>
    </div>
  );
}

interface ContactRoster {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  senders: ContactSender_V1_0[];
  onChanged: () => Promise<void>;
}
function ContactRoster({ apiOrigin, accessToken, senders, onChanged }: ContactRoster) {
  const sizes = useRosterSizes();
  const { inFlight, notice, busy, block } = useBlocking(apiOrigin, accessToken, onChanged);
  const { actionStyle, rowStyle, truncated, listStyle } = rosterStyles(sizes, busy);

  return (
    <div style={{ display: "grid", gap: sizes.container.gap }}>
      <div style={{ display: "grid", gap: sizes.row.gap }}>
        <SectionLabel>who wrote in</SectionLabel>
        {senders.length === 0 ? (
          <span className={dellaRespira.className} style={{ fontSize: sizes.label.fontSize, color: VIZ.mutedInk }}>
            Nobody has written in yet.
          </span>
        ) : (
          <div style={listStyle}>
            {senders.map((sender) => (
              <div key={sender.email} style={rowStyle}>
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span
                    className={ubuntuMono.className}
                    style={{
                      fontSize: sizes.label.fontSize,
                      color: sender.blocked ? VIZ.mutedInk : VIZ.primaryInk,
                      ...truncated,
                    }}
                  >
                    {sender.email}
                  </span>
                  <span
                    className={ubuntuMono.className}
                    style={{ fontSize: sizes.meta.fontSize, color: VIZ.mutedInk, ...truncated }}
                  >
                    {`${sender.messages} sent · ${sender.devices} ${sender.devices === 1 ? "device" : "devices"}${
                      sender.last_sent_at ? ` · ${sender.last_sent_at.slice(0, 10)}` : ""
                    }`}
                  </span>
                </div>
                {sender.blocked ? (
                  <span
                    className={dellaRespira.className}
                    style={{ fontSize: sizes.meta.fontSize, color: VIZ.mutedInk, whiteSpace: "nowrap" }}
                  >
                    {"blocked"}
                  </span>
                ) : (
                  <div
                    className={dellaRespira.className}
                    onClick={() => void block(sender.email, "")}
                    style={actionStyle}
                  >
                    {inFlight === sender.email ? "blocking" : "block"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <span className={dellaRespira.className} style={{ fontSize: sizes.meta.fontSize, color: VIZ.mutedInk }}>
        {notice}
      </span>
    </div>
  );
}

interface SectionLabel {
  children: React.ReactNode;
}
function SectionLabel({ children }: SectionLabel) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return { fontSize: 11, letterSpacing: 1 };
      case "midhigh":
        return { fontSize: 10, letterSpacing: 1 };
      case "low":
      case "midlow":
        return { fontSize: 9, letterSpacing: 1 };
    }
  });

  return (
    <span
      className={dellaRespira.className}
      style={{ fontSize: dynamicSizes.fontSize, letterSpacing: dynamicSizes.letterSpacing, color: VIZ.mutedInk }}
    >
      {children}
    </span>
  );
}

interface MiniStat {
  label: string;
  value: string;
}
function MiniStat({ label, value }: MiniStat) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return { container: { gap: 3 }, label: { fontSize: 11 }, value: { fontSize: 21 } };
      case "midhigh":
        return { container: { gap: 2 }, label: { fontSize: 10 }, value: { fontSize: 18 } };
      case "low":
      case "midlow":
        return { container: { gap: 2 }, label: { fontSize: 9 }, value: { fontSize: 16 } };
    }
  });

  return (
    <div style={{ display: "grid", gap: dynamicSizes.container.gap }}>
      <span className={dellaRespira.className} style={{ fontSize: dynamicSizes.label.fontSize, color: VIZ.mutedInk }}>
        {label}
      </span>
      <span className={dellaRespira.className} style={{ fontSize: dynamicSizes.value.fontSize, color: VIZ.primaryInk }}>
        {value}
      </span>
    </div>
  );
}

interface FacetList {
  title: string;
  rows: { name: string; visitors: number }[];
}
function FacetList({ title, rows }: FacetList) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 7 },
          row: { gap: 4, labelGap: 12 },
          label: { fontSize: 12 },
          value: { fontSize: 11 },
          bar: { height: 7, radius: 4, minPercent: 0.8 },
          maxRows: 4,
        };
      case "midhigh":
        return {
          container: { gap: 6 },
          row: { gap: 3, labelGap: 10 },
          label: { fontSize: 11 },
          value: { fontSize: 10 },
          bar: { height: 6, radius: 3, minPercent: 0.8 },
          maxRows: 4,
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 5 },
          row: { gap: 3, labelGap: 9 },
          label: { fontSize: 10 },
          value: { fontSize: 9 },
          bar: { height: 6, radius: 3, minPercent: 0.8 },
          maxRows: 4,
        };
    }
  });

  const total = rows.reduce((sum, row) => sum + row.visitors, 0);

  return (
    <div style={{ display: "grid", gap: dynamicSizes.container.gap }}>
      <SectionLabel>{title}</SectionLabel>
      {rows.length === 0 ? (
        <span className={dellaRespira.className} style={{ fontSize: dynamicSizes.label.fontSize, color: VIZ.mutedInk }}>
          No data in this range.
        </span>
      ) : (
        rows.slice(0, dynamicSizes.maxRows).map((row) => (
          <div key={row.name} style={{ display: "grid", gap: dynamicSizes.row.gap }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: dynamicSizes.row.labelGap }}>
              <span
                className={dellaRespira.className}
                style={{ fontSize: dynamicSizes.label.fontSize, color: VIZ.primaryInk }}
              >
                {row.name}
              </span>
              <span
                className={ubuntuMono.className}
                style={{
                  fontSize: dynamicSizes.value.fontSize,
                  color: VIZ.secondaryInk,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatCount(row.visitors)}
              </span>
            </div>
            <div style={{ height: dynamicSizes.bar.height, width: "100%" }}>
              <div
                style={{
                  height: dynamicSizes.bar.height,
                  width: `${total > 0 ? Math.max((row.visitors / total) * 100, dynamicSizes.bar.minPercent) : 0}%`,
                  background: VIZ.returning,
                  borderRadius: `0 ${dynamicSizes.bar.radius}px ${dynamicSizes.bar.radius}px 0`,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

interface Titlebar {
  overview: MetricsDependencies["overview"];
}
function Titlebar({ overview }: Titlebar) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { height: 50, paddingX: 20, borderWidth: 1 },
          title: { fontSize: 21, letterSpacing: 2 },
          range: { fontSize: 11, letterSpacing: 1 },
        };
      case "midhigh":
        return {
          container: { height: 45, paddingX: 16, borderWidth: 1 },
          title: { fontSize: 18, letterSpacing: 2 },
          range: { fontSize: 10, letterSpacing: 1 },
        };
      case "low":
      case "midlow":
        return {
          container: { height: 40, paddingX: 13, borderWidth: 1 },
          title: { fontSize: 16, letterSpacing: 2 },
          range: { fontSize: 9, letterSpacing: 1 },
        };
    }
  });

  return (
    <div
      style={{
        background: "rgba(28, 28, 28, 1)",
        width: "100%",
        height: dynamicSizes.container.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${dynamicSizes.container.paddingX}px`,
        borderBottom: `${dynamicSizes.container.borderWidth}px solid ${VIZ.hairline}`,
      }}
    >
      <span
        className={italiana.className}
        style={{
          fontSize: dynamicSizes.title.fontSize,
          letterSpacing: dynamicSizes.title.letterSpacing,
          fontWeight: "bolder",
        }}
      >
        {"metrics"}
      </span>
      <span
        className={dellaRespira.className}
        style={{
          fontSize: dynamicSizes.range.fontSize,
          letterSpacing: dynamicSizes.range.letterSpacing,
        }}
      >
        {overview ? `${overview.range.from} → ${overview.range.to}` : "no data"}
      </span>
    </div>
  );
}

interface Rangebar {
  days: number;
  onChange: (days: number) => void;
  loading: boolean;
}
function Rangebar({ days, onChange, loading }: Rangebar) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { height: 34, paddingX: 20, gap: 12, borderWidth: 1 },
          label: { fontSize: 11, letterSpacing: 1 },
          buttons: { gap: 5 },
          button: { fontSize: 11, letterSpacing: 1, paddingY: 4, paddingX: 12, borderRadius: 5, borderWidth: 1 },
          status: { fontSize: 11 },
        };
      case "midhigh":
        return {
          container: { height: 30, paddingX: 16, gap: 10, borderWidth: 1 },
          label: { fontSize: 10, letterSpacing: 1 },
          buttons: { gap: 4 },
          button: { fontSize: 10, letterSpacing: 1, paddingY: 3, paddingX: 10, borderRadius: 4, borderWidth: 1 },
          status: { fontSize: 10 },
        };
      case "low":
      case "midlow":
        return {
          container: { height: 26, paddingX: 13, gap: 9, borderWidth: 1 },
          label: { fontSize: 9, letterSpacing: 1 },
          buttons: { gap: 4 },
          button: { fontSize: 9, letterSpacing: 1, paddingY: 2, paddingX: 9, borderRadius: 4, borderWidth: 1 },
          status: { fontSize: 9 },
        };
    }
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: dynamicSizes.container.gap,
        height: dynamicSizes.container.height,
        padding: `0 ${dynamicSizes.container.paddingX}px`,
        backgroundColor: "rgb(23, 23, 23)",
        borderBottom: `${dynamicSizes.container.borderWidth}px solid rgba(255, 255, 255, 0.05)`,
      }}
    >
      <span
        className={dellaRespira.className}
        style={{
          fontSize: dynamicSizes.label.fontSize,
          color: VIZ.mutedInk,
          letterSpacing: dynamicSizes.label.letterSpacing,
        }}
      >
        range
      </span>
      <div style={{ display: "flex", gap: dynamicSizes.buttons.gap }}>
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={days === option}
            disabled={loading}
            className={dellaRespira.className}
            style={{
              appearance: "none",
              cursor: loading ? "wait" : "pointer",
              fontSize: dynamicSizes.button.fontSize,
              letterSpacing: dynamicSizes.button.letterSpacing,
              padding: `${dynamicSizes.button.paddingY}px ${dynamicSizes.button.paddingX}px`,
              borderRadius: dynamicSizes.button.borderRadius,
              border: `${dynamicSizes.button.borderWidth}px solid ${days === option ? VIZ.selected : VIZ.hairline}`,
              background: days === option ? VIZ.selectedFill : "rgba(31,31,31,0.9)",
              color: days === option ? VIZ.primaryInk : VIZ.mutedInk,
            }}
          >
            {`${option}d`}
          </button>
        ))}
      </div>
      {loading && (
        <span
          className={dellaRespira.className}
          style={{ fontSize: dynamicSizes.status.fontSize, color: VIZ.mutedInk }}
        >
          updating…
        </span>
      )}
    </div>
  );
}

interface Headline {
  overview: NonNullable<MetricsDependencies["overview"]>;
}
function Headline({ overview }: Headline) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return { container: { gap: 16 }, primary: { gap: 16, columnMin: 250 }, secondary: { gap: 16, columnMin: 185 } };
      case "midhigh":
        return { container: { gap: 12 }, primary: { gap: 12, columnMin: 200 }, secondary: { gap: 12, columnMin: 150 } };
      case "low":
      case "midlow":
        return { container: { gap: 10 }, primary: { gap: 10, columnMin: 175 }, secondary: { gap: 10, columnMin: 132 } };
    }
  });

  const { totals, previous, active, series } = overview;

  return (
    <div style={{ display: "grid", gap: dynamicSizes.container.gap }}>
      <div
        style={{
          display: "grid",
          gap: dynamicSizes.primary.gap,
          gridTemplateColumns: `repeat(auto-fit, minmax(${dynamicSizes.primary.columnMin}px, 1fr))`,
        }}
      >
        <StatTile
          label="unique visitors"
          value={formatCount(totals.unique_visitors)}
          hero
          delta={{ current: totals.unique_visitors, previous: previous.unique_visitors }}
          trend={series.map((p) => p.unique_visitors)}
          footnote={`${formatCount(totals.new_visitors)} new · ${formatCount(totals.returning_visitors)} returning`}
        />
        <StatTile
          label="sessions"
          value={formatCount(totals.sessions)}
          delta={{ current: totals.sessions, previous: previous.sessions }}
          trend={series.map((p) => p.sessions)}
          footnote={`${totals.views_per_session} views per session`}
        />
        <StatTile
          label="page views"
          value={formatCount(totals.page_views)}
          delta={{ current: totals.page_views, previous: previous.page_views }}
          trend={series.map((p) => p.page_views)}
        />
      </div>
      <div
        style={{
          display: "grid",
          gap: dynamicSizes.secondary.gap,
          gridTemplateColumns: `repeat(auto-fit, minmax(${dynamicSizes.secondary.columnMin}px, 1fr))`,
        }}
      >
        <StatTile label="daily active" value={formatCount(active.dau)} footnote="visitors today" />
        <StatTile label="weekly active" value={formatCount(active.wau)} footnote="last 7 days" />
        <StatTile label="monthly active" value={formatCount(active.mau)} footnote="last 30 days" />
        <StatTile
          label="bounce rate"
          value={formatPercent(totals.bounce_rate)}
          delta={{
            current: totals.bounce_rate,
            previous: previous.bounce_rate,
            higherIsBetter: false,
            format: (value) => formatPercent(value),
          }}
          footnote="sessions with one page view"
        />
        <StatTile
          label="avg session"
          value={formatDuration(totals.avg_session_seconds)}
          delta={{
            current: totals.avg_session_seconds,
            previous: previous.avg_session_seconds,
            format: formatDuration,
          }}
        />
      </div>
    </div>
  );
}

interface Toolbar {
  me: MeDependencies;
  onReload: () => void;
}
function Toolbar({ me, onReload }: Toolbar) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { borderWidth: 1 },
          divider: { height: 20, thickness: 1, widthPercent: 25, borderRadius: 10 },
          button: { scale: 0.55 },
        };
      case "midhigh":
        return {
          container: { borderWidth: 1 },
          divider: { height: 16, thickness: 1, widthPercent: 25, borderRadius: 10 },
          button: { scale: 0.55 },
        };
      case "low":
      case "midlow":
        return {
          container: { borderWidth: 1 },
          divider: { height: 14, thickness: 1, widthPercent: 25, borderRadius: 10 },
          button: { scale: 0.55 },
        };
    }
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "min-content min-content auto",
        borderLeft: `${dynamicSizes.container.borderWidth}px solid ${VIZ.hairline}`,
        background: "rgba(31, 31, 31, 1)",
        width: "min-content",
        height: "100%",
        justifyContent: "center",
      }}
    >
      <Navbar resolution={{ ...resolution }} guest={!me.me} admin={me.me?.role === "admin"} />
      <div
        style={{
          display: "grid",
          height: dynamicSizes.divider.height,
          width: "100%",
          alignContent: "center",
          justifyItems: "center",
        }}
      >
        <div
          style={{
            height: dynamicSizes.divider.thickness,
            borderRadius: dynamicSizes.divider.borderRadius,
            width: `${dynamicSizes.divider.widthPercent}%`,
            background: "rgba(255, 255, 255, 0.35)",
          }}
        />
      </div>
      <div>
        <ToolbarButton
          selected={false}
          svg={{ svg: refresh200(), scale: dynamicSizes.button.scale, cursor: "pointer" }}
          onClick={onReload}
          resolution={{ ...resolution }}
          title="reload metrics"
        />
      </div>
    </div>
  );
}

interface Statusbar {
  overview: MetricsDependencies["overview"];
  loading: boolean;
}
function Statusbar({ overview, loading }: Statusbar) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { height: 30, paddingX: 12, gap: 14, borderWidth: 1 },
          action: { fontSize: 11 },
          body: { fontSize: 10, gap: 12 },
          resolution: { fontSize: 10, letterSpacing: 1 },
        };
      case "midhigh":
        return {
          container: { height: 24, paddingX: 12, gap: 12, borderWidth: 1 },
          action: { fontSize: 8 },
          body: { fontSize: 7, gap: 10 },
          resolution: { fontSize: 8, letterSpacing: 1 },
        };
      case "low":
      case "midlow":
        return {
          container: { height: 20, paddingX: 12, gap: 10, borderWidth: 1 },
          action: { fontSize: 7 },
          body: { fontSize: 7, gap: 9 },
          resolution: { fontSize: 7, letterSpacing: 1 },
        };
    }
  });

  const body = overview
    ? [
        `${formatCount(overview.totals.unique_visitors)} visitors`,
        `${formatCount(overview.totals.sessions)} sessions`,
        `${formatCount(overview.totals.page_views)} views`,
        `${formatCount(overview.totals.claimed)} claimed`,
        `${formatCount(overview.totals.activated)} activated`,
      ]
    : ["metrics unavailable"];

  return (
    <div
      style={{
        height: dynamicSizes.container.height,
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: dynamicSizes.container.gap,
        backgroundColor: "rgb(23, 23, 23)",
        borderTop: `${dynamicSizes.container.borderWidth}px solid rgba(255, 255, 255, 0.05)`,
        whiteSpace: "nowrap",
        padding: `0px ${dynamicSizes.container.paddingX}px`,
      }}
    >
      <span className={dellaRespira.className} style={{ fontWeight: "bolder", fontSize: dynamicSizes.action.fontSize }}>
        {loading ? "laurus metrics · updating" : "laurus metrics"}
      </span>
      <span
        className={ubuntuMono.className}
        style={{
          display: "flex",
          gap: dynamicSizes.body.gap,
          fontSize: dynamicSizes.body.fontSize,
          color: VIZ.secondaryInk,
        }}
      >
        {body.map((entry) => (
          <span key={entry}>{entry}</span>
        ))}
      </span>
      <span
        className={dellaRespira.className}
        style={{
          marginLeft: "auto",
          ...dynamicSizes.resolution,
        }}
        title="screen resolution"
      >
        {`${resolution.value.width} x ${resolution.value.height}`}
      </span>
    </div>
  );
}

interface Unavailable {
  onRetry: () => void;
}
function Unavailable({ onRetry }: Unavailable) {
  const { resolution } = useContext(MetricsContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { gap: 14, padding: 76 },
          heading: { fontSize: 38 },
          body: { fontSize: 14 },
          button: { fontSize: 12, letterSpacing: 1, paddingY: 7, paddingX: 18, borderRadius: 5, borderWidth: 1 },
        };
      case "midhigh":
        return {
          container: { gap: 12, padding: 64 },
          heading: { fontSize: 32 },
          body: { fontSize: 12 },
          button: { fontSize: 11, letterSpacing: 1, paddingY: 6, paddingX: 16, borderRadius: 4, borderWidth: 1 },
        };
      case "low":
      case "midlow":
        return {
          container: { gap: 10, padding: 48 },
          heading: { fontSize: 28 },
          body: { fontSize: 11 },
          button: { fontSize: 10, letterSpacing: 1, paddingY: 5, paddingX: 14, borderRadius: 4, borderWidth: 1 },
        };
    }
  });

  return (
    <div
      style={{
        display: "grid",
        placeContent: "center",
        gap: dynamicSizes.container.gap,
        padding: dynamicSizes.container.padding,
        textAlign: "center",
      }}
    >
      <span className={italiana.className} style={{ fontSize: dynamicSizes.heading.fontSize }}>
        no metrics
      </span>
      <span className={dellaRespira.className} style={{ fontSize: dynamicSizes.body.fontSize, color: VIZ.mutedInk }}>
        The metrics service did not answer. Check that the analytics migrations have been applied.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className={dellaRespira.className}
        style={{
          appearance: "none",
          cursor: "pointer",
          justifySelf: "center",
          fontSize: dynamicSizes.button.fontSize,
          letterSpacing: dynamicSizes.button.letterSpacing,
          padding: `${dynamicSizes.button.paddingY}px ${dynamicSizes.button.paddingX}px`,
          borderRadius: dynamicSizes.button.borderRadius,
          border: `${dynamicSizes.button.borderWidth}px solid ${VIZ.hairline}`,
          background: "rgba(255,255,255,0.06)",
          color: VIZ.primaryInk,
        }}
      >
        try again
      </button>
    </div>
  );
}
