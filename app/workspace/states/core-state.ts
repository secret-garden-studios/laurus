import { LaurusProjectResult } from "../../projects/projects.server";
import { LaurusEffect, LaurusEffectGroupResult, LaurusImgResult, LaurusSvgResult } from "../workspace.server";
import { defaultProject } from "@/app/projects/states/core-state";

export interface CoreState {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  project: LaurusProjectResult;
  canvasImgs: Map<string, LaurusImgResult>;
  canvasSvgs: Map<string, LaurusSvgResult>;
  effects: LaurusEffect[];
  effectGroups: Map<string, LaurusEffectGroupResult>;
  timelineUnit: string;
  timelineMaxValue: number;
  fps: number;
  cacheNeedsRefresh: boolean;
  cacheNeedsRefreshInputs: Set<string>;
}

export const defaultCoreState: CoreState = {
  apiOrigin: undefined,
  accessToken: undefined,
  project: defaultProject,
  canvasImgs: new Map(),
  canvasSvgs: new Map(),
  effects: [],
  effectGroups: new Map(),
  timelineUnit: "",
  timelineMaxValue: 0,
  fps: 60,
  cacheNeedsRefresh: true,
  cacheNeedsRefreshInputs: new Set<string>(),
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
  SetProjectImg,
  SetProjectSvg,
  DeleteProjectImg,
  DeleteProjectSvg,
  SetLightFrameBackground,
  SetEffects,
  SetEffect,
  DeleteEffect,
  SetEffectGroup,
  DeleteEffectGroup,
  SetTimelineUnit,
  SetTimelineMaxValue,
  SetFps,
  SetCacheNeedsRefresh,
  SetCacheNeedsRefreshInputs,
}

export type CoreAction =
  | { type: CoreActionType.SetCoreState; value: CoreState }
  | { type: CoreActionType.SetProject; value: LaurusProjectResult }
  | { type: CoreActionType.SetCanvasImg; key: string; value: LaurusImgResult }
  | { type: CoreActionType.DeleteCanvasImg; key: string }
  | { type: CoreActionType.SetCanvasImgs; value: Map<string, LaurusImgResult> }
  | { type: CoreActionType.SetCanvasSvg; key: string; value: LaurusSvgResult }
  | { type: CoreActionType.DeleteCanvasSvg; key: string }
  | { type: CoreActionType.SetCanvasSvgs; value: Map<string, LaurusSvgResult> }
  | { type: CoreActionType.DeleteProjectImg; key: string }
  | { type: CoreActionType.DeleteProjectSvg; key: string }
  | {
      type: CoreActionType.SetEffects;
      value: LaurusEffect[];
      preserveCache?: boolean;
    }
  | { type: CoreActionType.SetEffect; value: LaurusEffect }
  | { type: CoreActionType.DeleteEffect; key: string }
  | { type: CoreActionType.SetEffectGroup; value: LaurusEffectGroupResult }
  | { type: CoreActionType.DeleteEffectGroup; key: string }
  | { type: CoreActionType.SetTimelineUnit; value: string }
  | { type: CoreActionType.SetTimelineMaxValue; value: number }
  | { type: CoreActionType.SetFps; value: number }
  | { type: CoreActionType.SetCacheNeedsRefresh; value: boolean }
  | { type: CoreActionType.SetCacheNeedsRefreshInputs; value: Set<string> };

export function coreContextReducer(state: CoreState, action: CoreAction): CoreState {
  switch (action.type) {
    case CoreActionType.SetCoreState: {
      return {
        ...action.value,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetProject: {
      return {
        ...state,
        project: { ...action.value },
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetCanvasImg: {
      const newImgs = new Map(state.canvasImgs);
      newImgs.set(action.key, action.value);
      return {
        ...state,
        canvasImgs: newImgs,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.DeleteCanvasImg: {
      const newImgs = new Map(state.canvasImgs);
      newImgs.delete(action.key);
      return {
        ...state,
        canvasImgs: newImgs,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetCanvasImgs: {
      return {
        ...state,
        canvasImgs: new Map(action.value),
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetCanvasSvg: {
      const newSvgs = new Map(state.canvasSvgs);
      newSvgs.set(action.key, action.value);
      return {
        ...state,
        canvasSvgs: newSvgs,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.DeleteCanvasSvg: {
      const newSvgs = new Map(state.canvasSvgs);
      newSvgs.delete(action.key);
      return {
        ...state,
        canvasSvgs: newSvgs,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetCanvasSvgs: {
      return {
        ...state,
        canvasSvgs: new Map(action.value),
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
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
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
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
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetEffects: {
      const newCacheNeedsRefresh = action.preserveCache ? state.cacheNeedsRefresh : true;
      return {
        ...state,
        effects: [...action.value],
        cacheNeedsRefresh: newCacheNeedsRefresh,
        cacheNeedsRefreshInputs: action.preserveCache ? new Set(state.cacheNeedsRefreshInputs) : new Set<string>(),
      };
    }
    case CoreActionType.SetEffect: {
      const currentEffects = [...state.effects];
      const currentEffect = currentEffects.find((e) => e.key == action.value.key);
      const newCacheNeedsRefreshInputs: Set<string> = currentEffect
        ? new Set(currentEffect.value.math.keys())
        : new Set();
      action.value.value.math.forEach((_, inputKey) => newCacheNeedsRefreshInputs.add(inputKey));
      const newEffects = currentEffects.map((e) => (e.key == action.value.key ? { ...action.value } : e));
      return {
        ...state,
        effects: newEffects,
        cacheNeedsRefreshInputs: newCacheNeedsRefreshInputs,
      };
    }
    case CoreActionType.DeleteEffect: {
      const newEffects = state.effects.filter((e) => e.key != action.key);
      return {
        ...state,
        effects: newEffects,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetEffectGroup: {
      const newEffectGroups = new Map(state.effectGroups);
      newEffectGroups.set(action.value.effect_group_id, action.value);
      return {
        ...state,
        effectGroups: newEffectGroups,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.DeleteEffectGroup: {
      const newEffectGroups = new Map(state.effectGroups);
      newEffectGroups.delete(action.key);
      return {
        ...state,
        effectGroups: newEffectGroups,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetTimelineUnit: {
      return {
        ...state,
        timelineUnit: action.value,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetTimelineMaxValue: {
      return {
        ...state,
        timelineMaxValue: action.value,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetFps: {
      return {
        ...state,
        fps: action.value,
        cacheNeedsRefresh: true,
        cacheNeedsRefreshInputs: new Set<string>(),
      };
    }
    case CoreActionType.SetCacheNeedsRefresh: {
      return { ...state, cacheNeedsRefresh: action.value };
    }
    case CoreActionType.SetCacheNeedsRefreshInputs: {
      return {
        ...state,
        cacheNeedsRefreshInputs: action.value,
      };
    }
  }
}
