import { useContext, useState, useCallback, CSSProperties } from "react";
import { dellaRespira } from "../../fonts";
import { CoreContext, HoverContext, MaskContext, UIContext } from "../workspace.client";
import styles from "../../app.module.css";
import { addCircle, SvgRepo } from "../../svg-repo";
import { createMediaGroup, LaurusMediaGroup } from "../workspace.server";
import { updateProject, LaurusProjectResult } from "../../projects/projects.server";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";

export interface SelectionControlPanel {
  containerStyle?: CSSProperties;
}
export default function SelectionControlPanel({ containerStyle }: SelectionControlPanel) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { notifyMaskToolChanged } = useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const {
    selectedImgKeys,
    selectedSvgKeys,
    selectedMaskKeys,
    setSelectedImgKeys,
    setSelectedSvgKeys,
    setSelectedMaskKeys,
  } = useContext(HoverContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          padding: 10,
          selectedInputWidth: "2ch",
          selectedInputFontSize: 16,
          selectedLabelFontSize: 15,
          selectedInputGap: 2,
          mainSvg: 22,
          recordingLightSize: 15,
          input: {
            fontSize: 12,
            padding: 10,
          },
        };
      case "midhigh":
        return {
          padding: 10,
          selectedInputWidth: "2ch",
          selectedInputFontSize: 14,
          selectedLabelFontSize: 13,
          selectedInputGap: 2,
          mainSvg: 18,
          recordingLightSize: 12,
          input: {
            fontSize: 10,
            padding: 10,
          },
        };
      case "midlow":
      case "low":
        return {
          padding: 10,
          selectedInputWidth: "2ch",
          selectedInputFontSize: 12,
          selectedLabelFontSize: 11,
          selectedInputGap: 2,
          mainSvg: 18,
          recordingLightSize: 11,
          input: {
            fontSize: 10,
            padding: 10,
          },
        };
    }
  });

  const [mediaGroupDescription, setMediaGroupDescription] = useState<string>("");

  const onCreateMediaGroupClick = useCallback(async () => {
    if (!coreState.project.project_id) return;
    const mediaGroupsSnapshot = new Map(coreState.mediaGroups);
    const newMediaGroup: LaurusMediaGroup = {
      description: mediaGroupDescription,
      order: Math.max(-1, ...Array.from(mediaGroupsSnapshot.values()).flatMap((g) => g.order)) + 1,
      project_id: coreState.project.project_id,
      disabled: false,
    };

    const created = await createMediaGroup(coreState.apiOrigin, coreState.accessToken, newMediaGroup);
    if (created) {
      dispatch({ type: CoreActionType.SetMediaGroup, value: created, preserveCache: true });
      setMediaGroupDescription("");

      if (selectedImgKeys.size > 0 || selectedSvgKeys.size > 0 || selectedMaskKeys.size > 0) {
        const newImgs = new Map(coreState.project.imgs);
        selectedImgKeys.forEach((key) => {
          const img = newImgs.get(key);
          if (img) newImgs.set(key, { ...img, media_group_id: created.media_group_id });
        });
        const newSvgs = new Map(coreState.project.svgs);
        selectedSvgKeys.forEach((key) => {
          const svg = newSvgs.get(key);
          if (svg) newSvgs.set(key, { ...svg, media_group_id: created.media_group_id });
        });
        const newMasks = new Map(coreState.project.masks);
        selectedMaskKeys.forEach((key) => {
          const mask = newMasks.get(key);
          if (mask) newMasks.set(key, { ...mask, media_group_id: created.media_group_id });
        });
        const newProject: LaurusProjectResult = {
          ...coreState.project,
          imgs: newImgs,
          svgs: newSvgs,
          masks: newMasks,
        };
        const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (updated) {
          dispatch({ type: CoreActionType.SetProject, value: newProject });
          setSelectedImgKeys(new Set());
          setSelectedSvgKeys(new Set());
          setSelectedMaskKeys(new Set());
          if (uiState.tool.type === "marquee" && uiState.tool.duplicate) {
            const newTool = { ...uiState.tool, duplicate: false };
            uiDispatch({ type: UIActionType.SetTool, value: newTool });
            notifyMaskToolChanged(newTool.type);
          }
        }
      }
    }
  }, [
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.mediaGroups,
    coreState.project,
    dispatch,
    mediaGroupDescription,
    selectedImgKeys,
    selectedSvgKeys,
    selectedMaskKeys,
    setSelectedImgKeys,
    setSelectedSvgKeys,
    setSelectedMaskKeys,
    uiState.tool,
    uiDispatch,
    notifyMaskToolChanged,
  ]);

  return (
    <div
      style={{
        background: "rgba(23, 23, 23, 1)",
        padding: dynamicSizes.padding,
        display: "flex",
        width: "100%",
        height: "100%",
        justifyContent: "space-between",
        alignItems: "center",
        ...containerStyle,
      }}
    >
      <div title={"effect selection count"} style={{ display: "flex", gap: dynamicSizes.selectedInputGap }}>
        <input
          className={dellaRespira.className + " " + styles["numberInput"]}
          id={`fps-input`}
          type="text"
          disabled
          autoComplete="off"
          value={(selectedSvgKeys.size + selectedImgKeys.size + selectedMaskKeys.size).toString()}
          style={{
            textAlign: "center",
            background: "none",
            color: "rgb(227, 227, 227)",
            borderRadius: "2px",
            border: "none",
            outline: "none",
            lineHeight: "1",
            display: "inline-block",
            overflowX: "scroll",
            width: dynamicSizes.selectedInputWidth,
            fontSize: dynamicSizes.selectedInputFontSize,
          }}
        />
        <div
          style={{
            color: "rgba(255, 255, 255, 0.5)",
            userSelect: "none",
            fontSize: dynamicSizes.selectedLabelFontSize,
          }}
        >
          {<i>{"selected"}</i>}
        </div>
      </div>
      <input
        id={`new-effect-group-description-input`}
        className={dellaRespira.className}
        placeholder="new media group name..."
        style={{
          textAlign: "center",
          letterSpacing: "3px",
          background: "none",
          color: "rgb(227, 227, 227)",
          border: "none",
          outline: "none",
          width: "100%",
          ...dynamicSizes.input,
        }}
        type="text"
        autoComplete="off"
        onKeyUp={(e) => {
          if (e.key == "Enter") {
            onCreateMediaGroupClick();
          }
        }}
        value={mediaGroupDescription}
        onChange={(e) => {
          setMediaGroupDescription(e.target.value);
        }}
      />
      <SvgRepo
        title={"create media group"}
        svg={addCircle("rgba(200,200,200,1)")}
        scale={1}
        scaleToContaier={true}
        onContainerClick={onCreateMediaGroupClick}
        style={{
          cursor: "pointer",
        }}
        containerStyle={{
          cursor: "",
          width: dynamicSizes.mainSvg,
          height: dynamicSizes.mainSvg,
        }}
      />
    </div>
  );
}
