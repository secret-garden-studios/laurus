import { useCallback, useContext, useState } from "react";
import { CoreContext, UIContext } from "../projects.client";
import { SvgRepo, add2300 } from "@/app/svg-repo";
import { dellaRespira } from "@/app/fonts";
import { LaurusProject, createProject } from "../projects.server";
import { RESOLUTION } from "@/app/landing.config";
import { CoreActionType, defaultProject } from "../states/core-state";

export default function Createbar() {
  const { coreState, coreDispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          input: {
            container: { width: 500, height: 50, padding: "0px 10px" },
            input: {
              letterSpacing: 2,
              fontSize: 13,
            },
          },
          brand: {
            svg: {
              width: 22,
              height: 22,
            },
          },
        };
      case "midhigh":
        return {
          input: {
            container: { width: 400, height: 44, padding: "0px 8px" },
            input: {
              letterSpacing: 2,
              fontSize: 11,
            },
          },
          brand: {
            svg: {
              width: 18,
              height: 18,
            },
          },
        };
      case "low":
      case "midlow":
        return {
          input: {
            container: { width: 360, height: 40, padding: "0px 8px" },
            input: {
              letterSpacing: 2,
              fontSize: 10,
            },
          },
          brand: {
            svg: {
              width: 18,
              height: 18,
            },
          },
        };
    }
  });

  const [newProjectTitle, setNewProjectTitle] = useState<string>("");

  const onCreateProjectClick = useCallback(async () => {
    const newFrame = (() => {
      switch (uiState.resolution.type) {
        case "high":
          return {
            width: Math.round(RESOLUTION.FRAME_WIDTH_4_5 * RESOLUTION.HIGH_FACTOR),
            height: Math.round(RESOLUTION.FRAME_HEIGHT_4_5 * RESOLUTION.HIGH_FACTOR),
          };
        case "midhigh":
          return {
            width: Math.round(RESOLUTION.FRAME_WIDTH_4_5 * RESOLUTION.MIDHIGH_FACTOR),
            height: Math.round(RESOLUTION.FRAME_HEIGHT_4_5 * RESOLUTION.MIDHIGH_FACTOR),
          };
        case "midlow":
          return {
            width: Math.round(RESOLUTION.FRAME_WIDTH_4_5 * RESOLUTION.MIDLOW_FACTOR),
            height: Math.round(RESOLUTION.FRAME_HEIGHT_4_5 * RESOLUTION.MIDLOW_FACTOR),
          };
        case "low":
          return {
            width: Math.round(RESOLUTION.FRAME_WIDTH_4_5 * RESOLUTION.LOW_FACTOR),
            height: Math.round(RESOLUTION.FRAME_HEIGHT_4_5 * RESOLUTION.LOW_FACTOR),
          };
      }
    })();
    const newProject: LaurusProject = {
      ...defaultProject,
      name: newProjectTitle || "untitled",
      frame_width: newFrame.width,
      frame_height: newFrame.height,
    };
    const response = await createProject(coreState.apiOrigin, coreState.accessToken, newProject);
    if (response) {
      coreDispatch({
        type: CoreActionType.SetProjects,
        value: [...coreState.projects, response],
      });
    }
  }, [
    coreDispatch,
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.projects,
    newProjectTitle,
    uiState.resolution.type,
  ]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: "2px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 10,
          ...dynamicSizes.input.container,
        }}
      >
        <input
          id={`new-project-title-input`}
          className={dellaRespira.className}
          placeholder="new project title..."
          style={{
            textAlign: "center",
            background: "none",
            color: "rgb(227, 227, 227)",
            border: "none",
            outline: "none",
            width: "100%",
            ...dynamicSizes.input.input,
          }}
          type="text"
          autoComplete="off"
          onKeyUp={(e) => {
            if (e.key == "Enter") {
              onCreateProjectClick();
            }
          }}
          autoFocus
          value={newProjectTitle}
          onChange={(e) => {
            setNewProjectTitle(e.target.value);
          }}
        />
        <SvgRepo
          title="create project"
          svg={add2300()}
          onContainerClick={onCreateProjectClick}
          containerStyle={{
            cursor: "pointer",
            width: dynamicSizes.brand.svg.width,
            height: "100%",
          }}
          scale={1}
          scaleToContaier={true}
        />
      </div>
    </div>
  );
}
