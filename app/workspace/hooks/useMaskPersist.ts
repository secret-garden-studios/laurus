import { useCallback, useContext } from "react";
import { v4 as newUUID } from "uuid";
import { CoreContext, HoverContext, MaskContext, UIContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import {
  LaurusProjectImg,
  LaurusProjectMask,
  LaurusProjectResult,
  createProject,
  updateProject,
} from "@/app/projects/projects.server";
import { LaurusImgResult, LaurusMaskResult } from "../workspace.server";

export type MaskSourceFrame = Pick<LaurusProjectImg, "width" | "height" | "top" | "left" | "scale_x" | "scale_y">;

export function useMaskPersist() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { setSelectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  const { position, size } = mask;

  const persistMask = useCallback(
    (sourceFrame: MaskSourceFrame, result: LaurusMaskResult) => {
      const newKey = newUUID();
      const order =
        Math.max(
          -1,
          ...Array.from(coreState.project.imgs.values()).map((i) => i.order),
          ...Array.from(coreState.project.svgs.values()).map((s) => s.order),
          ...Array.from(coreState.project.masks.values()).map((v) => v.order),
        ) + 1;
      const projectMask: LaurusProjectMask = {
        media_id: result.mask_media_id,
        media_group_id: "",
        width: size.value && size.width !== undefined ? size.width : sourceFrame.width,
        height: size.value && size.height !== undefined ? size.height : sourceFrame.height,
        top: position.value && position.y !== undefined ? position.y : sourceFrame.top,
        left: position.value && position.x !== undefined ? position.x : sourceFrame.left,
        order,
        scale_x: sourceFrame.scale_x,
        scale_y: sourceFrame.scale_y,
        rotate_x: 0,
        rotate_y: 0,
        rotate_z: 0,
        rotate_angle: 0,
        capture_preview_size: mask.captureSize,
        capture_preview_intensity: mask.captureIntensity,
        capture_preview_falloff: mask.captureFalloff,
        capture_preview_darkness: mask.captureDarkness,
        texture: mask.textureMix,
        description: "",
      };

      const rollback: LaurusProjectResult = { ...coreState.project };
      const newMasks = new Map(coreState.project.masks);
      newMasks.set(newKey, projectMask);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };

      dispatch({ type: CoreActionType.SetCanvasMask, key: newKey, value: result });
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "mask", key: newKey } });
      // Peaks the server raised from detected edges arrive already saved on
      // the mask, so unlike createPeak's own path nothing has enrolled them
      // in the carousel yet -- without this they exist and render but have
      // no entry to select or wire an effect to.
      for (const peak of result.peaks) {
        uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "peak", key: newKey, peakId: peak.id } });
      }
      setSelectedMaskKeys(new Set([newKey]));

      (async () => {
        if (newProject.project_id) {
          const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
            ...newProject,
          });
          if (!updated) {
            dispatch({ type: CoreActionType.SetProject, value: rollback });
            dispatch({ type: CoreActionType.DeleteCanvasMask, key: newKey });
          }
        } else {
          const created = await createProject(coreState.apiOrigin, coreState.accessToken, { ...newProject });
          if (created) {
            dispatch({ type: CoreActionType.SetProject, value: { ...created } });
          } else {
            dispatch({ type: CoreActionType.SetProject, value: rollback });
            dispatch({ type: CoreActionType.DeleteCanvasMask, key: newKey });
          }
        }
      })();
    },
    [
      position,
      size,
      coreState.project,
      coreState.apiOrigin,
      coreState.accessToken,
      dispatch,
      uiDispatch,
      setSelectedMaskKeys,
      mask.captureSize,
      mask.captureIntensity,
      mask.captureFalloff,
      mask.captureDarkness,
      mask.textureMix,
    ],
  );

  const isMaskBusy = mask.status === "connecting" || mask.status === "streaming";

  const triggerMask = useCallback(
    (img: LaurusImgResult, sourceFrame: MaskSourceFrame) => {
      if (isMaskBusy) return;
      const initialTextureMix = mask.textureMix;
      mask.start(img, (result) => persistMask(sourceFrame, result), {
        elevation: uiState.stagedPeak.elevation,
        falloff: uiState.stagedPeak.falloff,
      });
      mask.setTextureMix(initialTextureMix);
    },
    [isMaskBusy, mask, persistMask, uiState.stagedPeak.elevation, uiState.stagedPeak.falloff],
  );

  return { triggerMask, isMaskBusy };
}
