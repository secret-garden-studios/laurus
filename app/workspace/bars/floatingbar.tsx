"use client";
import { useContext, useLayoutEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { UIContext } from "../workspace.client";
import { Z_INDEX } from "../workspace.config";
import { beginBodyDragCursor, endBodyDragCursor } from "../hooks/useToolCursor";
import { ReviewPanel, EditPanel } from "../object-review-panel";
import { useObjectReview } from "../hooks/useObjectReview";
import { editedRegion } from "../states/ui-state";

export const FLOATINGBAR_DND_ID = "floatingbar";

const REGION_GAP = 16;
const EDGE_INSET = 24;

function regionOnScreen(maskKey: string, cx: number, cy: number, radius: number) {
  const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-mask-key="${window.CSS.escape(maskKey)}"]`);
  if (!canvas?.width || !canvas.height) return undefined;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return undefined;
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  return {
    x: rect.left + cx * scaleX,
    y: rect.top + cy * scaleY,
    radius: radius * Math.max(scaleX, scaleY),
  };
}

const clamp = (value: number, low: number, high: number) => (high < low ? low : Math.min(Math.max(value, low), high));

export default function Floatingbar() {
  const { uiState } = useContext(UIContext);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const { session } = useObjectReview();
  const areaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const placedForRef = useRef<string | undefined>(undefined);

  const region = session ? editedRegion(session) : undefined;
  const placementKey = session && region ? `${session.maskKey}|${session.subject}` : undefined;

  useLayoutEffect(() => {
    if (!placementKey || !session || !region) {
      placedForRef.current = undefined;
      return;
    }
    if (placementKey === placedForRef.current) return;

    const area = areaRef.current;
    const frame = frameRef.current;
    if (!area || !frame) return;
    const target = regionOnScreen(session.maskKey, region.cx, region.cy, region.radius);
    if (!target) return;
    placedForRef.current = placementKey;

    const frameRect = frame.getBoundingClientRect();
    const bounds = area.getBoundingClientRect();
    const minX = bounds.left + EDGE_INSET;
    const maxX = bounds.right - EDGE_INSET - frameRect.width;
    const minY = bounds.top + EDGE_INSET;
    const maxY = bounds.bottom - EDGE_INSET - frameRect.height;

    const below = target.y + target.radius + REGION_GAP;
    const above = target.y - target.radius - REGION_GAP - frameRect.height;
    const desiredX = target.x - frameRect.width / 2;
    const desiredY = below <= maxY || above < minY ? below : above;

    setOffset((previous) => ({
      x: previous.x + clamp(desiredX, minX, maxX) - frameRect.left,
      y: previous.y + clamp(desiredY, minY, maxY) - frameRect.top,
    }));
  }, [placementKey, session, region]);

  if (!session) return null;
  const isEdit = session.subject === "light" || session.mode === "edit";

  const content = (() => {
    switch (uiState.tool.type) {
      case "pen":
        return uiState.maskEdit ? isEdit ? <EditPanel /> : <ReviewPanel /> : null;
      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <div
      ref={areaRef}
      style={{
        gridRow: "4",
        gridColumn: "2",
        zIndex: Z_INDEX.FLOATINGBAR,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pointerEvents: "none",
        padding: 24,
      }}
    >
      <DndContext
        id="floatingbar-dnd"
        sensors={sensors}
        autoScroll={false}
        modifiers={[restrictToParentElement]}
        onDragStart={beginBodyDragCursor}
        onDragEnd={(e) => {
          endBodyDragCursor();
          setOffset((prev) => ({ x: prev.x + e.delta.x, y: prev.y + e.delta.y }));
        }}
      >
        <FloatingbarFrame offset={offset} frameRef={frameRef}>
          {content}
        </FloatingbarFrame>
      </DndContext>
    </div>
  );
}

function FloatingbarFrame({
  offset,
  frameRef,
  children,
}: {
  offset: { x: number; y: number };
  frameRef: { current: HTMLDivElement | null };
  children: React.ReactNode;
}) {
  const { setNodeRef, transform } = useDraggable({ id: FLOATINGBAR_DND_ID });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        frameRef.current = node;
      }}
      style={{
        position: "relative",
        left: offset.x,
        top: offset.y,
        transform: CSS.Translate.toString(transform),
        pointerEvents: "auto",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        background: "rgb(32, 32, 32)",
        boxShadow: "rgba(0, 0, 0, 0.4) 2px 2px 4px 0px",
        color: "rgb(224, 224, 224)",
        padding: 14,
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
