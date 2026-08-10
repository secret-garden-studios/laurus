import { useContext, useMemo } from "react";
import { HoverContext, UIContext } from "../workspace.client";
import { LaurusTool } from "../states/ui-state";

export type MediaKind = "img" | "svg" | "mask";
// "canvas" stands for the bare canvas background -- not a specific item, so it never drags and
// never itself matches a tool's targetKinds (see the "canvas" branch in useToolCursor below).
export type CursorTarget = MediaKind | "canvas";
export type CursorValue = "crosshair" | "context-menu" | "grabbing" | "grab" | "";

interface ToolCursorRule {
  // Which media kinds this tool invites a click on -- drives the "crosshair, select something"
  // cursor both on a matching item and (whenever non-empty) on the bare canvas.
  targetKinds: ReadonlySet<MediaKind>;
  // Tools that fully claim the cursor for their own gesture (dragging an item, panning the
  // canvas) -- these suppress the meta/context-menu cursor that would otherwise win.
  ownsCursor: boolean;
  // Wants the context-menu cursor on an item even without meta held (only "contextmenu" itself).
  forcesContextMenuCursor: boolean;
}

const NO_MEDIA: ReadonlySet<MediaKind> = new Set();
const ALL_MEDIA: ReadonlySet<MediaKind> = new Set(["img", "svg", "mask"]);
const MASK_ONLY: ReadonlySet<MediaKind> = new Set(["mask"]);

function assertNever(x: never): never {
  throw new Error(`Unhandled tool type: ${JSON.stringify(x)}`);
}

// The one place that maps a tool to its cursor behavior -- every LaurusTool variant must appear
// here, or assertNever below fails to compile (its parameter type is `never`, so TypeScript
// rejects any case it can still prove is reachable). Add a tool to LaurusTool and this switch is
// the only other edit a cursor needs.
export function getToolCursorRule(toolType: LaurusTool["type"]): ToolCursorRule {
  switch (toolType) {
    case "scale":
    case "rotate":
      return { targetKinds: ALL_MEDIA, ownsCursor: false, forcesContextMenuCursor: false };
    case "light_source":
      // Light source dials a mask's own mesh appearance (see Lightsourcebar) -- plain images/svgs
      // have no mesh for it to act on, so unlike scale/rotate it only targets masks.
      return { targetKinds: MASK_ONLY, ownsCursor: false, forcesContextMenuCursor: false };
    case "move":
    case "viewport":
      return { targetKinds: NO_MEDIA, ownsCursor: true, forcesContextMenuCursor: false };
    case "contextmenu":
      return { targetKinds: NO_MEDIA, ownsCursor: false, forcesContextMenuCursor: true };
    case "marquee":
    case "none":
    case "mix":
    case "mask":
      return { targetKinds: NO_MEDIA, ownsCursor: false, forcesContextMenuCursor: false };
    default:
      return assertNever(toolType);
  }
}

interface UseToolCursorParams {
  // The kind of thing this cursor is over, or undefined when it's an item that isn't currently a
  // valid tool target at all (e.g. a live, not-yet-persisted mask preview) -- resolves to "" below
  // rather than inviting a click that would have nowhere to land.
  target: CursorTarget | undefined;
  // Only meaningful for a real item (img/svg/mask), not "canvas".
  dragDisabled?: boolean;
  isDragging?: boolean;
  // Marquee's stack-drop sub-mode wants a crosshair over img/svg independent of the active tool's
  // own targetKinds -- callers that don't have this concept (canvas, masks) just omit it.
  isStackable?: boolean;
}

// Single source of truth for every tool-driven cursor in the workspace canvas. Composes
// getToolCursorRule's per-tool behavior with the per-item state (drag, stackability) and the
// universal alt/meta modifier keys, which aren't properties of the tool and so deliberately stay
// out of the switch above.
export function useToolCursor({ target, dragDisabled, isDragging, isStackable }: UseToolCursorParams): CursorValue {
  const { uiState } = useContext(UIContext);
  const { isAltKeyPressed, isMetaKeyPressed } = useContext(HoverContext);
  const toolType = uiState.tool.type;
  const filledForwards = uiState.filledForwards;

  return useMemo((): CursorValue => {
    // Alt always wins as a blanket "select" hint, the same way it already did pre-refactor,
    // regardless of whether whatever's under the cursor is actually alt-selectable.
    if (isAltKeyPressed && toolType !== "marquee") return "crosshair";
    if (target === undefined) return "";

    const rule = getToolCursorRule(toolType);
    const metaWantsContextMenu = isMetaKeyPressed || (target !== "canvas" && rule.forcesContextMenuCursor);
    const contextMenuSuppressed = rule.ownsCursor || (target !== "canvas" && filledForwards);
    if (metaWantsContextMenu && !contextMenuSuppressed) return "context-menu";

    if (isStackable) return "crosshair";
    if (target !== "canvas") {
      if (rule.targetKinds.has(target)) return "crosshair";
      return dragFallbackCursor({ dragDisabled, isDragging });
    }
    return rule.targetKinds.size > 0 ? "crosshair" : "";
  }, [isAltKeyPressed, toolType, target, isMetaKeyPressed, filledForwards, isStackable, dragDisabled, isDragging]);
}

// The plain "drag handle" cursor a draggable item falls back to once alt/meta and any tool's own
// target-crosshair have been ruled out. Exported on its own (not just inlined above) for callers
// like CameraDragOverlay that drag under the same "only the move tool can grab me" rule but, unlike
// img/svg/mask, are never themselves a selectable target of any tool -- routing them through
// useToolCursor's alt/meta handling would show a crosshair inviting a click that has nowhere to
// land, so they compose this piece directly instead of the whole hook.
export function dragFallbackCursor({
  dragDisabled,
  isDragging,
}: {
  dragDisabled?: boolean;
  isDragging?: boolean;
}): CursorValue {
  return dragDisabled ? "" : isDragging ? "grabbing" : "grab";
}

// Shared by every draggable-project-*.tsx's DndContext onDragStart/onDragEnd -- the body cursor
// during an active drag is always "grabbing" regardless of which media kind is being dragged, so
// there's nothing tool-specific to compose here, just the imperative set/clear deduplicated.
export function beginBodyDragCursor(): void {
  document.body.style.cursor = "grabbing";
}

export function endBodyDragCursor(): void {
  document.body.style.cursor = "";
}
