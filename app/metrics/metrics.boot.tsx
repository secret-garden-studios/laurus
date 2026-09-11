"use client";
import { Suspense, use, useEffect, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira, italiana } from "../fonts";
import Skeleton from "../components/skeleton";
import { MeDependencies } from "../page";
import { useAccessToken } from "../hooks/useAccessToken";
import { getScreenResolution, ProjectsResolution } from "../projects/projects-resolution";
import Metrics from "./metrics.client";
import { MetricsDependencies } from "./metrics.server";

interface MetricsBoot {
  laurusApi: string | undefined;
  mePromise: Promise<MeDependencies>;
  metricsPromise: Promise<MetricsDependencies>;
}
export default function MetricsBoot({ laurusApi, mePromise, metricsPromise }: MetricsBoot) {
  const [resolution, setResolution] = useState<ProjectsResolution | undefined>(undefined);

  useEffect(() => {
    (() => {
      if (!resolution) setResolution(getScreenResolution());
    })();
  }, [resolution]);

  return resolution !== undefined ? (
    resolution.type != "low" ? (
      <Suspense fallback={<Skeleton />}>
        <MetricsWithDependencies
          laurusApi={laurusApi}
          mePromise={mePromise}
          metricsPromise={metricsPromise}
          resolution={resolution}
        />
      </Suspense>
    ) : (
      <Notice
        resolution={resolution}
        heading={`${resolution.value.width} x ${resolution.value.height}`}
        body="Laurus is not designed for small screens."
      />
    )
  ) : (
    <Skeleton />
  );
}

function MetricsWithDependencies({
  laurusApi,
  mePromise,
  metricsPromise,
  resolution,
}: MetricsBoot & { resolution: ProjectsResolution }) {
  const me = use(mePromise);
  useAccessToken(laurusApi, me.accessToken);
  const metrics = use(metricsPromise);

  if (me.me?.role !== "admin") {
    return <Notice resolution={resolution} heading="401" body={"access denied"} />;
  }

  return <Metrics apiOrigin={laurusApi} me={me} resolution={resolution} metrics={metrics} />;
}

interface Notice {
  resolution: ProjectsResolution;
  heading: string;
  body: string;
}
function Notice({ resolution, heading, body }: Notice) {
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          container: { letterSpacing: 1 },
          stack: { padding: 30, gap: 14 },
          heading: { fontSize: 54 },
          body: { fontSize: 18 },
        };
      case "midhigh":
        return {
          container: { letterSpacing: 1 },
          stack: { padding: 24, gap: 12 },
          heading: { fontSize: 46 },
          body: { fontSize: 16 },
        };
      case "low":
      case "midlow":
        return {
          container: { letterSpacing: 1 },
          stack: { padding: 20, gap: 10 },
          heading: { fontSize: 38 },
          body: { fontSize: 14 },
        };
    }
  });

  return (
    <div
      className={`${styles[resolution.type == "high" ? "noisy-background-16-2" : "noisy-background-16-2-low-res"]} ${dellaRespira.className}`}
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        placeContent: "center",
        letterSpacing: `${dynamicSizes.container.letterSpacing}px`,
      }}
    >
      <div
        style={{
          display: "grid",
          width: "100%",
          padding: dynamicSizes.stack.padding,
          justifyItems: "center",
          gap: dynamicSizes.stack.gap,
        }}
      >
        <p
          className={italiana.className}
          style={{ fontSize: dynamicSizes.heading.fontSize, textAlign: "center", fontWeight: "bolder" }}
        >
          {heading}
        </p>
        <div style={{ fontSize: dynamicSizes.body.fontSize, textAlign: "center" }}>{body}</div>
      </div>
    </div>
  );
}
