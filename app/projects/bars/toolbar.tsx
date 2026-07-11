import { useContext } from "react";
import ToolbarButton from "@/app/components/toolbar-button";
import { LaurusUserResult } from "@/app/landing.server";
import Navbar from "@/app/navbar";
import { CoreContext, UIContext } from "../projects.client";
import { add2200, keep200, sort200 } from "@/app/svg-repo";
import { UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

interface Toolbar {
  me: LaurusUserResult | undefined;
}
export default function Toolbar({ me }: Toolbar) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreDispatch } = useContext(CoreContext);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "min-content min-content auto",
        borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
        background: "rgba(31, 31, 31, 1)",
        width: "min-content",
        height: "100%",
        justifyContent: "center",
      }}
    >
      <Navbar resolution={{ ...uiState.resolution }} guest={!me} />
      <div
        style={{
          display: "grid",
          height: 16,
          width: "100%",
          alignContent: "center",
          justifyItems: "center",
        }}
      >
        <div
          style={{
            height: 1,
            borderRadius: 10,
            width: "25%",
            background: "rgba(255, 255, 255, 0.35)",
          }}
        />
      </div>
      {/* page tools */}
      <div>
        <ToolbarButton
          selected={uiState.tool.type == "create"}
          svg={{ svg: add2200(), scale: 0.6, cursor: "pointer" }}
          onClick={() => {
            coreDispatch({ type: CoreActionType.SetFilteredProjectIds, value: [] });
            if (uiState.tool.type != "create") {
              uiDispatch({
                type: UIActionType.SetTool,
                value: { type: "create" },
              });
            } else {
              uiDispatch({
                type: UIActionType.SetTool,
                value: { type: "none" },
              });
            }
          }}
          resolution={{ ...uiState.resolution }}
          title="create new project"
        />
        <ToolbarButton
          selected={uiState.tool.type == "pin"}
          svg={{ svg: keep200(), scale: 0.6, cursor: "pointer" }}
          onClick={() => {
            if (uiState.tool.type != "pin") {
              uiDispatch({
                type: UIActionType.SetTool,
                value: { type: "pin" },
              });
            } else {
              uiDispatch({
                type: UIActionType.SetTool,
                value: { type: "none" },
              });
            }
          }}
          resolution={{ ...uiState.resolution }}
          title="pin projects"
        />
        <ToolbarButton
          selected={uiState.tool.type == "sort"}
          svg={{ svg: sort200(), scale: 0.6, cursor: "pointer" }}
          onClick={() => {
            coreDispatch({ type: CoreActionType.SetFilteredProjectIds, value: [] });
            if (uiState.tool.type != "sort") {
              uiDispatch({
                type: UIActionType.SetTool,
                value: { type: "sort" },
              });
            } else {
              uiDispatch({
                type: UIActionType.SetTool,
                value: { type: "none" },
              });
            }
          }}
          resolution={{ ...uiState.resolution }}
          title="sort projects"
        />
      </div>
    </div>
  );
}
