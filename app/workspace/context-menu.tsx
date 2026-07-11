import { useContext, useMemo, useCallback, CSSProperties, useState, Dispatch, useEffect, RefObject } from "react";
import {
  updateProject,
  LaurusProjectImg,
  LaurusProjectSvg,
  LaurusProjectResult,
  DEFAULT_CONTEXT_MENU_CONFIG,
} from "../projects/projects.server";
import { CoreContext, LaurusTransform, UIContext } from "./workspace.client";
import {
  updateScale,
  updateMove,
  updateRotate,
  LaurusFrame,
  LaurusImgResult,
  LaurusMoveResult,
  LaurusRotateResult,
  LaurusScaleResult,
  LaurusSvgResult,
  LaurusEffect,
} from "./workspace.server";
import styles from "../app.module.css";
import { RiToolsLine } from "react-icons/ri";
import {
  allOut,
  browse,
  earthquake,
  experiment,
  keyboardCommandKey,
  lassoSelect,
  SvgRepo,
  cycle400,
} from "../svg-repo";
import Toggle from "../components/toggle";
import {
  LaurusActiveElement,
  LaurusBrowserElement,
  LaurusThumbnail,
  UIAction,
  UIActionType,
  defaultUIState,
} from "./states/ui-state";
import { CoreAction, CoreActionType } from "./states/core-state";

async function deleteEffects(
  mediaKey: string,
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  effects: LaurusEffect[],
  dispatch: Dispatch<CoreAction>,
) {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (!effect.value.math.has(mediaKey)) continue;
    switch (effect.type) {
      case "scale": {
        const newMath = new Map(effect.value.math);
        newMath.delete(mediaKey);
        const newScale: LaurusScaleResult = { ...effect.value, math: newMath };
        const updated = await updateScale(apiOrigin, accessToken, effect.key, newScale);
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffect,
            value: { type: "scale", key: effect.key, value: { ...newScale } },
          });
        }
        break;
      }
      case "move": {
        const newMath = new Map(effect.value.math);
        newMath.delete(mediaKey);
        const newMove: LaurusMoveResult = { ...effect.value, math: newMath };
        const updated = await updateMove(apiOrigin, accessToken, effect.key, {
          ...newMove,
        });
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffect,
            value: { type: "move", key: effect.key, value: { ...newMove } },
          });
        }
        break;
      }
      case "rotate": {
        const newMath = new Map(effect.value.math);
        newMath.delete(mediaKey);
        const newRotate: LaurusRotateResult = {
          ...effect.value,
          math: newMath,
        };
        const updated = await updateRotate(apiOrigin, accessToken, effect.key, {
          ...newRotate,
        });
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffect,
            value: { type: "rotate", key: effect.key, value: { ...newRotate } },
          });
        }
        break;
      }
    }
  }
}

function cleanUpCanvasMedia(mediaType: "img" | "svg", mediaKey: string, dispatch: Dispatch<CoreAction>) {
  switch (mediaType) {
    case "img": {
      dispatch({ type: CoreActionType.DeleteCanvasImg, key: mediaKey });
      break;
    }
    case "svg": {
      dispatch({ type: CoreActionType.DeleteCanvasSvg, key: mediaKey });
      break;
    }
  }
}

function cleanUpMediaBrowser(
  mediaType: "img" | "svg",
  mediaId: string,
  project: LaurusProjectResult,
  uiDispatch: Dispatch<UIAction>,
) {
  switch (mediaType) {
    case "img": {
      const stillExists = Array.from(project.imgs.values()).some((i) => i.img_media_id === mediaId);
      if (!project.browse_public_imgs && !stillExists) {
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

function projectSvgIsTransformed(svg: LaurusProjectSvg) {
  if (svg.scale_x == 1 && svg.scale_y == 1 && svg.rotate_x == 0 && svg.rotate_y == 0 && svg.rotate_z == 0) {
    return false;
  } else {
    return true;
  }
}

function projectImgIsTransformed(img: LaurusProjectImg) {
  if (img.scale_x == 1 && img.scale_y == 1 && img.rotate_x == 0 && img.rotate_y == 0 && img.rotate_z == 0) {
    return false;
  } else {
    return true;
  }
}

export type ContextMenuMedia =
  { type: "img"; key: string; meta: LaurusProjectImg } | { type: "svg"; key: string; meta: LaurusProjectSvg };
interface ContextMenu {
  media: ContextMenuMedia;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
  transform?: LaurusTransform;
}
export default function ContextMenu({ media, framesCacheRef, transform }: ContextMenu) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const contextMenuState = uiState.projectContextMenus.get(media.key);
  const contextMenuConfig = contextMenuState?.contextMenuConfig ?? DEFAULT_CONTEXT_MENU_CONFIG;
  const selected = useMemo<boolean>(() => {
    return (uiState.activeElement?.key ?? "") == media.key;
  }, [uiState.activeElement?.key, media.key]);
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
          cleanUpMediaBrowser(media.type, mediaId, newProject, uiDispatch);
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
      uiState.activeElement?.key,
      uiState.browserElement,
      media.key,
      media.type,
      uiDispatch,
      framesCacheRef,
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
      const targetItem = newImgs.get(media.key) || newSvgs.get(media.key);
      if (!targetItem) return;
      const allItems = [...newImgs.values(), ...newSvgs.values()];
      const maxOrder = allItems.length - 1;

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
    }
  }, [coreState.project.imgs, coreState.project.svgs, media.key, media.type]);

  const revertMedia = useCallback(async () => {
    const snapshot: LaurusProjectResult = { ...coreState.project };
    const newImgs = new Map(snapshot.imgs);
    const newSvgs = new Map(snapshot.svgs);
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
          };
          newSvgs.set(media.key, newSvg);
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
      dispatch({ type: CoreActionType.SetProject, value: newProject });
    }
  }, [coreState.accessToken, coreState.apiOrigin, coreState.project, dispatch, media.key, media.type]);

  const cellStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    height: "100%",
    cursor: "pointer",
    ...dynamicSizes.cell,
  };

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
                  style={{
                    overflowX: "auto",
                    fontWeight: "bold",
                    ...dynamicSizes.h1,
                  }}
                >
                  {media.meta.media_key}
                </div>
                <div title="position & size" style={{ display: "flex", ...dynamicSizes.h2 }}>
                  <div>
                    {"x"}
                    {media.meta.left.toFixed()}
                    {" | "}
                    {"y"}
                    {media.meta.top.toFixed()}
                    {" | "}
                    {"w"}
                    {media.meta.width.toFixed()}
                    {" | "}
                    {"h"}
                    {media.meta.height.toFixed()}
                  </div>
                </div>
                <div
                  title="description"
                  style={{
                    overflowX: "auto",
                    display: "flex",
                    ...dynamicSizes.h2,
                  }}
                >
                  {media.meta.description}
                </div>
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
                      textShadow: selected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                    }}
                  >
                    {"selected"}
                  </span>
                  <Toggle
                    value={selected}
                    onClick={() => {
                      if (selected) {
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
                      }
                    }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }}
                    translateX={dynamicSizes.toggle.translateX}
                  />
                </div>
                <div style={{ ...cellStyle }} className={styles["animated-nav-dark"]} onClick={swapMedia}>
                  {"swap"}
                </div>
                <div
                  style={{ ...cellStyle }}
                  className={styles["animated-nav-dark"]}
                  onClick={() => {
                    updateMediaOrder(isAltPressed ? "top" : "increment");
                  }}
                >
                  {isAltPressed ? "move to top" : "move up"}
                </div>
                <div
                  style={{ ...cellStyle }}
                  className={styles["animated-nav-dark"]}
                  onClick={() => {
                    updateMediaOrder(isAltPressed ? "bottom" : "decrement");
                  }}
                >
                  {isAltPressed ? "move to bottom" : "move down"}
                </div>
                <div
                  className={revertEnabled ? styles["animated-nav-dark"] : ""}
                  style={{
                    color: revertEnabled ? "inherit" : "rgba(127,127,127, 1)",
                    ...cellStyle,
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
                    const snapshot: LaurusProjectResult = {
                      ...coreState.project,
                    };
                    switch (media.type) {
                      case "img": {
                        const newImgs: Map<string, LaurusProjectImg> = new Map(snapshot.imgs);
                        newImgs.delete(media.key);
                        deleteProjectMedia(snapshot, media.meta.img_media_id, undefined, newImgs);
                        break;
                      }
                      case "svg": {
                        const newSvgs: Map<string, LaurusProjectSvg> = new Map(snapshot.svgs);
                        newSvgs.delete(media.key);
                        deleteProjectMedia(snapshot, media.meta.svg_media_id, newSvgs, undefined);
                        break;
                      }
                    }
                  }}
                >
                  {"delete"}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "end",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    height: "100%",
                    ...dynamicSizes.footer.div,
                  }}
                >
                  {uiState.tool.type == "none" ? (
                    <div
                      title="active tool"
                      style={{
                        display: "grid",
                        placeContent: "center",
                        width: dynamicSizes.footer.svgSize,
                        height: dynamicSizes.footer.svgSize,
                      }}
                    >
                      <RiToolsLine size={dynamicSizes.footer.svgSize} color="rgb(62, 62, 62)" />
                    </div>
                  ) : (
                    <SvgRepo
                      title="active tool"
                      svg={(() => {
                        switch (uiState.tool.type) {
                          case "marquee":
                            return lassoSelect();
                          case "contextmenu":
                            return keyboardCommandKey();
                          case "viewport":
                            return browse();
                          case "move":
                            return earthquake();
                          case "scale":
                            return allOut();
                          case "rotate":
                            return cycle400();
                          case "mix":
                            return experiment();
                        }
                      })()}
                      containerStyle={{
                        width: dynamicSizes.footer.svgSize,
                        height: dynamicSizes.footer.svgSize,
                      }}
                      scale={1}
                    />
                  )}
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
          cleanUpMediaBrowser(media.type, mediaId, newProject, uiDispatch);
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
          {/* Categories Container */}
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
