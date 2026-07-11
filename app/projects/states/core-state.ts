import { RESOLUTION } from "@/app/landing.config";
import { LaurusPinResult, LaurusProjectResult } from "../projects.server";

export const defaultProject: LaurusProjectResult = {
  name: "untitled",
  canvas_width: RESOLUTION.NEW_PROJECT_CANVAS_SIZE,
  canvas_height: RESOLUTION.NEW_PROJECT_CANVAS_SIZE,
  frame_top: -1,
  frame_left: -1,
  frame_width: RESOLUTION.FRAME_WIDTH_4_5,
  frame_height: RESOLUTION.FRAME_HEIGHT_4_5,
  imgs: new Map(),
  svgs: new Map(),
  frame_rotate_x: 0,
  frame_rotate_y: 0,
  frame_rotate_z: 0,
  frame_rotate_angle: 0,
  frame_scale_x: 1,
  frame_scale_y: 1,
  browse_public_imgs: false,
  browse_public_svgs: false,
  project_id: "",
  timestamp: "",
  last_active: "",
  creator: "",
  last_editor: "",
};

export interface CoreState {
  apiOrigin: string | undefined;
  accessToken: string | undefined;
  projects: LaurusProjectResult[];
  effectsMetadata: Map<string, number>;
  pinsByProject: Map<string, LaurusPinResult>;
  filteredProjectIds: string[];
}

export const defaultCoreState: CoreState = {
  projects: [],
  effectsMetadata: new Map(),
  apiOrigin: undefined,
  accessToken: undefined,
  pinsByProject: new Map(),
  filteredProjectIds: [],
};

export enum CoreActionType {
  SetProjects,
  SetEffectsMetadata,
  SetPinByProject,
  DeletePinByProject,
  SetFilteredProjectIds,
}

export type CoreAction =
  | { type: CoreActionType.SetProjects; value: LaurusProjectResult[] }
  | { type: CoreActionType.SetEffectsMetadata; value: Map<string, number> }
  | { type: CoreActionType.SetPinByProject; value: LaurusPinResult }
  | { type: CoreActionType.DeletePinByProject; projectId: string }
  | { type: CoreActionType.SetFilteredProjectIds; value: string[] };

export function coreContextReducer(state: CoreState, action: CoreAction): CoreState {
  switch (action.type) {
    case CoreActionType.SetProjects: {
      return { ...state, projects: action.value };
    }
    case CoreActionType.SetEffectsMetadata: {
      return { ...state, effectsMetadata: action.value };
    }
    case CoreActionType.SetPinByProject: {
      const newPins = new Map(state.pinsByProject);
      newPins.set(action.value.project_id, action.value);
      return { ...state, pinsByProject: newPins };
    }
    case CoreActionType.DeletePinByProject: {
      const newPins = new Map(state.pinsByProject);
      newPins.delete(action.projectId);
      return { ...state, pinsByProject: newPins };
    }
    case CoreActionType.SetFilteredProjectIds: {
      return { ...state, filteredProjectIds: action.value };
    }
  }
}
