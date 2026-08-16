import { LaurusCropSvg } from "../../svg-repo";
import { WorkspaceResolution } from "../workspace.config";
import { LaurusImgResult, LaurusEffect, LaurusSvgResult } from "../workspace.server";
import { ContextMenuConfig, DEFAULT_CONTEXT_MENU_CONFIG } from "../../projects/projects.server";
import { RESOLUTION } from "@/app/landing.config";
import { PEAK_ELEVATION_DEFAULT } from "../mask-gl";
import { PEAK_FALLOFF_DEFAULT } from "../workspace.server";

export interface ProjectMediaContextMenu {
  showContextMenu: boolean;
  contextMenuConfig: ContextMenuConfig;
}

export type LaurusThumbnail = { type: "svg"; value: LaurusSvgResult } | { type: "img"; value: LaurusImgResult };

// What a circle-drag over a selected mesh draws, or false when the topology tool is off altogether.
// "circle" is the plain round peak the tool has always drawn; "shape" draws the silhouette staged
// from the armed svg instead (see stagedPeak.shape below, and Maskbar's own peak/shape toggles).
//
// One tri-state field rather than two booleans because the modes are mutually exclusive by nature --
// a drag draws one silhouette or the other, never both -- so the state can't represent the
// contradiction. Every consumer that only cares whether topology editing is on at all (canvas.tsx's
// drag gating, project-mask-item.tsx's peak grab/delete) still reads it as a plain truthiness check.
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

// Which element an effect unit's carousel is currently parked on -- i.e. what a newly wired
// equation attaches to. Purely about wiring: it deliberately does NOT drive the canvas highlight or
// Lightsourcebar's dials, which read LaurusSelectedElement below instead. See that type's own doc
// comment for why the two used to be one thing and no longer are.
export type LaurusActiveElement =
  | { key: string; type: "svg"; locallyActivatedEffectKey?: string }
  | { key: string; type: "img"; locallyActivatedEffectKey?: string }
  // The whole mask wired, no particular capture singled out. Lightsourcebar's dials are still
  // per-mask, not per-capture, so this distinction doesn't gate them -- see the mask's own
  // light_source_* fields.
  | { key: string; type: "mask"; locallyActivatedEffectKey?: string }
  // One particular capture on the mask at `key` is wired -- mirrors CarouselEntry's own "mask" vs
  // "capture" split (see its doc comment) rather than qualifying the "mask" variant above with an
  // optional captureId.
  | { key: string; type: "capture"; captureId: number; locallyActivatedEffectKey?: string }
  // One particular topology peak on the mask at `key` is wired, mirroring the "capture" variant
  // above exactly. Three of the four effect kinds can wire one, each acting on a different part of
  // its geometry (see maskPeakInputId) -- only "rotate" can't.
  | { key: string; type: "peak"; peakId: number; locallyActivatedEffectKey?: string };

// What the canvas actually paints as highlighted, and what Lightsourcebar's dials read and write --
// deliberately NOT activeElement above, which the two used to share. The two answer different
// questions: activeElement is about *wiring* (which element an effect unit's carousel is parked on,
// and therefore what an equation attaches to), while this is about *attention* (which capture or
// peak you're currently looking at and tuning). Collapsing them meant every context-menu click on a
// capture silently rewired an effect, and every carousel step silently moved the highlight.
//
// Selection is driven by the gestures that read as "pick this": an alt-click or a light-source-tool
// click directly on a capture/peak (project-mask-item.tsx's onClick hit-test), a meta-click opening
// that element's own context menu, drawing or dragging one, or activating a capture/peak from a
// unit display -- the one place the two concepts deliberately move together (see unit-display.tsx).
//
// Only mask sub-elements appear here: an img/svg's own "selected" state is HoverContext's
// selectedImgKeys/selectedSvgKeys, and a whole mask's is selectedMaskKeys. The "mask" variant is
// this set's own "no particular sub-element singled out" case (every capture renders its dim,
// unselected highlight -- see project-mask-item.tsx's recolorHighlight), not a duplicate of
// selectedMaskKeys.
export type LaurusSelectedElement =
  | { key: string; type: "mask" }
  | { key: string; type: "capture"; captureId: number }
  | { key: string; type: "peak"; peakId: number };

export type CarouselEntry =
  | { type: "svg"; key: string }
  | { type: "img"; key: string }
  // The whole mask element -- wireable to move/scale/rotate exactly like an img/svg, targeting
  // the mesh's own WebGL canvas via workspace.client.tsx's maskElementsRef instead of a DOM img/
  // svg element. Kept distinct from "capture" below (mirrors ContextMenuMedia's own "mask" vs
  // "capture" split in context-menu.tsx) rather than overloading one variant for both.
  | { type: "mask"; key: string }
  // One entry per capture, not per mask -- a mask with several captures (see project-mask-item.tsx)
  // gets that many carousel entries, each wiring one particular capture (see workspace.client.tsx's
  // initCarouselEntries/captureMeshSection).
  | { type: "capture"; key: string; captureId: number }
  // One entry per topology peak, mirroring "capture" above exactly. "light_source" ramps its own
  // relief, "move" translates its epicenter and "scale" multiplies its radius (see
  // maskPeakInputId); only "rotate" filters these out, having no whole-element transform of a
  // peak's to act on.
  | { type: "peak"; key: string; peakId: number };

export type PlaybackMode = { type: "playing" } | { type: "stopped" } | { type: "waiting" };

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
  // Whether mousing over a mask's WebGL canvas drives its light source epicenter -- off by
  // default (see Lightsourcebar's "preview" toggle) so hovering over masks while working doesn't
  // constantly trigger the animation.
  lightSourcePreview: boolean;
  // The shape Lightsourcebar's own peak sliders are staged at whenever no topology peak is
  // currently selected -- read the instant a fresh circle-drag commits a new peak
  // (workspace.client.tsx's createTopologyPeak), so drawing several peaks in a row without
  // touching a slider keeps reusing whatever shape was last dialed in, rather than always
  // restarting at the defaults.
  //
  // Radius is deliberately absent: unlike elevation and falloff, it isn't dialed in ahead of time --
  // the circle-drag that creates the peak is what defines it. Anything staged for it would be
  // immediately overwritten by the gesture.
  //
  // `shape` is the normalized silhouette a "shape"-mode drag draws, or "" when no usable svg is
  // armed (see Peak_V1_0.shape). It belongs here for exactly the reason elevation and falloff do: it
  // is chosen before the gesture rather than measured from it, and it persists across several drags
  // so a row of peaks can be drawn in one silhouette without re-picking it each time. Unlike those
  // two it has no slider -- Maskbar mirrors it from whichever svg the browser has armed (see its
  // shape cell), and only a drag in TopologyMode "shape" consumes it, so it being staged never
  // changes what the plain "peak" mode draws.
  stagedPeak: { elevation: number; falloff: number; shape: string };
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
  stagedPeak: { elevation: PEAK_ELEVATION_DEFAULT, falloff: PEAK_FALLOFF_DEFAULT, shape: "" },
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
  SetStagedPeak,
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
  // captureId/peakId narrows this to one particular mask entry (deleting one capture, or one
  // peak); with neither, every entry with this key goes (deleting the whole img/svg/mask, all its
  // capture and peak entries included).
  | { type: UIActionType.DeleteCarouselEntry; key: string; captureId?: number; peakId?: number }
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
  // Partial so a caller can stage one parameter without restating the others -- Maskbar's sliders are
  // independent controls, and each only knows its own value.
  | { type: UIActionType.SetStagedPeak; value: Partial<UIState["stagedPeak"]> };

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
        if (action.peakId !== undefined) return !(m.type === "peak" && m.peakId === action.peakId);
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
    case UIActionType.SetStagedPeak: {
      return { ...state, stagedPeak: { ...state.stagedPeak, ...action.value } };
    }
  }
}
