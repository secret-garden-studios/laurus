import { createContext, useContext, useMemo, useReducer, useRef, useState } from "react";
import { ProjectsResolution } from "./projects-resolution";
import { LaurusPinResult, LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "./projects.server";
import { dellaRespira, italiana } from "../fonts";
import styles from "../app.module.css";
import Statusbar from "./bars/statusbar";
import { MeDependencies, ProjectDependencies } from "../page";
import Titlebar, { Subtitlebar } from "./bars/titlebar";
import Toolbar from "./bars/toolbar";
import { defaultUIState, SortValue, UIAction, uiContextReducer, UIState } from "./states/ui-state";
import { CoreAction, coreContextReducer, CoreState, defaultCoreState } from "./states/core-state";
import ContextMenu from "./context-menu";
import Searchbar from "./bars/searchbar";
import Sortbar from "./bars/sortbar";
import Createbar from "./bars/createbar";

export interface UIContextProps {
  uiState: UIState;
  uiDispatch: React.Dispatch<UIAction>;
}

export const UIContext = createContext<UIContextProps>({
  uiState: { ...defaultUIState },
  uiDispatch: () => {},
});

export interface CoreContextProps {
  coreState: CoreState;
  coreDispatch: React.Dispatch<CoreAction>;
}

export const CoreContext = createContext<CoreContextProps>({
  coreState: { ...defaultCoreState },
  coreDispatch: () => {},
});

interface InitReducer {
  arg1: ProjectDependencies[] | undefined;
  arg2: ProjectsResolution;
  arg3: string | undefined;
  arg4: string | undefined;
  arg5: LaurusPinResult[];
}

function initReducer({
  arg1: projectDependencies,
  arg2: resolution,
  arg3: apiOrigin,
  arg4: accessToken,
  arg5: pins,
}: InitReducer): { core: CoreState; ui: UIState } {
  const newProjects: LaurusProjectResult[] = projectDependencies
    ? projectDependencies.map((x) => {
        const newImgs: Map<string, LaurusProjectImg> = new Map(
          x.project.imgs.entries().map((e) => [e[0], { ...e[1] }]),
        );
        const newSvgs: Map<string, LaurusProjectSvg> = new Map(
          x.project.svgs.entries().map((e) => [e[0], { ...e[1] }]),
        );
        return {
          ...x.project,
          imgs: newImgs,
          svgs: newSvgs,
        };
      })
    : [];

  const newEffectsMetadata: Map<string, number> = projectDependencies
    ? new Map(
        projectDependencies.map((x) => [
          x.project.project_id,
          x.scales.length + x.moves.length + x.rotates.length + x.effectGroups.length,
        ]),
      )
    : new Map();

  const newPinsByProject: Map<string, LaurusPinResult> = new Map();
  pins.forEach((p) => {
    newPinsByProject.set(p.project_id, p);
  });

  return {
    core: {
      ...defaultCoreState,
      apiOrigin: apiOrigin,
      accessToken: accessToken,
      projects: newProjects,
      effectsMetadata: newEffectsMetadata,
      pinsByProject: newPinsByProject,
    },
    ui: {
      ...defaultUIState,
      resolution: resolution,
    },
  };
}

interface Projects {
  apiOrigin: string | undefined;
  projectDependencies: ProjectDependencies[];
  resolution: ProjectsResolution;
  me: MeDependencies;
  pins: LaurusPinResult[];
}
export default function Projects({ apiOrigin, projectDependencies, resolution: resolutionInit, me, pins }: Projects) {
  const [{ core: coreInit, ui: uiInit }] = useState(() => {
    return initReducer({
      arg1: projectDependencies,
      arg2: resolutionInit,
      arg3: apiOrigin,
      arg4: me.accessToken,
      arg5: pins,
    });
  });
  const [uiState, uiDispatch] = useReducer(uiContextReducer, uiInit);
  const [coreState, coreDispatch] = useReducer(coreContextReducer, coreInit);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          statusbar: {
            container: {
              minWidth: 2000,
            },
          },
        };
      case "midhigh":
        return {
          statusbar: {
            container: {
              minWidth: 1500,
            },
          },
        };
      case "low":
      case "midlow":
        return {
          statusbar: {
            container: {
              minWidth: 1400,
            },
          },
        };
    }
  });
  const uiContextValue = useMemo(() => ({ uiState, uiDispatch }), [uiState]);
  const coreContextValue = useMemo(() => ({ coreState, coreDispatch }), [coreState]);

  return (
    <>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          gridTemplateRows: "min-content min-content min-content 1fr min-content",
          gridTemplateColumns: "min-content 1fr min-content",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <UIContext value={uiContextValue}>
          <CoreContext value={coreContextValue}>
            {/* menubar */}
            <div
              style={{
                gridRow: "1",
                gridColumn: "1 / -1",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 1,
                  background: "rgba(255,255,255, 0.1)",
                }}
              />
            </div>
            <div
              style={{
                gridRow: "2",
                gridColumn: "1 / -1",
                zIndex: 1000,
              }}
            >
              <Titlebar />
            </div>
            <div
              style={{
                gridRow: "3",
                gridColumn: "2",
                zIndex: 1000,
                width: "100%",
              }}
            >
              <Subtitlebar />
            </div>
            {/* left panel */}
            <div
              style={{
                gridColumn: "1",
                gridRow: "3 / span 2",
                width: 1,
                height: "100%",
                background: "rgba(255, 255, 255, 0.05)",
              }}
            />
            {/*main content area*/}
            <div
              className={
                styles[`${resolutionInit.type == "high" ? "noisy-background-20-3" : "noisy-background-20-3-low-res"}`]
              }
              style={{
                gridColumn: "2",
                gridRow: "4",
                display: "grid",
              }}
            >
              <ProjectsBody />
            </div>
            <div style={{ gridColumn: "3", gridRow: "3 / span 2", zIndex: 1000 }}>
              <Toolbar me={me.me} />
            </div>
            <div
              style={{
                gridColumn: "1 / -1",
                gridRow: "5",
                zIndex: 1000,
                width: "100%",
                ...dynamicSizes.statusbar.container,
              }}
            >
              <Statusbar action={"laurus projects"} body={[]} />
            </div>
          </CoreContext>
        </UIContext>
      </div>
    </>
  );
}

function sortByNameAz(a: LaurusProjectResult, b: LaurusProjectResult) {
  return a.name.localeCompare(b.name);
}

function sortByNameZa(a: LaurusProjectResult, b: LaurusProjectResult) {
  return b.name.localeCompare(a.name);
}

function sortByCreatorAz(a: LaurusProjectResult, b: LaurusProjectResult) {
  return a.creator.localeCompare(b.creator);
}

function sortByCreatorZa(a: LaurusProjectResult, b: LaurusProjectResult) {
  return b.creator.localeCompare(a.creator);
}

function sortByTimestamp321(a: LaurusProjectResult, b: LaurusProjectResult) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function sortByTimestamp123(a: LaurusProjectResult, b: LaurusProjectResult) {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function sortByEditorAz(a: LaurusProjectResult, b: LaurusProjectResult) {
  return a.last_editor.localeCompare(b.last_editor);
}

function sortByEditorZa(a: LaurusProjectResult, b: LaurusProjectResult) {
  return b.last_editor.localeCompare(a.last_editor);
}

function sortByLastActive321(a: LaurusProjectResult, b: LaurusProjectResult) {
  return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
}

function sortByLastActive123(a: LaurusProjectResult, b: LaurusProjectResult) {
  return new Date(a.last_active).getTime() - new Date(b.last_active).getTime();
}

function sortProjects(
  projects: LaurusProjectResult[],
  pinsMap: Map<string, LaurusPinResult>,
  sort: SortValue,
): LaurusProjectResult[] {
  if (!pinsMap || pinsMap.size === 0) {
    return [...projects].sort((a, b) => {
      switch (sort) {
        case "name_az":
          return sortByNameAz(a, b);
        case "name_za":
          return sortByNameZa(a, b);
        case "timestamp_123":
          return sortByTimestamp123(a, b);
        case "timestamp_321":
          return sortByTimestamp321(a, b);
        case "last_active_321":
          return sortByLastActive321(a, b);
        case "last_active_123":
          return sortByLastActive123(a, b);
        case "creator_az":
          return sortByCreatorAz(a, b);
        case "creator_za":
          return sortByCreatorZa(a, b);
        case "editor_az":
          return sortByEditorAz(a, b);
        case "editor_za":
          return sortByEditorZa(a, b);
        case "none":
          return 0;
      }
    });
  }

  return [...projects].sort((a, b) => {
    const aPinned = pinsMap.has(a.project_id) ? 1 : 0;
    const bPinned = pinsMap.has(b.project_id) ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }
    switch (sort) {
      case "name_az":
        return sortByNameAz(a, b);
      case "name_za":
        return sortByNameZa(a, b);
      case "timestamp_123":
        return sortByTimestamp123(a, b);
      case "timestamp_321":
        return sortByTimestamp321(a, b);
      case "last_active_321":
        return sortByLastActive321(a, b);
      case "last_active_123":
        return sortByLastActive123(a, b);
      case "creator_az":
        return sortByCreatorAz(a, b);
      case "creator_za":
        return sortByCreatorZa(a, b);
      case "editor_az":
        return sortByEditorAz(a, b);
      case "editor_za":
        return sortByEditorZa(a, b);
      case "none":
        return 0;
    }
  });
}

function ProjectsBody() {
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          inputbar: {
            container: {
              height: 200,
            },
          },
          items: {
            container: {
              top: 200,
              bottom: 200,
            },
            container2: {
              gap: 50,
            },
          },
          contextMenu: {
            width: 420,
            height: 500,
          },
        };
      case "midhigh":
        return {
          inputbar: {
            container: {
              height: 160,
            },
          },
          items: {
            container: {
              top: 160,
              bottom: 160,
            },
            container2: {
              gap: 40,
            },
          },
          contextMenu: {
            width: 320,
            height: 400,
          },
        };
      case "low":
      case "midlow":
        return {
          inputbar: {
            container: {
              height: 120,
            },
          },
          items: {
            container: {
              top: 120,
              bottom: 100,
            },
            container2: {
              gap: 30,
            },
          },
          contextMenu: {
            width: 280,
            height: 360,
          },
        };
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const gridTemplateColumns = useMemo(() => {
    if (coreState.projects.length <= 1) {
      return "1fr";
    } else if (coreState.projects.length == 2) {
      return "1fr 1fr";
    } else {
      return "1fr 1fr 1fr";
    }
  }, [coreState.projects.length]);

  return (
    <div style={{ position: "relative" }}>
      {/* input bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          ...dynamicSizes.inputbar.container,
        }}
      >
        {(() => {
          switch (uiState.tool.type) {
            case "create":
              return <Createbar />;
            case "pin":
              return <Searchbar />;
            case "sort":
              return <Sortbar />;
            case "none":
              return <Searchbar />;
          }
        })()}
      </div>
      {/* items */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "grid",
          width: "100%",
          justifyContent: "center",
          alignContent: "start",
          overflowX: "auto",
          overflowY: "auto",
          ...dynamicSizes.items.container,
        }}
      >
        {coreState.projects.length > 0 ? (
          <div
            ref={scrollRef}
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns,
              ...dynamicSizes.items.container2,
            }}
          >
            {sortProjects(coreState.projects, coreState.pinsByProject, uiState.sort)
              .filter((p) => {
                return coreState.filteredProjectIds.length > 0
                  ? coreState.filteredProjectIds.includes(p.project_id)
                  : p;
              })
              .map((project) => {
                return (
                  <div key={project.project_id} style={{ ...dynamicSizes.contextMenu }}>
                    <ContextMenu
                      project={project}
                      width={dynamicSizes.contextMenu.width}
                      height={dynamicSizes.contextMenu.height}
                    />
                  </div>
                );
              })}
          </div>
        ) : (
          <div style={{ width: "100%" }}>
            <ProjectsBodySkeleton />
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectsBodySkeleton() {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          h1: { padding: "10px 0px" },
          title: { fontSize: 54 },
          sadFace: { fontSize: 32, padding: "0px 16px" },
          h2: { fontSize: 18, padding: 4, marginTop: 20, letterSpacing: 3 },
          svg: { padding: "0px 6px", size: 20 },
          h3: { fontSize: 12, padding: 4, marginTop: 20 },
        };
      case "midhigh":
        return {
          h1: { padding: "10px 0px" },
          title: { fontSize: 44 },
          sadFace: { fontSize: 22, padding: "0px 16px" },
          h2: { fontSize: 16, padding: 4, marginTop: 12, letterSpacing: 3 },
          svg: { padding: "0px 6px", size: 18 },
          h3: { fontSize: 11, padding: 4, marginTop: 8 },
        };
      case "midlow":
      case "low":
        return {
          h1: { padding: "10px 0px" },
          title: { fontSize: 44 },
          sadFace: { fontSize: 22, padding: "0px 16px" },
          h2: { fontSize: 16, padding: 4, marginTop: 12, letterSpacing: 3 },
          svg: { padding: "0px 6px", size: 18 },
          h3: { fontSize: 11, padding: 4, marginTop: 8 },
        };
    }
  });
  return (
    <>
      <div
        className={`${dellaRespira.className}`}
        style={{
          width: "100%",
          display: "grid",
          placeContent: "center",
          letterSpacing: "1px",
        }}
      >
        <div
          style={{
            display: "grid",
            width: "100%",
          }}
        >
          <div
            className={`${italiana.className}`}
            style={{
              ...dynamicSizes.h1,
              justifySelf: "center",
              display: "flex",
              alignItems: "center",
              fontWeight: "bold",
              color: "rgb(217, 217, 217)",
            }}
          >
            <p style={{ ...dynamicSizes.title }}>{"no projects"}</p>
            <p style={{ ...dynamicSizes.sadFace }}>{":("}</p>
          </div>
          <div
            style={{
              ...dynamicSizes.h2,
              justifySelf: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <p>
                Try using the <b>Create Tool</b>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
