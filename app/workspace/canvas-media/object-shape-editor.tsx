"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  cubicRingsToPathData,
  editableRings,
  moveAnchor,
  flattenCubicRing,
  moveControl,
  normalizeEditedRings,
  ringPieces,
  stitchRing,
  type CubicRing,
  type Point,
} from "./object-path.ts";
import { polygonArea } from "./object-shape.ts";
import { Z_INDEX } from "../workspace.config";

/** Handle sizes, in css pixels -- held constant however far the canvas is zoomed. */
const ANCHOR_RADIUS_PX = 4.5;
const SELECTED_RADIUS_PX = 6;
const CONTROL_RADIUS_PX = 3.5;
const OUTLINE_WIDTH_PX = 1.5;
const LEASH_WIDTH_PX = 1;
const GRAB_RADIUS_PX = 9;
/**
 * Below this enclosed area, in the shape's own normalized units, an outline has
 * been dragged flat and no longer encloses anything to raise relief over. About
 * one draft texel squared -- the point at which the rasterizer would find no
 * interior either.
 */
const COLLAPSED_AREA = 1e-3;

/**
 * The geometry rings here are already expressed in. normalizeEditedRings
 * measures an outline out of an object's space and into a normalized path;
 * these rings are in the canvas's buffer coordinates already, so it is handed
 * the identity and returns the object geometry the edit implies directly.
 */
const BUFFER_SPACE = { cx: 0, cy: 0, radius: 1 };

const OUTLINE_COLOR = "rgb(66, 133, 244)";
const INVALID_COLOR = "rgb(211, 71, 71)";
const HOLE_COLOR = "rgba(66, 133, 244, 0.5)";
const ANCHOR_FILL = "rgb(255, 255, 255)";
const CONTROL_FILL = "rgb(32, 32, 32)";
const SELECTED_FILL = "rgb(66, 133, 244)";
const PICK_FILL = "rgba(66, 133, 244, 0.12)";
const PICK_HOVER_FILL = "rgba(66, 133, 244, 0.34)";

interface Grab {
  pointerId: number;
  ring: number;
  anchor: number;
  kind: "anchor" | "in" | "out";
  breakSymmetry: boolean;
  /**
   * Whether the pointer has actually moved since it went down. A press and
   * release with no movement in between is not an edit, and must not be
   * recorded as one -- committing it would re-tag the object's triangles for a
   * click that changed nothing.
   */
  moved: boolean;
}

export interface ObjectShapeEditorProps {
  /** The object being reshaped, in the mask's own mesh coordinates. */
  object: { cx: number; cy: number; radius: number; shape: string };
  /** The canvas's buffer size -- the space cx/cy/radius are measured in. */
  bufferWidth: number;
  bufferHeight: number;
  /** The canvas's css size, so handles can be kept a constant size on screen. */
  cssWidth: number;
  cssHeight: number;
  /**
   * The outline as it is being dragged, renormalized with the geometry that
   * keeps it where it was drawn. Fires every frame, and must not round-trip
   * through global state -- see onCommit.
   */
  onPreview: (edit: ShapeEdit) => void;
  /**
   * The outline once the pointer is released. Separate from onPreview because
   * this is what gets recorded as the reviewer's edit, and recording during a
   * drag would feed the edit back in as a new `object.shape` prop -- moving the
   * geometry out from under the cursor mid-gesture.
   */
  onCommit: (edit: ShapeEdit) => void;
  /**
   * Whether the pen is stitching rather than dragging. Held on the tool, so
   * the toggle lives in the pen's own bar -- see penbar.
   *
   * The two modes are exclusive because the gesture is the same one: an anchor
   * cannot both be dragged and picked out by a press. While stitching, the
   * control handles come off entirely rather than going inert, so there is
   * never a handle sitting there looking draggable that is not.
   */
  stitch: boolean;
  /**
   * Whether the anchors and their control handles are on the outline at all.
   *
   * The pen shares the canvas with the review's other half -- clicking
   * triangles to add and remove them -- and near a curve those triangles are
   * the small ones, cut down by the outline itself. A handle is a nine-pixel
   * grab target sitting exactly there, so the two compete for the same clicks
   * and the handle always wins. Turning the anchors off hands those clicks
   * back.
   *
   * The outline stays drawn, because it is still what the reviewer is judging
   * the triangles against; it just stops being something they can catch hold
   * of. Nothing goes inert-but-visible -- a handle that cannot be dragged is
   * worse than no handle -- so they come off entirely, the same way the
   * control points do while stitching.
   */
  showAnchors: boolean;
}

export interface ShapeEdit {
  path: string;
  cx: number;
  cy: number;
  radius: number;
}

/**
 * The pen: an object's outline drawn over the mask canvas, with a handle on
 * every anchor and control point.
 *
 * An svg sharing the canvas's own viewBox rather than a second canvas, so the
 * outline is positioned by the same numbers the shader uses -- object cx/cy
 * are already in buffer coordinates -- and the browser does the hit testing.
 *
 * Everything here works in the canvas's own buffer coordinates and converts at
 * the two edges only: a stored shape is normalized to unit extent, so opening
 * one multiplies it back out through `cx + n * radius`, and committing measures
 * the result back down into a path and the geometry that carries it.
 *
 * Working in buffer units rather than the shape's normalized space is what
 * keeps an edit still. Committing changes the object's cx/cy/radius -- an
 * anchor dragged outward grows the radius, not the normalized outline -- and
 * that comes straight back down as a new `object` prop. Rings measured against
 * the old radius would then be drawn against the new one: the anchor under the
 * cursor would look right, being placed from the same geometry the pointer is
 * read through, while every other anchor slid, walking the object a little
 * further across the mask with every release. In buffer units there is nothing
 * to re-measure, and an anchor nobody touched cannot move.
 */
export default function ObjectShapeEditor({
  object,
  bufferWidth,
  bufferHeight,
  cssWidth,
  cssHeight,
  onPreview,
  onCommit,
  stitch,
  showAnchors,
}: ObjectShapeEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const grabRef = useRef<Grab | undefined>(undefined);

  // Read once, on open, and multiplied out of the shape's normalized space by
  // the geometry it arrived paired with. This component owns the rings for as
  // long as it is mounted: it is the source of the edits that come back to it
  // as `object`, so re-deriving from that prop would have it fight itself. The
  // parent remounts it by key when what it should be showing really changes --
  // another candidate, or a revert.
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

  // The ref is what a drag reads and writes; the state exists to re-render off.
  // Keeping both is not redundancy -- pointermove fires faster than React
  // commits, so consecutive moves within one frame have to build on each
  // other's result rather than all on the last committed one.
  const ringsRef = useRef(rings);
  const applyRings = useCallback((next: CubicRing[]) => {
    ringsRef.current = next;
    setRings(next);
  }, []);

  // The first of the two anchors a stitch needs. Plain state rather than a ref
  // -- unlike a drag this advances one press at a time, so there is no risk of
  // two of them landing inside a frame of each other.
  //
  // A half-made stitch does not survive either toggle: leaving stitch mode and
  // coming back, or hiding the anchors and bringing them back, would otherwise
  // find an anchor still picked from before, and the next click anywhere on
  // the outline would cut across to it. Adjusted during render rather than in
  // an effect, so the stale selection is never painted even once.
  const [selected, setSelected] = useState<{ ring: number; anchor: number } | undefined>(undefined);
  const pickable = stitch && showAnchors;
  const [pickableWas, setPickableWas] = useState(pickable);
  if (pickableWas !== pickable) {
    setPickableWas(pickable);
    setSelected(undefined);
  }

  // Which piece the cursor is over, while there is more than one to choose
  // between. Only ever set by the picking layer, which is only mounted then.
  const [hoveredPiece, setHoveredPiece] = useState<number | undefined>(undefined);

  // css pixels per buffer unit, so a handle drawn in viewBox units comes out
  // the same size on screen at any canvas zoom
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

  // Whether the outline still encloses anything, checked as it is dragged so
  // the stroke can go red the moment it stops being renderable rather than at
  // the moment someone tries to save it.
  //
  // By area rather than by building the field, because this runs every frame:
  // rasterizing is ~58ms for a traced outline, and doing it here as well as in
  // the renderer put a drag at about four frames a second. Collapsing a shape
  // until it encloses nothing is the failure a pen can actually cause, and
  // area sees it for free off the flattening the drag already does. The real
  // check still runs, once, on the committed outline -- see the review panel.
  //
  // How the rings group falls out of the same flattening. Ring order used to
  // stand in for it -- ring zero the outline, the rest cut out of it -- which
  // was true for as long as an extra ring could only have come from detection
  // tracing a hole. Stitching makes islands, which are extra rings that are
  // not holes at all: one drawn in the dimmer hole colour would be telling the
  // reviewer their island had been punched through the object instead, and
  // more than one piece is the thing they now have to resolve before the
  // object can be saved at all.
  const { invalid, holes, pieces } = useMemo(() => {
    const flat = rings.map((ring) => flattenCubicRing(ring));
    const widest = Math.max(0, ...flat.map((ring) => Math.abs(polygonArea(ring))));
    const { depth, pieces } = ringPieces(flat);
    return {
      // the threshold is in normalized units, and these rings are in buffer
      // units -- an area, so it scales by the square of the radius between them
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

  const onPointerDown = (event: React.PointerEvent, grab: Omit<Grab, "pointerId" | "breakSymmetry" | "moved">) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    grabRef.current = { ...grab, pointerId: event.pointerId, breakSymmetry: event.altKey, moved: false };
  };

  /**
   * Take one anchor for a stitch, and make the cut once there are two.
   *
   * Both have to be on the same ring: two anchors of different rings have
   * nothing between them to cut away, and no chord across them would be inside
   * the shape. Picking one on another ring starts over there rather than
   * failing silently, and picking the same anchor twice lets go of it.
   */
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
    // straight to onCommit with no onPreview before it: a stitch is not a drag
    // being followed, it is over the instant it is made
    const edit = normalizeEditedRings(next, BUFFER_SPACE);
    if (edit) onCommit(edit);
  };

  /**
   * Keep one piece and discard the rest.
   *
   * An object is one thing. Stitching can leave the outline in several, and
   * rather than guess which one was meant -- the biggest is not reliably it,
   * and a reviewer cutting a peninsula off may well have wanted the peninsula
   * -- the shape stays unsaveable until someone says. See the review panel,
   * which refuses to accept a multi-piece outline.
   *
   * The stitch selection goes with it: ring indices shift when rings are
   * dropped, and an anchor picked out of a ring that no longer exists would
   * cut somewhere nobody pointed at.
   */
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

    // Computed outside setRings deliberately. A state updater runs during
    // render, so previewing from inside one would be dispatching into the
    // parent's store mid-render -- React refuses, and rightly.
    const next = ringsRef.current.map((ring, index) => {
      if (index !== grab.ring) return ring;
      if (grab.kind === "anchor") return moveAnchor(ring, grab.anchor, at);
      return moveControl(ring, grab.anchor, grab.kind, at, grab.breakSymmetry || event.altKey);
    });
    applyRings(next);
    preview(next);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const grab = grabRef.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    grabRef.current = undefined;
    event.stopPropagation();
    if (!grab.moved) return;
    // the ref, not the state: the last pointermove may not have committed yet,
    // and committing the edit without it would drop the end of the gesture
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
        // only the handles take the pointer -- and the piece picker while it is
        // up; clicking the mask between them still toggles triangles, which is
        // the other half of reviewing
        pointerEvents: "none",
        touchAction: "none",
        overflow: "visible",
      }}
    >
      {/*
        Laid down before the outlines and the handles, so a piece never covers
        an anchor the reviewer could otherwise still drag. While it is mounted
        it does take the clicks that would have toggled triangles underneath --
        which is right: the triangles are derived from the outline, and there
        is no single outline to derive them from until this is settled.
      */}
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
                          // a wider invisible target than the dot, so a 3px handle
                          // is still catchable with a mouse
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
