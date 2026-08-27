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
 * It is what the toolbar shows while an outline is open for editing, so
 * opening one -- from the review panel, the context menu's edit button, or the
 * light source bar's -- selects the pen as a side effect. And it can be picked
 * from the toolbar directly, which selects it with nothing open under it: see
 * isPenArmed for what it does while it waits. Either way, what is selected is
 * this, and the bar it shows is the same bar.
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
   * Whether the pen overlay is open.
   *
   * Also which half of the session a click on the mesh belongs to. With the
   * handles up every click is the outline's; what the region covers is changed
   * with them down, and shutting the pen is what hands the triangles back. See
   * ToggleMaskEditPolygon, which refuses either way round.
   */
  editingShape: boolean;
  /**
   * The tool the pen was opened over, held so closing it can put the toolbar
   * back exactly as it was. Undefined whenever the pen is shut.
   *
   * Restoring a remembered tool rather than a default, because a session is
   * reached part-way through a mask-tool gesture -- objects armed, light off
   * -- and dropping back to a fresh mask tool would quietly undo that.
   *
   * It can be the pen itself, which is a session opened from the armed pen
   * rather than from a bar: see closedPenTool for when that one is handed back
   * and when it is not.
   */
  penReturnTool: LaurusTool | undefined;
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
 * Open or close the pen, keeping the toolbar in step with it.
 *
 * The pen is a tool as much as it is a panel button: while it is open the
 * subtitle bar shows the pen's own controls, and those controls live on
 * `tool` the way every other bar's do. The two therefore have to move
 * together, and there are six places the pen closes -- the panel button,
 * stepping to another candidate, recording a decision, ending the review,
 * saving a light, starting a new session -- so they all come through here
 * rather than each remembering to set the tool as well.
 *
 * Generic over the session kind so that closing the pen hands back a session
 * of the kind it was given, rather than widening a light edit to the union on
 * the way through and making every caller narrow it again.
 */
function withShapeEditing<T extends MaskEditSession>(state: UIState, session: T, editing: boolean): UIState {
  if (editing === session.editingShape) return { ...state, maskEdit: session };
  if (editing) {
    return {
      ...state,
      tool: defaultPenTool,
      maskEdit: {
        ...session,
        editingShape: true,
        // Opened over an armed pen, the tool to go back to is the armed pen:
        // picking it from the toolbar is a standing intention to edit outlines,
        // and dropping to the mask tool the moment one is saved would end that
        // after a single use. The session's own remembered tool still wins
        // where there is one, which is the pen reopening within a review it
        // was already opened from.
        penReturnTool: state.tool.type === "pen" ? (session.penReturnTool ?? defaultPenTool) : state.tool,
      },
    };
  }
  return {
    ...state,
    tool: closedPenTool(state, session),
    maskEdit: { ...session, editingShape: false, penReturnTool: undefined },
  };
}

/**
 * The tool to leave behind once the pen is gone.
 *
 * The mask tool is the fallback rather than the current one because the
 * current one is the pen, and leaving that selected would show a bar for an
 * overlay that is no longer mounted.
 *
 * `sessionEnded` is that same argument applied to the one remembered tool that
 * can itself be a pen -- the armed pen a session was opened over. Going back
 * to it is right when the session is over, and it is what keeps the toolbar
 * pen selected through editing one outline after another. It is wrong while
 * the session stays open with only its handles down, because then there *is*
 * something on screen the pen's own bar would be describing wrongly.
 */
function closedPenTool(state: UIState, session: MaskEditSession | undefined, sessionEnded = false): LaurusTool {
  if (state.tool.type !== "pen") return state.tool;
  const back = session?.penReturnTool ?? defaultMaskTool;
  if (back.type === "pen" && !sessionEnded) return defaultMaskTool;
  return back;
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
    penReturnTool: undefined,
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
      // Picking the pen while something is open but unshaped raises its
      // handles, rather than selecting a tool that then sits there doing
      // nothing. That is the whole of what picking the pen means -- a review
      // reached from the context menu opens with the pen down, and the way
      // back up should be the pen itself as much as the panel's own button.
      //
      // A decided candidate is left alone: it refuses edits until it is
      // unlocked, which is exactly why the panel's button is disabled on one,
      // and handles that cannot commit anything would be worse than none.
      const session = state.maskEdit;
      if (action.value.type === "pen" && session && !session.editingShape && !isMaskEditLocked(session)) {
        return { ...withShapeEditing(state, session, true), tool: { ...action.value } };
      }
      // Picking another tool while the pen is open leaves the pen, but not
      // from here: shutting it also has to put back the relief and the
      // triangles the reshape was previewing, which are not this reducer's to
      // touch. useObjectReview watches for the tool moving out from under the
      // pen and closes it the same way the panel's own button does.
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
      return {
        ...state,
        tool: closedPenTool(state, state.maskEdit),
        maskEdit: {
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
          penReturnTool: undefined,
          retouch: undefined,
        },
      };
    }
    // Both of these open with the pen already up, rather than a panel with a
    // shut pen and a button to open it. Editing an outline is the whole of
    // what they are for -- there is no reviewing to do first, the way there is
    // for a detected candidate -- so the button was one click standing between
    // asking to edit a shape and being able to. withShapeEditing is what puts
    // the toolbar on the pen and remembers the tool to hand back.
    case UIActionType.StartObjectEdit: {
      return withShapeEditing(
        state,
        {
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
          editingShape: false,
          penReturnTool: undefined,
          retouch: undefined,
        },
        true,
      );
    }
    case UIActionType.StartLightEdit: {
      return withShapeEditing(
        state,
        {
          subject: "light",
          maskMediaId: action.maskMediaId,
          maskKey: action.maskKey,
          light: action.light,
          currentIndices: new Set(action.polygonIndices),
          editedShape: undefined,
          editingShape: false,
          penReturnTool: undefined,
          retouch: undefined,
        },
        true,
      );
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
      // editingShape is left as it is and closed by withShapeEditing, which is
      // the only thing that knows to hand the toolbar back its tool
      return withShapeEditing(
        state,
        {
          ...review,
          currentIndex: index,
          currentIndices: action.currentIndices ?? new Set(review.candidates[index].polygon_indices),
          redoRequested: false,
          editedShape: undefined,
          retouch: undefined,
        },
        false,
      );
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
      return withShapeEditing(state, session, action.editing);
    }
    case UIActionType.RequestObjectReviewRedo: {
      const review = state.maskEdit;
      if (review?.subject !== "object" || !isMaskEditLocked(review)) return state;
      return { ...state, maskEdit: { ...review, redoRequested: true } };
    }
    case UIActionType.RecordObjectReviewDecision: {
      const review = state.maskEdit;
      if (review?.subject !== "object") return state;
      if (review.mode === "edit") return { ...state, tool: closedPenTool(state, review, true), maskEdit: undefined };
      const candidate = review.candidates[review.currentIndex];
      if (!candidate) return state;

      const decisions = new Map(review.decisions);
      decisions.set(candidate.object.id, action.decision);

      const next = advanceObjectReview(review, decisions);
      if (next.done) return { ...state, tool: closedPenTool(state, review, true), maskEdit: undefined };
      return withShapeEditing(
        state,
        {
          ...review,
          decisions,
          currentIndex: next.currentIndex,
          currentIndices: action.nextCurrentIndices ?? new Set(review.candidates[next.currentIndex].polygon_indices),
          redoRequested: false,
          retouch: undefined,
        },
        false,
      );
    }
    case UIActionType.EndMaskEdit: {
      return { ...state, tool: closedPenTool(state, state.maskEdit, true), maskEdit: undefined };
    }
    case UIActionType.ResumeObjectReview: {
      const resumed = resumeObjectReview(action.maskMediaId, action.maskKey, action.candidates, action.decisions);
      return resumed ? { ...state, tool: closedPenTool(state, state.maskEdit), maskEdit: resumed } : state;
    }
  }
}
