import { useCallback, useContext, useRef, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext, SocketContext } from "../workspace.client";
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
import Toggle from "@/app/components/toggle";
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
  const { coreState, dispatch } = useContext(CoreContext);
  const { sendMaskCaptureUpdate, sendMaskPeakUpdate } = useContext(SocketContext);
  const { selectedMaskKeys, mostRecentlyHoveredMaskKey } = useContext(HoverContext);
  const {
    notifyMaskAppearanceChanged,
    notifyMaskLightSourcePreviewToggled,
    notifyMaskSelectionChanged,
    notifyMaskSelectedCaptureChanged,
    notifyMaskSelectedPeakChanged,
    notifyMaskCaptureUpdated,
    notifyMaskPendingCaptureSet,
    notifyMaskPendingCaptureCleared,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskPeaksUpdated,
    ...mask
  } = useContext(MaskContext);
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

  const hasMesh = mask.status === "streaming" || mask.status === "done";
  const selectedElement = uiState.selectedElement;
  const selectedCaptureMaskKey = selectedElement?.type === "capture" ? selectedElement.key : undefined;
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const targetMaskKey = selectedCaptureMaskKey ?? mostRecentlyHoveredMaskKey ?? selectedMaskKey;
  const targetMaskMeta = targetMaskKey !== undefined ? coreState.project.masks.get(targetMaskKey) : undefined;
  const isPreviewControlsDisabled = !(targetMaskKey !== undefined || hasMesh);
  const selectedCaptureMaskData =
    selectedCaptureMaskKey !== undefined ? coreState.canvasMasks.get(selectedCaptureMaskKey) : undefined;
  const selectedCapture =
    selectedElement?.type === "capture"
      ? selectedCaptureMaskData?.captures.find((c) => c.id === selectedElement.captureId)
      : undefined;
  const isCaptureParamDisabled = !selectedCapture;
  const selectedPeakMaskKey = selectedElement?.type === "peak" ? selectedElement.key : undefined;
  const selectedPeakMaskData =
    selectedPeakMaskKey !== undefined ? coreState.canvasMasks.get(selectedPeakMaskKey) : undefined;
  const selectedPeak =
    selectedElement?.type === "peak"
      ? selectedPeakMaskData?.peaks.find((p) => p.id === selectedElement.peakId)
      : undefined;
  const isTopologyOn = uiState.tool.type === "mask" && uiState.tool.editingTopology;
  const isPeakParamDisabled = !selectedPeak && !isTopologyOn;

  const pendingPeakEdit =
    selectedPeak &&
    selectedPeakMaskKey !== undefined &&
    coreState.pendingTopologyEdit?.maskKey === selectedPeakMaskKey &&
    coreState.pendingTopologyEdit?.peakId === selectedPeak.id
      ? coreState.pendingTopologyEdit
      : undefined;
  const elevationValue = pendingPeakEdit?.elevation ?? selectedPeak?.elevation ?? uiState.stagedPeak.elevation;
  const peakFalloffValue = pendingPeakEdit?.falloff ?? selectedPeak?.falloff ?? uiState.stagedPeak.falloff;
  const radiusValue = pendingPeakEdit?.radius ?? selectedPeak?.radius;
  const isRadiusDisabled = !selectedPeak;
  const blackPointValue =
    pendingPeakEdit?.blackPoint ?? (selectedPeak ? toPeakBlackPoint(selectedPeak) : uiState.stagedPeak.blackPoint);
  const selectedSubElement =
    selectedElement?.type === "capture"
      ? `capture|${selectedElement.key}|${selectedElement.captureId}`
      : selectedElement?.type === "peak"
        ? `peak|${selectedElement.key}|${selectedElement.peakId}`
        : undefined;
  const [prevSelectedSubElement, setPrevSelectedSubElement] = useState<string | undefined>(undefined);

  // beta: render-phase state adjustment pattern
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
      if (selectedCaptureMaskKey === undefined || !selectedCapture || !selectedCaptureMaskData) return;
      const patched = { ...selectedCapture, [field]: value };
      const newCaptures = selectedCaptureMaskData.captures.map((c) => (c.id === selectedCapture.id ? patched : c));
      const newMaskData: LaurusMaskResult = { ...selectedCaptureMaskData, captures: newCaptures };
      dispatch({ type: CoreActionType.SetCanvasMask, key: selectedCaptureMaskKey, value: newMaskData });
      notifyMaskCaptureUpdated(selectedCaptureMaskKey, newMaskData);
      const polygonIndices = selectedCaptureMaskData.polygons.reduce<number[]>((acc, p, i) => {
        if (p.capture_id === selectedCapture.id) acc.push(i);
        return acc;
      }, []);
      pendingCaptureSaveRef.current = {
        maskKey: selectedCaptureMaskKey,
        maskMediaId: selectedCaptureMaskData.mask_media_id,
        captureId: selectedCapture.id,
        name: selectedCapture.name,
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
      selectedCaptureMaskKey,
      selectedCapture,
      selectedCaptureMaskData,
      dispatch,
      notifyMaskCaptureUpdated,
      persistCaptureQueue,
    ],
  );

  const captureResizeAnchorRef = useRef<{ captureId: number; cx: number; cy: number } | null>(null);
  const captureResizeAnchor = useCallback(() => {
    if (!selectedCapture || !selectedCaptureMaskData) return undefined;
    const held = captureResizeAnchorRef.current;
    if (held && held.captureId === selectedCapture.id) return held;
    const circle = capturedRegionCircle(selectedCaptureMaskData.polygons, selectedCapture.id);
    if (!circle) return undefined;
    const anchor = { captureId: selectedCapture.id, cx: circle.cx, cy: circle.cy };
    captureResizeAnchorRef.current = anchor;
    return anchor;
  }, [selectedCapture, selectedCaptureMaskData]);

  const captureIndicesForSize = useCallback(
    (size: number): number[] | undefined => {
      if (!selectedCaptureMaskData) return undefined;
      const anchor = captureResizeAnchor();
      if (!anchor) return undefined;
      const indices = captureTriangleIndicesInCircle(selectedCaptureMaskData.polygons, {
        cx: anchor.cx,
        cy: anchor.cy,
        radius: size / 2,
      });
      return indices.size === 0 ? undefined : [...indices];
    },
    [selectedCaptureMaskData, captureResizeAnchor],
  );

  const previewCaptureSizeChange = useCallback(
    (size: number) => {
      if (selectedCaptureMaskKey === undefined || !selectedCapture) return;
      const polygonIndices = captureIndicesForSize(size);
      if (!polygonIndices) return;
      notifyMaskPendingCaptureSet(selectedCaptureMaskKey, new Set(polygonIndices), selectedCapture.id);
    },
    [selectedCaptureMaskKey, selectedCapture, captureIndicesForSize, notifyMaskPendingCaptureSet],
  );

  const saveCaptureSizeField = useCallback(
    (size: number) => {
      if (selectedCaptureMaskKey === undefined || !selectedCapture || !selectedCaptureMaskData) return;
      const polygonIndices = captureIndicesForSize(size);
      if (!polygonIndices) {
        captureResizeAnchorRef.current = null;
        notifyMaskPendingCaptureCleared(selectedCaptureMaskKey);
        return;
      }

      const patched = { ...selectedCapture, size };
      const newCaptures = selectedCaptureMaskData.captures.map((c) => (c.id === selectedCapture.id ? patched : c));
      const newMaskData: LaurusMaskResult = { ...selectedCaptureMaskData, captures: newCaptures };
      dispatch({ type: CoreActionType.SetCanvasMask, key: selectedCaptureMaskKey, value: newMaskData });
      notifyMaskCaptureUpdated(selectedCaptureMaskKey, newMaskData);
      dispatch({
        type: CoreActionType.SetPendingLightSourceCapture,
        value: { maskKey: selectedCaptureMaskKey, captureId: selectedCapture.id, polygonIndices },
      });
      notifyMaskPendingCaptureSet(selectedCaptureMaskKey, new Set(polygonIndices), selectedCapture.id);

      pendingCaptureSaveRef.current = {
        maskKey: selectedCaptureMaskKey,
        maskMediaId: selectedCaptureMaskData.mask_media_id,
        captureId: selectedCapture.id,
        name: selectedCapture.name,
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
      selectedCaptureMaskKey,
      selectedCapture,
      selectedCaptureMaskData,
      captureIndicesForSize,
      dispatch,
      notifyMaskCaptureUpdated,
      notifyMaskPendingCaptureSet,
      notifyMaskPendingCaptureCleared,
      persistCaptureQueue,
    ],
  );

  const captureSizeValue = selectedCapture?.size ?? 0;
  const captureIntensityValue = selectedCapture?.intensity ?? 0;
  const handleCaptureIntensityChange = useCallback(
    (value: number) => saveCaptureField("intensity", value),
    [saveCaptureField],
  );
  const captureFalloffValue = selectedCapture?.falloff ?? 0;
  const handleCaptureFalloffChange = useCallback(
    (value: number) => saveCaptureField("falloff", value),
    [saveCaptureField],
  );
  const captureDarknessValue = selectedCapture?.darkness ?? 0;
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
      if (selectedPeakMaskKey === undefined || !selectedPeak) return undefined;
      return {
        maskKey: selectedPeakMaskKey,
        peakId: selectedPeak.id,
        cx: selectedPeak.cx,
        cy: selectedPeak.cy,
        radius: patch.radius ?? selectedPeak.radius,
        elevation: patch.elevation ?? selectedPeak.elevation,
        falloff: patch.falloff ?? selectedPeak.falloff,
        shape: selectedPeak.shape,
        blackPoint: patch.blackPoint ?? toPeakBlackPoint(selectedPeak),
      };
    },
    [selectedPeakMaskKey, selectedPeak],
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
  const elevationTitle = elevationValue.toFixed(0);
  const elevationRef = useRef<HTMLDivElement | null>(null);

  const radiusTrackRef = useRef<HTMLDivElement | null>(null);
  const radiusMax = selectedPeakMaskData
    ? Math.max(MIN_MASK_PEAK_RADIUS_PX + 1, Math.min(selectedPeakMaskData.width, selectedPeakMaskData.height))
    : MIN_MASK_PEAK_RADIUS_PX + 1;
  const { getTrackValue: getRadiusValue, getTrackCursor: getRadiusCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    radiusMax - MIN_MASK_PEAK_RADIUS_PX,
  );

  const radiusCursor = {
    x: getRadiusCursor((radiusValue ?? 0) - MIN_MASK_PEAK_RADIUS_PX, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const radiusTitle = (radiusValue ?? 0).toFixed(0) + "px";
  const radiusRef = useRef<HTMLDivElement | null>(null);

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
  const peakFalloffTitle = peakFalloffValue.toFixed(2);
  const peakFalloffRef = useRef<HTMLDivElement | null>(null);

  const blackPointRTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getBlackPointRValue, getTrackCursor: getBlackPointRCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const blackPointRCursor = { x: getBlackPointRCursor(blackPointValue.r, dynamicSizes.paramSize.containerWidth), y: 0 };
  const blackPointRTitle = blackPointValue.r.toFixed(2);
  const blackPointRRef = useRef<HTMLDivElement | null>(null);

  const blackPointGTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getBlackPointGValue, getTrackCursor: getBlackPointGCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const blackPointGCursor = { x: getBlackPointGCursor(blackPointValue.g, dynamicSizes.paramSize.containerWidth), y: 0 };
  const blackPointGTitle = blackPointValue.g.toFixed(2);
  const blackPointGRef = useRef<HTMLDivElement | null>(null);

  const blackPointBTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getBlackPointBValue, getTrackCursor: getBlackPointBCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const blackPointBCursor = { x: getBlackPointBCursor(blackPointValue.b, dynamicSizes.paramSize.containerWidth), y: 0 };
  const blackPointBTitle = blackPointValue.b.toFixed(2);
  const blackPointBRef = useRef<HTMLDivElement | null>(null);

  const blackPointATrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getBlackPointAValue, getTrackCursor: getBlackPointACursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const blackPointACursor = { x: getBlackPointACursor(blackPointValue.a, dynamicSizes.paramSize.containerWidth), y: 0 };
  const blackPointATitle = blackPointValue.a.toFixed(2);
  const blackPointARef = useRef<HTMLDivElement | null>(null);

  const previewSizeTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewSizeValue, getTrackCursor: getPreviewSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_PREVIEW_SIZE_MAX - CAPTURE_PREVIEW_SIZE_MIN,
  );
  const previewSizeCursor = {
    x: getPreviewSizeCursor(previewSizeValue - CAPTURE_PREVIEW_SIZE_MIN, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const previewSizeTitle = previewSizeValue.toFixed(1);
  const previewSizeRef = useRef<HTMLDivElement | null>(null);

  const previewIntensityTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewIntensityValue, getTrackCursor: getPreviewIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const previewIntensityCursor = {
    x: getPreviewIntensityCursor(previewIntensityValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const previewIntensityTitle = previewIntensityValue.toFixed(2);
  const previewIntensityRef = useRef<HTMLDivElement | null>(null);

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
  const previewFalloffTitle = previewFalloffValue.toFixed(1);
  const previewFalloffRef = useRef<HTMLDivElement | null>(null);

  const previewDarknessTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewDarknessValue, getTrackCursor: getPreviewDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const previewDarknessCursor = {
    x: getPreviewDarknessCursor(previewDarknessValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const previewDarknessTitle = previewDarknessValue.toFixed(2);
  const previewDarknessRef = useRef<HTMLDivElement | null>(null);

  const captureSizeMax = selectedCaptureMaskData
    ? Math.min(selectedCaptureMaskData.width, selectedCaptureMaskData.height)
    : CAPTURE_SIZE_MAX;
  const captureSizeTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getCaptureSizeValue, getTrackCursor: getCaptureSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    captureSizeMax,
  );
  const captureSizeCursor = { x: getCaptureSizeCursor(captureSizeValue, dynamicSizes.paramSize.containerWidth), y: 0 };
  const captureSizeTitle = captureSizeValue.toFixed(1);
  const captureSizeRef = useRef<HTMLDivElement | null>(null);

  const captureIntensityTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getCaptureIntensityValue, getTrackCursor: getCaptureIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_INTENSITY_MAX,
  );
  const captureIntensityCursor = {
    x: getCaptureIntensityCursor(captureIntensityValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const captureIntensityTitle = captureIntensityValue.toFixed(2);
  const captureIntensityRef = useRef<HTMLDivElement | null>(null);

  const captureFalloffMax = selectedCaptureMaskData
    ? Math.min(selectedCaptureMaskData.width, selectedCaptureMaskData.height)
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
  const captureFalloffTitle = captureFalloffValue.toFixed(1);
  const captureFalloffRef = useRef<HTMLDivElement | null>(null);

  const captureDarknessTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getCaptureDarknessValue, getTrackCursor: getCaptureDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    CAPTURE_DARKNESS_MAX,
  );
  const captureDarknessCursor = {
    x: getCaptureDarknessCursor(captureDarknessValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const captureDarknessTitle = captureDarknessValue.toFixed(2);
  const captureDarknessRef = useRef<HTMLDivElement | null>(null);

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
            : "targeting peaks -- double-click for captures"
        }
        onDoubleClick={() => {
          setTarget(target === "capture" ? "peak" : "capture");
        }}
        style={{ display: "grid", placeContent: "center", cursor: "pointer" }}
      >
        <SvgRepo
          svg={target === "capture" ? asterisk300() : antigravity300()}
          containerStyle={{
            width: dynamicSizes.svgSize.width,
            height: dynamicSizes.svgSize.height,
          }}
          scale={1}
          scaleToContaier={true}
        />
      </div>
      {target === "capture" ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              title={
                uiState.lightSourcePreview
                  ? "mouse over a mask to preview the light source there -- turn off to edit the selected capture's own starting parameters"
                  : "editing the selected capture's own starting parameters -- turn on to preview the light source by hovering a mask"
              }
              style={{
                textShadow: uiState.lightSourcePreview ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                userSelect: "none",
              }}
            >
              {"preview"}
            </span>
            <Toggle
              value={uiState.lightSourcePreview}
              onClick={() => {
                const next = !uiState.lightSourcePreview;
                uiDispatch({ type: UIActionType.SetLightSourcePreview, value: next });
                notifyMaskLightSourcePreviewToggled(next);
                if (next && (selectedElement?.type === "capture" || selectedElement?.type === "peak")) {
                  uiDispatch({ type: UIActionType.SetSelectedElement, value: undefined });
                  notifyMaskSelectionChanged(selectedElement.key);
                  notifyMaskSelectedCaptureChanged(selectedElement.key, undefined);
                  notifyMaskSelectedPeakChanged(selectedElement.key, undefined);
                }
              }}
              trackStyles={{ ...dynamicSizes.toggle.track }}
              buttonStyles={{ ...dynamicSizes.toggle.button }}
              translateX={dynamicSizes.toggle.translateX}
            />
          </div>
          {uiState.lightSourcePreview ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isPreviewControlsDisabled
                      ? "select or generate a mesh to set the size of its epicenter's bright core"
                      : "size of the epicenter's bright core, in on-screen pixels"
                  }
                  style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"size"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${targetMaskKey ?? "lightsourcebar"}|preview-size`}
                  size={dynamicSizes.paramSize}
                  containerRef={previewSizeTrackRef}
                  cursor={previewSizeCursor}
                  onCursorMove={(newCursor) => {
                    if (!previewSizeTrackRef.current || !previewSizeRef.current) return;
                    const val =
                      getPreviewSizeValue(newCursor.x, previewSizeTrackRef.current.clientWidth, 0) +
                      CAPTURE_PREVIEW_SIZE_MIN;
                    previewSizeRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewSizeTrackRef.current) return;
                    const newValue =
                      getPreviewSizeValue(newCursor.x, previewSizeTrackRef.current.clientWidth, 0) +
                      CAPTURE_PREVIEW_SIZE_MIN;
                    handlePreviewSizeChange(newValue);
                  }}
                  disabled={isPreviewControlsDisabled}
                  title={previewSizeTitle}
                  liveTitleRef={previewSizeRef}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isPreviewControlsDisabled
                      ? "select or generate a mesh to set the brightness of its epicenter's core"
                      : "brightness of the epicenter's core -- 100% is pure white"
                  }
                  style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"intensity"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${targetMaskKey ?? "lightsourcebar"}|preview-intensity`}
                  size={dynamicSizes.paramSize}
                  containerRef={previewIntensityTrackRef}
                  cursor={previewIntensityCursor}
                  onCursorMove={(newCursor) => {
                    if (!previewIntensityTrackRef.current || !previewIntensityRef.current) return;
                    const val = getPreviewIntensityValue(newCursor.x, previewIntensityTrackRef.current.clientWidth, 0);
                    previewIntensityRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewIntensityTrackRef.current) return;
                    const newValue = getPreviewIntensityValue(
                      newCursor.x,
                      previewIntensityTrackRef.current.clientWidth,
                      0,
                    );
                    handlePreviewIntensityChange(newValue);
                  }}
                  disabled={isPreviewControlsDisabled}
                  title={previewIntensityTitle}
                  liveTitleRef={previewIntensityRef}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isPreviewControlsDisabled
                      ? "select or generate a mesh to set how far its darkening falloffs out beyond the core"
                      : "distance the darkening takes to falloff out beyond the core, in on-screen pixels -- independent of canvas size"
                  }
                  style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"falloff"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${targetMaskKey ?? "lightsourcebar"}|preview-falloff`}
                  size={dynamicSizes.paramSize}
                  containerRef={previewFalloffTrackRef}
                  cursor={previewFalloffCursor}
                  onCursorMove={(newCursor) => {
                    if (!previewFalloffTrackRef.current || !previewFalloffRef.current) return;
                    const val =
                      getPreviewFalloffValue(newCursor.x, previewFalloffTrackRef.current.clientWidth, 0) +
                      CAPTURE_PREVIEW_FALLOFF_MIN;
                    previewFalloffRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewFalloffTrackRef.current) return;
                    const newValue =
                      getPreviewFalloffValue(newCursor.x, previewFalloffTrackRef.current.clientWidth, 0) +
                      CAPTURE_PREVIEW_FALLOFF_MIN;
                    handlePreviewFalloffChange(newValue);
                  }}
                  disabled={isPreviewControlsDisabled}
                  title={previewFalloffTitle}
                  liveTitleRef={previewFalloffRef}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isPreviewControlsDisabled
                      ? "select or generate a mesh to set the strength of its darkening at the far edge of the falloff"
                      : "strength of the darkening at the far edge of the falloff -- 100% drives it fully to black"
                  }
                  style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"darkness"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${targetMaskKey ?? "lightsourcebar"}|preview-darkness`}
                  size={dynamicSizes.paramSize}
                  containerRef={previewDarknessTrackRef}
                  cursor={previewDarknessCursor}
                  onCursorMove={(newCursor) => {
                    if (!previewDarknessTrackRef.current || !previewDarknessRef.current) return;
                    const val = getPreviewDarknessValue(newCursor.x, previewDarknessTrackRef.current.clientWidth, 0);
                    previewDarknessRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewDarknessTrackRef.current) return;
                    const newValue = getPreviewDarknessValue(
                      newCursor.x,
                      previewDarknessTrackRef.current.clientWidth,
                      0,
                    );
                    handlePreviewDarknessChange(newValue);
                  }}
                  disabled={isPreviewControlsDisabled}
                  title={previewDarknessTitle}
                  liveTitleRef={previewDarknessRef}
                />
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isCaptureParamDisabled
                      ? "select a capture on the mesh to resize it"
                      : "how wide this capture is -- resizes the region of triangles it owns, and with it the epicenter core a wired light_source effect ramps from"
                  }
                  style={{ opacity: isCaptureParamDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"size"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedCaptureMaskKey ?? "lightsourcebar"}|capture-size|${selectedCapture?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={captureSizeTrackRef}
                  cursor={captureSizeCursor}
                  onCursorMove={(newCursor) => {
                    if (!captureSizeTrackRef.current) return;
                    const newValue = getCaptureSizeValue(newCursor.x, captureSizeTrackRef.current.clientWidth, 0);
                    previewCaptureSizeChange(newValue);
                    if (captureSizeRef.current) captureSizeRef.current.innerHTML = newValue.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!captureSizeTrackRef.current) return;
                    const newValue = getCaptureSizeValue(newCursor.x, captureSizeTrackRef.current.clientWidth, 0);
                    saveCaptureSizeField(newValue);
                  }}
                  disabled={isCaptureParamDisabled}
                  title={captureSizeTitle}
                  liveTitleRef={captureSizeRef}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isCaptureParamDisabled
                      ? "select a capture on the mesh to set the brightness of its own epicenter's core"
                      : "brightness of this capture's own epicenter core -- 100% is pure white"
                  }
                  style={{ opacity: isCaptureParamDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"intensity"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedCaptureMaskKey ?? "lightsourcebar"}|capture-intensity|${selectedCapture?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={captureIntensityTrackRef}
                  cursor={captureIntensityCursor}
                  onCursorMove={(newCursor) => {
                    if (!captureIntensityTrackRef.current || !captureIntensityRef.current) return;
                    const val = getCaptureIntensityValue(newCursor.x, captureIntensityTrackRef.current.clientWidth, 0);
                    captureIntensityRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!captureIntensityTrackRef.current) return;
                    const newValue = getCaptureIntensityValue(
                      newCursor.x,
                      captureIntensityTrackRef.current.clientWidth,
                      0,
                    );
                    handleCaptureIntensityChange(newValue);
                  }}
                  disabled={isCaptureParamDisabled}
                  title={captureIntensityTitle}
                  liveTitleRef={captureIntensityRef}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isCaptureParamDisabled
                      ? "select a capture on the mesh to set how far its own darkening falloffs out beyond the core"
                      : "distance this capture's own darkening takes to falloff out beyond the core, in on-screen pixels"
                  }
                  style={{ opacity: isCaptureParamDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"falloff"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedCaptureMaskKey ?? "lightsourcebar"}|capture-falloff|${selectedCapture?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={captureFalloffTrackRef}
                  cursor={captureFalloffCursor}
                  onCursorMove={(newCursor) => {
                    if (!captureFalloffTrackRef.current || !captureFalloffRef.current) return;
                    const val = getCaptureFalloffValue(newCursor.x, captureFalloffTrackRef.current.clientWidth, 0);
                    captureFalloffRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!captureFalloffTrackRef.current) return;
                    const newValue = getCaptureFalloffValue(newCursor.x, captureFalloffTrackRef.current.clientWidth, 0);
                    handleCaptureFalloffChange(newValue);
                  }}
                  disabled={isCaptureParamDisabled}
                  title={captureFalloffTitle}
                  liveTitleRef={captureFalloffRef}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                  ...dynamicSizes.toggle.div,
                }}
              >
                <span
                  title={
                    isCaptureParamDisabled
                      ? "select a capture on the mesh to set the strength of its own darkening at the far edge of the falloff"
                      : "strength of this capture's own darkening at the far edge of the falloff -- 100% drives it fully to black"
                  }
                  style={{ opacity: isCaptureParamDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"darkness"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedCaptureMaskKey ?? "lightsourcebar"}|capture-darkness|${selectedCapture?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={captureDarknessTrackRef}
                  cursor={captureDarknessCursor}
                  onCursorMove={(newCursor) => {
                    if (!captureDarknessTrackRef.current || !captureDarknessRef.current) return;
                    const val = getCaptureDarknessValue(newCursor.x, captureDarknessTrackRef.current.clientWidth, 0);
                    captureDarknessRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!captureDarknessTrackRef.current) return;
                    const newValue = getCaptureDarknessValue(
                      newCursor.x,
                      captureDarknessTrackRef.current.clientWidth,
                      0,
                    );
                    handleCaptureDarknessChange(newValue);
                  }}
                  disabled={isCaptureParamDisabled}
                  title={captureDarknessTitle}
                  liveTitleRef={captureDarknessRef}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: isPeakParamDisabled ? 0.3 : 1, userSelect: "none" }}>{"elevation"}</span>
            <ParameterSliderXPlusMinus
              resolution={{ ...uiState.resolution }}
              hash={`${selectedPeakMaskKey ?? "lightsourcebar"}|elevation|${selectedPeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={elevationTrackRef}
              cursor={elevationCursor}
              onCursorMove={(newCursor) => {
                if (!elevationTrackRef.current) return;
                const newValue = elevationFromTrack(newCursor.x, elevationTrackRef.current.clientWidth);
                previewPeakChange({ elevation: newValue });
                if (elevationRef.current) elevationRef.current.innerHTML = newValue.toFixed(0);
              }}
              onNewCursor={(newCursor) => {
                if (!elevationTrackRef.current) return;
                savePeakField({
                  elevation: elevationFromTrack(newCursor.x, elevationTrackRef.current.clientWidth),
                });
              }}
              disabled={isPeakParamDisabled}
              title={elevationTitle}
              liveTitleRef={elevationRef}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              title={"how far the selected peak's own influence reaches"}
              style={{ opacity: isRadiusDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"radius"}
            </span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${selectedPeakMaskKey ?? "lightsourcebar"}|radius|${selectedPeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={radiusTrackRef}
              cursor={radiusCursor}
              onCursorMove={(newCursor) => {
                if (!radiusTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_RADIUS_PX + getRadiusValue(newCursor.x, radiusTrackRef.current.clientWidth, 0);
                previewPeakChange({ radius: newValue });
                if (radiusRef.current) radiusRef.current.innerHTML = newValue.toFixed(0) + "px";
              }}
              onNewCursor={(newCursor) => {
                if (!radiusTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_RADIUS_PX + getRadiusValue(newCursor.x, radiusTrackRef.current.clientWidth, 0);
                savePeakField({ radius: newValue });
              }}
              disabled={isRadiusDisabled}
              title={radiusTitle}
              liveTitleRef={radiusRef}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              title={"the selected peak's own profile - low is a broad dome with a visible rim, high is a needle"}
              style={{ opacity: isPeakParamDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"falloff"}
            </span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${selectedPeakMaskKey ?? "lightsourcebar"}|peak-falloff|${selectedPeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={peakFalloffTrackRef}
              cursor={peakFalloffCursor}
              onCursorMove={(newCursor) => {
                if (!peakFalloffTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_FALLOFF + getPeakFalloffValue(newCursor.x, peakFalloffTrackRef.current.clientWidth, 0);
                previewPeakChange({ falloff: newValue });
                if (peakFalloffRef.current) peakFalloffRef.current.innerHTML = newValue.toFixed(2);
              }}
              onNewCursor={(newCursor) => {
                if (!peakFalloffTrackRef.current) return;
                const newValue =
                  MIN_MASK_PEAK_FALLOFF + getPeakFalloffValue(newCursor.x, peakFalloffTrackRef.current.clientWidth, 0);
                savePeakField({ falloff: newValue });
              }}
              disabled={isPeakParamDisabled}
              title={peakFalloffTitle}
              liveTitleRef={peakFalloffRef}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              title={"the strength of red in the selected peak's black point"}
              style={{ opacity: isPeakParamDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"r"}
            </span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${selectedPeakMaskKey ?? "lightsourcebar"}|peak-black-point-r|${selectedPeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={blackPointRTrackRef}
              cursor={blackPointRCursor}
              onCursorMove={(newCursor) => {
                if (!blackPointRTrackRef.current) return;
                const newValue = getBlackPointRValue(newCursor.x, blackPointRTrackRef.current.clientWidth, 0);
                previewPeakChange({ blackPoint: { ...blackPointValue, r: newValue } });
                if (blackPointRRef.current) blackPointRRef.current.innerHTML = newValue.toFixed(2);
              }}
              onNewCursor={(newCursor) => {
                if (!blackPointRTrackRef.current) return;
                const newValue = getBlackPointRValue(newCursor.x, blackPointRTrackRef.current.clientWidth, 0);
                savePeakField({ blackPoint: { ...blackPointValue, r: newValue } });
              }}
              disabled={isPeakParamDisabled}
              title={blackPointRTitle}
              liveTitleRef={blackPointRRef}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              title={"the strength of green in the selected peak's black point"}
              style={{ opacity: isPeakParamDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"g"}
            </span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${selectedPeakMaskKey ?? "lightsourcebar"}|peak-black-point-g|${selectedPeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={blackPointGTrackRef}
              cursor={blackPointGCursor}
              onCursorMove={(newCursor) => {
                if (!blackPointGTrackRef.current) return;
                const newValue = getBlackPointGValue(newCursor.x, blackPointGTrackRef.current.clientWidth, 0);
                previewPeakChange({ blackPoint: { ...blackPointValue, g: newValue } });
                if (blackPointGRef.current) blackPointGRef.current.innerHTML = newValue.toFixed(2);
              }}
              onNewCursor={(newCursor) => {
                if (!blackPointGTrackRef.current) return;
                const newValue = getBlackPointGValue(newCursor.x, blackPointGTrackRef.current.clientWidth, 0);
                savePeakField({ blackPoint: { ...blackPointValue, g: newValue } });
              }}
              disabled={isPeakParamDisabled}
              title={blackPointGTitle}
              liveTitleRef={blackPointGRef}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              title={"the strength of blue in the selected peak's black point"}
              style={{ opacity: isPeakParamDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"b"}
            </span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${selectedPeakMaskKey ?? "lightsourcebar"}|peak-black-point-b|${selectedPeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={blackPointBTrackRef}
              cursor={blackPointBCursor}
              onCursorMove={(newCursor) => {
                if (!blackPointBTrackRef.current) return;
                const newValue = getBlackPointBValue(newCursor.x, blackPointBTrackRef.current.clientWidth, 0);
                previewPeakChange({ blackPoint: { ...blackPointValue, b: newValue } });
                if (blackPointBRef.current) blackPointBRef.current.innerHTML = newValue.toFixed(2);
              }}
              onNewCursor={(newCursor) => {
                if (!blackPointBTrackRef.current) return;
                const newValue = getBlackPointBValue(newCursor.x, blackPointBTrackRef.current.clientWidth, 0);
                savePeakField({ blackPoint: { ...blackPointValue, b: newValue } });
              }}
              disabled={isPeakParamDisabled}
              title={blackPointBTitle}
              liveTitleRef={blackPointBRef}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              title={
                "how strongly the selected peak's black point is applied -- 0 leaves the peak unaffected, 100% drives its floor fully to that colour"
              }
              style={{ opacity: isPeakParamDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"a"}
            </span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${selectedPeakMaskKey ?? "lightsourcebar"}|peak-black-point-a|${selectedPeak?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={blackPointATrackRef}
              cursor={blackPointACursor}
              onCursorMove={(newCursor) => {
                if (!blackPointATrackRef.current) return;
                const newValue = getBlackPointAValue(newCursor.x, blackPointATrackRef.current.clientWidth, 0);
                previewPeakChange({ blackPoint: { ...blackPointValue, a: newValue } });
                if (blackPointARef.current) blackPointARef.current.innerHTML = newValue.toFixed(2);
              }}
              onNewCursor={(newCursor) => {
                if (!blackPointATrackRef.current) return;
                const newValue = getBlackPointAValue(newCursor.x, blackPointATrackRef.current.clientWidth, 0);
                savePeakField({ blackPoint: { ...blackPointValue, a: newValue } });
              }}
              disabled={isPeakParamDisabled}
              title={blackPointATitle}
              liveTitleRef={blackPointARef}
            />
          </div>
        </>
      )}
    </div>
  );
}
