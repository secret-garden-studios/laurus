import {
  useContext,
  useMemo,
  useCallback,
  CSSProperties,
  useState,
  Dispatch,
  useEffect,
  useRef,
  RefObject,
} from "react";
import {
  updateProject,
  LaurusProjectImg,
  LaurusProjectSvg,
  LaurusProjectMask,
  LaurusProjectResult,
  DEFAULT_CONTEXT_MENU_CONFIG,
} from "../projects/projects.server";
import {
  CoreContext,
  HoverContext,
  LaurusTransform,
  MaskContext,
  SocketContext,
  UIContext,
  getMaskSourceImgIds,
} from "./workspace.client";
import {
  LightUpdateDelta_V1_0,
  LaurusFrame,
  LaurusImgResult,
  LaurusMaskResult,
  LaurusObjectReview,
  LaurusSvgResult,
  deleteMask,
  getObjectReview,
  maskLabel,
  newLight,
  toLightUpdate,
  toObjectUpdate,
  updateMaskDescription,
  POLYGONS_UNCHANGED,
} from "./workspace.server";
import { applyLightDelta, applyObjectDelta } from "./canvas-media/mask-delta";
import { polygonIndicesForLight, polygonIndicesForObject } from "./canvas-media/mask-geometry";
import type { StackDirection, StackRef } from "./canvas-media/mask-order";
import styles from "../app.module.css";
import { SvgRepo, polyline200, texture300, image200, antigravity300, asterisk300 } from "../svg-repo";
import Toggle from "../components/toggle";
import {
  LaurusActiveElement,
  LaurusBrowserElement,
  LaurusThumbnail,
  ObjectReviewSession,
  UIAction,
  UIActionType,
  defaultUIState,
  isMaskDropZoneArmed,
  isMaskEditSubject,
  resumeObjectReview,
} from "./states/ui-state";
import { CoreAction, CoreActionType } from "./states/core-state";
import { UNAUTHORIZED_EDIT } from "../landing.server";
import { deleteEffects, deleteMaskLightEffects } from "./effects-utils";

function cleanUpCanvasMedia(mediaType: "img" | "svg" | "mask", mediaKey: string, dispatch: Dispatch<CoreAction>) {
  switch (mediaType) {
    case "img": {
      dispatch({ type: CoreActionType.DeleteCanvasImg, key: mediaKey });
      break;
    }
    case "svg": {
      dispatch({ type: CoreActionType.DeleteCanvasSvg, key: mediaKey });
      break;
    }
    case "mask": {
      dispatch({ type: CoreActionType.DeleteCanvasMask, key: mediaKey });
      break;
    }
  }
}

function cleanUpMediaBrowser(
  mediaType: "img" | "svg" | "mask",
  mediaId: string,
  project: LaurusProjectResult,
  canvasMasks: Map<string, LaurusMaskResult>,
  uiDispatch: Dispatch<UIAction>,
) {
  switch (mediaType) {
    case "img": {
      const stillExists = Array.from(project.imgs.values()).some((i) => i.img_media_id === mediaId);
      const stillNeededForMask = getMaskSourceImgIds(project.masks, canvasMasks).has(mediaId);
      if (!project.browse_public_imgs && !stillExists && !stillNeededForMask) {
        uiDispatch({ type: UIActionType.DeleteBrowserImg, value: mediaId });
      }
      break;
    }
    case "svg": {
      const stillExists = Array.from(project.svgs.values()).some((s) => s.svg_media_id === mediaId);
      if (!project.browse_public_svgs && !stillExists) {
        uiDispatch({ type: UIActionType.DeleteBrowserSvg, value: mediaId });
      }
      break;
    }
    case "mask": {
      break;
    }
  }
}

function cleanUpBrowserElement(
  mediaId: string,
  browserElement: LaurusThumbnail,
  project: LaurusProjectResult,
  uiDispatch: Dispatch<UIAction>,
) {
  switch (browserElement.type) {
    case "img": {
      const stillExists = Array.from(project.imgs.values()).some((i) => i.img_media_id === mediaId);
      if (browserElement.value.img_media_id == mediaId && !project.browse_public_imgs && !stillExists) {
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: defaultUIState.browserElement == undefined ? undefined : { ...defaultUIState.browserElement },
        });
      }
      break;
    }
    case "svg": {
      const stillExists = Array.from(project.svgs.values()).some((s) => s.svg_media_id === mediaId);
      if (browserElement.value.svg_media_id == mediaId && !project.browse_public_svgs && !stillExists) {
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: defaultUIState.browserElement == undefined ? undefined : { ...defaultUIState.browserElement },
        });
      }
      break;
    }
  }
}

const MOVE_UP_TITLE = {
  object: "move this object forward in its mask -- alt to put it in front of everything",
  light: "move this light forward in its mask -- alt to put it in front of everything",
};
const MOVE_DOWN_TITLE = {
  object: "move this object back in its mask -- past the mask itself, it renders behind it",
  light: "move this light back in its mask -- past the mask itself, it only reaches the mask's gaps",
};

function projectSvgIsTransformed(svg: LaurusProjectSvg) {
  if (
    svg.scale_x == 1 &&
    svg.scale_y == 1 &&
    svg.rotate_x == 0 &&
    svg.rotate_y == 0 &&
    svg.rotate_z == 0 &&
    svg.skew_ax == 0 &&
    svg.skew_ay == 0
  ) {
    return false;
  } else {
    return true;
  }
}

function projectImgIsTransformed(img: LaurusProjectImg) {
  if (
    img.scale_x == 1 &&
    img.scale_y == 1 &&
    img.rotate_x == 0 &&
    img.rotate_y == 0 &&
    img.rotate_z == 0 &&
    img.skew_ax == 0 &&
    img.skew_ay == 0
  ) {
    return false;
  } else {
    return true;
  }
}

function projectMaskIsTransformed(mask: LaurusProjectMask) {
  if (
    mask.scale_x == 1 &&
    mask.scale_y == 1 &&
    mask.rotate_x == 0 &&
    mask.rotate_y == 0 &&
    mask.rotate_z == 0 &&
    mask.skew_ax == 0 &&
    mask.skew_ay == 0
  ) {
    return false;
  } else {
    return true;
  }
}

export type ContextMenuMedia =
  | { type: "img"; key: string; meta: LaurusProjectImg }
  | { type: "svg"; key: string; meta: LaurusProjectSvg }
  | { type: "mask"; key: string; meta: LaurusProjectMask }
  | { type: "light"; key: string; lightId: number; meta: LaurusProjectMask }
  | { type: "object"; key: string; objectId: number; meta: LaurusProjectMask };
type PendingObjectReview = {
  state: LaurusObjectReview;
  decisions: Map<number, "accepted" | "rejected">;
  resumed: ObjectReviewSession;
};
interface ContextMenu {
  media: ContextMenuMedia;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
  transform?: LaurusTransform;
}
export default function ContextMenu({ media, framesCacheRef, transform }: ContextMenu) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { sendMaskLightUpdate, sendMaskObjectUpdate, closeMaskLightSocket, closeMaskObjectSocket } =
    useContext(SocketContext);
  const {
    notifyMaskSelectionChanged,
    notifyMaskSelectedLightChanged,
    notifyMaskSelectedObjectChanged,
    notifyMaskLightUpdated,
    notifyMaskObjectsUpdated,
    notifyMaskObjectReviewPreview,
    deleteObject,
    reorderElement,
  } = useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed, isMetaKeyPressed, setSelectedImgKeys, setSelectedSvgKeys, setSelectedMaskKeys } =
    useContext(HoverContext);
  const contextMenuState = uiState.projectContextMenus.get(media.key);
  const contextMenuConfig = contextMenuState?.contextMenuConfig ?? DEFAULT_CONTEXT_MENU_CONFIG;
  const dropZoneArmed = isMaskDropZoneArmed(uiState, { meta: isMetaKeyPressed, alt: isAltKeyPressed });
  const active = useMemo<boolean>(() => {
    if (uiState.activeElement?.key !== media.key) return false;
    if (media.type === "light") {
      return uiState.activeElement.type === "light" && uiState.activeElement.lightId === media.lightId;
    }
    if (media.type === "object") {
      return uiState.activeElement.type === "object" && uiState.activeElement.objectId === media.objectId;
    }
    return true;
  }, [uiState.activeElement, media]);
  const [isAltPressed, setIsAltPressed] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => setIsAltPressed(e.altKey);
    const handleBlur = () => setIsAltPressed(false);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          contextMenu: {
            widthFactor: 1,
            heightFactor: 1,
          },
          gridIsLeftPadding: "0px 8px 0px 0px",
          gridPadding: "0px 0px 0px 8px",
          innerClipPath: {
            width: 8,
            height: 6,
            radius: 8,
            triangleRadius: 0,
            caretS: 10,
            caretHeight: 24,
          },
          clipPath: {
            width: 0,
            height: 0,
            radius: 8,
            triangleRadius: 0,
            caretS: 12,
            caretHeight: 30,
          },
          clipPathDiv: {
            top: 3,
            fontSize: 12,
            gap: 12,
            letterSpacing: 2,
          },
          clipPathDivSizeOffset: {
            width: 4,
            height: 4,
          },
          clipPathDivIsLeftPadding: "10px 26px 10px 14px",
          clipPathDivPadding: "10px 14px 10px 20px",
          clipPathDivIsLeftLeft: 3,
          clipPathDivLeft: 5,
          hDiv: {
            gap: 4,
          },
          h1: {
            fontSize: 14,
          },
          h2: {
            fontSize: 12,
          },
          toggle: {
            container: {
              padding: "0px 6px 12px 6px",
              gap: 12,
              fontSize: 13,
            },
            track: {
              width: 26,
              height: 12,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 8,
              height: 8,
            },
            translateX: 14,
          },
          cell: {
            padding: "0px 6px",
            fontSize: 12,
            height: 50,
          },
          footer: {
            div: {
              paddingTop: 12,
            },
            svgSize: 20,
          },
        };
      case "midhigh":
        return {
          contextMenu: {
            widthFactor: 0.8,
            heightFactor: 0.8,
          },
          gridIsLeftPadding: "0px 8px 0px 0px",
          gridPadding: "0px 0px 0px 8px",
          innerClipPath: {
            width: 8,
            height: 6,
            radius: 8,
            triangleRadius: 0,
            caretS: 10,
            caretHeight: 24,
          },
          clipPath: {
            width: 0,
            height: 0,
            radius: 8,
            triangleRadius: 0,
            caretS: 12,
            caretHeight: 30,
          },
          clipPathDiv: {
            top: 3,
            fontSize: 12,
            gap: 6,
            letterSpacing: 2,
          },
          clipPathDivSizeOffset: {
            width: 4,
            height: 4,
          },
          clipPathDivIsLeftPadding: "8px 24px 8px 12px",
          clipPathDivPadding: "8px 12px 8px 18px",
          clipPathDivIsLeftLeft: 3,
          clipPathDivLeft: 5,
          hDiv: {
            gap: 4,
          },
          h1: {
            fontSize: 12,
          },
          h2: {
            fontSize: 10,
          },
          toggle: {
            container: {
              padding: "0px 4px 8px 4px",
              gap: 12,
              fontSize: 11,
            },
            track: {
              width: 22,
              height: 10,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 6,
              height: 6,
            },
            translateX: 12,
          },
          cell: {
            padding: "0px 6px",
            fontSize: 10,
            height: 42,
          },
          footer: {
            div: {
              paddingTop: 6,
            },
            svgSize: 18,
          },
        };
      case "midlow":
      case "low":
        return {
          contextMenu: {
            widthFactor: 0.7,
            heightFactor: 0.7,
          },
          gridIsLeftPadding: "0px 8px 0px 0px",
          gridPadding: "0px 0px 0px 8px",
          innerClipPath: {
            width: 8,
            height: 6,
            radius: 8,
            triangleRadius: 0,
            caretS: 10,
            caretHeight: 24,
          },
          clipPath: {
            width: 0,
            height: 0,
            radius: 8,
            triangleRadius: 0,
            caretS: 12,
            caretHeight: 30,
          },
          clipPathDiv: {
            top: 3,
            fontSize: 12,
            gap: 6,
            letterSpacing: 2,
          },
          clipPathDivSizeOffset: {
            width: 4,
            height: 4,
          },
          clipPathDivIsLeftPadding: "8px 24px 8px 12px",
          clipPathDivPadding: "8px 12px 8px 18px",
          clipPathDivIsLeftLeft: 3,
          clipPathDivLeft: 5,
          hDiv: {
            gap: 4,
          },
          h1: {
            fontSize: 12,
          },
          h2: {
            fontSize: 10,
          },
          toggle: {
            container: {
              padding: "0px 4px 8px 4px",
              gap: 12,
              fontSize: 11,
            },
            track: {
              width: 20,
              height: 9,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 6,
              height: 6,
            },
            translateX: 10,
          },
          cell: {
            padding: "0px 6px",
            fontSize: 10,
            height: 40,
          },
          footer: {
            div: {
              paddingTop: 6,
            },
            svgSize: 18,
          },
        };
    }
  });

  const dropSelectedKey = useCallback(
    (mediaType: ContextMenu["media"]["type"], mediaKey: string) => {
      const without = (keys: Set<string>) => {
        if (!keys.has(mediaKey)) return keys;
        const next = new Set(keys);
        next.delete(mediaKey);
        return next;
      };
      switch (mediaType) {
        case "img":
          setSelectedImgKeys(without);
          break;
        case "svg":
          setSelectedSvgKeys(without);
          break;
        case "mask":
          setSelectedMaskKeys(without);
          break;
      }
    },
    [setSelectedImgKeys, setSelectedSvgKeys, setSelectedMaskKeys],
  );

  const deleteProjectMedia = useCallback(
    async (
      snapshot: LaurusProjectResult,
      mediaId: string,
      newSvgs: Map<string, LaurusProjectSvg> | undefined,
      newImgs: Map<string, LaurusProjectImg> | undefined,
      newMasks: Map<string, LaurusProjectMask> | undefined,
    ) => {
      const newProject: LaurusProjectResult = {
        ...snapshot,
        ...(newSvgs !== undefined && { svgs: newSvgs }),
        ...(newImgs !== undefined && { imgs: newImgs }),
        ...(newMasks !== undefined && { masks: newMasks }),
      };
      if (newProject.project_id) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (!updated) {
          dispatch({ type: CoreActionType.SetProject, value: snapshot });
        } else {
          if (uiState.activeElement?.key == media.key) {
            uiDispatch({
              type: UIActionType.SetActiveElement,
              value: undefined,
            });
          }
          if (uiState.selectedElement?.key == media.key) {
            uiDispatch({
              type: UIActionType.SetSelectedElement,
              value: undefined,
            });
            notifyMaskSelectionChanged(undefined);
          }
          dropSelectedKey(media.type, media.key);
          uiDispatch({
            type: UIActionType.DeleteCarouselEntry,
            key: media.key,
          });
          await deleteEffects(media.key, coreState.apiOrigin, coreState.accessToken, coreState.effects, dispatch);
          if (media.type === "mask") {
            await deleteMask(coreState.apiOrigin, coreState.accessToken, mediaId);
          }
          if (media.type !== "light" && media.type !== "object") {
            cleanUpCanvasMedia(media.type, media.key, dispatch);
            cleanUpMediaBrowser(media.type, mediaId, newProject, coreState.canvasMasks, uiDispatch);
          }
          if (uiState.browserElement) {
            cleanUpBrowserElement(mediaId, uiState.browserElement, newProject, uiDispatch);
          }
          if (framesCacheRef.current) {
            framesCacheRef.current.delete(media.key);
          }
        }
      }
    },
    [
      dispatch,
      coreState.apiOrigin,
      coreState.accessToken,
      coreState.effects,
      coreState.canvasMasks,
      uiState.activeElement?.key,
      uiState.selectedElement?.key,
      uiState.browserElement,
      media.key,
      media.type,
      uiDispatch,
      framesCacheRef,
      notifyMaskSelectionChanged,
      dropSelectedKey,
    ],
  );

  const leftSide = useMemo(() => {
    if (contextMenuConfig.position.toLowerCase().endsWith("left")) {
      return true;
    } else {
      return false;
    }
  }, [contextMenuConfig.position]);

  const bottomSide = useMemo(() => {
    if (contextMenuConfig.position.toLowerCase().startsWith("bottom")) {
      return true;
    } else {
      return false;
    }
  }, [contextMenuConfig.position]);

  const contextMenuWidth = useMemo(() => {
    return contextMenuConfig.width * dynamicSizes.contextMenu.widthFactor;
  }, [dynamicSizes.contextMenu.widthFactor, contextMenuConfig.width]);

  const contextMenuHeight = useMemo(() => {
    return contextMenuConfig.height * dynamicSizes.contextMenu.heightFactor;
  }, [dynamicSizes.contextMenu.heightFactor, contextMenuConfig.height]);

  const dynamicClipPath = useMemo(() => {
    const getPath = (isInner: boolean) => {
      const w = isInner
        ? contextMenuWidth - dynamicSizes.innerClipPath.width
        : contextMenuWidth - dynamicSizes.clipPath.width;
      const h = isInner
        ? contextMenuHeight - dynamicSizes.innerClipPath.height
        : contextMenuHeight - dynamicSizes.clipPath.height;
      const r = isInner ? dynamicSizes.innerClipPath.radius : dynamicSizes.clipPath.radius;
      const tr = isInner ? dynamicSizes.innerClipPath.triangleRadius : dynamicSizes.clipPath.triangleRadius;
      const cs = isInner ? dynamicSizes.innerClipPath.caretS : dynamicSizes.clipPath.caretS;
      const ch = isInner ? dynamicSizes.innerClipPath.caretHeight : dynamicSizes.clipPath.caretHeight;
      if (leftSide) {
        if (bottomSide) {
          return `path('M ${r} 0 H ${w - cs - r} A ${r} ${r} 0 0 1 ${w - cs} ${r} V ${h - ch + tr} A ${tr} ${tr} 0 0 1 ${w - cs + tr / 2} ${h - ch + tr / 2} L ${w - tr} ${h - ch / 2 + tr / 2} A ${tr} ${tr} 0 0 1 ${w - tr} ${h - ch / 2 - tr / 2} L ${w - cs + tr / 2} ${h - tr / 2} A ${tr} ${tr} 0 0 1 ${w - cs} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z')`;
        }
        return `path('M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 H ${w - cs} A ${tr} ${tr} 0 0 1 ${w - cs + tr / 2} ${tr / 2} L ${w - tr} ${ch / 2 - tr / 2} A ${tr} ${tr} 0 0 1 ${w - tr} ${ch / 2 + tr / 2} L ${w - cs + tr / 2} ${ch - tr / 2} A ${tr} ${tr} 0 0 1 ${w - cs} ${ch} V ${h - r} A ${r} ${r} 0 0 1 ${w - cs - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} Z')`;
      } else {
        if (bottomSide) {
          return `path('M ${cs + r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${cs} A ${tr} ${tr} 0 0 1 ${cs - tr / 2} ${h - tr / 2} L ${tr} ${h - ch / 2 + tr / 2} A ${tr} ${tr} 0 0 1 ${tr} ${h - ch / 2 - tr / 2} L ${cs - tr / 2} ${h - ch + tr / 2} A ${tr} ${tr} 0 0 1 ${cs} ${h - ch} V ${r} A ${r} ${r} 0 0 1 ${cs + r} 0 Z')`;
        }
        return `path('M ${cs} ${ch} A ${tr} ${tr} 0 0 1 ${cs - tr / 2} ${ch - tr / 2} L ${tr} ${ch / 2 + tr / 2} A ${tr} ${tr} 0 0 1 ${tr} ${ch / 2 - tr / 2} L ${cs - tr / 2} ${tr / 2} A ${tr} ${tr} 0 0 1 ${cs} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${cs + r} A ${r} ${r} 0 0 1 ${cs} ${h - r} Z')`;
      }
    };
    return {
      outer: getPath(false),
      inner: getPath(true),
    };
  }, [
    contextMenuWidth,
    dynamicSizes.innerClipPath.width,
    dynamicSizes.innerClipPath.height,
    dynamicSizes.innerClipPath.radius,
    dynamicSizes.innerClipPath.triangleRadius,
    dynamicSizes.innerClipPath.caretS,
    dynamicSizes.innerClipPath.caretHeight,
    dynamicSizes.clipPath.width,
    dynamicSizes.clipPath.height,
    dynamicSizes.clipPath.radius,
    dynamicSizes.clipPath.triangleRadius,
    dynamicSizes.clipPath.caretS,
    dynamicSizes.clipPath.caretHeight,
    contextMenuHeight,
    leftSide,
    bottomSide,
  ]);

  const swapMedia = useCallback(async () => {
    if (!uiState.browserElement) return;
    const browserElement: LaurusBrowserElement = { ...uiState.browserElement };
    const snapshot: LaurusProjectResult = { ...coreState.project };
    const newImgs = new Map(snapshot.imgs);
    const newSvgs = new Map(snapshot.svgs);
    const newCanvasImgs = new Map(coreState.canvasImgs);
    const newCanvasSvgs = new Map(coreState.canvasSvgs);
    switch (media.type) {
      case "img": {
        switch (browserElement.type) {
          case "svg": {
            newImgs.delete(media.key);
            newCanvasImgs.delete(media.key);
            const newProjectSvg: LaurusProjectSvg = {
              ...media.meta,
              svg_media_id: browserElement.value.svg_media_id,
              media_key: browserElement.value.media_key,
              viewbox: browserElement.value.viewbox,
              stroke: browserElement.value.stroke,
              stroke_width: browserElement.value.stroke_width,
              fill: browserElement.value.fill,
            };
            const newSvgResult: LaurusSvgResult = {
              ...newProjectSvg,
              timestamp: browserElement.value.timestamp,
              last_active: browserElement.value.last_active,
              media_uri: browserElement.value.media_uri,
              order: browserElement.value.order,
              categories: browserElement.value.categories,
              markup: browserElement.value.markup,
              creator: browserElement.value.creator,
              last_editor: browserElement.value.last_editor,
            };
            newSvgs.set(media.key, newProjectSvg);
            newCanvasSvgs.set(media.key, newSvgResult);
            break;
          }
          case "img": {
            const newProjectImg: LaurusProjectImg = {
              ...media.meta,
              img_media_id: browserElement.value.img_media_id,
              media_key: browserElement.value.media_key,
            };
            const newImgResult: LaurusImgResult = {
              ...newProjectImg,
              timestamp: browserElement.value.timestamp,
              last_active: browserElement.value.last_active,
              media_uri: browserElement.value.media_uri,
              order: browserElement.value.order,
              categories: browserElement.value.categories,
              src: browserElement.value.src,
              creator: browserElement.value.creator,
              last_editor: browserElement.value.last_editor,
            };
            newImgs.set(media.key, newProjectImg);
            newCanvasImgs.set(media.key, newImgResult);
            break;
          }
        }
        break;
      }
      case "svg": {
        switch (browserElement.type) {
          case "svg": {
            const newProjectSvg: LaurusProjectSvg = {
              ...media.meta,
              svg_media_id: browserElement.value.svg_media_id,
              media_key: browserElement.value.media_key,
              viewbox: browserElement.value.viewbox,
            };
            const newSvgResult: LaurusSvgResult = {
              ...newProjectSvg,
              timestamp: browserElement.value.timestamp,
              last_active: browserElement.value.last_active,
              media_uri: browserElement.value.media_uri,
              order: browserElement.value.order,
              categories: browserElement.value.categories,
              markup: browserElement.value.markup,
              creator: browserElement.value.creator,
              last_editor: browserElement.value.last_editor,
            };
            newSvgs.set(media.key, newProjectSvg);
            newCanvasSvgs.set(media.key, newSvgResult);
            break;
          }
          case "img": {
            newSvgs.delete(media.key);
            newCanvasSvgs.delete(media.key);
            const newProjectImg: LaurusProjectImg = {
              ...media.meta,
              img_media_id: browserElement.value.img_media_id,
              media_key: browserElement.value.media_key,
            };
            const newImgResult: LaurusImgResult = {
              ...newProjectImg,
              timestamp: browserElement.value.timestamp,
              last_active: browserElement.value.last_active,
              media_uri: browserElement.value.media_uri,
              order: browserElement.value.order,
              categories: browserElement.value.categories,
              src: browserElement.value.src,
              creator: browserElement.value.creator,
              last_editor: browserElement.value.last_editor,
            };
            newImgs.set(media.key, newProjectImg);
            newCanvasImgs.set(media.key, newImgResult);
            break;
          }
        }
        break;
      }
    }
    const newProject: LaurusProjectResult = {
      ...coreState.project,
      imgs: newImgs,
      svgs: newSvgs,
    };
    const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
      ...newProject,
    });
    if (updated) {
      dispatch({ type: CoreActionType.SetCanvasImgs, value: newCanvasImgs });
      dispatch({ type: CoreActionType.SetCanvasSvgs, value: newCanvasSvgs });
      dispatch({ type: CoreActionType.SetProject, value: newProject });
    }
  }, [
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.canvasImgs,
    coreState.canvasSvgs,
    coreState.project,
    dispatch,
    media.key,
    media.meta,
    media.type,
    uiState.browserElement,
  ]);

  const updateMediaOrder = useCallback(
    async (direction: "increment" | "decrement" | "top" | "bottom") => {
      const snapshot = { ...coreState.project };
      const newImgs = new Map(Array.from(snapshot.imgs, ([k, v]) => [k, { ...v }]));
      const newSvgs = new Map(Array.from(snapshot.svgs, ([k, v]) => [k, { ...v }]));
      const newMasks = new Map(Array.from(snapshot.masks, ([k, v]) => [k, { ...v }]));
      const targetItem = newImgs.get(media.key) || newSvgs.get(media.key) || newMasks.get(media.key);
      if (!targetItem) return;
      const allItems = [...newImgs.values(), ...newSvgs.values(), ...newMasks.values()];
      const maxOrder = Math.max(-1, ...allItems.map((item) => item.order));

      if (direction === "decrement") {
        targetItem.order = Math.max(0, targetItem.order - 1);
      } else if (direction === "increment") {
        targetItem.order = Math.min(maxOrder, targetItem.order + 1);
      } else if (direction === "top") {
        targetItem.order = maxOrder + 1;
      } else if (direction === "bottom") {
        targetItem.order = -1;
      }

      allItems.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        if (a === targetItem) return direction === "decrement" || direction === "bottom" ? -1 : 1;
        if (b === targetItem) return direction === "decrement" || direction === "bottom" ? 1 : -1;
        return 0;
      });
      allItems.forEach((item, index) => {
        item.order = index;
      });
      const newProject: LaurusProjectResult = {
        ...snapshot,
        imgs: newImgs,
        svgs: newSvgs,
        masks: newMasks,
      };
      const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (updated) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
      }
    },
    [coreState.project, coreState.apiOrigin, coreState.accessToken, media.key, dispatch],
  );

  const [reordering, setReordering] = useState(false);

  const moveInStack = useCallback(
    async (direction: StackDirection) => {
      const target: StackRef | undefined =
        media.type === "object"
          ? { kind: "object", id: media.objectId }
          : media.type === "light"
            ? { kind: "light", id: media.lightId }
            : undefined;
      if (!target) {
        await updateMediaOrder(direction);
        return;
      }
      if (reordering) return;
      setReordering(true);
      try {
        await reorderElement(media.key, target, direction);
      } finally {
        setReordering(false);
      }
    },
    [media, reordering, reorderElement, updateMediaOrder],
  );

  const revertEnabled = useMemo(() => {
    switch (media.type) {
      case "img": {
        const m = coreState.project.imgs.get(media.key);
        if (!m) return false;
        return projectImgIsTransformed(m);
      }
      case "svg": {
        const m = coreState.project.svgs.get(media.key);
        if (!m) return false;
        return projectSvgIsTransformed(m);
      }
      case "mask":
      case "light":
      case "object": {
        const m = coreState.project.masks.get(media.key);
        if (!m) return false;
        return projectMaskIsTransformed(m);
      }
    }
  }, [coreState.project.imgs, coreState.project.svgs, coreState.project.masks, media.key, media.type]);

  const revertMedia = useCallback(async () => {
    const snapshot: LaurusProjectResult = { ...coreState.project };
    const newImgs = new Map(snapshot.imgs);
    const newSvgs = new Map(snapshot.svgs);
    const newMasks = new Map(snapshot.masks);
    switch (media.type) {
      case "img": {
        const m = newImgs.get(media.key);
        if (!m) return;
        if (projectImgIsTransformed(m)) {
          const newImg: LaurusProjectImg = {
            ...m,
            scale_x: 1,
            scale_y: 1,
            rotate_x: 0,
            rotate_y: 0,
            rotate_z: 0,
            rotate_angle: 0,
            skew_ax: 0,
            skew_ay: 0,
          };
          newImgs.set(media.key, newImg);
        }
        break;
      }
      case "svg": {
        const m = newSvgs.get(media.key);
        if (!m) return;
        if (projectSvgIsTransformed(m)) {
          const newSvg: LaurusProjectSvg = {
            ...m,
            scale_x: 1,
            scale_y: 1,
            rotate_x: 0,
            rotate_y: 0,
            rotate_z: 0,
            rotate_angle: 0,
            skew_ax: 0,
            skew_ay: 0,
          };
          newSvgs.set(media.key, newSvg);
        }
        break;
      }
      case "mask":
      case "light":
      case "object": {
        const m = newMasks.get(media.key);
        if (!m) return;
        if (projectMaskIsTransformed(m)) {
          const newMask: LaurusProjectMask = {
            ...m,
            scale_x: 1,
            scale_y: 1,
            rotate_x: 0,
            rotate_y: 0,
            rotate_z: 0,
            rotate_angle: 0,
            skew_ax: 0,
            skew_ay: 0,
          };
          newMasks.set(media.key, newMask);
        }
        break;
      }
    }
    const newProject: LaurusProjectResult = {
      ...coreState.project,
      imgs: newImgs,
      svgs: newSvgs,
      masks: newMasks,
    };
    const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
      ...newProject,
    });
    if (updated) {
      dispatch({ type: CoreActionType.SetProject, value: newProject });
    }
  }, [coreState.accessToken, coreState.apiOrigin, coreState.project, dispatch, media.key, media.type]);

  const isLightOrObject = media.type === "light" || media.type === "object";

  const editableObject = useMemo(() => {
    if (media.type !== "object") return undefined;
    if (uiState.maskEdit !== undefined) return undefined;
    const maskData = coreState.canvasMasks.get(media.key);
    const object = maskData?.objects.find((o) => o.id === media.objectId);
    if (!maskData || !object) return undefined;
    return {
      maskMediaId: maskData.mask_media_id,
      object,
      polygonIndices: polygonIndicesForObject(maskData.polygons, object.id),
    };
  }, [coreState.canvasMasks, media, uiState.maskEdit]);

  const editableLight = useMemo(() => {
    if (media.type !== "light") return undefined;
    if (uiState.maskEdit !== undefined) return undefined;
    const maskData = coreState.canvasMasks.get(media.key);
    const light = maskData?.lights.find((l) => l.id === media.lightId);
    if (!maskData || !light) return undefined;
    return {
      maskMediaId: maskData.mask_media_id,
      light,
      polygonIndices: polygonIndicesForLight(maskData.polygons, light.id),
    };
  }, [coreState.canvasMasks, media, uiState.maskEdit]);

  const reviewMaskMediaId = useMemo(() => {
    if (media.type !== "mask") return undefined;
    const maskData = coreState.canvasMasks.get(media.key);
    return maskData?.has_object_review ? maskData.mask_media_id : undefined;
  }, [coreState.canvasMasks, media]);

  const maskObjectCount = useMemo(() => {
    if (media.type !== "mask") return undefined;
    return coreState.canvasMasks.get(media.key)?.objects.length;
  }, [coreState.canvasMasks, media]);

  const maskLightCount = useMemo(() => {
    if (media.type !== "mask") return undefined;
    return coreState.canvasMasks.get(media.key)?.lights.length;
  }, [coreState.canvasMasks, media]);

  const editedPolygonCount = useMemo(() => {
    const session = uiState.maskEdit;
    return session && isMaskEditSubject(session, media) ? session.currentIndices.size : undefined;
  }, [uiState.maskEdit, media]);

  const objectPolygonCount = useMemo(() => {
    if (media.type !== "object") return undefined;
    if (editedPolygonCount !== undefined) return editedPolygonCount;
    return coreState.canvasMasks.get(media.key)?.polygons.filter((p) => p.object_id === media.objectId).length;
  }, [coreState.canvasMasks, media, editedPolygonCount]);

  const lightPolygonCount = useMemo(() => {
    if (media.type !== "light") return undefined;
    if (editedPolygonCount !== undefined) return editedPolygonCount;
    return coreState.canvasMasks.get(media.key)?.polygons.filter((p) => p.light_id === media.lightId).length;
  }, [coreState.canvasMasks, media, editedPolygonCount]);

  const reviewFetchedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!reviewMaskMediaId) return;
    if (coreState.objectReviews.has(reviewMaskMediaId)) return;
    if (reviewFetchedRef.current.has(reviewMaskMediaId)) return;
    reviewFetchedRef.current.add(reviewMaskMediaId);
    let cancelled = false;
    void (async () => {
      const review = await getObjectReview(coreState.apiOrigin, coreState.accessToken, reviewMaskMediaId);
      if (cancelled || !review) return;
      dispatch({ type: CoreActionType.SetObjectReview, maskMediaId: reviewMaskMediaId, value: review });
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewMaskMediaId, coreState.objectReviews, coreState.apiOrigin, coreState.accessToken, dispatch]);

  const pendingReview = useMemo((): PendingObjectReview | undefined => {
    if (!reviewMaskMediaId) return undefined;
    const state = coreState.objectReviews.get(reviewMaskMediaId);
    if (!state) return undefined;
    const decisions = new Map(state.decisions.map((d) => [d.object_id, d.decision]));
    const resumed = resumeObjectReview(reviewMaskMediaId, media.key, state.candidates, decisions);
    return resumed ? { state, decisions, resumed } : undefined;
  }, [reviewMaskMediaId, media.key, coreState.objectReviews]);

  const reviewableMask = useMemo(() => {
    if (media.type !== "mask") return undefined;
    if (uiState.maskEdit !== undefined) return undefined;
    if (!reviewMaskMediaId || !pendingReview) return undefined;
    return { maskMediaId: reviewMaskMediaId, pending: pendingReview };
  }, [media, uiState.maskEdit, reviewMaskMediaId, pendingReview]);

  const reviewTitle = useMemo(() => {
    if (media.type !== "mask") return undefined;
    if (uiState.maskEdit !== undefined) return "finish the edit in progress first";
    if (!pendingReview) return "no pending review for this mask";
    const allDecided = pendingReview.state.candidates.every((c) => pendingReview.decisions.has(c.object.id));
    return allDecided ? "reopen the completed object review for this mask" : "resume the object review for this mask";
  }, [media.type, uiState.maskEdit, pendingReview]);

  const cellStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    cursor: "pointer",
    ...dynamicSizes.cell,
  };

  const reviewButton = (
    <div
      className={reviewableMask ? styles["animated-nav-dark"] : ""}
      style={{
        color: reviewableMask ? "inherit" : "rgba(127,127,127, 1)",
        ...cellStyle,
        cursor: reviewableMask ? "pointer" : "not-allowed",
      }}
      title={reviewTitle}
      onClick={() => {
        if (!reviewableMask) return;
        const { pending } = reviewableMask;
        uiDispatch({
          type: UIActionType.ResumeObjectReview,
          maskMediaId: reviewableMask.maskMediaId,
          maskKey: media.key,
          candidates: pending.state.candidates,
          decisions: pending.decisions,
        });
        notifyMaskObjectReviewPreview(media.key, pending.resumed.currentIndices);
        uiDispatch({ type: UIActionType.CloseAllContextMenus });
      }}
    >
      {"review"}
    </div>
  );

  const header = useMemo(() => {
    switch (media.type) {
      case "img":
      case "svg":
        return media.meta.media_key;
      case "mask": {
        const mask = coreState.canvasMasks.get(media.key);
        if (!mask) return media.key;
        return maskLabel(mask, coreState.canvasImgs, media.key);
      }
      case "object": {
        const mask = coreState.canvasMasks.get(media.key);
        if (!mask) return media.key;
        const object = mask.objects.find((o) => o.id === media.objectId);
        if (!object) return media.key;
        return object.description ? object.description : object.name ? object.name : "";
      }
      case "light": {
        const mask = coreState.canvasMasks.get(media.key);
        if (!mask) return media.key;
        const light = mask.lights.find((o) => o.id === media.lightId);
        if (!light) return media.key;
        return light.description ? light.description : light.name ? light.name : "";
      }
    }
  }, [coreState.canvasImgs, coreState.canvasMasks, media]);

  const describable = useMemo(() => {
    const maskData = coreState.canvasMasks.get(media.key);
    if (!maskData) return undefined;
    switch (media.type) {
      case "mask":
        return {
          description: maskData.description,
          fallback: maskLabel({ ...maskData, description: "" }, coreState.canvasImgs, media.key),
        };
      case "light": {
        if (uiState.maskEdit !== undefined) return undefined;
        const light = maskData.lights.find((l) => l.id === media.lightId);
        if (!light) return undefined;
        return { description: light.description, fallback: light.name ? light.name : "" };
      }
      case "object": {
        if (uiState.maskEdit !== undefined) return undefined;
        const object = maskData.objects.find((o) => o.id === media.objectId);
        if (!object) return undefined;
        return { description: object.description, fallback: object.name ? object.name : "" };
      }
      default:
        return undefined;
    }
  }, [media, coreState.canvasMasks, coreState.canvasImgs, uiState.maskEdit]);

  const [descriptionDraft, setDescriptionDraft] = useState<string | undefined>(undefined);
  const descriptionDraftRef = useRef<string | undefined>(undefined);
  const editDescription = useCallback((draft: string | undefined) => {
    descriptionDraftRef.current = draft;
    setDescriptionDraft(draft);
  }, []);

  const [committingDescription, setCommittingDescription] = useState<string | undefined>(undefined);

  const openDescriptionEdit = useCallback(() => {
    if (!describable || descriptionDraftRef.current !== undefined) return;
    if (committingDescription !== undefined) return;
    if (!coreState.accessToken) {
      alert(UNAUTHORIZED_EDIT);
      return;
    }
    editDescription(describable.description);
  }, [describable, committingDescription, coreState.accessToken, editDescription]);

  const saveDescription = useCallback(
    async (description: string) => {
      const maskData = coreState.canvasMasks.get(media.key);
      if (!maskData) return;
      switch (media.type) {
        case "mask": {
          const updated = await updateMaskDescription(
            coreState.apiOrigin,
            coreState.accessToken,
            maskData.mask_media_id,
            description,
          );
          if (!updated) return;
          dispatch({ type: CoreActionType.SetCanvasMask, key: media.key, value: updated });
          return;
        }
        case "light": {
          const light = maskData.lights.find((l) => l.id === media.lightId);
          if (!light) return;
          const updated = await sendMaskLightUpdate(
            maskData.mask_media_id,
            toLightUpdate(light, POLYGONS_UNCHANGED, { description }),
          );
          if (!updated) return;
          const patched = applyLightDelta(maskData, updated);
          dispatch({ type: CoreActionType.SetCanvasMask, key: media.key, value: patched });
          notifyMaskLightUpdated(media.key, patched);
          return;
        }
        case "object": {
          const object = maskData.objects.find((o) => o.id === media.objectId);
          if (!object) return;
          const updated = await sendMaskObjectUpdate(
            maskData.mask_media_id,
            toObjectUpdate(object, POLYGONS_UNCHANGED, { description }),
          );
          if (!updated) return;
          const patched = applyObjectDelta(maskData, updated);
          dispatch({ type: CoreActionType.SetCanvasMask, key: media.key, value: patched });
          notifyMaskObjectsUpdated(media.key, patched);
          return;
        }
        default:
          return;
      }
    },
    [
      media,
      coreState.canvasMasks,
      coreState.apiOrigin,
      coreState.accessToken,
      dispatch,
      sendMaskLightUpdate,
      sendMaskObjectUpdate,
      notifyMaskLightUpdated,
      notifyMaskObjectsUpdated,
    ],
  );

  const commitDescription = useCallback(async () => {
    const draft = descriptionDraftRef.current;
    editDescription(undefined);
    if (draft === undefined || !describable) return;
    const description = draft.trim();
    if (description === describable.description) return;
    setCommittingDescription(description);
    await saveDescription(description);
    setCommittingDescription(undefined);
  }, [describable, saveDescription, editDescription]);

  const shownHeader = useMemo(() => {
    if (committingDescription === undefined) return header;
    if (committingDescription) return committingDescription;
    return describable ? describable.fallback : header;
  }, [committingDescription, header, describable]);

  const subheader = useMemo(() => {
    switch (media.type) {
      case "img":
      case "svg":
      case "mask": {
        return `x${media.meta.left.toFixed()} | y${media.meta.top.toFixed()} | w${media.meta.width.toFixed()} | h${media.meta.height.toFixed()}`;
      }
      case "object": {
        const fallback = `x${media.meta.left.toFixed()} | y${media.meta.top.toFixed()} | w${media.meta.width.toFixed()} | h${media.meta.height.toFixed()}`;
        const mask = coreState.canvasMasks.get(media.key);
        if (!mask) return fallback;
        const object = mask.objects.find((o) => o.id === media.objectId);
        if (!object) return fallback;
        return `x${object.cx.toFixed()} | y${object.cy.toFixed()}`;
      }
      case "light": {
        const fallback = `x${media.meta.left.toFixed()} | y${media.meta.top.toFixed()} | w${media.meta.width.toFixed()} | h${media.meta.height.toFixed()}`;
        const mask = coreState.canvasMasks.get(media.key);
        if (!mask) return fallback;
        const object = mask.lights.find((o) => o.id === media.lightId);
        if (!object) return fallback;
        return `x${object.cx.toFixed()} | y${object.cy.toFixed()}`;
      }
    }
  }, [coreState.canvasMasks, media]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          display: "flex",
          top: transform?.bounds.deltas.top ?? 0,
          left: transform?.bounds.deltas.left ?? 0,
          width: transform?.bounds.width ?? 0,
          height: transform?.bounds.height ?? 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            pointerEvents: dropZoneArmed ? "auto" : undefined,
            ...(contextMenuConfig.position.toLowerCase().endsWith("right") && {
              left: "100%",
            }),
            ...(leftSide && { right: "100%" }),
            ...(bottomSide && { bottom: "0%" }),
            display: "grid",
            height: (transform?.bounds.height ?? 0) < contextMenuHeight ? contextMenuHeight : "100%",
            gridTemplateColumns: `${contextMenuWidth}px`,
            gridTemplateRows: "auto",
            padding: leftSide ? dynamicSizes.gridIsLeftPadding : dynamicSizes.gridPadding,
          }}
        >
          <div
            style={{
              gridColumn: 1,
              gridRow: 1,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: contextMenuWidth,
                height: contextMenuHeight,
                backdropFilter: "blur(10px)",
                background: "rgba(255, 255, 255, 0.06)",
                clipPath: dynamicClipPath.outer,
                overflow: "hidden",
                display: "grid",
              }}
            />
            <div
              style={{
                clipPath: dynamicClipPath.inner,
                position: "absolute",
                background: "rgba(0, 0, 0, 0.37)",
                display: "grid",
                gridTemplateColumns: "1fr",
                gridTemplateRows: "min-content auto",
                textAlign: "left",
                overflowX: "hidden",
                whiteSpace: "nowrap",
                textWrap: "nowrap",
                ...(committingDescription !== undefined && { cursor: "wait" }),
                padding: leftSide ? dynamicSizes.clipPathDivIsLeftPadding : dynamicSizes.clipPathDivPadding,
                left: leftSide ? dynamicSizes.clipPathDivIsLeftLeft : dynamicSizes.clipPathDivLeft,
                width: contextMenuWidth - dynamicSizes.clipPathDivSizeOffset.width,
                height: contextMenuHeight - dynamicSizes.clipPathDivSizeOffset.height,
                ...dynamicSizes.clipPathDiv,
              }}
            >
              <div
                style={{
                  gridRow: 1,
                  gridColumn: 1,
                  display: "grid",
                  ...dynamicSizes.hDiv,
                }}
              >
                <div
                  title={
                    committingDescription !== undefined
                      ? "saving the description..."
                      : describable
                        ? `double click to describe this ${media.type}`
                        : undefined
                  }
                  onDoubleClick={openDescriptionEdit}
                  style={{
                    overflowX: "auto",
                    fontWeight: "bold",
                    ...(committingDescription !== undefined && { cursor: "wait" }),
                    ...dynamicSizes.h1,
                  }}
                >
                  {descriptionDraft === undefined ? (
                    shownHeader
                  ) : (
                    <input
                      autoFocus
                      type="text"
                      value={descriptionDraft}
                      placeholder="describe me..."
                      autoComplete="off"
                      onChange={(e) => editDescription(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => void commitDescription()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          editDescription(undefined);
                        }
                      }}
                      style={{
                        font: "inherit",
                        fontWeight: "bold",
                        letterSpacing: "inherit",
                        background: "none",
                        color: "inherit",
                        border: "none",
                        outline: "none",
                        padding: 0,
                        width: "100%",
                      }}
                    />
                  )}
                </div>
                <div style={{ display: "flex", ...dynamicSizes.h2 }}>{subheader}</div>
                <div
                  style={{
                    overflowX: "auto",
                    display: "flex",
                    ...dynamicSizes.h2,
                  }}
                />
              </div>
              <div style={{ gridRow: 2, gridColumn: 1, display: "grid" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    ...dynamicSizes.toggle.container,
                  }}
                >
                  <span
                    style={{
                      textShadow: active ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                    }}
                  >
                    {"active"}
                  </span>
                  <Toggle
                    value={active}
                    onClick={() => {
                      if (active) {
                        uiDispatch({
                          type: UIActionType.SetActiveElement,
                          value: undefined,
                        });
                        return;
                      }
                      switch (media.type) {
                        case "img": {
                          const newActiveElement: LaurusActiveElement = {
                            key: media.key,
                            type: "img",
                          };
                          uiDispatch({
                            type: UIActionType.SetActiveElement,
                            value: newActiveElement,
                          });
                          break;
                        }
                        case "svg": {
                          const newActiveElement: LaurusActiveElement = {
                            key: media.key,
                            type: "svg",
                          };
                          uiDispatch({
                            type: UIActionType.SetActiveElement,
                            value: newActiveElement,
                          });
                          break;
                        }
                        case "mask": {
                          const newActiveElement: LaurusActiveElement = {
                            key: media.key,
                            type: "mask",
                          };
                          uiDispatch({
                            type: UIActionType.SetActiveElement,
                            value: newActiveElement,
                          });
                          break;
                        }
                        case "light": {
                          const newActiveElement: LaurusActiveElement = {
                            key: media.key,
                            type: "light",
                            lightId: media.lightId,
                          };
                          uiDispatch({
                            type: UIActionType.SetActiveElement,
                            value: newActiveElement,
                          });
                          uiDispatch({
                            type: UIActionType.SetSelectedElement,
                            value: { key: media.key, type: "light", lightId: media.lightId },
                          });
                          notifyMaskSelectionChanged(media.key);
                          notifyMaskSelectedLightChanged(media.key, media.lightId);
                          notifyMaskSelectedObjectChanged(media.key, undefined);
                          break;
                        }
                        case "object": {
                          const newActiveElement: LaurusActiveElement = {
                            key: media.key,
                            type: "object",
                            objectId: media.objectId,
                          };
                          uiDispatch({
                            type: UIActionType.SetActiveElement,
                            value: newActiveElement,
                          });
                          uiDispatch({
                            type: UIActionType.SetSelectedElement,
                            value: { key: media.key, type: "object", objectId: media.objectId },
                          });
                          notifyMaskSelectionChanged(media.key);
                          notifyMaskSelectedObjectChanged(media.key, media.objectId);
                          notifyMaskSelectedLightChanged(media.key, undefined);
                          break;
                        }
                      }
                    }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }}
                    translateX={dynamicSizes.toggle.translateX}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    overflowY: "auto",
                    alignSelf: "start",
                    height: dynamicSizes.cell.height * 4,
                  }}
                >
                  {media.type === "mask" && reviewButton}
                  {media.type !== "mask" && !isLightOrObject && (
                    <div style={{ ...cellStyle }} className={styles["animated-nav-dark"]} onClick={swapMedia}>
                      {"swap"}
                    </div>
                  )}
                  {media.type === "object" && (
                    <div
                      className={editableObject ? styles["animated-nav-dark"] : ""}
                      style={{
                        color: editableObject ? "inherit" : "rgba(127,127,127, 1)",
                        ...cellStyle,
                      }}
                      title={
                        editableObject
                          ? "open this object for editing -- the pen comes up on its outline"
                          : "finish the edit in progress first"
                      }
                      onClick={() => {
                        if (!editableObject) return;
                        uiDispatch({
                          type: UIActionType.StartObjectEdit,
                          maskMediaId: editableObject.maskMediaId,
                          maskKey: media.key,
                          object: editableObject.object,
                          polygonIndices: editableObject.polygonIndices,
                        });
                        notifyMaskObjectReviewPreview(media.key, new Set(editableObject.polygonIndices));
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                      }}
                    >
                      {"edit"}
                    </div>
                  )}
                  {media.type === "light" && (
                    <div
                      className={editableLight ? styles["animated-nav-dark"] : ""}
                      style={{
                        color: editableLight ? "inherit" : "rgba(127,127,127, 1)",
                        ...cellStyle,
                      }}
                      title={
                        editableLight
                          ? "open this light for editing -- the pen comes up on its outline"
                          : "finish the edit in progress first"
                      }
                      onClick={() => {
                        if (!editableLight) return;
                        uiDispatch({
                          type: UIActionType.StartLightEdit,
                          maskMediaId: editableLight.maskMediaId,
                          maskKey: media.key,
                          light: editableLight.light,
                          polygonIndices: editableLight.polygonIndices,
                        });
                        notifyMaskObjectReviewPreview(media.key, new Set(editableLight.polygonIndices));
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                      }}
                    >
                      {"edit"}
                    </div>
                  )}
                  <div
                    style={{
                      color: reordering ? "rgba(127,127,127, 1)" : "inherit",
                      ...cellStyle,
                      cursor: "pointer",
                    }}
                    className={reordering ? "" : styles["animated-nav-dark"]}
                    title={isLightOrObject ? MOVE_UP_TITLE[media.type] : undefined}
                    onClick={() => moveInStack(isAltPressed ? "top" : "increment")}
                  >
                    {isAltPressed ? "move to top" : "move up"}
                  </div>
                  <div
                    style={{
                      color: reordering ? "rgba(127,127,127, 1)" : "inherit",
                      ...cellStyle,
                      cursor: "pointer",
                    }}
                    className={reordering ? "" : styles["animated-nav-dark"]}
                    title={isLightOrObject ? MOVE_DOWN_TITLE[media.type] : undefined}
                    onClick={() => moveInStack(isAltPressed ? "bottom" : "decrement")}
                  >
                    {isAltPressed ? "move to bottom" : "move down"}
                  </div>
                  <div
                    className={revertEnabled ? styles["animated-nav-dark"] : ""}
                    style={{
                      color: revertEnabled ? "inherit" : "rgba(127,127,127, 1)",
                      ...cellStyle,
                      cursor: revertEnabled ? "pointer" : "not-allowed",
                    }}
                    onClick={() => {
                      if (!revertEnabled) return;
                      revertMedia();
                    }}
                  >
                    {"revert"}
                  </div>
                  <div
                    style={{ color: "rgb(242, 83, 83)", ...cellStyle }}
                    className={styles["animated-nav-dark"]}
                    onClick={async () => {
                      const confirmed = confirm("are you sure you want to delete this media?");
                      if (!confirmed) return;
                      const snapshot: LaurusProjectResult = {
                        ...coreState.project,
                      };
                      switch (media.type) {
                        case "img": {
                          const newImgs: Map<string, LaurusProjectImg> = new Map(snapshot.imgs);
                          newImgs.delete(media.key);
                          deleteProjectMedia(snapshot, media.meta.img_media_id, undefined, newImgs, undefined);
                          break;
                        }
                        case "svg": {
                          const newSvgs: Map<string, LaurusProjectSvg> = new Map(snapshot.svgs);
                          newSvgs.delete(media.key);
                          deleteProjectMedia(snapshot, media.meta.svg_media_id, newSvgs, undefined, undefined);
                          break;
                        }
                        case "mask": {
                          const newMasks: Map<string, LaurusProjectMask> = new Map(snapshot.masks);
                          newMasks.delete(media.key);
                          closeMaskLightSocket(media.meta.media_id);
                          closeMaskObjectSocket(media.meta.media_id);
                          deleteProjectMedia(snapshot, media.meta.media_id, undefined, undefined, newMasks);
                          break;
                        }
                        case "light": {
                          const updated: LightUpdateDelta_V1_0 | undefined = await sendMaskLightUpdate(
                            media.meta.media_id,
                            toLightUpdate(newLight(media.lightId, ""), POLYGONS_UNCHANGED, { remove: true }),
                          );
                          const lightMaskData = coreState.canvasMasks.get(media.key);
                          if (!updated || !lightMaskData) break;
                          const patchedLightMask = applyLightDelta(lightMaskData, updated);
                          dispatch({ type: CoreActionType.SetCanvasMask, key: media.key, value: patchedLightMask });
                          notifyMaskLightUpdated(media.key, patchedLightMask);
                          await deleteMaskLightEffects(
                            media.key,
                            media.lightId,
                            coreState.apiOrigin,
                            coreState.accessToken,
                            coreState.effects,
                            dispatch,
                          );
                          if (
                            uiState.activeElement?.key == media.key &&
                            uiState.activeElement.type === "light" &&
                            uiState.activeElement.lightId === media.lightId
                          ) {
                            uiDispatch({ type: UIActionType.SetActiveElement, value: undefined });
                          }
                          if (
                            uiState.selectedElement?.key == media.key &&
                            uiState.selectedElement.type === "light" &&
                            uiState.selectedElement.lightId === media.lightId
                          ) {
                            uiDispatch({
                              type: UIActionType.SetSelectedElement,
                              value: { key: media.key, type: "mask" },
                            });
                            notifyMaskSelectionChanged(media.key);
                            notifyMaskSelectedLightChanged(media.key, undefined);
                          }
                          uiDispatch({
                            type: UIActionType.DeleteCarouselEntry,
                            key: media.key,
                            lightId: media.lightId,
                          });
                          break;
                        }
                        case "object": {
                          await deleteObject(media.key, media.objectId);
                          break;
                        }
                      }
                    }}
                  >
                    {"delete"}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    gap: "2.5ch",
                    ...dynamicSizes.footer.div,
                  }}
                >
                  {maskObjectCount == undefined ? (
                    <></>
                  ) : (
                    <div style={{ display: "flex", gap: "1ch" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          textShadow: "0 0 1px rgba(255, 255, 255, 1)",
                        }}
                      >
                        {`${maskObjectCount}`}
                      </div>
                      <div>{maskObjectCount === 1 ? "object" : "objects"}</div>
                    </div>
                  )}
                  {maskLightCount === undefined ? (
                    <></>
                  ) : (
                    <div style={{ display: "flex", gap: "1ch" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          textShadow: "0 0 1px rgba(255, 255, 255, 1)",
                        }}
                      >
                        {`${maskLightCount}`}
                      </div>
                      <div>{maskLightCount === 1 ? "light" : "lights"}</div>
                    </div>
                  )}
                  {objectPolygonCount === undefined ? (
                    <></>
                  ) : (
                    <div style={{ display: "flex", gap: "1ch" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          textShadow: "0 0 1px rgba(255, 255, 255, 1)",
                        }}
                      >
                        {`${objectPolygonCount}`}
                      </div>
                      <div>{objectPolygonCount === 1 ? "polygon" : "polygons"}</div>
                    </div>
                  )}
                  {lightPolygonCount === undefined ? (
                    <></>
                  ) : (
                    <div style={{ display: "flex", gap: "1ch" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          textShadow: "0 0 1px rgba(255, 255, 255, 1)",
                        }}
                      >
                        {`${lightPolygonCount}`}
                      </div>
                      <div>{lightPolygonCount === 1 ? "polygon" : "polygons"}</div>
                    </div>
                  )}
                  <SvgRepo
                    title="media type"
                    svg={(() => {
                      switch (media.type) {
                        case "light":
                          return asterisk300();
                        case "object":
                          return antigravity300();
                        case "img":
                          return image200();
                        case "mask":
                          return texture300();
                        case "svg":
                          return polyline200();
                      }
                    })()}
                    containerStyle={{
                      width: dynamicSizes.footer.svgSize,
                      height: dynamicSizes.footer.svgSize,
                      marginLeft: "auto",
                    }}
                    scale={1}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export type BrorwserContextMenuMedia =
  { type: "img"; key: string; data: LaurusImgResult } | { type: "svg"; key: string; data: LaurusSvgResult };
interface BrowserContextMenu {
  media: BrorwserContextMenuMedia;
  position: CSSProperties;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
}
export function BrowserContextMenu({ media, position, framesCacheRef }: BrowserContextMenu) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          container: {
            gridTemplateRows: `min-content auto`,
            gap: 12,
            borderRadius: 10,
            fontSize: 12,
            letterSpacing: 2,
            padding: "10px 26px 10px 14px",
          },
          headerGrid: {
            gap: 4,
          },
          h1: {
            fontSize: 14,
          },
          footer: {
            padding: "20px 0px",
          },
        };
      case "midhigh":
        return {
          container: {
            gridTemplateRows: `min-content auto`,
            gap: 12,
            borderRadius: 10,
            fontSize: 10,
            letterSpacing: 2,
            padding: "8px 24px 8px 12px",
          },
          headerGrid: {
            gap: 4,
          },
          h1: {
            fontSize: 14,
          },
          footer: {
            padding: "14px 0px",
          },
        };
      case "midlow":
      case "low":
        return {
          container: {
            gridTemplateRows: `min-content auto`,
            gap: 12,
            borderRadius: 10,
            fontSize: 8,
            letterSpacing: 2,
            padding: "6px 22px 6px 10px",
          },
          headerGrid: {
            gap: 4,
          },
          h1: {
            fontSize: 12,
          },
          footer: {
            padding: "10px 0px",
          },
        };
    }
  });

  const showDeleteButton = useMemo(() => {
    switch (media.type) {
      case "img":
        return !coreState.project.browse_public_imgs;
      case "svg":
        return !coreState.project.browse_public_svgs;
    }
  }, [coreState.project.browse_public_imgs, coreState.project.browse_public_svgs, media.type]);

  const deleteProjectMedia = useCallback(
    async (
      snapshot: LaurusProjectResult,
      mediaId: string,
      newSvgs: Map<string, LaurusProjectSvg> | undefined,
      newImgs: Map<string, LaurusProjectImg> | undefined,
    ) => {
      const newProject: LaurusProjectResult = {
        ...snapshot,
        ...(newSvgs !== undefined && { svgs: newSvgs }),
        ...(newImgs !== undefined && { imgs: newImgs }),
      };
      if (newProject.project_id) {
        dispatch({ type: CoreActionType.SetProject, value: newProject });
        const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (!updated) {
          dispatch({ type: CoreActionType.SetProject, value: snapshot });
        } else {
          if (uiState.activeElement?.key == media.key) {
            uiDispatch({
              type: UIActionType.SetActiveElement,
              value: undefined,
            });
          }
          uiDispatch({
            type: UIActionType.DeleteCarouselEntry,
            key: media.key,
          });
          await deleteEffects(media.key, coreState.apiOrigin, coreState.accessToken, coreState.effects, dispatch);
          cleanUpCanvasMedia(media.type, media.key, dispatch);
          cleanUpMediaBrowser(media.type, mediaId, newProject, coreState.canvasMasks, uiDispatch);
          if (uiState.browserElement) {
            cleanUpBrowserElement(mediaId, uiState.browserElement, newProject, uiDispatch);
          }
          if (framesCacheRef.current) {
            framesCacheRef.current.delete(media.key);
          }
        }
      }
    },
    [
      dispatch,
      coreState.apiOrigin,
      coreState.accessToken,
      coreState.effects,
      coreState.canvasMasks,
      uiState.activeElement?.key,
      uiState.browserElement,
      media.key,
      media.type,
      uiDispatch,
      framesCacheRef,
    ],
  );

  return (
    <>
      <div
        style={{
          background: "rgba(17, 17, 17, 0.6)",
          backdropFilter: "blur(15px)",
          display: "grid",
          gridTemplateColumns: "1fr",
          ...position,
          ...dynamicSizes.container,
        }}
      >
        <div
          style={{
            gridRow: 1,
            gridColumn: 1,
            display: "grid",
            ...dynamicSizes.headerGrid,
          }}
        >
          <div
            style={{
              overflowX: "auto",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              ...dynamicSizes.h1,
            }}
          >
            {media.data.media_key}
          </div>
          <div title="width and height" style={{ overflowX: "auto", display: "flex", whiteSpace: "nowrap" }}>
            <div>
              {media.data.width.toFixed()}
              {" | "}
              {media.data.height.toFixed()}
            </div>
          </div>
          <div
            style={{
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {new Date(media.data.timestamp).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
        <div
          style={{
            gridRow: 2,
            gridColumn: 1,
            display: "grid",
            gridTemplateRows: showDeleteButton ? "1fr auto" : "1fr",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              height: "100%",
              flexDirection: "column",
              alignItems: "flex-start",
              overflowY: "auto",
              maxHeight: "100%",
              borderTop: "1px solid rgba(0,0,0,0)",
            }}
          >
            {media.data.categories.map((cat, i) => (
              <div key={i} style={{ padding: "2px 0" }}>
                {cat}
              </div>
            ))}
          </div>
          {showDeleteButton ? (
            <div
              style={{
                color: "rgba(242, 83, 83, 1)",
                display: "flex",
                alignItems: "center",
                height: "min-content",
                ...dynamicSizes.footer,
              }}
            >
              <div
                className={styles["animated-nav-dark"]}
                onClick={() => {
                  const confirmed = confirm("are you sure you want to delete this media?");
                  if (confirmed) {
                    const snapshot: LaurusProjectResult = {
                      ...coreState.project,
                    };
                    switch (media.type) {
                      case "img": {
                        const newImgs: Map<string, LaurusProjectImg> = new Map(snapshot.imgs);
                        newImgs.delete(media.key);
                        deleteProjectMedia(snapshot, media.data.img_media_id, undefined, newImgs);
                        break;
                      }
                      case "svg": {
                        const newSvgs: Map<string, LaurusProjectSvg> = new Map(snapshot.svgs);
                        newSvgs.delete(media.key);
                        deleteProjectMedia(snapshot, media.data.svg_media_id, newSvgs, undefined);
                        break;
                      }
                    }
                  }
                }}
              >
                {"delete"}
              </div>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
    </>
  );
}
