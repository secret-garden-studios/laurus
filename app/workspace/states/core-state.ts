import { LaurusProjectResult } from "../../projects/projects.server";
import {
  LaurusEffect,
  LaurusEffectGroupResult,
  LaurusImgResult,
  LaurusMediaGroupResult,
  LaurusSvgResult,
  LaurusMaskResult,
} from "../workspace.server";
import { defaultProject } from "@/app/projects/states/core-state";
import {
  LIGHT_SOURCE_DARKNESS_DEFAULT,
  LIGHT_SOURCE_FALLOFF_CSS_PX_DEFAULT,
  LIGHT_SOURCE_INTENSITY_DEFAULT,
  LIGHT_SOURCE_SIZE_CSS_PX_DEFAULT,
} from "../mask-gl";

// A mesh-geometry-adjacent render setting -- how a mesh's own data gets sampled (flat
// server-shaded color vs. its UV-mapped source texture), not a shader effect layered on top.
// Room to grow toward real topology config (subdivision, triangle density, etc.) once that work
// starts.
export interface Topology {
  textureMix: number;
}

// One mesh's light source parameters -- the shape of ProjectMask_V1_0's own
// light_source_size/intensity/falloff/darkness fields (the mask's persisted starting appearance,
// see LightSourcebar/Scalebar), and of the live in-flight useMaskPreview values before a mask
// exists yet to persist to.
export interface LightSourceValue {
  size: number;
  intensity: number;
  falloff: number;
  darkness: number;
}

export const DEFAULT_LIGHT_SOURCE_VALUE: LightSourceValue = {
  size: LIGHT_SOURCE_SIZE_CSS_PX_DEFAULT,
  intensity: LIGHT_SOURCE_INTENSITY_DEFAULT,
  falloff: LIGHT_SOURCE_FALLOFF_CSS_PX_DEFAULT,
  darkness: LIGHT_SOURCE_DARKNESS_DEFAULT,
};

// A light-source-capture drag that's mid-flight to the server -- drawing/redrawing a capture
// persists it immediately (see canvas.tsx's handleLightSourceCapture and workspace.client.tsx's
// captureMeshSection), and this holds the optimistic preview while that request is outstanding.
// `polygonIndices` are indices into the target mask's own `LaurusMaskResult.polygons` array, not
// yet-uploaded triangle data.
export interface PendingLightSourceCapture {
  maskKey: string;
  polygonIndices: number[];
}

export interface CoreState {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  project: LaurusProjectResult;
  canvasImgs: Map<string, LaurusImgResult>;
  canvasSvgs: Map<string, LaurusSvgResult>;
  canvasMasks: Map<string, LaurusMaskResult>;
  effects: LaurusEffect[];
  effectGroups: Map<string, LaurusEffectGroupResult>;
  mediaGroups: Map<string, LaurusMediaGroupResult>;
  timelineUnit: string;
  timelineMaxValue: number;
  inputsToRender: Set<string>;
  // Per-mesh WebGL preview state -- ephemeral view state, not part of the persisted project, but
  // centralized here alongside the rest of the cross-component state rather than in a separate
  // context. See Topology above for why it's shaped the way it is.
  topology: Map<string, Topology>;
  pendingLightSourceCapture: PendingLightSourceCapture | undefined;
}

export const defaultCoreState: CoreState = {
  apiOrigin: undefined,
  accessToken: undefined,
  project: defaultProject,
  canvasImgs: new Map(),
  canvasSvgs: new Map(),
  canvasMasks: new Map(),
  effects: [],
  effectGroups: new Map(),
  mediaGroups: new Map(),
  timelineUnit: "",
  timelineMaxValue: 0,
  inputsToRender: new Set<string>(),
  topology: new Map(),
  pendingLightSourceCapture: undefined,
};

export enum CoreActionType {
  SetCoreState,
  SetProject,
  SetCanvasImg,
  DeleteCanvasImg,
  SetCanvasImgs,
  SetCanvasSvg,
  DeleteCanvasSvg,
  SetCanvasSvgs,
  SetCanvasMask,
  DeleteCanvasMask,
  SetCanvasMasks,
  SetProjectImg,
  SetProjectSvg,
  DeleteProjectImg,
  DeleteProjectSvg,
  DeleteProjectMask,
  SetLightFrameBackground,
  SetEffects,
  SetEffect,
  DeleteEffect,
  SetEffectGroup,
  DeleteEffectGroup,
  SetMediaGroup,
  DeleteMediaGroup,
  SetTimelineUnit,
  SetTimelineMaxValue,
  SetInputsToRender,
  SetTopology,
  SetPendingLightSourceCapture,
}

export type CoreAction =
  | { type: CoreActionType.SetCoreState; value: CoreState }
  | { type: CoreActionType.SetProject; value: LaurusProjectResult; preserveCache?: boolean }
  | { type: CoreActionType.SetCanvasImg; key: string; value: LaurusImgResult }
  | { type: CoreActionType.DeleteCanvasImg; key: string }
  | { type: CoreActionType.SetCanvasImgs; value: Map<string, LaurusImgResult> }
  | { type: CoreActionType.SetCanvasSvg; key: string; value: LaurusSvgResult }
  | { type: CoreActionType.DeleteCanvasSvg; key: string }
  | { type: CoreActionType.SetCanvasSvgs; value: Map<string, LaurusSvgResult> }
  | { type: CoreActionType.SetCanvasMask; key: string; value: LaurusMaskResult }
  | { type: CoreActionType.DeleteCanvasMask; key: string }
  | { type: CoreActionType.SetCanvasMasks; value: Map<string, LaurusMaskResult> }
  | { type: CoreActionType.DeleteProjectImg; key: string }
  | { type: CoreActionType.DeleteProjectSvg; key: string }
  | { type: CoreActionType.DeleteProjectMask; key: string }
  | {
      type: CoreActionType.SetEffects;
      value: LaurusEffect[];
      preserveCache?: boolean;
    }
  | { type: CoreActionType.SetEffect; value: LaurusEffect; preserveCache?: boolean }
  | { type: CoreActionType.DeleteEffect; key: string }
  | { type: CoreActionType.SetEffectGroup; value: LaurusEffectGroupResult; preserveCache?: boolean }
  | { type: CoreActionType.DeleteEffectGroup; key: string }
  | { type: CoreActionType.SetMediaGroup; value: LaurusMediaGroupResult; preserveCache?: boolean }
  | { type: CoreActionType.DeleteMediaGroup; key: string }
  | { type: CoreActionType.SetTimelineUnit; value: string }
  | { type: CoreActionType.SetTimelineMaxValue; value: number }
  | { type: CoreActionType.SetInputsToRender; value: Set<string> }
  | { type: CoreActionType.SetTopology; key: string; value: Topology }
  | { type: CoreActionType.SetPendingLightSourceCapture; value: PendingLightSourceCapture | undefined };

export function coreContextReducer(state: CoreState, action: CoreAction): CoreState {
  switch (action.type) {
    case CoreActionType.SetCoreState: {
      return {
        ...action.value,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetProject: {
      return {
        ...state,
        project: { ...action.value },
        inputsToRender: action.preserveCache === false ? new Set<string>(["*"]) : new Set(state.inputsToRender),
      };
    }
    case CoreActionType.SetCanvasImg: {
      const newImgs = new Map(state.canvasImgs);
      newImgs.set(action.key, action.value);
      return {
        ...state,
        canvasImgs: newImgs,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.DeleteCanvasImg: {
      const newImgs = new Map(state.canvasImgs);
      newImgs.delete(action.key);
      return {
        ...state,
        canvasImgs: newImgs,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetCanvasImgs: {
      return {
        ...state,
        canvasImgs: new Map(action.value),
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetCanvasSvg: {
      const newSvgs = new Map(state.canvasSvgs);
      newSvgs.set(action.key, action.value);
      return {
        ...state,
        canvasSvgs: newSvgs,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.DeleteCanvasSvg: {
      const newSvgs = new Map(state.canvasSvgs);
      newSvgs.delete(action.key);
      return {
        ...state,
        canvasSvgs: newSvgs,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetCanvasSvgs: {
      return {
        ...state,
        canvasSvgs: new Map(action.value),
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetCanvasMask: {
      const newMasks = new Map(state.canvasMasks);
      newMasks.set(action.key, action.value);
      return {
        ...state,
        canvasMasks: newMasks,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.DeleteCanvasMask: {
      const newMasks = new Map(state.canvasMasks);
      newMasks.delete(action.key);
      return {
        ...state,
        canvasMasks: newMasks,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetCanvasMasks: {
      return {
        ...state,
        canvasMasks: new Map(action.value),
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.DeleteProjectMask: {
      const newMasks = new Map(state.project.masks);
      newMasks.delete(action.key);
      const newProject: LaurusProjectResult = {
        ...state.project,
        masks: newMasks,
      };
      return {
        ...state,
        project: newProject,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.DeleteProjectImg: {
      const newImgs = new Map(state.project.imgs);
      newImgs.delete(action.key);
      const newProject: LaurusProjectResult = {
        ...state.project,
        imgs: newImgs,
      };
      return {
        ...state,
        project: newProject,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.DeleteProjectSvg: {
      const newSvgs = new Map(state.project.svgs);
      newSvgs.delete(action.key);
      const newProject: LaurusProjectResult = {
        ...state.project,
        svgs: newSvgs,
      };
      return {
        ...state,
        project: newProject,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetEffects: {
      const newCacheNeedsRefreshInputs = action.preserveCache ? new Set(state.inputsToRender) : new Set<string>(["*"]);
      return {
        ...state,
        effects: [...action.value],
        inputsToRender: newCacheNeedsRefreshInputs,
      };
    }
    case CoreActionType.SetEffect: {
      const currentEffects = [...state.effects];
      const newEffects = currentEffects.map((e) => (e.key == action.value.key ? { ...action.value } : e));
      if (action.preserveCache) {
        return {
          ...state,
          effects: newEffects,
          inputsToRender: new Set(state.inputsToRender),
        };
      }

      const currentEffect = currentEffects.find((e) => e.key == action.value.key);
      const newInputsToRender: Set<string> = new Set<string>();
      if (currentEffect) {
        currentEffect.value.math.forEach((_, k) => newInputsToRender.add(k));
      }
      action.value.value.math.forEach((_, inputKey) => newInputsToRender.add(inputKey));
      return {
        ...state,
        effects: newEffects,
        inputsToRender: newInputsToRender.size === 0 ? new Set<string>(["*"]) : newInputsToRender,
      };
    }
    case CoreActionType.DeleteEffect: {
      const newEffects = state.effects.filter((e) => e.key != action.key);
      return {
        ...state,
        effects: newEffects,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetEffectGroup: {
      const newEffectGroups = new Map(state.effectGroups);
      newEffectGroups.set(action.value.effect_group_id, action.value);
      const newCacheNeedsRefreshInputs = action.preserveCache ? new Set(state.inputsToRender) : new Set<string>(["*"]);
      return {
        ...state,
        effectGroups: newEffectGroups,
        inputsToRender: newCacheNeedsRefreshInputs,
      };
    }
    case CoreActionType.DeleteEffectGroup: {
      const newEffectGroups = new Map(state.effectGroups);
      newEffectGroups.delete(action.key);
      return {
        ...state,
        effectGroups: newEffectGroups,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetMediaGroup: {
      const newMediaGroups = new Map(state.mediaGroups);
      newMediaGroups.set(action.value.media_group_id, action.value);
      const newCacheNeedsRefreshInputs = action.preserveCache ? new Set(state.inputsToRender) : new Set<string>(["*"]);
      return {
        ...state,
        mediaGroups: newMediaGroups,
        inputsToRender: newCacheNeedsRefreshInputs,
      };
    }
    case CoreActionType.DeleteMediaGroup: {
      const newMediaGroups = new Map(state.mediaGroups);
      newMediaGroups.delete(action.key);
      return {
        ...state,
        mediaGroups: newMediaGroups,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetTimelineUnit: {
      return {
        ...state,
        timelineUnit: action.value,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetTimelineMaxValue: {
      return {
        ...state,
        timelineMaxValue: action.value,
        inputsToRender: new Set<string>(["*"]),
      };
    }
    case CoreActionType.SetInputsToRender: {
      return {
        ...state,
        inputsToRender: action.value,
      };
    }
    // Drives WebGL preview-only mesh state (Maskbar's texture slider) that fires continuously on
    // every mousemove/drag tick. Unlike every other case above, it deliberately leaves
    // inputsToRender untouched (via the ...state spread) instead of invalidating to "*" -- this
    // value never reaches the server or the exported/persisted frames, so there's nothing for the
    // frame cache to need re-fetching over.
    case CoreActionType.SetTopology: {
      const newTopology = new Map(state.topology);
      newTopology.set(action.key, action.value);
      return { ...state, topology: newTopology };
    }
    case CoreActionType.SetPendingLightSourceCapture: {
      return { ...state, pendingLightSourceCapture: action.value };
    }
  }
}
