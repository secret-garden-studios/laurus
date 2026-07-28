import { useContext, useState, useRef, useEffect } from "react";
import styles from "../../app.module.css";
import { dellaRespira } from "../../fonts";
import useDebounce from "../../hooks/useDebounce";
import { UIContext, CoreContext } from "../workspace.client";
import { updateProject, createProject, LaurusProjectResult } from "../../projects/projects.server";
import Mixbar from "./mixbar";
import Rotatebar from "./rotatebar";
import Scalebar from "./scalebar";
import Marqueebar from "./marqueebar";
import Viewportbar from "./viewportbar";
import { CoreActionType } from "../states/core-state";
import ContextMenubar from "./context-menubar";
import Movebar from "./movebar";
import {
  browse,
  dockToLeft200,
  dockToLeftFilled200,
  dockToRight200,
  dockToRightFilled200,
  SvgRepo,
} from "@/app/svg-repo";
import { UIActionType } from "../states/ui-state";

export default function Titlebar() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const [projectName, setProjectName] = useState<string>(coreState.project.name);
  const [projectNameSnapshot] = useState<string>(coreState.project.name);
  const projectNameHook = useDebounce<string>(projectName, 1000);
  const projectRef = useRef<LaurusProjectResult | undefined>(undefined);
  const projectTitleRef = useRef<HTMLInputElement>(null);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          container: { height: 50 },
          input: {
            fontSize: 13,
            padding: 10,
            letterSpacing: 3,
          },
          stats: {
            container: { fontSize: 11 },
            svg: {
              svg: { width: 24, height: 24 },
              container: {
                paddingRight: 10,
              },
            },
            left: {
              paddingLeft: 5,
            },
            center: {
              padding: "0 0px 0px 15px",
            },
            right: {
              padding: "0 15px 0px 15px",
            },
          },
        };
      case "midhigh":
        return {
          container: { height: 45 },
          input: {
            fontSize: 11,
            padding: 4,
            letterSpacing: 3,
          },
          stats: {
            container: {
              fontSize: 10,
            },
            svg: {
              svg: { width: 20, height: 20 },
              container: {
                paddingRight: 5,
              },
            },
            left: {
              paddingLeft: 5,
            },
            center: {
              padding: "0 0px 0px 10px",
            },
            right: {
              padding: "0 10px 0px 10px",
            },
          },
        };
      case "low":
      case "midlow":
        return {
          container: { height: 40 },
          input: {
            fontSize: 11,
            padding: 4,
            letterSpacing: 3,
          },
          stats: {
            container: {
              fontSize: 10,
            },
            svg: {
              svg: { width: 20, height: 20 },
              container: {
                paddingRight: 5,
              },
            },
            left: {
              paddingLeft: 5,
            },
            center: {
              padding: "0 0px 0px 10px",
            },
            right: {
              padding: "0 10px 0px 10px",
            },
          },
        };
    }
  });

  useEffect(() => {
    const renameProjectOnSever = async () => {
      if (projectRef.current && projectRef.current.project_id && projectRef.current.name && projectNameHook) {
        const newProject = { ...projectRef.current, name: projectNameHook };
        const updated = await updateProject(
          coreState.apiOrigin,
          coreState.accessToken,
          newProject.project_id,
          newProject,
        );
        if (updated) {
          dispatch({ type: CoreActionType.SetProject, value: newProject });
        } else {
          if (projectTitleRef.current) {
            projectTitleRef.current.value = projectNameSnapshot;
          }
        }
      } else if (projectRef.current && projectRef.current.name && projectNameHook) {
        const newProject = { ...projectRef.current, name: projectNameHook };
        const created = await createProject(coreState.apiOrigin, coreState.accessToken, newProject);
        if (created) {
          const newProject2: LaurusProjectResult = { ...created };
          dispatch({ type: CoreActionType.SetProject, value: newProject2 });
        } else {
          if (projectTitleRef.current) {
            projectTitleRef.current.value = projectNameSnapshot;
          }
        }
      }
    };

    renameProjectOnSever();
  }, [coreState.apiOrigin, projectNameHook, dispatch, coreState.accessToken, projectNameSnapshot]);

  const onProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    projectRef.current = { ...coreState.project, name: e.target.value };
    setProjectName(e.target.value);
  };

  return (
    <div
      style={{
        background: "rgba(28, 28, 28, 1)",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "auto min-content",
        alignContent: "center",
        overflowX: "auto",
        overflowY: "hidden",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        ...dynamicSizes.container,
      }}
    >
      {/* title */}
      <div
        style={{
          padding: "2px 0px",
        }}
      >
        <input
          ref={projectTitleRef}
          id={`project-name-input-${coreState.project.project_id}`}
          className={dellaRespira.className}
          placeholder="name me..."
          disabled={uiState.playbackMode.type != "stopped" ? true : false}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "none",
            color: "rgb(242, 242, 242)",
            textAlign: "center",
            border: "none",
            outline: "none",
            ...dynamicSizes.input,
          }}
          type="text"
          autoComplete="off"
          value={projectName}
          onChange={onProjectNameChange}
        />
      </div>
      {/* content stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          ...dynamicSizes.stats.container,
        }}
      >
        <div
          onClick={() => {
            uiDispatch({
              type: UIActionType.SetShowTimeline,
              value: !uiState.showTimeline,
            });
          }}
          style={{
            cursor: "pointer",
            display: "grid",
            placeContent: "center",
            width: "100%",
            height: "100%",
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            ...dynamicSizes.stats.svg.container,
          }}
        >
          <SvgRepo
            title={"toggle timeline panel"}
            svg={uiState.showTimeline ? dockToRightFilled200() : dockToRight200()}
            containerStyle={{
              cursor: "pointer",
              ...dynamicSizes.stats.svg.svg,
            }}
            scale={1}
            scaleToContaier={true}
          />
        </div>
        <div
          onClick={() => {
            uiDispatch({
              type: UIActionType.SetShowMediaBrowser,
              value: !uiState.showMediaBrowser,
            });
          }}
          style={{
            cursor: "pointer",
            display: "grid",
            placeContent: "center",
            width: "100%",
            height: "100%",
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            ...dynamicSizes.stats.svg.container,
          }}
        >
          <SvgRepo
            title={"toggle browser panel"}
            svg={uiState.showMediaBrowser ? dockToLeftFilled200() : dockToLeft200()}
            containerStyle={{
              cursor: "pointer",
              ...dynamicSizes.stats.svg.svg,
            }}
            scale={1}
            scaleToContaier={true}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: "1ch",
            ...dynamicSizes.stats.left,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              textShadow: "0 0 1px rgba(255, 255, 255, 1)",
            }}
          >
            {`${coreState.project.imgs.size}`}
          </div>
          <div>{`img`}</div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "1ch",
            ...dynamicSizes.stats.center,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              textShadow: "0 0 1px rgba(255, 255, 255, 1)",
            }}
          >
            {`${coreState.project.svgs.size}`}
          </div>
          <div>{`svg`}</div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "1ch",
            ...dynamicSizes.stats.right,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              textShadow: "0 0 1px rgba(255, 255, 255, 1)",
            }}
          >
            {`${coreState.effects.length}`}
          </div>
          <div>{`fx`}</div>
        </div>
      </div>
    </div>
  );
}

export function Subtitlebar() {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          container: {
            height: 45,
            fontSize: 14,
            padding: "0px 18px",
            letterSpacing: 0,
          },
        };
      case "midhigh":
        return {
          container: {
            height: 40,
            fontSize: 11,
            padding: "0px 12px",
            letterSpacing: 0,
          },
        };
      case "low":
      case "midlow":
        return {
          container: {
            height: 36,
            fontSize: 10,
            padding: "0px 0px 0px 10px",
            letterSpacing: 0,
          },
        };
    }
  });
  return (
    <>
      <div
        className={
          styles[`${uiState.resolution.type == "high" ? "noisy-background-23-2" : "noisy-background-23-2-low-res"}`]
        }
        style={{
          background: "rgba(23, 23, 23, 1)",
          display: "flex",
          alignItems: "center",
          color: "rgb(227, 227, 227)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          ...dynamicSizes.container,
        }}
      >
        {(() => {
          switch (uiState.tool.type) {
            case "marquee":
              return <Marqueebar />;
            case "none":
              return <Viewportbar />;
            case "contextmenu":
              return <ContextMenubar />;
            case "move":
              return <Movebar />;
            case "viewport":
              return <Viewportbar icon={browse()} />;
            case "scale":
              return <Scalebar />;
            case "rotate":
              return <Rotatebar />;
            case "mix":
              return <Mixbar />;
          }
        })()}
      </div>
    </>
  );
}
