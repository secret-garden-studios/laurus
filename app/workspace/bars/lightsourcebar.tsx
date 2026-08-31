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
import { MAX_MASK_OBJECT_ELEVATION, MAX_MASK_OBJECT_FALLOFF, MIN_MASK_OBJECT_FALLOFF } from "../mask-gl";
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
import { LIGHT_DARKNESS_MAX, LIGHT_FALLOFF_MAX, LIGHT_INTENSITY_MAX } from "../workspace.config";

const LIGHT_PREVIEW_SIZE_MIN = 10;
const LIGHT_PREVIEW_SIZE_MAX = 300;
const LIGHT_PREVIEW_FALLOFF_MIN = 20;
const LIGHT_PREVIEW_FALLOFF_MAX = 1000;

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
    notifyMaskSelectionChanged,
    notifyMaskSelectedLightChanged,
    notifyMaskSelectedObjectChanged,
    notifyMaskLightUpdated,
    notifyMaskPendingTopologySet,
    notifyMaskPendingTopologyCleared,
    notifyMaskObjectsUpdated,
    notifyMaskHighlightSuppressed,
    ...mask
  } = useContext(MaskContext);
  const [target, setTarget] = useState<"light" | "object">("light");
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
  const isLiftDisabled = !selectedObject || pendingLift !== undefined;

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
      field: "light_preview_size" | "light_preview_intensity" | "light_preview_falloff" | "light_preview_darkness",
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
          falloff: newMaskMeta.light_preview_falloff,
          darkness: newMaskMeta.light_preview_darkness,
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
  const previewFalloffValue = targetMaskMeta ? targetMaskMeta.light_preview_falloff : mask.lightFalloff;
  const handlePreviewFalloffChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("light_preview_falloff", value);
      } else {
        mask.setLightFalloff(value);
      }
    },
    [targetMaskMeta, savePreviewField, mask],
  );
  const previewDarknessValue = targetMaskMeta ? targetMaskMeta.light_preview_darkness : mask.lightDarkness;
  const handlePreviewDarknessChange = useCallback(
    (value: number) => {
      if (targetMaskMeta) {
        savePreviewField("light_preview_darkness", value);
      } else {
        mask.setLightDarkness(value);
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
        const maskData = latestCanvasMasksRef.current.get(toSave.maskKey);
        if (updated && maskData) {
          const patched = applyLightDelta(maskData, updated);
          dispatch({ type: CoreActionType.SetCanvasMask, key: toSave.maskKey, value: patched });
          notifyMaskLightUpdated(toSave.maskKey, patched);
        } else {
          console.error("failed to save light change", { light_id: toSave.light.id });
        }
      }
    } finally {
      isPersistingLightRef.current = false;
    }
  }, [sendMaskLightUpdate, dispatch, notifyMaskLightUpdated]);

  const saveLightField = useCallback(
    (field: "intensity" | "falloff" | "darkness", value: number) => {
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
  const lightFalloffValue = selectedLight?.falloff ?? 0;
  const handleLightFalloffChange = useCallback((value: number) => saveLightField("falloff", value), [saveLightField]);
  const lightDarknessValue = selectedLight?.darkness ?? 0;
  const handleLightDarknessChange = useCallback((value: number) => saveLightField("darkness", value), [saveLightField]);

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
        const maskData = latestCanvasMasksRef.current.get(toSave.maskKey);
        if (updated && maskData) {
          const patched = applyObjectDelta(maskData, updated);
          dispatch({ type: CoreActionType.SetCanvasMask, key: toSave.maskKey, value: patched });
          notifyMaskObjectsUpdated(toSave.maskKey, patched);
        } else {
          console.error("failed to save object change", { object_id: toSave.object.id });
        }
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
      };
    },
    [selectedObjectMaskKey, selectedObject],
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

  const previewFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getPreviewFalloffValue, getTrackCursor: getPreviewFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_PREVIEW_FALLOFF_MAX - LIGHT_PREVIEW_FALLOFF_MIN,
  );
  const previewFalloffCursor = {
    x: getPreviewFalloffCursor(previewFalloffValue - LIGHT_PREVIEW_FALLOFF_MIN, dynamicSizes.paramSize.containerWidth),
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

  const lightFalloffMax = selectedLightMaskData
    ? Math.min(selectedLightMaskData.width, selectedLightMaskData.height)
    : LIGHT_FALLOFF_MAX;
  const lightFalloffTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getLightFalloffValue, getTrackCursor: getLightFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    lightFalloffMax,
  );
  const lightFalloffCursor = {
    x: getLightFalloffCursor(lightFalloffValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const lightFalloffTitle = lightFalloffValue.toFixed(1);
  const lightFalloffRef = useRef<HTMLDivElement | null>(null);

  const lightDarknessTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getLightDarknessValue, getTrackCursor: getLightDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_DARKNESS_MAX,
  );
  const lightDarknessCursor = {
    x: getLightDarknessCursor(lightDarknessValue, dynamicSizes.paramSize.containerWidth),
    y: 0,
  };
  const lightDarknessTitle = lightDarknessValue.toFixed(2);
  const lightDarknessRef = useRef<HTMLDivElement | null>(null);
  const isLightGreeting = !uiState.lightSourcePreview && !selectedLight;
  const isObjectGreeting = isObjectParamDisabled;
  const greeting = (
    <span
      title="hovering a mask shows where its lights and objects are"
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        opacity: 0.6,
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
          setTarget(target === "light" ? "object" : "light");
        }}
        style={{ display: "grid", placeContent: "center", cursor: "pointer" }}
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
                cursor: editableLight ? "pointer" : "default",
                opacity: editableLight ? 1 : 0.3,
                userSelect: "none",
                ...dynamicSizes.toggle.div,
              }}
              onClick={() => {
                if (!editableLight || selectedLightMaskKey === undefined) return;
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
                  ? "mouse over a mask to preview the light source there -- turn off to edit the selected light's own starting parameters"
                  : "editing the selected light's own starting parameters -- turn on to preview the light source by hovering a mask"
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
                if (next && (selectedElement?.type === "light" || selectedElement?.type === "object")) {
                  uiDispatch({ type: UIActionType.SetSelectedElement, value: undefined });
                  notifyMaskSelectionChanged(selectedElement.key);
                  notifyMaskSelectedLightChanged(selectedElement.key, undefined);
                  notifyMaskSelectedObjectChanged(selectedElement.key, undefined);
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
                      LIGHT_PREVIEW_FALLOFF_MIN;
                    previewFalloffRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!previewFalloffTrackRef.current) return;
                    const newValue =
                      getPreviewFalloffValue(newCursor.x, previewFalloffTrackRef.current.clientWidth, 0) +
                      LIGHT_PREVIEW_FALLOFF_MIN;
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
          ) : isLightGreeting ? null : (
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
                    isLightParamDisabled
                      ? "select a light on the mesh to set the brightness of its own epicenter's core"
                      : "brightness of this light's own epicenter core -- 100% is pure white"
                  }
                  style={{ opacity: isLightParamDisabled ? 0.3 : 1, userSelect: "none" }}
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
                  disabled={isLightParamDisabled}
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
                      ? "select a light on the mesh to set how far its own darkening falloffs out beyond the core"
                      : "distance this light's own darkening takes to falloff out beyond the core, in on-screen pixels"
                  }
                  style={{ opacity: isLightParamDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"falloff"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedLightMaskKey ?? "lightsourcebar"}|light-falloff|${selectedLight?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={lightFalloffTrackRef}
                  cursor={lightFalloffCursor}
                  onCursorMove={(newCursor) => {
                    if (!lightFalloffTrackRef.current || !lightFalloffRef.current) return;
                    const val = getLightFalloffValue(newCursor.x, lightFalloffTrackRef.current.clientWidth, 0);
                    lightFalloffRef.current.innerHTML = val.toFixed(1);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!lightFalloffTrackRef.current) return;
                    const newValue = getLightFalloffValue(newCursor.x, lightFalloffTrackRef.current.clientWidth, 0);
                    handleLightFalloffChange(newValue);
                  }}
                  disabled={isLightParamDisabled}
                  title={lightFalloffTitle}
                  liveTitleRef={lightFalloffRef}
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
                      ? "select a light on the mesh to set the strength of its own darkening at the far edge of the falloff"
                      : "strength of this light's own darkening at the far edge of the falloff -- 100% drives it fully to black"
                  }
                  style={{ opacity: isLightParamDisabled ? 0.3 : 1, userSelect: "none" }}
                >
                  {"darkness"}
                </span>
                <ParameterSliderX
                  resolution={{ ...uiState.resolution }}
                  hash={`${selectedLightMaskKey ?? "lightsourcebar"}|light-darkness|${selectedLight?.id ?? "none"}`}
                  size={dynamicSizes.paramSize}
                  containerRef={lightDarknessTrackRef}
                  cursor={lightDarknessCursor}
                  onCursorMove={(newCursor) => {
                    if (!lightDarknessTrackRef.current || !lightDarknessRef.current) return;
                    const val = getLightDarknessValue(newCursor.x, lightDarknessTrackRef.current.clientWidth, 0);
                    lightDarknessRef.current.innerHTML = val.toFixed(2);
                  }}
                  onNewCursor={(newCursor) => {
                    if (!lightDarknessTrackRef.current) return;
                    const newValue = getLightDarknessValue(newCursor.x, lightDarknessTrackRef.current.clientWidth, 0);
                    handleLightDarknessChange(newValue);
                  }}
                  disabled={isLightParamDisabled}
                  title={lightDarknessTitle}
                  liveTitleRef={lightDarknessRef}
                />
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
              cursor: editableObject ? "pointer" : "default",
              opacity: editableObject ? 1 : 0.3,
              userSelect: "none",
              ...dynamicSizes.toggle.div,
            }}
            onClick={() => {
              if (!editableObject || selectedObjectMaskKey === undefined) return;
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
                opacity: !selectedObject ? 0.3 : 1,
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
            <span style={{ opacity: isObjectParamDisabled ? 0.3 : 1, userSelect: "none" }}>{"elevation"}</span>
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
              disabled={isObjectParamDisabled}
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
              style={{ opacity: isObjectParamDisabled ? 0.3 : 1, userSelect: "none" }}
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
              disabled={isObjectParamDisabled}
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
              style={{ opacity: isObjectParamDisabled ? 0.3 : 1, userSelect: "none" }}
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
              onColorMove={(fill: LaurusColor) => previewObjectChange({ fill })}
              onNewColor={(fill: LaurusColor) => saveObjectField({ fill })}
              canOpen={() => {
                if (!isGuest) return true;
                alert(UNAUTHORIZED_EDIT);
                return false;
              }}
              disabled={isObjectParamDisabled}
            />
          </div>
        </>
      )}
    </div>
  );
}
