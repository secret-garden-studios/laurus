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
  | { type: "mask"; lightingMeshSection: boolean; raisingObjects: boolean }
  | { type: "light_source" }
  | { type: "pen"; stitch: boolean; addAnchor: boolean; showAnchors: boolean };

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
  lightingMeshSection: false,
  raisingObjects: false,
};

/**
 * The pen reaches the toolbar two ways, and they meet in the same place.
 *
 * It is what the toolbar shows for the whole of a session, so opening one --
 * from the context menu's edit button, the light source bar's, or a mask
 * review -- selects the pen, and it stays selected until the session is over.
 * And it can be picked from the toolbar directly, which selects it with
 * nothing open under it: see isPenArmed for what it does while it waits.
 * Either way, what is selected is this, and the bar it shows is the same bar.
 *
 * So the pen is the one tool a session can be open under. The review panel is
 * the pen's own supplement rather than a thing of its own, which makes leaving
 * the pen the same act as leaving the session: openMaskEdit is the half of
 * that invariant which holds, and useObjectReview's tool watch is the half
 * that tears down.
 */
export const defaultPenTool: LaurusTool = {
  type: "pen",
  stitch: false,
  addAnchor: false,
  showAnchors: true,
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

/** A reshaped outline together with the geometry that keeps it where it was drawn. */
export interface ObjectShapeEdit {
  path: string;
  cx: number;
  cy: number;
  radius: number;
}

/**
 * A mesh recut against the current candidate's outline, and the mesh it was
 * recut from.
 *
 * Held on the review session rather than written straight into the mask
 * because a retouch is uncommitted, exactly like a reshape: the reviewer may
 * still reject the candidate, step away from it, or shut the pen. What the
 * canvas draws is the recut mesh -- there would be no point recutting
 * otherwise -- so `restore` is what puts the mask back when any of those
 * happen, and it is the array that was there before, not a copy of it.
 *
 * `added` is how many entries the recut appended. The recut is append-only so
 * that no index anyone is holding moves (see object-retouch), which means the
 * appended entries are exactly the tail: everything from `polygons.length -
 * added` on. That is what the accept sends, and it is why nothing here needs
 * to record *which* entries are new.
 */
export interface ObjectRetouch {
  polygons: LaurusPolygonPath[];
  restore: LaurusPolygonPath[];
  added: number;
}

/**
 * The fields every shapeable thing on a mask has in common.
 *
 * An object and a light are different in almost every way that matters --
 * one raises relief, the other casts light -- but the pen does not care about
 * any of that. It needs somewhere to draw, something to name, and somewhere to
 * put the result, and both have exactly those. Naming that overlap once is
 * what lets a single pen, a single overlay and a single session serve both
 * instead of two of each drifting apart.
 *
 * `cx`/`cy`/`radius` are not decoration on `shape`: a stored path is
 * normalized to unit extent and scaled by the radius, so the four are one
 * value in four fields and pairing a path with another region's geometry
 * renders it at the wrong size and place.
 */
export interface EditableRegion {
  id: number;
  name: string;
  description: string;
  cx: number;
  cy: number;
  radius: number;
  shape: string;
}

/**
 * The state the pen keeps, whatever it happens to be open on.
 *
 * Split out from the two session kinds below rather than repeated in each,
 * because every one of these is read and written by machinery that genuinely
 * does not know which kind it has: the overlay, the retouch, the toolbar
 * hand-off, the revert. A field that appeared on only one of them would be a
 * field that silently does nothing half the time.
 */
interface MaskEditSessionBase {
  maskMediaId: string;
  maskKey: string;
  /** Which of the mask's triangles the thing being edited currently claims. */
  currentIndices: Set<number>;
  /**
   * The outline the editor has redrawn, or undefined while it is still the one
   * that was there when the session opened. Held here rather than written
   * straight through because it is a diff against something that is never
   * mutated -- the same way currentIndices is -- and because the edit may still
   * be abandoned.
   *
   * The geometry travels with the path and is not optional. A stored outline
   * is normalized to unit extent and scaled by `radius`, so pulling an anchor
   * outward is recorded as a wider radius rather than a larger path; saving
   * the path without it would render the edit scaled back to where it started.
   */
  editedShape: ObjectShapeEdit | undefined;
  /**
   * Whether the outline's handles are up.
   *
   * Which half of the session a click on the mesh belongs to, and nothing
   * beyond that: with the handles up every click is the outline's, and what
   * the region covers is changed with them down. See ToggleMaskEditPolygon,
   * which refuses either way round.
   *
   * Not a question of which tool is selected. The pen is selected for the
   * whole of a session however this sits, so putting the handles down leaves
   * the penbar exactly where it was -- what changes is which of its controls
   * still have something to act on. See defaultPenTool.
   */
  editingShape: boolean;
  /**
   * A standing request to shut this session down, raised from somewhere that
   * cannot shut it down itself.
   *
   * Ending a session is mostly not state -- the relief a reshape was
   * previewing has to come down, and the mask has to be handed back the mesh
   * it was triangulated with -- so useObjectReview is the only thing that can
   * actually do it, and only the review panel mounts that. Everywhere else
   * that has to end one, having asked the editor first, raises this instead
   * and lets the one place that knows how do the work.
   *
   * On the session rather than beside it so it cannot outlive the thing it is
   * a request about: no session, nothing requested.
   */
  endRequested: boolean;
  /**
   * The recut mesh the editor has asked for, or undefined while the mesh is
   * still the one the mask was triangulated with.
   *
   * Dropped on every move to another candidate for the same reason editedShape
   * is: it is a diff against one region, and carrying it to the next would
   * recut a mesh against an outline that is no longer on screen.
   */
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

/**
 * The pen open on one light.
 *
 * There is no `mode` and no `decisions` because there is nothing to review: a
 * light is not proposed by detection the way an object is, so the only thing
 * anyone ever does to one is edit it. That is also why the light rides on the
 * session directly rather than as a one-element candidate list -- a list of
 * one, with an index that can only be zero, would be pretending a light can be
 * stepped through.
 *
 * The light held here is the one the session opened on, and it stays that way.
 * Like a review candidate it is a fixed thing that `editedShape` is a diff
 * against, not a running copy of what the mask holds.
 */
export interface LightEditSession extends MaskEditSessionBase {
  subject: "light";
  light: LaurusLight;
}

/**
 * Whatever the pen is currently open on -- at most one thing, ever.
 *
 * One session rather than one per kind, because the things that would have to
 * be duplicated are the things that must not disagree: which tool the toolbar
 * shows, which overlay is mounted, and which mesh the mask is drawing. Two
 * sessions could both be open, and then two of those three would be wrong.
 */
export type MaskEditSession = ObjectReviewSession | LightEditSession;

/**
 * The region the pen is open on, whichever kind of session it belongs to.
 *
 * Undefined only for a review whose candidate index has gone stale, which the
 * callers already have to handle.
 *
 * Note this is the region the session *opened* on -- the candidate as detected,
 * or the light as stored. Where an edit has since been accepted onto the mask,
 * what is on screen is the mask's copy, not this one; resolving that is the
 * canvas's business because only it holds the mask (see reviewShape).
 */
export function editedRegion(session: MaskEditSession): EditableRegion | undefined {
  if (session.subject === "light") return session.light;
  return session.candidates[session.currentIndex]?.object;
}

/**
 * Whether this entry is the very thing the pen has open.
 *
 * The question every control that selects something has to ask before it acts:
 * moving the selection off what is being edited abandons the session, so the
 * one target that is not a move away is the subject itself. Read through
 * editedRegion rather than off the session, because a review's subject is
 * whichever candidate it currently stands on.
 *
 * A mask is never the subject, not even the mask the session is on. The pen is
 * open on one region of it, and selecting the whole thing points every bar at
 * something else.
 */
export function isMaskEditSubject(session: MaskEditSession, entry: CarouselEntry): boolean {
  if (entry.key !== session.maskKey) return false;
  if (entry.type === "light") return session.subject === "light" && entry.lightId === session.light.id;
  if (entry.type === "object") return session.subject === "object" && entry.objectId === editedRegion(session)?.id;
  return false;
}

/**
 * Open the pen on something, which is the same act as selecting it.
 *
 * The panel is the pen's supplement rather than a thing of its own, so there
 * is no reaching the left half of this without the right: every session starts
 * here, and none of the four openers is trusted to remember the tool for
 * itself. The way back out is the mirror of it -- a session ends by clearing
 * `maskEdit` and leaving the pen exactly where it is, armed and waiting for
 * whatever is clicked next (see isPenArmed).
 *
 * A fresh pen rather than the one already selected, which matters on the way
 * in from an armed one: stitch and add-anchor read clicks on an outline that
 * did not exist when they were switched on, and carrying them over would open
 * the session in a mode nobody asked this outline for.
 */
function openMaskEdit(state: UIState, session: MaskEditSession): UIState {
  return { ...state, tool: defaultPenTool, maskEdit: session };
}

/**
 * Whether the pen is selected with nothing open under it.
 *
 * The state the toolbar button leaves behind when it is pressed cold. There is
 * nothing to draw yet, so what the pen does instead is wait to be told what:
 * the canvas turns to a crosshair, and the next light or object clicked on a
 * mask is opened for editing there and then (see the canvas click handler).
 *
 * No flag of its own, because there is nothing one could say that these two
 * do not -- the pen is the tool, and no session is open beneath it. A flag
 * would be a third thing to keep in step with the two that already decide it.
 */
export function isPenArmed(state: UIState): boolean {
  return state.tool.type === "pen" && state.maskEdit === undefined;
}

/**
 * Whether the bar on screen is waiting to be pointed at a light or an object
 * instead of showing anything about one.
 *
 * True of the armed pen, and of the light source tool with nothing picked and
 * no preview running. Both bars say so in the same sentence, and both want the
 * same thing from the canvas: hovering a mask brings up the dim cues for every
 * light and object on it, so what there is to click can be seen rather than
 * hunted for. Named here because the canvas is what has to answer it, and it
 * has to answer both the same way.
 *
 * The light source bar's own greeting is the narrower one -- it knows which of
 * its two submenus is showing, which nothing outside it does. The gap is only
 * ever a submenu greeting while something of the other kind is selected, and
 * that selection is already lighting its own mask up.
 */
export function isAwaitingRegionPick(state: UIState): boolean {
  if (isPenArmed(state)) return true;
  if (state.tool.type !== "light_source" || state.lightSourcePreview) return false;
  return state.selectedElement?.type !== "light" && state.selectedElement?.type !== "object";
}

export type MaskArm = { type: "img"; img: LaurusImgResult } | { type: "mask"; maskKey: string };

export function maskArm(state: UIState, selectedMaskKey: string | undefined): MaskArm | undefined {
  if (state.tool.type !== "mask") return undefined;
  if (selectedMaskKey !== undefined) return { type: "mask", maskKey: selectedMaskKey };
  if (state.browserElement?.type === "img") return { type: "img", img: state.browserElement.value };
  return undefined;
}

/**
 * Whether the session refuses edits because its subject has already been
 * decided.
 *
 * Only ever true of a review. A light edit has no decision to be locked by,
 * and neither does an object opened straight from the context menu -- both are
 * someone deliberately choosing to change one thing, which is the same gesture
 * that unlocks a decided candidate.
 */
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
  /** Whatever the pen is open on, or undefined when it is open on nothing. */
  maskEdit: MaskEditSession | undefined;
  /** dim (0.5 alpha) vs bright (1 alpha) for the pen's outline/highlight overlays. */
  gridlinesBright: boolean;
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
  StartLightEdit,
  SetObjectReviewIndex,
  RequestObjectReviewRedo,
  RecordObjectReviewDecision,
  ResumeObjectReview,
  // Shared by both kinds of session -- these are the pen's own actions, and
  // the pen does not know or care whether it is open on an object or a light.
  ToggleMaskEditPolygon,
  SetMaskEditShape,
  SetMaskEditShapeEditing,
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
      return { ...state, browserElement: action.value };
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
    case UIActionType.StartObjectReview: {
      if (action.candidates.length === 0) return state;
      // Handles down, but the pen selected all the same: a candidate is
      // reviewed before it is redrawn, so the first thing to do with one is
      // pick over the triangles it claims. The panel's own button raises the
      // handles when there turns out to be something to redraw.
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
    // Both of these open with the handles already up, unlike a review.
    // Editing an outline is the whole of what they are for -- there is no
    // reviewing to do first, the way there is for a detected candidate -- so
    // the panel's button was one click standing between asking to edit a shape
    // and being able to.
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
        currentIndices: new Set(action.polygonIndices),
        editedShape: undefined,
        editingShape: true,
        endRequested: false,
        retouch: undefined,
      });
    }
    case UIActionType.ToggleMaskEditPolygon: {
      const session = state.maskEdit;
      // Membership is not the pen's to change: while its handles are up the
      // clicks on the mesh are the outline's, and the canvas already refuses
      // to raise this then. Refused here as well because it is the invariant
      // rather than the gesture -- what a region covers is edited with the pen
      // shut, whoever asks.
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
      // Stepping between candidates is a review's own gesture: a light edit has
      // exactly one subject, so there is nowhere for an index to point.
      if (review?.subject !== "object") return state;
      const index = Math.min(review.candidates.length - 1, Math.max(0, action.index));
      if (index === review.currentIndex) return state;
      // Handles down on the way in, the same as the review opened: the next
      // candidate is another thing to look over before it is anything to
      // redraw, and leaving them up would have them come up around an outline
      // nobody has yet decided is wrong. The pen stays selected either way.
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

      // A second retouch recuts the mesh the first one produced, so the two
      // have to compose into one -- what is held here is always the whole
      // distance from the mask as it was found to the mask as it now is,
      // because that is what reverting undoes and what accepting sends.
      //
      // `restore` is therefore the *first* one's, or a revert would put the
      // mask back to a mesh that had already been cut once. And `added` is
      // the running total, not the last recut's own: retouchDelta reads the
      // appended entries off the tail as `polygons.length - added`, so
      // carrying only the second count would put that boundary a whole recut
      // too late and report entries the server has never seen as edits to
      // entries it has.
      const previous = session.retouch;
      return {
        ...state,
        maskEdit: {
          ...session,
          retouch: {
            polygons: action.retouch.polygons,
            restore: previous?.restore ?? action.retouch.restore,
            added: (previous?.added ?? 0) + action.retouch.added,
          },
        },
      };
    }
    case UIActionType.SetMaskEditShapeEditing: {
      const session = state.maskEdit;
      if (!session) return state;
      // Only the handles. The pen was selected when the session opened and
      // stays selected until it ends, so this no longer moves the toolbar --
      // see the field's own note.
      return { ...state, maskEdit: { ...session, editingShape: action.editing } };
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
      // The pen is left selected and armed on the way out, not handed back to
      // some tool the session was opened over -- deciding the last candidate
      // is the end of one outline, not of the standing intention to edit them.
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
      // The pen stays where it is, armed -- see openMaskEdit.
      return { ...state, maskEdit: undefined };
    }
    case UIActionType.ResumeObjectReview: {
      const resumed = resumeObjectReview(action.maskMediaId, action.maskKey, action.candidates, action.decisions);
      return resumed ? openMaskEdit(state, resumed) : state;
    }
  }
}
