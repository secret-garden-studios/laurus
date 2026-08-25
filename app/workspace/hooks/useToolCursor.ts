import { useContext, useMemo } from "react";
import { HoverContext, UIContext } from "../workspace.client";
import { LaurusTool } from "../states/ui-state";

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

export function getToolCursorRule(toolType: LaurusTool["type"]): ToolCursorRule {
  switch (toolType) {
    case "scale":
    case "rotate":
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
      // the pen is only ever open over a mask, and the review it belongs to
      // already forces a crosshair there -- so this only has to say that the
      // pen claims no other media and steals no cursor of its own
      return {
        targetKinds: NO_MEDIA,
        hoverOnlyTargetKinds: MASK_ONLY,
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
  const { uiState } = useContext(UIContext);
  const { isAltKeyPressed, isMetaKeyPressed } = useContext(HoverContext);
  const toolType = uiState.tool.type;
  const filledForwards = uiState.filledForwards;

  return useMemo((): CursorValue => {
    if (isAltKeyPressed && toolType !== "marquee") return "crosshair";
    if (target === undefined) return "";

    const rule = getToolCursorRule(toolType);
    const metaWantsContextMenu = isMetaKeyPressed || (target !== "canvas" && rule.forcesContextMenuCursor);
    const contextMenuSuppressed = rule.ownsCursor || (target !== "canvas" && filledForwards);
    if (metaWantsContextMenu && !contextMenuSuppressed) return "context-menu";

    if (isStackable) return "crosshair";
    if (target !== "canvas") {
      if (rule.targetKinds.has(target) || rule.hoverOnlyTargetKinds.has(target)) return "crosshair";
      return dragFallbackCursor({ dragDisabled, isDragging });
    }

    return rule.targetKinds.size > 0 ? "crosshair" : "";
  }, [isAltKeyPressed, toolType, target, isMetaKeyPressed, filledForwards, isStackable, dragDisabled, isDragging]);
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

// Set for the duration of any dnd-kit drag anywhere in the app (dial, trackpad,
// camera, canvas media, timeline/group reordering). dnd-kit tracks drag deltas via
// document-level listeners rather than pointer capture, so the browser keeps
// dispatching real mouseenter/mousemove/mouseleave to whatever sits under the
// cursor as it sweeps across other units mid-drag. Hover handlers should check
// this before touching HoverContext so an in-progress drag can't spuriously
// highlight/select things the cursor merely passed over.
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
