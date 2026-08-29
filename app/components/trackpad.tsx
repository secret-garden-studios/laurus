import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { CSSProperties, RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LaurusResolution } from "../landing.boot";
import { beginBodyDragCursor, endBodyDragCursor } from "../workspace/hooks/useToolCursor";

export enum PointerStyle {
  Blurry,
  Solid,
  BlurryBottomTitle,
}

interface TrackpadProps {
  resolution: LaurusResolution;
  ids: { contextId: string; draggableId: string };
  width: number | string;
  height: number | string;
  coarsePointer: {
    width: number | string;
    height: number | string;
    pointerStyle: PointerStyle;
    zIndex?: number;
    borderColor?: string;
  };
  value: { x: number; y: number };
  onNewValue: (v: { x: number; y: number }) => void;
  onMove?: (v: { x: number; y: number }) => void;
  zIndex?: number;
  disabled?: boolean;
  title?: string;
  liveTitleRef?: RefObject<HTMLDivElement | null>;
  escapeOverflow?: boolean;
}

export function Trackpad({
  resolution,
  ids,
  width,
  height,
  coarsePointer,
  value,
  onNewValue,
  onMove,
  zIndex,
  disabled,
  title,
  liveTitleRef,
  escapeOverflow,
}: TrackpadProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <>
      <div
        style={{
          width,
          height,
          zIndex,
        }}
      >
        <DndContext
          id={ids.contextId}
          sensors={sensors}
          autoScroll={false}
          onDragStart={() => {
            beginBodyDragCursor();
          }}
          onDragMove={(e) => {
            if (!onMove) return;
            const delta = e.delta;
            const newPosition = {
              x: Math.round(value.x + delta.x),
              y: Math.round(value.y + delta.y),
            };
            onMove(newPosition);
          }}
          onDragEnd={(e) => {
            endBodyDragCursor();
            const delta = e.delta;
            const newPosition = {
              x: Math.round(value.x + delta.x),
              y: Math.round(value.y + delta.y),
            };
            onNewValue(newPosition);
          }}
          modifiers={[restrictToParentElement]}
        >
          <CoarsePointer
            resolution={resolution}
            id={ids.draggableId}
            coords={value}
            width={coarsePointer.width}
            height={coarsePointer.height}
            pointerStyle={coarsePointer.pointerStyle}
            zIndex={coarsePointer.zIndex}
            borderColor={coarsePointer.borderColor}
            disabled={disabled}
            title={title}
            liveTitleRef={liveTitleRef}
            escapeOverflow={escapeOverflow}
          />
        </DndContext>
      </div>
    </>
  );
}

interface CoarsePointerProps {
  resolution: LaurusResolution;
  id: string;
  coords: { x: number; y: number };
  width: number | string;
  height: number | string;
  pointerStyle: PointerStyle;
  zIndex?: number;
  borderColor?: string;
  disabled?: boolean;
  title?: string;
  liveTitleRef?: RefObject<HTMLDivElement | null>;
  escapeOverflow?: boolean;
}

function CoarsePointer({
  resolution,
  id,
  width,
  height,
  pointerStyle,
  coords,
  zIndex,
  borderColor,
  disabled,
  title,
  liveTitleRef,
  escapeOverflow,
}: CoarsePointerProps) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const pointerElRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      pointerElRef.current = node;
    },
    [setNodeRef],
  );
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          tooltip: {
            letterSpacing: 1,
            fontSize: 11,
          },
          titleOffsets: {
            top: 8,
            left: 6,
          },
        };
      case "midhigh":
        return {
          tooltip: {
            letterSpacing: 1,
            fontSize: 9,
          },
          titleOffsets: {
            top: 6,
            left: 4,
          },
        };
      case "midlow":
      case "low":
        return {
          tooltip: {
            letterSpacing: 1,
            fontSize: 8,
          },
          titleOffsets: {
            top: 6,
            left: 4,
          },
        };
    }
  });
  const [isHovered, setIsHovered] = useState(false);
  const isActive = isDragging || isHovered;
  // An escaping title is portalled to the body and positioned in viewport coordinates, which means
  // measuring the pointer after layout. That measurement is not state: routing it through React
  // would re-render the pointer on every scroll event of a drag to move a tooltip the browser can
  // be told about directly. Writing the two offsets onto the node is what an effect is for, and it
  // keeps a dragging cap off the render path entirely.
  const fixedTitleElRef = useRef<HTMLDivElement | null>(null);
  const setTitleRefs = useCallback(
    (node: HTMLDivElement | null) => {
      fixedTitleElRef.current = node;
      if (liveTitleRef) liveTitleRef.current = node;
    },
    [liveTitleRef],
  );
  useLayoutEffect(() => {
    if (!escapeOverflow || !isActive) return;
    const positionTitle = () => {
      const el = pointerElRef.current;
      const title = fixedTitleElRef.current;
      if (!el || !title) return;
      const rect = el.getBoundingClientRect();
      if (pointerStyle === PointerStyle.BlurryBottomTitle) {
        title.style.top = `${rect.bottom + dynamicSizes.titleOffsets.top}px`;
        title.style.left = `${(rect.left + rect.right) / 2}px`;
      } else {
        title.style.top = `${(rect.top + rect.bottom) / 2}px`;
        title.style.left = `${rect.right + dynamicSizes.titleOffsets.left}px`;
      }
    };
    positionTitle();
    window.addEventListener("scroll", positionTitle, true);
    window.addEventListener("resize", positionTitle);
    return () => {
      window.removeEventListener("scroll", positionTitle, true);
      window.removeEventListener("resize", positionTitle);
    };
  }, [
    escapeOverflow,
    isActive,
    pointerStyle,
    dynamicSizes.titleOffsets.top,
    dynamicSizes.titleOffsets.left,
    transform?.x,
    transform?.y,
    coords.x,
    coords.y,
  ]);
  const dndCss = {
    left: coords.x,
    top: coords.y,
    transform: CSS.Translate.toString(transform),
    touchAction: "none",
  };
  const fixedTooltipCss: CSSProperties = {
    position: "fixed",
    // top and left are written by the layout effect above, in viewport coordinates
    transform: pointerStyle === PointerStyle.BlurryBottomTitle ? "translate(-50%, -50%)" : "translateY(-50%)",
    color: "rgb(227,227,227)",
    fontWeight: "bold",
    textAlign: "center",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 2000,
    ...dynamicSizes.tooltip,
  };
  const tooltipCss: CSSProperties = ((p) => {
    switch (p) {
      case PointerStyle.BlurryBottomTitle:
        return {
          position: "absolute",
          top: `calc(100% + ${dynamicSizes.titleOffsets.top}px)`,
          transform: "translateY(-50%)",
          color: "rgb(227,227,227)",
          fontWeight: "bold",
          textAlign: "center",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 1000,
          ...dynamicSizes.tooltip,
        };
      default:
        return {
          position: "absolute",
          top: "50%",
          left: `calc(100% + ${dynamicSizes.titleOffsets.left}px)`,
          transform: "translateY(-50%)",
          color: "rgb(227,227,227)",
          fontWeight: "bold",
          textAlign: "center",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 1000,
          ...dynamicSizes.tooltip,
        };
    }
  })(pointerStyle);

  const css: CSSProperties = ((p) => {
    switch (p) {
      case PointerStyle.BlurryBottomTitle:
      case PointerStyle.Blurry: {
        return {
          background: "rgba(255,255,255,0.01)",
          border: `1px solid ${borderColor ?? "rgb(70, 70, 70)"}`,
          backdropFilter: "blur(3px)",
          borderRadius: "50%",
          boxShadow: "1px 1px 6px rgba(0,0,0,0.4)",
        };
      }
      case PointerStyle.Solid: {
        return {
          background:
            "radial-gradient(circle at 30% 30%, rgb(230, 230, 230) 0%, rgb(170, 170, 170) 45%, rgb(115, 115, 115) 100%)",
          borderRadius: "50%",
          boxShadow: "1px 1px 6px rgba(0, 0, 0, 0.9)",
        };
      }
    }
  })(pointerStyle);

  if (liveTitleRef !== undefined) {
    const titleElement = isActive && (
      <div ref={escapeOverflow ? setTitleRefs : liveTitleRef} style={escapeOverflow ? fixedTooltipCss : tooltipCss}>
        {title}
      </div>
    );
    return (
      <div
        ref={setRefs}
        {...listeners}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          ...dndCss,
          ...css,
          cursor: isDragging ? "grabbing" : disabled ? "" : "grab",
          position: "absolute",
          width,
          height,
          zIndex,
        }}
      >
        {titleElement && (escapeOverflow ? createPortal(titleElement, document.body) : titleElement)}
      </div>
    );
  } else {
    return (
      <div
        ref={setNodeRef}
        title={title}
        {...listeners}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          ...dndCss,
          ...css,
          cursor: isDragging ? "grabbing" : disabled ? "" : "grab",
          position: "absolute",
          width,
          height,
          zIndex,
        }}
      ></div>
    );
  }
}
