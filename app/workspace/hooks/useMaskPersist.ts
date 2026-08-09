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

/**
 * Wraps the shared useMaskPreview instance (MaskContext) with the "run the mask, then persist its
 * result as a project mask" step that used to live entirely in Maskbar's own "mask" button --
 * pulled out so it's callable from wherever a source image and its target frame are known: an
 * already-placed project image's context menu, or a marquee-style drop of a still-unplaced
 * browser image straight onto the canvas.
 */
export function useMaskPersist() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiDispatch } = useContext(UIContext);
  const { setSelectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  const { position, size } = mask;

  // Called directly off the websocket's one and only "complete" message (see useMaskPreview's
  // start()) rather than watched for via a useEffect on mask.status -- an effect would re-fire
  // this every time a caller remounts and finds status still "done" from a prior run, with no
  // reliable way to tell "already saved" from "new" short of extra bookkeeping. Calling it once,
  // tied to the one real event, needs none.
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
        // Defaults to the source's own frame, so the result lands exactly on top of whatever it
        // came from -- overridden by Maskbar's position/size toggles when they're on.
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
        // Seeded from whatever the live preview was dialed to while streaming, so persisting
        // doesn't reset the look back to some unrelated default.
        light_source_size: mask.lightSourceSize,
        light_source_intensity: mask.lightSourceIntensity,
        light_source_falloff: mask.lightSourceFalloff,
        light_source_darkness: mask.lightSourceDarkness,
        texture: mask.textureMix,
        description: "",
      };

      const rollback: LaurusProjectResult = { ...coreState.project };
      const newMasks = new Map(coreState.project.masks);
      newMasks.set(newKey, projectMask);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };

      dispatch({ type: CoreActionType.SetCanvasMask, key: newKey, value: result });
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      // The whole mask earns its own carousel entry immediately, exactly like an img/svg does on
      // drop (see canvas.tsx's handleImgDrop/handleSvgDrop) -- wireable to move/scale/rotate via
      // maskElementsRef right away, unlike a capture's entry which only appears once first drawn
      // (captureMeshSection).
      uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "mask", key: newKey } });
      // Selects the just-placed mask immediately -- otherwise selectedMaskKey stays whatever it
      // was before masking (usually nothing), and the capture toggle/texture slider in Maskbar
      // (both gated on selectedMaskKey) stay disabled until the user manually alt-clicks the new
      // mask on canvas.
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
      mask.lightSourceSize,
      mask.lightSourceIntensity,
      mask.lightSourceFalloff,
      mask.lightSourceDarkness,
      mask.textureMix,
    ],
  );

  const isMaskBusy = mask.status === "connecting" || mask.status === "streaming";

  const triggerMask = useCallback(
    (img: LaurusImgResult, sourceFrame: MaskSourceFrame) => {
      if (isMaskBusy) return;
      // mask.start() always snaps textureMix back to TEXTURE_MIX_DEFAULT as part of clearing out
      // the previous run's mesh -- captured here and immediately reapplied so a value already
      // dialed in on Maskbar's texture slider (which, with nothing selected, edits mask.textureMix
      // directly) survives that reset and becomes this mesh's starting blend instead of being
      // silently discarded the moment masking begins.
      const initialTextureMix = mask.textureMix;
      mask.start(img, (result) => persistMask(sourceFrame, result));
      mask.setTextureMix(initialTextureMix);
    },
    [isMaskBusy, mask, persistMask],
  );

  return { triggerMask, isMaskBusy };
}
