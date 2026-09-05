import { useContext, useMemo } from "react";
import { HoverContext } from "../workspace.client";
import { isPenArmed, LaurusTool } from "../states/ui-state";
import { useUIFilledForwards, useUIMaskEdit, useUITool } from "../states/ui-store";

export type MediaKind = "img" | "svg" | "mask";
export type CursorTarget = MediaKind | "canvas";
export type CursorValue = "crosshair" | "context-menu" | "grabbing" | "grab" | "";

interface ToolCursorRule {
  targetKinds: ReadonlySet<MediaKind>;
  hoverOnlyTargetKinds: ReadonlySet<MediaKind>;
  ownsCursor: boolean;
  forcesContextMenuCursor: boolean;
}

const NO_MEDIA: ReadonlySet<MediaKind> = new Set();
const ALL_MEDIA: ReadonlySet<MediaKind> = new Set(["img", "svg", "mask"]);
const MASK_ONLY: ReadonlySet<MediaKind> = new Set(["mask"]);

function assertNever(x: never): never {
  throw new Error(`Unhandled tool type: ${JSON.stringify(x)}`);
}

export function getToolCursorRule(toolType: LaurusTool["type"], penArmed = false): ToolCursorRule {
  switch (toolType) {
    case "scale":
    case "rotate":
    case "skew":
      return {
        targetKinds: ALL_MEDIA,
        hoverOnlyTargetKinds: NO_MEDIA,
        ownsCursor: false,
        forcesContextMenuCursor: false,
      };
    case "light_source":
      return {
        targetKinds: MASK_ONLY,
        hoverOnlyTargetKinds: NO_MEDIA,
        ownsCursor: false,
        forcesContextMenuCursor: false,
      };
    case "move":
    case "viewport":
      return {
        targetKinds: NO_MEDIA,
        hoverOnlyTargetKinds: NO_MEDIA,
        ownsCursor: true,
        forcesContextMenuCursor: false,
      };
    case "contextmenu":
      return {
        targetKinds: NO_MEDIA,
        hoverOnlyTargetKinds: NO_MEDIA,
        ownsCursor: false,
        forcesContextMenuCursor: true,
      };
    case "marquee":
    case "none":
    case "mix":
      return {
        targetKinds: NO_MEDIA,
        hoverOnlyTargetKinds: NO_MEDIA,
        ownsCursor: false,
        forcesContextMenuCursor: false,
      };
    case "mask":
      return {
        targetKinds: NO_MEDIA,
        hoverOnlyTargetKinds: MASK_ONLY,
        ownsCursor: false,
        forcesContextMenuCursor: false,
      };
    case "pen":
      if (penArmed) {
        return {
          targetKinds: MASK_ONLY,
          hoverOnlyTargetKinds: NO_MEDIA,
          ownsCursor: false,
          forcesContextMenuCursor: false,
        };
      }
      return {
        targetKinds: NO_MEDIA,
        hoverOnlyTargetKinds: NO_MEDIA,
        ownsCursor: false,
        forcesContextMenuCursor: false,
      };
    default:
      return assertNever(toolType);
  }
}

interface UseToolCursorParams {
  target: CursorTarget | undefined;
  dragDisabled?: boolean;
  isDragging?: boolean;
  isStackable?: boolean;
}

export function useToolCursor({ target, dragDisabled, isDragging, isStackable }: UseToolCursorParams): CursorValue {
  const { isAltKeyPressed, isMetaKeyPressed } = useContext(HoverContext);
  const tool = useUITool();
  const maskEdit = useUIMaskEdit();
  const filledForwards = useUIFilledForwards();
  const toolType = tool.type;
  const penArmed = isPenArmed({ tool, maskEdit });

  return useMemo((): CursorValue => {
    if (isAltKeyPressed && toolType !== "marquee") return "crosshair";
    if (target === undefined) return "";

    const rule = getToolCursorRule(toolType, penArmed);
    const metaWantsContextMenu = isMetaKeyPressed || (target !== "canvas" && rule.forcesContextMenuCursor);
    const contextMenuSuppressed = rule.ownsCursor || (target !== "canvas" && filledForwards);
    if (metaWantsContextMenu && !contextMenuSuppressed) return "context-menu";

    if (isStackable) return "crosshair";
    if (target !== "canvas") {
      if (rule.targetKinds.has(target) || rule.hoverOnlyTargetKinds.has(target)) return "crosshair";
      return dragFallbackCursor({ dragDisabled, isDragging });
    }

    return rule.targetKinds.size > 0 ? "crosshair" : "";
  }, [
    isAltKeyPressed,
    toolType,
    penArmed,
    target,
    isMetaKeyPressed,
    filledForwards,
    isStackable,
    dragDisabled,
    isDragging,
  ]);
}

export function dragFallbackCursor({
  dragDisabled,
  isDragging,
}: {
  dragDisabled?: boolean;
  isDragging?: boolean;
}): CursorValue {
  return dragDisabled ? "" : isDragging ? "grabbing" : "grab";
}

let isAnyDragActiveFlag = false;

export function isAnyDragActive(): boolean {
  return isAnyDragActiveFlag;
}

export function beginBodyDragCursor(): void {
  document.body.style.cursor = "grabbing";
  document.body.dataset.dragging = "true";
  isAnyDragActiveFlag = true;
}

export function endBodyDragCursor(): void {
  document.body.style.cursor = "";
  delete document.body.dataset.dragging;
  isAnyDragActiveFlag = false;
}
