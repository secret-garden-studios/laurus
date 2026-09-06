"use client";
import { useState, Suspense, useEffect, use } from "react";
import { getScreenResolution } from "../screens/screens-resolution";
import styles from "../app.module.css";
import { dellaRespira, italiana } from "../fonts";
import Projects from "./projects.client";
import { ProjectsResolution } from "./projects-resolution";
import { MeDependencies } from "../page";
import { LaurusPinResult, LaurusProjectResult } from "./projects.server";
import { useAccessToken } from "../hooks/useAccessToken";
import Skeleton from "../components/skeleton";

interface ProjectsBoot {
  laurusApi: string | undefined;
  projectsPromise: Promise<LaurusProjectResult[] | undefined>;
  effectCountsPromise: Promise<Map<string, number> | undefined>;
  mePromise: Promise<MeDependencies>;
  pinsPromise: Promise<LaurusPinResult[] | undefined>;
}
export default function ProjectsBoot({
  laurusApi,
  projectsPromise,
  effectCountsPromise,
  mePromise,
  pinsPromise,
}: ProjectsBoot) {
  const [resolution, setResolution] = useState<ProjectsResolution | undefined>(undefined);

  useEffect(() => {
    (() => {
      if (!resolution) setResolution(getScreenResolution());
    })();
  }, [resolution]);

  return resolution !== undefined ? (
    resolution.type != "low" ? (
      <Suspense fallback={<Skeleton />}>
        <ProjectsWithDependencies
          laurusApi={laurusApi}
          projectsPromise={projectsPromise}
          effectCountsPromise={effectCountsPromise}
          mePromise={mePromise}
          pinsPromise={pinsPromise}
          resolution={resolution}
        />
      </Suspense>
    ) : (
      <Forbidden resolution={resolution} />
    )
  ) : (
    <Skeleton />
  );
}

function ProjectsWithDependencies({
  laurusApi,
  projectsPromise,
  effectCountsPromise,
  mePromise,
  pinsPromise,
  resolution,
}: ProjectsBoot & { resolution: ProjectsResolution }) {
  const me = use(mePromise);
  useAccessToken(laurusApi, me.accessToken);
  const projects = use(projectsPromise);
  const effectCounts = use(effectCountsPromise);
  const pins = use(pinsPromise);

  return (
    <Projects
      apiOrigin={laurusApi}
      projects={projects ?? []}
      effectCounts={effectCounts ?? new Map()}
      resolution={resolution}
      me={me}
      pins={pins ?? []}
    />
  );
}

interface Forbidden {
  resolution: ProjectsResolution;
}
function Forbidden({ resolution }: Forbidden) {
  return (
    <div
      className={`${styles[`${resolution.type == "high" ? "noisy-background-16-2" : "noisy-background-16-2-low-res"}`]} ${dellaRespira.className}`}
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        placeContent: "center",
        letterSpacing: "1px",
      }}
    >
      <div style={{ display: "grid", width: "100%", padding: 24 }}>
        <div
          className={`${italiana.className}`}
          style={{
            justifySelf: "center",
            display: "flex",
            alignItems: "center",
            padding: "10px 0px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 54 }}>{resolution.value.width > 0 ? resolution.value.width : "[undefined]"}</p>
          <p style={{ fontSize: 38, padding: "0px 10px" }}>{"x"}</p>
          <p style={{ fontSize: 54 }}>{resolution.value.height > 0 ? resolution.value.height : "[undefined]"}</p>
          <p style={{ fontSize: 32, padding: "0px 16px" }}>{":("}</p>
        </div>
        <div
          style={{
            fontSize: 18,
            justifySelf: "center",
            padding: 4,
            marginTop: 10,
            textAlign: "center",
          }}
        >
          <div>{`Laurus is not designed for small screens.`}</div>
        </div>
      </div>
    </div>
  );
}
