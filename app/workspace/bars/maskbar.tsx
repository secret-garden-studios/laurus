import { useContext, useMemo, useRef, useState, CSSProperties, useCallback, useEffect } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { SvgRepo, texture300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { ParameterSliderX, ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import styles from "@/app/app.module.css";
import { CoreActionType, PendingTopologyEdit } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import {
  MAX_MASK_PEAK_ELEVATION,
  MAX_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_RADIUS_PX,
} from "../mask-gl";
import { captureTriangleIndicesInCircle } from "../canvas-media/light-source-capture";

export default function Maskbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  // Aliased locally -- Maskbar itself has no notion of what a captured mesh subsection becomes
  // (a light source, or something else down the line); it just hands the drag off to whoever
  // does via these two callbacks.
  const {
    coreState,
    dispatch,
    notifyMaskToolChanged,
    notifyMaskAppearanceChanged,
    sendMaskPeakUpdate,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskPeaksUpdated,
  } = useContext(CoreContext);
  const { selectedImgKeys, selectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          flex: {
            gap: 0,
          },
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
          input: {
            container: {
              gap: 10,
              paddingRight: 20,
            },
            label: {
              fontSize: 12,
            },
            input: {
              fontSize: 12,
              padding: 4,
              letterSpacing: 1,
            },
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
          flex: {
            gap: 0,
          },
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
          input: {
            container: {
              gap: 10,
              paddingRight: 14,
            },
            label: {
              fontSize: 11,
            },
            input: {
              fontSize: 11,
              padding: 4,
              letterSpacing: 1,
            },
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
          flex: {
            gap: 0,
          },
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
          input: {
            container: {
              gap: 10,
              paddingRight: 16,
            },
            label: {
              fontSize: 11,
            },
            input: {
              fontSize: 11,
              padding: 4,
              letterSpacing: 1,
            },
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

  const xInputRef = useRef<HTMLInputElement | null>(null);
  const yInputRef = useRef<HTMLInputElement | null>(null);
  const wInputRef = useRef<HTMLInputElement | null>(null);
  const hInputRef = useRef<HTMLInputElement | null>(null);

  // Where/how big the generated mask should land, overriding the default of overlaying it
  // directly on top of the source image at the image's own frame. Lives in the shared
  // useMaskPreview instance (not local state) so the live preview in canvas.tsx can read the
  // same values and match, instead of only jumping to the override once persisted.
  const { position, setPosition, size, setSize } = mask;

  const isPositionOn = position.value;
  const isSizeOn = size.value;
  const xValue = position.x?.toString() ?? "0";
  const yValue = position.y?.toString() ?? "0";
  const widthValue = size.width?.toString() ?? "0";
  const heightValue = size.height?.toString() ?? "0";
  const positionInputStyle = useMemo<CSSProperties>(() => {
    return {
      textAlign: "center",
      background: "none",
      color: isPositionOn ? "inherit" : "rgb(67,67,67)",
      border: "none",
      outline: "none",
      display: "inline-block",
      overflowX: "scroll",
      width: "6ch",
      ...dynamicSizes.input.input,
    };
  }, [dynamicSizes.input.input, isPositionOn]);
  const sizeInputStyle = useMemo<CSSProperties>(() => {
    return {
      textAlign: "center",
      background: "none",
      color: isSizeOn ? "inherit" : "rgb(67,67,67)",
      border: "none",
      outline: "none",
      display: "inline-block",
      overflowX: "scroll",
      width: "6ch",
      ...dynamicSizes.input.input,
    };
  }, [dynamicSizes.input.input, isSizeOn]);

  const updateToolPosition = useCallback(() => {
    const newX = parseFloat(xInputRef.current?.value || "");
    const newY = parseFloat(yInputRef.current?.value || "");
    setPosition((prev) => ({
      ...prev,
      x: isNaN(newX) ? undefined : newX,
      y: isNaN(newY) ? undefined : newY,
    }));
  }, [setPosition]);

  const selectedImgKey = selectedImgKeys.size === 1 ? Array.from(selectedImgKeys)[0] : undefined;
  const imgMeta = selectedImgKey ? coreState.project.imgs.get(selectedImgKey) : undefined;
  // Armed for a browser-drop (an img-browser thumbnail clicked while the mask tool is active, see
  // img-browser's onImgClick) -- the source image isn't placed in the project yet, so there's no
  // imgMeta to read a frame off of, only the still-unplaced thumbnail itself.
  const isArmedForMaskDrop = uiState.tool.type === "mask" && uiState.browserElement?.type === "img";
  const armedImg =
    isArmedForMaskDrop && uiState.browserElement?.type === "img" ? uiState.browserElement.value : undefined;
  // The source image's own on-canvas aspect ratio -- width/height stay locked to it so resizing
  // the mask output can't distort it relative to the image it was traced from. Falls back to the
  // armed browser thumbnail's natural size (unplaced, so no on-canvas scale to apply) when there's
  // no placed image selected.
  const sourceWidth = imgMeta ? imgMeta.width * imgMeta.scale_x : armedImg?.width;
  const sourceHeight = imgMeta ? imgMeta.height * imgMeta.scale_y : armedImg?.height;
  const sourceAspectRatio = useMemo(() => {
    if (sourceWidth === undefined || !sourceHeight) return undefined;
    return sourceWidth / sourceHeight;
  }, [sourceWidth, sourceHeight]);

  const updateToolWidth = useCallback(() => {
    const newWidth = parseFloat(wInputRef.current?.value || "");
    setSize((prev) => ({
      ...prev,
      width: isNaN(newWidth) ? undefined : newWidth,
      height: isNaN(newWidth) || !sourceAspectRatio ? prev.height : newWidth / sourceAspectRatio,
    }));
  }, [sourceAspectRatio, setSize]);

  const updateToolHeight = useCallback(() => {
    const newHeight = parseFloat(hInputRef.current?.value || "");
    setSize((prev) => ({
      ...prev,
      height: isNaN(newHeight) ? undefined : newHeight,
      width: isNaN(newHeight) || !sourceAspectRatio ? prev.width : newHeight * sourceAspectRatio,
    }));
  }, [sourceAspectRatio, setSize]);

  const isPositionDisabled = !imgMeta && !isArmedForMaskDrop;
  const isSizeDisabled = !imgMeta && !isArmedForMaskDrop;
  // There's only something to blend once geometry is actually on screen.
  const hasMesh = mask.status === "streaming" || mask.status === "done";
  // A selected placed mask takes priority over the live in-flight preview -- picking a specific
  // result to adjust should always win over whatever's still streaming in, and the two only
  // overlap in the rare case both happen to be true at once.
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const isTextureDisabled = !(selectedMaskKey !== undefined || hasMesh || isArmedForMaskDrop);
  const isCaptureDisabled = selectedMaskKey === undefined;
  const isCaptureOn = uiState.tool.type === "mask" && uiState.tool.capturingMeshSection;
  const isTopologyDisabled = selectedMaskKey === undefined;
  const isTopologyOn = uiState.tool.type === "mask" && uiState.tool.editingTopology;
  const activeElement = uiState.activeElement;
  const selectedMaskData = selectedMaskKey !== undefined ? coreState.canvasMasks.get(selectedMaskKey) : undefined;
  const activePeak =
    activeElement?.type === "peak" && activeElement.key === selectedMaskKey
      ? selectedMaskData?.peaks.find((p) => p.id === activeElement.peakId)
      : undefined;
  // Enabled whenever there's a peak to edit -- either one is the active element (the bright
  // highlight, meta-clickable independently of the topology toggle -- see project-mask-item.tsx's
  // onClick hit-test) or the topology toggle is on, in which case with no peak active these instead
  // read/write uiState.stagedPeak, the shape the *next* circle-drag will create a peak at
  // (isTopologyDisabled already covers "no mask selected" transitively for that branch --
  // editingTopology can't stay true without one, see the cleanup effect below).
  const isPeakParamDisabled = !activePeak && !isTopologyOn;
  const elevationValue = activePeak?.elevation ?? uiState.stagedPeak.elevation;
  const falloffValue = activePeak?.falloff ?? uiState.stagedPeak.falloff;
  // Radius is the one peak parameter with nothing to stage: the circle-drag that creates a peak is
  // what defines it (see stagedPeak, ui-state.ts), so with no active peak there is genuinely nothing
  // for this slider to point at and it stays disabled even while the topology tool is on.
  const radiusValue = activePeak?.radius;
  const isRadiusDisabled = !activePeak;
  const selectedMaskMeta = selectedMaskKey !== undefined ? coreState.project.masks.get(selectedMaskKey) : undefined;
  const textureMixValue = selectedMaskMeta ? selectedMaskMeta.texture : mask.textureMix;
  // Same coalescing-queue persistence as LightSourcebar's own saveLightSourceField -- every edit
  // applies locally right away (see saveTextureField below), and only the network PUT coalesces:
  // whichever value is newest when a save completes goes out next, rather than a debounce timer
  // dropping mid-drag ticks or racing an in-flight request.
  const pendingTextureSaveRef = useRef<LaurusProjectResult | null>(null);
  const isPersistingTextureRef = useRef(false);
  const persistTextureQueue = useCallback(async () => {
    if (isPersistingTextureRef.current) return;
    isPersistingTextureRef.current = true;
    try {
      while (pendingTextureSaveRef.current) {
        const projectToSave = pendingTextureSaveRef.current;
        pendingTextureSaveRef.current = null;
        const saved = await updateProject(coreState.apiOrigin, coreState.accessToken, projectToSave.project_id, {
          ...projectToSave,
        });
        if (!saved) {
          console.error("failed to save texture change", { project_id: projectToSave.project_id });
        }
      }
    } finally {
      isPersistingTextureRef.current = false;
    }
  }, [coreState.apiOrigin, coreState.accessToken]);

  const saveTextureField = useCallback(
    (value: number) => {
      if (selectedMaskKey === undefined) return;
      const maskMeta = coreState.project.masks.get(selectedMaskKey);
      if (!maskMeta) return;

      const newMasks = new Map(coreState.project.masks);
      const newMaskMeta: LaurusProjectMask = { ...maskMeta, texture: value };
      newMasks.set(selectedMaskKey, newMaskMeta);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      // Passed directly rather than left for the mesh to re-read off coreState: this fires
      // synchronously, before React has re-rendered ProjectMaskItem with the just-dispatched
      // project (see MaskAppearanceOverride's own comment in project-mask-item.tsx).
      notifyMaskAppearanceChanged(selectedMaskKey, { textureMix: value });

      pendingTextureSaveRef.current = newProject;
      void persistTextureQueue();
    },
    [selectedMaskKey, coreState.project, dispatch, notifyMaskAppearanceChanged, persistTextureQueue],
  );

  const handleTextureMixChange = useCallback(
    (value: number) => {
      if (selectedMaskMeta) {
        saveTextureField(value);
      } else {
        mask.setTextureMix(value);
      }
    },
    [selectedMaskMeta, saveTextureField, mask],
  );

  // Trackpad (see ParameterSliderX/trackpad.tsx) only calls onNewCursor once, on drag *end* --
  // onCursorMove is the one that fires continuously while the thumb is actually moving. Mirrors
  // Scalebar's own split: the WebGL canvas updates live on every tick via the same direct-notify
  // path saveTextureField uses (see its own comment), but skips that function's dispatch/persist
  // -- committing coreState.project and queuing the network PUT on every mid-drag pixel would
  // fight the render for the same frame budget for no benefit, since onNewCursor already commits
  // the settled value the instant the drag ends.
  const previewTextureMixChange = useCallback(
    (value: number) => {
      if (selectedMaskKey !== undefined) {
        notifyMaskAppearanceChanged(selectedMaskKey, { textureMix: value });
      } else {
        mask.setTextureMix(value);
      }
    },
    [selectedMaskKey, mask, notifyMaskAppearanceChanged],
  );

  const textureTrackRef = useRef<HTMLDivElement | null>(null);
  const [textureCursor, setTextureCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getTextureValue, getTrackCursor: getTextureCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );

  useEffect(() => {
    if (!textureTrackRef.current) return;
    const newCursor = getTextureCursor(textureMixValue, textureTrackRef.current.clientWidth);
    setTextureCursor({ x: newCursor, y: 0 });
  }, [textureMixValue, getTextureCursor]);

  // Which of a peak's own shape parameters an edit is changing. A partial rather than a whole peak
  // because each slider is an independent control that only knows its own value -- the rest are
  // merged from whatever the active peak currently carries (see mergePeakPatch below).
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
  // Same coalescing-queue persistence as pendingTextureSaveRef above -- every edit previews
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
      if (selectedMaskKey === undefined || !activePeak) return undefined;
      return {
        maskKey: selectedMaskKey,
        peakId: activePeak.id,
        cx: activePeak.cx,
        cy: activePeak.cy,
        radius: patch.radius ?? activePeak.radius,
        elevation: patch.elevation ?? activePeak.elevation,
        falloff: patch.falloff ?? activePeak.falloff,
      };
    },
    [selectedMaskKey, activePeak],
  );

  const savePeakField = useCallback(
    (patch: PeakPatch) => {
      if (selectedMaskKey === undefined) return;
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
      const maskData = coreState.canvasMasks.get(selectedMaskKey);
      if (!maskData) return;

      dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
      notifyMaskPendingTopologySet(selectedMaskKey, edit);

      pendingPeakSaveRef.current = {
        maskKey: selectedMaskKey,
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
    [
      selectedMaskKey,
      mergePeakPatch,
      coreState.canvasMasks,
      dispatch,
      notifyMaskPendingTopologySet,
      uiDispatch,
      persistPeakQueue,
    ],
  );

  // Trackpad-drag live preview, mirroring previewTextureMixChange's own split (onCursorMove fires
  // continuously while dragging; onNewCursor only once on release). With an active peak this drives
  // the mesh's live relief preview directly, skipping savePeakField's own dispatch/persist for the
  // same reason previewTextureMixChange skips saveTextureField's -- no benefit to
  // committing/persisting on every mid-drag pixel when release will commit the settled value anyway.
  // With no active peak there's nothing on the mesh to preview, so this just keeps the staged value
  // (and so the slider's own displayed position) current as it drags.
  //
  // This is genuinely cheap now, which is why it's wired up at all: a peak is a shader uniform, so
  // one of these is a handful of floats and a redraw, with no geometry rebuild and no round trip. The
  // one thing that doesn't track live is the subdivision density, which settles on release -- see
  // syncPeaks in project-mask-item.tsx.
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
  // Elevation is signed now -- a negative peak is a dent, the same dome inverted -- but
  // useTrackpadState only ever produces 0..maxValue (its getTrackValue floors at a non-negative
  // minValue). So the signed range rides on a track twice as long, offset by half: the midpoint is
  // elevation 0, the left half craters and the right half domes. Paired with
  // ParameterSliderXPlusMinus, as Scalebar does, so the -/+ ends of the track read correctly.
  //
  // The ceiling itself is a flat constant rather than anything derived from the mask, because a
  // peak's relief is defined relative to its own radius (see mask-gl.ts's peakProfile) and so doesn't
  // scale with how big the mesh happens to be.
  const elevationSpan = MAX_MASK_PEAK_ELEVATION * 2;
  const { getTrackValue: getElevationValue, getTrackCursor: getElevationCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    elevationSpan,
  );
  // The two halves of that offset, kept together so the track->value and value->track directions
  // can't drift apart.
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
  const radiusMax = selectedMaskData
    ? Math.max(MIN_MASK_PEAK_RADIUS_PX + 1, Math.min(selectedMaskData.width, selectedMaskData.height))
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

  const falloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [falloffCursor, setFalloffCursor] = useState({ x: 0, y: 0 });
  // Same floor-plus-span arrangement as radius, for the profile exponent's own
  // MIN..MAX_MASK_PEAK_FALLOFF range -- at the low end a peak meets flat mesh with a visible crease
  // ring, at the high end it's a needle. See MIN_MASK_PEAK_FALLOFF for why the floor isn't 0.
  const falloffSpan = MAX_MASK_PEAK_FALLOFF - MIN_MASK_PEAK_FALLOFF;
  const { getTrackValue: getFalloffValue, getTrackCursor: getFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    falloffSpan,
  );

  useEffect(() => {
    if (!falloffTrackRef.current) return;
    const newCursor = getFalloffCursor(falloffValue - MIN_MASK_PEAK_FALLOFF, falloffTrackRef.current.clientWidth);
    setFalloffCursor({ x: newCursor, y: 0 });
  }, [falloffValue, getFalloffCursor]);

  // Starting fresh whenever the selected image changes, rather than leaving a stale mesh/status
  // or position/size override from whatever was last masked (mask.reset() clears both). Skipped
  // while a mask is actively connecting/streaming -- the img context menu's "mask" cell selects
  // the image and triggers masking in the same click (see its handleMaskClick), so this effect
  // would otherwise fire right after and mask.reset()'s socketRef.current?.close() would abort
  // the job it just started.
  useEffect(() => {
    if (mask.status === "connecting" || mask.status === "streaming") return;
    mask.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImgKey]);

  // The toggle is disabled with no mask selected, but its underlying tool state can still be
  // left on from before the deselect -- turn it off so the toggle doesn't render as on while
  // disabled, and canvas.tsx stops treating drags as mesh-section captures or topology edits.
  useEffect(() => {
    if (selectedMaskKey !== undefined) return;
    if (uiState.tool.type !== "mask" || (!uiState.tool.capturingMeshSection && !uiState.tool.editingTopology)) return;
    uiDispatch({
      type: UIActionType.SetTool,
      value: { type: "mask", capturingMeshSection: false, editingTopology: false },
    });
    notifyMaskToolChanged("mask");
  }, [selectedMaskKey, uiState.tool, uiDispatch, notifyMaskToolChanged]);

  return (
    <>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          overflow: "auto",
          ...dynamicSizes.flex,
        }}
      >
        <SvgRepo
          svg={texture300()}
          containerStyle={{
            width: dynamicSizes.svgSize.width,
            height: dynamicSizes.svgSize.height,
          }}
          scale={1}
          scaleToContaier={true}
        />
        <div
          style={{
            display: "flex",
            height: "100%",
            alignItems: "center",
            ...dynamicSizes.input.container,
          }}
        >
          <div
            title={
              isPositionDisabled
                ? "select an image to mask, or arm one from the browser, to set an exact position for the result"
                : "place the generated mask at an exact x/y position instead of overlaying the source image"
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
                textShadow: isPositionOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
              }}
            >
              {"position"}
            </span>
            <Toggle
              value={isPositionOn}
              onClick={() => {
                const newPositionValue = !isPositionOn;
                const newX = parseFloat(xInputRef.current?.value || "");
                const newY = parseFloat(yInputRef.current?.value || "");
                setPosition({
                  value: newPositionValue,
                  x: newPositionValue && !isNaN(newX) ? newX : undefined,
                  y: newPositionValue && !isNaN(newY) ? newY : undefined,
                });
              }}
              trackStyles={{ ...dynamicSizes.toggle.track }}
              buttonStyles={{ ...dynamicSizes.toggle.button }}
              translateX={dynamicSizes.toggle.translateX}
              disabled={isPositionDisabled}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: isPositionOn ? "inherit" : "rgb(67,67,67)",
              ...dynamicSizes.input.label,
            }}
          >
            {"x"}
          </div>
          <input
            className={styles["numberInput"]}
            id={`${selectedImgKey ?? "maskbar"}|input|x`}
            disabled={!isPositionOn}
            ref={xInputRef}
            onChange={updateToolPosition}
            type="text"
            value={xValue}
            autoComplete="off"
            style={positionInputStyle}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: isPositionOn ? "inherit" : "rgb(67,67,67)",
              ...dynamicSizes.input.label,
            }}
          >
            {"y"}
          </div>
          <input
            className={styles["numberInput"]}
            id={`${selectedImgKey ?? "maskbar"}|input|y`}
            disabled={!isPositionOn}
            ref={yInputRef}
            onChange={updateToolPosition}
            type="text"
            value={yValue}
            autoComplete="off"
            style={positionInputStyle}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.input.container,
          }}
        >
          <div
            title={
              isSizeDisabled
                ? "select an image to mask, or arm one from the browser, to set an exact size for the result"
                : "size the generated mask to an exact width/height instead of matching the source image"
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
                textShadow: isSizeOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
              }}
            >
              {"size"}
            </span>
            <Toggle
              value={isSizeOn}
              onClick={() => {
                const newSizeValue = !isSizeOn;
                setSize(
                  newSizeValue && sourceWidth !== undefined && sourceHeight !== undefined
                    ? {
                        value: true,
                        // Seeded from the source's current size (the placed image's on-canvas size,
                        // or the armed browser thumbnail's natural size), so turning the toggle on
                        // doesn't jump to some other size -- from here, editing either field scales
                        // the other to keep this same ratio.
                        width: sourceWidth,
                        height: sourceHeight,
                      }
                    : { value: newSizeValue, width: undefined, height: undefined },
                );
              }}
              trackStyles={{ ...dynamicSizes.toggle.track }}
              buttonStyles={{ ...dynamicSizes.toggle.button }}
              translateX={dynamicSizes.toggle.translateX}
              disabled={isSizeDisabled}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: isSizeOn ? "inherit" : "rgb(67,67,67)",
              ...dynamicSizes.input.label,
            }}
          >
            {"width"}
          </div>
          <input
            className={styles["numberInput"]}
            id={`${selectedImgKey ?? "maskbar"}|input|w`}
            disabled={!isSizeOn}
            ref={wInputRef}
            onChange={updateToolWidth}
            type="text"
            value={widthValue}
            autoComplete="off"
            style={sizeInputStyle}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: isSizeOn ? "inherit" : "rgb(67,67,67)",
              ...dynamicSizes.input.label,
            }}
          >
            {"height"}
          </div>
          <input
            className={styles["numberInput"]}
            id={`${selectedImgKey ?? "maskbar"}|input|h`}
            disabled={!isSizeOn}
            ref={hInputRef}
            onChange={updateToolHeight}
            type="text"
            value={heightValue}
            autoComplete="off"
            style={sizeInputStyle}
          />
        </div>
        <div
          title={
            isTextureDisabled
              ? "select or generate a mesh to adjust its wireframe overlay"
              : "0% hides the mesh's triangle wireframe, 100% draws it fully in over the source image"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ opacity: isTextureDisabled ? 0.3 : 1 }}>{"texture"}</span>
          <ParameterSliderX
            resolution={{ ...uiState.resolution }}
            hash={`${selectedMaskKey ?? "maskbar"}|texture`}
            size={dynamicSizes.paramSize}
            containerRef={textureTrackRef}
            cursor={textureCursor}
            onCursorMove={(newCursor) => {
              if (!textureTrackRef.current) return;
              const newValue = getTextureValue(newCursor.x, textureTrackRef.current.clientWidth, 0);
              previewTextureMixChange(newValue);
            }}
            onNewCursor={(newCursor) => {
              setTextureCursor({ ...newCursor, y: 0 });
              if (!textureTrackRef.current) return;
              const newValue = getTextureValue(newCursor.x, textureTrackRef.current.clientWidth, 0);
              handleTextureMixChange(newValue);
            }}
            disabled={isTextureDisabled}
          />
        </div>
        <div
          title={
            isCaptureDisabled
              ? "select a mesh to capture a subsection of it"
              : "drag a circle over this mesh to capture a subsection of its triangles"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span
            style={{
              textShadow: isCaptureOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
            }}
          >
            {"capture"}
          </span>
          <Toggle
            value={isCaptureOn}
            onClick={() => {
              if (uiState.tool.type !== "mask") return;
              uiDispatch({
                type: UIActionType.SetTool,
                value: { ...uiState.tool, capturingMeshSection: !uiState.tool.capturingMeshSection },
              });
              notifyMaskToolChanged("mask");
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
            disabled={isCaptureDisabled}
          />
        </div>
        <div
          title={
            isTopologyDisabled
              ? "select a mesh to adjust its topology"
              : "drag a circle over this mesh to raise that area's elevation, warping the surrounding triangles like a topographic map"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span
            style={{
              textShadow: isTopologyOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
            }}
          >
            {"peak"}
          </span>
          <Toggle
            value={isTopologyOn}
            onClick={() => {
              if (uiState.tool.type !== "mask") return;
              uiDispatch({
                type: UIActionType.SetTool,
                value: { ...uiState.tool, editingTopology: !uiState.tool.editingTopology },
              });
              notifyMaskToolChanged("mask");
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
            disabled={isTopologyDisabled}
          />
        </div>
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
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ opacity: isPeakParamDisabled ? 0.3 : 1 }}>{"elevation"}</span>
          <ParameterSliderXPlusMinus
            resolution={{ ...uiState.resolution }}
            hash={`${selectedMaskKey ?? "maskbar"}|elevation|${activePeak?.id ?? "staged"}`}
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
              savePeakField({ elevation: elevationFromTrack(newCursor.x, elevationTrackRef.current.clientWidth) });
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
            hash={`${selectedMaskKey ?? "maskbar"}|radius|${activePeak?.id ?? "staged"}`}
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
            hash={`${selectedMaskKey ?? "maskbar"}|falloff|${activePeak?.id ?? "staged"}`}
            size={dynamicSizes.paramSize}
            containerRef={falloffTrackRef}
            cursor={falloffCursor}
            onCursorMove={(newCursor) => {
              if (!falloffTrackRef.current) return;
              const newValue =
                MIN_MASK_PEAK_FALLOFF + getFalloffValue(newCursor.x, falloffTrackRef.current.clientWidth, 0);
              previewPeakChange({ falloff: newValue });
            }}
            onNewCursor={(newCursor) => {
              setFalloffCursor({ ...newCursor, y: 0 });
              if (!falloffTrackRef.current) return;
              const newValue =
                MIN_MASK_PEAK_FALLOFF + getFalloffValue(newCursor.x, falloffTrackRef.current.clientWidth, 0);
              savePeakField({ falloff: newValue });
            }}
            disabled={isPeakParamDisabled}
          />
        </div>
        <div />
      </div>
    </>
  );
}
