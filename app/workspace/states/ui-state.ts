import { LaurusCropSvg } from "../../svg-repo";
import { WorkspaceResolution } from "../workspace.config";
import {
  LaurusImgResult,
  LaurusEffect,
  LaurusSvgResult,
  LaurusObject,
  LaurusObjectReviewCandidate,
} from "../workspace.server";
import { ContextMenuConfig, DEFAULT_CONTEXT_MENU_CONFIG } from "../../projects/projects.server";
import { RESOLUTION } from "@/app/landing.config";
import { MAX_MASK_OBJECTS, OBJECT_ELEVATION_DEFAULT } from "../mask-gl";
import { CANVAS_ZOOM_DEFAULT, CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from "../workspace.config";
import { LaurusObjectBlackPoint, OBJECT_BLACK_POINT_DEFAULT, OBJECT_FALLOFF_DEFAULT } from "../workspace.server";
import { buildObjectShapeFromMarkup, decodeSvgMarkup } from "../canvas-media/object-shape";

export interface ProjectMediaContextMenu {
  showContextMenu: boolean;
  contextMenuConfig: ContextMenuConfig;
}
export type LaurusThumbnail = { type: "svg"; value: LaurusSvgResult } | { type: "img"; value: LaurusImgResult };

export type TopologyMode = false | "circle" | "shape";

export type LaurusTool =
  | {
      type: "marquee";
      stack: boolean;
      size: {
        value: boolean;
        width: number | undefined;
        height: number | undefined;
      };
      position: {
        value: boolean;
        x: number | undefined;
        y: number | undefined;
      };
      select: boolean;
      duplicate: boolean;
    }
  | { type: "none" }
  | { type: "contextmenu" }
  | { type: "viewport" }
  | { type: "move" }
  | { type: "scale" }
  | { type: "rotate" }
  | { type: "mix" }
  | { type: "mask"; capturingMeshSection: boolean; editingTopology: TopologyMode }
  | { type: "light_source" };

export const defaultMarqueeTool: LaurusTool = {
  type: "marquee",
  stack: false,
  size: { value: false, width: undefined, height: undefined },
  position: { value: false, x: undefined, y: undefined },
  select: false,
  duplicate: false,
};

export const defaultMaskTool: LaurusTool = {
  type: "mask",
  capturingMeshSection: false,
  editingTopology: false,
};

export type MediaBrowserFilter = "img" | "svg" | "frame" | "group";

export type LaurusBrowserElement = LaurusThumbnail;

export type LaurusActiveElement =
  | { key: string; type: "svg"; locallyActivatedEffectKey?: string }
  | { key: string; type: "img"; locallyActivatedEffectKey?: string }
  | { key: string; type: "mask"; locallyActivatedEffectKey?: string }
  | { key: string; type: "capture"; captureId: number; locallyActivatedEffectKey?: string }
  | { key: string; type: "object"; objectId: number; locallyActivatedEffectKey?: string };

export type LaurusSelectedElement =
  | { key: string; type: "mask" }
  | { key: string; type: "capture"; captureId: number }
  | { key: string; type: "object"; objectId: number };

export type CarouselEntry =
  | { type: "svg"; key: string }
  | { type: "img"; key: string }
  | { type: "mask"; key: string }
  | { type: "capture"; key: string; captureId: number }
  | { type: "object"; key: string; objectId: number };

export type PlaybackMode = { type: "playing" } | { type: "stopped" } | { type: "waiting" };

export type ObjectReviewMode = "review" | "edit";

export interface ObjectReviewSession {
  mode: ObjectReviewMode;
  maskMediaId: string;
  maskKey: string;
  candidates: LaurusObjectReviewCandidate[];
  decisions: Map<number, "accepted" | "rejected">;
  currentIndex: number;
  currentIndices: Set<number>;
  redoRequested: boolean;
}

export function isObjectReviewLocked(review: ObjectReviewSession): boolean {
  if (review.mode !== "review" || review.redoRequested) return false;
  const candidate = review.candidates[review.currentIndex];
  return candidate !== undefined && review.decisions.has(candidate.object.id);
}

export interface UIState {
  lightFrameBackground: boolean;
  browserImgs: LaurusImgResult[];
  browserSvgs: LaurusSvgResult[];
  browserFrames: LaurusCropSvg[];
  carouselEntries: CarouselEntry[];
  tool: LaurusTool;
  browserElement: LaurusBrowserElement | undefined;
  activeElement: LaurusActiveElement | undefined;
  selectedElement: LaurusSelectedElement | undefined;
  effectNames: string[];
  effectClipboard: LaurusEffect | undefined;
  recordingLight: boolean;
  timelineUnits: string[];
  timelineValues: number[];
  resolution: WorkspaceResolution;
  mixableEffects: string[];
  playbackMode: PlaybackMode;
  filledForwards: boolean;
  projectContextMenus: Map<string, ProjectMediaContextMenu>;
  animationDownloadProgress: number | undefined;
  showMediaBrowser: boolean;
  showTimeline: boolean;
  mediaBrowserFilter: MediaBrowserFilter;
  lightSourcePreview: boolean;
  canvasZoom: number;
  stagedObject: { elevation: number; falloff: number; shape: string; blackPoint: LaurusObjectBlackPoint };
  objectReview: ObjectReviewSession | undefined;
}

export const defaultUIState: UIState = {
  lightFrameBackground: false,
  tool: { type: "none" },
  browserImgs: [],
  browserSvgs: [],
  browserFrames: [],
  carouselEntries: [],
  effectNames: [],
  effectClipboard: undefined,
  browserElement: undefined,
  activeElement: undefined,
  selectedElement: undefined,
  recordingLight: false,
  timelineUnits: [],
  timelineValues: [],
  resolution: {
    type: "midhigh",
    factor: RESOLUTION.MIDHIGH_FACTOR,
    value: { width: 0, height: 0 },
  },
  mixableEffects: [],
  playbackMode: { type: "stopped" },
  filledForwards: false,
  projectContextMenus: new Map(),
  animationDownloadProgress: undefined,
  showMediaBrowser: true,
  showTimeline: true,
  mediaBrowserFilter: "img",
  lightSourcePreview: false,
  canvasZoom: CANVAS_ZOOM_DEFAULT,
  stagedObject: {
    elevation: OBJECT_ELEVATION_DEFAULT,
    falloff: OBJECT_FALLOFF_DEFAULT,
    shape: "",
    blackPoint: OBJECT_BLACK_POINT_DEFAULT,
  },
  objectReview: undefined,
};

export enum UIActionType {
  SetUIState,
  AddBrowserImg,
  UpdateBrowserImgs,
  SetBrowserImgs,
  DeleteBrowserImg,
  AddBrowserSvg,
  UpdateBrowserSvgs,
  SetBrowserSvgs,
  DeleteBrowserSvg,
  SetTool,
  SetBrowserElement,
  SetActiveElement,
  SetSelectedElement,
  SetLightFrameBackground,
  SetEffectClipboard,
  SetRecordingLight,
  AddCarouselEntry,
  DeleteCarouselEntry,
  SetPlaybackMode,
  SetResolution,
  SetEffectNames,
  SetTimelineUnits,
  SetTimelineValues,
  SetMixableEffects,
  SetFilledForwards,
  SetProjectContextMenu,
  CloseAllContextMenus,
  SetAnimationDownloadProgress,
  SetShowMediaBrowser,
  SetShowTimeline,
  SetMediaBrowserFilter,
  SetLightSourcePreview,
  SetCanvasZoom,
  SetStagedObject,
  StartObjectReview,
  StartObjectEdit,
  ToggleObjectReviewPolygon,
  SetObjectReviewIndex,
  RequestObjectReviewRedo,
  RecordObjectReviewDecision,
  EndObjectReview,
  ResumeObjectReview,
}

export type UIAction =
  | { type: UIActionType.SetUIState; value: UIState }
  | { type: UIActionType.AddBrowserImg; value: LaurusImgResult; first: boolean }
  | { type: UIActionType.UpdateBrowserImgs; value: LaurusImgResult[] }
  | { type: UIActionType.SetBrowserImgs; value: LaurusImgResult[] }
  | { type: UIActionType.DeleteBrowserImg; value: string }
  | { type: UIActionType.AddBrowserSvg; value: LaurusSvgResult; first: boolean }
  | { type: UIActionType.UpdateBrowserSvgs; value: LaurusSvgResult[] }
  | { type: UIActionType.SetBrowserSvgs; value: LaurusSvgResult[] }
  | { type: UIActionType.DeleteBrowserSvg; value: string }
  | { type: UIActionType.SetTool; value: LaurusTool }
  | {
      type: UIActionType.SetBrowserElement;
      value: LaurusBrowserElement | undefined;
    }
  | {
      type: UIActionType.SetActiveElement;
      value: LaurusActiveElement | undefined;
    }
  | {
      type: UIActionType.SetSelectedElement;
      value: LaurusSelectedElement | undefined;
    }
  | { type: UIActionType.SetLightFrameBackground; value: boolean }
  | { type: UIActionType.SetEffectClipboard; value: LaurusEffect }
  | { type: UIActionType.SetRecordingLight; value: boolean }
  | { type: UIActionType.AddCarouselEntry; value: CarouselEntry }
  | { type: UIActionType.DeleteCarouselEntry; key: string; captureId?: number; objectId?: number }
  | { type: UIActionType.SetPlaybackMode; value: PlaybackMode }
  | { type: UIActionType.SetResolution; value: WorkspaceResolution }
  | { type: UIActionType.SetEffectNames; value: string[] }
  | { type: UIActionType.SetTimelineUnits; value: string[] }
  | { type: UIActionType.SetTimelineValues; value: number[] }
  | { type: UIActionType.SetMixableEffects; value: string[] }
  | { type: UIActionType.SetFilledForwards; value: boolean }
  | {
      type: UIActionType.SetProjectContextMenu;
      key: string;
      showContextMenu: boolean;
      contextMenuConfig?: ContextMenuConfig;
    }
  | { type: UIActionType.CloseAllContextMenus }
  | {
      type: UIActionType.SetAnimationDownloadProgress;
      value: number | undefined;
    }
  | { type: UIActionType.SetShowMediaBrowser; value: boolean }
  | { type: UIActionType.SetShowTimeline; value: boolean }
  | { type: UIActionType.SetMediaBrowserFilter; value: MediaBrowserFilter }
  | { type: UIActionType.SetLightSourcePreview; value: boolean }
  | { type: UIActionType.SetCanvasZoom; value: number }
  | { type: UIActionType.SetStagedObject; value: Partial<UIState["stagedObject"]> }
  | {
      type: UIActionType.StartObjectReview;
      maskMediaId: string;
      maskKey: string;
      candidates: LaurusObjectReviewCandidate[];
    }
  | {
      type: UIActionType.StartObjectEdit;
      maskMediaId: string;
      maskKey: string;
      object: LaurusObject;
      polygonIndices: number[];
    }
  | { type: UIActionType.ToggleObjectReviewPolygon; index: number }
  | { type: UIActionType.SetObjectReviewIndex; index: number; currentIndices?: Set<number> }
  | { type: UIActionType.RequestObjectReviewRedo }
  | {
      type: UIActionType.RecordObjectReviewDecision;
      decision: "accepted" | "rejected";
      nextCurrentIndices?: Set<number>;
    }
  | { type: UIActionType.EndObjectReview }
  | {
      type: UIActionType.ResumeObjectReview;
      maskMediaId: string;
      maskKey: string;
      candidates: LaurusObjectReviewCandidate[];
      decisions: Map<number, "accepted" | "rejected">;
    };

function stagedShapePathFor(element: LaurusBrowserElement | undefined): string {
  if (element?.type !== "svg") return "";
  const decoded = decodeSvgMarkup(element.value.markup);
  if (!decoded) return "";
  const built = buildObjectShapeFromMarkup(decoded);
  return built.ok ? built.shape.path : "";
}

export type ObjectReviewAdvance = { done: true } | { done: false; currentIndex: number };

export function acceptedObjectCount(decisions: Map<number, "accepted" | "rejected">): number {
  let accepted = 0;
  for (const decision of decisions.values()) if (decision === "accepted") accepted++;
  return accepted;
}

export function isObjectReviewFull(decisions: Map<number, "accepted" | "rejected">): boolean {
  return acceptedObjectCount(decisions) >= MAX_MASK_OBJECTS;
}

export function advanceObjectReview(
  review: ObjectReviewSession,
  decisions: Map<number, "accepted" | "rejected">,
): ObjectReviewAdvance {
  if (isObjectReviewFull(decisions)) return { done: true };
  const nextIndex = review.currentIndex + 1;
  if (nextIndex >= review.candidates.length) return { done: true };
  return { done: false, currentIndex: nextIndex };
}

export function resumeObjectReview(
  maskMediaId: string,
  maskKey: string,
  candidates: LaurusObjectReviewCandidate[],
  decisions: Map<number, "accepted" | "rejected">,
): ObjectReviewSession | undefined {
  if (candidates.length === 0) return undefined;
  const undecidedIndex = candidates.findIndex((c) => !decisions.has(c.object.id));
  const currentIndex = undecidedIndex >= 0 && !isObjectReviewFull(decisions) ? undecidedIndex : 0;
  return {
    mode: "review",
    maskMediaId,
    maskKey,
    candidates,
    decisions: new Map(decisions),
    currentIndex,
    currentIndices: new Set(candidates[currentIndex].polygon_indices),
    redoRequested: false,
  };
}

export function uiContextReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case UIActionType.SetUIState: {
      return { ...action.value };
    }
    case UIActionType.AddBrowserImg: {
      const currentBrowserImgs = [...state.browserImgs];
      const i = currentBrowserImgs.findIndex((i) => i.img_media_id == action.value.img_media_id);
      if (i < 0) {
        return action.first
          ? { ...state, browserImgs: [action.value, ...currentBrowserImgs] }
          : { ...state, browserImgs: [...currentBrowserImgs, action.value] };
      } else {
        const newBrowserImgs = [...currentBrowserImgs];
        newBrowserImgs.splice(i, 1);
        return action.first
          ? { ...state, browserImgs: [action.value, ...newBrowserImgs] }
          : { ...state, browserImgs: [...newBrowserImgs, action.value] };
      }
    }
    case UIActionType.UpdateBrowserImgs: {
      const newBrowserImgs = [...state.browserImgs];
      for (let i = 0; i < action.value.length; i++) {
        const newBrowserImg = action.value[i];
        const index = newBrowserImgs.findIndex((img) => img.img_media_id == newBrowserImg.img_media_id);
        if (index > -1) {
          newBrowserImgs[index] = { ...newBrowserImg };
        }
      }
      return { ...state, browserImgs: newBrowserImgs };
    }
    case UIActionType.SetBrowserImgs: {
      return { ...state, browserImgs: [...action.value] };
    }
    case UIActionType.DeleteBrowserImg: {
      const newBrowserImgs = state.browserImgs.filter((b) => b.img_media_id != action.value);
      return { ...state, browserImgs: newBrowserImgs };
    }
    case UIActionType.AddBrowserSvg: {
      const currentBrowserSvgs = [...state.browserSvgs];
      const i = currentBrowserSvgs.findIndex((i) => i.svg_media_id == action.value.svg_media_id);
      if (i < 0) {
        return action.first
          ? { ...state, browserSvgs: [action.value, ...currentBrowserSvgs] }
          : { ...state, browserSvgs: [...currentBrowserSvgs, action.value] };
      } else {
        const newBrowserSvgs = [...currentBrowserSvgs];
        newBrowserSvgs.splice(i, 1);
        return action.first
          ? { ...state, browserSvgs: [action.value, ...newBrowserSvgs] }
          : { ...state, browserSvgs: [...newBrowserSvgs, action.value] };
      }
    }
    case UIActionType.UpdateBrowserSvgs: {
      const newBrowserSvgs = [...state.browserSvgs];
      for (let i = 0; i < action.value.length; i++) {
        const newBrowserSvg = action.value[i];
        const index = newBrowserSvgs.findIndex((svg) => svg.svg_media_id == newBrowserSvg.svg_media_id);
        if (index > -1) {
          newBrowserSvgs[index] = { ...newBrowserSvg };
        }
      }
      return { ...state, browserSvgs: newBrowserSvgs };
    }
    case UIActionType.SetBrowserSvgs: {
      return { ...state, browserSvgs: [...action.value] };
    }
    case UIActionType.DeleteBrowserSvg: {
      const newBrowserSvgs = state.browserSvgs.filter((b) => b.svg_media_id != action.value);
      return { ...state, browserSvgs: newBrowserSvgs };
    }
    case UIActionType.SetTool: {
      return { ...state, tool: { ...action.value } };
    }
    case UIActionType.SetBrowserElement: {
      return {
        ...state,
        browserElement: action.value,
        stagedObject: { ...state.stagedObject, shape: stagedShapePathFor(action.value) },
      };
    }
    case UIActionType.SetActiveElement: {
      return { ...state, activeElement: action.value };
    }
    case UIActionType.SetSelectedElement: {
      return { ...state, selectedElement: action.value };
    }
    case UIActionType.SetLightFrameBackground: {
      return { ...state, lightFrameBackground: action.value };
    }
    case UIActionType.SetEffectClipboard: {
      return { ...state, effectClipboard: { ...action.value } };
    }
    case UIActionType.SetRecordingLight: {
      return { ...state, recordingLight: action.value };
    }
    case UIActionType.AddCarouselEntry: {
      return {
        ...state,
        carouselEntries: [...state.carouselEntries, action.value],
      };
    }
    case UIActionType.DeleteCarouselEntry: {
      const newEntries = state.carouselEntries.filter((m) => {
        if (m.key !== action.key) return true;
        if (action.captureId !== undefined) return !(m.type === "capture" && m.captureId === action.captureId);
        if (action.objectId !== undefined) return !(m.type === "object" && m.objectId === action.objectId);
        return false;
      });
      return { ...state, carouselEntries: newEntries };
    }
    case UIActionType.SetPlaybackMode: {
      return { ...state, playbackMode: action.value };
    }
    case UIActionType.SetResolution: {
      return { ...state, resolution: action.value };
    }
    case UIActionType.SetEffectNames: {
      return { ...state, effectNames: action.value };
    }
    case UIActionType.SetTimelineUnits: {
      return { ...state, timelineUnits: action.value };
    }
    case UIActionType.SetTimelineValues: {
      return { ...state, timelineValues: action.value };
    }
    case UIActionType.SetMixableEffects: {
      return { ...state, mixableEffects: action.value };
    }
    case UIActionType.SetFilledForwards: {
      return { ...state, filledForwards: action.value };
    }
    case UIActionType.SetProjectContextMenu: {
      const newProjectContextMenus = new Map(state.projectContextMenus);
      if (action.showContextMenu) {
        for (const [k, v] of newProjectContextMenus.entries()) {
          if (k !== action.key && v.showContextMenu) {
            newProjectContextMenus.set(k, { ...v, showContextMenu: false });
          }
        }
      }
      const current = newProjectContextMenus.get(action.key);
      newProjectContextMenus.set(action.key, {
        showContextMenu: action.showContextMenu,
        contextMenuConfig: action.contextMenuConfig ?? current?.contextMenuConfig ?? DEFAULT_CONTEXT_MENU_CONFIG,
      });
      return { ...state, projectContextMenus: newProjectContextMenus };
    }
    case UIActionType.CloseAllContextMenus: {
      const newProjectContextMenus = new Map(state.projectContextMenus);
      let changed = false;
      for (const [k, v] of newProjectContextMenus.entries()) {
        if (v.showContextMenu) {
          newProjectContextMenus.set(k, { ...v, showContextMenu: false });
          changed = true;
        }
      }
      return changed ? { ...state, projectContextMenus: newProjectContextMenus } : state;
    }
    case UIActionType.SetAnimationDownloadProgress: {
      return { ...state, animationDownloadProgress: action.value };
    }
    case UIActionType.SetShowMediaBrowser: {
      return { ...state, showMediaBrowser: action.value };
    }
    case UIActionType.SetShowTimeline: {
      return { ...state, showTimeline: action.value };
    }
    case UIActionType.SetMediaBrowserFilter: {
      return { ...state, mediaBrowserFilter: action.value };
    }
    case UIActionType.SetLightSourcePreview: {
      return { ...state, lightSourcePreview: action.value };
    }
    case UIActionType.SetCanvasZoom: {
      const canvasZoom = Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, action.value));
      if (canvasZoom === state.canvasZoom) return state;
      return { ...state, canvasZoom };
    }
    case UIActionType.SetStagedObject: {
      return { ...state, stagedObject: { ...state.stagedObject, ...action.value } };
    }
    case UIActionType.StartObjectReview: {
      if (action.candidates.length === 0) return state;
      return {
        ...state,
        objectReview: {
          mode: "review",
          maskMediaId: action.maskMediaId,
          maskKey: action.maskKey,
          candidates: action.candidates,
          decisions: new Map(),
          currentIndex: 0,
          currentIndices: new Set(action.candidates[0].polygon_indices),
          redoRequested: false,
        },
      };
    }
    case UIActionType.StartObjectEdit: {
      return {
        ...state,
        objectReview: {
          mode: "edit",
          maskMediaId: action.maskMediaId,
          maskKey: action.maskKey,
          candidates: [{ object: action.object, polygon_indices: action.polygonIndices }],
          decisions: new Map(),
          currentIndex: 0,
          currentIndices: new Set(action.polygonIndices),
          redoRequested: false,
        },
      };
    }
    case UIActionType.ToggleObjectReviewPolygon: {
      const review = state.objectReview;
      if (!review || isObjectReviewLocked(review)) return state;
      const currentIndices = new Set(review.currentIndices);
      if (currentIndices.has(action.index)) {
        currentIndices.delete(action.index);
      } else {
        currentIndices.add(action.index);
      }
      return { ...state, objectReview: { ...review, currentIndices } };
    }
    case UIActionType.SetObjectReviewIndex: {
      const review = state.objectReview;
      if (!review) return state;
      const index = Math.min(review.candidates.length - 1, Math.max(0, action.index));
      if (index === review.currentIndex) return state;
      return {
        ...state,
        objectReview: {
          ...review,
          currentIndex: index,
          currentIndices: action.currentIndices ?? new Set(review.candidates[index].polygon_indices),
          redoRequested: false,
        },
      };
    }
    case UIActionType.RequestObjectReviewRedo: {
      const review = state.objectReview;
      if (!review || !isObjectReviewLocked(review)) return state;
      return { ...state, objectReview: { ...review, redoRequested: true } };
    }
    case UIActionType.RecordObjectReviewDecision: {
      const review = state.objectReview;
      if (!review) return state;
      if (review.mode === "edit") return { ...state, objectReview: undefined };
      const candidate = review.candidates[review.currentIndex];
      if (!candidate) return state;

      const decisions = new Map(review.decisions);
      decisions.set(candidate.object.id, action.decision);

      const next = advanceObjectReview(review, decisions);
      if (next.done) return { ...state, objectReview: undefined };
      return {
        ...state,
        objectReview: {
          ...review,
          decisions,
          currentIndex: next.currentIndex,
          currentIndices: action.nextCurrentIndices ?? new Set(review.candidates[next.currentIndex].polygon_indices),
          redoRequested: false,
        },
      };
    }
    case UIActionType.EndObjectReview: {
      return { ...state, objectReview: undefined };
    }
    case UIActionType.ResumeObjectReview: {
      const resumed = resumeObjectReview(action.maskMediaId, action.maskKey, action.candidates, action.decisions);
      return resumed ? { ...state, objectReview: resumed } : state;
    }
  }
}
