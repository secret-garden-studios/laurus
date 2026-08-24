import { LaurusProjectResult } from "../../projects/projects.server";
import {
  LaurusEffect,
  LaurusEffectGroupResult,
  LaurusImgResult,
  LaurusMediaGroupResult,
  LaurusSvgResult,
  LaurusMaskResult,
  LaurusObjectBlackPoint,
  LaurusObjectReview,
} from "../workspace.server";
import { defaultProject } from "@/app/projects/states/core-state";
import {
  CAPTURE_DARKNESS_DEFAULT,
  CAPTURE_FALLOFF_CSS_PX_DEFAULT,
  CAPTURE_INTENSITY_DEFAULT,
  CAPTURE_SIZE_CSS_PX_DEFAULT,
} from "../mask-gl";

export interface CaptureValue {
  size: number;
  intensity: number;
  falloff: number;
  darkness: number;
}

export const DEFAULT_CAPTURE_VALUE: CaptureValue = {
  size: CAPTURE_SIZE_CSS_PX_DEFAULT,
  intensity: CAPTURE_INTENSITY_DEFAULT,
  falloff: CAPTURE_FALLOFF_CSS_PX_DEFAULT,
  darkness: CAPTURE_DARKNESS_DEFAULT,
};

export interface PendingLightSourceCapture {
  maskKey: string;
  captureId: number;
  polygonIndices: number[];
}

export interface PendingTopologyEdit {
  maskKey: string;
  objectId: number;
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  shape: string;
  blackPoint: LaurusObjectBlackPoint;
  polygonIndices?: Set<number>;
  /**
   * Set while a gesture is still in flight, so the renderer can rasterize the
   * shape at draft resolution. A drag mints a new path every frame and every
   * frame is a cache miss, which at full resolution is ~58ms of rebuild before
   * anything is drawn (see cachedObjectShape).
   */
  draft?: boolean;
}

export interface CoreState {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  project: LaurusProjectResult;
  canvasImgs: Map<string, LaurusImgResult>;
  canvasSvgs: Map<string, LaurusSvgResult>;
  canvasMasks: Map<string, LaurusMaskResult>;
  objectReviews: Map<string, LaurusObjectReview>;
  effects: LaurusEffect[];
  effectGroups: Map<string, LaurusEffectGroupResult>;
  mediaGroups: Map<string, LaurusMediaGroupResult>;
  timelineUnit: string;
  timelineMaxValue: number;
  inputsToRender: Set<string>;
  pendingLightSourceCapture: PendingLightSourceCapture | undefined;
  pendingTopologyEdit: PendingTopologyEdit | undefined;
}

export const defaultCoreState: CoreState = {
  apiOrigin: undefined,
  accessToken: undefined,
  project: defaultProject,
  canvasImgs: new Map(),
  canvasSvgs: new Map(),
  canvasMasks: new Map(),
  objectReviews: new Map(),
  effects: [],
  effectGroups: new Map(),
  mediaGroups: new Map(),
  timelineUnit: "",
  timelineMaxValue: 0,
  inputsToRender: new Set<string>(),
  pendingLightSourceCapture: undefined,
  pendingTopologyEdit: undefined,
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
  SetObjectReview,
  SetObjectReviews,
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
  SetPendingLightSourceCapture,
  SetPendingTopologyEdit,
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
  | { type: CoreActionType.SetObjectReview; maskMediaId: string; value: LaurusObjectReview }
  | { type: CoreActionType.SetObjectReviews; value: Map<string, LaurusObjectReview> }
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
  | { type: CoreActionType.SetPendingLightSourceCapture; value: PendingLightSourceCapture | undefined }
  | { type: CoreActionType.SetPendingTopologyEdit; value: PendingTopologyEdit | undefined };

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
    case CoreActionType.SetObjectReview: {
      const newObjectReviews = new Map(state.objectReviews);
      newObjectReviews.set(action.maskMediaId, action.value);
      return { ...state, objectReviews: newObjectReviews };
    }
    case CoreActionType.SetObjectReviews: {
      return { ...state, objectReviews: new Map(action.value) };
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
    case CoreActionType.SetPendingLightSourceCapture: {
      return { ...state, pendingLightSourceCapture: action.value };
    }
    case CoreActionType.SetPendingTopologyEdit: {
      return { ...state, pendingTopologyEdit: action.value };
    }
  }
}
