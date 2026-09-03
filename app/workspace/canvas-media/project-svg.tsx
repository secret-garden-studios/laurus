"use client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { HoverContext, LaurusTransform, UIContext } from "../workspace.client";
import { RefObject, useContext, useMemo, useState } from "react";
import { LaurusProjectSvg } from "../../projects/projects.server";
import ContextMenu from "../context-menu";
import { Z_INDEX } from "../workspace.config";
import { LaurusFrame } from "../workspace.server";
import { isMaskDropZoneArmed } from "../states/ui-state";
import { useToolCursor } from "../hooks/useToolCursor";
import { toCanvasTranslate, useCanvasZoomValue } from "../hooks/useCanvasZoom";

interface ProjectSvg {
  dndId: string;
  dndPosition: { x: number; y: number };
  zIndex: number;
  maxZIndex: number;
  mediaKey: string;
  meta: LaurusProjectSvg;
  decodedString: string;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
  onClick: (metaKey: boolean) => void;
  onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void;
  refKey?: string;
  title?: string;
  transform?: LaurusTransform;
}
export function ProjectSvg({
  dndId,
  dndPosition,
  zIndex,
  maxZIndex,
  mediaKey,
  meta,
  decodedString,
  framesCacheRef,
  onClick,
  onSvgRef,
  refKey,
  title,
  transform,
}: ProjectSvg) {
  const { uiState } = useContext(UIContext);
  const contextMenuState = uiState.projectContextMenus.get(mediaKey);
  const showContextMenu = contextMenuState?.showContextMenu ?? false;
  const { selectedSvgKeys, isAltKeyPressed, isMetaKeyPressed } = useContext(HoverContext);
  const dropZoneArmed = isMaskDropZoneArmed(uiState, { meta: isMetaKeyPressed, alt: isAltKeyPressed });
  const isSelected = selectedSvgKeys.has(mediaKey);

  const dragDisabled = useMemo(() => {
    return uiState.tool.type != "move";
  }, [uiState.tool.type]);
  const isStackable = useMemo(() => {
    return uiState.tool.type === "marquee" && uiState.tool.stack;
  }, [uiState.tool]);
  const {
    listeners,
    setNodeRef,
    transform: dndTransform,
    isDragging,
  } = useDraggable({
    id: dndId,
    disabled: dragDisabled ?? false,
  });
  const [isHovered, setIsHovered] = useState(false);
  const containerSize = useMemo(() => {
    return {
      width: meta.width * meta.scale_x,
      height: meta.height * meta.scale_y,
    };
  }, [meta.height, meta.scale_x, meta.scale_y, meta.width]);
  const canvasZoom = useCanvasZoomValue();
  const dndCss = {
    left: dndPosition.x,
    top: dndPosition.y,
    transform: CSS.Translate.toString(toCanvasTranslate(dndTransform, canvasZoom)),
    touchAction: "none",
  };

  const svgCursor = useToolCursor({ target: "svg", dragDisabled, isDragging, isStackable });

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...dndCss,
          position: "absolute",
          ...containerSize,
          zIndex: showContextMenu ? Z_INDEX.CONTEXT_MENU_OFFSET + maxZIndex + zIndex : zIndex,
          pointerEvents: dropZoneArmed ? "none" : undefined,
        }}
      >
        <div
          {...listeners}
          title={title}
          onClick={(e) => onClick(e.metaKey)}
          onMouseEnter={() => {
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}
          style={{
            ...(transform && { ...transform.cssProps }),
            position: "relative",
            zIndex: Z_INDEX.ITEM_CONTENT,
            cursor: svgCursor,
          }}
        >
          <div
            style={{
              ...containerSize,
              display: "grid",
              placeContent: "center",
              cursor: "inherit",
              outline: isSelected
                ? "2px solid rgba(66, 133, 244, 1)"
                : (isStackable || isAltKeyPressed) && isHovered
                  ? "2px solid rgba(255, 255, 255, 0.9)"
                  : showContextMenu
                    ? "1px solid rgba(255, 255, 255, 0.175)"
                    : "none",
              backdropFilter: showContextMenu ? "blur(10px)" : "none",
              background: showContextMenu
                ? `
                                linear-gradient(to right, rgba(255, 255, 255, 0.055) 0.5px, transparent 1px) 0 0 / 20px 20px,
                                linear-gradient(to bottom, rgba(255, 255, 255, 0.055) 0.5px, transparent 1px) 0 0 / 20px 20px,
                                linear-gradient(45deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0.005))
                            `
                : "none",
            }}
          >
            {decodedString && (
              <svg
                ref={(r) => {
                  if (onSvgRef && refKey) {
                    onSvgRef(r, `${refKey}`);
                  }
                }}
                version="1.1"
                width={containerSize.width}
                height={containerSize.height}
                fill={meta.fill}
                stroke={meta.stroke}
                strokeWidth={meta.stroke_width}
                viewBox={meta.viewbox}
                dangerouslySetInnerHTML={{ __html: decodedString }}
              />
            )}
          </div>
        </div>
        {showContextMenu && (
          <ContextMenu
            media={{
              key: mediaKey,
              type: "svg",
              meta: meta,
            }}
            framesCacheRef={framesCacheRef}
            transform={transform}
          />
        )}
      </div>
    </>
  );
}
