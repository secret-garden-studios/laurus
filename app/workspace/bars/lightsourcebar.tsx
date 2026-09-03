import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext, SocketContext } from "../workspace.client";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { CoreActionType, PendingTopologyEdit } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { SvgRepo, asterisk300, antigravity300 } from "@/app/svg-repo";
import { ParameterSliderX, ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { ColorPickerButton } from "../../components/color-picker";
import { LaurusColor } from "../../components/color-utils";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import { UNAUTHORIZED_EDIT } from "@/app/landing.server";
import {
  LIGHT_CAST_ENDLESS,
  LIGHT_CAST_OPTIONS,
  MAX_MASK_OBJECT_ELEVATION,
  MAX_MASK_OBJECT_FALLOFF,
  MIN_MASK_OBJECT_FALLOFF,
} from "../mask-gl";
import { applyLightDelta, applyObjectDelta } from "../canvas-media/mask-delta";
import { polygonIndicesForLight, polygonIndicesForObject } from "../canvas-media/mask-geometry";
import {
  LaurusLight,
  LaurusMaskResult,
  LaurusObject,
  LaurusObjectFill,
  newObject,
  toLightUpdate,
  toObjectFill,
  toObjectFillFields,
  toObjectUpdate,
} from "../workspace.server";
import Toggle from "@/app/components/toggle";
import { LIGHT_SHADOW_MAX, LIGHT_SPREAD_MAX, LIGHT_INTENSITY_MAX } from "../workspace.config";
import { dellaRespira, italiana } from "@/app/fonts";

const GRIDLINES_OPTIONS = [
  { label: "off", value: 0 },
  { label: "dim", value: 0.5 },
  { label: "bright", value: 1 },
] as const;

const LIGHT_PREVIEW_SIZE_MIN = 10;
const LIGHT_PREVIEW_SIZE_MAX = 300;
const LIGHT_PREVIEW_SPREAD_MIN = 20;
const LIGHT_PREVIEW_SPREAD_MAX = 1000;

export default function LightSourcebar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreState, dispatch } = useContext(CoreContext);
  const latestCanvasMasksRef = useRef(coreState.canvasMasks);
  latestCanvasMasksRef.current = coreState.canvasMasks;
  const { sendMaskLightUpdate, sendMaskObjectUpdate } = useContext(SocketContext);
  const { selectedMaskKeys, mostRecentlyHoveredMaskKey } = useContext(HoverContext);
  const {
    notifyMaskAppearanceChanged,
    notifyMaskLightSourcePreviewToggled,
    notifyMaskLightUpdated,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskObjectsUpdated,
    notifyMaskHighlightSuppressed,
    convertLightToObject,
    convertObjectToLight,
    ...mask
  } = useContext(MaskContext);
  const [target, setTarget] = useState<"light" | "object">("light");
  const [isConverting, setIsConverting] = useState(false);
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
          paramPlusMinueSize: {
            containerHeight: 38,
            containerWidth: 190,
            capWidth: 17,
            capHeight: 17,
            capBorderOffset: 0,
            trackHeight: 1,
            tickHeight: 24,
            tickLeft: 2,
            svgSize: { width: 24, height: 24 },
          },
          colorPicker: { planeHeight: 150, stripHeight: 14, capSize: 14, gap: 8 },
          colorPickerPanel: { width: 250, padding: 10 },
          colorPickerSwatch: 20,
          colorPickerReadout: 13,
          segment: { fontSize: 12 },
          symbolSegment: { fontSize: 16 },
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
            tickHeight: 0,
            tickLeft: 1,
            svgSize: { width: 20, height: 20 },
          },
          paramPlusMinueSize: {
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
          colorPicker: { planeHeight: 115, stripHeight: 12, capSize: 12, gap: 6 },
          colorPickerPanel: { width: 195, padding: 8 },
          colorPickerSwatch: 16,
          colorPickerReadout: 11,
          segment: { fontSize: 11 },
          symbolSegment: { fontSize: 13 },
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
            tickHeight: 0,
            tickLeft: 1,
            svgSize: { width: 20, height: 20 },
          },
          paramPlusMinueSize: {
            containerHeight: 38,
            containerWidth: 190,
            capWidth: 17,
            capHeight: 17,
            capBorderOffset: 0,
            trackHeight: 1,
            tickHeight: 20,
            tickLeft: 2,
            svgSize: { width: 24, height: 24 },
          },
          colorPicker: { planeHeight: 100, stripHeight: 10, capSize: 10, gap: 5 },
          colorPickerPanel: { width: 175, padding: 7 },
          colorPickerSwatch: 15,
          colorPickerReadout: 10,
          segment: { fontSize: 11 },
          symbolSegment: { fontSize: 13 },
        };
    }
  });

  const hasMesh = mask.status === "streaming" || mask.status === "done";
  const selectedElement = uiState.selectedElement;
  const selectedLightMaskKey = selectedElement?.type === "light" ? selectedElement.key : undefined;
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const targetMaskKey = selectedLightMaskKey ?? mostRecentlyHoveredMaskKey ?? selectedMaskKey;
  const targetMaskMeta = targetMaskKey !== undefined ? coreState.project.masks.get(targetMaskKey) : undefined;
  const isPreviewControlsDisabled = !(targetMaskKey !== undefined || hasMesh);
  const isGuest = !coreState.accessToken;
  const selectedLightMaskData =
    selectedLightMaskKey !== undefined ? coreState.canvasMasks.get(selectedLightMaskKey) : undefined;
  const selectedLight =
    selectedElement?.type === "light"
      ? selectedLightMaskData?.lights.find((c) => c.id === selectedElement.lightId)
      : undefined;
  const isLightParamDisabled = !selectedLight;
  const selectedObjectMaskKey = selectedElement?.type === "object" ? selectedElement.key : undefined;
  const selectedObjectMaskData =
    selectedObjectMaskKey !== undefined ? coreState.canvasMasks.get(selectedObjectMaskKey) : undefined;
  const selectedObject =
    selectedElement?.type === "object"
      ? selectedObjectMaskData?.objects.find((p) => p.id === selectedElement.objectId)
      : undefined;
  const isRaisingObjects = uiState.tool.type === "mask" && uiState.tool.raisingObjects;
  const isObjectParamDisabled = !selectedObject && !isRaisingObjects;
  const isCopying = uiState.tool.type === "light_source" && uiState.tool.copy;
  const isBusy = isCopying || isConverting;
  const isLightControlsDisabled = isLightParamDisabled || isBusy;
  const isObjectControlsDisabled = isObjectParamDisabled || isBusy;

  const editableLight = useMemo(() => {
    if (uiState.maskEdit !== undefined) return undefined;
    if (!selectedLight || selectedLightMaskKey === undefined || !selectedLightMaskData) return undefined;
    return {
      maskMediaId: selectedLightMaskData.mask_media_id,
      light: selectedLight,
      polygonIndices: polygonIndicesForLight(selectedLightMaskData.polygons, selectedLight.id),
    };
  }, [uiState.maskEdit, selectedLight, selectedLightMaskKey, selectedLightMaskData]);

  const editableObject = useMemo(() => {
    if (uiState.maskEdit !== undefined) return undefined;
    if (!selectedObject || selectedObjectMaskKey === undefined || !selectedObjectMaskData) return undefined;
    return {
      maskMediaId: selectedObjectMaskData.mask_media_id,
      object: selectedObject,
      polygonIndices: polygonIndicesForObject(selectedObjectMaskData.polygons, selectedObject.id),
    };
  }, [uiState.maskEdit, selectedObject, selectedObjectMaskKey, selectedObjectMaskData]);

  const pendingObjectEdit =
    selectedObject &&
    selectedObjectMaskKey !== undefined &&
    coreState.pendingTopologyEdit?.maskKey === selectedObjectMaskKey &&
    coreState.pendingTopologyEdit?.objectId === selectedObject.id
      ? coreState.pendingTopologyEdit
      : undefined;
  const elevationValue = pendingObjectEdit?.elevation ?? selectedObject?.elevation ?? uiState.stagedObject.elevation;
  const objectFalloffValue = pendingObjectEdit?.falloff ?? selectedObject?.falloff ?? uiState.stagedObject.falloff;
  const fillValue =
    pendingObjectEdit?.fill ?? (selectedObject ? toObjectFill(selectedObject) : uiState.stagedObject.fill);
  const selectedSubElement =
    selectedElement?.type === "light"
      ? `light|${selectedElement.key}|${selectedElement.lightId}`
      : selectedElement?.type === "object"
        ? `object|${selectedElement.key}|${selectedElement.objectId}`
        : undefined;
  const [prevSelectedSubElement, setPrevSelectedSubElement] = useState<string | undefined>(undefined);
  const [pendingLift, setPendingLift] = useState<boolean | undefined>(undefined);

  // BETA: render-phase state adjustment pattern
  if (selectedSubElement !== prevSelectedSubElement) {
    setPrevSelectedSubElement(selectedSubElement);
    setPendingLift(undefined);
    if (selectedSubElement !== undefined) {
      setTarget(selectedSubElement.startsWith("object|") ? "object" : "light");
    }
  }

  const liftValue = pendingLift ?? selectedObject?.lift ?? true;
  const isLiftDisabled = !selectedObject || pendingLift !== undefined || isBusy;

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
        | "light_preview_size"
        | "light_preview_intensity"
        | "light_preview_spread"
        | "light_preview_shadow"
        | "light_preview_cast",
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
        light: {
          size: newMaskMeta.light_preview_size,
          intensity: newMaskMeta.light_preview_intensity,
          spread: newMaskMeta.light_preview_spread,
          shadow: newMaskMeta.light_preview_shadow,
          cast: newMaskMeta.light_preview_cast,
        },
      });

      if (isGuest) return;

      pendingPreviewSaveRef.current = newProject;
      void persistPreviewQueue();
    },
    [isGuest, targetMaskKey, coreState.project, dispatch, notifyMaskAppearanceChanged, persistPreviewQueue],
  );

  const previewSizeValue = targetMaskMeta ? targetMaskMeta.light_preview_size : mask.lightSize;
  const handlePreviewSizeChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("light_preview_size", value);
      } else {
        mask.setLightSize(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewIntensityValue = targetMaskMeta ? targetMaskMeta.light_preview_intensity : mask.lightIntensity;
  const handlePreviewIntensityChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("light_preview_intensity", value);
      } else {
        mask.setLightIntensity(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewSpreadValue = targetMaskMeta ? targetMaskMeta.light_preview_spread : mask.lightSpread;
  const handlePreviewSpreadChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("light_preview_spread", value);
      } else {
        mask.setLightSpread(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewShadowValue = targetMaskMeta ? targetMaskMeta.light_preview_shadow : mask.lightShadow;
  const handlePreviewShadowChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("light_preview_shadow", value);
      } else {
        mask.setLightShadow(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewCastValue = targetMaskMeta ? targetMaskMeta.light_preview_cast : mask.lightCast;
  const handlePreviewCastChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("light_preview_cast", value);
      } else {
        mask.setLightCast(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );

  interface PendingLightSave {
    maskKey: string;
    maskMediaId: string;
    light: LaurusLight;
    polygonIndices: number[];
  }
  const pendingLightSaveRef = useRef<PendingLightSave | null>(null);
  const isPersistingLightRef = useRef(false);
  const persistLightQueue = useCallback(async () => {
    if (isPersistingLightRef.current) return;
    isPersistingLightRef.current = true;
    try {
      while (pendingLightSaveRef.current) {
        const toSave = pendingLightSaveRef.current;
        pendingLightSaveRef.current = null;
        const updated = await sendMaskLightUpdate(
          toSave.maskMediaId,
          toLightUpdate(toSave.light, { polygon_indices: toSave.polygonIndices }),
        );
        if (!updated) {
          console.error("failed to save light change", { light_id: toSave.light.id });
          continue;
        }
        if (pendingLightSaveRef.current) continue;
        const maskData = latestCanvasMasksRef.current.get(toSave.maskKey);
        if (!maskData) continue;
        const patched = applyLightDelta(maskData, updated);
        dispatch({ type: CoreActionType.SetCanvasMask, key: toSave.maskKey, value: patched });
        notifyMaskLightUpdated(toSave.maskKey, patched);
      }
    } finally {
      isPersistingLightRef.current = false;
    }
  }, [sendMaskLightUpdate, dispatch, notifyMaskLightUpdated]);

  const saveLightField = useCallback(
    (field: "intensity" | "spread" | "shadow" | "cast", value: number) => {
      if (selectedLightMaskKey === undefined || !selectedLight || !selectedLightMaskData) return;

      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }
      const patched = { ...selectedLight, [field]: value };
      const newLights = selectedLightMaskData.lights.map((c) => (c.id === selectedLight.id ? patched : c));
      const newMaskData: LaurusMaskResult = { ...selectedLightMaskData, lights: newLights };
      dispatch({ type: CoreActionType.SetCanvasMask, key: selectedLightMaskKey, value: newMaskData });
      notifyMaskLightUpdated(selectedLightMaskKey, newMaskData);
      const polygonIndices = selectedLightMaskData.polygons.reduce<number[]>((acc, p, i) => {
        if (p.light_id === selectedLight.id) acc.push(i);
        return acc;
      }, []);
      pendingLightSaveRef.current = {
        maskKey: selectedLightMaskKey,
        maskMediaId: selectedLightMaskData.mask_media_id,
        light: patched,
        polygonIndices,
      };
      void persistLightQueue();
    },
    [
      isGuest,
      selectedLightMaskKey,
      selectedLight,
      selectedLightMaskData,
      dispatch,
      notifyMaskLightUpdated,
      persistLightQueue,
    ],
  );

  const lightIntensityValue = selectedLight?.intensity ?? 0;
  const handleLightIntensityChange = useCallback(
    (value: number) => saveLightField("intensity", value),
    [saveLightField],
  );
  const lightSpreadValue = selectedLight?.spread ?? 0;
  const handleLightSpreadChange = useCallback((value: number) => saveLightField("spread", value), [saveLightField]);
  const lightShadowValue = selectedLight?.shadow ?? 0;
  const handleLightShadowChange = useCallback((value: number) => saveLightField("shadow", value), [saveLightField]);
  const lightCastValue = selectedLight?.cast ?? LIGHT_CAST_ENDLESS;
  const handleLightCastChange = useCallback((value: number) => saveLightField("cast", value), [saveLightField]);

  type ObjectPatch = {
    elevation?: number;
    falloff?: number;
    fill?: LaurusObjectFill;
    lift?: boolean;
  };

  const toStagedObjectPatch = useCallback(
    (patch: ObjectPatch) => ({
      ...(patch.elevation !== undefined ? { elevation: patch.elevation } : {}),
      ...(patch.falloff !== undefined ? { falloff: patch.falloff } : {}),
      ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
    }),
    [],
  );

  interface PendingObjectSave {
    maskKey: string;
    maskMediaId: string;
    object: LaurusObject;
    polygonIndices: number[];
  }

  const pendingObjectSaveRef = useRef<PendingObjectSave | null>(null);
  const isPersistingObjectRef = useRef(false);
  const persistObjectQueue = useCallback(async () => {
    if (isPersistingObjectRef.current) return;
    isPersistingObjectRef.current = true;
    let settledMaskKey: string | undefined;
    try {
      while (pendingObjectSaveRef.current) {
        const toSave = pendingObjectSaveRef.current;
        pendingObjectSaveRef.current = null;
        settledMaskKey = toSave.maskKey;
        const updated = await sendMaskObjectUpdate(
          toSave.maskMediaId,
          toObjectUpdate(toSave.object, { polygon_indices: toSave.polygonIndices }),
        );
        if (!updated) {
          console.error("failed to save object change", { object_id: toSave.object.id });
          continue;
        }
        if (pendingObjectSaveRef.current) continue;
        const maskData = latestCanvasMasksRef.current.get(toSave.maskKey);
        if (!maskData) continue;
        const patched = applyObjectDelta(maskData, updated);
        dispatch({ type: CoreActionType.SetCanvasMask, key: toSave.maskKey, value: patched });
        notifyMaskObjectsUpdated(toSave.maskKey, patched);
      }
    } finally {
      isPersistingObjectRef.current = false;
      setPendingLift(undefined);
      if (settledMaskKey !== undefined) {
        dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
        notifyMaskPendingTopologyCleared(settledMaskKey);
      }
    }
  }, [sendMaskObjectUpdate, dispatch, notifyMaskObjectsUpdated, notifyMaskPendingTopologyCleared]);

  const selectedObjectPolygonIndices = useMemo(
    () =>
      selectedObject && selectedObjectMaskData
        ? new Set(polygonIndicesForObject(selectedObjectMaskData.polygons, selectedObject.id))
        : undefined,
    [selectedObject, selectedObjectMaskData],
  );

  const mergeObjectPatch = useCallback(
    (patch: ObjectPatch): PendingTopologyEdit | undefined => {
      if (selectedObjectMaskKey === undefined || !selectedObject) return undefined;
      return {
        maskKey: selectedObjectMaskKey,
        objectId: selectedObject.id,
        cx: selectedObject.cx,
        cy: selectedObject.cy,
        radius: selectedObject.radius,
        elevation: patch.elevation ?? selectedObject.elevation,
        falloff: patch.falloff ?? selectedObject.falloff,
        shape: selectedObject.shape,
        fill: patch.fill ?? toObjectFill(selectedObject),
        polygonIndices: selectedObjectPolygonIndices,
      };
    },
    [selectedObjectMaskKey, selectedObject, selectedObjectPolygonIndices],
  );

  const saveObjectField = useCallback(
    (patch: ObjectPatch): boolean => {
      const edit = mergeObjectPatch(patch);
      if (!edit) {
        uiDispatch({ type: UIActionType.SetStagedObject, value: toStagedObjectPatch(patch) });
        return true;
      }
      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return false;
      }
      const maskData = coreState.canvasMasks.get(edit.maskKey);
      if (!maskData) return false;

      dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
      notifyMaskPendingTopologySet(edit.maskKey, edit);

      const existingObject = maskData.objects.find((p) => p.id === edit.objectId);
      const objectName = existingObject?.name ?? `object ${edit.objectId}`;

      const polygonIndices = maskData.polygons.reduce<number[]>((indices, p, i) => {
        if (p.object_id === edit.objectId) indices.push(i);
        return indices;
      }, []);

      const base: LaurusObject = existingObject ?? { ...newObject(edit.objectId, objectName), lift: false };
      pendingObjectSaveRef.current = {
        maskKey: edit.maskKey,
        maskMediaId: maskData.mask_media_id,
        object: {
          ...base,
          name: objectName,
          cx: edit.cx,
          cy: edit.cy,
          radius: edit.radius,
          elevation: edit.elevation,
          falloff: edit.falloff,
          shape: edit.shape,
          ...toObjectFillFields(edit.fill),
          lift: patch.lift ?? base.lift,
        },
        polygonIndices,
      };
      void persistObjectQueue();
      return true;
    },
    [
      isGuest,
      mergeObjectPatch,
      coreState.canvasMasks,
      dispatch,
      notifyMaskPendingTopologySet,
      uiDispatch,
      persistObjectQueue,
      toStagedObjectPatch,
    ],
  );

  const previewObjectChange = useCallback(
    (patch: ObjectPatch) => {
      const edit = mergeObjectPatch(patch);
      if (edit) {
        notifyMaskPendingTopologySet(edit.maskKey, edit);
      } else {
        uiDispatch({ type: UIActionType.SetStagedObject, value: toStagedObjectPatch(patch) });
      }
    },
    [mergeObjectPatch, notifyMaskPendingTopologySet, uiDispatch, toStagedObjectPatch],
  );

  const elevationTrackRef = useRef<HTMLDivElement | null>(null);

  const elevationSpan = MAX_MASK_OBJECT_ELEVATION * 2;
  const elevationSnap = elevationSpan * 0.03;
  const { getTrackValue: getElevationValue, getTrackCursor: getElevationCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    elevationSpan,
  );
  const elevationFromTrack = useCallback(
    (cursorX: number, trackWidth: number) => {
      const centered = getElevationValue(cursorX, trackWidth, 0) - MAX_MASK_OBJECT_ELEVATION;
      return Math.abs(centered) <= elevationSnap ? 0 : centered;
    },
    [getElevationValue, elevationSnap],
  );
  const elevationToTrack = useCallback(
    (value: number, trackWidth: number) => getElevationCursor(value + MAX_MASK_OBJECT_ELEVATION, trackWidth),
    [getElevationCursor],
  );
  const elevationCursor = { x: elevationToTrack(elevationValue, dynamicSizes.paramSize.containerWidth), y: 0 };
  const elevationTitle = elevationValue.toFixed(0);
  const elevationRef = useRef<HTMLDivElement | null>(null);

  const objectFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const objectFalloffSpan = MAX_MASK_OBJECT_FALLOFF - MIN_MASK_OBJECT_FALLOFF;
  const { getTrackValue: getObjectFalloffValue, getTrackCursor: getObjectFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    objectFalloffSpan,
  );
  const objectFalloffCursor = {
    x: getObjectFalloffCursor(objectFalloffValue - MIN_MASK_OBJECT_FALLOFF, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const objectFalloffTitle = objectFalloffValue.toFixed(2);
  const objectFalloffRef = useRef<HTMLDivElement | null>(null);

  const previewSizeTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewSizeValue, getTrackCursor: getPreviewSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_PREVIEW_SIZE_MAX - LIGHT_PREVIEW_SIZE_MIN,
  );
  const previewSizeCursor = {
    x: getPreviewSizeCursor(previewSizeValue - LIGHT_PREVIEW_SIZE_MIN, dynamicSizes.paramSize.containerWidth),
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

  const previewSpreadTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewSpreadValue, getTrackCursor: getPreviewSpreadCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_PREVIEW_SPREAD_MAX - LIGHT_PREVIEW_SPREAD_MIN,
  );
  const previewSpreadCursor = {
    x: getPreviewSpreadCursor(previewSpreadValue - LIGHT_PREVIEW_SPREAD_MIN, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const previewSpreadTitle = previewSpreadValue.toFixed(1);
  const previewSpreadRef = useRef<HTMLDivElement | null>(null);

  const previewShadowTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewShadowValue, getTrackCursor: getPreviewShadowCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  const previewShadowCursor = {
    x: getPreviewShadowCursor(previewShadowValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const previewShadowTitle = previewShadowValue.toFixed(2);
  const previewShadowRef = useRef<HTMLDivElement | null>(null);

  const lightIntensityTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getLightIntensityValue, getTrackCursor: getLightIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_INTENSITY_MAX,
  );
  const lightIntensityCursor = {
    x: getLightIntensityCursor(lightIntensityValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const lightIntensityTitle = lightIntensityValue.toFixed(2);
  const lightIntensityRef = useRef<HTMLDivElement | null>(null);

  const lightSpreadMax = selectedLightMaskData
    ? Math.min(selectedLightMaskData.width, selectedLightMaskData.height)
    : LIGHT_SPREAD_MAX;
  const lightSpreadTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getLightSpreadValue, getTrackCursor: getLightSpreadCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    lightSpreadMax,
  );
  const lightSpreadCursor = {
    x: getLightSpreadCursor(lightSpreadValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const lightSpreadTitle = lightSpreadValue.toFixed(1);
  const lightSpreadRef = useRef<HTMLDivElement | null>(null);

  const lightShadowTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getLightShadowValue, getTrackCursor: getLightShadowCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_SHADOW_MAX,
  );
  const lightShadowCursor = {
    x: getLightShadowCursor(lightShadowValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const lightShadowTitle = lightShadowValue.toFixed(2);
  const lightShadowRef = useRef<HTMLDivElement | null>(null);
  const lightGridlinesValue =
    uiState.lightGridlines &&
    uiState.lightGridlines.key === selectedLightMaskKey &&
    uiState.lightGridlines.lightId === selectedLight?.id
      ? uiState.lightGridlines.value
      : 0;
  const isLightGreeting = !selectedLight;
  const isPreviewAvailable = !selectedLight && !selectedObject;
  const isObjectGreeting = isObjectParamDisabled;
  const setCopying = (next: boolean) => {
    if (uiState.tool.type !== "light_source") return;
    uiDispatch({ type: UIActionType.SetTool, value: { type: "light_source", copy: next } });
  };
  const convert = async (subject: "light" | "object") => {
    if (isConverting || isCopying) return;
    setIsConverting(true);
    try {
      if (subject === "light") {
        if (!selectedLight || selectedLightMaskKey === undefined) return;
        await convertLightToObject(selectedLightMaskKey, selectedLight.id);
      } else {
        if (!selectedObject || selectedObjectMaskKey === undefined) return;
        await convertObjectToLight(selectedObjectMaskKey, selectedObject.id);
      }
    } finally {
      setIsConverting(false);
    }
  };
  const convertButton = (subject: "light" | "object") => {
    const enabled = !isCopying && !isConverting && (subject === "light" ? !!selectedLight : !!selectedObject);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          cursor: isConverting ? "progress" : enabled ? "pointer" : "default",
          opacity: enabled ? 1 : 0.3,
          userSelect: "none",
          ...dynamicSizes.toggle.div,
        }}
        onClick={() => {
          if (!enabled) return;
          void convert(subject);
        }}
      >
        {"convert"}
      </div>
    );
  };
  const copyToggle = () => (
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
        style={{
          textShadow: isCopying ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
          opacity: isConverting ? 0.3 : 1,
          userSelect: "none",
        }}
      >
        {"copy"}
      </span>
      <Toggle
        value={isCopying}
        disabled={isConverting}
        onClick={() => setCopying(!isCopying)}
        trackStyles={{ ...dynamicSizes.toggle.track }}
        buttonStyles={{ ...dynamicSizes.toggle.button }}
        translateX={dynamicSizes.toggle.translateX}
      />
    </div>
  );
  const greeting = (
    <span
      title="hovering a mask shows where its lights and objects are"
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        userSelect: "none",
        ...dynamicSizes.toggle.div,
      }}
    >
      {"click a light or an object on a mask to edit its properties"}
    </span>
  );

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
          target === "light"
            ? "targeting lights -- double-click for objects"
            : "targeting objects -- double-click for lights"
        }
        onDoubleClick={() => {
          if (isBusy) return;
          setTarget(target === "light" ? "object" : "light");
        }}
        style={{
          display: "grid",
          placeContent: "center",
          cursor: isBusy ? "default" : "pointer",
          opacity: isBusy ? 0.3 : 1,
        }}
      >
        <SvgRepo
          svg={target === "light" ? asterisk300() : antigravity300()}
          containerStyle={{
            width: dynamicSizes.svgSize.width,
            height: dynamicSizes.svgSize.height,
          }}
          scale={1}
          scaleToContaier={true}
        />
      </div>
      {target === "light" ? (
        <>
          {isLightGreeting ? (
            greeting
          ) : (
            <div
              title={
                editableLight
                  ? "open this light for editing -- the pen comes up on its outline"
                  : selectedLight
                    ? "finish the edit in progress first"
                    : "select a light on the mesh to edit its outline"
              }
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                cursor: editableLight && !isBusy ? "pointer" : "default",
                opacity: editableLight && !isBusy ? 1 : 0.3,
                userSelect: "none",
                ...dynamicSizes.toggle.div,
              }}
              onClick={() => {
                if (isBusy || !editableLight || selectedLightMaskKey === undefined) return;
                uiDispatch({
                  type: UIActionType.StartLightEdit,
                  maskMediaId: editableLight.maskMediaId,
                  maskKey: selectedLightMaskKey,
                  light: editableLight.light,
                  polygonIndices: editableLight.polygonIndices,
                });
                mask.notifyMaskObjectReviewPreview(selectedLightMaskKey, new Set(editableLight.polygonIndices));
                uiDispatch({ type: UIActionType.CloseAllContextMenus });
              }}
            >
              {"edit"}
            </div>
          )}
          {isLightGreeting ? null : copyToggle()}
          {isLightGreeting ? null : convertButton("light")}
          {isPreviewAvailable ? (
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
                  uiState.lightSourcePreview
                    ? "mouse over a mask to preview the light source there -- turn off to leave the masks as they are"
                    : "turn on to preview the light source by hovering a mask"
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
                }}
                trackStyles={{ ...dynamicSizes.toggle.track }}
                buttonStyles={{ ...dynamicSizes.toggle.button }}
                translateX={dynamicSizes.toggle.translateX}
              />
            </div>
          ) : null}
          {isPreviewAvailable && uiState.lightSourcePreview ? (
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
                      LIGHT_PREVIEW_SIZE_MIN;
                    previewSizeRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewSizeTrackRef.current) return;
                    const newValue =
                      getPreviewSizeValue(newCursor.x, previewSizeTrackRef.current.clientWidth, 0) +
                      LIGHT_PREVIEW_SIZE_MIN;
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
                      ? "select or generate a mesh to set how far its light spreads out beyond the core"
                      : "distance the light spreads out beyond the core, in on-screen pixels -- independent of canvas size"
                  }
                  style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"spread"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${targetMaskKey ?? "lightsourcebar"}|preview-falloff`}
                  size={dynamicSizes.paramSize}
                  containerRef={previewSpreadTrackRef}
                  cursor={previewSpreadCursor}
                  onCursorMove={(newCursor) => {
                    if (!previewSpreadTrackRef.current || !previewSpreadRef.current) return;
                    const val =
                      getPreviewSpreadValue(newCursor.x, previewSpreadTrackRef.current.clientWidth, 0) +
                      LIGHT_PREVIEW_SPREAD_MIN;
                    previewSpreadRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewSpreadTrackRef.current) return;
                    const newValue =
                      getPreviewSpreadValue(newCursor.x, previewSpreadTrackRef.current.clientWidth, 0) +
                      LIGHT_PREVIEW_SPREAD_MIN;
                    handlePreviewSpreadChange(newValue);
                  }}
                  disabled={isPreviewControlsDisabled}
                  title={previewSpreadTitle}
                  liveTitleRef={previewSpreadRef}
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
                      ? "select or generate a mesh to set the strength of its shadow at the far edge of the spread"
                      : "strength of the shadow at the far edge of the spread -- 100% drives it fully to black"
                  }
                  style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"shadow"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${targetMaskKey ?? "lightsourcebar"}|preview-darkness`}
                  size={dynamicSizes.paramSize}
                  containerRef={previewShadowTrackRef}
                  cursor={previewShadowCursor}
                  onCursorMove={(newCursor) => {
                    if (!previewShadowTrackRef.current || !previewShadowRef.current) return;
                    const val = getPreviewShadowValue(newCursor.x, previewShadowTrackRef.current.clientWidth, 0);
                    previewShadowRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewShadowTrackRef.current) return;
                    const newValue = getPreviewShadowValue(newCursor.x, previewShadowTrackRef.current.clientWidth, 0);
                    handlePreviewShadowChange(newValue);
                  }}
                  disabled={isPreviewControlsDisabled}
                  title={previewShadowTitle}
                  liveTitleRef={previewShadowRef}
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
                      ? "select or generate a mesh to set how far its shadow casts past the spread"
                      : "how far the shadow casts past the spread, as a multiple of it -- \u221e never fades it out"
                  }
                  style={{ opacity: isPreviewControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"cast"}
                </span>
                <div style={{ display: "flex", alignItems: "center", letterSpacing: 2 }}>
                  {LIGHT_CAST_OPTIONS.map((option) => {
                    const isSelected = previewCastValue === option.value;
                    return (
                      <span
                        key={option.label}
                        onClick={() => {
                          if (isPreviewControlsDisabled) return;
                          handlePreviewCastChange(option.value);
                        }}
                        style={{
                          cursor: isPreviewControlsDisabled ? "default" : "pointer",
                          color: isSelected ? "inherit" : "rgb(67,67,67)",
                          textShadow: isSelected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                          padding: "4px 8px",
                          userSelect: "none",
                          ...dynamicSizes.segment,
                        }}
                      >
                        {option.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          ) : isLightGreeting ? null : (
            <>
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
                    isLightParamDisabled
                      ? "select a light on the mesh to set the brightness of its own epicenter's core"
                      : "brightness of this light's own epicenter core -- 100% is pure white"
                  }
                  style={{ opacity: isLightControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"intensity"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedLightMaskKey ?? "lightsourcebar"}|light-intensity|${selectedLight?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={lightIntensityTrackRef}
                  cursor={lightIntensityCursor}
                  onCursorMove={(newCursor) => {
                    if (!lightIntensityTrackRef.current || !lightIntensityRef.current) return;
                    const val = getLightIntensityValue(newCursor.x, lightIntensityTrackRef.current.clientWidth, 0);
                    lightIntensityRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!lightIntensityTrackRef.current) return;
                    const newValue = getLightIntensityValue(newCursor.x, lightIntensityTrackRef.current.clientWidth, 0);
                    handleLightIntensityChange(newValue);
                  }}
                  disabled={isLightControlsDisabled}
                  title={lightIntensityTitle}
                  liveTitleRef={lightIntensityRef}
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
                    isLightParamDisabled
                      ? "select a light on the mesh to set how far its own light spreads out beyond its core"
                      : "distance this light spreads out beyond its own core, in on-screen pixels"
                  }
                  style={{ opacity: isLightControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"spread"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedLightMaskKey ?? "lightsourcebar"}|light-falloff|${selectedLight?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={lightSpreadTrackRef}
                  cursor={lightSpreadCursor}
                  onCursorMove={(newCursor) => {
                    if (!lightSpreadTrackRef.current || !lightSpreadRef.current) return;
                    const val = getLightSpreadValue(newCursor.x, lightSpreadTrackRef.current.clientWidth, 0);
                    lightSpreadRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!lightSpreadTrackRef.current) return;
                    const newValue = getLightSpreadValue(newCursor.x, lightSpreadTrackRef.current.clientWidth, 0);
                    handleLightSpreadChange(newValue);
                  }}
                  disabled={isLightControlsDisabled}
                  title={lightSpreadTitle}
                  liveTitleRef={lightSpreadRef}
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
                    isLightParamDisabled
                      ? "select a light on the mesh to set the strength of its own shadow at the far edge of its spread"
                      : "strength of this light's own shadow at the far edge of its spread -- 100% drives it fully to black"
                  }
                  style={{ opacity: isLightControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"shadow"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedLightMaskKey ?? "lightsourcebar"}|light-darkness|${selectedLight?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={lightShadowTrackRef}
                  cursor={lightShadowCursor}
                  onCursorMove={(newCursor) => {
                    if (!lightShadowTrackRef.current || !lightShadowRef.current) return;
                    const val = getLightShadowValue(newCursor.x, lightShadowTrackRef.current.clientWidth, 0);
                    lightShadowRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!lightShadowTrackRef.current) return;
                    const newValue = getLightShadowValue(newCursor.x, lightShadowTrackRef.current.clientWidth, 0);
                    handleLightShadowChange(newValue);
                  }}
                  disabled={isLightControlsDisabled}
                  title={lightShadowTitle}
                  liveTitleRef={lightShadowRef}
                />
              </div>
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
                    isLightParamDisabled
                      ? "select a light on the mesh to set how far its own shadow casts past its spread"
                      : "how far this light's own shadow casts past its spread, as a multiple of it -- \u221e never fades it out"
                  }
                  style={{ opacity: isLightControlsDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"cast"}
                </span>
                <div style={{ display: "flex", alignItems: "center", letterSpacing: 2 }}>
                  {LIGHT_CAST_OPTIONS.map((option) => {
                    const isSelected = lightCastValue === option.value;
                    return (
                      <span
                        className={option.value === 0 ? italiana.className : dellaRespira.className}
                        key={option.label}
                        onClick={() => {
                          if (isLightControlsDisabled) return;
                          handleLightCastChange(option.value);
                        }}
                        style={{
                          cursor: isLightControlsDisabled ? "default" : "pointer",
                          color: isSelected ? "inherit" : "rgb(67,67,67)",
                          textShadow: isSelected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                          padding: "4px 8px",
                          userSelect: "none",
                          fontWeight: option.value === 0 ? "bold" : "normal",
                          fontSize:
                            option.value === 0 ? dynamicSizes.symbolSegment.fontSize : dynamicSizes.segment.fontSize,
                        }}
                      >
                        {option.label}
                      </span>
                    );
                  })}
                </div>
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
                  title="draw the mesh gridlines inside this light's own polygons -- they stay up through playback"
                  style={{ opacity: isBusy ? 0.3 : 1, userSelect: "none" }}
                >
                  {"gridlines"}
                </span>
                <div style={{ display: "flex", alignItems: "center", letterSpacing: 2 }}>
                  {GRIDLINES_OPTIONS.map((option) => {
                    const isSelected = lightGridlinesValue === option.value;
                    return (
                      <span
                        key={option.label}
                        onClick={() => {
                          if (isBusy || !selectedLight || selectedLightMaskKey === undefined) return;
                          uiDispatch({
                            type: UIActionType.SetLightGridlines,
                            value:
                              option.value === 0
                                ? undefined
                                : { key: selectedLightMaskKey, lightId: selectedLight.id, value: option.value },
                          });
                        }}
                        style={{
                          cursor: isBusy ? "default" : "pointer",
                          color: isSelected ? "inherit" : "rgb(67,67,67)",
                          opacity: isBusy ? 0.3 : 1,
                          textShadow: isSelected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                          padding: "4px 8px",
                          userSelect: "none",
                          ...dynamicSizes.segment,
                        }}
                      >
                        {option.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      ) : isObjectGreeting ? (
        greeting
      ) : (
        <>
          <div
            title={
              editableObject
                ? "open this object for editing -- the pen comes up on its outline"
                : selectedObject
                  ? "finish the edit in progress first"
                  : "select an object on the mesh to edit it"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              cursor: editableObject && !isBusy ? "pointer" : "default",
              opacity: editableObject && !isBusy ? 1 : 0.3,
              userSelect: "none",
              ...dynamicSizes.toggle.div,
            }}
            onClick={() => {
              if (isBusy || !editableObject || selectedObjectMaskKey === undefined) return;
              uiDispatch({
                type: UIActionType.StartObjectEdit,
                maskMediaId: editableObject.maskMediaId,
                maskKey: selectedObjectMaskKey,
                object: editableObject.object,
                polygonIndices: editableObject.polygonIndices,
              });
              mask.notifyMaskObjectReviewPreview(selectedObjectMaskKey, new Set(editableObject.polygonIndices));
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
          >
            {"edit"}
          </div>
          {copyToggle()}
          {convertButton("object")}
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
                !selectedObject
                  ? "select an object on the mesh to carry the image's own pixels with it as it animates"
                  : liftValue
                    ? "the image's own pixels travel with this object while a move or a scale plays it, leaving a transparent hole where they were -- turn off to animate the relief alone"
                    : "only this object's relief animates, over an image that stays put -- turn on to carry the image's own pixels with it"
              }
              style={{
                opacity: !selectedObject || isBusy ? 0.3 : 1,
                textShadow: liftValue ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                userSelect: "none",
              }}
            >
              {"lift"}
            </span>
            <Toggle
              value={liftValue}
              disabled={isLiftDisabled}
              onClick={() => {
                const next = !liftValue;
                if (!saveObjectField({ lift: next })) return;
                setPendingLift(next);
              }}
              trackStyles={{ ...dynamicSizes.toggle.track }}
              buttonStyles={{ ...dynamicSizes.toggle.button }}
              translateX={dynamicSizes.toggle.translateX}
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
            <span style={{ opacity: isObjectControlsDisabled ? 0.3 : 1, userSelect: "none" }}>{"elevation"}</span>
            <ParameterSliderXPlusMinus
              resolution={{ ...uiState.resolution }}
              hash={`${selectedObjectMaskKey ?? "lightsourcebar"}|elevation|${selectedObject?.id ?? "staged"}`}
              size={dynamicSizes.paramPlusMinueSize}
              containerRef={elevationTrackRef}
              cursor={elevationCursor}
              onCursorMove={(newCursor) => {
                if (!elevationTrackRef.current) return;
                const newValue = elevationFromTrack(newCursor.x, elevationTrackRef.current.clientWidth);
                previewObjectChange({ elevation: newValue });
                if (elevationRef.current) elevationRef.current.innerHTML = newValue.toFixed(0);
              }}
              onNewCursor={(newCursor) => {
                if (!elevationTrackRef.current) return;
                saveObjectField({
                  elevation: elevationFromTrack(newCursor.x, elevationTrackRef.current.clientWidth),
                });
              }}
              disabled={isObjectControlsDisabled}
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
              title={"the selected object's own profile - low is a broad dome with a visible rim, high is a needle"}
              style={{ opacity: isObjectControlsDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"falloff"}
            </span>
            <ParameterSliderX
              resolution={{ ...uiState.resolution }}
              hash={`${selectedObjectMaskKey ?? "lightsourcebar"}|object-falloff|${selectedObject?.id ?? "staged"}`}
              size={dynamicSizes.paramSize}
              containerRef={objectFalloffTrackRef}
              cursor={objectFalloffCursor}
              onCursorMove={(newCursor) => {
                if (!objectFalloffTrackRef.current) return;
                const newValue =
                  MIN_MASK_OBJECT_FALLOFF +
                  getObjectFalloffValue(newCursor.x, objectFalloffTrackRef.current.clientWidth, 0);
                previewObjectChange({ falloff: newValue });
                if (objectFalloffRef.current) objectFalloffRef.current.innerHTML = newValue.toFixed(2);
              }}
              onNewCursor={(newCursor) => {
                if (!objectFalloffTrackRef.current) return;
                const newValue =
                  MIN_MASK_OBJECT_FALLOFF +
                  getObjectFalloffValue(newCursor.x, objectFalloffTrackRef.current.clientWidth, 0);
                saveObjectField({ falloff: newValue });
              }}
              disabled={isObjectControlsDisabled}
              title={objectFalloffTitle}
              liveTitleRef={objectFalloffRef}
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
              title={"the selected object's flat fill color"}
              style={{ opacity: isObjectControlsDisabled ? 0.3 : 1, userSelect: "none" }}
            >
              {"fill"}
            </span>
            <ColorPickerButton
              resolution={{ ...uiState.resolution }}
              hash={`${selectedObjectMaskKey ?? "lightsourcebar"}|object-fill|${selectedObject?.id ?? "staged"}`}
              size={dynamicSizes.colorPicker}
              panel={dynamicSizes.colorPickerPanel}
              swatchSize={dynamicSizes.colorPickerSwatch}
              readoutFontSize={dynamicSizes.colorPickerReadout}
              color={fillValue}
              onOpenChange={notifyMaskHighlightSuppressed}
              onNewColor={(fill: LaurusColor) => saveObjectField({ fill })}
              canOpen={() => {
                if (!isGuest) return true;
                alert(UNAUTHORIZED_EDIT);
                return false;
              }}
              disabled={isObjectControlsDisabled}
            />
          </div>
        </>
      )}
    </div>
  );
}
