import { LaurusCropSvg } from "../../svg-repo";
import { WorkspaceResolution } from "../workspace.config";
import {
  LaurusImgResult,
  LaurusEffect,
  LaurusSvgResult,
  LaurusLight,
  LaurusObject,
  LaurusObjectReviewCandidate,
  LaurusPolygonPath,
} from "../workspace.server";
import { ContextMenuConfig, DEFAULT_CONTEXT_MENU_CONFIG } from "../../projects/projects.server";
import { RESOLUTION } from "@/app/landing.config";
import { MAX_MASK_OBJECTS, MIN_MASK_OBJECT_FALLOFF, OBJECT_ELEVATION_DEFAULT } from "../mask-gl";
import { CANVAS_ZOOM_DEFAULT, CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from "../workspace.config";
import { LaurusObjectFill, OBJECT_FILL_DEFAULT } from "../workspace.server";

export interface ProjectMediaContextMenu {
  showContextMenu: boolean;
  contextMenuConfig: ContextMenuConfig;
}
export type LaurusThumbnail = { type: "svg"; value: LaurusSvgResult } | { type: "img"; value: LaurusImgResult };

export type LaurusTool =
  | {
      type: "marquee";
      stack: boolean;
      copy: boolean;
    }
  | { type: "none" }
  | { type: "contextmenu" }
  | { type: "viewport" }
  | { type: "move" }
  | { type: "scale" }
  | { type: "rotate" }
  | { type: "skew" }
  | { type: "mix" }
  | { type: "mask"; lightingMeshSection: boolean; raisingObjects: boolean }
  | { type: "light_source"; copy: boolean }
  | { type: "pen"; stitch: boolean; addAnchor: boolean; showAnchors: boolean };

export const defaultMarqueeTool: LaurusTool = {
  type: "marquee",
  stack: false,
  copy: false,
};

export const defaultLightSourceTool: LaurusTool = {
  type: "light_source",
  copy: false,
};

export const defaultMaskTool: LaurusTool = {
  type: "mask",
  lightingMeshSection: false,
  raisingObjects: false,
};

export const defaultPenTool: LaurusTool = {
  type: "pen",
  stitch: false,
  addAnchor: false,
  showAnchors: true,
};

export interface CopySettings {
  position: { value: boolean; x: number | undefined; y: number | undefined };
  size: { value: boolean; width: number | undefined; height: number | undefined };
  convert: boolean;
}

export const defaultCopySettings: CopySettings = {
  position: { value: false, x: undefined, y: undefined },
  size: { value: false, width: undefined, height: undefined },
  convert: false,
};

export type MediaBrowserFilter = "img" | "svg" | "frame" | "group";

export type LaurusBrowserElement = LaurusThumbnail;

export type LaurusActiveElement =
  | { key: string; type: "svg"; locallyActivatedEffectKey?: string }
  | { key: string; type: "img"; locallyActivatedEffectKey?: string }
  | { key: string; type: "mask"; locallyActivatedEffectKey?: string }
  | { key: string; type: "light"; lightId: number; locallyActivatedEffectKey?: string }
  | { key: string; type: "object"; objectId: number; locallyActivatedEffectKey?: string };

export type LaurusSelectedElement =
  | { key: string; type: "mask" }
  | { key: string; type: "light"; lightId: number }
  | { key: string; type: "object"; objectId: number };

export type CarouselEntry =
  | { type: "svg"; key: string }
  | { type: "img"; key: string }
  | { type: "mask"; key: string }
  | { type: "light"; key: string; lightId: number }
  | { type: "object"; key: string; objectId: number };

export type PlaybackMode = { type: "playing" } | { type: "stopped" } | { type: "waiting" };

export type ObjectReviewMode = "review" | "edit";

export interface ObjectShapeEdit {
  path: string;
  cx: number;
  cy: number;
  radius: number;
}

export interface ObjectRetouch {
  polygons: LaurusPolygonPath[];
  restore: LaurusPolygonPath[];
  added: number;
}

export interface EditableRegion {
  id: number;
  name: string;
  description: string;
  cx: number;
  cy: number;
  radius: number;
  shape: string;
}

interface MaskEditSessionBase {
  maskMediaId: string;
  maskKey: string;
  currentIndices: Set<number>;
  editedShape: ObjectShapeEdit | undefined;
  editingShape: boolean;
  endRequested: boolean;
  retouch: ObjectRetouch | undefined;
}

export interface ObjectReviewSession extends MaskEditSessionBase {
  subject: "object";
  mode: ObjectReviewMode;
  candidates: LaurusObjectReviewCandidate[];
  decisions: Map<number, "accepted" | "rejected">;
  currentIndex: number;
  redoRequested: boolean;
}

export interface LightEditSession extends MaskEditSessionBase {
  subject: "light";
  light: LaurusLight;
  lowpoly: boolean;
}

export type MaskEditSession = ObjectReviewSession | LightEditSession;

export function editedRegion(session: MaskEditSession): EditableRegion | undefined {
  if (session.subject === "light") return session.light;
  return session.candidates[session.currentIndex]?.object;
}

export function isMaskEditSubject(session: MaskEditSession, entry: CarouselEntry): boolean {
  if (entry.key !== session.maskKey) return false;
  if (entry.type === "light") return session.subject === "light" && entry.lightId === session.light.id;
  if (entry.type === "object") return session.subject === "object" && entry.objectId === editedRegion(session)?.id;
  return false;
}

function openMaskEdit(state: UIState, session: MaskEditSession): UIState {
  return { ...state, tool: defaultPenTool, maskEdit: session };
}

export function isPenArmed(state: Pick<UIState, "tool" | "maskEdit">): boolean {
  return state.tool.type === "pen" && state.maskEdit === undefined;
}

export function isAwaitingRegionPick(state: UIState): boolean {
  if (isPenArmed(state)) return true;
  if (state.tool.type !== "light_source" || state.lightSourcePreview) return false;
  return state.selectedElement?.type !== "light" && state.selectedElement?.type !== "object";
}

export function isMaskDropZoneArmed(
  state: Pick<UIState, "maskEdit" | "tool" | "browserElement">,
  modifiers: { meta: boolean; alt: boolean },
): boolean {
  if (state.maskEdit !== undefined || modifiers.meta) return false;
  if (state.tool.type === "light_source") return state.tool.copy;
  if (state.tool.type !== "mask" || modifiers.alt) return false;
  return state.tool.lightingMeshSection || state.tool.raisingObjects || state.browserElement?.type === "img";
}

export type MediaArm = { key: string; type: "img" | "svg" | "mask" };

export function mediaArm(
  state: UIState,
  toolType: LaurusTool["type"],
  selectedImgKeys: Set<string>,
  selectedSvgKeys: Set<string>,
  selectedMaskKeys: Set<string>,
): MediaArm | undefined {
  if (state.tool.type !== toolType) return undefined;
  if (selectedImgKeys.size > 0) return { key: Array.from(selectedImgKeys)[0], type: "img" };
  if (selectedSvgKeys.size > 0) return { key: Array.from(selectedSvgKeys)[0], type: "svg" };
  if (selectedMaskKeys.size > 0) return { key: Array.from(selectedMaskKeys)[0], type: "mask" };
  return undefined;
}

export type MaskArm = { type: "img"; img: LaurusImgResult } | { type: "mask"; maskKey: string };

export function maskArm(state: UIState, selectedMaskKey: string | undefined): MaskArm | undefined {
  if (state.tool.type !== "mask") return undefined;
  if (selectedMaskKey !== undefined) return { type: "mask", maskKey: selectedMaskKey };
  if (state.browserElement?.type === "img") return { type: "img", img: state.browserElement.value };
  return undefined;
}

export type MarqueeArm = { type: "selection" } | { type: "browser"; element: LaurusBrowserElement };

export function marqueeArm(
  state: Pick<UIState, "tool" | "browserElement">,
  selectedImgKeys: Set<string>,
  selectedSvgKeys: Set<string>,
): MarqueeArm | undefined {
  if (state.tool.type !== "marquee") return undefined;
  if (selectedImgKeys.size > 0 || selectedSvgKeys.size > 0) return { type: "selection" };
  if (state.browserElement) return { type: "browser", element: state.browserElement };
  return undefined;
}

export function isDropImplied(
  state: UIState,
  selectedImgKeys: Set<string>,
  selectedSvgKeys: Set<string>,
  selectedMaskKey: string | undefined,
): boolean {
  switch (state.tool.type) {
    case "marquee":
      return !state.tool.stack && marqueeArm(state, selectedImgKeys, selectedSvgKeys)?.type === "browser";
    case "mask":
      return maskArm(state, selectedMaskKey)?.type === "img";
    default:
      return false;
  }
}

export function isCopyArmed(
  state: UIState,
  selectedImgKeys: Set<string>,
  selectedSvgKeys: Set<string>,
  selectedMaskKey: string | undefined,
): boolean {
  switch (state.tool.type) {
    case "marquee": {
      const arm = marqueeArm(state, selectedImgKeys, selectedSvgKeys);
      if (arm === undefined) return false;
      return arm.type === "browser" ? !state.tool.stack : state.tool.copy;
    }
    case "mask":
      return maskArm(state, selectedMaskKey)?.type === "img";
    case "light_source":
      return state.tool.copy;
    default:
      return false;
  }
}

export function armedCopy(
  state: UIState,
  selectedImgKeys: Set<string>,
  selectedSvgKeys: Set<string>,
  selectedMaskKey: string | undefined,
): CopySettings | undefined {
  return isCopyArmed(state, selectedImgKeys, selectedSvgKeys, selectedMaskKey) ? state.copy : undefined;
}

export function isMaskEditLocked(session: MaskEditSession): boolean {
  if (session.subject !== "object") return false;
  if (session.mode !== "review" || session.redoRequested) return false;
  const candidate = session.candidates[session.currentIndex];
  return candidate !== undefined && session.decisions.has(candidate.object.id);
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
  stagedObject: { elevation: number; falloff: number; fill: LaurusObjectFill };
  maskEdit: MaskEditSession | undefined;
  gridlinesBright: boolean;
  lightGridlines: { key: string; lightId: number; value: number } | undefined;
  copy: CopySettings;
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
    falloff: MIN_MASK_OBJECT_FALLOFF,
    fill: OBJECT_FILL_DEFAULT,
  },
  maskEdit: undefined,
  gridlinesBright: false,
  lightGridlines: undefined,
  copy: { ...defaultCopySettings },
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
  SetGridlinesBright,
  SetLightGridlines,
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
  SetCopy,
  StartObjectReview,
  StartObjectEdit,
  StartLightEdit,
  SetObjectReviewIndex,
  RequestObjectReviewRedo,
  RecordObjectReviewDecision,
  ResumeObjectReview,
  ToggleMaskEditPolygon,
  SetMaskEditShape,
  SetMaskEditShapeEditing,
  SetMaskEditLowpoly,
  SetMaskEditIndices,
  SetMaskEditRetouch,
  RequestMaskEditEnd,
  EndMaskEdit,
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
  | { type: UIActionType.SetGridlinesBright; value: boolean }
  | {
      type: UIActionType.SetLightGridlines;
      value: { key: string; lightId: number; value: number } | undefined;
    }
  | { type: UIActionType.SetEffectClipboard; value: LaurusEffect }
  | { type: UIActionType.SetRecordingLight; value: boolean }
  | { type: UIActionType.AddCarouselEntry; value: CarouselEntry }
  | { type: UIActionType.DeleteCarouselEntry; key: string; lightId?: number; objectId?: number }
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
  | { type: UIActionType.SetCopy; value: CopySettings }
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
  | {
      type: UIActionType.StartLightEdit;
      maskMediaId: string;
      maskKey: string;
      light: LaurusLight;
      polygonIndices: number[];
    }
  | { type: UIActionType.ToggleMaskEditPolygon; index: number }
  | { type: UIActionType.SetObjectReviewIndex; index: number; currentIndices?: Set<number> }
  | { type: UIActionType.RequestObjectReviewRedo }
  | { type: UIActionType.SetMaskEditShape; shape: ObjectShapeEdit | undefined }
  | { type: UIActionType.SetMaskEditIndices; indices: Set<number> }
  | { type: UIActionType.SetMaskEditRetouch; retouch: ObjectRetouch | undefined }
  | { type: UIActionType.SetMaskEditShapeEditing; editing: boolean }
  | { type: UIActionType.SetMaskEditLowpoly; lowpoly: boolean }
  | {
      type: UIActionType.RecordObjectReviewDecision;
      decision: "accepted" | "rejected";
      nextCurrentIndices?: Set<number>;
    }
  | { type: UIActionType.RequestMaskEditEnd }
  | { type: UIActionType.EndMaskEdit }
  | {
      type: UIActionType.ResumeObjectReview;
      maskMediaId: string;
      maskKey: string;
      candidates: LaurusObjectReviewCandidate[];
      decisions: Map<number, "accepted" | "rejected">;
    };

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
    subject: "object",
    mode: "review",
    maskMediaId,
    maskKey,
    candidates,
    decisions: new Map(decisions),
    currentIndex,
    currentIndices: new Set(candidates[currentIndex].polygon_indices),
    redoRequested: false,
    editedShape: undefined,
    editingShape: false,
    endRequested: false,
    retouch: undefined,
  };
}

function sameTool(a: LaurusTool, b: LaurusTool): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "marquee": {
      const other = b as typeof a;
      return a.stack === other.stack && a.copy === other.copy;
    }
    case "mask": {
      const other = b as typeof a;
      return a.lightingMeshSection === other.lightingMeshSection && a.raisingObjects === other.raisingObjects;
    }
    case "light_source": {
      const other = b as typeof a;
      return a.copy === other.copy;
    }
    case "pen": {
      const other = b as typeof a;
      return a.stitch === other.stitch && a.addAnchor === other.addAnchor && a.showAnchors === other.showAnchors;
    }
    default:
      return true;
  }
}

function sameBrowserElement(a: LaurusBrowserElement | undefined, b: LaurusBrowserElement | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type) return false;
  const held = a.value as unknown as Record<string, unknown>;
  const incoming = b.value as unknown as Record<string, unknown>;
  const keys = Object.keys(held);
  if (keys.length !== Object.keys(incoming).length) return false;
  return keys.every((key) => held[key] === incoming[key]);
}

function sameCopySettings(a: CopySettings, b: CopySettings): boolean {
  return (
    a.convert === b.convert &&
    a.position.value === b.position.value &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.size.value === b.size.value &&
    a.size.width === b.size.width &&
    a.size.height === b.size.height
  );
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
      if (sameTool(state.tool, action.value)) return state;
      return { ...state, tool: { ...action.value } };
    }
    case UIActionType.SetBrowserElement: {
      if (sameBrowserElement(state.browserElement, action.value)) return state;
      return { ...state, browserElement: action.value };
    }
    case UIActionType.SetActiveElement: {
      return { ...state, activeElement: action.value };
    }
    case UIActionType.SetSelectedElement: {
      const isRegion = action.value?.type === "light" || action.value?.type === "object";
      const disarmsCopy = !isRegion && state.tool.type === "light_source" && state.tool.copy;
      return {
        ...state,
        selectedElement: action.value,
        lightSourcePreview: isRegion ? false : state.lightSourcePreview,
        tool: disarmsCopy ? defaultLightSourceTool : state.tool,
      };
    }
    case UIActionType.SetLightFrameBackground: {
      return { ...state, lightFrameBackground: action.value };
    }
    case UIActionType.SetLightGridlines: {
      return { ...state, lightGridlines: action.value };
    }
    case UIActionType.SetGridlinesBright: {
      return { ...state, gridlinesBright: action.value };
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
        if (action.lightId !== undefined) return !(m.type === "light" && m.lightId === action.lightId);
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
    case UIActionType.SetCopy: {
      if (sameCopySettings(state.copy, action.value)) return state;
      return {
        ...state,
        copy: {
          position: { ...action.value.position },
          size: { ...action.value.size },
          convert: action.value.convert,
        },
      };
    }
    case UIActionType.StartObjectReview: {
      if (action.candidates.length === 0) return state;
      return openMaskEdit(state, {
        subject: "object",
        mode: "review",
        maskMediaId: action.maskMediaId,
        maskKey: action.maskKey,
        candidates: action.candidates,
        decisions: new Map(),
        currentIndex: 0,
        currentIndices: new Set(action.candidates[0].polygon_indices),
        redoRequested: false,
        editedShape: undefined,
        editingShape: false,
        endRequested: false,
        retouch: undefined,
      });
    }
    case UIActionType.StartObjectEdit: {
      return openMaskEdit(state, {
        subject: "object",
        mode: "edit",
        maskMediaId: action.maskMediaId,
        maskKey: action.maskKey,
        candidates: [{ object: action.object, polygon_indices: action.polygonIndices }],
        decisions: new Map(),
        currentIndex: 0,
        currentIndices: new Set(action.polygonIndices),
        redoRequested: false,
        editedShape: undefined,
        editingShape: true,
        endRequested: false,
        retouch: undefined,
      });
    }
    case UIActionType.StartLightEdit: {
      return openMaskEdit(state, {
        subject: "light",
        maskMediaId: action.maskMediaId,
        maskKey: action.maskKey,
        light: action.light,
        lowpoly: action.light.lowpoly,
        currentIndices: new Set(action.polygonIndices),
        editedShape: undefined,
        editingShape: true,
        endRequested: false,
        retouch: undefined,
      });
    }
    case UIActionType.ToggleMaskEditPolygon: {
      const session = state.maskEdit;
      if (!session || isMaskEditLocked(session) || session.editingShape) return state;
      const currentIndices = new Set(session.currentIndices);
      if (currentIndices.has(action.index)) {
        currentIndices.delete(action.index);
      } else {
        currentIndices.add(action.index);
      }
      return { ...state, maskEdit: { ...session, currentIndices } };
    }
    case UIActionType.SetObjectReviewIndex: {
      const review = state.maskEdit;
      if (review?.subject !== "object") return state;
      const index = Math.min(review.candidates.length - 1, Math.max(0, action.index));
      if (index === review.currentIndex) return state;
      return {
        ...state,
        maskEdit: {
          ...review,
          currentIndex: index,
          currentIndices: action.currentIndices ?? new Set(review.candidates[index].polygon_indices),
          redoRequested: false,
          editedShape: undefined,
          editingShape: false,
          retouch: undefined,
        },
      };
    }
    case UIActionType.SetMaskEditIndices: {
      const session = state.maskEdit;
      if (!session || isMaskEditLocked(session)) return state;
      return { ...state, maskEdit: { ...session, currentIndices: action.indices } };
    }
    case UIActionType.SetMaskEditShape: {
      const session = state.maskEdit;
      if (!session || isMaskEditLocked(session)) return state;
      return { ...state, maskEdit: { ...session, editedShape: action.shape } };
    }
    case UIActionType.SetMaskEditRetouch: {
      const session = state.maskEdit;
      if (!session || isMaskEditLocked(session)) return state;
      if (!action.retouch) return { ...state, maskEdit: { ...session, retouch: undefined } };

      const previous = session.retouch;
      return {
        ...state,
        maskEdit: {
          ...session,
          retouch: {
            polygons: action.retouch.polygons,
            restore: previous?.restore ?? action.retouch.restore,
            added: action.retouch.added,
          },
        },
      };
    }
    case UIActionType.SetMaskEditShapeEditing: {
      const session = state.maskEdit;
      if (!session) return state;
      return { ...state, maskEdit: { ...session, editingShape: action.editing } };
    }
    case UIActionType.SetMaskEditLowpoly: {
      const session = state.maskEdit;
      if (session?.subject !== "light" || isMaskEditLocked(session)) return state;
      return { ...state, maskEdit: { ...session, lowpoly: action.lowpoly } };
    }
    case UIActionType.RequestObjectReviewRedo: {
      const review = state.maskEdit;
      if (review?.subject !== "object" || !isMaskEditLocked(review)) return state;
      return { ...state, maskEdit: { ...review, redoRequested: true } };
    }
    case UIActionType.RecordObjectReviewDecision: {
      const review = state.maskEdit;
      if (review?.subject !== "object") return state;
      if (review.mode === "edit") return { ...state, maskEdit: undefined };
      const candidate = review.candidates[review.currentIndex];
      if (!candidate) return state;

      const decisions = new Map(review.decisions);
      decisions.set(candidate.object.id, action.decision);

      const next = advanceObjectReview(review, decisions);
      if (next.done) return { ...state, maskEdit: undefined };
      return {
        ...state,
        maskEdit: {
          ...review,
          decisions,
          currentIndex: next.currentIndex,
          currentIndices: action.nextCurrentIndices ?? new Set(review.candidates[next.currentIndex].polygon_indices),
          redoRequested: false,
          editingShape: false,
          retouch: undefined,
        },
      };
    }
    case UIActionType.RequestMaskEditEnd: {
      const session = state.maskEdit;
      if (!session || session.endRequested) return state;
      return { ...state, maskEdit: { ...session, endRequested: true } };
    }
    case UIActionType.EndMaskEdit: {
      return { ...state, maskEdit: undefined };
    }
    case UIActionType.ResumeObjectReview: {
      const resumed = resumeObjectReview(action.maskMediaId, action.maskKey, action.candidates, action.decisions);
      return resumed ? openMaskEdit(state, resumed) : state;
    }
  }
}
