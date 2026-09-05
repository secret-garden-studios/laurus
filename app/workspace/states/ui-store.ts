"use client";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { defaultUIState, uiContextReducer, type UIAction, type UIState } from "./ui-state";

export interface UIStore {
  getState: () => UIState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: UIAction) => void;
}

export function createUIStore(initial: UIState): UIStore {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action) => {
      const next = uiContextReducer(state, action);
      if (next === state) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}

const fallbackStore: UIStore = {
  getState: () => defaultUIState,
  subscribe: () => () => {},
  dispatch: () => {},
};

export const UIStoreContext = createContext<UIStore>(fallbackStore);

function useUISlice<T>(select: (state: UIState) => T): T {
  const store = useContext(UIStoreContext);
  const snapshot = useCallback(() => select(store.getState()), [store, select]);
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useUIDispatch(): (action: UIAction) => void {
  return useContext(UIStoreContext).dispatch;
}

const selectTool = (state: UIState) => state.tool;
const selectBrowserElement = (state: UIState) => state.browserElement;
const selectBrowserImgs = (state: UIState) => state.browserImgs;
const selectBrowserSvgs = (state: UIState) => state.browserSvgs;
const selectMaskEdit = (state: UIState) => state.maskEdit;
const selectResolution = (state: UIState) => state.resolution;
const selectFilledForwards = (state: UIState) => state.filledForwards;
const selectProjectContextMenus = (state: UIState) => state.projectContextMenus;
const selectCanvasZoom = (state: UIState) => state.canvasZoom;

export const useUITool = () => useUISlice(selectTool);
export const useUIBrowserElement = () => useUISlice(selectBrowserElement);
export const useUIBrowserImgs = () => useUISlice(selectBrowserImgs);
export const useUIBrowserSvgs = () => useUISlice(selectBrowserSvgs);
export const useUIMaskEdit = () => useUISlice(selectMaskEdit);
export const useUIResolution = () => useUISlice(selectResolution);
export const useUIFilledForwards = () => useUISlice(selectFilledForwards);
export const useUICanvasZoom = () => useUISlice(selectCanvasZoom);

export function useUIContextMenuOpen(mediaKey: string): boolean {
  const store = useContext(UIStoreContext);
  const snapshot = useCallback(
    () => store.getState().projectContextMenus.get(mediaKey)?.showContextMenu ?? false,
    [store, mediaKey],
  );
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useUIProjectContextMenus() {
  return useUISlice(selectProjectContextMenus);
}
