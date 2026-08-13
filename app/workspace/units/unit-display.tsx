import { useContext, useState, useCallback } from "react";
import { SvgRepo, chevronLeft, chevronRight } from "../../svg-repo";
import { CoreContext, HoverContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import { getDynamicUnitSizes } from "../workspace.config";
import styles from "@/app/app.module.css";
import { CarouselEntry, LaurusActiveElement, UIActionType } from "../states/ui-state";
import { parsePathPoints } from "../mask-gl";
import { LaurusMaskResult } from "../workspace.server";

// A mask has no thumbnail of its own -- shows the img its mesh was generated from instead. Only
// resolves it from what's already in memory (a still-placed project img, or the currently-browsed
// media page) -- same source project-mask-item.tsx checks first before falling back to a network
// fetch for its own GL texture load. LaurusImage's own "not found" placeholder covers the miss.
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

  let sourceImgSrc: string | undefined;
  for (const [key, img] of coreState.project.imgs) {
    if (img.img_media_id === maskData.source_img_media_id) {
      sourceImgSrc = coreState.canvasImgs.get(key)?.src;
      break;
    }
  }
  if (!sourceImgSrc) {
    sourceImgSrc = uiState.browserImgs.find((img) => img.img_media_id === maskData.source_img_media_id)?.src;
  }

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
  // Which entries this unit's chevrons are allowed to land on -- the same predicate its
  // useCarouselIndex call takes, so the two can't disagree about what's navigable. Rotate passes
  // one that rejects "capture" (a capture has no whole-element transform for rotate to act on);
  // light source passes one that accepts *only* "capture" or only "peak", depending on which
  // target it's on (see light-source-unit.tsx). The default rejects only "peak" entries, which
  // nothing but light source can ever wire.
  isEntryWireable?: (entry: CarouselEntry) => boolean;
}
export default function UnitDisplay({
  carouselIndex,
  effectKey,
  onNewLocalIndex,
  isEntryWireable = (entry) => entry.type !== "peak",
}: UnitDisplay) {
  const { coreState, notifyMaskSelectionChanged, notifyMaskSelectedCaptureChanged, notifyMaskSelectedPeakChanged } =
    useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const [dynamicSizes] = useState(() => getDynamicUnitSizes(uiState.resolution));

  // Wires this unit's effect to a carousel entry. Activation and selection are otherwise separate
  // concerns (see LaurusSelectedElement) -- this is the one place they deliberately move together,
  // and only for the two entry types with something on the mesh to look at: activating a capture or
  // a peak from a unit display also selects it, so the thing whose equation you're about to edit
  // lights up on canvas and Lightsourcebar's dials swing onto it. The "svg"/"img"/"mask" cases
  // deliberately leave the selection alone -- none of them singles out a sub-element, so moving the
  // carousel past one shouldn't take the highlight off whatever capture or peak is being tuned.
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
            type: UIActionType.SetProjectContextMenu,
            key: entry.key,
            showContextMenu: true,
          });
          break;
        }
        case "capture": {
          const newActiveElement: LaurusActiveElement = {
            key: entry.key,
            type: "capture",
            locallyActivatedEffectKey: effectKey,
            captureId: entry.captureId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: entry.key, type: "capture", captureId: entry.captureId },
          });
          notifyMaskSelectionChanged(entry.key);
          notifyMaskSelectedCaptureChanged(entry.key, entry.captureId);
          // Clears any bright peak highlight for the same reason createTopologyPeak does in
          // reverse: whichever sub-element was just singled out is this mesh's sole bright one.
          notifyMaskSelectedPeakChanged(entry.key, undefined);
          // A mask's capture (see project-mask-item.tsx) has no on-screen presence of its own to
          // anchor a context menu to beyond the mask's own -- the menu positions off that shared
          // anchor regardless of flavor, and project-mask-item.tsx's own <ContextMenu> render
          // derives "mask" vs "capture" straight from uiState.selectedElement, so the
          // SetSelectedElement dispatch above is what picks the flavor here.
          uiDispatch({
            type: UIActionType.SetProjectContextMenu,
            key: entry.key,
            showContextMenu: true,
          });
          break;
        }
        case "peak": {
          // Mirrors "capture" above exactly -- including both the shared mask anchor for the
          // context menu (a peak has no on-screen presence of its own either) and the paired
          // selection, which makes this peak the mesh's sole bright sub-element.
          const newActiveElement: LaurusActiveElement = {
            key: entry.key,
            type: "peak",
            locallyActivatedEffectKey: effectKey,
            peakId: entry.peakId,
          };
          uiDispatch({
            type: UIActionType.SetActiveElement,
            value: newActiveElement,
          });
          uiDispatch({
            type: UIActionType.SetSelectedElement,
            value: { key: entry.key, type: "peak", peakId: entry.peakId },
          });
          notifyMaskSelectionChanged(entry.key);
          notifyMaskSelectedPeakChanged(entry.key, entry.peakId);
          notifyMaskSelectedCaptureChanged(entry.key, undefined);
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
      notifyMaskSelectedCaptureChanged,
      notifyMaskSelectedPeakChanged,
    ],
  );

  // First index in `direction` from `fromIndex` this carousel is allowed to land on -- whatever
  // isEntryWireable accepts (see this file's UnitDisplay props doc comment). Returns undefined when
  // nothing navigable remains, so callers can both disable a chevron and no-op its click.
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

  // uiState.projectContextMenus is keyed by media key alone, and a mask with captures fills
  // several carouselEntries with that same key (its own "mask" entry plus one "capture" entry per
  // capture -- see CarouselEntry). Filtering "inactive" entries by index (as this used to) still
  // caught those same-key siblings, so activating one of a mask's entries and then hiding every
  // *other index* immediately re-hid the very key setActiveElement had just shown. Filtering by
  // key instead leaves every entry that shares the newly-active key alone.
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
                  case "capture": {
                    const projectMask = coreState.project.masks.get(c.key);
                    if (!projectMask) break;
                    // No separate media of its own to show a thumbnail of -- reconstructed
                    // straight from this one capture's own polygons (this carousel entry wires a
                    // single capture, not the whole mask -- see this file's "capture" case in
                    // setActiveElement above), using the same `d` path data the mesh itself renders
                    // with (see mask-gl.ts) rather than a stand-in icon.
                    const capturedPolygons = coreState.canvasMasks
                      .get(c.key)
                      ?.polygons.filter((p) => p.capture_id === c.captureId);
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
                        key={`${c.key}-capture-${c.captureId}`}
                        title="mesh capture"
                        onClick={() => {
                          if (isAltKeyPressed) return;
                          setActiveElement(i);
                          hideOtherContextMenus(i);
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
                  case "peak": {
                    const projectMask = coreState.project.masks.get(c.key);
                    if (!projectMask) break;
                    const maskData = coreState.canvasMasks.get(c.key);
                    const peak = maskData?.peaks.find((p) => p.id === c.peakId);
                    if (!maskData || !peak) break;
                    // The peak's own circle of influence, drawn in the mesh's own coordinate space
                    // (the same space maskData.polygons' `d` strings use), over the triangles it
                    // covers. Unlike a capture -- whose identity *is* its set of polygons -- a peak
                    // is defined by cx/cy/radius and only tags polygons for bookkeeping (see
                    // Peak_V1_0), so the circle is the thing worth showing and the tagged triangles
                    // are context behind it.
                    const coveredPolygons = maskData.polygons.filter((p) => p.peak_id === c.peakId);
                    const padding = peak.radius * 0.25;
                    const viewBox = [
                      peak.cx - peak.radius - padding,
                      peak.cy - peak.radius - padding,
                      Math.max(1, (peak.radius + padding) * 2),
                      Math.max(1, (peak.radius + padding) * 2),
                    ].join(" ");
                    return (
                      <div
                        key={`${c.key}-peak-${c.peakId}`}
                        title="mesh peak"
                        onClick={() => {
                          if (isAltKeyPressed) return;
                          setActiveElement(i);
                          hideOtherContextMenus(i);
                        }}
                        style={{
                          ...dynamicSizes.displaySvg,
                          display: "grid",
                          placeContent: "center",
                          cursor: isAltKeyPressed ? "crosshair" : "pointer",
                        }}
                      >
                        <svg width="100%" height="100%" viewBox={viewBox}>
                          {coveredPolygons.map((p, polygonIndex) => (
                            <path
                              key={polygonIndex}
                              d={p.d}
                              fill="none"
                              stroke="rgb(120, 120, 120)"
                              strokeWidth={1}
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                          <circle
                            cx={peak.cx}
                            cy={peak.cy}
                            r={peak.radius}
                            fill="none"
                            stroke="rgb(235, 235, 235)"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                          />
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
