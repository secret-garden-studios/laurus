import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { CoreActionType, PendingTopologyEdit } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { SvgRepo, asterisk300, stairs300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { ParameterSliderX, ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import {
  MAX_MASK_PEAK_ELEVATION,
  MAX_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_RADIUS_PX,
} from "../mask-gl";
import { captureTriangleIndicesInCircle } from "../canvas-media/light-source-capture";

// Fixed baseline dial ranges (independent of any wired "light_source" effect's own math, which
// has its own separate max constants -- see LIGHT_SOURCE_SIZE_MAX etc. in workspace.config.ts).
const LIGHT_SOURCE_SIZE_MIN = 10;
const LIGHT_SOURCE_SIZE_MAX = 300;
const LIGHT_SOURCE_FALLOFF_MIN = 20;
const LIGHT_SOURCE_FALLOFF_MAX = 1000;

// Houses the dials that used to live in Maskbar -- moved out into their own tool/subtitlebar so
// they're reachable without the mask tool's position/size/capture controls crowding the same bar.
// Double-clicking the asterisk flips the whole bar between two mutually exclusive dial sets
// (`target`, local-only UI state -- not persisted, purely which row of controls is showing):
// "capture" (the original four: size/intensity/falloff/darkness) and "peak" (elevation/radius/
// falloff, moved over from Maskbar's own topology sliders).
//
// The "capture" dials edit ProjectMask_V1_0.light_source_* directly and persist via
// updateProject, exactly the way Scalebar edits an img/svg's own scale_x/scale_y -- the mask's
// starting light source appearance, independent of any "light_source" effect. A wired effect's
// equation ramps FROM this starting point over time the same way a "scale" effect ramps from
// scale_x/scale_y; this bar never touches that equation. The "peak" dials edit the active peak's
// own elevation/radius/falloff the same way Maskbar's topology sliders used to -- straight onto
// LaurusPeak via sendMaskPeakUpdate, no separate "starting state" of its own to distinguish from a
// wired equation the way a capture's light_source_* fields have.
//
// When no mask is selected yet (still mid-masking, nothing placed to persist to), the "capture"
// dials fall back to the live in-flight MaskContext preview instead -- unsaved, but lets the look
// be dialed in before there's a project mask entry to seed from (see Maskbar's persistMask).
//
// Neither dial set requires a mask to be in HoverContext's own selectedMaskKeys -- an active
// capture or peak (meta-clicked directly on canvas, see project-mask-item.tsx's onClick hit-test)
// is enough on its own, since selectedMaskKeys and uiState.activeElement are separate, only
// loosely-coupled concerns and a meta-click never touches the former. selectedMaskKeys remains a
// fallback for the "capture" dials only, covering the "whole mask selected, no particular capture
// singled out" case -- a peak has no equivalent, so activeElement is the only thing that ever
// enables the "peak" dials.
export default function LightSourcebar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const {
    coreState,
    dispatch,
    notifyMaskAppearanceChanged,
    notifyMaskLightSourcePreviewToggled,
    sendMaskPeakUpdate,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskPeaksUpdated,
  } = useContext(CoreContext);
  const { selectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  // Which row of dials the bar is currently showing -- toggled by double-clicking the asterisk
  // (see the JSX below). Not derived from uiState.tool/activeElement: it's purely a display mode
  // for this bar, independent of whatever tool Maskbar itself has active.
  const [target, setTarget] = useState<"capture" | "peak">("capture");
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
  // hit-test) is enough on its own to edit its parent mask's light_source_* starting state --
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
  const isLightSourceControlsDisabled = !(targetMaskKey !== undefined || hasMesh);

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
  // value. Now every edit always applies locally (see saveLightSourceField below) and only the
  // network persistence coalesces: whichever value is newest when a save completes goes out next.
  const pendingLightSourceSaveRef = useRef<LaurusProjectResult | null>(null);
  const isPersistingLightSourceRef = useRef(false);
  const persistLightSourceQueue = useCallback(async () => {
    if (isPersistingLightSourceRef.current) return;
    isPersistingLightSourceRef.current = true;
    try {
      while (pendingLightSourceSaveRef.current) {
        const projectToSave = pendingLightSourceSaveRef.current;
        pendingLightSourceSaveRef.current = null;
        const saved = await updateProject(coreState.apiOrigin, coreState.accessToken, projectToSave.project_id, {
          ...projectToSave,
        });
        if (!saved) {
          console.error("failed to save light source change", { project_id: projectToSave.project_id });
        }
      }
    } finally {
      isPersistingLightSourceRef.current = false;
    }
  }, [coreState.apiOrigin, coreState.accessToken]);

  const saveLightSourceField = useCallback(
    (
      field: "light_source_size" | "light_source_intensity" | "light_source_falloff" | "light_source_darkness",
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
        lightSource: {
          size: newMaskMeta.light_source_size,
          intensity: newMaskMeta.light_source_intensity,
          falloff: newMaskMeta.light_source_falloff,
          darkness: newMaskMeta.light_source_darkness,
        },
      });

      pendingLightSourceSaveRef.current = newProject;
      void persistLightSourceQueue();
    },
    [targetMaskKey, coreState.project, dispatch, notifyMaskAppearanceChanged, persistLightSourceQueue],
  );

  const lightSourceSizeValue = targetMaskMeta ? targetMaskMeta.light_source_size : mask.lightSourceSize;
  const handleLightSourceSizeChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        saveLightSourceField("light_source_size", value);
      } else {
        mask.setLightSourceSize(value);
      }
    },
    [targetMaskMeta, saveLightSourceField, mask],
  );
  const lightSourceIntensityValue = targetMaskMeta ? targetMaskMeta.light_source_intensity : mask.lightSourceIntensity;
  const handleLightSourceIntensityChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        saveLightSourceField("light_source_intensity", value);
      } else {
        mask.setLightSourceIntensity(value);
      }
    },
    [targetMaskMeta, saveLightSourceField, mask],
  );
  const lightSourceFalloffValue = targetMaskMeta ? targetMaskMeta.light_source_falloff : mask.lightSourceFalloff;
  const handleLightSourceFalloffChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        saveLightSourceField("light_source_falloff", value);
      } else {
        mask.setLightSourceFalloff(value);
      }
    },
    [targetMaskMeta, saveLightSourceField, mask],
  );
  const lightSourceDarknessValue = targetMaskMeta ? targetMaskMeta.light_source_darkness : mask.lightSourceDarkness;
  const handleLightSourceDarknessChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        saveLightSourceField("light_source_darkness", value);
      } else {
        mask.setLightSourceDarkness(value);
      }
    },
    [targetMaskMeta, saveLightSourceField, mask],
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
  // Same coalescing-queue persistence as pendingLightSourceSaveRef above -- every edit previews
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

  const sizeTrackRef = useRef<HTMLDivElement | null>(null);
  const [sizeCursor, setSizeCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getSizeValue, getTrackCursor: getSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_SOURCE_SIZE_MAX - LIGHT_SOURCE_SIZE_MIN,
  );
  useEffect(() => {
    if (!sizeTrackRef.current) return;
    const newCursor = getSizeCursor(lightSourceSizeValue - LIGHT_SOURCE_SIZE_MIN, sizeTrackRef.current.clientWidth);
    setSizeCursor({ x: newCursor, y: 0 });
  }, [lightSourceSizeValue, getSizeCursor]);

  const intensityTrackRef = useRef<HTMLDivElement | null>(null);
  const [intensityCursor, setIntensityCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getIntensityValue, getTrackCursor: getIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  useEffect(() => {
    if (!intensityTrackRef.current) return;
    const newCursor = getIntensityCursor(lightSourceIntensityValue, intensityTrackRef.current.clientWidth);
    setIntensityCursor({ x: newCursor, y: 0 });
  }, [lightSourceIntensityValue, getIntensityCursor]);

  const falloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [falloffCursor, setFalloffCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getFalloffValue, getTrackCursor: getFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_SOURCE_FALLOFF_MAX - LIGHT_SOURCE_FALLOFF_MIN,
  );
  useEffect(() => {
    if (!falloffTrackRef.current) return;
    const newCursor = getFalloffCursor(
      lightSourceFalloffValue - LIGHT_SOURCE_FALLOFF_MIN,
      falloffTrackRef.current.clientWidth,
    );
    setFalloffCursor({ x: newCursor, y: 0 });
  }, [lightSourceFalloffValue, getFalloffCursor]);

  const darknessTrackRef = useRef<HTMLDivElement | null>(null);
  const [darknessCursor, setDarknessCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getDarknessValue, getTrackCursor: getDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  useEffect(() => {
    if (!darknessTrackRef.current) return;
    const newCursor = getDarknessCursor(lightSourceDarknessValue, darknessTrackRef.current.clientWidth);
    setDarknessCursor({ x: newCursor, y: 0 });
  }, [lightSourceDarknessValue, getDarknessCursor]);

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
            ? "targeting peaks -- double-click for captures"
            : "targeting captures -- double-click for peaks"
        }
        onDoubleClick={() => setTarget(target === "peak" ? "capture" : "peak")}
        style={{ display: "grid", placeContent: "center", cursor: "pointer" }}
      >
        <SvgRepo
          svg={target === "peak" ? stairs300() : asterisk300()}
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
      {target === "capture" ? (
        <>
          <div
            title={
              isLightSourceControlsDisabled
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
            <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 1 }}>{"size"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|size`}
              size={dynamicSizes.paramSize}
              containerRef={sizeTrackRef}
              cursor={sizeCursor}
              onNewCursor={(newCursor) => {
                setSizeCursor({ ...newCursor, y: 0 });
                if (!sizeTrackRef.current) return;
                const newValue = getSizeValue(newCursor.x, sizeTrackRef.current.clientWidth, 0) + LIGHT_SOURCE_SIZE_MIN;
                handleLightSourceSizeChange(newValue);
              }}
              disabled={isLightSourceControlsDisabled}
            />
          </div>
          <div
            title={
              isLightSourceControlsDisabled
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
            <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 1 }}>{"intensity"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|intensity`}
              size={dynamicSizes.paramSize}
              containerRef={intensityTrackRef}
              cursor={intensityCursor}
              onNewCursor={(newCursor) => {
                setIntensityCursor({ ...newCursor, y: 0 });
                if (!intensityTrackRef.current) return;
                const newValue = getIntensityValue(newCursor.x, intensityTrackRef.current.clientWidth, 0);
                handleLightSourceIntensityChange(newValue);
              }}
              disabled={isLightSourceControlsDisabled}
            />
          </div>
          <div
            title={
              isLightSourceControlsDisabled
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
            <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 1 }}>{"falloff"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|falloff`}
              size={dynamicSizes.paramSize}
              containerRef={falloffTrackRef}
              cursor={falloffCursor}
              onNewCursor={(newCursor) => {
                setFalloffCursor({ ...newCursor, y: 0 });
                if (!falloffTrackRef.current) return;
                const newValue =
                  getFalloffValue(newCursor.x, falloffTrackRef.current.clientWidth, 0) + LIGHT_SOURCE_FALLOFF_MIN;
                handleLightSourceFalloffChange(newValue);
              }}
              disabled={isLightSourceControlsDisabled}
            />
          </div>
          <div
            title={
              isLightSourceControlsDisabled
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
            <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 1 }}>{"darkness"}</span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${targetMaskKey ?? "lightsourcebar"}|darkness`}
              size={dynamicSizes.paramSize}
              containerRef={darknessTrackRef}
              cursor={darknessCursor}
              onNewCursor={(newCursor) => {
                setDarknessCursor({ ...newCursor, y: 0 });
                if (!darknessTrackRef.current) return;
                const newValue = getDarknessValue(newCursor.x, darknessTrackRef.current.clientWidth, 0);
                handleLightSourceDarknessChange(newValue);
              }}
              disabled={isLightSourceControlsDisabled}
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
