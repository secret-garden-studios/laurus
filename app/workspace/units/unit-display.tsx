import { useContext, useState, useCallback } from "react";
import { dmSans } from "@/app/fonts";
import { LaurusClientSvg, SvgRepo, antigravity200, asterisk200, chevronLeft, chevronRight } from "../../svg-repo";
import { CoreContext, HoverContext, MaskContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import { getDynamicUnitSizes } from "../workspace.config";
import styles from "@/app/app.module.css";
import { CarouselEntry, LaurusActiveElement, UIActionType, UIState } from "../states/ui-state";
import { maskGeometry } from "../canvas-media/mask-geometry";
import { LaurusMaskResult } from "../workspace.server";
import { CoreState } from "../states/core-state";

function resolveSourceImgSrc(coreState: CoreState, browserImgs: UIState["browserImgs"], sourceImgMediaId: string) {
  for (const [key, img] of coreState.project.imgs) {
    if (img.img_media_id === sourceImgMediaId) {
      return coreState.canvasImgs.get(key)?.src;
    }
  }
  return browserImgs.find((img) => img.img_media_id === sourceImgMediaId)?.src;
}

function ObjectOrLightThumbnail({
  title,
  polygonCount,
  name,
  sourceImgMediaId,
  icon,
  style,
  onClick,
}: {
  title: string;
  polygonCount: number;
  name: string;
  sourceImgMediaId: string;
  icon: LaurusClientSvg;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const { isAltKeyPressed } = useContext(HoverContext);
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const sourceImgSrc = resolveSourceImgSrc(coreState, uiState.browserImgs, sourceImgMediaId);
  const iconSize = Math.round((typeof style.width === "number" ? style.width : 200) * 0.4);
  return (
    <div
      title={title}
      onClick={onClick}
      style={{
        ...style,
        position: "relative",
        display: "grid",
        placeContent: "center",
        cursor: isAltKeyPressed ? "crosshair" : "pointer",
        backgroundColor: "rgb(50, 50, 50)",
      }}
    >
      <LaurusImage
        draggable={false}
        alt={sourceImgSrc ?? ""}
        src={sourceImgSrc ?? ""}
        fill
        style={{
          objectFit: "cover",
        }}
      />

      <div
        className={dmSans.className}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(8px)",
        }}
      />
      <SvgRepo
        svg={icon}
        scale={1}
        scaleToContaier
        containerStyle={{
          position: "relative",
          width: iconSize,
          height: iconSize,
          filter: "drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.9))",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 16,
          bottom: 16,
          left: 4,
          right: 4,
          fontSize: 12,
          letterSpacing: 2,
          display: "grid",
          flexDirection: "column",
          alignContent: "space-between",
          justifyContent: "center",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div
          style={{
            textShadow: "0px 0px 1px rgba(255, 255, 255, 0.9)",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {`${name}`}
        </div>
        <div
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "flex",
            gap: 4,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              textShadow: "0 0 1px rgba(255, 255, 255, 1)",
            }}
          >
            {`${polygonCount}`}
          </div>
          {`polygons`}
        </div>
      </div>
    </div>
  );
}

function MaskThumbnail({
  mediaKey,
  maskData,
  isAltKeyPressed,
  style,
  onClick,
}: {
  mediaKey: string;
  maskData: LaurusMaskResult;
  isAltKeyPressed: boolean;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);

  const sourceImgSrc = resolveSourceImgSrc(coreState, uiState.browserImgs, maskData.source_img_media_id);

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        cursor: isAltKeyPressed ? "crosshair" : "pointer",
        ...style,
      }}
    >
      <LaurusImage draggable={false} alt={mediaKey} src={sourceImgSrc ?? ""} fill style={{ objectFit: "cover" }} />
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
  const [dynamicSizes] = useState(() => getDynamicUnitSizes(uiState.resolution));
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
            borderRadius: 10,
            border: "1px solid rgba(10,10,10,1)",
            gridTemplateColumns: "min-content auto min-content",
            ...dynamicSizes.display,
          }}
        >
          <div
            style={{
              width: 30,
              height: "100%",
              display: "grid",
              placeContent: "center",
            }}
          >
            <SvgRepo
              title={"select previous"}
              svg={findNavigableIndex(carouselIndex, -1) === undefined ? chevronLeft("rgb(67,67,67)") : chevronLeft()}
              containerStyle={{
                width: 30,
                height: 30,
                cursor: isAltKeyPressed ? "crosshair" : "pointer",
              }}
              scale={1}
              onContainerClick={() => {
                if (isAltKeyPressed) return;
                const newIndex = findNavigableIndex(carouselIndex, -1);
                if (newIndex === undefined) return;
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
                          setActiveElement(i);
                          hideOtherContextMenus(i);
                        }}
                        style={{
                          position: "relative",
                          cursor: isAltKeyPressed ? "crosshair" : "pointer",
                          ...dynamicSizes.displayImg,
                        }}
                      >
                        <LaurusImage
                          draggable={false}
                          alt={c.key}
                          src={canvasImg.src}
                          fill
                          style={{
                            objectFit: "cover",
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
                        style={dynamicSizes.displayImg}
                        onClick={() => {
                          if (isAltKeyPressed) return;
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
                    const name = light ? (light.description ? light.description : light.name) : `light ${c.lightId}`;
                    return (
                      <ObjectOrLightThumbnail
                        key={`${c.key}-light-${c.lightId}`}
                        title="mesh light"
                        polygonCount={litPolygons.length}
                        name={name}
                        sourceImgMediaId={maskData.source_img_media_id}
                        icon={asterisk200("rgb(255, 255, 255)")}
                        style={dynamicSizes.displayImg}
                        onClick={() => {
                          if (isAltKeyPressed) return;
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
                    const coveredPolygonCount = maskData.polygons.filter((p) => p.object_id === c.objectId).length;
                    const name = object.description
                      ? object.description
                      : object.name
                        ? object.name
                        : `object ${c.objectId}`;
                    return (
                      <ObjectOrLightThumbnail
                        key={`${c.key}-object-${c.objectId}`}
                        title="mesh object"
                        polygonCount={coveredPolygonCount}
                        name={name}
                        sourceImgMediaId={maskData.source_img_media_id}
                        icon={antigravity200("rgb(255, 255, 255)")}
                        style={dynamicSizes.displayImg}
                        onClick={() => {
                          if (isAltKeyPressed) return;
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
              width: 30,
              height: "100%",
              display: "grid",
              placeContent: "center",
            }}
          >
            <SvgRepo
              title={"select next"}
              svg={findNavigableIndex(carouselIndex, 1) === undefined ? chevronRight("rgb(67,67,67)") : chevronRight()}
              containerStyle={{
                width: 30,
                height: 30,
                cursor: isAltKeyPressed ? "crosshair" : "pointer",
              }}
              scale={1}
              onContainerClick={() => {
                if (isAltKeyPressed) return;
                const newIndex = findNavigableIndex(carouselIndex, 1);
                if (newIndex === undefined) return;
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
  const [dynamicSizes] = useState(() => getDynamicUnitSizes(uiState.resolution));
  return (
    <>
      <div
        style={{
          gridColumn: "span 2",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 16,
          padding: dynamicSizes.param.padding,
        }}
      >
        <div
          style={{
            display: "grid",
            height: `${dynamicSizes.display.height}px`,
            alignContent: "center",
            gap: 4,
          }}
        >
          <div>{"coming soon..."}</div>
        </div>
      </div>
    </>
  );
}
