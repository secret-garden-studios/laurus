"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cubicRingsToPathData,
  editableRings,
  moveAnchor,
  flattenCubicRing,
  insertAnchor,
  moveControl,
  nearestOnRings,
  normalizeEditedRings,
  ringPieces,
  stitchRing,
  type CubicRing,
  type Point,
  type RingPlace,
} from "./object-path.ts";
import { polygonArea } from "./object-shape.ts";
import { Z_INDEX } from "../workspace.config";

const ANCHOR_RADIUS_PX = 4.5;
const SELECTED_RADIUS_PX = 6;
const CONTROL_RADIUS_PX = 3.5;
const OUTLINE_WIDTH_PX = 1.5;
const LEASH_WIDTH_PX = 1;
const GRAB_RADIUS_PX = 9;
const COLLAPSED_AREA = 1e-3;
const BUFFER_SPACE = { cx: 0, cy: 0, radius: 1 };
const OUTLINE_COLOR = "rgb(66, 133, 244)";
const REFERENCE_COLOR = "rgb(251, 166, 39)";
const INVALID_COLOR = "rgb(211, 71, 71)";
const HOLE_COLOR = "rgba(66, 133, 244, 0.5)";
const ANCHOR_FILL = "rgb(255, 255, 255)";
const CONTROL_FILL = "rgb(32, 32, 32)";
const SELECTED_FILL = "rgb(66, 133, 244)";
const GHOST_FILL = "rgba(66, 133, 244, 0.65)";
const PICK_FILL = "rgba(66, 133, 244, 0.12)";
const PICK_HOVER_FILL = "rgba(66, 133, 244, 0.34)";

interface Grab {
  pointerId: number;
  ring: number;
  anchor: number;
  kind: "anchor" | "in" | "out";
  breakSymmetry: boolean;
  moved: boolean;
  at?: Point;
  altKey: boolean;
  rafId?: number;
}

export interface ObjectShapeEditorProps {
  object: { cx: number; cy: number; radius: number; shape: string };
  bufferWidth: number;
  bufferHeight: number;
  cssWidth: number;
  cssHeight: number;
  onPreview: (edit: ShapeEdit) => void;
  onCommit: (edit: ShapeEdit) => void;
  stitch: boolean;
  addAnchor: boolean;
  showAnchors: boolean;
  reference?: { cx: number; cy: number; radius: number; shape: string };
}

export interface ShapeEdit {
  path: string;
  cx: number;
  cy: number;
  radius: number;
}

export default function ObjectShapeEditor({
  object,
  bufferWidth,
  bufferHeight,
  cssWidth,
  cssHeight,
  onPreview,
  onCommit,
  stitch,
  addAnchor,
  showAnchors,
  reference,
}: ObjectShapeEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const grabRef = useRef<Grab | undefined>(undefined);

  const [rings, setRings] = useState<CubicRing[]>(() => {
    const out = (n: Point): Point => [object.cx + n[0] * object.radius, object.cy + n[1] * object.radius];
    return editableRings(object.shape).map((ring) =>
      ring.map((anchor) => ({
        point: out(anchor.point),
        inControl: out(anchor.inControl),
        outControl: out(anchor.outControl),
      })),
    );
  });

  const ringsRef = useRef(rings);
  const applyRings = useCallback((next: CubicRing[]) => {
    ringsRef.current = next;
    setRings(next);
  }, []);

  const [selected, setSelected] = useState<{ ring: number; anchor: number } | undefined>(undefined);
  // Where a click on the outline would put an anchor, tracked as the pointer
  // slides along it so the reviewer sees the anchor before committing to it.
  const [ghost, setGhost] = useState<RingPlace | undefined>(undefined);

  // Both modes are reached by clicking, and both leave something on screen
  // that only makes sense while they are on -- an anchor picked but not yet
  // stitched to, an anchor hovered but not yet placed. Switching out of either
  // has to take that with it, or the next click lands on a leftover.
  const pickable = stitch && showAnchors;
  const inserting = addAnchor && showAnchors;
  const [modeWas, setModeWas] = useState({ pickable, inserting });
  if (modeWas.pickable !== pickable || modeWas.inserting !== inserting) {
    setModeWas({ pickable, inserting });
    setSelected(undefined);
    setGhost(undefined);
  }

  const [hoveredPiece, setHoveredPiece] = useState<number | undefined>(undefined);

  const perBufferUnit = cssWidth > 0 ? bufferWidth / cssWidth : 1;
  const px = useCallback((size: number) => size * perBufferUnit, [perBufferUnit]);

  const fromClient = useCallback(
    (clientX: number, clientY: number): Point | undefined => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return undefined;
      return [((clientX - rect.left) / rect.width) * bufferWidth, ((clientY - rect.top) / rect.height) * bufferHeight];
    },
    [bufferWidth, bufferHeight],
  );

  const { invalid, holes, pieces } = useMemo(() => {
    const flat = rings.map((ring) => flattenCubicRing(ring));
    const widest = Math.max(0, ...flat.map((ring) => Math.abs(polygonArea(ring))));
    const { depth, pieces } = ringPieces(flat);
    return {
      invalid: widest < COLLAPSED_AREA * object.radius * object.radius,
      holes: depth.map((enclosing) => enclosing % 2 === 1),
      pieces,
    };
  }, [rings, object.radius]);

  const preview = useCallback(
    (next: CubicRing[]) => {
      const edit = normalizeEditedRings(next, BUFFER_SPACE);
      if (edit) onPreview(edit);
    },
    [onPreview],
  );

  const flushGrab = useCallback(
    (shouldPreview: boolean) => {
      const grab = grabRef.current;
      if (!grab) return;
      grab.rafId = undefined;
      const at = grab.at;
      if (!at) return;
      grab.at = undefined;
      const next = ringsRef.current.map((ring, index) => {
        if (index !== grab.ring) return ring;
        if (grab.kind === "anchor") return moveAnchor(ring, grab.anchor, at);
        return moveControl(ring, grab.anchor, grab.kind, at, grab.breakSymmetry || grab.altKey);
      });
      applyRings(next);
      if (shouldPreview) preview(next);
    },
    [applyRings, preview],
  );

  // A grab in flight when the pen closes would otherwise leave its frame
  // scheduled against an unmounted editor.
  useEffect(
    () => () => {
      const grab = grabRef.current;
      if (grab?.rafId !== undefined) cancelAnimationFrame(grab.rafId);
    },
    [],
  );

  const onPointerDown = (
    event: React.PointerEvent,
    grab: Omit<Grab, "pointerId" | "breakSymmetry" | "moved" | "altKey">,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    grabRef.current = {
      ...grab,
      pointerId: event.pointerId,
      breakSymmetry: event.altKey,
      altKey: event.altKey,
      moved: false,
    };
  };

  const takeStitchAnchor = (ring: number, anchor: number) => {
    if (!selected || selected.ring !== ring) {
      setSelected({ ring, anchor });
      return;
    }
    if (selected.anchor === anchor) {
      setSelected(undefined);
      return;
    }
    setSelected(undefined);
    const next = stitchRing(ringsRef.current, ring, selected.anchor, anchor);
    if (!next) return;
    applyRings(next);
    const edit = normalizeEditedRings(next, BUFFER_SPACE);
    if (edit) onCommit(edit);
  };

  const keepOnlyPiece = (at: number) => {
    const piece = pieces[at];
    if (!piece || pieces.length < 2) return;
    const next = piece.map((index) => rings[index]);
    setHoveredPiece(undefined);
    setSelected(undefined);
    applyRings(next);
    const edit = normalizeEditedRings(next, BUFFER_SPACE);
    if (edit) onCommit(edit);
  };

  /**
   * Where on the outline this pointer is, as a place a new anchor could go.
   *
   * The hit target is a fat transparent stroke laid over the outline, so the
   * pointer is only ever near the curve, never on it. Projecting back onto the
   * curve is what makes the anchor land where the reviewer was pointing rather
   * than where they happened to click within the stroke's width.
   */
  const placeOnOutline = (event: React.PointerEvent): RingPlace | undefined => {
    const at = fromClient(event.clientX, event.clientY);
    return at ? nearestOnRings(ringsRef.current, at) : undefined;
  };

  const putAnchor = (event: React.PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const place = placeOnOutline(event);
    if (!place) return;
    const next = insertAnchor(ringsRef.current, place.ring, place.segment, place.t);
    if (!next) return;
    setGhost(undefined);
    setSelected(undefined);
    applyRings(next);
    // The split is exact, so the outline is unchanged and only the anchor
    // count differs -- but that count is the edit, and it lives nowhere but
    // the path, so it has to be committed like any other.
    const edit = normalizeEditedRings(next, BUFFER_SPACE);
    if (edit) onCommit(edit);
  };

  const onAnchorPointerDown = (event: React.PointerEvent, ring: number, anchor: number) => {
    if (!stitch) {
      onPointerDown(event, { ring, anchor, kind: "anchor" });
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    takeStitchAnchor(ring, anchor);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const grab = grabRef.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    const at = fromClient(event.clientX, event.clientY);
    if (!at) return;
    event.stopPropagation();
    grab.moved = true;
    grab.at = at;
    grab.altKey = event.altKey;
    if (grab.rafId === undefined) grab.rafId = requestAnimationFrame(() => flushGrab(true));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const grab = grabRef.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    // The frame the last sample was waiting on is never going to run, and that
    // sample is where the anchor was actually let go -- so take it here, and
    // without a preview, because the commit below renders the same rings at
    // full resolution a line later.
    if (grab.rafId !== undefined) cancelAnimationFrame(grab.rafId);
    flushGrab(false);
    grabRef.current = undefined;
    event.stopPropagation();
    if (!grab.moved) return;
    const edit = normalizeEditedRings(ringsRef.current, BUFFER_SPACE);
    if (edit) onCommit(edit);
  };

  const stroke = invalid ? INVALID_COLOR : OUTLINE_COLOR;

  return (
    <svg
      ref={svgRef}
      width={cssWidth}
      height={cssHeight}
      viewBox={`0 0 ${bufferWidth} ${bufferHeight}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: Z_INDEX.ITEM_CONTENT + 1,
        pointerEvents: "none",
        touchAction: "none",
        overflow: "visible",
      }}
    >
      {reference && reference.shape && reference.radius > 0 && (
        <path
          d={reference.shape}
          transform={`translate(${reference.cx} ${reference.cy}) scale(${reference.radius})`}
          fill="none"
          stroke={REFERENCE_COLOR}
          strokeWidth={px(OUTLINE_WIDTH_PX) / reference.radius}
          pointerEvents="none"
        />
      )}
      {pieces.length > 1 &&
        pieces.map((piece, pieceIndex) => (
          <path
            key={`piece-${pieceIndex}`}
            d={cubicRingsToPathData(piece.map((index) => rings[index]))}
            fillRule="evenodd"
            fill={hoveredPiece === pieceIndex ? PICK_HOVER_FILL : PICK_FILL}
            stroke="none"
            style={{ cursor: "pointer" }}
            pointerEvents="all"
            onPointerEnter={() => setHoveredPiece(pieceIndex)}
            onPointerLeave={() => setHoveredPiece((over) => (over === pieceIndex ? undefined : over))}
            onClick={() => keepOnlyPiece(pieceIndex)}
          >
            <title>{`click to keep this piece -- an object is saved as one piece, so the other ${pieces.length - 1 === 1 ? "one goes" : `${pieces.length - 1} go`}`}</title>
          </path>
        ))}

      {rings.map((ring, ringIndex) => (
        <path
          key={`outline-${ringIndex}`}
          d={cubicRingsToPathData([ring])}
          fill="none"
          stroke={invalid ? INVALID_COLOR : holes[ringIndex] ? HOLE_COLOR : stroke}
          strokeWidth={px(OUTLINE_WIDTH_PX)}
        />
      ))}

      {inserting && (
        <path
          d={cubicRingsToPathData(rings)}
          fill="none"
          stroke="transparent"
          strokeWidth={px(GRAB_RADIUS_PX * 2)}
          style={{ cursor: "copy" }}
          // stroke rather than all: the fill of this same path is the inside
          // of the object, and swallowing clicks there would take the piece
          // picker and every anchor's own grab circle out with it
          pointerEvents="stroke"
          onPointerMove={(e) => {
            if (grabRef.current) return;
            setGhost(placeOnOutline(e));
          }}
          onPointerLeave={() => setGhost(undefined)}
          onPointerDown={putAnchor}
        >
          <title>{"click anywhere on the outline to put a new anchor there"}</title>
        </path>
      )}

      {inserting && ghost && (
        <circle
          cx={ghost.point[0]}
          cy={ghost.point[1]}
          r={px(ANCHOR_RADIUS_PX)}
          fill={GHOST_FILL}
          stroke={ANCHOR_FILL}
          strokeWidth={px(LEASH_WIDTH_PX)}
          pointerEvents="none"
        />
      )}

      {showAnchors &&
        rings.map((ring, ringIndex) =>
          ring.map((anchor, anchorIndex) => {
            const { point, inControl, outControl } = anchor;
            const key = `${ringIndex}-${anchorIndex}`;
            const isSelected = selected?.ring === ringIndex && selected.anchor === anchorIndex;
            return (
              <g key={key} style={{ pointerEvents: "auto" }}>
                {!stitch && (
                  <>
                    <line
                      x1={point[0]}
                      y1={point[1]}
                      x2={inControl[0]}
                      y2={inControl[1]}
                      stroke={stroke}
                      strokeWidth={px(LEASH_WIDTH_PX)}
                    />
                    <line
                      x1={point[0]}
                      y1={point[1]}
                      x2={outControl[0]}
                      y2={outControl[1]}
                      stroke={stroke}
                      strokeWidth={px(LEASH_WIDTH_PX)}
                    />
                    {(["in", "out"] as const).map((side) => {
                      const at = side === "in" ? inControl : outControl;
                      return (
                        <circle
                          key={side}
                          cx={at[0]}
                          cy={at[1]}
                          r={px(CONTROL_RADIUS_PX)}
                          fill={CONTROL_FILL}
                          stroke={stroke}
                          strokeWidth={px(LEASH_WIDTH_PX)}
                          style={{ cursor: "grab" }}
                          strokeOpacity={1}
                          pointerEvents="all"
                          onPointerDown={(e) => onPointerDown(e, { ring: ringIndex, anchor: anchorIndex, kind: side })}
                        >
                          <title>{`drag to curve -- alt-drag to break the corner`}</title>
                        </circle>
                      );
                    })}
                  </>
                )}
                <circle
                  cx={point[0]}
                  cy={point[1]}
                  r={px(GRAB_RADIUS_PX)}
                  fill="transparent"
                  style={{ cursor: stitch ? "crosshair" : "move" }}
                  pointerEvents="all"
                  onPointerDown={(e) => onAnchorPointerDown(e, ringIndex, anchorIndex)}
                >
                  {stitch && (
                    <title>
                      {isSelected
                        ? "click again to let go"
                        : selected?.ring === ringIndex
                          ? "click to stitch across to the anchor already picked"
                          : "click two anchors to stitch across them"}
                    </title>
                  )}
                </circle>
                <circle
                  cx={point[0]}
                  cy={point[1]}
                  r={px(isSelected ? SELECTED_RADIUS_PX : ANCHOR_RADIUS_PX)}
                  fill={isSelected ? SELECTED_FILL : ANCHOR_FILL}
                  stroke={isSelected ? ANCHOR_FILL : stroke}
                  strokeWidth={px(LEASH_WIDTH_PX)}
                  pointerEvents="none"
                />
              </g>
            );
          }),
        )}
    </svg>
  );
}
