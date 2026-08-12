import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { CoreActionType, PendingTopologyEdit } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { SvgRepo, addBox300, asterisk300, stairs300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { ParameterSliderX, ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import {
  MAX_MASK_PEAK_ELEVATION,
  MAX_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_RADIUS_PX,
} from "../mask-gl";
import { capturedRegionCircle, captureTriangleIndicesInCircle } from "../canvas-media/light-source-capture";
import { LaurusMaskResult } from "../workspace.server";
import {
  CAPTURE_DARKNESS_MAX,
  CAPTURE_FALLOFF_MAX,
  CAPTURE_INTENSITY_MAX,
  CAPTURE_SIZE_MAX,
} from "../workspace.config";

// Fixed baseline dial ranges for the "preview" dials (independent of any wired "light_source"
// effect's own math, which has its own separate max constants -- see CAPTURE_SIZE_MAX etc. in
// workspace.config.ts, used by the "capture" dials below instead).
const CAPTURE_PREVIEW_SIZE_MIN = 10;
const CAPTURE_PREVIEW_SIZE_MAX = 300;
const CAPTURE_PREVIEW_FALLOFF_MIN = 20;
const CAPTURE_PREVIEW_FALLOFF_MAX = 1000;

// Houses the dials that used to live in Maskbar -- moved out into their own tool/subtitlebar so
// they're reachable without the mask tool's position/size/capture controls crowding the same bar.
// Double-clicking the asterisk/box/stairs icon cycles the bar between three mutually exclusive
// dial sets (`target`, local-only UI state -- not persisted, purely which row of controls is
// showing): "preview" (the mesh-wide mouse-hover epicenter's own resting size/intensity/falloff/
// darkness), "capture" (an individual capture's own resting size/intensity/falloff/darkness), and
// "peak" (elevation/radius/falloff, moved over from Maskbar's own topology sliders).
//
// The "preview" dials edit ProjectMask_V1_0.capture_preview_* directly and persist via
// updateProject, exactly the way Scalebar edits an img/svg's own scale_x/scale_y -- the mesh-wide
// starting appearance for the mouse-hover "preview" toggle, independent of any effect. This bar
// never touches the mouse-driven epicenter's position, only its resting size/intensity/falloff/
// darkness.
//
// The "capture" dials edit the active capture's own Capture_V1_0.size/intensity/falloff/darkness
// directly via sendMaskCaptureUpdate -- the starting point a wired "light_source" effect's
// equation ramps FROM for that specific capture, the same way a "scale" effect ramps from
// scale_x/scale_y. Disambiguated from "preview" precisely so dialing in the mouse-hover preview
// never silently moves what every capture's own animation starts from (see Capture_V1_0's own doc
// comment). These dials have no rest-time rendering of their own -- unlike a peak's relief, a
// capture has never had an on-canvas representation from its own fields; dragging them only
// becomes visible once a light_source effect is wired to that capture and played back.
//
// The "peak" dials edit the active peak's own elevation/radius/falloff the same way Maskbar's
// topology sliders used to -- straight onto LaurusPeak via sendMaskPeakUpdate, no separate
// "starting state" of its own to distinguish from a wired equation the way a capture's own fields
// have (a peak already has a real shape the moment it's drawn).
//
// When no mask is selected yet (still mid-masking, nothing placed to persist to), the "preview"
// dials fall back to the live in-flight MaskContext preview instead -- unsaved, but lets the look
// be dialed in before there's a project mask entry to seed from (see Maskbar's persistMask). The
// "capture" dials have no such fallback: a capture must already exist on canvas (drawn via the
// mask tool's own capture gesture) before its own fields are editable.
//
// Neither the "preview" nor "peak" dial set requires a mask to be in HoverContext's own
// selectedMaskKeys -- an active capture or peak (meta-clicked directly on canvas, see
// project-mask-item.tsx's onClick hit-test) is enough on its own, since selectedMaskKeys and
// uiState.activeElement are separate, only loosely-coupled concerns and a meta-click never
// touches the former. selectedMaskKeys remains a fallback for the "preview" dials only, covering
// the "whole mask selected, no particular capture singled out" case -- a peak has no equivalent,
// so activeElement is the only thing that ever enables the "peak" dials, and likewise the only
// thing that ever enables the "capture" dials (which have no "whole mask selected" fallback
// either -- see above).
export default function LightSourcebar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const {
    coreState,
    dispatch,
    notifyMaskAppearanceChanged,
    notifyMaskLightSourcePreviewToggled,
    sendMaskCaptureUpdate,
    notifyMaskCaptureUpdated,
    notifyMaskPendingCaptureSet,
    notifyMaskPendingCaptureCleared,
    sendMaskPeakUpdate,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskPeaksUpdated,
  } = useContext(CoreContext);
  const { selectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  // Which row of dials the bar is currently showing -- cycled by double-clicking the icon (see
  // the JSX below). Not derived from uiState.tool/activeElement: it's purely a display mode for
  // this bar, independent of whatever tool Maskbar itself has active.
  const [target, setTarget] = useState<"preview" | "capture" | "peak">("preview");
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          svgSize: {
            width: 22,
            height: 22,
          },
          toggle: {
            div: {
              paddingLeft: 20,
              paddingRight: 20,
              gap: 12,
              fontSize: 13,
            },
            track: {
              width: 26,
              height: 12,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 8,
              height: 8,
            },
            translateX: 14,
          },
          paramSize: {
            containerHeight: 38,
            containerWidth: 190,
            capWidth: 17,
            capHeight: 17,
            capBorderOffset: 0,
            trackHeight: 1,
            tickHeight: 0,
            tickLeft: 2,
            svgSize: { width: 24, height: 24 },
          },
        };
      case "midhigh":
        return {
          svgSize: {
            width: 18,
            height: 18,
          },
          toggle: {
            div: {
              paddingLeft: 14,
              paddingRight: 14,
              gap: 8,
              fontSize: 12,
            },
            track: {
              width: 22,
              height: 10,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 6,
              height: 6,
            },
            translateX: 12,
          },
          paramSize: {
            capWidth: 13,
            capHeight: 13,
            capBorderOffset: 0,
            containerWidth: 170,
            containerHeight: 36,
            trackHeight: 1,
            tickHeight: 20,
            tickLeft: 1,
            svgSize: { width: 20, height: 20 },
          },
        };
      case "low":
      case "midlow":
        return {
          svgSize: {
            width: 20,
            height: 20,
          },
          toggle: {
            div: {
              paddingLeft: 16,
              paddingRight: 16,
              gap: 12,
              fontSize: 12,
            },
            track: {
              width: 20,
              height: 9,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 6,
              height: 6,
            },
            translateX: 10,
          },
          paramSize: {
            capWidth: 13,
            capHeight: 13,
            capBorderOffset: 0,
            containerWidth: 170,
            containerHeight: 36,
            trackHeight: 1,
            tickHeight: 20,
            tickLeft: 1,
            svgSize: { width: 20, height: 20 },
          },
        };
    }
  });

  // There's only something to tune once geometry is actually on screen -- same rule Maskbar's
  // texture slider used.
  const hasMesh = mask.status === "streaming" || mask.status === "done";
  const activeElement = uiState.activeElement;
  // An active capture (meta-clicked directly on canvas, see project-mask-item.tsx's onClick
  // hit-test) is enough on its own to edit its parent mask's capture_preview_* starting state --
  // independent of whether that mask also happens to be in selectedMaskKeys. The two are separate,
  // loosely-coupled concerns (HoverContext's own multi-select set vs. the single active element a
  // meta-click sets), and a meta-click never touches selectedMaskKeys itself, so requiring both
  // would leave these dials disabled for a capture that's plainly active. A selected mask (no
  // particular capture singled out) remains the fallback, preserving the old "select the mask
  // itself" path.
  const activeCaptureMaskKey = activeElement?.type === "capture" ? activeElement.key : undefined;
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const targetMaskKey = activeCaptureMaskKey ?? selectedMaskKey;
  const targetMaskMeta = targetMaskKey !== undefined ? coreState.project.masks.get(targetMaskKey) : undefined;
  const isPreviewControlsDisabled = !(targetMaskKey !== undefined || hasMesh);

  // The active capture -- mirrors activePeak below, and likewise has no "whole mask selected"
  // fallback: a capture has no equivalent of a peak's "staged shape" either, so being the active
  // element is the only thing that ever enables these dials.
  const activeCaptureMaskData = activeCaptureMaskKey !== undefined ? coreState.canvasMasks.get(activeCaptureMaskKey) : undefined;
  const activeCapture =
    activeElement?.type === "capture" ? activeCaptureMaskData?.captures.find((c) => c.id === activeElement.captureId) : undefined;
  const isCaptureParamDisabled = !activeCapture;

  // The active peak -- mirrors activeCaptureMaskKey above, and likewise doesn't require
  // selectedMaskKeys: a peak has no "whole mask selected" equivalent to fall back to, so being the
  // active element is the only thing that ever enables these.
  const activePeakMaskKey = activeElement?.type === "peak" ? activeElement.key : undefined;
  const activePeakMaskData = activePeakMaskKey !== undefined ? coreState.canvasMasks.get(activePeakMaskKey) : undefined;
  const activePeak =
    activeElement?.type === "peak" ? activePeakMaskData?.peaks.find((p) => p.id === activeElement.peakId) : undefined;
  const isTopologyOn = uiState.tool.type === "mask" && uiState.tool.editingTopology;
  // Enabled whenever there's a peak to edit -- either one is the active element, or the topology
  // tool is on, in which case with no peak active these instead read/write uiState.stagedPeak, the
  // shape the *next* circle-drag will create a peak at.
  const isPeakParamDisabled = !activePeak && !isTopologyOn;
  const elevationValue = activePeak?.elevation ?? uiState.stagedPeak.elevation;
  const peakFalloffValue = activePeak?.falloff ?? uiState.stagedPeak.falloff;
  // Radius is the one peak parameter with nothing to stage: the circle-drag that creates a peak is
  // what defines it (see stagedPeak, ui-state.ts), so with no active peak there is genuinely
  // nothing for this slider to point at and it stays disabled even while the topology tool is on.
  const radiusValue = activePeak?.radius;
  const isRadiusDisabled = !activePeak;

  // The latest not-yet-sent project state, plus whether a save is currently in flight -- refs, not
  // state, so a burst of drag events can coalesce onto the newest value without waiting on a
  // render. Persisting used to gate new edits behind `isSaving` and drop whatever slider events
  // arrived while a save was in flight; a fast drag fires far more onNewCursor events than the
  // network round-trip can keep up with, so most of a drag's updates -- including its final,
  // released-mouse value -- got silently discarded, leaving the preview parked on an earlier
  // value. Now every edit always applies locally (see savePreviewField below) and only the
  // network persistence coalesces: whichever value is newest when a save completes goes out next.
  const pendingPreviewSaveRef = useRef<LaurusProjectResult | null>(null);
  const isPersistingPreviewRef = useRef(false);
  const persistPreviewQueue = useCallback(async () => {
    if (isPersistingPreviewRef.current) return;
    isPersistingPreviewRef.current = true;
    try {
      while (pendingPreviewSaveRef.current) {
        const projectToSave = pendingPreviewSaveRef.current;
        pendingPreviewSaveRef.current = null;
        const saved = await updateProject(coreState.apiOrigin, coreState.accessToken, projectToSave.project_id, {
          ...projectToSave,
        });
        if (!saved) {
          console.error("failed to save preview change", { project_id: projectToSave.project_id });
        }
      }
    } finally {
      isPersistingPreviewRef.current = false;
    }
  }, [coreState.apiOrigin, coreState.accessToken]);

  const savePreviewField = useCallback(
    (
      field: "capture_preview_size" | "capture_preview_intensity" | "capture_preview_falloff" | "capture_preview_darkness",
      value: number,
    ) => {
      if (targetMaskKey === undefined) return;
      const maskMeta = coreState.project.masks.get(targetMaskKey);
      if (!maskMeta) return;

      const newMasks = new Map(coreState.project.masks);
      const newMaskMeta: LaurusProjectMask = { ...maskMeta, [field]: value };
      newMasks.set(targetMaskKey, newMaskMeta);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      // Passed directly rather than left for the mesh to re-read off coreState: this fires
      // synchronously, before React has re-rendered ProjectMaskItem with the just-dispatched
      // project, so a re-read here would still see the previous value (see
      // MaskAppearanceOverride's own comment in project-mask-item.tsx).
      notifyMaskAppearanceChanged(targetMaskKey, {
        capture: {
          size: newMaskMeta.capture_preview_size,
          intensity: newMaskMeta.capture_preview_intensity,
          falloff: newMaskMeta.capture_preview_falloff,
          darkness: newMaskMeta.capture_preview_darkness,
        },
      });

      pendingPreviewSaveRef.current = newProject;
      void persistPreviewQueue();
    },
    [targetMaskKey, coreState.project, dispatch, notifyMaskAppearanceChanged, persistPreviewQueue],
  );

  const previewSizeValue = targetMaskMeta ? targetMaskMeta.capture_preview_size : mask.captureSize;
  const handlePreviewSizeChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("capture_preview_size", value);
      } else {
        mask.setCaptureSize(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewIntensityValue = targetMaskMeta ? targetMaskMeta.capture_preview_intensity : mask.captureIntensity;
  const handlePreviewIntensityChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("capture_preview_intensity", value);
      } else {
        mask.setCaptureIntensity(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewFalloffValue = targetMaskMeta ? targetMaskMeta.capture_preview_falloff : mask.captureFalloff;
  const handlePreviewFalloffChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("capture_preview_falloff", value);
      } else {
        mask.setCaptureFalloff(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewDarknessValue = targetMaskMeta ? targetMaskMeta.capture_preview_darkness : mask.captureDarkness;
  const handlePreviewDarknessChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("capture_preview_darkness", value);
      } else {
        mask.setCaptureDarkness(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );

  // Same coalescing-queue persistence as pendingPreviewSaveRef above, one full-replace capture
  // record (name/polygon_indices carried through unchanged, since sendMaskCaptureUpdate is a
  // full-replace of the whole record -- see MaskCaptureUpdateRequest_V1_0) per queued edit.
  interface PendingCaptureSave {
    maskKey: string;
    maskMediaId: string;
    captureId: number;
    name: string;
    polygonIndices: number[];
    size: number;
    intensity: number;
    falloff: number;
    darkness: number;
    // Whether this write changed the capture's membership and so left an optimistic highlight
    // behind for the queue to take down once it drains -- true only for a resize (see
    // saveCaptureSizeField). An intensity/falloff/darkness edit publishes no highlight, and
    // clearing one it never set could take down a highlight some other flow (a relocate drag)
    // legitimately owns.
    resized: boolean;
  }
  const pendingCaptureSaveRef = useRef<PendingCaptureSave | null>(null);
  const isPersistingCaptureRef = useRef(false);
  const persistCaptureQueue = useCallback(async () => {
    if (isPersistingCaptureRef.current) return;
    isPersistingCaptureRef.current = true;
    let settledResizeMaskKey: string | undefined;
    try {
      while (pendingCaptureSaveRef.current) {
        const toSave = pendingCaptureSaveRef.current;
        pendingCaptureSaveRef.current = null;
        if (toSave.resized) settledResizeMaskKey = toSave.maskKey;
        const updated = await sendMaskCaptureUpdate(toSave.maskMediaId, {
          capture_id: toSave.captureId,
          name: toSave.name,
          polygon_indices: toSave.polygonIndices,
          size: toSave.size,
          intensity: toSave.intensity,
          falloff: toSave.falloff,
          darkness: toSave.darkness,
        });
        if (updated) {
          dispatch({ type: CoreActionType.SetCanvasMask, key: toSave.maskKey, value: updated });
          notifyMaskCaptureUpdated(toSave.maskKey, updated);
        } else {
          console.error("failed to save capture change", { capture_id: toSave.captureId });
        }
      }
    } finally {
      isPersistingCaptureRef.current = false;
      // Only once every queued write has drained -- clearing after each individual request would
      // flash back to the last confirmed size between mid-drag ticks. Same reasoning (and same
      // shape) as persistPeakQueue's own settled clear below.
      if (settledResizeMaskKey !== undefined) {
        dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
        notifyMaskPendingCaptureCleared(settledResizeMaskKey);
      }
    }
  }, [sendMaskCaptureUpdate, dispatch, notifyMaskCaptureUpdated, notifyMaskPendingCaptureCleared]);

  const saveCaptureField = useCallback(
    (field: "size" | "intensity" | "falloff" | "darkness", value: number) => {
      if (activeCaptureMaskKey === undefined || !activeCapture || !activeCaptureMaskData) return;
      const patched = { ...activeCapture, [field]: value };
      // Applies locally first, same as savePreviewField/savePeakField above -- instant slider
      // feedback, with only the network write left to coalesce (see persistCaptureQueue).
      const newCaptures = activeCaptureMaskData.captures.map((c) => (c.id === activeCapture.id ? patched : c));
      const newMaskData: LaurusMaskResult = { ...activeCaptureMaskData, captures: newCaptures };
      dispatch({ type: CoreActionType.SetCanvasMask, key: activeCaptureMaskKey, value: newMaskData });

      // Current polygon membership, preserved unchanged -- these three edits never move or resize
      // the capture, and sendMaskCaptureUpdate is a full-replace, so omitting it would clear the
      // capture's own triangle tagging. Mirrors project-mask-item.tsx's own originalIndices
      // derivation. `size` doesn't come through here at all -- it *does* change membership, so it
      // has its own path (see saveCaptureSizeField below).
      const polygonIndices = activeCaptureMaskData.polygons.reduce<number[]>((acc, p, i) => {
        if (p.capture_id === activeCapture.id) acc.push(i);
        return acc;
      }, []);
      pendingCaptureSaveRef.current = {
        maskKey: activeCaptureMaskKey,
        maskMediaId: activeCaptureMaskData.mask_media_id,
        captureId: activeCapture.id,
        name: activeCapture.name,
        polygonIndices,
        size: patched.size,
        intensity: patched.intensity,
        falloff: patched.falloff,
        darkness: patched.darkness,
        resized: false,
      };
      void persistCaptureQueue();
    },
    [activeCaptureMaskKey, activeCapture, activeCaptureMaskData, dispatch, persistCaptureQueue],
  );

  // The centre a resize grows/shrinks around, frozen for the duration of one slider drag.
  // Re-deriving it per tick would drift: capturedRegionCircle reconstructs the centre from
  // whichever triangles are *currently* members, so each resize would move the centre slightly and
  // the capture would visibly crawl across the mesh over a single drag. Captured on the first tick
  // instead, and released once the drag commits.
  const captureResizeAnchorRef = useRef<{ captureId: number; cx: number; cy: number } | null>(null);
  const captureResizeAnchor = useCallback(() => {
    if (!activeCapture || !activeCaptureMaskData) return undefined;
    const held = captureResizeAnchorRef.current;
    if (held && held.captureId === activeCapture.id) return held;
    const circle = capturedRegionCircle(activeCaptureMaskData.polygons, activeCapture.id);
    if (!circle) return undefined;
    const anchor = { captureId: activeCapture.id, cx: circle.cx, cy: circle.cy };
    captureResizeAnchorRef.current = anchor;
    return anchor;
  }, [activeCapture, activeCaptureMaskData]);

  // Which triangles a capture of this diameter would own, centred on the frozen anchor above.
  // `size` is a diameter in the mesh's own space (the same space the polygons' own `d` strings and
  // captureTriangleIndicesInCircle work in), so this is the identical membership test the original
  // circle-drag ran -- resizing by slider and resizing by redrawing land on the same answer.
  //
  // Undefined when the circle would own nothing: an empty polygon_indices is the server's own
  // "delete this capture" signal (see MaskCaptureUpdate), so a slider dragged to zero would
  // silently destroy the capture rather than just shrink it. Callers treat undefined as "refuse
  // this value" and leave the capture untouched.
  const captureIndicesForSize = useCallback(
    (size: number): number[] | undefined => {
      if (!activeCaptureMaskData) return undefined;
      const anchor = captureResizeAnchor();
      if (!anchor) return undefined;
      const indices = captureTriangleIndicesInCircle(activeCaptureMaskData.polygons, {
        cx: anchor.cx,
        cy: anchor.cy,
        radius: size / 2,
      });
      return indices.size === 0 ? undefined : [...indices];
    },
    [activeCaptureMaskData, captureResizeAnchor],
  );

  // Mid-drag: repaint the mesh highlight at the size being dragged through, without committing or
  // persisting anything. Mirrors previewPeakChange's own role for the peak sliders -- the optimistic
  // highlight is exactly the mechanism a relocate drag already uses (project-mask-item.tsx's
  // onPointerMove), so a resize reads as the same gesture.
  const previewCaptureSizeChange = useCallback(
    (size: number) => {
      if (activeCaptureMaskKey === undefined) return;
      const polygonIndices = captureIndicesForSize(size);
      if (!polygonIndices) return;
      notifyMaskPendingCaptureSet(activeCaptureMaskKey, new Set(polygonIndices));
    },
    [activeCaptureMaskKey, captureIndicesForSize, notifyMaskPendingCaptureSet],
  );

  // Commits a resize: the new `size` *and* the membership it implies, in one full-replace write.
  // Both have to go together -- `size` is the capture's own geometry now, so persisting one without
  // the other would leave the lit core and the triangles it owns describing different circles.
  const saveCaptureSizeField = useCallback(
    (size: number) => {
      if (activeCaptureMaskKey === undefined || !activeCapture || !activeCaptureMaskData) return;
      const polygonIndices = captureIndicesForSize(size);
      // Refused rather than clamped: there's no obvious "smallest legal size" to snap to (it
      // depends on how dense this mesh's triangles are around this particular centre), and the
      // slider re-reads its position from the capture on the next render, so declining simply
      // leaves the thumb where the capture actually is. Takes down whatever highlight the drag's
      // own mid-flight previews left behind on the way down -- nothing is being committed, so the
      // mesh has to fall back to the capture's real membership rather than the last legal size
      // dragged through.
      if (!polygonIndices) {
        captureResizeAnchorRef.current = null;
        notifyMaskPendingCaptureCleared(activeCaptureMaskKey);
        return;
      }

      const patched = { ...activeCapture, size };
      const newCaptures = activeCaptureMaskData.captures.map((c) => (c.id === activeCapture.id ? patched : c));
      const newMaskData: LaurusMaskResult = { ...activeCaptureMaskData, captures: newCaptures };
      dispatch({ type: CoreActionType.SetCanvasMask, key: activeCaptureMaskKey, value: newMaskData });
      // Held until the write lands, same reasoning as the relocate drag's own pending capture:
      // clearing it now would fall back to the mesh's still-stale capture_id tags and flash the
      // old size back for the round trip.
      dispatch({
        type: CoreActionType.SetPendingLightSourceCapture,
        value: { maskKey: activeCaptureMaskKey, captureId: activeCapture.id, polygonIndices },
      });
      notifyMaskPendingCaptureSet(activeCaptureMaskKey, new Set(polygonIndices));

      pendingCaptureSaveRef.current = {
        maskKey: activeCaptureMaskKey,
        maskMediaId: activeCaptureMaskData.mask_media_id,
        captureId: activeCapture.id,
        name: activeCapture.name,
        polygonIndices,
        size: patched.size,
        intensity: patched.intensity,
        falloff: patched.falloff,
        darkness: patched.darkness,
        resized: true,
      };
      captureResizeAnchorRef.current = null;
      void persistCaptureQueue();
    },
    [
      activeCaptureMaskKey,
      activeCapture,
      activeCaptureMaskData,
      captureIndicesForSize,
      dispatch,
      notifyMaskPendingCaptureSet,
      notifyMaskPendingCaptureCleared,
      persistCaptureQueue,
    ],
  );

  const captureSizeValue = activeCapture?.size ?? 0;
  const captureIntensityValue = activeCapture?.intensity ?? 0;
  const handleCaptureIntensityChange = useCallback(
    (value: number) => saveCaptureField("intensity", value),
    [saveCaptureField],
  );
  const captureFalloffValue = activeCapture?.falloff ?? 0;
  const handleCaptureFalloffChange = useCallback(
    (value: number) => saveCaptureField("falloff", value),
    [saveCaptureField],
  );
  const captureDarknessValue = activeCapture?.darkness ?? 0;
  const handleCaptureDarknessChange = useCallback(
    (value: number) => saveCaptureField("darkness", value),
    [saveCaptureField],
  );

  // Which of a peak's own shape parameters an edit is changing. A partial rather than a whole peak
  // because each slider is an independent control that only knows its own value -- the rest are
  // merged from whatever the active peak currently carries (see mergePeakPatch below). Moved over
  // from Maskbar verbatim, alongside the sliders that drive it.
  type PeakPatch = { elevation?: number; radius?: number; falloff?: number };

  interface PendingPeakSave {
    maskKey: string;
    maskMediaId: string;
    peakId: number;
    cx: number;
    cy: number;
    radius: number;
    elevation: number;
    falloff: number;
    polygonIndices: number[];
  }
  // Same coalescing-queue persistence as pendingPreviewSaveRef above -- every edit previews
  // instantly (see savePeakField's own notifyMaskPendingTopologySet), and only the network write to
  // the peak's own socket coalesces: whichever value is newest when a send completes goes out next,
  // rather than a debounce timer dropping mid-drag ticks or racing an in-flight request. Also what
  // keeps useMaskPeakSockets' id-less FIFO reply pairing sound, since it awaits each send before
  // issuing the next.
  const pendingPeakSaveRef = useRef<PendingPeakSave | null>(null);
  const isPersistingPeakRef = useRef(false);
  const persistPeakQueue = useCallback(async () => {
    if (isPersistingPeakRef.current) return;
    isPersistingPeakRef.current = true;
    let settledMaskKey: string | undefined;
    try {
      while (pendingPeakSaveRef.current) {
        const toSave = pendingPeakSaveRef.current;
        pendingPeakSaveRef.current = null;
        settledMaskKey = toSave.maskKey;
        const updated = await sendMaskPeakUpdate(toSave.maskMediaId, {
          peak_id: toSave.peakId,
          cx: toSave.cx,
          cy: toSave.cy,
          radius: toSave.radius,
          elevation: toSave.elevation,
          falloff: toSave.falloff,
          remove: false,
          polygon_indices: toSave.polygonIndices,
        });
        if (updated) {
          dispatch({ type: CoreActionType.SetCanvasMask, key: toSave.maskKey, value: updated });
          notifyMaskPeaksUpdated(toSave.maskKey, updated);
        } else {
          console.error("failed to save peak change", { peak_id: toSave.peakId });
        }
      }
    } finally {
      isPersistingPeakRef.current = false;
      // Only clear the optimistic preview once every queued write has drained -- clearing it after
      // each individual request instead would flash back to whatever the last confirmed server
      // state was between mid-drag ticks.
      if (settledMaskKey !== undefined) {
        dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
        notifyMaskPendingTopologyCleared(settledMaskKey);
      }
    }
  }, [sendMaskPeakUpdate, dispatch, notifyMaskPeaksUpdated, notifyMaskPendingTopologyCleared]);

  // One patched-onto-the-active-peak edit, as both the shader wants it (a complete set of the peak's
  // field parameters, since a partial one would render the peak with a parameter missing rather than
  // pending) and the wire wants it. Shared by savePeakField and previewPeakChange so the preview and
  // the commit can't disagree about what a patch means.
  const mergePeakPatch = useCallback(
    (patch: PeakPatch): PendingTopologyEdit | undefined => {
      if (activePeakMaskKey === undefined || !activePeak) return undefined;
      return {
        maskKey: activePeakMaskKey,
        peakId: activePeak.id,
        cx: activePeak.cx,
        cy: activePeak.cy,
        radius: patch.radius ?? activePeak.radius,
        elevation: patch.elevation ?? activePeak.elevation,
        falloff: patch.falloff ?? activePeak.falloff,
      };
    },
    [activePeakMaskKey, activePeak],
  );

  const savePeakField = useCallback(
    (patch: PeakPatch) => {
      const edit = mergePeakPatch(patch);
      if (!edit) {
        // No peak is active -- this just stages the shape the next circle-drag creates a peak at (see
        // canvas.tsx's handleTopologyCapture), nothing on the mesh to preview or persist yet. A radius
        // in the patch is ignored here on purpose: the drag itself defines that (see stagedPeak).
        uiDispatch({
          type: UIActionType.SetStagedPeak,
          value: { elevation: patch.elevation, falloff: patch.falloff },
        });
        return;
      }
      const maskData = coreState.canvasMasks.get(edit.maskKey);
      if (!maskData) return;

      dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
      notifyMaskPendingTopologySet(edit.maskKey, edit);

      pendingPeakSaveRef.current = {
        maskKey: edit.maskKey,
        maskMediaId: maskData.mask_media_id,
        peakId: edit.peakId,
        cx: edit.cx,
        cy: edit.cy,
        radius: edit.radius,
        elevation: edit.elevation,
        falloff: edit.falloff,
        // Derived from the *merged* circle rather than the peak's current one: a radius edit changes
        // which polygons fall inside it, so reusing the old membership would leave the peak's own
        // polygon tagging describing a circle it no longer has. Only bookkeeping (highlighting) rides
        // on it -- the field itself never reads it -- but the highlight would visibly disagree with
        // the dome.
        polygonIndices: [
          ...captureTriangleIndicesInCircle(maskData.polygons, {
            cx: edit.cx,
            cy: edit.cy,
            radius: edit.radius,
          }),
        ],
      };
      void persistPeakQueue();
    },
    [mergePeakPatch, coreState.canvasMasks, dispatch, notifyMaskPendingTopologySet, uiDispatch, persistPeakQueue],
  );

  // Trackpad-drag live preview, mirroring the capture dials' own instant-apply split (onCursorMove
  // fires continuously while dragging; onNewCursor only once on release). With an active peak this
  // drives the mesh's live relief preview directly, skipping savePeakField's own dispatch/persist --
  // no benefit to committing/persisting on every mid-drag pixel when release will commit the settled
  // value anyway. With no active peak there's nothing on the mesh to preview, so this just keeps the
  // staged value (and so the slider's own displayed position) current as it drags.
  const previewPeakChange = useCallback(
    (patch: PeakPatch) => {
      const edit = mergePeakPatch(patch);
      if (edit) {
        notifyMaskPendingTopologySet(edit.maskKey, edit);
      } else {
        uiDispatch({
          type: UIActionType.SetStagedPeak,
          value: { elevation: patch.elevation, falloff: patch.falloff },
        });
      }
    },
    [mergePeakPatch, notifyMaskPendingTopologySet, uiDispatch],
  );

  const elevationTrackRef = useRef<HTMLDivElement | null>(null);
  const [elevationCursor, setElevationCursor] = useState({ x: 0, y: 0 });
  // Elevation is signed -- a negative peak is a dent, the same dome inverted -- but useTrackpadState
  // only ever produces 0..maxValue (its getTrackValue floors at a non-negative minValue). So the
  // signed range rides on a track twice as long, offset by half: the midpoint is elevation 0, the
  // left half craters and the right half domes. Paired with ParameterSliderXPlusMinus so the -/+
  // ends of the track read correctly.
  const elevationSpan = MAX_MASK_PEAK_ELEVATION * 2;
  const { getTrackValue: getElevationValue, getTrackCursor: getElevationCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    elevationSpan,
  );
  const elevationFromTrack = useCallback(
    (cursorX: number, trackWidth: number) => getElevationValue(cursorX, trackWidth, 0) - MAX_MASK_PEAK_ELEVATION,
    [getElevationValue],
  );
  const elevationToTrack = useCallback(
    (value: number, trackWidth: number) => getElevationCursor(value + MAX_MASK_PEAK_ELEVATION, trackWidth),
    [getElevationCursor],
  );
  useEffect(() => {
    if (!elevationTrackRef.current) return;
    setElevationCursor({ x: elevationToTrack(elevationValue, elevationTrackRef.current.clientWidth), y: 0 });
  }, [elevationValue, elevationToTrack]);

  const radiusTrackRef = useRef<HTMLDivElement | null>(null);
  const [radiusCursor, setRadiusCursor] = useState({ x: 0, y: 0 });
  // Unlike elevation, a radius genuinely *is* a length in the mesh's own coordinate space, so its
  // ceiling scales with the mask: the smaller of the two dimensions, so the largest authorable peak
  // is one that spans the mesh's narrow axis. Floored at MIN_MASK_PEAK_RADIUS_PX, which is why the
  // track spans the difference and the value adds the floor back -- dragging to the very end of the
  // track can't produce the degenerate zero radius the height field divides by.
  const radiusMax = activePeakMaskData
    ? Math.max(MIN_MASK_PEAK_RADIUS_PX + 1, Math.min(activePeakMaskData.width, activePeakMaskData.height))
    : MIN_MASK_PEAK_RADIUS_PX + 1;
  const { getTrackValue: getRadiusValue, getTrackCursor: getRadiusCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    radiusMax - MIN_MASK_PEAK_RADIUS_PX,
  );
  useEffect(() => {
    if (!radiusTrackRef.current || radiusValue === undefined) return;
    const newCursor = getRadiusCursor(radiusValue - MIN_MASK_PEAK_RADIUS_PX, radiusTrackRef.current.clientWidth);
    setRadiusCursor({ x: newCursor, y: 0 });
  }, [radiusValue, getRadiusCursor]);

  const peakFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [peakFalloffCursor, setPeakFalloffCursor] = useState({ x: 0, y: 0 });
  // Same floor-plus-span arrangement as radius, for the profile exponent's own
  // MIN..MAX_MASK_PEAK_FALLOFF range -- at the low end a peak meets flat mesh with a visible crease
  // ring, at the high end it's a needle. See MIN_MASK_PEAK_FALLOFF for why the floor isn't 0.
  const peakFalloffSpan = MAX_MASK_PEAK_FALLOFF - MIN_MASK_PEAK_FALLOFF;
  const { getTrackValue: getPeakFalloffValue, getTrackCursor: getPeakFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    peakFalloffSpan,
  );
  useEffect(() => {
    if (!peakFalloffTrackRef.current) return;
    const newCursor = getPeakFalloffCursor(
      peakFalloffValue - MIN_MASK_PEAK_FALLOFF,
      peakFalloffTrackRef.current.clientWidth,
    );
    setPeakFalloffCursor({ x: newCursor, y: 0 });
  }, [peakFalloffValue, getPeakFalloffCursor]);

  const previewSizeTrackRef = useRef<HTMLDivElement | null>(null);
  const [previewSizeCursor, setPreviewSizeCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getPreviewSizeValue, getTrackCursor: getPreviewSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_PREVIEW_SIZE_MAX - CAPTURE_PREVIEW_SIZE_MIN,
  );
  useEffect(() => {
    if (!previewSizeTrackRef.current) return;
    const newCursor = getPreviewSizeCursor(
      previewSizeValue - CAPTURE_PREVIEW_SIZE_MIN,
      previewSizeTrackRef.current.clientWidth,
    );
    setPreviewSizeCursor({ x: newCursor, y: 0 });
  }, [previewSizeValue, getPreviewSizeCursor]);

  const previewIntensityTrackRef = useRef<HTMLDivElement | null>(null);
  const [previewIntensityCursor, setPreviewIntensityCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getPreviewIntensityValue, getTrackCursor: getPreviewIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  useEffect(() => {
    if (!previewIntensityTrackRef.current) return;
    const newCursor = getPreviewIntensityCursor(previewIntensityValue, previewIntensityTrackRef.current.clientWidth);
    setPreviewIntensityCursor({ x: newCursor, y: 0 });
  }, [previewIntensityValue, getPreviewIntensityCursor]);

  const previewFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [previewFalloffCursor, setPreviewFalloffCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getPreviewFalloffValue, getTrackCursor: getPreviewFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_PREVIEW_FALLOFF_MAX - CAPTURE_PREVIEW_FALLOFF_MIN,
  );
  useEffect(() => {
    if (!previewFalloffTrackRef.current) return;
    const newCursor = getPreviewFalloffCursor(
      previewFalloffValue - CAPTURE_PREVIEW_FALLOFF_MIN,
      previewFalloffTrackRef.current.clientWidth,
    );
    setPreviewFalloffCursor({ x: newCursor, y: 0 });
  }, [previewFalloffValue, getPreviewFalloffCursor]);

  const previewDarknessTrackRef = useRef<HTMLDivElement | null>(null);
  const [previewDarknessCursor, setPreviewDarknessCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getPreviewDarknessValue, getTrackCursor: getPreviewDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  useEffect(() => {
    if (!previewDarknessTrackRef.current) return;
    const newCursor = getPreviewDarknessCursor(previewDarknessValue, previewDarknessTrackRef.current.clientWidth);
    setPreviewDarknessCursor({ x: newCursor, y: 0 });
  }, [previewDarknessValue, getPreviewDarknessCursor]);

  // A capture's size is a diameter in the mesh's own coordinate space, so its ceiling scales with
  // the mask rather than sitting at a fixed constant: a capture spanning the mesh's narrow axis is
  // the largest one worth authoring, past which it just owns every triangle. Exactly the rule
  // radiusMax above uses for a peak, for the same reason. Falls back to the fixed authoring max
  // (used by the equation sliders in light-source-unit.tsx) with no mesh to measure against.
  const captureSizeMax = activeCaptureMaskData
    ? Math.min(activeCaptureMaskData.width, activeCaptureMaskData.height)
    : CAPTURE_SIZE_MAX;
  const captureSizeTrackRef = useRef<HTMLDivElement | null>(null);
  const [captureSizeCursor, setCaptureSizeCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getCaptureSizeValue, getTrackCursor: getCaptureSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    captureSizeMax,
  );
  useEffect(() => {
    if (!captureSizeTrackRef.current) return;
    const newCursor = getCaptureSizeCursor(captureSizeValue, captureSizeTrackRef.current.clientWidth);
    setCaptureSizeCursor({ x: newCursor, y: 0 });
  }, [captureSizeValue, getCaptureSizeCursor]);

  const captureIntensityTrackRef = useRef<HTMLDivElement | null>(null);
  const [captureIntensityCursor, setCaptureIntensityCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getCaptureIntensityValue, getTrackCursor: getCaptureIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_INTENSITY_MAX,
  );
  useEffect(() => {
    if (!captureIntensityTrackRef.current) return;
    const newCursor = getCaptureIntensityCursor(captureIntensityValue, captureIntensityTrackRef.current.clientWidth);
    setCaptureIntensityCursor({ x: newCursor, y: 0 });
  }, [captureIntensityValue, getCaptureIntensityCursor]);

  // Mesh-space too, for the same reason size is (the glow reaches out from the core in the mesh's
  // own units, so it has to scale with the mask the way the core does) -- but measured from the
  // core's rim rather than across it, so the mesh's narrow axis is a reasonable reach rather than
  // a diameter's worth of it.
  const captureFalloffMax = activeCaptureMaskData
    ? Math.min(activeCaptureMaskData.width, activeCaptureMaskData.height)
    : CAPTURE_FALLOFF_MAX;
  const captureFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [captureFalloffCursor, setCaptureFalloffCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getCaptureFalloffValue, getTrackCursor: getCaptureFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    captureFalloffMax,
  );
  useEffect(() => {
    if (!captureFalloffTrackRef.current) return;
    const newCursor = getCaptureFalloffCursor(captureFalloffValue, captureFalloffTrackRef.current.clientWidth);
    setCaptureFalloffCursor({ x: newCursor, y: 0 });
  }, [captureFalloffValue, getCaptureFalloffCursor]);

  const captureDarknessTrackRef = useRef<HTMLDivElement | null>(null);
  const [captureDarknessCursor, setCaptureDarknessCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getCaptureDarknessValue, getTrackCursor: getCaptureDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_DARKNESS_MAX,
  );
  useEffect(() => {
    if (!captureDarknessTrackRef.current) return;
    const newCursor = getCaptureDarknessCursor(captureDarknessValue, captureDarknessTrackRef.current.clientWidth);
    setCaptureDarknessCursor({ x: newCursor, y: 0 });
  }, [captureDarknessValue, getCaptureDarknessCursor]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        height: "100%",
        overflowX: "auto",
      }}
    >
      <div
        title={
          target === "peak"
            ? "targeting peaks -- double-click for the preview"
            : target === "capture"
              ? "targeting captures -- double-click for peaks"
              : "targeting the preview -- double-click for captures"
        }
        onDoubleClick={() => setTarget(target === "preview" ? "capture" : target === "capture" ? "peak" : "preview")}
        style={{ display: "grid", placeContent: "center", cursor: "pointer" }}
      >
        <SvgRepo
          svg={target === "peak" ? stairs300() : target === "capture" ? addBox300() : asterisk300()}
          containerStyle={{
            width: dynamicSizes.svgSize.width,
            height: dynamicSizes.svgSize.height,
          }}
          scale={1}
          scaleToContaier={true}
        />
      </div>
      <div
        title={
          uiState.lightSourcePreview
            ? "mousing over a mesh drives its light source epicenter"
            : "mousing over a mesh no longer drives its light source epicenter"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span
          style={{
            textShadow: uiState.lightSourcePreview ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
          }}
        >
          {"preview"}
        </span>
        <Toggle
          value={uiState.lightSourcePreview}
          onClick={() => {
            uiDispatch({ type: UIActionType.SetLightSourcePreview, value: !uiState.lightSourcePreview });
            notifyMaskLightSourcePreviewToggled(!uiState.lightSourcePreview);
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      {target === "preview" ? (
        <>
          <div
            title={
              isPreviewControlsDisabled
                ? "select or generate a mesh to set the size of its epicenter's bright core"
                : "size of the epicenter's bright core, in on-screen pixels"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1 }}>{"size"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|preview-size`}
              size={dynamicSizes.paramSize}
              containerRef={previewSizeTrackRef}
              cursor={previewSizeCursor}
              onNewCursor={(newCursor) => {
                setPreviewSizeCursor({ ...newCursor, y: 0 });
                if (!previewSizeTrackRef.current) return;
                const newValue =
                  getPreviewSizeValue(newCursor.x, previewSizeTrackRef.current.clientWidth, 0) + CAPTURE_PREVIEW_SIZE_MIN;
                handlePreviewSizeChange(newValue);
              }}
              disabled={isPreviewControlsDisabled}
            />
          </div>
          <div
            title={
              isPreviewControlsDisabled
                ? "select or generate a mesh to set the brightness of its epicenter's core"
                : "brightness of the epicenter's core -- 100% is pure white"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1 }}>{"intensity"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|preview-intensity`}
              size={dynamicSizes.paramSize}
              containerRef={previewIntensityTrackRef}
              cursor={previewIntensityCursor}
              onNewCursor={(newCursor) => {
                setPreviewIntensityCursor({ ...newCursor, y: 0 });
                if (!previewIntensityTrackRef.current) return;
                const newValue = getPreviewIntensityValue(newCursor.x, previewIntensityTrackRef.current.clientWidth, 0);
                handlePreviewIntensityChange(newValue);
              }}
              disabled={isPreviewControlsDisabled}
            />
          </div>
          <div
            title={
              isPreviewControlsDisabled
                ? "select or generate a mesh to set how far its darkening falloffs out beyond the core"
                : "distance the darkening takes to falloff out beyond the core, in on-screen pixels -- independent of canvas size"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1 }}>{"falloff"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|preview-falloff`}
              size={dynamicSizes.paramSize}
              containerRef={previewFalloffTrackRef}
              cursor={previewFalloffCursor}
              onNewCursor={(newCursor) => {
                setPreviewFalloffCursor({ ...newCursor, y: 0 });
                if (!previewFalloffTrackRef.current) return;
                const newValue =
                  getPreviewFalloffValue(newCursor.x, previewFalloffTrackRef.current.clientWidth, 0) +
                  CAPTURE_PREVIEW_FALLOFF_MIN;
                handlePreviewFalloffChange(newValue);
              }}
              disabled={isPreviewControlsDisabled}
            />
          </div>
          <div
            title={
              isPreviewControlsDisabled
                ? "select or generate a mesh to set the strength of its darkening at the far edge of the falloff"
                : "strength of the darkening at the far edge of the falloff -- 100% drives it fully to black"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1 }}>{"darkness"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|preview-darkness`}
              size={dynamicSizes.paramSize}
              containerRef={previewDarknessTrackRef}
              cursor={previewDarknessCursor}
              onNewCursor={(newCursor) => {
                setPreviewDarknessCursor({ ...newCursor, y: 0 });
                if (!previewDarknessTrackRef.current) return;
                const newValue = getPreviewDarknessValue(newCursor.x, previewDarknessTrackRef.current.clientWidth, 0);
                handlePreviewDarknessChange(newValue);
              }}
              disabled={isPreviewControlsDisabled}
            />
          </div>
        </>
      ) : target === "capture" ? (
        <>
          <div
            title={
              isCaptureParamDisabled
                ? "meta-click a capture on the mesh to resize it"
                : "how wide this capture is -- resizes the region of triangles it owns, and with it the epicenter core a wired light_source effect ramps from"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isCaptureParamDisabled ? 0.3 : 1 }}>{"size"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${activeCaptureMaskKey ?? "lightsourcebar"}|capture-size|${activeCapture?.id ?? "none"}`}
              size={dynamicSizes.paramSize}
              containerRef={captureSizeTrackRef}
              cursor={captureSizeCursor}
              onCursorMove={(newCursor) => {
                if (!captureSizeTrackRef.current) return;
                const newValue = getCaptureSizeValue(newCursor.x, captureSizeTrackRef.current.clientWidth, 0);
                previewCaptureSizeChange(newValue);
              }}
              onNewCursor={(newCursor) => {
                setCaptureSizeCursor({ ...newCursor, y: 0 });
                if (!captureSizeTrackRef.current) return;
                const newValue = getCaptureSizeValue(newCursor.x, captureSizeTrackRef.current.clientWidth, 0);
                saveCaptureSizeField(newValue);
              }}
              disabled={isCaptureParamDisabled}
            />
          </div>
          <div
            title={
              isCaptureParamDisabled
                ? "meta-click a capture on the mesh to set the brightness of its own epicenter's core"
                : "brightness of this capture's own epicenter core -- 100% is pure white"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isCaptureParamDisabled ? 0.3 : 1 }}>{"intensity"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${activeCaptureMaskKey ?? "lightsourcebar"}|capture-intensity|${activeCapture?.id ?? "none"}`}
              size={dynamicSizes.paramSize}
              containerRef={captureIntensityTrackRef}
              cursor={captureIntensityCursor}
              onNewCursor={(newCursor) => {
                setCaptureIntensityCursor({ ...newCursor, y: 0 });
                if (!captureIntensityTrackRef.current) return;
                const newValue = getCaptureIntensityValue(newCursor.x, captureIntensityTrackRef.current.clientWidth, 0);
                handleCaptureIntensityChange(newValue);
              }}
              disabled={isCaptureParamDisabled}
            />
          </div>
          <div
            title={
              isCaptureParamDisabled
                ? "meta-click a capture on the mesh to set how far its own darkening falloffs out beyond the core"
                : "distance this capture's own darkening takes to falloff out beyond the core, in on-screen pixels"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isCaptureParamDisabled ? 0.3 : 1 }}>{"falloff"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${activeCaptureMaskKey ?? "lightsourcebar"}|capture-falloff|${activeCapture?.id ?? "none"}`}
              size={dynamicSizes.paramSize}
              containerRef={captureFalloffTrackRef}
              cursor={captureFalloffCursor}
              onNewCursor={(newCursor) => {
                setCaptureFalloffCursor({ ...newCursor, y: 0 });
                if (!captureFalloffTrackRef.current) return;
                const newValue = getCaptureFalloffValue(newCursor.x, captureFalloffTrackRef.current.clientWidth, 0);
                handleCaptureFalloffChange(newValue);
              }}
              disabled={isCaptureParamDisabled}
            />
          </div>
          <div
            title={
              isCaptureParamDisabled
                ? "meta-click a capture on the mesh to set the strength of its own darkening at the far edge of the falloff"
                : "strength of this capture's own darkening at the far edge of the falloff -- 100% drives it fully to black"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isCaptureParamDisabled ? 0.3 : 1 }}>{"darkness"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${activeCaptureMaskKey ?? "lightsourcebar"}|capture-darkness|${activeCapture?.id ?? "none"}`}
              size={dynamicSizes.paramSize}
              containerRef={captureDarknessTrackRef}
              cursor={captureDarknessCursor}
              onNewCursor={(newCursor) => {
                setCaptureDarknessCursor({ ...newCursor, y: 0 });
                if (!captureDarknessTrackRef.current) return;
                const newValue = getCaptureDarknessValue(newCursor.x, captureDarknessTrackRef.current.clientWidth, 0);
                handleCaptureDarknessChange(newValue);
              }}
              disabled={isCaptureParamDisabled}
            />
          </div>
        </>
      ) : (
        <>
          <div
            title={
              isPeakParamDisabled
                ? "enable topology to set the elevation new peaks are drawn at, or adjust the active one"
                : activePeak
                  ? "the active peak's own elevation -- negative dents the surface inward. drag a circle elsewhere on the mesh to place another"
                  : "the elevation the next circle you drag out will be created at -- negative dents the surface inward"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPeakParamDisabled ? 0.3 : 1 }}>{"elevation"}</span>
            <ParameterSliderXPlusMinus
              resolution={{ ...uiState.resolution }}
              hash={`${activePeakMaskKey ?? "lightsourcebar"}|elevation|${activePeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={elevationTrackRef}
              cursor={elevationCursor}
              onCursorMove={(newCursor) => {
                if (!elevationTrackRef.current) return;
                previewPeakChange({
                  elevation: elevationFromTrack(newCursor.x, elevationTrackRef.current.clientWidth),
                });
              }}
              onNewCursor={(newCursor) => {
                setElevationCursor({ ...newCursor, y: 0 });
                if (!elevationTrackRef.current) return;
                savePeakField({
                  elevation: elevationFromTrack(newCursor.x, elevationTrackRef.current.clientWidth),
                });
              }}
              disabled={isPeakParamDisabled}
            />
          </div>
          <div
            title={
              isRadiusDisabled
                ? "select a peak to resize it -- a new peak's radius comes from the circle you drag out"
                : "how far the active peak's own influence reaches"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isRadiusDisabled ? 0.3 : 1 }}>{"radius"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${activePeakMaskKey ?? "lightsourcebar"}|radius|${activePeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={radiusTrackRef}
              cursor={radiusCursor}
              onCursorMove={(newCursor) => {
                if (!radiusTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_RADIUS_PX + getRadiusValue(newCursor.x, radiusTrackRef.current.clientWidth, 0);
                previewPeakChange({ radius: newValue });
              }}
              onNewCursor={(newCursor) => {
                setRadiusCursor({ ...newCursor, y: 0 });
                if (!radiusTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_RADIUS_PX + getRadiusValue(newCursor.x, radiusTrackRef.current.clientWidth, 0);
                savePeakField({ radius: newValue });
              }}
              disabled={isRadiusDisabled}
            />
          </div>
          <div
            title={
              isPeakParamDisabled
                ? "enable topology to shape the profile new peaks are drawn with, or adjust the active one"
                : "the active peak's own profile -- low is a broad dome with a visible rim, high is a needle"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPeakParamDisabled ? 0.3 : 1 }}>{"falloff"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${activePeakMaskKey ?? "lightsourcebar"}|peak-falloff|${activePeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={peakFalloffTrackRef}
              cursor={peakFalloffCursor}
              onCursorMove={(newCursor) => {
                if (!peakFalloffTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_FALLOFF + getPeakFalloffValue(newCursor.x, peakFalloffTrackRef.current.clientWidth, 0);
                previewPeakChange({ falloff: newValue });
              }}
              onNewCursor={(newCursor) => {
                setPeakFalloffCursor({ ...newCursor, y: 0 });
                if (!peakFalloffTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_FALLOFF + getPeakFalloffValue(newCursor.x, peakFalloffTrackRef.current.clientWidth, 0);
                savePeakField({ falloff: newValue });
              }}
              disabled={isPeakParamDisabled}
            />
          </div>
        </>
      )}
    </div>
  );
}
