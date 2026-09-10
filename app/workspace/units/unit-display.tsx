import { useContext, useState, useCallback } from "react";
import { SvgRepo, chevronLeft200, chevronRight200 } from "../../svg-repo";
import { CoreContext, HoverContext, MaskContext, UIContext } from "../workspace.client";
import LaurusImage, { pxSizes } from "../../components/laurus-image";
import styles from "@/app/app.module.css";
import { CarouselEntry, LaurusActiveElement, UIActionType, isMaskEditSubject } from "../states/ui-state";
import { useSelectionGuard } from "../hooks/useMaskEditExit";
import { maskGeometry } from "../canvas-media/mask-geometry";
import { CIRCLE_SHAPE, ObjectOrLightThumbnail, resolveSourceImgSrc } from "../canvas-media/object-or-light-thumbnail";
import { LaurusMaskResult } from "../workspace.server";

function MaskThumbnail({
  mediaKey,
  maskData,
  isAltKeyPressed,
  onClick,
}: {
  mediaKey: string;
  maskData: LaurusMaskResult;
  isAltKeyPressed: boolean;
  onClick: () => void;
}) {
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          display: {
            width: 280,
            height: 280,
            borderRadius: 10,
          },
          glow: 6,
        };
      case "midhigh":
        return {
          display: {
            width: 200,
            height: 200,
            borderRadius: 10,
          },
          glow: 4,
        };
      case "midlow":
      case "low":
        return {
          display: {
            width: Math.round(280 * uiState.resolution.factor),
            height: Math.round(280 * uiState.resolution.factor),
            borderRadius: 10,
          },
          glow: 4,
        };
    }
  });

  const sourceImgSrc = resolveSourceImgSrc(coreState, uiState.browserImgs, maskData.source_img_media_id);

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        cursor: isAltKeyPressed ? "crosshair" : "pointer",
        filter: `drop-shadow(0px 0px ${dynamicSizes.glow}px rgba(0, 0, 0, 0.75))`,
        ...dynamicSizes.display,
      }}
    >
      <LaurusImage
        draggable={false}
        alt={mediaKey}
        src={sourceImgSrc ?? ""}
        fill
        sizes={pxSizes(dynamicSizes.display.width, 200)}
        style={{ objectFit: "cover", borderRadius: dynamicSizes.display.borderRadius }}
      />
    </div>
  );
}

interface UnitDisplay {
  carouselIndex: number;
  effectKey: string;
  onNewLocalIndex: (v: number) => void;
  isEntryWireable?: (entry: CarouselEntry) => boolean;
}
export default function UnitDisplay({
  carouselIndex,
  effectKey,
  onNewLocalIndex,
  isEntryWireable = () => true,
}: UnitDisplay) {
  const { coreState } = useContext(CoreContext);
  const { notifyMaskSelectionChanged, notifyMaskSelectedLightChanged, notifyMaskSelectedObjectChanged } =
    useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);

  const editedShapePath = useCallback(
    (entry: CarouselEntry): string | undefined => {
      const session = uiState.maskEdit;
      return session && isMaskEditSubject(session, entry) ? session.editedShape?.path : undefined;
    },
    [uiState.maskEdit],
  );
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          param: {
            padding: "0 20px 20px 20px",
          },
          display: {
            width: 400,
            height: 450,
            padding: 0,
          },
          frame: {
            borderRadius: 10,
            borderWidth: 1,
          },
          chevron: {
            width: 38,
            height: 38,
          },
          displayImg: {
            width: 280,
            height: 280,
            borderRadius: 10,
          },
          thumbnail: {
            display: {
              width: 280,
              height: 280,
              borderRadius: 10,
            },
            scrim: {
              blur: 9,
            },
            shape: {
              size: 186,
              glow: 6,
              anchor: {
                fraction: 0.011,
                minRadius: 2.75,
              },
              outline: {
                fraction: 0.008,
                minWidth: 1.5,
              },
            },
          },
          glow: 6,
          displaySvg: {
            width: 200,
            height: 200,
          },
        };
      case "midhigh":
        return {
          param: {
            padding: "0 22px 14px 14px",
          },
          display: {
            width: 280,
            height: 315,
            padding: 0,
          },
          frame: {
            borderRadius: 10,
            borderWidth: 1,
          },
          chevron: {
            width: 30,
            height: 30,
          },
          displayImg: {
            width: 200,
            height: 200,
            borderRadius: 10,
          },
          thumbnail: {
            display: {
              width: 200,
              height: 200,
              borderRadius: 10,
            },
            scrim: {
              blur: 9,
            },
            shape: {
              size: 140,
              glow: 4,
              anchor: {
                fraction: 0.011,
                minRadius: 2.15,
              },
              outline: {
                fraction: 0.008,
                minWidth: 1,
              },
            },
          },
          glow: 4,
          displaySvg: {
            width: 140,
            height: 140,
          },
        };
      case "midlow":
      case "low":
        return {
          param: {
            padding: "0 18px 10px 10px",
          },
          display: {
            width: Math.round(400 * uiState.resolution.factor),
            height: Math.round(450 * uiState.resolution.factor),
            padding: 0,
          },
          frame: {
            borderRadius: 10,
            borderWidth: 1,
          },
          chevron: {
            width: 20,
            height: 20,
          },
          displayImg: {
            width: Math.round(280 * uiState.resolution.factor),
            height: Math.round(280 * uiState.resolution.factor),
            borderRadius: 10,
          },
          thumbnail: {
            display: {
              width: Math.round(280 * uiState.resolution.factor),
              height: Math.round(280 * uiState.resolution.factor),
              borderRadius: 10,
            },
            scrim: {
              blur: 9,
            },
            shape: {
              size: Math.round(174 * uiState.resolution.factor),
              glow: 4,
              anchor: {
                fraction: 0.011,
                minRadius: 1.5,
              },
              outline: {
                fraction: 0.008,
                minWidth: 0.5,
              },
            },
          },
          glow: 4,
          displaySvg: {
            width: Math.round(200 * uiState.resolution.factor),
            height: Math.round(200 * uiState.resolution.factor),
          },
        };
    }
  });
  const guardSelection = useSelectionGuard();
  const setActiveElement = useCallback(
    (newCarouselIndex: number) => {
      if (uiState.carouselEntries.length <= newCarouselIndex) return;
      if (newCarouselIndex < 0) return;
      const entry: CarouselEntry = {
        ...uiState.carouselEntries[newCarouselIndex],
      };
      switch (entry.type) {
        case "svg": {
          const newActiveElement: LaurusActiveElement = {
            key: entry.key,
            type: "svg",
            locallyActivatedEffectKey: effectKey,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: entry.key,
            showContextMenu: true,
          });
          break;
        }
        case "img": {
          const newActiveElement: LaurusActiveElement = {
            key: entry.key,
            type: "img",
            locallyActivatedEffectKey: effectKey,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: entry.key,
            showContextMenu: true,
          });
          break;
        }
        case "mask": {
          const newActiveElement: LaurusActiveElement = {
            key: entry.key,
            type: "mask",
            locallyActivatedEffectKey: effectKey,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: entry.key, type: "mask" },
          });
          notifyMaskSelectionChanged(entry.key);
          notifyMaskSelectedLightChanged(entry.key, undefined);
          notifyMaskSelectedObjectChanged(entry.key, undefined);
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: entry.key,
            showContextMenu: true,
          });
          break;
        }
        case "light": {
          const newActiveElement: LaurusActiveElement = {
            key: entry.key,
            type: "light",
            locallyActivatedEffectKey: effectKey,
            lightId: entry.lightId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: entry.key, type: "light", lightId: entry.lightId },
          });
          notifyMaskSelectionChanged(entry.key);
          notifyMaskSelectedLightChanged(entry.key, entry.lightId);
          notifyMaskSelectedObjectChanged(entry.key, undefined);
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: entry.key,
            showContextMenu: true,
          });
          break;
        }
        case "object": {
          const newActiveElement: LaurusActiveElement = {
            key: entry.key,
            type: "object",
            locallyActivatedEffectKey: effectKey,
            objectId: entry.objectId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: entry.key, type: "object", objectId: entry.objectId },
          });
          notifyMaskSelectionChanged(entry.key);
          notifyMaskSelectedObjectChanged(entry.key, entry.objectId);
          notifyMaskSelectedLightChanged(entry.key, undefined);
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: entry.key,
            showContextMenu: true,
          });
          break;
        }
      }
    },
    [
      uiState.carouselEntries,
      effectKey,
      uiDispatch,
      notifyMaskSelectionChanged,
      notifyMaskSelectedLightChanged,
      notifyMaskSelectedObjectChanged,
    ],
  );

  const findNavigableIndex = useCallback(
    (fromIndex: number, direction: 1 | -1): number | undefined => {
      let i = fromIndex + direction;
      while (i >= 0 && i < uiState.carouselEntries.length) {
        if (isEntryWireable(uiState.carouselEntries[i])) return i;
        i += direction;
      }
      return undefined;
    },
    [uiState.carouselEntries, isEntryWireable],
  );

  const hideContextMenu = useCallback(
    (entry: CarouselEntry) => {
      uiDispatch({
        type: UIActionType.SetProjectContextMenu,
        key: entry.key,
        showContextMenu: false,
      });
    },
    [uiDispatch],
  );

  const hideOtherContextMenus = useCallback(
    (activeIndex: number) => {
      if (activeIndex < 0 || activeIndex >= uiState.carouselEntries.length) return;
      const activeKey = uiState.carouselEntries[activeIndex].key;
      uiState.carouselEntries.forEach((ce) => {
        if (ce.key !== activeKey) hideContextMenu(ce);
      });
    },
    [uiState.carouselEntries, hideContextMenu],
  );

  return (
    <>
      <div style={{ padding: dynamicSizes.param.padding }}>
        <div
          className={styles["large-tiled-background-squares"]}
          style={{
            display: "grid",
            borderRadius: dynamicSizes.frame.borderRadius,
            border: `${dynamicSizes.frame.borderWidth}px solid rgba(10,10,10,1)`,
            gridTemplateColumns: "min-content auto min-content",
            ...dynamicSizes.display,
          }}
        >
          <div
            style={{
              height: "100%",
              display: "grid",
              placeContent: "center",
            }}
          >
            <SvgRepo
              title={"previous"}
              svg={
                findNavigableIndex(carouselIndex, -1) === undefined ? chevronLeft200("rgb(67,67,67)") : chevronLeft200()
              }
              containerStyle={{
                width: dynamicSizes.chevron.width,
                height: dynamicSizes.chevron.height,
                cursor: isAltKeyPressed
                  ? "crosshair"
                  : findNavigableIndex(carouselIndex, -1) === undefined
                    ? ""
                    : "pointer",
              }}
              scale={0.8}
              scaleToContaier={true}
              onContainerClick={() => {
                if (isAltKeyPressed) return;
                const newIndex = findNavigableIndex(carouselIndex, -1);
                if (newIndex === undefined) return;
                const entry = uiState.carouselEntries[newIndex];
                if (entry && !guardSelection(entry)) return;
                onNewLocalIndex(newIndex);
                setActiveElement(newIndex);
                hideOtherContextMenus(newIndex);
              }}
            />
          </div>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeContent: "center",
            }}
          >
            {uiState.carouselEntries.map((c, i) => {
              if (i == carouselIndex) {
                switch (c.type) {
                  case "img": {
                    const projectImg = coreState.project.imgs.get(c.key);
                    if (!projectImg) break;
                    const canvasImg = coreState.canvasImgs.get(c.key);
                    if (!canvasImg) return;
                    return (
                      <div
                        key={c.key}
                        onClick={() => {
                          if (isAltKeyPressed) return;
                          if (!guardSelection(c)) return;
                          setActiveElement(i);
                          hideOtherContextMenus(i);
                        }}
                        style={{
                          position: "relative",
                          cursor: isAltKeyPressed ? "crosshair" : "pointer",
                          filter: `drop-shadow(0px 0px ${dynamicSizes.glow}px rgba(0, 0, 0, 0.75))`,
                          ...dynamicSizes.displayImg,
                        }}
                      >
                        <LaurusImage
                          draggable={false}
                          alt={c.key}
                          src={canvasImg.src}
                          fill
                          sizes={pxSizes(dynamicSizes.displayImg.width, 200)}
                          style={{
                            objectFit: "cover",
                            borderRadius: dynamicSizes.displayImg.borderRadius,
                          }}
                        />
                      </div>
                    );
                  }
                  case "svg": {
                    const projectSvg = coreState.project.svgs.get(c.key);
                    if (!projectSvg) break;
                    const canvasSvg = coreState.canvasSvgs.get(c.key);
                    if (!canvasSvg) return;
                    return (
                      <SvgRepo
                        key={c.key}
                        svg={canvasSvg}
                        containerStyle={{
                          ...dynamicSizes.displaySvg,
                          cursor: isAltKeyPressed ? "crosshair" : "pointer",
                        }}
                        onContainerClick={() => {
                          if (isAltKeyPressed) return;
                          if (!guardSelection(c)) return;
                          setActiveElement(i);
                          hideOtherContextMenus(i);
                        }}
                        scale={1}
                        scaleToContaier={true}
                      />
                    );
                  }
                  case "mask": {
                    const projectMask = coreState.project.masks.get(c.key);
                    if (!projectMask) break;
                    const maskData = coreState.canvasMasks.get(c.key);
                    if (!maskData) break;
                    return (
                      <MaskThumbnail
                        key={c.key}
                        mediaKey={c.key}
                        maskData={maskData}
                        isAltKeyPressed={isAltKeyPressed}
                        onClick={() => {
                          if (isAltKeyPressed) return;
                          if (!guardSelection(c)) return;
                          setActiveElement(i);
                          hideOtherContextMenus(i);
                        }}
                      />
                    );
                  }
                  case "light": {
                    const projectMask = coreState.project.masks.get(c.key);
                    if (!projectMask) break;
                    const maskData = coreState.canvasMasks.get(c.key);
                    if (!maskData) break;
                    const litPolygons = maskData.polygons.filter((p) => p.light_id === c.lightId);
                    if (litPolygons.length === 0) break;
                    const litGeometry = maskGeometry(maskData);
                    const hasLitGeometry = maskData.polygons.some(
                      (p, index) => p.light_id === c.lightId && (litGeometry.points[index]?.length ?? 0) > 0,
                    );
                    if (!hasLitGeometry) break;
                    const light = maskData.lights.find((cap) => cap.id === c.lightId);
                    return (
                      <ObjectOrLightThumbnail
                        key={`${c.key}-light-${c.lightId}`}
                        title="light"
                        shape={editedShapePath(c) ?? (light?.shape || CIRCLE_SHAPE)}
                        sourceImgMediaId={maskData.source_img_media_id}
                        sizes={dynamicSizes.thumbnail}
                        onClick={() => {
                          if (isAltKeyPressed) return;
                          if (!guardSelection(c)) return;
                          setActiveElement(i);
                          hideOtherContextMenus(i);
                        }}
                      />
                    );
                  }
                  case "object": {
                    const projectMask = coreState.project.masks.get(c.key);
                    if (!projectMask) break;
                    const maskData = coreState.canvasMasks.get(c.key);
                    const object = maskData?.objects.find((p) => p.id === c.objectId);
                    if (!maskData || !object) break;
                    return (
                      <ObjectOrLightThumbnail
                        key={`${c.key}-object-${c.objectId}`}
                        title="object"
                        shape={editedShapePath(c) ?? (object.shape || CIRCLE_SHAPE)}
                        sourceImgMediaId={maskData.source_img_media_id}
                        sizes={dynamicSizes.thumbnail}
                        onClick={() => {
                          if (isAltKeyPressed) return;
                          if (!guardSelection(c)) return;
                          setActiveElement(i);
                          hideOtherContextMenus(i);
                        }}
                      />
                    );
                  }
                }
              }
            })}
          </div>
          <div
            style={{
              height: "100%",
              display: "grid",
              placeContent: "center",
            }}
          >
            <SvgRepo
              title={"next"}
              svg={
                findNavigableIndex(carouselIndex, 1) === undefined
                  ? chevronRight200("rgb(67,67,67)")
                  : chevronRight200()
              }
              containerStyle={{
                width: dynamicSizes.chevron.width,
                height: dynamicSizes.chevron.height,
                cursor: isAltKeyPressed
                  ? "crosshair"
                  : findNavigableIndex(carouselIndex, 1) === undefined
                    ? ""
                    : "pointer",
              }}
              scale={0.8}
              scaleToContaier={true}
              onContainerClick={() => {
                if (isAltKeyPressed) return;
                const newIndex = findNavigableIndex(carouselIndex, 1);
                if (newIndex === undefined) return;
                const entry = uiState.carouselEntries[newIndex];
                if (entry && !guardSelection(entry)) return;
                onNewLocalIndex(newIndex);
                setActiveElement(newIndex);
                hideOtherContextMenus(newIndex);
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function DeepControls() {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          param: {
            padding: "0 20px 20px 20px",
          },
          display: {
            width: 400,
            height: 450,
            padding: 0,
          },
          message: {
            fontSize: 16,
          },
          content: {
            gap: 4,
          },
        };
      case "midhigh":
        return {
          param: {
            padding: "0 22px 14px 14px",
          },
          display: {
            width: 280,
            height: 315,
            padding: 0,
          },
          message: {
            fontSize: 16,
          },
          content: {
            gap: 4,
          },
        };
      case "midlow":
      case "low":
        return {
          param: {
            padding: "0 18px 10px 10px",
          },
          display: {
            width: Math.round(400 * uiState.resolution.factor),
            height: Math.round(450 * uiState.resolution.factor),
            padding: 0,
          },
          message: {
            fontSize: 16,
          },
          content: {
            gap: 4,
          },
        };
    }
  });
  return (
    <>
      <div
        style={{
          gridColumn: "span 2",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: dynamicSizes.message.fontSize,
          padding: dynamicSizes.param.padding,
        }}
      >
        <div
          style={{
            display: "grid",
            height: `${dynamicSizes.display.height}px`,
            alignContent: "center",
            gap: dynamicSizes.content.gap,
          }}
        >
          <div>{"coming soon..."}</div>
        </div>
      </div>
    </>
  );
}
