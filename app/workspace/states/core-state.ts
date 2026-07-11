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
  | { type: CoreActionType.SetCacheNeedsRefresh; value: boolean };

export function coreContextReducer(state: CoreState, action: CoreAction): CoreState {
  switch (action.type) {
    case CoreActionType.SetCoreState: {
      return { ...action.value, cacheNeedsRefresh: true };
    }
    case CoreActionType.SetProject: {
      return {
        ...state,
        project: { ...action.value },
        cacheNeedsRefresh: true,
      };
    }
    case CoreActionType.SetCanvasImg: {
      const newImgs = new Map(state.canvasImgs);
      newImgs.set(action.key, action.value);
      return { ...state, canvasImgs: newImgs, cacheNeedsRefresh: true };
    }
    case CoreActionType.DeleteCanvasImg: {
      const newImgs = new Map(state.canvasImgs);
      newImgs.delete(action.key);
      return { ...state, canvasImgs: newImgs, cacheNeedsRefresh: true };
    }
    case CoreActionType.SetCanvasImgs: {
      return {
        ...state,
        canvasImgs: new Map(action.value),
        cacheNeedsRefresh: true,
      };
    }
    case CoreActionType.SetCanvasSvg: {
      const newSvgs = new Map(state.canvasSvgs);
      newSvgs.set(action.key, action.value);
      return { ...state, canvasSvgs: newSvgs, cacheNeedsRefresh: true };
    }
    case CoreActionType.DeleteCanvasSvg: {
      const newSvgs = new Map(state.canvasSvgs);
      newSvgs.delete(action.key);
      return { ...state, canvasSvgs: newSvgs, cacheNeedsRefresh: true };
    }
    case CoreActionType.SetCanvasSvgs: {
      return {
        ...state,
        canvasSvgs: new Map(action.value),
        cacheNeedsRefresh: true,
      };
    }
    case CoreActionType.DeleteProjectImg: {
      const newImgs = new Map(state.project.imgs);
      newImgs.delete(action.key);
      const newProject: LaurusProjectResult = {
        ...state.project,
        imgs: newImgs,
      };
      return { ...state, project: newProject, cacheNeedsRefresh: true };
    }
    case CoreActionType.DeleteProjectSvg: {
      const newSvgs = new Map(state.project.svgs);
      newSvgs.delete(action.key);
      const newProject: LaurusProjectResult = {
        ...state.project,
        svgs: newSvgs,
      };
      return { ...state, project: newProject, cacheNeedsRefresh: true };
    }
    case CoreActionType.SetEffects: {
      const newCacheNeedsRefresh = action.preserveCache ? state.cacheNeedsRefresh : true;
      return {
        ...state,
        effects: [...action.value],
        cacheNeedsRefresh: newCacheNeedsRefresh,
      };
    }
    case CoreActionType.SetEffect: {
      return {
        ...state,
        effects: state.effects.map((e) => (e.key == action.value.key ? { ...action.value } : e)),
        cacheNeedsRefresh: true,
      };
    }
    case CoreActionType.DeleteEffect: {
      const newEffects = state.effects.filter((e) => e.key != action.key);
      return { ...state, effects: newEffects, cacheNeedsRefresh: true };
    }
    case CoreActionType.SetEffectGroup: {
      const newEffectGroups = new Map(state.effectGroups);
      newEffectGroups.set(action.value.effect_group_id, action.value);
      return {
        ...state,
        effectGroups: newEffectGroups,
        cacheNeedsRefresh: true,
      };
    }
    case CoreActionType.DeleteEffectGroup: {
      const newEffectGroups = new Map(state.effectGroups);
      newEffectGroups.delete(action.key);
      return {
        ...state,
        effectGroups: newEffectGroups,
        cacheNeedsRefresh: true,
      };
    }
    case CoreActionType.SetTimelineUnit: {
      return { ...state, timelineUnit: action.value, cacheNeedsRefresh: true };
    }
    case CoreActionType.SetTimelineMaxValue: {
      return {
        ...state,
        timelineMaxValue: action.value,
        cacheNeedsRefresh: true,
      };
    }
    case CoreActionType.SetFps: {
      return { ...state, fps: action.value, cacheNeedsRefresh: true };
    }
    case CoreActionType.SetCacheNeedsRefresh: {
      return { ...state, cacheNeedsRefresh: action.value };
    }
  }
}
