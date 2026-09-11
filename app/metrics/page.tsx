import { fetchMe, MeDependencies } from "../page";
import MetricsBoot from "./metrics.boot";
import { MetricsDependencies, DEFAULT_RANGE_DAYS, getMetrics } from "./metrics.server";
export const dynamic = "force-dynamic";

async function fetchMetrics(
  laurusApi: string | undefined,
  mePromise: Promise<MeDependencies>,
): Promise<MetricsDependencies> {
  const me = await mePromise;
  if (me.me?.role !== "admin") {
    return {
      overview: undefined,
      retention: undefined,
      breakdowns: undefined,
      users: undefined,
      accounts: undefined,
      blocks: undefined,
    };
  }
  return getMetrics(laurusApi, me.accessToken, DEFAULT_RANGE_DAYS);
}

export default async function Page() {
  const laurusApi = process.env.LAURUS_API;
  const mePromise = fetchMe(laurusApi, false);
  const metricsPromise = fetchMetrics(laurusApi, mePromise);
  return <MetricsBoot laurusApi={laurusApi} mePromise={mePromise} metricsPromise={metricsPromise} />;
}
