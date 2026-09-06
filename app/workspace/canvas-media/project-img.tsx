"use client";
import LaurusImage, { pxSizes } from "../../components/laurus-image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { HoverContext, LaurusTransform } from "../workspace.client";
import { RefObject, useContext, useMemo, useState } from "react";
import { LaurusProjectImg } from "../../projects/projects.server";
import ContextMenu from "../context-menu";
import { Z_INDEX } from "../workspace.config";
import { LaurusFrame, LaurusImgResult } from "../workspace.server";
import { isMaskDropZoneArmed } from "../states/ui-state";
import { useUIBrowserElement, useUIContextMenuOpen, useUIMaskEdit, useUITool } from "../states/ui-store";
import { useToolCursor } from "../hooks/useToolCursor";
import { toCanvasTranslate, useCanvasZoomValue } from "../hooks/useCanvasZoom";

interface ProjectImg {
  dndId: string;
  dndPosition: { x: number; y: number };
  zIndex: number;
  maxZIndex: number;
  mediaKey: string;
  meta: LaurusProjectImg;
  data: LaurusImgResult;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
  onClick: (metaKey: boolean) => void;
  onImgRef?: (element: HTMLImageElement | null, refKey: string) => void;
  refKey?: string;
  title?: string;
  transform?: LaurusTransform;
}
export function ProjectImg({
  dndId,
  dndPosition,
  zIndex,
  maxZIndex,
  mediaKey,
  meta,
  data,
  framesCacheRef,
  onClick,
  onImgRef,
  refKey,
  title,
  transform,
}: ProjectImg) {
  const tool = useUITool();
  const maskEdit = useUIMaskEdit();
  const browserElement = useUIBrowserElement();
  const showContextMenu = useUIContextMenuOpen(mediaKey);
  const { selectedImgKeys, isAltKeyPressed, isMetaKeyPressed } = useContext(HoverContext);
  const dropZoneArmed = isMaskDropZoneArmed(
    { tool, maskEdit, browserElement },
    { meta: isMetaKeyPressed, alt: isAltKeyPressed },
  );
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedImgKeys.has(mediaKey);
  const dragDisabled = useMemo(() => {
    return tool.type != "move";
  }, [tool.type]);
  const isStackable = useMemo(() => {
    return tool.type === "marquee" && tool.stack;
  }, [tool]);
  const {
    listeners,
    setNodeRef,
    transform: dndTransform,
    isDragging,
  } = useDraggable({
    id: dndId,
    disabled: dragDisabled ?? false,
  });
  const canvasZoom = useCanvasZoomValue();
  const dndCss = {
    left: dndPosition.x,
    top: dndPosition.y,
    transform: CSS.Translate.toString(toCanvasTranslate(dndTransform, canvasZoom)),
    touchAction: "none",
  };

  const imgCursor = useToolCursor({ target: "img", dragDisabled, isDragging, isStackable });

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dndCss,
        position: "absolute",
        width: meta.width * meta.scale_x,
        height: meta.height * meta.scale_y,
        zIndex: showContextMenu ? Z_INDEX.CONTEXT_MENU_OFFSET + maxZIndex + zIndex : zIndex,
        pointerEvents: dropZoneArmed ? "none" : undefined,
      }}
    >
      <div>
        <div
          {...listeners}
          title={title}
          style={{
            ...(transform && { ...transform.cssProps }),
            position: "relative",
            zIndex: Z_INDEX.ITEM_CONTENT,
            cursor: imgCursor,
          }}
        >
          <LaurusImage
            onClick={(e) => onClick(e.metaKey)}
            onMouseEnter={() => {
              setIsHovered(true);
            }}
            onMouseLeave={() => {
              setIsHovered(false);
            }}
            imgRef={(r) => {
              if (onImgRef && refKey) {
                onImgRef(r, `${refKey}`);
              }
            }}
            draggable={false}
            alt={data.media_key}
            src={data.src}
            fill
            sizes={pxSizes(meta.width * meta.scale_x, 1024)}
            style={{
              objectFit: "cover",
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
          />
        </div>
        {showContextMenu && (
          <ContextMenu
            media={{
              key: mediaKey,
              type: "img",
              meta: meta,
            }}
            framesCacheRef={framesCacheRef}
            transform={transform}
          />
        )}
      </div>
    </div>
  );
}
