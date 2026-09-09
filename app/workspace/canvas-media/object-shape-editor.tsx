"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  EDITABLE_MAX_ANCHORS,
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
import { placedShapeMap, restingShapeMap, type Matrix2, type PlacedShape } from "../mask-gl";
import {
  HIGHLIGHT_SHADOW_BLUR_PX,
  HIGHLIGHT_SHADOW_COLOR,
  HIGHLIGHT_SHADOW_OFFSET_PX,
  highlightCss,
} from "../mask-constants";
import { Z_INDEX } from "../workspace.config";

const ANCHOR_RADIUS_PX = 4.5;
const SELECTED_RADIUS_PX = 6;
const CONTROL_RADIUS_PX = 3.5;
const OUTLINE_WIDTH_PX = 1.5;
const LEASH_WIDTH_PX = 1;
const GRAB_RADIUS_PX = 9;
const ZOOM_COMPENSATION = 0.85;
const COLLAPSED_AREA = 1e-3;
const EDGE_ON_DETERMINANT = 1e-4;
const ANCHOR_LIMIT_REACHED = "anchor limit reached!";
const BUFFER_SPACE = { cx: 0, cy: 0, radius: 1 };

const shapePathAlpha = (gridlines: number) => (gridlines >= 1 ? 1 : 0.5);
const shapePathColor = (gridlines: number) => `rgba(255, 255, 255, ${shapePathAlpha(gridlines)})`;
const shapePathDiffColor = (gridlines: number) => `rgba(251, 166, 39, ${shapePathAlpha(gridlines)})`;

const HOLE_COLOR = "rgba(66, 133, 244, 0.5)";
const INVALID_COLOR = "rgb(211, 71, 71)";
const ANCHOR_FILL = "rgb(255, 255, 255)";
const CONTROL_FILL = "rgb(32, 32, 32)";
const SELECTED_ANCHOR_FILL = "rgb(66, 133, 244)";
const GHOST_FILL = "rgba(66, 133, 244, 0.65)";
const PICK_FILL = "rgba(66, 133, 244, 0.12)";
const PICK_HOVER_FILL = "rgba(66, 133, 244, 0.34)";
const PREVIEW_COLOR = "rgb(255, 255, 255)";

function determinant2(matrix: Matrix2 | undefined): number {
  return matrix ? matrix[0] * matrix[3] - matrix[1] * matrix[2] : 1;
}

function screenPxUnit(bufferWidth: number, cssWidth: number, canvasZoom: number): number {
  const perBufferUnit = cssWidth > 0 ? bufferWidth / cssWidth : 1;
  return perBufferUnit / Math.pow(canvasZoom > 0 ? canvasZoom : 1, ZOOM_COMPENSATION);
}

export interface ShapeOutline {
  id: number | string;
  region: { cx: number; cy: number; radius: number; shape: string; transform?: Matrix2 };
  color: string;
}

export interface ShapeOutlinesProps {
  outlines: ShapeOutline[];
  bufferWidth: number;
  bufferHeight: number;
  cssWidth: number;
  cssHeight: number;
  canvasZoom: number;
}

export function ShapeOutlines({
  outlines,
  bufferWidth,
  bufferHeight,
  cssWidth,
  cssHeight,
  canvasZoom,
}: ShapeOutlinesProps) {
  const shadowId = `highlight-shadow-${useId().replace(/:/g, "")}`;
  const drawable = outlines.filter(
    ({ region }) =>
      region.shape && region.radius > 0 && Math.abs(determinant2(region.transform)) >= EDGE_ON_DETERMINANT,
  );
  if (drawable.length === 0) return null;
  const unit = screenPxUnit(bufferWidth, cssWidth, canvasZoom);
  const stroke = OUTLINE_WIDTH_PX * unit;
  return (
    <svg
      width={cssWidth}
      height={cssHeight}
      viewBox={`0 0 ${bufferWidth} ${bufferHeight}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: Z_INDEX.ITEM_CONTENT + 1,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx={HIGHLIGHT_SHADOW_OFFSET_PX[0] * unit}
            dy={HIGHLIGHT_SHADOW_OFFSET_PX[1] * unit}
            stdDeviation={HIGHLIGHT_SHADOW_BLUR_PX * unit}
            floodColor={highlightCss(HIGHLIGHT_SHADOW_COLOR)}
          />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        {drawable.map(({ id, region, color }) => {
          const spread = Math.sqrt(Math.abs(determinant2(region.transform)));
          const shaped = region.transform
            ? ` matrix(${region.transform[0]} ${region.transform[2]} ${region.transform[1]} ${region.transform[3]} 0 0)`
            : "";
          return (
            <path
              key={id}
              d={region.shape}
              transform={`translate(${region.cx} ${region.cy})${shaped} scale(${region.radius})`}
              fill="none"
              stroke={color}
              strokeWidth={stroke / (region.radius * spread)}
            />
          );
        })}
      </g>
    </svg>
  );
}

export interface ShapePreviewSizes {
  anchor: {
    fraction: number;
    minRadius: number;
  };
  outline: {
    fraction: number;
    minWidth: number;
  };
}

export function ShapePreview({
  shape,
  size,
  sizes,
  style,
}: {
  shape: string;
  size: number;
  sizes: ShapePreviewSizes;
  style?: React.CSSProperties;
}) {
  const rings = useMemo(() => editableRings(shape), [shape]);
  const frame = useMemo(() => {
    const points = rings.flatMap((ring) => flattenCubicRing(ring).concat(ring.map((anchor) => anchor.point)));
    if (points.length === 0) return undefined;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const half = Math.max(maxX - minX, maxY - minY) / 2;
    return half > 0 ? { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, half } : undefined;
  }, [rings]);

  if (!frame || size <= 0) return null;

  const anchorRadiusPx = Math.max(sizes.anchor.minRadius, size * sizes.anchor.fraction);
  const outlineWidthPx = Math.max(sizes.outline.minWidth, size * sizes.outline.fraction);
  const room = 1 - (2 * anchorRadiusPx) / size;
  if (room <= 0) return null;

  const half = frame.half / room;
  const unit = (2 * half) / size;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${frame.cx - half} ${frame.cy - half} ${half * 2} ${half * 2}`}
      style={{ pointerEvents: "none", ...style }}
    >
      {rings.map((ring, ringIndex) => (
        <path
          key={`preview-outline-${ringIndex}`}
          d={cubicRingsToPathData([ring])}
          fill="none"
          stroke={PREVIEW_COLOR}
          strokeWidth={outlineWidthPx * unit}
        />
      ))}
      {rings.map((ring, ringIndex) =>
        ring.map((anchor, anchorIndex) => (
          <circle
            key={`preview-anchor-${ringIndex}-${anchorIndex}`}
            cx={anchor.point[0]}
            cy={anchor.point[1]}
            r={anchorRadiusPx * unit}
            fill={PREVIEW_COLOR}
          />
        )),
      )}
    </svg>
  );
}

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
  place?: PlacedShape;
  bufferWidth: number;
  bufferHeight: number;
  cssWidth: number;
  cssHeight: number;
  canvasZoom: number;
  onPreview: (edit: ShapeEdit) => void;
  onCommit: (edit: ShapeEdit) => void;
  stitch: boolean;
  addAnchor: boolean;
  showAnchors: boolean;
  gridlines: number;
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
  place,
  bufferWidth,
  bufferHeight,
  cssWidth,
  cssHeight,
  canvasZoom,
  onPreview,
  onCommit,
  stitch,
  addAnchor,
  showAnchors,
  gridlines,
  reference,
}: ObjectShapeEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const grabRef = useRef<Grab | undefined>(undefined);

  const placed =
    place && place.radius > 0 && object.radius > 0 && Math.abs(determinant2(place.transform)) >= EDGE_ON_DETERMINANT
      ? place
      : undefined;
  const drawn: PlacedShape = placed ?? { cx: object.cx, cy: object.cy, radius: object.radius, transform: undefined };

  const [rings, setRings] = useState<CubicRing[]>(() => {
    const placeAt = placedShapeMap(drawn);
    const out = (n: Point): Point => placeAt(n[0], n[1]);
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
  const [ghost, setGhost] = useState<RingPlace | undefined>(undefined);

  const pickable = stitch && showAnchors;
  const inserting = addAnchor && showAnchors;
  const [modeWas, setModeWas] = useState({ pickable, inserting });
  if (modeWas.pickable !== pickable || modeWas.inserting !== inserting) {
    setModeWas({ pickable, inserting });
    setSelected(undefined);
    setGhost(undefined);
  }

  const [hoveredPiece, setHoveredPiece] = useState<number | undefined>(undefined);

  const perScreenPx = screenPxUnit(bufferWidth, cssWidth, canvasZoom);
  const px = useCallback((size: number) => size * perScreenPx, [perScreenPx]);

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
      invalid: widest < COLLAPSED_AREA * drawn.radius * drawn.radius,
      holes: depth.map((enclosing) => enclosing % 2 === 1),
      pieces,
    };
  }, [rings, drawn.radius]);

  const toRest = useMemo(() => {
    if (!placed) return undefined;
    const rest = restingShapeMap(placed, object);
    return (p: Point): Point => rest(p[0], p[1]);
  }, [placed, object]);

  const edited = useCallback(
    (next: CubicRing[]) => {
      if (!toRest) return normalizeEditedRings(next, BUFFER_SPACE);
      const rest = next.map((ring) =>
        ring.map((anchor) => ({
          point: toRest(anchor.point),
          inControl: toRest(anchor.inControl),
          outControl: toRest(anchor.outControl),
        })),
      );
      return normalizeEditedRings(rest, BUFFER_SPACE);
    },
    [toRest],
  );

  const preview = useCallback(
    (next: CubicRing[]) => {
      const edit = edited(next);
      if (edit) onPreview(edit);
    },
    [edited, onPreview],
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
    const edit = edited(next);
    if (edit) onCommit(edit);
  };

  const keepOnlyPiece = (at: number) => {
    const piece = pieces[at];
    if (!piece || pieces.length < 2) return;
    const next = piece.map((index) => rings[index]);
    setHoveredPiece(undefined);
    setSelected(undefined);
    applyRings(next);
    const edit = edited(next);
    if (edit) onCommit(edit);
  };

  const placeOnOutline = (event: React.PointerEvent): RingPlace | undefined => {
    const at = fromClient(event.clientX, event.clientY);
    return at ? nearestOnRings(ringsRef.current, at) : undefined;
  };

  const ringIsFull = (at: number): boolean => (ringsRef.current[at]?.length ?? 0) >= EDITABLE_MAX_ANCHORS;

  const putAnchor = (event: React.PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const place = placeOnOutline(event);
    if (!place) return;
    if (ringIsFull(place.ring)) {
      setGhost(undefined);
      alert(ANCHOR_LIMIT_REACHED);
      return;
    }
    const next = insertAnchor(ringsRef.current, place.ring, place.segment, place.t);
    if (!next) return;
    setGhost(undefined);
    setSelected(undefined);
    applyRings(next);
    const edit = edited(next);
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
    if (grab.rafId !== undefined) cancelAnimationFrame(grab.rafId);
    flushGrab(false);
    grabRef.current = undefined;
    event.stopPropagation();
    if (!grab.moved) return;
    const edit = edited(ringsRef.current);
    if (edit) onCommit(edit);
  };

  const ghostIsRefused = ghost !== undefined && (rings[ghost.ring]?.length ?? 0) >= EDITABLE_MAX_ANCHORS;

  const stroke = invalid ? INVALID_COLOR : shapePathColor(gridlines);
  const placement = placed
    ? `translate(${placed.cx} ${placed.cy})` +
      (placed.transform
        ? ` matrix(${placed.transform[0]} ${placed.transform[2]} ${placed.transform[1]} ${placed.transform[3]} 0 0)`
        : "") +
      ` scale(${placed.radius / object.radius}) translate(${-object.cx} ${-object.cy}) `
    : "";
  const placedSpread = placed
    ? (placed.radius / object.radius) * Math.sqrt(Math.abs(determinant2(placed.transform)))
    : 1;

  return (
    <svg
      ref={svgRef}
      width={cssWidth}
      height={cssHeight}
      viewBox={`0 0 ${bufferWidth} ${bufferHeight}`}
      preserveAspectRatio="none"
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
          transform={`${placement}translate(${reference.cx} ${reference.cy}) scale(${reference.radius})`}
          fill="none"
          stroke={shapePathDiffColor(gridlines)}
          strokeWidth={px(OUTLINE_WIDTH_PX) / (reference.radius * placedSpread)}
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
          style={{ cursor: ghostIsRefused ? "not-allowed" : "copy" }}
          pointerEvents="stroke"
          onPointerMove={(e) => {
            if (grabRef.current) return;
            setGhost(placeOnOutline(e));
          }}
          onPointerLeave={() => setGhost(undefined)}
          onPointerDown={putAnchor}
        >
          <title>
            {ghostIsRefused ? ANCHOR_LIMIT_REACHED : "click anywhere on the outline to put a new anchor there"}
          </title>
        </path>
      )}

      {inserting && ghost && !ghostIsRefused && (
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
            const toIn = Math.hypot(inControl[0] - point[0], inControl[1] - point[1]);
            const toOut = Math.hypot(outControl[0] - point[0], outControl[1] - point[1]);
            const reach = (toNeighbour: number, drawn: number) =>
              Math.max(px(drawn), Math.min(px(GRAB_RADIUS_PX), toNeighbour / 2));
            const anchorReach = stitch
              ? px(GRAB_RADIUS_PX)
              : reach(Math.min(toIn, toOut), isSelected ? SELECTED_RADIUS_PX : ANCHOR_RADIUS_PX);
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
                        <g key={side}>
                          <circle
                            cx={at[0]}
                            cy={at[1]}
                            r={reach(side === "in" ? toIn : toOut, CONTROL_RADIUS_PX)}
                            fill="transparent"
                            style={{ cursor: "grab" }}
                            pointerEvents="all"
                            onPointerDown={(e) =>
                              onPointerDown(e, { ring: ringIndex, anchor: anchorIndex, kind: side })
                            }
                          >
                            <title>{`drag to curve -- alt-drag to break the corner`}</title>
                          </circle>
                          <circle
                            cx={at[0]}
                            cy={at[1]}
                            r={px(CONTROL_RADIUS_PX)}
                            fill={CONTROL_FILL}
                            stroke={stroke}
                            strokeWidth={px(LEASH_WIDTH_PX)}
                            strokeOpacity={1}
                            pointerEvents="none"
                          />
                        </g>
                      );
                    })}
                  </>
                )}
                <circle
                  cx={point[0]}
                  cy={point[1]}
                  r={anchorReach}
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
                  fill={isSelected ? SELECTED_ANCHOR_FILL : ANCHOR_FILL}
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
