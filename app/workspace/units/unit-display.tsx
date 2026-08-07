import { useContext, useState, useCallback } from "react";
import { SvgRepo, chevronLeft, chevronRight } from "../../svg-repo";
import { CoreContext, HoverContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import { getDynamicUnitSizes } from "../workspace.config";
import styles from "@/app/app.module.css";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { parsePathPoints } from "../mask-gl";

interface UnitDisplay {
  carouselIndex: number;
  effectKey: string;
  localIndex: number;
  onNewLocalIndex: (v: number) => void;
}
export default function UnitDisplay({ carouselIndex, effectKey, localIndex, onNewLocalIndex }: UnitDisplay) {
  const { coreState } = useContext(CoreContext);
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
          // A mask's capture (see project-mask-item.tsx) has no on-screen presence of its own to
          // anchor a context menu to beyond the mask's own -- becoming the active element
          // highlights the mesh triangles it covers instead (highlightedPolygonIndices).
          break;
        }
      }
    },
    [uiState.carouselEntries, effectKey, uiDispatch],
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
              svg={
                uiState.carouselEntries.length == 0 || carouselIndex == 0 ? chevronLeft("rgb(67,67,67)") : chevronLeft()
              }
              containerStyle={{
                width: 30,
                height: 30,
                cursor: isAltKeyPressed ? "crosshair" : "pointer",
              }}
              scale={1}
              onContainerClick={() => {
                if (isAltKeyPressed) return;
                const newIndex = Math.max(carouselIndex - 1, 0);
                const newLocalIndex = Math.max(localIndex - 1, 0);
                onNewLocalIndex(newLocalIndex);
                setActiveElement(newIndex);
                const inactives = uiState.carouselEntries.filter((_, index) => index !== newIndex);
                inactives.forEach((ce) => {
                  hideContextMenu(ce);
                });
              }}
            />
          </div>
          {/* active element */}
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
                          const inactives = uiState.carouselEntries.filter((_, index) => index !== i);
                          inactives.forEach((ce) => {
                            hideContextMenu(ce);
                          });
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
                          const inactives = uiState.carouselEntries.filter((_, index) => index !== i);
                          inactives.forEach((ce) => {
                            hideContextMenu(ce);
                          });
                        }}
                        scale={1}
                        scaleToContaier={true}
                      />
                    );
                  }
                  case "mask": {
                    const projectMask = coreState.project.masks.get(c.key);
                    if (!projectMask) break;
                    // No separate media of its own to show a thumbnail of -- reconstructed
                    // straight from the mask's own captured polygons (same `d` path data the
                    // mesh itself renders with, see mask-gl.ts) rather than a stand-in icon.
                    const capturedPolygons = coreState.canvasMasks.get(c.key)?.polygons.filter((p) => p.captured);
                    if (!capturedPolygons || capturedPolygons.length === 0) break;
                    const capturedPoints = capturedPolygons.flatMap((p) => parsePathPoints(p.d));
                    if (capturedPoints.length === 0) break;
                    const xs = capturedPoints.map(([x]) => x);
                    const ys = capturedPoints.map(([, y]) => y);
                    const minX = Math.min(...xs);
                    const minY = Math.min(...ys);
                    const boundsWidth = Math.max(1, Math.max(...xs) - minX);
                    const boundsHeight = Math.max(1, Math.max(...ys) - minY);
                    return (
                      <div
                        key={c.key}
                        title="mesh capture"
                        onClick={() => {
                          if (isAltKeyPressed) return;
                          setActiveElement(i);
                          const inactives = uiState.carouselEntries.filter((_, index) => index !== i);
                          inactives.forEach((ce) => {
                            hideContextMenu(ce);
                          });
                        }}
                        style={{
                          ...dynamicSizes.displaySvg,
                          display: "grid",
                          placeContent: "center",
                          cursor: isAltKeyPressed ? "crosshair" : "pointer",
                        }}
                      >
                        <svg width="100%" height="100%" viewBox={`${minX} ${minY} ${boundsWidth} ${boundsHeight}`}>
                          {capturedPolygons.map((p, polygonIndex) => (
                            <path
                              key={polygonIndex}
                              d={p.d}
                              fill="none"
                              stroke="rgb(235, 235, 235)"
                              strokeWidth={1}
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                        </svg>
                      </div>
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
              svg={
                uiState.carouselEntries.length == 0 || carouselIndex >= uiState.carouselEntries.length - 1
                  ? chevronRight("rgb(67,67,67)")
                  : chevronRight()
              }
              containerStyle={{
                width: 30,
                height: 30,
                cursor: isAltKeyPressed ? "crosshair" : "pointer",
              }}
              scale={1}
              onContainerClick={() => {
                if (isAltKeyPressed) return;
                const newIndex = Math.min(carouselIndex + 1, Math.max(uiState.carouselEntries.length - 1, 0));
                const newLocalIndex = Math.min(localIndex + 1, Math.max(uiState.carouselEntries.length - 1, 0));
                onNewLocalIndex(newLocalIndex);
                setActiveElement(newIndex);
                const inactives = uiState.carouselEntries.filter((_, index) => index !== newIndex);
                inactives.forEach((ce) => {
                  hideContextMenu(ce);
                });
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
