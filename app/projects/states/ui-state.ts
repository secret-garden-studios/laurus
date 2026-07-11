import { ProjectsResolution } from "../projects-resolution";

export type ProjectsTool = { type: "none" } | { type: "create" } | { type: "pin" } | { type: "sort" };

export type SortValue =
  | "last_active_123"
  | "last_active_321"
  | "timestamp_123"
  | "timestamp_321"
  | "name_az"
  | "name_za"
  | "editor_az"
  | "editor_za"
  | "creator_az"
  | "creator_za"
  | "none";

export interface SelectOption {
  value: SortValue;
  label: string;
}

export const sortOptions: SelectOption[] = [
  { value: "none", label: "" },
  { value: "last_active_123", label: "date edited (oldest first)" },
  { value: "last_active_321", label: "date edited (newest first)" },
  { value: "name_az", label: "title A to Z" },
  { value: "name_za", label: "title Z to A" },
  { value: "creator_az", label: "creator A to Z" },
  { value: "creator_za", label: "creator Z to A" },
  { value: "timestamp_123", label: "date created (oldest first)" },
  { value: "timestamp_321", label: "date created (newest first)" },
  { value: "editor_az", label: "editor A to Z" },
  { value: "editor_za", label: "editor Z to A" },
];

export const defaultSortValue: SortValue = "last_active_321";

export function parseSortValue(
  inputString: string | null | undefined,
  fallback: SortValue = defaultSortValue,
): SortValue {
  if (!inputString) {
    return fallback;
  }
  const matchExists = sortOptions.some((option) => option.value === inputString);
  return matchExists ? (inputString as SortValue) : fallback;
}

export interface UIState {
  tool: ProjectsTool;
  resolution: ProjectsResolution;
  sort: SortValue;
}

export const defaultUIState: UIState = {
  tool: { type: "none" },
  resolution: { type: "midhigh", value: { width: 0, height: 0 } },
  sort: defaultSortValue,
};

export enum UIActionType {
  SetTool,
  SetSort,
}

export type UIAction =
  { type: UIActionType.SetTool; value: ProjectsTool } | { type: UIActionType.SetSort; value: SortValue };

export function uiContextReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case UIActionType.SetTool: {
      return { ...state, tool: { ...action.value } };
    }
    case UIActionType.SetSort: {
      return { ...state, sort: action.value };
    }
  }
}
