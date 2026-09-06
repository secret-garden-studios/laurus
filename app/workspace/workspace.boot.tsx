"use client";
import { useState, Suspense, useEffect, use, ComponentProps } from "react";
import { WorkspaceResolution, getScreenResolution } from "./workspace.config";
import Workspace from "./workspace.client";
import styles from "../app.module.css";
import { dellaRespira, italiana } from "../fonts";
import { MeDependencies, ProjectDependencies } from "../page";
import { LaurusMediaGroupResult } from "./workspace.server";
import Skeleton from "../components/skeleton";

interface Forbidden {
  resolution: WorkspaceResolution;
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

interface WorkspaceBoot {
  laurusApi: string | undefined;
  mediaPageSizeInit: number;
  effectsEnum: Promise<string[] | undefined>;
  projectDependencies: Promise<ProjectDependencies | undefined>;
  mediaGroupsDependencies: Promise<LaurusMediaGroupResult[]>;
  mePromise: Promise<MeDependencies>;
}
export default function WorkspaceBoot({
  laurusApi,
  mediaPageSizeInit,
  effectsEnum,
  projectDependencies,
  mediaGroupsDependencies,
  mePromise,
}: WorkspaceBoot) {
  const [resolution, setResolution] = useState<WorkspaceResolution | undefined>(undefined);
  const timelineValues = [15, 30, 60, 90];
  const timelineUnits = ["sec", "min"];
  const mixableEffects = ["move"];

  useEffect(() => {
    (() => {
      if (!resolution) {
        setResolution(getScreenResolution());
      }
    })();
  }, [resolution]);

  return resolution !== undefined ? (
    resolution.type != "low" ? (
      <Suspense fallback={<Skeleton />}>
        <WorkspaceWithMe
          apiOriginInit={laurusApi}
          mediaPageSizeInit={mediaPageSizeInit}
          effectNamesInitPromise={effectsEnum}
          timelineValuesInit={timelineValues}
          timelineUnitsInit={timelineUnits}
          mixableEffectsInit={mixableEffects}
          projectInitPromise={projectDependencies}
          mediaGroupsInitPromise={mediaGroupsDependencies}
          resolutionInit={resolution}
          mePromise={mePromise}
        />
      </Suspense>
    ) : (
      <Forbidden resolution={resolution} />
    )
  ) : (
    <Skeleton />
  );
}

type WorkspaceWithMe = Omit<ComponentProps<typeof Workspace>, "me"> & {
  mePromise: Promise<MeDependencies>;
};

function WorkspaceWithMe({ mePromise, ...props }: WorkspaceWithMe) {
  const me = use(mePromise);
  return <Workspace {...props} me={me} />;
}
