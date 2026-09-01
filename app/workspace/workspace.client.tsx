"use client";
import {
  createContext,
  CSSProperties,
  use,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import styles from "../app.module.css";
import {
  getFrames,
  LaurusEffect,
  LaurusEffectGroupResult,
  LaurusFrame,
  LaurusImgResult,
  LaurusMediaGroupResult,
  LaurusMixState,
  LaurusSvgResult,
  LaurusMaskResult,
  LaurusObjectReview,
  searchImgs,
  LaurusImgPageSearch,
  LaurusSvgPageSearch,
  searchSvgs,
  nextLightId,
  nextObjectId,
  LightUpdateDelta_V1_0,
  ObjectUpdateDelta_V1_0,
  MaskLightUpdateRequest_V1_0,
  MaskObjectUpdateRequest_V1_0,
  LaurusObjectFill,
  newLight,
  newObject,
  toLightUpdate,
  toObjectFillFields,
  toObjectUpdate,
} from "./workspace.server";
import {
  frontElementOrder,
  maskStack,
  reorderElements,
  type StackChange,
  type StackDirection,
  type StackRef,
} from "./canvas-media/mask-order";
import Statusbar from "./bars/statusbar";
import Canvas from "./canvas";
import MediaBrowser from "./browsers/media-browser";
import { moreVert, playArrow, SvgRepo, getCrops, LaurusCropSvg } from "../svg-repo";
import { DraggableProjectImg } from "./canvas-media/draggable-project-img";
import { DraggableProjectSvg } from "./canvas-media/draggable-project-svg";
import { DraggableProjectMask } from "./canvas-media/draggable-project-mask";
import { MaskAppearanceOverride, MaskImperativeHandle } from "./canvas-media/project-mask-item";
import { useToolCursor } from "./hooks/useToolCursor";
import { deleteMaskObjectEffects, parseMaskLightInputId, parseMaskObjectInputId } from "./effects-utils";
import Titlebar, { Subtitlebar as Subtitlebar } from "./bars/titlebar";
import Floatingbar from "./bars/floatingbar";
import { confirmEndingMaskEdit, confirmLeavingPen } from "./hooks/useMaskEditExit";
import TimelineArea from "./timeline-area";
import DraggableCamera from "./camera";
import { WorkspaceResolution, Z_INDEX } from "./workspace.config";
import { toCssSkewAngle } from "./skew-angle.ts";
import { BrowserDependencies } from "./page";
import Toolbar from "./bars/toolbar";
import { useMaskPreview, UseMaskPreview, MASK_RESOLUTION_DEFAULT } from "./hooks/useMaskPreview";
import { useMaskLightSockets } from "./hooks/useMaskLightSockets";
import { useMaskObjectSockets } from "./hooks/useMaskObjectSockets";
import {
  dropIndicesClaimedByObjects,
  indicesInObjectFromCentroids,
  lightCenterFromCentroids,
} from "./canvas-media/light-geometry";
import { maskGeometry, polygonIndicesForLight, polygonIndicesForObject } from "./canvas-media/mask-geometry";
import { unitCirclePath } from "./canvas-media/object-path";
import { applyLightDelta, applyObjectDelta } from "./canvas-media/mask-delta";
import {
  LIGHT_DARKNESS_DEFAULT,
  LIGHT_FALLOFF_CSS_PX_DEFAULT,
  LIGHT_FALLOFF_TO_SIZE_RATIO,
  LIGHT_INTENSITY_DEFAULT,
  LIGHT_SIZE_CSS_PX_DEFAULT,
  MIN_MASK_OBJECT_RADIUS_PX,
  TEXTURE_MIX_DEFAULT,
} from "./mask-gl";
import {
  ProjectResult_V1_0,
  updateProject,
  createProject,
  AbsolutePosition,
  ContextMenuConfig,
  DEFAULT_CONTEXT_MENU_CONFIG,
  LaurusProjectImg,
  LaurusProjectResult,
  LaurusProjectSvg,
  LaurusProjectMask,
} from "../projects/projects.server";
import { MeDependencies, ProjectDependencies } from "../page";
import { UNAUTHORIZED_EDIT } from "../landing.server";
import {
  uiContextReducer,
  CarouselEntry,
  UIAction,
  UIActionType,
  UIState,
  defaultMarqueeTool,
  defaultMaskTool,
  defaultUIState,
  ProjectMediaContextMenu,
  LaurusTool,
  defaultPenTool,
} from "./states/ui-state";
import {
  CoreAction,
  CoreActionType,
  CoreState,
  PendingTopologyEdit,
  coreContextReducer,
  defaultCoreState,
} from "./states/core-state";
import { RESOLUTION } from "../landing.config";
import { defaultProject } from "../projects/states/core-state";

export function getNewContextMenuConfig(
  newPosition: { top: number; left: number },
  canvasSize: { width: number; height: number },
  mediaSize: { width: number; height: number },
  mediaScale: { x: number; y: number },
  currentValue: ContextMenuConfig,
): ContextMenuConfig {
  const left = newPosition.left + mediaSize.width * mediaScale.x + currentValue.width > canvasSize.width ? true : false;
  const bottom =
    newPosition.top + mediaSize.height * mediaScale.y + currentValue.height > canvasSize.height ? true : false;
  if (bottom && left) {
    return { ...currentValue, position: AbsolutePosition.bottomLeft };
  } else if (bottom && !left) {
    return { ...currentValue, position: AbsolutePosition.bottomRight };
  } else if (!bottom && left) {
    return { ...currentValue, position: AbsolutePosition.topLeft };
  } else {
    return { ...currentValue, position: AbsolutePosition.topRight };
  }
}

export interface LaurusTransform {
  cssProps: CSSProperties;
  bounds: {
    width: number;
    height: number;
    deltas: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
}

export interface AnimationTarget {
  inputKey: string;
  getFrames: (apiOrigin: string | undefined) => Promise<LaurusFrame[] | undefined>;
  effectKey: string;
}

export function convertTime(time: number, currentUnit: string, newUnit: string) {
  switch (currentUnit + newUnit) {
    case "secmin": {
      return time / 60;
    }
    case "minsec": {
      return time * 60;
    }
    default: {
      return time;
    }
  }
}

export function toKeyframes(laurusFrames: LaurusFrame[], firstFrame: boolean): Keyframe[] {
  const framesToMap = firstFrame ? [laurusFrames[0]] : laurusFrames;
  const keyframes: Keyframe[] = framesToMap.map((f, i) => {
    return i < laurusFrames.length - 1
      ? {
          translate: `${f.x}px ${f.y}px 0px`,
          scale: `${f.sx} ${f.sy}`,
          rotate: `${f.rx} ${f.ry} ${f.rz} ${f.rangle}deg`,
          transform: `skew(${toCssSkewAngle(f.ax)}deg, ${toCssSkewAngle(f.ay)}deg)`,
          easing: "step-end",
        }
      : {
          translate: `${f.x}px ${f.y}px 0px`,
          scale: `${f.sx} ${f.sy}`,
          rotate: `${f.rx} ${f.ry} ${f.rz} ${f.rangle}deg`,
          transform: `skew(${toCssSkewAngle(f.ax)}deg, ${toCssSkewAngle(f.ay)}deg)`,
        };
  });
  return keyframes;
}

export interface HoverContextProps {
  getMostRecentlyEnteredEffectUnitKey: () => string | undefined;
  setMostRecentlyEnteredEffectUnitKey: (key: string | undefined) => void;
  mostRecentlyHoveredMaskKey: string | undefined;
  setMostRecentlyHoveredMaskKey: (key: string | undefined) => void;
  isMetaKeyPressed: boolean;
  isAltKeyPressed: boolean;
  selectedEffectUnitKeys: Set<string>;
  setSelectedEffectUnitKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedImgKeys: Set<string>;
  setSelectedImgKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedSvgKeys: Set<string>;
  setSelectedSvgKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedMaskKeys: Set<string>;
  setSelectedMaskKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const HoverContext = createContext<HoverContextProps>({
  getMostRecentlyEnteredEffectUnitKey: () => undefined,
  setMostRecentlyEnteredEffectUnitKey: () => {},
  mostRecentlyHoveredMaskKey: undefined,
  setMostRecentlyHoveredMaskKey: () => {},
  isMetaKeyPressed: false,
  isAltKeyPressed: false,
  selectedEffectUnitKeys: new Set<string>(),
  setSelectedEffectUnitKeys: () => {},
  selectedImgKeys: new Set<string>(),
  setSelectedImgKeys: () => {},
  selectedSvgKeys: new Set<string>(),
  setSelectedSvgKeys: () => {},
  selectedMaskKeys: new Set<string>(),
  setSelectedMaskKeys: () => {},
});

export interface CoreContextProps {
  coreState: CoreState;
  dispatch: React.Dispatch<CoreAction>;
  handleRewindAll: (playbackRate: number) => void;
  handlePlayAll: () => void;
  handleFastForwardAll: (playbackRate: number) => void;
  handlePlayTarget: (target: AnimationTarget) => void;
  handleStopAll: () => void;
  cancelFrameDownload: () => void;
}

export const CoreContext = createContext<CoreContextProps>({
  coreState: { ...defaultCoreState },
  dispatch: () => {},
  handleRewindAll: () => {},
  handlePlayAll: () => {},
  handleFastForwardAll: () => {},
  handlePlayTarget: () => {},
  handleStopAll: () => {},
  cancelFrameDownload: () => {},
});

export interface SocketContextProps {
  sendMaskLightUpdate: (
    maskMediaId: string,
    request: MaskLightUpdateRequest_V1_0,
  ) => Promise<LightUpdateDelta_V1_0 | undefined>;
  closeMaskLightSocket: (maskMediaId: string) => void;
  sendMaskObjectUpdate: (
    maskMediaId: string,
    update: MaskObjectUpdateRequest_V1_0,
  ) => Promise<ObjectUpdateDelta_V1_0 | undefined>;
  closeMaskObjectSocket: (maskMediaId: string) => void;
}

export const SocketContext = createContext<SocketContextProps>({
  sendMaskLightUpdate: async () => undefined,
  closeMaskLightSocket: () => {},
  sendMaskObjectUpdate: async () => undefined,
  closeMaskObjectSocket: () => {},
});

export interface MaskNotifyValue {
  lightMeshSection: (maskKey: string, polygonIndices: number[], size: number) => Promise<void>;
  createObject: (
    maskKey: string,
    circle: { cx: number; cy: number; radius: number },
    seed: { elevation: number; falloff: number; fill: LaurusObjectFill },
  ) => Promise<void>;
  deleteObject: (maskKey: string, objectId: number) => Promise<void>;
  reorderElement: (maskKey: string, target: StackRef, direction: StackDirection) => Promise<void>;
  restackMaskStack: (maskKey: string, changes: StackChange[]) => Promise<void>;
  notifyMaskToolChanged: (toolType: string) => void;
  notifyMaskSelectionChanged: (key: string | undefined) => void;
  notifyMaskHighlightSuppressed: (suppressed: boolean) => void;
  notifyMaskSelectedLightChanged: (maskKey: string, lightId: number | undefined) => void;
  notifyMaskSelectedObjectChanged: (maskKey: string, objectId: number | undefined) => void;
  notifyMaskPendingLightSet: (maskKey: string, indices: Set<number>, lightId?: number) => void;
  notifyMaskPendingLightCleared: (maskKey: string | undefined) => void;
  notifyMaskLightUpdated: (maskKey: string, updated: LaurusMaskResult) => void;
  notifyMaskAppearanceChanged: (maskKey: string, override?: MaskAppearanceOverride) => void;
  notifyMaskLightSourcePreviewToggled: (enabled: boolean) => void;
  notifyMaskPendingTopologySet: (maskKey: string, edit: PendingTopologyEdit) => void;
  notifyMaskPendingTopologyCleared: (maskKey: string | undefined) => void;
  notifyMaskRetouchRequested: (maskKey: string) => Promise<void>;
  notifyMaskObjectReviewPreview: (maskKey: string, indices: Set<number> | undefined, diffBase?: Set<number>) => void;
  notifyCanvasZoomChanged: (zoom: number) => void;
  notifyMaskObjectsUpdated: (maskKey: string, updated: LaurusMaskResult) => void;
}

export interface UIContextProps {
  uiState: UIState;
  uiDispatch: React.Dispatch<UIAction>;
}

export const UIContext = createContext<UIContextProps>({
  uiState: { ...defaultUIState },
  uiDispatch: () => {},
});

const defaultMaskPreview: UseMaskPreview = {
  status: "idle",
  statusRef: { current: "idle" },
  triangleCount: 0,
  result: undefined,
  objectCandidatesRef: { current: [] },
  errorMessage: undefined,
  textureMix: TEXTURE_MIX_DEFAULT,
  setTextureMix: () => {},
  textureMixRef: { current: TEXTURE_MIX_DEFAULT },
  lightSize: LIGHT_SIZE_CSS_PX_DEFAULT,
  setLightSize: () => {},
  lightSizeRef: { current: LIGHT_SIZE_CSS_PX_DEFAULT },
  lightIntensity: LIGHT_INTENSITY_DEFAULT,
  setLightIntensity: () => {},
  lightIntensityRef: { current: LIGHT_INTENSITY_DEFAULT },
  lightFalloff: LIGHT_FALLOFF_CSS_PX_DEFAULT,
  setLightFalloff: () => {},
  lightFalloffRef: { current: LIGHT_FALLOFF_CSS_PX_DEFAULT },
  lightDarkness: LIGHT_DARKNESS_DEFAULT,
  setLightDarkness: () => {},
  lightDarknessRef: { current: LIGHT_DARKNESS_DEFAULT },
  position: { value: false, x: undefined, y: undefined },
  setPosition: () => {},
  size: { value: false, width: undefined, height: undefined },
  setSize: () => {},
  resolution: MASK_RESOLUTION_DEFAULT,
  setResolution: () => {},
  start: () => {},
  reset: () => {},
  meshRefs: {
    positionsRef: { current: [] },
    colorsRef: { current: [] },
    barycentricsRef: { current: [] },
    uvsRef: { current: [] },
    centroidsRef: { current: [] },
    vertexCountRef: { current: 0 },
    dirtyRef: { current: false },
    curvesRef: { current: [] },
    glowColorRef: { current: [1, 1, 1] },
    backingVertexCountRef: { current: 0 },
  },
};

const defaultMaskNotifyValue: MaskNotifyValue = {
  lightMeshSection: async () => {},
  createObject: async () => {},
  deleteObject: async () => {},
  reorderElement: async () => {},
  restackMaskStack: async () => {},
  notifyMaskToolChanged: () => {},
  notifyMaskSelectionChanged: () => {},
  notifyMaskHighlightSuppressed: () => {},
  notifyMaskSelectedLightChanged: () => {},
  notifyMaskSelectedObjectChanged: () => {},
  notifyMaskPendingLightSet: () => {},
  notifyMaskPendingLightCleared: () => {},
  notifyMaskLightUpdated: () => {},
  notifyMaskAppearanceChanged: () => {},
  notifyMaskLightSourcePreviewToggled: () => {},
  notifyMaskPendingTopologySet: () => {},
  notifyMaskPendingTopologyCleared: () => {},
  notifyMaskRetouchRequested: async () => {},
  notifyMaskObjectReviewPreview: () => {},
  notifyCanvasZoomChanged: () => {},
  notifyMaskObjectsUpdated: () => {},
};

export interface MaskContextProps extends UseMaskPreview, MaskNotifyValue {}

export const MaskContext = createContext<MaskContextProps>({
  ...defaultMaskPreview,
  ...defaultMaskNotifyValue,
});

function initProject(p: ProjectResult_V1_0) {
  const projectImgsInit: Map<string, LaurusProjectImg> = new Map(p.imgs.entries().map((e) => [e[0], { ...e[1] }]));

  const projectSvgsInit: Map<string, LaurusProjectSvg> = new Map(p.svgs.entries().map((e) => [e[0], { ...e[1] }]));

  const projectMasksInit: Map<string, LaurusProjectMask> = new Map(
    (p.masks ?? new Map()).entries().map((e) => [e[0], { ...e[1] }]),
  );

  return {
    ...p,
    imgs: projectImgsInit,
    svgs: projectSvgsInit,
    masks: projectMasksInit,
    frame_width: p.frame_width > 0 && p.frame_width <= p.canvas_width ? p.frame_width : defaultProject.frame_width,
    frame_height:
      p.frame_height > 0 && p.frame_height <= p.canvas_height ? p.frame_height : defaultProject.frame_height,
  };
}

function initCarouselEntries(
  project: LaurusProjectResult,
  canvasMasks: Map<string, LaurusMaskResult>,
): CarouselEntry[] {
  const temp: { entry: CarouselEntry; distance: number }[] = [];
  project.imgs.entries().forEach((projectImg) => {
    if (projectImg[1].left < 0 || projectImg[1].top < 0) return;
    const distance = Math.sqrt(projectImg[1].top ** 2 + projectImg[1].left ** 2);
    temp.push({
      entry: {
        type: "img",
        key: projectImg[0],
      },
      distance,
    });
  });
  project.svgs.entries().forEach((projectSvg) => {
    if (projectSvg[1].left < 0 || projectSvg[1].top < 0) return;
    const distance = Math.sqrt(projectSvg[1].top ** 2 + projectSvg[1].left ** 2);
    temp.push({
      entry: {
        type: "svg",
        key: projectSvg[0],
      },
      distance,
    });
  });
  project.masks.entries().forEach((projectMask) => {
    if (projectMask[1].left < 0 || projectMask[1].top < 0) return;
    const distance = Math.sqrt(projectMask[1].top ** 2 + projectMask[1].left ** 2);
    temp.push({
      entry: {
        type: "mask",
        key: projectMask[0],
      },
      distance,
    });
    const lights = canvasMasks.get(projectMask[0])?.lights ?? [];
    lights.forEach((light) => {
      temp.push({
        entry: {
          type: "light",
          key: projectMask[0],
          lightId: light.id,
        },
        distance,
      });
    });
    const objects = canvasMasks.get(projectMask[0])?.objects ?? [];
    objects.forEach((object) => {
      temp.push({
        entry: {
          type: "object",
          key: projectMask[0],
          objectId: object.id,
        },
        distance,
      });
    });
  });
  const entries = temp.sort((a, b) => a.distance - b.distance).map((item) => item.entry);
  return entries;
}

export function getMaskSourceImgIds(
  masks: Map<string, LaurusProjectMask>,
  canvasMasks: Map<string, LaurusMaskResult>,
): Set<string> {
  return new Set(
    Array.from(masks.keys())
      .map((key) => canvasMasks.get(key)?.source_img_media_id)
      .filter((id): id is string => Boolean(id)),
  );
}

interface InitReducer {
  arg1: ProjectDependencies | undefined;
  arg2: string[] | undefined;
  arg3: number[];
  arg4: string[];
  arg5: string | undefined;
  arg6: BrowserDependencies;
  arg7: WorkspaceResolution;
  arg8: string | undefined;
  arg9: string[];
  arg10: LaurusMediaGroupResult[];
}

function initReducer({
  arg1: projectDependencies,
  arg2: effectNames,
  arg3: timelineValues,
  arg4: timelineUnits,
  arg5: apiOrigin,
  arg6: browserDependencies,
  arg7: resolution,
  arg8: accessToken,
  arg9: mixableEffects,
  arg10: mediaGroups,
}: InitReducer): { core: CoreState; ui: UIState } {
  const newEffects: LaurusEffect[] = [];
  if (projectDependencies) {
    projectDependencies.scales.forEach((e) => {
      newEffects.push({
        type: "scale",
        key: e.scale_id,
        value: {
          ...e,
          locked: e.locked,
          mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None,
        },
      });
    });
    projectDependencies?.moves.forEach((e) => {
      newEffects.push({
        type: "move",
        key: e.move_id,
        value: {
          ...e,
          locked: e.locked,
          mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None,
        },
      });
    });
    projectDependencies?.rotates.forEach((e) => {
      newEffects.push({
        type: "rotate",
        key: e.rotate_id,
        value: {
          ...e,
          locked: e.locked,
          mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None,
        },
      });
    });
    projectDependencies?.skews.forEach((e) => {
      newEffects.push({
        type: "skew",
        key: e.skew_id,
        value: {
          ...e,
          locked: e.locked,
          mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None,
        },
      });
    });
    projectDependencies?.lightSources.forEach((e) => {
      newEffects.push({
        type: "light_source",
        key: e.light_source_id,
        value: {
          ...e,
          locked: e.locked,
          mixState: e.mix ? LaurusMixState.Active : LaurusMixState.None,
        },
      });
    });
  }
  const newEffectGroups: Map<string, LaurusEffectGroupResult> = new Map();
  if (projectDependencies) {
    projectDependencies.effectGroups.forEach((e) => {
      newEffectGroups.set(e.effect_group_id, e);
    });
  }

  const newMediaGroups: Map<string, LaurusMediaGroupResult> = new Map();
  mediaGroups.forEach((e) => {
    newMediaGroups.set(e.media_group_id, e);
  });

  const newProjectDefault: LaurusProjectResult = {
    ...defaultProject,
    frame_width: Math.round(RESOLUTION.FRAME_WIDTH_4_5 * resolution.factor),
    frame_height: Math.round(RESOLUTION.FRAME_HEIGHT_4_5 * resolution.factor),
  };

  const newProject = projectDependencies ? initProject(projectDependencies.project) : newProjectDefault;

  const newCanvasSvgs: Map<string, LaurusSvgResult> = projectDependencies
    ? new Map(
        projectDependencies.project.svgs.entries().map((e) => [
          e[0],
          {
            ...projectDependencies.canvasSvgs.find((i) => i.svg_media_id == e[1].svg_media_id),
          },
        ]),
      )
    : new Map();

  const newCanvasImgs: Map<string, LaurusImgResult> = projectDependencies
    ? new Map(
        projectDependencies.project.imgs.entries().map((e) => [
          e[0],
          {
            ...projectDependencies.canvasImgs.find((i) => i.img_media_id == e[1].img_media_id),
          },
        ]),
      )
    : new Map();

  const newCanvasMasks: Map<string, LaurusMaskResult> = projectDependencies
    ? new Map(
        (projectDependencies.project.masks ?? new Map<string, LaurusProjectMask>())
          .entries()
          .map((e): [string, LaurusMaskResult | undefined] => [
            e[0],
            projectDependencies.canvasMasks.find((v) => v.mask_media_id == e[1].media_id),
          ])
          .filter((e): e is [string, LaurusMaskResult] => e[1] !== undefined),
      )
    : new Map();

  const newObjectReviews: Map<string, LaurusObjectReview> = projectDependencies
    ? new Map(projectDependencies.objectReviews.map((r) => [r.mask_media_id, r]))
    : new Map();

  if (projectDependencies) {
    const placedImgIds = new Set(projectDependencies.project.imgs.values().map((i) => i.img_media_id));
    getMaskSourceImgIds(projectDependencies.project.masks, newCanvasMasks).forEach((sourceImgMediaId) => {
      if (placedImgIds.has(sourceImgMediaId) || newCanvasImgs.has(sourceImgMediaId)) {
        return;
      }
      const sourceImg = projectDependencies.canvasImgs.find((i) => i.img_media_id == sourceImgMediaId);
      if (sourceImg) {
        newCanvasImgs.set(sourceImgMediaId, { ...sourceImg });
      }
    });
  }

  const browserImgIds = new Set(browserDependencies.browserImgs.map((i) => i.img_media_id));
  const browserSvgIds = new Set(browserDependencies.browserSvgs.map((s) => s.svg_media_id));

  const missingImgs = Array.from(newCanvasImgs.values()).filter((i) => !browserImgIds.has(i.img_media_id));
  const missingSvgs = Array.from(newCanvasSvgs.values()).filter((s) => !browserSvgIds.has(s.svg_media_id));

  const projectImgIds = new Set(projectDependencies?.project.imgs.values().map((i) => i.img_media_id) || []);
  const projectSvgIds = new Set(projectDependencies?.project.svgs.values().map((s) => s.svg_media_id) || []);

  const combinedImgs = [...browserDependencies.browserImgs, ...missingImgs];
  const rawBrowserImgs: LaurusImgResult[] = newProject.browse_public_imgs
    ? combinedImgs
        .sort((a, b) => {
          const aExists = projectImgIds.has(a.img_media_id);
          const bExists = projectImgIds.has(b.img_media_id);
          if (aExists && !bExists) return -1;
          if (!aExists && bExists) return 1;
          return a.order - b.order;
        })
        .map((v) => ({ ...v }))
    : Array.from(newCanvasImgs.values()).sort((a, b) => a.order - b.order);
  const newBrowserImgs: LaurusImgResult[] = [];
  const seenImgIds = new Set<string>();
  for (const img of rawBrowserImgs) {
    if (!seenImgIds.has(img.img_media_id)) {
      newBrowserImgs.push(img);
      seenImgIds.add(img.img_media_id);
    }
  }

  const combinedSvgs = [...browserDependencies.browserSvgs, ...missingSvgs];
  const rawBrowserSvgs: LaurusSvgResult[] = newProject.browse_public_svgs
    ? combinedSvgs
        .sort((a, b) => {
          const aExists = projectSvgIds.has(a.svg_media_id);
          const bExists = projectSvgIds.has(b.svg_media_id);
          if (aExists && !bExists) return -1;
          if (!aExists && bExists) return 1;
          return a.order - b.order;
        })
        .map((v) => ({ ...v }))
    : Array.from(newCanvasSvgs.values()).sort((a, b) => a.order - b.order);
  const newBrowserSvgs: LaurusSvgResult[] = [];
  const seenSvgIds = new Set<string>();
  for (const svg of rawBrowserSvgs) {
    if (!seenSvgIds.has(svg.svg_media_id)) {
      newBrowserSvgs.push(svg);
      seenSvgIds.add(svg.svg_media_id);
    }
  }

  const newBrowserFrames: LaurusCropSvg[] = getCrops("rgba(200, 200, 200, 1)");

  const newProjectContextMenus = new Map<string, ProjectMediaContextMenu>();
  if (projectDependencies) {
    projectDependencies.project.imgs.forEach((img, key) => {
      newProjectContextMenus.set(key, {
        showContextMenu: false,
        contextMenuConfig: getNewContextMenuConfig(
          { top: img.top, left: img.left },
          {
            width: projectDependencies.project.canvas_width,
            height: projectDependencies.project.canvas_height,
          },
          { ...img },
          { x: img.scale_x, y: img.scale_y },
          { ...DEFAULT_CONTEXT_MENU_CONFIG },
        ),
      });
    });
    projectDependencies.project.svgs.forEach((svg, key) => {
      newProjectContextMenus.set(key, {
        showContextMenu: false,
        contextMenuConfig: getNewContextMenuConfig(
          { top: svg.top, left: svg.left },
          {
            width: projectDependencies.project.canvas_width,
            height: projectDependencies.project.canvas_height,
          },
          { ...svg },
          { x: svg.scale_x, y: svg.scale_y },
          { ...DEFAULT_CONTEXT_MENU_CONFIG },
        ),
      });
    });
  }

  const newCarouselEntries = initCarouselEntries(newProject, newCanvasMasks);

  return {
    core: {
      ...defaultCoreState,
      project: newProject,
      effects: newEffects,
      effectGroups: newEffectGroups,
      mediaGroups: newMediaGroups,
      canvasImgs: newCanvasImgs,
      canvasSvgs: newCanvasSvgs,
      canvasMasks: newCanvasMasks,
      objectReviews: newObjectReviews,
      apiOrigin: apiOrigin,
      timelineUnit: timelineUnits[0],
      timelineMaxValue: timelineValues[1],
      accessToken,
    },
    ui: {
      ...defaultUIState,
      browserImgs: newBrowserImgs,
      browserSvgs: newBrowserSvgs,
      browserFrames: newBrowserFrames,
      resolution,
      carouselEntries: newCarouselEntries,
      mixableEffects: mixableEffects,
      effectNames: effectNames ?? [],
      timelineUnits: [...timelineUnits],
      timelineValues: [...timelineValues],
      projectContextMenus: newProjectContextMenus,
    },
  };
}

interface Workspace {
  apiOriginInit: string | undefined;
  mediaPageSizeInit: number;
  timelineValuesInit: number[];
  timelineUnitsInit: string[];
  mixableEffectsInit: string[];
  effectNamesInitPromise: Promise<string[] | undefined>;
  projectInitPromise: Promise<ProjectDependencies | undefined>;
  browserInitPromise: Promise<BrowserDependencies>;
  mediaGroupsInitPromise: Promise<LaurusMediaGroupResult[]>;
  resolutionInit: WorkspaceResolution;
  me: MeDependencies;
}

export default function Workspace({
  apiOriginInit,
  mediaPageSizeInit,
  timelineValuesInit,
  timelineUnitsInit,
  mixableEffectsInit,
  effectNamesInitPromise,
  projectInitPromise,
  browserInitPromise,
  mediaGroupsInitPromise,
  resolutionInit,
  me,
}: Workspace) {
  const effectNamesInit = use(effectNamesInitPromise);
  const projectInit = use(projectInitPromise);
  const browserInit = use(browserInitPromise);
  const mediaGroupsInit = use(mediaGroupsInitPromise);
  const [isMetaKeyPressed, setIsMetaKeyPressed] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);
  const mostRecentlyEnteredEffectUnitKeyRef = useRef<string | undefined>(undefined);
  const getMostRecentlyEnteredEffectUnitKey = useCallback(() => mostRecentlyEnteredEffectUnitKeyRef.current, []);
  const setMostRecentlyEnteredEffectUnitKey = useCallback((key: string | undefined) => {
    mostRecentlyEnteredEffectUnitKeyRef.current = key;
  }, []);
  const [mostRecentlyHoveredMaskKey, setMostRecentlyHoveredMaskKey] = useState<string | undefined>(undefined);
  const [selectedEffectUnitKeys, setSelectedEffectUnitKeys] = useState<Set<string>>(new Set<string>());
  const [selectedImgKeys, setSelectedImgKeys] = useState<Set<string>>(new Set<string>());
  const [selectedSvgKeys, setSelectedSvgKeys] = useState<Set<string>>(new Set<string>());
  const [selectedMaskKeys, setSelectedMaskKeys] = useState<Set<string>>(new Set<string>());
  const [mediaPageSize] = useState(mediaPageSizeInit);

  const [minifiedControlsSize] = useState(() => {
    switch (resolutionInit.type) {
      case "high":
        return {
          playContainer: 44,
          playSvg: 44,
          playBottom: 100,
          playLeft: 40,
          recordingWidth: 14,
          recordingHeight: 14,
          recordingBottom: 115,
          recordingRight1: 506,
          recordingRight2: 86,
        };
      case "midhigh":
        return {
          playContainer: 44,
          playSvg: 44,
          playBottom: 80,
          playLeft: 40,
          recordingWidth: 14,
          recordingHeight: 14,
          recordingBottom: 95,
          recordingRight1: 366,
          recordingRight2: 66,
        };
      case "low":
      case "midlow":
        return {
          playContainer: 40,
          playSvg: 40,
          playBottom: 80,
          playLeft: 40,
          recordingWidth: 14,
          recordingHeight: 14,
          recordingBottom: 95,
          recordingRight1: 336,
          recordingRight2: 66,
        };
    }
  });
  const [statusAction] = useState<string>("laurus workspace");
  const [statusBody] = useState<string[]>([]);
  const [{ core: coreInit, ui: uiInit }] = useState(() => {
    return initReducer({
      arg1: projectInit,
      arg2: effectNamesInit,
      arg3: timelineValuesInit,
      arg4: timelineUnitsInit,
      arg5: apiOriginInit,
      arg6: browserInit,
      arg7: resolutionInit,
      arg8: me.accessToken,
      arg9: mixableEffectsInit,
      arg10: mediaGroupsInit,
    });
  });
  const [coreState, dispatch] = useReducer(coreContextReducer, coreInit);
  const [uiState, uiDispatch] = useReducer(uiContextReducer, uiInit);
  const isGuest = !coreState.accessToken;
  const { sendLightUpdate: sendMaskLightUpdate, closeSocket: closeMaskLightSocket } = useMaskLightSockets(
    coreState.apiOrigin,
    coreState.accessToken,
  );
  const { sendObjectUpdate: sendMaskObjectUpdate, closeSocket: closeMaskObjectSocket } = useMaskObjectSockets(
    coreState.apiOrigin,
    coreState.accessToken,
  );
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          statusbar: {
            container: {
              minWidth: 2000,
            },
          },
        };
      case "midhigh":
        return {
          statusbar: {
            container: {
              minWidth: 1500,
            },
          },
        };
      case "low":
      case "midlow":
        return {
          statusbar: {
            container: {
              minWidth: 1400,
            },
          },
        };
    }
  });
  const svgElementsRef = useRef<Map<string, SVGSVGElement>>(null);
  const imgElementsRef = useRef<Map<string, HTMLImageElement>>(null);
  const maskElementsRef = useRef<Map<string, HTMLCanvasElement>>(null);
  const maskHandlesRef = useRef<Map<string, Set<MaskImperativeHandle>>>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasSizeRef = useRef<HTMLDivElement | null>(null);
  const canvasScaleRef = useRef<HTMLDivElement | null>(null);
  const appliedCanvasZoomRef = useRef(1);
  const framesCacheRef = useRef<Map<string, LaurusFrame[]>>(new Map());
  const refreshIconRef = useRef<SVGSVGElement | null>(null);
  const hasInitiatedFrameDownloadRef = useRef(false);
  const frameDownloadAbortControllerRef = useRef<AbortController | null>(null);

  function startRefreshAnimaiton() {
    if (refreshIconRef.current) {
      const keyframes: Keyframe[] = [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }];
      const animationOptions: KeyframeAnimationOptions = {
        duration: 1000,
        iterations: Infinity,
        easing: "linear",
      };
      const keyframeEffect: KeyframeEffect = new KeyframeEffect(refreshIconRef.current, keyframes, animationOptions);
      const animation: Animation = new Animation(keyframeEffect);
      animation.play();
    }
  }

  function stopRefreshAnimation() {
    if (refreshIconRef.current) {
      const aniamtions = refreshIconRef.current.getAnimations();
      aniamtions.forEach((a) => a.cancel());
    }
  }

  const handleImgPageRequest = useCallback(async () => {
    const mediaArray = Array.from(uiState.browserImgs.values());
    startRefreshAnimaiton();
    const imgSearch: LaurusImgPageSearch = {
      size: mediaPageSize,
      exlusions: mediaArray.flatMap((m) => m.img_media_id),
    };
    const response = await searchImgs(coreState.apiOrigin, imgSearch);
    if (response && response.length > 0) {
      for (let i = 0; i < response.length; i++) {
        uiDispatch({
          type: UIActionType.AddBrowserImg,
          value: { ...response[i] },
          first: false,
        });
      }
      stopRefreshAnimation();
      return true;
    } else {
      stopRefreshAnimation();
      return false;
    }
  }, [coreState.apiOrigin, mediaPageSize, uiState.browserImgs]);

  const handleSvgPageRequest = useCallback(async () => {
    const mediaArray = Array.from(uiState.browserSvgs.values());
    startRefreshAnimaiton();
    const svgSearch: LaurusSvgPageSearch = {
      size: mediaPageSize,
      exlusions: mediaArray.flatMap((m) => m.svg_media_id),
    };
    const response = await searchSvgs(coreState.apiOrigin, svgSearch);
    if (response && response.length > 0) {
      for (let i = 0; i < response.length; i++) {
        uiDispatch({
          type: UIActionType.AddBrowserSvg,
          value: { ...response[i] },
          first: false,
        });
      }
      stopRefreshAnimation();
      return true;
    } else {
      stopRefreshAnimation();
      return false;
    }
  }, [coreState.apiOrigin, mediaPageSize, uiState.browserSvgs]);

  const handleMixRestoration = useCallback(() => {
    if (uiState.tool.type === "mix") {
      const restoredEffects = coreState.effects.map((e) => ({
        ...e,
        value: {
          ...e.value,
          mixState: e.value.mix ? LaurusMixState.Active : LaurusMixState.None,
        },
      })) as LaurusEffect[];
      dispatch({
        type: CoreActionType.SetEffects,
        value: restoredEffects,
        preserveCache: true,
      });
    }
  }, [uiState.tool.type, coreState.effects, dispatch]);

  const closeContextMenus = useCallback(() => {
    uiDispatch({ type: UIActionType.CloseAllContextMenus });
  }, [uiDispatch]);

  const getNewAnimationsByTarget = useCallback(
    async (fill: FillMode, reverse: boolean, target: AnimationTarget) => {
      const { inputKey, getFrames, effectKey } = target;
      try {
        document.body.style.cursor = "progress";
        const enabledEffects = [
          ...coreState.effects.filter(
            (e) => !e.value.disabled && !coreState.effectGroups.get(e.value.effect_group_id)?.disabled,
          ),
        ];
        const foundEffect = enabledEffects.find((e) => e.key === effectKey);
        if (!foundEffect) return [];

        const animationOptions: KeyframeAnimationOptions = {
          duration: foundEffect.value.end * 1000 - foundEffect.value.start * 1000,
          iterations: 1,
          fill,
        };
        const newAnimations: Animation[] = [];
        const framesFromServer = await getFrames(coreState.apiOrigin);
        if (!framesFromServer) return [];
        if (reverse) {
          framesFromServer.reverse();
        }
        const keyframes: Keyframe[] = toKeyframes(framesFromServer, false);
        const element =
          imgElementsRef.current?.get(inputKey) ||
          svgElementsRef.current?.get(inputKey) ||
          maskElementsRef.current?.get(inputKey);
        if (element) {
          const keyframeEffect = new KeyframeEffect(element, keyframes, animationOptions);
          const animation = new Animation(keyframeEffect, document.timeline);
          newAnimations.push(animation);
        }
        return newAnimations;
      } finally {
        document.body.style.cursor = "";
      }
    },
    [coreState.apiOrigin, coreState.effectGroups, coreState.effects],
  );

  const getNewAnimations = useCallback(
    async (fill: FillMode, reverse: boolean, setCache: boolean) => {
      const abortController = new AbortController();
      frameDownloadAbortControllerRef.current = abortController;
      try {
        document.body.style.cursor = "progress";
        const enabledEffects = [
          ...coreState.effects.filter(
            (e) => !e.value.disabled && !coreState.effectGroups.get(e.value.effect_group_id)?.disabled,
          ),
        ];
        const eligibleItems = new Set<string>();
        let globalLimit = 0;
        enabledEffects.forEach((e) => {
          e.value.math.forEach((_, inputKey) => {
            if (coreState.project.imgs.has(inputKey) || coreState.project.svgs.has(inputKey)) {
              eligibleItems.add(inputKey);
              globalLimit = Math.max(globalLimit, e.value.end);
            } else if (
              (e.type === "move" ||
                e.type === "light_source" ||
                e.type === "scale" ||
                e.type === "rotate" ||
                e.type === "skew") &&
              coreState.project.masks.has(parseMaskLightInputId(inputKey).maskKey)
            ) {
              eligibleItems.add(inputKey);
              if (
                parseMaskLightInputId(inputKey).lightId === undefined &&
                parseMaskObjectInputId(inputKey).objectId === undefined
              ) {
                globalLimit = Math.max(globalLimit, e.value.end);
              }
            }
          });
        });
        const animationOptions: KeyframeAnimationOptions = {
          duration: globalLimit * 1000,
          iterations: 1,
          fill,
        };
        const total = eligibleItems.size;
        const newAnimations: Animation[] = [];
        let renderedInputs = 0;
        for (const inputKey of eligibleItems) {
          if (abortController.signal.aborted) break;
          let laurusFrames: LaurusFrame[] = [];
          if (!(coreState.inputsToRender.has("*") || coreState.inputsToRender.has(inputKey))) {
            laurusFrames = [...(framesCacheRef.current.get(inputKey) ?? [])];
          }
          if (laurusFrames.length === 0) {
            if (renderedInputs == 0) {
              uiDispatch({
                type: UIActionType.SetAnimationDownloadProgress,
                value: 0,
              });
            }
            const framesFromServer = await getFrames(
              coreState.apiOrigin,
              coreState.project.project_id,
              inputKey,
              coreState.project.fps,
              abortController.signal,
            );
            if (abortController.signal.aborted) break;
            renderedInputs++;
            uiDispatch({
              type: UIActionType.SetAnimationDownloadProgress,
              value: Math.round((renderedInputs / total) * 100),
            });

            if (!framesFromServer) continue;
            laurusFrames = framesFromServer;
            if (setCache) {
              framesCacheRef.current.set(inputKey, [...framesFromServer]);
            }
          }
          const element =
            imgElementsRef.current?.get(inputKey) ||
            svgElementsRef.current?.get(inputKey) ||
            maskElementsRef.current?.get(inputKey);
          if (element) {
            if (reverse) {
              laurusFrames.reverse();
            }
            const keyframes: Keyframe[] = toKeyframes(laurusFrames, false);
            const keyframeEffect = new KeyframeEffect(element, keyframes, animationOptions);
            const animation = new Animation(keyframeEffect, document.timeline);
            newAnimations.push(animation);
          }
        }
        if (abortController.signal.aborted) return [];
        dispatch({ type: CoreActionType.SetInputsToRender, value: new Set<string>() });
        return newAnimations;
      } finally {
        document.body.style.cursor = "";
        uiDispatch({
          type: UIActionType.SetAnimationDownloadProgress,
          value: undefined,
        });
        if (frameDownloadAbortControllerRef.current === abortController) {
          frameDownloadAbortControllerRef.current = null;
        }
      }
    },
    [
      coreState.apiOrigin,
      coreState.inputsToRender,
      coreState.effectGroups,
      coreState.effects,
      coreState.project.fps,
      coreState.project.imgs,
      coreState.project.masks,
      coreState.project.project_id,
      coreState.project.svgs,
    ],
  );

  const cancelFrameDownload = useCallback(() => {
    frameDownloadAbortControllerRef.current?.abort();
  }, []);

  const notifyMaskToolChanged = useCallback((toolType: string) => {
    maskHandlesRef.current?.forEach((handles) =>
      handles.forEach((h) => {
        h.abortLightDragForToolChange(toolType);
      }),
    );
  }, []);
  const notifyMaskSelectionChanged = useCallback((key: string | undefined) => {
    maskHandlesRef.current?.forEach((handles, maskKey) =>
      handles.forEach((h) => h.setSelectedHighlighted(maskKey === key)),
    );
  }, []);
  const notifyMaskHighlightSuppressed = useCallback((suppressed: boolean) => {
    maskHandlesRef.current?.forEach((handles) => handles.forEach((h) => h.setHighlightSuppressed(suppressed)));
  }, []);
  const notifyMaskSelectedLightChanged = useCallback((maskKey: string, lightId: number | undefined) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.setSelectedLight(lightId));
  }, []);
  const notifyMaskSelectedObjectChanged = useCallback((maskKey: string, objectId: number | undefined) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.setSelectedObject(objectId));
  }, []);
  const notifyMaskPendingLightSet = useCallback((maskKey: string, indices: Set<number>, lightId?: number) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.setPendingLight(indices, lightId));
  }, []);
  const notifyMaskPendingLightCleared = useCallback((maskKey: string | undefined) => {
    if (maskKey === undefined) return;
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.clearPendingLight());
  }, []);
  const notifyMaskObjectReviewPreview = useCallback(
    (maskKey: string, indices: Set<number> | undefined, diffBase?: Set<number>) => {
      maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.setObjectReviewPreview(indices, diffBase));
    },
    [],
  );

  const notifyCanvasZoomChanged = useCallback((zoom: number) => {
    const node = canvasScaleRef.current;
    const sizer = canvasSizeRef.current;
    const area = canvasAreaRef.current;
    if (!node) return;
    const previous = appliedCanvasZoomRef.current;
    appliedCanvasZoomRef.current = zoom;

    let anchorX = 0;
    let anchorY = 0;
    if (area && sizer) {
      const areaRect = area.getBoundingClientRect();
      const sizerRect = sizer.getBoundingClientRect();
      anchorX = (areaRect.left + area.clientWidth / 2 - sizerRect.left) / previous;
      anchorY = (areaRect.top + area.clientHeight / 2 - sizerRect.top) / previous;
    }

    node.style.transform = zoom === 1 ? "" : `scale(${zoom})`;
    if (sizer) {
      sizer.style.width = `${node.offsetWidth * zoom}px`;
      sizer.style.height = `${node.offsetHeight * zoom}px`;
    }

    if (!area || !sizer || previous === zoom) return;
    const areaRect = area.getBoundingClientRect();
    const sizerRect = sizer.getBoundingClientRect();
    area.scrollLeft += sizerRect.left + anchorX * zoom - (areaRect.left + area.clientWidth / 2);
    area.scrollTop += sizerRect.top + anchorY * zoom - (areaRect.top + area.clientHeight / 2);
  }, []);
  const notifyMaskLightUpdated = useCallback((maskKey: string, updated: LaurusMaskResult) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.syncLitIndices(updated));
  }, []);
  const notifyMaskAppearanceChanged = useCallback((maskKey: string, override?: MaskAppearanceOverride) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.applyMaskAppearanceDefaults(override));
  }, []);
  const notifyMaskLightSourcePreviewToggled = useCallback((enabled: boolean) => {
    maskHandlesRef.current?.forEach((handles) => handles.forEach((h) => h.onLightSourcePreviewToggled(enabled)));
  }, []);
  const notifyMaskPendingTopologySet = useCallback((maskKey: string, edit: PendingTopologyEdit) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.setPendingTopology(edit));
  }, []);
  const notifyMaskRetouchRequested = useCallback(async (maskKey: string) => {
    const handle = maskHandlesRef.current?.get(maskKey)?.values().next().value;
    if (!handle) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    handle.retouchObjectMesh();
  }, []);
  const notifyMaskPendingTopologyCleared = useCallback((maskKey: string | undefined) => {
    if (maskKey === undefined) return;
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.clearPendingTopology());
  }, []);
  const notifyMaskObjectsUpdated = useCallback((maskKey: string, updated: LaurusMaskResult) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.syncObjects(updated));
  }, []);

  const lightMeshSection = useCallback(
    async (maskKey: string, polygonIndices: number[], size: number) => {
      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }
      const maskData = coreState.canvasMasks.get(maskKey);
      if (!maskData) return;
      const maskMeta = coreState.project.masks.get(maskKey);
      const lightId = nextLightId(maskData.lights);
      const name = `light ${lightId}`;

      dispatch({
        type: CoreActionType.SetPendingLight,
        value: { maskKey, lightId, polygonIndices },
      });
      notifyMaskPendingLightSet(maskKey, new Set(polygonIndices), lightId);

      const center = lightCenterFromCentroids(maskGeometry(maskData).centroids, new Set(polygonIndices));
      const updated = await sendMaskLightUpdate(
        maskData.mask_media_id,
        toLightUpdate(newLight(lightId, name), {
          polygon_indices: polygonIndices,
          order: frontElementOrder(maskStack(maskData)),
          size,
          intensity: maskMeta?.light_preview_intensity ?? LIGHT_INTENSITY_DEFAULT,
          darkness: maskMeta?.light_preview_darkness ?? LIGHT_DARKNESS_DEFAULT,
          falloff: Math.min(size * LIGHT_FALLOFF_TO_SIZE_RATIO, Math.min(maskData.width, maskData.height)),
          ...(center ? { cx: center[0], cy: center[1], radius: size / 2, shape: unitCirclePath() } : {}),
        }),
      );
      if (updated) {
        const patched = applyLightDelta(maskData, updated);
        dispatch({ type: CoreActionType.SetCanvasMask, key: maskKey, value: patched });
        notifyMaskLightUpdated(maskKey, patched);
        uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "light", key: maskKey, lightId } });
        uiDispatch({
          type: UIActionType.SetSelectedElement,
          value: { key: maskKey, type: "light", lightId },
        });
        notifyMaskSelectionChanged(maskKey);
        notifyMaskSelectedLightChanged(maskKey, lightId);
        notifyMaskSelectedObjectChanged(maskKey, undefined);
      }
      dispatch({ type: CoreActionType.SetPendingLight, value: undefined });
      notifyMaskPendingLightCleared(maskKey);
      uiDispatch({
        type: UIActionType.SetTool,
        value: {
          type: "mask",
          lightingMeshSection: false,
          raisingObjects: uiState.tool.type === "mask" ? uiState.tool.raisingObjects : false,
        },
      });
      notifyMaskToolChanged("mask");
    },
    [
      isGuest,
      coreState.canvasMasks,
      coreState.project.masks,
      sendMaskLightUpdate,
      dispatch,
      uiDispatch,
      uiState.tool,
      notifyMaskPendingLightSet,
      notifyMaskSelectionChanged,
      notifyMaskSelectedLightChanged,
      notifyMaskSelectedObjectChanged,
      notifyMaskPendingLightCleared,
      notifyMaskLightUpdated,
      notifyMaskToolChanged,
    ],
  );

  const createObject = useCallback(
    async (
      maskKey: string,
      circle: { cx: number; cy: number; radius: number },
      seed: { elevation: number; falloff: number; fill: LaurusObjectFill },
    ) => {
      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }
      const maskData = coreState.canvasMasks.get(maskKey);
      if (!maskData) return;
      const objectId = nextObjectId(maskData.objects);
      const radius = Math.max(circle.radius, MIN_MASK_OBJECT_RADIUS_PX);
      const shape = unitCirclePath();
      const geometry = maskGeometry(maskData);
      const membership = dropIndicesClaimedByObjects(
        indicesInObjectFromCentroids(geometry.centroids, { cx: circle.cx, cy: circle.cy, radius, shape }),
        geometry,
        maskData.polygons,
      );
      const polygonIndices = [...membership];
      if (polygonIndices.length === 0) return;

      const edit: PendingTopologyEdit = {
        maskKey,
        objectId,
        cx: circle.cx,
        cy: circle.cy,
        radius,
        elevation: seed.elevation,
        falloff: seed.falloff,
        shape,
        fill: seed.fill,
        polygonIndices: membership,
      };

      dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: edit });
      notifyMaskPendingTopologySet(maskKey, edit);

      const updated = await sendMaskObjectUpdate(
        maskData.mask_media_id,
        toObjectUpdate(newObject(objectId, `object ${objectId}`), {
          cx: circle.cx,
          cy: circle.cy,
          radius,
          elevation: seed.elevation,
          falloff: seed.falloff,
          shape,
          ...toObjectFillFields(seed.fill),
          order: frontElementOrder(maskStack(maskData)),
          polygon_indices: polygonIndices,
        }),
      );
      if (updated) {
        const patched = applyObjectDelta(maskData, updated);
        dispatch({ type: CoreActionType.SetCanvasMask, key: maskKey, value: patched });
        notifyMaskObjectsUpdated(maskKey, patched);
        uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "object", key: maskKey, objectId } });
        uiDispatch({ type: UIActionType.SetSelectedElement, value: { key: maskKey, type: "object", objectId } });
        notifyMaskSelectionChanged(maskKey);
        notifyMaskSelectedObjectChanged(maskKey, objectId);
        notifyMaskSelectedLightChanged(maskKey, undefined);
      }
      dispatch({ type: CoreActionType.SetPendingTopologyEdit, value: undefined });
      notifyMaskPendingTopologyCleared(maskKey);
    },
    [
      isGuest,
      coreState.canvasMasks,
      sendMaskObjectUpdate,
      dispatch,
      uiDispatch,
      notifyMaskPendingTopologySet,
      notifyMaskPendingTopologyCleared,
      notifyMaskObjectsUpdated,
      notifyMaskSelectionChanged,
      notifyMaskSelectedObjectChanged,
      notifyMaskSelectedLightChanged,
    ],
  );

  const applyStackOrders = useCallback(
    async (maskKey: string, changes: StackChange[]) => {
      const maskData = coreState.canvasMasks.get(maskKey);
      if (!maskData || changes.length === 0) return;
      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }

      const ordered = (kind: StackRef["kind"]) =>
        new Map(changes.filter((change) => change.kind === kind).map((change) => [change.id, change.order]));
      const objectOrders = ordered("object");
      const lightOrders = ordered("light");
      const optimistic: LaurusMaskResult = {
        ...maskData,
        objects: maskData.objects.map((object) => {
          const order = objectOrders.get(object.id);
          return order === undefined ? object : { ...object, order };
        }),
        lights: maskData.lights.map((light) => {
          const order = lightOrders.get(light.id);
          return order === undefined ? light : { ...light, order };
        }),
      };
      dispatch({ type: CoreActionType.SetCanvasMask, key: maskKey, value: optimistic });
      notifyMaskObjectsUpdated(maskKey, optimistic);
      notifyMaskLightUpdated(maskKey, optimistic);

      let patched = maskData;
      for (const change of changes) {
        if (change.kind === "object") {
          const object = patched.objects.find((o) => o.id === change.id);
          if (!object) continue;
          const updated = await sendMaskObjectUpdate(
            patched.mask_media_id,
            toObjectUpdate(object, {
              order: change.order,
              polygon_indices: polygonIndicesForObject(patched.polygons, object.id),
            }),
          );
          if (!updated) break;
          patched = applyObjectDelta(patched, updated);
        } else {
          const light = patched.lights.find((l) => l.id === change.id);
          if (!light) continue;
          const updated = await sendMaskLightUpdate(
            patched.mask_media_id,
            toLightUpdate(light, {
              order: change.order,
              polygon_indices: polygonIndicesForLight(patched.polygons, light.id),
            }),
          );
          if (!updated) break;
          patched = applyLightDelta(patched, updated);
        }
      }
      dispatch({ type: CoreActionType.SetCanvasMask, key: maskKey, value: patched });
      notifyMaskObjectsUpdated(maskKey, patched);
      notifyMaskLightUpdated(maskKey, patched);
    },
    [
      isGuest,
      coreState.canvasMasks,
      sendMaskObjectUpdate,
      sendMaskLightUpdate,
      dispatch,
      notifyMaskObjectsUpdated,
      notifyMaskLightUpdated,
    ],
  );

  const reorderElement = useCallback(
    async (maskKey: string, target: StackRef, direction: StackDirection) => {
      const maskData = coreState.canvasMasks.get(maskKey);
      if (!maskData) return;
      await applyStackOrders(maskKey, reorderElements(maskStack(maskData), target, direction));
    },
    [coreState.canvasMasks, applyStackOrders],
  );

  const restackMaskStack = useCallback(
    async (maskKey: string, changes: StackChange[]) => {
      await applyStackOrders(maskKey, changes);
    },
    [applyStackOrders],
  );

  const deleteObject = useCallback(
    async (maskKey: string, objectId: number) => {
      const maskData = coreState.canvasMasks.get(maskKey);
      const object = maskData?.objects.find((p) => p.id === objectId);
      if (!maskData || !object) return;

      const updated = await sendMaskObjectUpdate(
        maskData.mask_media_id,
        toObjectUpdate(object, { remove: true, polygon_indices: [] }),
      );
      if (!updated) return;

      const patched = applyObjectDelta(maskData, updated);
      dispatch({ type: CoreActionType.SetCanvasMask, key: maskKey, value: patched });
      notifyMaskObjectsUpdated(maskKey, patched);
      uiDispatch({ type: UIActionType.DeleteCarouselEntry, key: maskKey, objectId });
      deleteMaskObjectEffects(
        maskKey,
        objectId,
        coreState.apiOrigin,
        coreState.accessToken,
        coreState.effects,
        dispatch,
      );
      if (
        uiState.selectedElement?.key === maskKey &&
        uiState.selectedElement.type === "object" &&
        uiState.selectedElement.objectId === objectId
      ) {
        uiDispatch({ type: UIActionType.SetSelectedElement, value: { key: maskKey, type: "mask" } });
        notifyMaskSelectionChanged(maskKey);
        notifyMaskSelectedObjectChanged(maskKey, undefined);
      }
      if (
        uiState.activeElement?.key === maskKey &&
        uiState.activeElement.type === "object" &&
        uiState.activeElement.objectId === objectId
      ) {
        uiDispatch({ type: UIActionType.SetActiveElement, value: { key: maskKey, type: "mask" } });
      }
    },
    [
      coreState.canvasMasks,
      coreState.apiOrigin,
      coreState.accessToken,
      coreState.effects,
      sendMaskObjectUpdate,
      dispatch,
      uiDispatch,
      uiState.activeElement,
      uiState.selectedElement,
      notifyMaskObjectsUpdated,
      notifyMaskSelectionChanged,
      notifyMaskSelectedObjectChanged,
    ],
  );

  const handleRewindAll = useCallback(
    async (playbackRate: number) => {
      if (uiState.playbackMode.type !== "stopped" || !uiState.filledForwards) return;
      if (!confirmEndingMaskEdit(uiState.maskEdit)) return;
      handleMixRestoration();
      closeContextMenus();
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "waiting" },
      });

      const newAnimations = await getNewAnimations("forwards", true, false);
      if (newAnimations.length == 0) {
        uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
        uiDispatch({
          type: UIActionType.SetPlaybackMode,
          value: { type: "stopped" },
        });
        uiDispatch({ type: UIActionType.SetFilledForwards, value: false });
        return;
      }
      Promise.all(newAnimations.map((animation) => animation.finished))
        .then(() => {
          uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
          uiDispatch({
            type: UIActionType.SetPlaybackMode,
            value: { type: "stopped" },
          });
          uiDispatch({ type: UIActionType.SetFilledForwards, value: false });
        })
        .catch((err) => {
          if (err instanceof Error && err.name !== "AbortError") {
            console.log("unknown error from waapi:", err);
          }
        });
      newAnimations.forEach((a) => {
        a.updatePlaybackRate(playbackRate);
        a.play();
      });
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "playing" },
      });
    },
    [
      closeContextMenus,
      getNewAnimations,
      handleMixRestoration,
      uiState.filledForwards,
      uiState.maskEdit,
      uiState.playbackMode.type,
    ],
  );

  const handlePlayAll = useCallback(async () => {
    if (uiState.playbackMode.type !== "stopped") return;
    if (!confirmEndingMaskEdit(uiState.maskEdit)) return;
    handleMixRestoration();
    closeContextMenus();
    uiDispatch({
      type: UIActionType.SetPlaybackMode,
      value: { type: "waiting" },
    });
    uiDispatch({ type: UIActionType.SetRecordingLight, value: true });

    if (uiState.tool.type !== "viewport" && uiState.tool.type !== "none") {
      uiDispatch({ type: UIActionType.SetTool, value: { type: "none" } });
      notifyMaskToolChanged("none");
    }
    if (uiState.activeElement !== undefined) {
      uiDispatch({ type: UIActionType.SetActiveElement, value: undefined });
    }
    if (uiState.selectedElement !== undefined) {
      uiDispatch({ type: UIActionType.SetSelectedElement, value: undefined });
      notifyMaskSelectionChanged(undefined);
    }

    const players: MaskImperativeHandle[] = [];
    maskHandlesRef.current?.forEach((handles) => handles.forEach((player) => players.push(player)));

    const [newAnimations, preparedStarts] = await Promise.all([
      getNewAnimations("none", false, true),
      Promise.all(players.map((player) => player.preparePlayback())),
    ]);
    const readyStarts = preparedStarts.filter((start) => start !== undefined);

    if (newAnimations.length == 0 && readyStarts.length == 0) {
      uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "stopped" },
      });
      uiDispatch({ type: UIActionType.SetTool, value: { type: "none" } });
      notifyMaskToolChanged("none");
      return;
    }

    const lightSourceFinished = readyStarts.map((start) => start());

    Promise.all([...newAnimations.map((animation) => animation.finished), ...lightSourceFinished])
      .then(() => {
        uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
        uiDispatch({
          type: UIActionType.SetPlaybackMode,
          value: { type: "stopped" },
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          console.log("unknown error from waapi:", err);
        }
      });

    newAnimations.forEach((a) => a.play());
    uiDispatch({
      type: UIActionType.SetPlaybackMode,
      value: { type: "playing" },
    });
  }, [
    closeContextMenus,
    getNewAnimations,
    handleMixRestoration,
    uiState.maskEdit,
    uiState.playbackMode.type,
    uiState.tool.type,
    uiState.activeElement,
    uiState.selectedElement,
    notifyMaskToolChanged,
    notifyMaskSelectionChanged,
  ]);

  const handlePlayTarget = useCallback(
    async (target: AnimationTarget) => {
      if (uiState.playbackMode.type !== "stopped") return;
      if (!confirmEndingMaskEdit(uiState.maskEdit)) return;
      handleMixRestoration();
      closeContextMenus();
      if (uiState.activeElement !== undefined) {
        uiDispatch({ type: UIActionType.SetActiveElement, value: undefined });
      }
      if (uiState.selectedElement !== undefined) {
        uiDispatch({ type: UIActionType.SetSelectedElement, value: undefined });
        notifyMaskSelectionChanged(undefined);
      }
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "waiting" },
      });
      uiDispatch({ type: UIActionType.SetRecordingLight, value: true });

      const newAnimations = await getNewAnimationsByTarget("none", false, target);
      const { objectId: targetObjectId } = parseMaskObjectInputId(target.inputKey);
      const targetDrivesLightSource = coreState.effects.some(
        (effect) =>
          effect.key === target.effectKey &&
          (effect.type === "move" ||
            effect.type === "light_source" ||
            effect.type === "scale" ||
            effect.type === "rotate" ||
            effect.type === "skew") &&
          (parseMaskLightInputId(target.inputKey).lightId !== undefined || targetObjectId !== undefined),
      );
      const lightSourceFinished: Promise<void>[] = [];
      if (targetDrivesLightSource) {
        const { maskKey, lightId } = parseMaskLightInputId(target.inputKey);
        maskHandlesRef.current
          ?.get(maskKey)
          ?.forEach((player) =>
            lightSourceFinished.push(
              targetObjectId !== undefined
                ? player.play(target.effectKey, undefined, targetObjectId)
                : player.play(target.effectKey, lightId),
            ),
          );
      }

      if (newAnimations.length == 0 && lightSourceFinished.length == 0) {
        uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
        uiDispatch({
          type: UIActionType.SetPlaybackMode,
          value: { type: "stopped" },
        });
        return;
      }

      Promise.all([...newAnimations.map((animation) => animation.finished), ...lightSourceFinished])
        .then(() => {
          uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
          uiDispatch({
            type: UIActionType.SetPlaybackMode,
            value: { type: "stopped" },
          });
        })
        .catch((err) => {
          if (err instanceof Error && err.name !== "AbortError") {
            console.log("unknown error from waapi:", err);
          }
        });

      newAnimations.forEach((a) => a.play());
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "playing" },
      });
    },
    [
      closeContextMenus,
      coreState.effects,
      getNewAnimationsByTarget,
      handleMixRestoration,
      uiState.maskEdit,
      uiState.playbackMode.type,
      uiState.activeElement,
      uiState.selectedElement,
      notifyMaskSelectionChanged,
    ],
  );

  const handleFastForwardAll = useCallback(
    async (playbackRate: number) => {
      if (uiState.playbackMode.type !== "stopped") return;
      if (!confirmEndingMaskEdit(uiState.maskEdit)) return;
      handleMixRestoration();
      closeContextMenus();
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "waiting" },
      });

      const newAnimations = await getNewAnimations("forwards", false, false);
      if (newAnimations.length == 0) {
        uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
        uiDispatch({
          type: UIActionType.SetPlaybackMode,
          value: { type: "stopped" },
        });
        uiDispatch({ type: UIActionType.SetFilledForwards, value: true });
        return;
      }
      Promise.all(newAnimations.map((animation) => animation.finished))
        .then(() => {
          uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
          uiDispatch({
            type: UIActionType.SetPlaybackMode,
            value: { type: "stopped" },
          });
          uiDispatch({ type: UIActionType.SetFilledForwards, value: true });
        })
        .catch((err) => {
          if (err instanceof Error && err.name !== "AbortError") {
            console.log("unknown error from waapi:", err);
          }
        });
      newAnimations.forEach((a) => {
        a.updatePlaybackRate(playbackRate);
        a.play();
      });
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "playing" },
      });
    },
    [closeContextMenus, getNewAnimations, handleMixRestoration, uiState.maskEdit, uiState.playbackMode.type],
  );

  const handleStopAll = useCallback(async () => {
    if (uiState.playbackMode.type === "stopped") return;
    if (svgElementsRef.current) {
      svgElementsRef.current.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    }
    if (imgElementsRef.current) {
      imgElementsRef.current.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    }
    if (maskElementsRef.current) {
      maskElementsRef.current.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    }
    maskHandlesRef.current?.forEach((players) => players.forEach((player) => player.stop()));
    uiDispatch({ type: UIActionType.SetRecordingLight, value: false });
    uiDispatch({
      type: UIActionType.SetPlaybackMode,
      value: { type: "stopped" },
    });
    uiDispatch({ type: UIActionType.SetFilledForwards, value: false });
  }, [uiState.playbackMode.type]);

  const hoverContextValue = useMemo(
    () => ({
      getMostRecentlyEnteredEffectUnitKey,
      setMostRecentlyEnteredEffectUnitKey,
      mostRecentlyHoveredMaskKey,
      setMostRecentlyHoveredMaskKey,
      isMetaKeyPressed,
      isAltKeyPressed,
      selectedEffectUnitKeys,
      setSelectedEffectUnitKeys,
      selectedImgKeys,
      setSelectedImgKeys,
      selectedSvgKeys,
      setSelectedSvgKeys,
      selectedMaskKeys,
      setSelectedMaskKeys,
    }),
    [
      getMostRecentlyEnteredEffectUnitKey,
      setMostRecentlyEnteredEffectUnitKey,
      mostRecentlyHoveredMaskKey,
      isMetaKeyPressed,
      isAltKeyPressed,
      selectedEffectUnitKeys,
      selectedImgKeys,
      selectedSvgKeys,
      selectedMaskKeys,
    ],
  );

  const coreContextValue = useMemo(
    () => ({
      coreState,
      dispatch,
      getNewAnimations,
      getNewAnimationsByTarget,
      handleRewindAll,
      handlePlayAll,
      handleFastForwardAll,
      handlePlayTarget,
      handleStopAll,
      cancelFrameDownload,
    }),
    [
      coreState,
      getNewAnimations,
      getNewAnimationsByTarget,
      handleRewindAll,
      handlePlayAll,
      handleFastForwardAll,
      handlePlayTarget,
      handleStopAll,
      cancelFrameDownload,
    ],
  );

  const socketContextValue = useMemo(
    () => ({
      sendMaskLightUpdate,
      closeMaskLightSocket,
      sendMaskObjectUpdate,
      closeMaskObjectSocket,
    }),
    [sendMaskLightUpdate, closeMaskLightSocket, sendMaskObjectUpdate, closeMaskObjectSocket],
  );

  const maskNotifyContextValue = useMemo(
    () => ({
      lightMeshSection,
      createObject,
      deleteObject,
      reorderElement,
      restackMaskStack,
      notifyMaskToolChanged,
      notifyMaskSelectionChanged,
      notifyMaskHighlightSuppressed,
      notifyMaskSelectedLightChanged,
      notifyMaskSelectedObjectChanged,
      notifyMaskPendingLightSet,
      notifyMaskPendingLightCleared,
      notifyMaskLightUpdated,
      notifyMaskAppearanceChanged,
      notifyMaskLightSourcePreviewToggled,
      notifyMaskPendingTopologySet,
      notifyMaskPendingTopologyCleared,
      notifyMaskRetouchRequested,
      notifyMaskObjectReviewPreview,
      notifyCanvasZoomChanged,
      notifyMaskObjectsUpdated,
    }),
    [
      lightMeshSection,
      createObject,
      deleteObject,
      reorderElement,
      restackMaskStack,
      notifyMaskToolChanged,
      notifyMaskSelectionChanged,
      notifyMaskHighlightSuppressed,
      notifyMaskSelectedLightChanged,
      notifyMaskSelectedObjectChanged,
      notifyMaskPendingLightSet,
      notifyMaskPendingLightCleared,
      notifyMaskLightUpdated,
      notifyMaskAppearanceChanged,
      notifyMaskLightSourcePreviewToggled,
      notifyMaskPendingTopologySet,
      notifyMaskPendingTopologyCleared,
      notifyMaskRetouchRequested,
      notifyMaskObjectReviewPreview,
      notifyCanvasZoomChanged,
      notifyMaskObjectsUpdated,
    ],
  );

  const uiContextValue = useMemo(
    () => ({
      uiState,
      uiDispatch,
    }),
    [uiState],
  );

  const maskPreview = useMaskPreview(coreState.apiOrigin, coreState.accessToken);
  const maskContextValue = useMemo(
    () => ({ ...maskPreview, ...maskNotifyContextValue }),
    [maskPreview, maskNotifyContextValue],
  );

  const canvasCursor = useToolCursor({ target: "canvas" });

  const canvasZoom = uiState.canvasZoom;
  useLayoutEffect(() => {
    notifyCanvasZoomChanged(canvasZoom);
  }, [canvasZoom, notifyCanvasZoomChanged]);

  useEffect(() => {
    if (selectedMaskKeys.size === 0 || uiState.browserElement?.type !== "img") return;
    uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
  }, [selectedMaskKeys, uiState.browserElement]);

  useLayoutEffect(() => {
    const initCurrentPaper = async () => {
      if (canvasAreaRef.current && (coreState.project.frame_top < 0 || coreState.project.frame_left < 0)) {
        const centerX = canvasAreaRef.current.clientWidth / 2;
        const centerY = canvasAreaRef.current.clientHeight / 2;
        const left = Math.max(0, centerX - coreState.project.frame_width / 2);
        const top = Math.max(0, centerY - coreState.project.frame_height / 2);
        dispatch({
          type: CoreActionType.SetProject,
          value: { ...coreState.project, frame_left: left, frame_top: top },
        });
      }
    };

    initCurrentPaper();
  }, [coreState.project]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (event.metaKey) return;
      if (event.key === "Escape") {
        setSelectedEffectUnitKeys(new Set<string>());
        setSelectedImgKeys(new Set<string>());
        setSelectedSvgKeys(new Set<string>());
        setSelectedMaskKeys(new Set<string>());
        notifyMaskSelectionChanged(undefined);
        uiDispatch({ type: UIActionType.SetSelectedElement, value: undefined });
        if (uiState.tool.type === "marquee" && uiState.tool.duplicate) {
          uiDispatch({ type: UIActionType.SetTool, value: { ...uiState.tool, duplicate: false } });
          notifyMaskToolChanged(uiState.tool.type);
        }
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key === " " && !isInput) {
        event.preventDefault();
        switch (uiState.playbackMode.type) {
          case "waiting":
            break;
          case "playing":
            handleStopAll();
            break;
          case "stopped":
            handlePlayAll();
            break;
        }
      } else if (event.key.toLowerCase() === "m" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "move" ? { type: "none" } : { type: "move" };
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "r" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "rotate" ? { type: "none" } : { type: "rotate" };
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "k" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "skew" ? { type: "none" } : { type: "skew" };
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "s" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "scale" ? { type: "none" } : { type: "scale" };
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "v" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "viewport" ? { type: "none" } : { type: "viewport" };
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
      } else if (event.key.toLowerCase() === "d" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "marquee" ? { type: "none" } : defaultMarqueeTool;
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "x" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "mix" ? { type: "none" } : { type: "mix" };
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "t" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "mask" ? { type: "none" } : defaultMaskTool;
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "l" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "light_source" ? { type: "none" } : { type: "light_source" };
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "p" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "pen" ? { type: "none" } : defaultPenTool;
        if (!confirmLeavingPen(uiState.maskEdit, newTool)) return;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handlePlayAll,
    handleStopAll,
    uiState.playbackMode.type,
    uiState.tool,
    uiState.maskEdit,
    notifyMaskToolChanged,
    notifyMaskSelectionChanged,
  ]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      setIsMetaKeyPressed(e.metaKey);
      setIsAltKeyPressed(e.altKey);
      if (
        (e.altKey && (uiState.tool.type === "marquee" || uiState.tool.type === "move")) ||
        (e.metaKey && uiState.tool.type === "move")
      ) {
        uiDispatch({ type: UIActionType.SetTool, value: { type: "none" } });
        notifyMaskToolChanged("none");
      }
    };
    const handleBlur = () => {
      setIsMetaKeyPressed(false);
      setIsAltKeyPressed(false);
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      window.removeEventListener("blur", handleBlur);
    };
  }, [uiState.tool.type, uiDispatch, notifyMaskToolChanged]);

  useEffect(() => {
    if (hasInitiatedFrameDownloadRef.current) return;
    hasInitiatedFrameDownloadRef.current = true;
    (async () => {
      if (framesCacheRef.current.size == 0) {
        uiDispatch({
          type: UIActionType.SetPlaybackMode,
          value: { type: "waiting" },
        });
        await getNewAnimations("none", false, true);
        uiDispatch({
          type: UIActionType.SetPlaybackMode,
          value: { type: "stopped" },
        });
      }
    })();
  }, [getNewAnimations]);

  return (
    <>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          gridTemplateColumns: "min-content 1fr min-content min-content",
          gridTemplateRows: `min-content min-content min-content 1fr min-content`,
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <HoverContext value={hoverContextValue}>
          <CoreContext value={coreContextValue}>
            <SocketContext value={socketContextValue}>
              <UIContext value={uiContextValue}>
                <MaskContext value={maskContextValue}>
                  <div style={{ gridRow: "1", gridColumn: "1 / -1" }}>
                    <div
                      style={{
                        width: "100%",
                        height: 1,
                        background: "rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      gridRow: "3 / span 2",
                      gridColumn: "1",
                      overflowY: "auto",
                    }}
                  >
                    {uiState.showTimeline ? (
                      <TimelineArea />
                    ) : (
                      <>
                        <div
                          style={{
                            zIndex: Z_INDEX.FLOATING_CONTROLS,
                            position: "fixed",
                            bottom: minifiedControlsSize.playBottom,
                            left: minifiedControlsSize.playLeft,
                            width: minifiedControlsSize.playContainer,
                            height: minifiedControlsSize.playContainer,
                            borderRadius: "50%",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            background: "rgb(32, 32, 32)",
                            boxShadow: "rgba(0 ,0, 0, 0.4) 2px 2px 4px 0px",
                          }}
                        >
                          <SvgRepo
                            svg={uiState.playbackMode.type === "stopped" ? playArrow() : playArrow("rgb(67,67,67)")}
                            containerStyle={{
                              width: minifiedControlsSize.playSvg,
                              height: minifiedControlsSize.playSvg,
                              cursor: uiState.playbackMode.type === "stopped" ? "pointer" : "progress",
                            }}
                            scale={0.5}
                            scaleToContaier={true}
                            onContainerClick={handlePlayAll}
                          />
                        </div>
                        <div
                          style={{
                            zIndex: Z_INDEX.FLOATING_CONTROLS,
                            position: "fixed",
                            bottom: minifiedControlsSize.recordingBottom,
                            right: uiState.showMediaBrowser
                              ? minifiedControlsSize.recordingRight1
                              : minifiedControlsSize.recordingRight2,
                            width: minifiedControlsSize.recordingWidth,
                            height: minifiedControlsSize.recordingHeight,
                            borderRadius: "50%",
                            border: uiState.recordingLight ? "1px solid rgb(239, 239, 239)" : "none",
                            background: uiState.recordingLight
                              ? "linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))"
                              : "none",
                            boxShadow: uiState.recordingLight ? "rgba(255, 255, 255, 1) 0px 0px 100px 10px" : "none",
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      gridRow: "2",
                      gridColumn: "1 / -1",
                      width: "100%",
                    }}
                  >
                    <Titlebar />
                  </div>
                  <div
                    style={{
                      gridRow: "3",
                      gridColumn: "2",
                      width: "100%",
                      overflowX: "auto",
                    }}
                  >
                    <Subtitlebar />
                  </div>
                  <div
                    ref={canvasAreaRef}
                    style={{
                      gridRow: "4",
                      gridColumn: "2",
                      overflowY: "auto",
                      position: "relative",
                      display: "flex",
                      width: "100%",
                      height: "100%",
                      cursor: canvasCursor,
                      background: "rgba(16, 16, 16, 1)",
                    }}
                  >
                    <div
                      ref={canvasSizeRef}
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        margin: "auto",
                        width: coreState.project.canvas_width * canvasZoom,
                        height: coreState.project.canvas_height * canvasZoom,
                      }}
                    >
                      <div
                        ref={canvasScaleRef}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: coreState.project.canvas_width,
                          height: coreState.project.canvas_height,
                          transform: canvasZoom === 1 ? undefined : `scale(${canvasZoom})`,
                          transformOrigin: "0 0",
                        }}
                      >
                        <div
                          className={
                            styles[
                              `${uiState.resolution.type == "high" ? "noisy-background-20-3" : "noisy-background-20-3-low-res"}`
                            ]
                          }
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: coreState.project.canvas_width,
                            height: coreState.project.canvas_height,
                            zIndex: Z_INDEX.CANVAS_BG,
                          }}
                        />
                        {(uiState.tool.type === "marquee" || uiState.tool.type === "mask") && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "min-content",
                              height: "min-content",
                              zIndex: isMetaKeyPressed ? Z_INDEX.META_KEY_CANVAS : Z_INDEX.INTERACTION_CANVAS,
                              pointerEvents:
                                uiState.maskEdit !== undefined
                                  ? "none"
                                  : uiState.tool.type === "mask" &&
                                      !uiState.tool.lightingMeshSection &&
                                      !uiState.tool.raisingObjects &&
                                      uiState.browserElement?.type !== "img"
                                    ? "none"
                                    : isMetaKeyPressed || (uiState.tool.type === "mask" && isAltKeyPressed)
                                      ? "none"
                                      : "auto",
                            }}
                          >
                            <Canvas />
                          </div>
                        )}
                        <DraggableCamera
                          contextId={"draggable-camera-context-id"}
                          nodeId={"draggable-camera-node-id"}
                          svgElementsRef={svgElementsRef}
                          imgElementsRef={imgElementsRef}
                          maskElementsRef={maskElementsRef}
                          maskHandlesRef={maskHandlesRef}
                          framesCacheRef={framesCacheRef}
                          zIndex={Z_INDEX.CAMERA_FRAME}
                          onNewPosition={async function (newPosition: { x: number; y: number }) {
                            const rollback: LaurusProjectResult = {
                              ...coreState.project,
                            };
                            const newProject: LaurusProjectResult = {
                              ...coreState.project,
                              frame_left: newPosition.x,
                              frame_top: newPosition.y,
                            };
                            if (coreState.project.project_id) {
                              dispatch({
                                type: CoreActionType.SetProject,
                                value: newProject,
                              });
                              const updated = await updateProject(
                                coreState.apiOrigin,
                                coreState.accessToken,
                                newProject.project_id,
                                { ...newProject },
                              );
                              if (!updated) {
                                dispatch({
                                  type: CoreActionType.SetProject,
                                  value: rollback,
                                });
                              }
                            } else {
                              dispatch({
                                type: CoreActionType.SetProject,
                                value: newProject,
                              });
                              const created = await createProject(coreState.apiOrigin, coreState.accessToken, {
                                ...newProject,
                              });
                              if (created) {
                                dispatch({
                                  type: CoreActionType.SetProject,
                                  value: { ...created },
                                });
                              } else {
                                dispatch({
                                  type: CoreActionType.SetProject,
                                  value: { ...rollback },
                                });
                              }
                            }
                          }}
                          disabled={uiState.tool.type != "move"}
                        />
                        <>
                          {Array.from(coreState.project.imgs.entries()).map((e) => {
                            const [key, meta] = e;
                            const showContextMenu = uiState.projectContextMenus.get(key)?.showContextMenu ?? false;
                            if (meta.top < 0 || meta.left < 0 || (uiState.tool.type === "viewport" && !showContextMenu))
                              return;
                            const imgData = coreState.canvasImgs.get(key);
                            if (imgData) {
                              return (
                                <div key={key}>
                                  <DraggableProjectImg
                                    mediaKey={key}
                                    data={imgData}
                                    meta={meta}
                                    zIndex={
                                      uiState.tool.type === "marquee" && uiState.tool.stack
                                        ? Z_INDEX.ITEMS_STACKING_OFFSET + meta.order
                                        : meta.order + Z_INDEX.ITEMS_NORMAL_OFFSET
                                    }
                                    imgElementsRef={imgElementsRef}
                                    framesCacheRef={framesCacheRef}
                                    refKey={key}
                                    forceAbsolutePosition={uiState.tool.type === "viewport" && showContextMenu}
                                  />
                                </div>
                              );
                            }
                          })}
                          {Array.from(coreState.project.svgs.entries()).map((e) => {
                            const [key, meta] = e;
                            const showContextMenu = uiState.projectContextMenus.get(key)?.showContextMenu ?? false;
                            if (meta.top < 0 || meta.left < 0 || (uiState.tool.type === "viewport" && !showContextMenu))
                              return;
                            const svgData = coreState.canvasSvgs.get(key);
                            if (!svgData) return;
                            let decodedString = "";
                            try {
                              decodedString = decodeURIComponent(
                                atob(svgData.markup)
                                  .split("")
                                  .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                                  .join(""),
                              );
                            } catch (error) {
                              console.log("Failed to decode svg markup", {
                                media_key: meta.media_key,
                                error,
                              });
                            }
                            if (decodedString) {
                              return (
                                <div key={key}>
                                  <DraggableProjectSvg
                                    mediaKey={key}
                                    decodedString={decodedString}
                                    meta={meta}
                                    zIndex={
                                      uiState.tool.type === "marquee" && uiState.tool.stack
                                        ? Z_INDEX.ITEMS_STACKING_OFFSET + meta.order
                                        : meta.order + Z_INDEX.ITEMS_NORMAL_OFFSET
                                    }
                                    svgElementsRef={svgElementsRef}
                                    framesCacheRef={framesCacheRef}
                                    refKey={key}
                                    forceAbsolutePosition={uiState.tool.type === "viewport" && showContextMenu}
                                  />
                                </div>
                              );
                            }
                          })}
                          {Array.from(coreState.project.masks.entries()).map((e) => {
                            const [key, meta] = e;
                            const showContextMenu = uiState.projectContextMenus.get(key)?.showContextMenu ?? false;
                            if (meta.top < 0 || meta.left < 0 || (uiState.tool.type === "viewport" && !showContextMenu))
                              return;
                            const maskData = coreState.canvasMasks.get(key);
                            if (!maskData) return;
                            return (
                              <div key={key}>
                                <DraggableProjectMask
                                  mediaKey={key}
                                  meta={meta}
                                  maskData={maskData}
                                  zIndex={
                                    uiState.tool.type === "marquee" && uiState.tool.stack
                                      ? Z_INDEX.ITEMS_STACKING_OFFSET + meta.order
                                      : meta.order + Z_INDEX.ITEMS_NORMAL_OFFSET
                                  }
                                  maskHandlesRef={maskHandlesRef}
                                  maskElementsRef={maskElementsRef}
                                  framesCacheRef={framesCacheRef}
                                  forceAbsolutePosition={uiState.tool.type === "viewport" && showContextMenu}
                                />
                              </div>
                            );
                          })}
                        </>
                      </div>
                    </div>
                  </div>
                  <Floatingbar />
                  {uiState.showMediaBrowser && (
                    <div
                      style={{
                        gridRow: "3 / span 2",
                        gridColumn: "3",
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      <MediaBrowser
                        framesCacheRef={framesCacheRef}
                        refreshIconRef={refreshIconRef}
                        onNextPage={async () => {
                          switch (uiState.mediaBrowserFilter) {
                            case "img": {
                              await handleImgPageRequest();
                              break;
                            }
                            case "svg": {
                              await handleSvgPageRequest();
                              break;
                            }
                          }
                        }}
                      />
                    </div>
                  )}
                  <div
                    style={{
                      gridRow: "3 / span 2",
                      gridColumn: "4",
                    }}
                  >
                    <Toolbar handleMixRestoration={handleMixRestoration} me={me.me} />
                  </div>
                  <div
                    style={{
                      gridRow: "5",
                      gridColumn: "span 4",
                      display: "grid",
                      ...dynamicSizes.statusbar.container,
                    }}
                  >
                    <Statusbar action={statusAction} body={statusBody} framesCacheRef={framesCacheRef} />
                  </div>
                </MaskContext>
              </UIContext>
            </SocketContext>
          </CoreContext>
        </HoverContext>
      </div>
    </>
  );
}

interface Bumper {
  borderLeft: string;
  borderRight: string;
  onBumperClick: () => void;
}
export function Bumper({ borderLeft, borderRight, onBumperClick }: Bumper) {
  const { uiState } = useContext(UIContext);

  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          svg: {
            width: 18,
            height: 38,
          },
        };
      case "midhigh":
        return {
          svg: {
            width: 13,
            height: 33,
          },
        };
      case "midlow":
      case "low":
        return {
          svg: {
            width: 13,
            height: 33,
          },
        };
    }
  });
  return (
    <>
      <div
        style={{
          width: dynamicSizes.svg.width,
          height: "100%",
          gridTemplateRows: "1fr",
          display: "grid",
          placeContent: "start",
        }}
      >
        <div
          style={{
            borderLeft,
            borderRight,
            width: dynamicSizes.svg.width,
            display: "grid",
            placeContent: "center",
            background: "rgba(27, 27, 27, 1)",
          }}
        >
          <SvgRepo
            svg={moreVert("rgba(240, 240, 240, 1)")}
            containerStyle={{
              width: dynamicSizes.svg.width,
              height: dynamicSizes.svg.height,
            }}
            scale={1}
            scaleToContaier={true}
            onContainerClick={onBumperClick}
          />
        </div>
      </div>
    </>
  );
}
