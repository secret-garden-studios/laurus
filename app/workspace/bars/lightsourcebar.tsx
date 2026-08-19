import { useCallback, useContext, useRef, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { CoreActionType, PendingTopologyEdit } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { SvgRepo, asterisk300, antigravity300 } from "@/app/svg-repo";
import { ParameterSliderX, ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import {
  MAX_MASK_PEAK_ELEVATION,
  MAX_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_FALLOFF,
  MIN_MASK_PEAK_RADIUS_PX,
} from "../mask-gl";
import {
  capturedRegionCircle,
  captureTriangleIndicesInCircle,
  peakTriangleIndices,
} from "../canvas-media/light-source-capture";
import { LaurusMaskResult, LaurusPeakBlackPoint, toPeakBlackPoint, toPeakBlackPointFields } from "../workspace.server";
import { ColorSwatch } from "@/app/components/color-swatch";
import {
  CAPTURE_DARKNESS_MAX,
  CAPTURE_FALLOFF_MAX,
  CAPTURE_INTENSITY_MAX,
  CAPTURE_SIZE_MAX,
} from "../workspace.config";

const CAPTURE_PREVIEW_SIZE_MIN = 10;
const CAPTURE_PREVIEW_SIZE_MAX = 300;
const CAPTURE_PREVIEW_FALLOFF_MIN = 20;
const CAPTURE_PREVIEW_FALLOFF_MAX = 1000;

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
  const { selectedMaskKeys, mostRecentlyHoveredMaskKey } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  const [target, setTarget] = useState<"preview" | "capture" | "peak">("capture");
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

  const hasMesh = mask.status === "streaming" || mask.status === "done";
  const selectedElement = uiState.selectedElement;
  const activeCaptureMaskKey = selectedElement?.type === "capture" ? selectedElement.key : undefined;
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const targetMaskKey = activeCaptureMaskKey ?? mostRecentlyHoveredMaskKey ?? selectedMaskKey;
  const targetMaskMeta = targetMaskKey !== undefined ? coreState.project.masks.get(targetMaskKey) : undefined;
  const isPreviewControlsDisabled = !(targetMaskKey !== undefined || hasMesh);
  const activeCaptureMaskData =
    activeCaptureMaskKey !== undefined ? coreState.canvasMasks.get(activeCaptureMaskKey) : undefined;
  const activeCapture =
    selectedElement?.type === "capture"
      ? activeCaptureMaskData?.captures.find((c) => c.id === selectedElement.captureId)
      : undefined;
  const isCaptureParamDisabled = !activeCapture;
  const activePeakMaskKey = selectedElement?.type === "peak" ? selectedElement.key : undefined;
  const activePeakMaskData = activePeakMaskKey !== undefined ? coreState.canvasMasks.get(activePeakMaskKey) : undefined;
  const activePeak =
    selectedElement?.type === "peak"
      ? activePeakMaskData?.peaks.find((p) => p.id === selectedElement.peakId)
      : undefined;
  const isTopologyOn = uiState.tool.type === "mask" && uiState.tool.editingTopology;
  const isPeakParamDisabled = !activePeak && !isTopologyOn;
  const elevationValue = activePeak?.elevation ?? uiState.stagedPeak.elevation;
  const peakFalloffValue = activePeak?.falloff ?? uiState.stagedPeak.falloff;
  const radiusValue = activePeak?.radius;
  const isRadiusDisabled = !activePeak;
  const blackPointValue = activePeak ? toPeakBlackPoint(activePeak) : uiState.stagedPeak.blackPoint;
  const selectedSubElement =
    selectedElement?.type === "capture"
      ? `capture|${selectedElement.key}|${selectedElement.captureId}`
      : selectedElement?.type === "peak"
        ? `peak|${selectedElement.key}|${selectedElement.peakId}`
        : undefined;
  const [prevSelectedSubElement, setPrevSelectedSubElement] = useState<string | undefined>(undefined);
  if (selectedSubElement !== prevSelectedSubElement) {
    setPrevSelectedSubElement(selectedSubElement);
    if (selectedSubElement !== undefined) {
      setTarget(selectedSubElement.startsWith("peak|") ? "peak" : "capture");
    }
  }
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
      field:
        "capture_preview_size" | "capture_preview_intensity" | "capture_preview_falloff" | "capture_preview_darkness",
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
      const newCaptures = activeCaptureMaskData.captures.map((c) => (c.id === activeCapture.id ? patched : c));
      const newMaskData: LaurusMaskResult = { ...activeCaptureMaskData, captures: newCaptures };
      dispatch({ type: CoreActionType.SetCanvasMask, key: activeCaptureMaskKey, value: newMaskData });
      notifyMaskCaptureUpdated(activeCaptureMaskKey, newMaskData);
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
    [
      activeCaptureMaskKey,
      activeCapture,
      activeCaptureMaskData,
      dispatch,
      notifyMaskCaptureUpdated,
      persistCaptureQueue,
    ],
  );

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

  const previewCaptureSizeChange = useCallback(
    (size: number) => {
      if (activeCaptureMaskKey === undefined || !activeCapture) return;
      const polygonIndices = captureIndicesForSize(size);
      if (!polygonIndices) return;
      notifyMaskPendingCaptureSet(activeCaptureMaskKey, new Set(polygonIndices), activeCapture.id);
    },
    [activeCaptureMaskKey, activeCapture, captureIndicesForSize, notifyMaskPendingCaptureSet],
  );

  const saveCaptureSizeField = useCallback(
    (size: number) => {
      if (activeCaptureMaskKey === undefined || !activeCapture || !activeCaptureMaskData) return;
      const polygonIndices = captureIndicesForSize(size);
      if (!polygonIndices) {
        captureResizeAnchorRef.current = null;
        notifyMaskPendingCaptureCleared(activeCaptureMaskKey);
        return;
      }

      const patched = { ...activeCapture, size };
      const newCaptures = activeCaptureMaskData.captures.map((c) => (c.id === activeCapture.id ? patched : c));
      const newMaskData: LaurusMaskResult = { ...activeCaptureMaskData, captures: newCaptures };
      dispatch({ type: CoreActionType.SetCanvasMask, key: activeCaptureMaskKey, value: newMaskData });
      notifyMaskCaptureUpdated(activeCaptureMaskKey, newMaskData);
      dispatch({
        type: CoreActionType.SetPendingLightSourceCapture,
        value: { maskKey: activeCaptureMaskKey, captureId: activeCapture.id, polygonIndices },
      });
      notifyMaskPendingCaptureSet(activeCaptureMaskKey, new Set(polygonIndices), activeCapture.id);

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
      notifyMaskCaptureUpdated,
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

  type PeakPatch = {
    elevation?: number;
    radius?: number;
    falloff?: number;
    blackPoint?: LaurusPeakBlackPoint;
  };

  const toStagedPeakPatch = useCallback(
    (patch: PeakPatch) => ({
      ...(patch.elevation !== undefined ? { elevation: patch.elevation } : {}),
      ...(patch.falloff !== undefined ? { falloff: patch.falloff } : {}),
      ...(patch.blackPoint !== undefined ? { blackPoint: patch.blackPoint } : {}),
    }),
    [],
  );

  interface PendingPeakSave {
    maskKey: string;
    maskMediaId: string;
    peakId: number;
    name: string;
    cx: number;
    cy: number;
    radius: number;
    elevation: number;
    falloff: number;
    shape: string;
    blackPoint: LaurusPeakBlackPoint;
    polygonIndices: number[];
  }

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
          name: toSave.name,
          cx: toSave.cx,
          cy: toSave.cy,
          radius: toSave.radius,
          elevation: toSave.elevation,
          falloff: toSave.falloff,
          shape: toSave.shape,
          ...toPeakBlackPointFields(toSave.blackPoint),
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
      if (settledMaskKey !== undefined) {
        dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
        notifyMaskPendingTopologyCleared(settledMaskKey);
      }
    }
  }, [sendMaskPeakUpdate, dispatch, notifyMaskPeaksUpdated, notifyMaskPendingTopologyCleared]);

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
        shape: activePeak.shape,
        blackPoint: patch.blackPoint ?? toPeakBlackPoint(activePeak),
      };
    },
    [activePeakMaskKey, activePeak],
  );

  const savePeakField = useCallback(
    (patch: PeakPatch) => {
      const edit = mergePeakPatch(patch);
      if (!edit) {
        uiDispatch({ type: UIActionType.SetStagedPeak, value: toStagedPeakPatch(patch) });
        return;
      }
      const maskData = coreState.canvasMasks.get(edit.maskKey);
      if (!maskData) return;

      dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
      notifyMaskPendingTopologySet(edit.maskKey, edit);

      const existingPeak = maskData.peaks.find((p) => p.id === edit.peakId);
      const peakName = existingPeak?.name ?? `peak ${edit.peakId}`;

      pendingPeakSaveRef.current = {
        maskKey: edit.maskKey,
        maskMediaId: maskData.mask_media_id,
        peakId: edit.peakId,
        name: peakName,
        cx: edit.cx,
        cy: edit.cy,
        radius: edit.radius,
        elevation: edit.elevation,
        falloff: edit.falloff,
        shape: edit.shape,
        blackPoint: edit.blackPoint,
        polygonIndices: [
          ...peakTriangleIndices(maskData.polygons, {
            cx: edit.cx,
            cy: edit.cy,
            radius: edit.radius,
            shape: edit.shape,
          }),
        ],
      };
      void persistPeakQueue();
    },
    [
      mergePeakPatch,
      coreState.canvasMasks,
      dispatch,
      notifyMaskPendingTopologySet,
      uiDispatch,
      persistPeakQueue,
      toStagedPeakPatch,
    ],
  );

  const previewPeakChange = useCallback(
    (patch: PeakPatch) => {
      const edit = mergePeakPatch(patch);
      if (edit) {
        notifyMaskPendingTopologySet(edit.maskKey, edit);
      } else {
        uiDispatch({ type: UIActionType.SetStagedPeak, value: toStagedPeakPatch(patch) });
      }
    },
    [mergePeakPatch, notifyMaskPendingTopologySet, uiDispatch, toStagedPeakPatch],
  );

  const elevationTrackRef = useRef<HTMLDivElement | null>(null);

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
  const elevationCursor = { x: elevationToTrack(elevationValue, dynamicSizes.paramSize.containerWidth), y: 0 };

  const radiusTrackRef = useRef<HTMLDivElement | null>(null);
  const radiusMax = activePeakMaskData
    ? Math.max(MIN_MASK_PEAK_RADIUS_PX + 1, Math.min(activePeakMaskData.width, activePeakMaskData.height))
    : MIN_MASK_PEAK_RADIUS_PX + 1;
  const { getTrackValue: getRadiusValue, getTrackCursor: getRadiusCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    radiusMax - MIN_MASK_PEAK_RADIUS_PX,
  );

  const radiusCursor = {
    x: getRadiusCursor((radiusValue ?? 0) - MIN_MASK_PEAK_RADIUS_PX, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

  const peakFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const peakFalloffSpan = MAX_MASK_PEAK_FALLOFF - MIN_MASK_PEAK_FALLOFF;
  const { getTrackValue: getPeakFalloffValue, getTrackCursor: getPeakFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    peakFalloffSpan,
  );
  const peakFalloffCursor = {
    x: getPeakFalloffCursor(peakFalloffValue - MIN_MASK_PEAK_FALLOFF, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

  const previewSizeTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewSizeValue, getTrackCursor: getPreviewSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_PREVIEW_SIZE_MAX - CAPTURE_PREVIEW_SIZE_MIN,
  );
  const previewSizeCursor = {
    x: getPreviewSizeCursor(previewSizeValue - CAPTURE_PREVIEW_SIZE_MIN, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

  const previewIntensityTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewIntensityValue, getTrackCursor: getPreviewIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const previewIntensityCursor = {
    x: getPreviewIntensityCursor(previewIntensityValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

  const previewFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewFalloffValue, getTrackCursor: getPreviewFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_PREVIEW_FALLOFF_MAX - CAPTURE_PREVIEW_FALLOFF_MIN,
  );
  const previewFalloffCursor = {
    x: getPreviewFalloffCursor(
      previewFalloffValue - CAPTURE_PREVIEW_FALLOFF_MIN,
      dynamicSizes.paramSize.containerWidth,
    ),
    y: 0,
  };

  const previewDarknessTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewDarknessValue, getTrackCursor: getPreviewDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const previewDarknessCursor = {
    x: getPreviewDarknessCursor(previewDarknessValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

  const captureSizeMax = activeCaptureMaskData
    ? Math.min(activeCaptureMaskData.width, activeCaptureMaskData.height)
    : CAPTURE_SIZE_MAX;
  const captureSizeTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getCaptureSizeValue, getTrackCursor: getCaptureSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    captureSizeMax,
  );
  const captureSizeCursor = { x: getCaptureSizeCursor(captureSizeValue, dynamicSizes.paramSize.containerWidth), y: 0 };

  const captureIntensityTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getCaptureIntensityValue, getTrackCursor: getCaptureIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_INTENSITY_MAX,
  );
  const captureIntensityCursor = {
    x: getCaptureIntensityCursor(captureIntensityValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

  const captureFalloffMax = activeCaptureMaskData
    ? Math.min(activeCaptureMaskData.width, activeCaptureMaskData.height)
    : CAPTURE_FALLOFF_MAX;
  const captureFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getCaptureFalloffValue, getTrackCursor: getCaptureFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    captureFalloffMax,
  );
  const captureFalloffCursor = {
    x: getCaptureFalloffCursor(captureFalloffValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

  const captureDarknessTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getCaptureDarknessValue, getTrackCursor: getCaptureDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_DARKNESS_MAX,
  );
  const captureDarknessCursor = {
    x: getCaptureDarknessCursor(captureDarknessValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };

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
          target === "capture"
            ? "targeting captures -- double-click for peaks"
            : target === "peak"
              ? "targeting peaks -- double-click for the capture-preview"
              : "targeting the capture-preview -- double-click for captures"
        }
        onDoubleClick={() => {
          const nextTarget = target === "capture" ? "peak" : target === "peak" ? "preview" : "capture";
          setTarget(nextTarget);
          uiDispatch({ type: UIActionType.SetLightSourcePreview, value: nextTarget === "preview" });
          notifyMaskLightSourcePreviewToggled(nextTarget === "preview");
        }}
        style={{ display: "grid", placeContent: "center", cursor: "pointer" }}
      >
        <SvgRepo
          svg={target === "capture" ? asterisk300() : target === "peak" ? antigravity300() : asterisk300()}
          containerStyle={{
            width: dynamicSizes.svgSize.width,
            height: dynamicSizes.svgSize.height,
          }}
          scale={1}
          scaleToContaier={true}
        />
      </div>
      {target === "preview" ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span>{"preview"}</span>
          </div>
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
                if (!previewSizeTrackRef.current) return;
                const newValue =
                  getPreviewSizeValue(newCursor.x, previewSizeTrackRef.current.clientWidth, 0) +
                  CAPTURE_PREVIEW_SIZE_MIN;
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
                if (!peakFalloffTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_FALLOFF + getPeakFalloffValue(newCursor.x, peakFalloffTrackRef.current.clientWidth, 0);
                savePeakField({ falloff: newValue });
              }}
              disabled={isPeakParamDisabled}
            />
          </div>
          <div
            title={
              isPeakParamDisabled
                ? "enable topology to set the black point new peaks are drawn with, or adjust the active one"
                : activePeak
                  ? "the active peak's own black point -- the darkest colour this peak can reach. its shading runs from here up to white, never to black. alpha is how strongly it applies"
                  : "the black point the next circle you drag out will be created with -- the darkest colour that peak can reach, its shading running from there up to white rather than to black"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPeakParamDisabled ? 0.3 : 1 }}>{"black point"}</span>
            <ColorSwatch
              resolution={{ ...uiState.resolution }}
              hash={`${activePeakMaskKey ?? "lightsourcebar"}|peak-black-point|${activePeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              chipSize={dynamicSizes.svgSize.height}
              value={blackPointValue}
              onPreview={(next) => previewPeakChange({ blackPoint: next })}
              onChange={(next) => savePeakField({ blackPoint: next })}
              disabled={isPeakParamDisabled}
            />
          </div>
        </>
      )}
    </div>
  );
}
