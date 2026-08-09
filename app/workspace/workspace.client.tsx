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
  searchImgs,
  LaurusImgPageSearch,
  LaurusSvgPageSearch,
  searchSvgs,
  nextCaptureId,
} from "./workspace.server";
import Statusbar from "./bars/statusbar";
import Canvas from "./canvas";
import MediaBrowser from "./browsers/media-browser";
import { moreVert, playArrow, SvgRepo, getCrops, LaurusCropSvg } from "../svg-repo";
import { DraggableProjectImg } from "./canvas-media/draggable-project-img";
import { DraggableProjectSvg } from "./canvas-media/draggable-project-svg";
import { DraggableProjectMask } from "./canvas-media/draggable-project-mask";
import { MaskAppearanceOverride, MaskImperativeHandle } from "./canvas-media/project-mask-item";
import { parseMaskCaptureInputId } from "./effects-utils";
import Titlebar, { Subtitlebar as Subtitlebar } from "./bars/titlebar";
import TimelineArea from "./timeline-area";
import DraggableCamera from "./camera";
import { WorkspaceResolution, Z_INDEX } from "./workspace.config";
import { BrowserDependencies } from "./page";
import Toolbar from "./bars/toolbar";
import { useMaskPreview, UseMaskPreview } from "./hooks/useMaskPreview";
import { useMaskCaptureSockets } from "./hooks/useMaskCaptureSockets";
import {
  LIGHT_SOURCE_DARKNESS_DEFAULT,
  LIGHT_SOURCE_FALLOFF_CSS_PX_DEFAULT,
  LIGHT_SOURCE_INTENSITY_DEFAULT,
  LIGHT_SOURCE_SIZE_CSS_PX_DEFAULT,
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
} from "./states/ui-state";
import { CoreAction, CoreActionType, CoreState, coreContextReducer, defaultCoreState } from "./states/core-state";
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
          easing: "step-end",
        }
      : {
          translate: `${f.x}px ${f.y}px 0px`,
          scale: `${f.sx} ${f.sy}`,
          rotate: `${f.rx} ${f.ry} ${f.rz} ${f.rangle}deg`,
        };
  });
  return keyframes;
}

export interface HoverContextProps {
  mostRecentlyEnteredEffectUnitKey: string | undefined;
  setMostRecentlyEnteredEffectUnitKey: (key: string | undefined) => void;
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
  mostRecentlyEnteredEffectUnitKey: undefined,
  setMostRecentlyEnteredEffectUnitKey: () => {},
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
  captureMeshSection: (maskKey: string, polygonIndices: number[]) => Promise<void>;
  sendMaskCaptureUpdate: (
    maskMediaId: string,
    captureId: number,
    name: string,
    polygonIndices: number[],
  ) => Promise<LaurusMaskResult | undefined>;
  closeMaskCaptureSocket: (maskMediaId: string) => void;
  // The following notifyMask* functions are how every file that changes state a mask mesh's own
  // appearance depends on reaches into maskHandlesRef and drives it directly, imperatively --
  // ProjectMaskItem has no useEffect watching any of this reactively (see its own file comment).
  // Each is a thin broadcast/targeted iteration over maskHandlesRef.current, called right after
  // the dispatch that actually changed the underlying value, mirroring how handlePlayAll/
  // handleStopAll above already reach into the same map for play()/stop().
  notifyMaskToolChanged: (toolType: string) => void;
  notifyMaskActiveElementChanged: (key: string | undefined) => void;
  // Which of an already-active mask's own captures reads as the bright one -- kept separate from
  // notifyMaskActiveElementChanged (rather than folding captureId into that call) since that one's
  // shared by every img/svg/mask effect-wiring call site in the app, none of which know or care
  // about captures.
  notifyMaskActiveCaptureChanged: (maskKey: string, captureId: number | undefined) => void;
  notifyMaskPendingCaptureSet: (maskKey: string, indices: Set<number>) => void;
  notifyMaskPendingCaptureCleared: (maskKey: string | undefined) => void;
  notifyMaskCaptureUpdated: (maskKey: string, updated: LaurusMaskResult) => void;
  notifyMaskAppearanceChanged: (maskKey: string, override?: MaskAppearanceOverride) => void;
  notifyMaskLightSourcePreviewToggled: (enabled: boolean) => void;
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
  captureMeshSection: async () => {},
  sendMaskCaptureUpdate: async () => undefined,
  closeMaskCaptureSocket: () => {},
  notifyMaskToolChanged: () => {},
  notifyMaskActiveElementChanged: () => {},
  notifyMaskActiveCaptureChanged: () => {},
  notifyMaskPendingCaptureSet: () => {},
  notifyMaskPendingCaptureCleared: () => {},
  notifyMaskCaptureUpdated: () => {},
  notifyMaskAppearanceChanged: () => {},
  notifyMaskLightSourcePreviewToggled: () => {},
});

export interface UIContextProps {
  uiState: UIState;
  uiDispatch: React.Dispatch<UIAction>;
}

export const UIContext = createContext<UIContextProps>({
  uiState: { ...defaultUIState },
  uiDispatch: () => {},
});

// A single shared mask-preview instance, so the "Mask" trigger button (in
// Maskbar, mounted from Titlebar) and the live WebGL mesh preview (layered into Canvas)
// read/drive the same in-flight websocket + mesh buffers instead of each starting their own.
const defaultMaskPreview: UseMaskPreview = {
  status: "idle",
  triangleCount: 0,
  result: undefined,
  errorMessage: undefined,
  textureMix: TEXTURE_MIX_DEFAULT,
  setTextureMix: () => {},
  textureMixRef: { current: TEXTURE_MIX_DEFAULT },
  lightSourceSize: LIGHT_SOURCE_SIZE_CSS_PX_DEFAULT,
  setLightSourceSize: () => {},
  lightSourceSizeRef: { current: LIGHT_SOURCE_SIZE_CSS_PX_DEFAULT },
  lightSourceIntensity: LIGHT_SOURCE_INTENSITY_DEFAULT,
  setLightSourceIntensity: () => {},
  lightSourceIntensityRef: { current: LIGHT_SOURCE_INTENSITY_DEFAULT },
  lightSourceFalloff: LIGHT_SOURCE_FALLOFF_CSS_PX_DEFAULT,
  setLightSourceFalloff: () => {},
  lightSourceFalloffRef: { current: LIGHT_SOURCE_FALLOFF_CSS_PX_DEFAULT },
  lightSourceDarkness: LIGHT_SOURCE_DARKNESS_DEFAULT,
  setLightSourceDarkness: () => {},
  lightSourceDarknessRef: { current: LIGHT_SOURCE_DARKNESS_DEFAULT },
  position: { value: false, x: undefined, y: undefined },
  setPosition: () => {},
  size: { value: false, width: undefined, height: undefined },
  setSize: () => {},
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
  },
};

export const MaskContext = createContext<UseMaskPreview>(defaultMaskPreview);

function MaskPreviewProvider({ children }: { children: React.ReactNode }) {
  const maskPreview = useMaskPreview();
  return <MaskContext value={maskPreview}>{children}</MaskContext>;
}

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
    // The whole mask earns its own carousel entry unconditionally, exactly like an img/svg --
    // wireable to move/scale/rotate via maskElementsRef regardless of whether it has any
    // captures at all.
    temp.push({
      entry: {
        type: "mask",
        key: projectMask[0],
      },
      distance,
    });
    // Beyond that, a mask earns one more carousel entry per capture it actually has --
    // otherwise a mask with several captures would only expose one of them to wire up.
    const captures = canvasMasks.get(projectMask[0])?.captures ?? [];
    captures.forEach((capture) => {
      temp.push({
        entry: {
          type: "capture",
          key: projectMask[0],
          captureId: capture.id,
        },
        distance,
      });
    });
  });
  const entries = temp.sort((a, b) => a.distance - b.distance).map((item) => item.entry);
  return entries;
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
          // A project mask can outlive the mask media it points at (e.g. deleted, or -- since the
          // mask feature was renamed from "vector" to "mask" -- saved under the old Redis key
          // namespace and no longer resolvable). Skipping unresolved entries here, rather than
          // spreading `undefined` into a hollow placeholder object, is what keeps
          // ProjectMaskItem/buildStaticMaskMesh from crashing on a `curves` that was never there.
          .filter((e): e is [string, LaurusMaskResult] => e[1] !== undefined),
      )
    : new Map();

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
  const [mostRecentlyEnteredEffectUnitKey, setMostRecentlyEnteredEffectUnitKey] = useState<string | undefined>(
    undefined,
  );
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
  const { sendCaptureUpdate: sendMaskCaptureUpdate, closeSocket: closeMaskCaptureSocket } = useMaskCaptureSockets(
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
  // A mask's own WebGL <canvas> element, keyed by the mask's own project key -- populated by the
  // same ProjectMaskItem mount ref-callback that populates maskHandlesRef below, letting a
  // whole-mask CarouselEntry ("mask", not "capture") drive it through the exact same WAAPI
  // KeyframeEffect/Animation pipeline img/svg use (see getNewAnimations/getNewAnimationsByTarget),
  // just targeting a canvas instead of an <img>/<svg>. A capture's own math never resolves an
  // element here -- maskCaptureInputId's "key:captureId" strings never match a bare mask key.
  const maskElementsRef = useRef<Map<string, HTMLCanvasElement>>(null);
  // Beyond that whole-element WAAPI target, masks separately have no DOM element for a
  // *capture's* own move/light_source/scale to animate (a capture lives inside the WebGL mesh,
  // not as its own element), so unlike img/svg's element refs, this holds MaskImperativeHandle
  // instances instead -- registered by ProjectMaskItem's own mount ref-callback, keyed by the
  // mask's own project key, one Set per key since more than one mounted instance can share a
  // mediaKey. Also doubles as the one place every notifyMask* broadcast/targeted call below
  // reaches into to imperatively drive a mask's WebGL state -- ProjectMaskItem has no useEffect
  // of its own reacting to tool/active element/topology/etc. changes; the file dispatching each
  // of those calls the matching notifyMask* function right after, instead.
  const maskHandlesRef = useRef<Map<string, Set<MaskImperativeHandle>>>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
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
        // A mask capture's own frames (see project-mask-item.tsx's preparePlayback, "playAll"
        // branch) run through this exact same fetch-and-cache loop below, keyed the same way --
        // just filtered to move/light_source/scale/rotate (the effect types a mask can wire up,
        // capture-scoped or whole-element) and matched against masks instead of imgs/svgs, since
        // a capture's math key is maskCaptureInputId's "mediaKey:captureId" (or a bare mediaKey,
        // for a mask input_id predating per-capture math -- parseMaskCaptureInputId's maskKey
        // handles both). A *whole* mask's own bare key (captureId undefined, see the element
        // lookup below) does drive a real WAAPI Animation now, so -- unlike a capture, which never
        // does -- it needs to feed globalLimit too, same as img/svg.
        let globalLimit = 0;
        enabledEffects.forEach((e) => {
          e.value.math.forEach((_, inputKey) => {
            if (coreState.project.imgs.has(inputKey) || coreState.project.svgs.has(inputKey)) {
              eligibleItems.add(inputKey);
              globalLimit = Math.max(globalLimit, e.value.end);
            } else if (
              (e.type === "move" || e.type === "light_source" || e.type === "scale" || e.type === "rotate") &&
              coreState.project.masks.has(parseMaskCaptureInputId(inputKey).maskKey)
            ) {
              eligibleItems.add(inputKey);
              if (parseMaskCaptureInputId(inputKey).captureId === undefined) {
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
          // A capture's own inputKey (maskCaptureInputId's "key:captureId") never matches any of
          // these three refs -- a capture lives inside the WebGL mesh, not as its own element --
          // so it's fetched and cached above like any other input, but never turned into a WAAPI
          // Animation. A *whole* mask's own bare key does match maskElementsRef, the same way an
          // img/svg's bare key matches its own ref.
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

  // See CoreContextProps' own comment -- these all reach directly into maskHandlesRef instead of
  // being watched for reactively by ProjectMaskItem, so every dispatch site that changes one of
  // these values also calls the matching one of these right after. Stable (empty deps, closing
  // only over the ref) -- never need to be listed as a dependency anywhere else in this file.
  const notifyMaskToolChanged = useCallback((toolType: string) => {
    maskHandlesRef.current?.forEach((handles) => handles.forEach((h) => h.abortCaptureDragForToolChange(toolType)));
  }, []);
  const notifyMaskActiveElementChanged = useCallback((key: string | undefined) => {
    maskHandlesRef.current?.forEach((handles, maskKey) =>
      handles.forEach((h) => h.setActiveHighlighted(maskKey === key)),
    );
  }, []);
  const notifyMaskActiveCaptureChanged = useCallback((maskKey: string, captureId: number | undefined) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.setActiveCapture(captureId));
  }, []);
  const notifyMaskPendingCaptureSet = useCallback((maskKey: string, indices: Set<number>) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.setPendingCapture(indices));
  }, []);
  const notifyMaskPendingCaptureCleared = useCallback((maskKey: string | undefined) => {
    if (maskKey === undefined) return;
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.clearPendingCapture());
  }, []);
  const notifyMaskCaptureUpdated = useCallback((maskKey: string, updated: LaurusMaskResult) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.syncCapturedIndices(updated));
  }, []);
  const notifyMaskAppearanceChanged = useCallback((maskKey: string, override?: MaskAppearanceOverride) => {
    maskHandlesRef.current?.get(maskKey)?.forEach((h) => h.applyMaskAppearanceDefaults(override));
  }, []);
  const notifyMaskLightSourcePreviewToggled = useCallback((enabled: boolean) => {
    maskHandlesRef.current?.forEach((handles) => handles.forEach((h) => h.onLightSourcePreviewToggled(enabled)));
  }, []);

  // Persists a freshly drawn mesh-section capture immediately -- drawing a circle (canvas.tsx's
  // handleLightSourceCapture) is taken as confirmation to save it, no separate confirm step.
  // Always creates a *new* capture (the next free id on this mask, auto-named) rather than
  // replacing an existing one -- moving/resizing an already-drawn capture is a meta-drag directly
  // on its own highlighted triangles instead (project-mask-item.tsx's onPointerDown/onPointerUp).
  // Any triangles the new circle overlaps get reassigned from whichever capture owned them before,
  // which is harmless: capture_id only ever feeds a UI anchor/highlight, never rendering (see
  // RedisCapture server-side). Shown optimistically via the pending-capture notifies below while
  // the request is in flight (mirrors project-mask-item.tsx's own relocate-drag commit in
  // onPointerUp), then reconciled with the server response.
  const captureMeshSection = useCallback(
    async (maskKey: string, polygonIndices: number[]) => {
      const maskData = coreState.canvasMasks.get(maskKey);
      if (!maskData) return;
      const captureId = nextCaptureId(maskData.captures);
      const name = `light ${captureId}`;

      dispatch({
        type: CoreActionType.SetPendingLightSourceCapture,
        value: { maskKey, captureId, polygonIndices },
      });
      notifyMaskPendingCaptureSet(maskKey, new Set(polygonIndices));

      const updated = await sendMaskCaptureUpdate(maskData.mask_media_id, captureId, name, polygonIndices);
      if (updated) {
        dispatch({ type: CoreActionType.SetCanvasMask, key: maskKey, value: updated });
        // Before the notifies below, which recolor off this mask's own captured-indices ref -- see
        // MaskImperativeHandle.syncCapturedIndices' own comment for why that ref, not `source`.
        notifyMaskCaptureUpdated(maskKey, updated);
        // Every freshly drawn capture earns its own carousel entry -- see CarouselEntry's own
        // doc comment on why this is per-capture, not per-mask.
        uiDispatch({ type: UIActionType.AddCarouselEntry, value: { type: "capture", key: maskKey, captureId } });
        uiDispatch({
          type: UIActionType.SetActiveElement,
          value: { key: maskKey, type: "mask", activeCaptureId: captureId },
        });
        notifyMaskActiveElementChanged(maskKey);
        notifyMaskActiveCaptureChanged(maskKey, captureId);
      }
      dispatch({ type: CoreActionType.SetPendingLightSourceCapture, value: undefined });
      notifyMaskPendingCaptureCleared(maskKey);
      uiDispatch({ type: UIActionType.SetTool, value: { type: "mask", capturingMeshSection: false } });
      notifyMaskToolChanged("mask");
    },
    [
      coreState.canvasMasks,
      sendMaskCaptureUpdate,
      dispatch,
      uiDispatch,
      notifyMaskPendingCaptureSet,
      notifyMaskActiveElementChanged,
      notifyMaskActiveCaptureChanged,
      notifyMaskPendingCaptureCleared,
      notifyMaskCaptureUpdated,
      notifyMaskToolChanged,
    ],
  );

  const handleRewindAll = useCallback(
    async (playbackRate: number) => {
      if (uiState.playbackMode.type !== "stopped" || !uiState.filledForwards) return;
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
    [closeContextMenus, getNewAnimations, handleMixRestoration, uiState.filledForwards, uiState.playbackMode.type],
  );

  const handlePlayAll = useCallback(async () => {
    if (uiState.playbackMode.type !== "stopped") return;
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
      notifyMaskActiveElementChanged(undefined);
    }

    const players: MaskImperativeHandle[] = [];
    maskHandlesRef.current?.forEach((handles) => handles.forEach((player) => players.push(player)));

    // Every registered mask handle -- each decides for itself whether it actually has a wired
    // move/light_source effect to play, resolving to undefined if not (see MaskImperativeHandle).
    // Fetched alongside newAnimations, both awaited before anything actually starts: a mask's own
    // getFrames round-trip has independent network/server-solve latency from every other mask's
    // (and from the img/svg frames below), so kicking off each one's playback clock the instant
    // its own fetch resolved -- preparePlayback's single-target play() wrapper does exactly that
    // -- would visibly stagger their start times against each other. Waiting here for every
    // target's frames to be in hand first, then starting them all in the same synchronous pass
    // below, keeps them approximately in sync instead. Also triggered (and awaited) before the
    // newAnimations bail-out below: a light-source-svg has no DOM element of its own (see
    // workspace.client.tsx's render-skip), so getNewAnimations never produces a WAAPI Animation
    // for it -- newAnimations can be legitimately empty while there's still a light source to play.
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

    // Calling every start() before yielding back to the event loop is what actually keeps the
    // masks' clocks in sync with each other and with the WAAPI animations played right after --
    // each one's own loopStartMs is captured synchronously inside this same tick.
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
    uiState.playbackMode.type,
    uiState.tool.type,
    uiState.activeElement,
    notifyMaskToolChanged,
    notifyMaskActiveElementChanged,
  ]);

  const handlePlayTarget = useCallback(
    async (target: AnimationTarget) => {
      if (uiState.playbackMode.type !== "stopped") return;
      handleMixRestoration();
      closeContextMenus();
      if (uiState.activeElement !== undefined) {
        uiDispatch({ type: UIActionType.SetActiveElement, value: undefined });
        notifyMaskActiveElementChanged(undefined);
      }
      uiDispatch({
        type: UIActionType.SetPlaybackMode,
        value: { type: "waiting" },
      });
      uiDispatch({ type: UIActionType.SetRecordingLight, value: true });

      const newAnimations = await getNewAnimationsByTarget("none", false, target);

      // Only the masks wired to this specific light source key, and only for a "move", "light_source",
      // or "scale" effect -- the only kinds ProjectMaskItem's wiring reacts to. A Rotate preview on
      // the same element shares this same target.inputKey but has nothing for a mask to play.
      // Computed (and triggered) before the newAnimations bail-out below: a light-source-svg has no DOM
      // element of its own (see workspace.client.tsx's render-skip), so getNewAnimationsByTarget
      // never produces a WAAPI Animation for it -- newAnimations can be legitimately empty while
      // there's still a light source to play. Also requires target.inputKey to actually be
      // capture-scoped (captureId !== undefined): a *whole* mask's own move/scale preview shares
      // this same effect.key/effect.type shape (it's the exact same "move"/"scale" effect a
      // capture might also be wired into) but its bare-key inputKey has no capture of its own to
      // play -- without this check, resolveTargetCaptureId's fallback-to-first-capture would make
      // it spuriously re-play whichever capture happens to be selected/first, using an equation
      // that's meant for a completely different (whole-element) purpose.
      const targetDrivesLightSource = coreState.effects.some(
        (effect) =>
          effect.key === target.effectKey &&
          (effect.type === "move" || effect.type === "light_source" || effect.type === "scale") &&
          parseMaskCaptureInputId(target.inputKey).captureId !== undefined,
      );
      const lightSourceFinished: Promise<void>[] = [];
      if (targetDrivesLightSource) {
        // maskHandlesRef is keyed by a mask's own element key, not the capture-scoped input_id a
        // unit's preview button builds (see maskCaptureInputId) -- recover both so playback lands
        // on the right mesh *and* the exact capture the button was for, rather than letting
        // playLightSourceAnimation's own resolveTargetCaptureId guess.
        const { maskKey, captureId } = parseMaskCaptureInputId(target.inputKey);
        maskHandlesRef.current
          ?.get(maskKey)
          ?.forEach((player) => lightSourceFinished.push(player.play(target.effectKey, captureId)));
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
      uiState.playbackMode.type,
      uiState.activeElement,
      notifyMaskActiveElementChanged,
    ],
  );

  const handleFastForwardAll = useCallback(
    async (playbackRate: number) => {
      if (uiState.playbackMode.type !== "stopped") return;
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
    [closeContextMenus, getNewAnimations, handleMixRestoration, uiState.playbackMode.type],
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
      mostRecentlyEnteredEffectUnitKey,
      setMostRecentlyEnteredEffectUnitKey,
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
      mostRecentlyEnteredEffectUnitKey,
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
      captureMeshSection,
      sendMaskCaptureUpdate,
      closeMaskCaptureSocket,
      notifyMaskToolChanged,
      notifyMaskActiveElementChanged,
      notifyMaskActiveCaptureChanged,
      notifyMaskPendingCaptureSet,
      notifyMaskPendingCaptureCleared,
      notifyMaskCaptureUpdated,
      notifyMaskAppearanceChanged,
      notifyMaskLightSourcePreviewToggled,
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
      captureMeshSection,
      sendMaskCaptureUpdate,
      closeMaskCaptureSocket,
      notifyMaskToolChanged,
      notifyMaskActiveElementChanged,
      notifyMaskActiveCaptureChanged,
      notifyMaskPendingCaptureSet,
      notifyMaskPendingCaptureCleared,
      notifyMaskCaptureUpdated,
      notifyMaskAppearanceChanged,
      notifyMaskLightSourcePreviewToggled,
    ],
  );

  const uiContextValue = useMemo(
    () => ({
      uiState,
      uiDispatch,
    }),
    [uiState],
  );

  const canvasCursor = useMemo(() => {
    return isAltKeyPressed && uiState.tool.type !== "marquee"
      ? "crosshair"
      : isMetaKeyPressed && uiState.tool.type !== "viewport"
        ? "context-menu"
        : uiState.tool.type === "scale" || uiState.tool.type === "rotate"
          ? "crosshair"
          : "";
  }, [isAltKeyPressed, isMetaKeyPressed, uiState.tool.type]);

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
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "r" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "rotate" ? { type: "none" } : { type: "rotate" };
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "s" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "scale" ? { type: "none" } : { type: "scale" };
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "v" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "viewport" ? { type: "none" } : { type: "viewport" };
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
      } else if (event.key.toLowerCase() === "d" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "marquee" ? { type: "none" } : defaultMarqueeTool;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "x" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "mix" ? { type: "none" } : { type: "mix" };
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "t" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "mask" ? { type: "none" } : defaultMaskTool;
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      } else if (event.key.toLowerCase() === "l" && !isInput && uiState.playbackMode.type === "stopped") {
        const newTool: LaurusTool = uiState.tool.type === "light_source" ? { type: "none" } : { type: "light_source" };
        uiDispatch({ type: UIActionType.SetTool, value: newTool });
        notifyMaskToolChanged(newTool.type);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePlayAll, handleStopAll, uiState.playbackMode.type, uiState.tool, notifyMaskToolChanged]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      setIsMetaKeyPressed(e.metaKey);
      setIsAltKeyPressed(e.altKey);
      if (e.altKey && (uiState.tool.type === "marquee" || uiState.tool.type === "move")) {
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
            <UIContext value={uiContextValue}>
              <MaskPreviewProvider>
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
                  }}
                >
                  <Subtitlebar />
                </div>
                {/* canvas area */}
                <div
                  ref={canvasAreaRef}
                  style={{
                    gridRow: "4",
                    gridColumn: "2",
                    overflowY: "auto",
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    cursor: canvasCursor,
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
                          uiState.tool.type === "mask" &&
                          !uiState.tool.capturingMeshSection &&
                          uiState.browserElement?.type !== "img"
                            ? "none"
                            : // Alt-click-select (ProjectMaskItem's onClick) needs to reach an
                              // existing mask underneath -- but only for the mask tool: marquee
                              // uses the alt key for its own drag-duplicate gesture and needs this
                              // overlay to keep capturing the drag regardless.
                              isMetaKeyPressed || (uiState.tool.type === "mask" && isAltKeyPressed)
                              ? "none"
                              : "auto",
                      }}
                    >
                      <Canvas />
                    </div>
                  )}
                  {/* camera frame */}
                  <DraggableCamera
                    contextId={"draggable-camera-context-id"}
                    nodeId={"draggable-camera-node-id"}
                    svgElementsRef={svgElementsRef}
                    imgElementsRef={imgElementsRef}
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
                      // A light source wired to a mask (see canvas.tsx's handleSvgDrop) is a wiring key
                      // only, not an independently visible element -- see project-mask-item.tsx,
                      // which reads it directly off coreState.project.svgs to drive the target
                      // mask's WebGL light source highlight instead.
                      if (meta.target_mask_key !== undefined) return;
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
                {/* right panel */}
                <div
                  style={{
                    gridRow: "3 / span 2",
                    gridColumn: "4",
                  }}
                >
                  <Toolbar handleMixRestoration={handleMixRestoration} me={me.me} />
                </div>
                {/* mediabar */}
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
              </MaskPreviewProvider>
            </UIContext>
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
