import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDITABLE_MAX_ANCHORS,
  anchorsForRing,
  cubicPointAt,
  cubicRingsToPathData,
  editableRings,
  fitCubicRing,
  flattenCubicRing,
  insertAnchor,
  moveAnchor,
  moveControl,
  nearestOnRings,
  normalizeEditedRings,
  parseCubicRings,
  ringPieces,
  stitchRing,
  unitCirclePath,
  unitCircleRing,
  type CubicRing,
  type Point,
} from "./object-path.ts";
import { flattenPathData, sampleObjectShapePath } from "./object-shape.ts";
import { insideRings } from "./object-clip.ts";

function circlePoints(radius: number, count = 360, center: Point = [0, 0]): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)] as Point;
  });
}

const DIAMOND: Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

describe("parseCubicRings -- a path as anchors rather than points", () => {
  it("reads one anchor per corner, not one per curve", () => {
    // the closing curve lands back on the first anchor; that is the same
    // anchor, not a fifth one
    const path = cubicRingsToPathData([fitCubicRing(DIAMOND)]);
    const rings = parseCubicRings(path);
    assert.ok(rings);
    assert.equal(rings.length, 1);
    assert.equal(rings[0].length, 4);
  });

  it("gives the first anchor the closing segment's trailing control", () => {
    const fitted = fitCubicRing(DIAMOND);
    const reparsed = parseCubicRings(cubicRingsToPathData([fitted]));
    assert.ok(reparsed);
    for (const side of ["inControl", "outControl"] as const) {
      assert.ok(
        Math.hypot(reparsed[0][0][side][0] - fitted[0][side][0], reparsed[0][0][side][1] - fitted[0][side][1]) < 1e-4,
        `first anchor's ${side} was lost across the seam`,
      );
    }
  });

  it("reads a legacy polyline, putting controls at the thirds", () => {
    const rings = parseCubicRings("M0,0L3,0L3,3L0,3Z");
    assert.ok(rings);
    assert.equal(rings[0].length, 4);
    assert.deepEqual(rings[0][0].outControl, [1, 0]);
    assert.deepEqual(rings[0][1].inControl, [2, 0]);
  });

  it("keeps every subpath, so an outline and its hole both open", () => {
    const rings = parseCubicRings("M0,0L4,0L4,4L0,4ZM1,1L2,1L2,2L1,2Z");
    assert.ok(rings);
    assert.equal(rings.length, 2);
  });

  it("refuses what is not a path rather than guessing", () => {
    assert.equal(parseCubicRings("wat"), undefined);
    assert.equal(parseCubicRings(""), undefined);
    assert.equal(parseCubicRings("L1,1Z"), undefined, "a segment with no start");
  });
});

describe("the editable round trip", () => {
  it("writes what it read, unchanged", () => {
    const original = cubicRingsToPathData([fitCubicRing(DIAMOND)]);
    const rings = parseCubicRings(original);
    assert.ok(rings);
    assert.equal(cubicRingsToPathData(rings), original);
  });

  it("leaves a polyline's geometry alone through the conversion to cubics", () => {
    // a straight segment with controls at the thirds is the same straight
    // segment, so reading a legacy shape and writing it back must not move it
    const square = "M-1,-1L1,-1L1,1L-1,1Z";
    const rings = parseCubicRings(square);
    assert.ok(rings);
    for (const point of flattenCubicRing(rings[0])) {
      const onEdge = Math.abs(Math.abs(point[0]) - 1) < 1e-9 || Math.abs(Math.abs(point[1]) - 1) < 1e-9;
      assert.ok(onEdge, `${point} left the square's outline`);
    }
  });

  it("survives being read back as a renderable shape", () => {
    const path = cubicRingsToPathData([fitCubicRing(DIAMOND)]);
    assert.ok(sampleObjectShapePath(path), "the editor's own output must render");
  });

  it("keeps a hole a hole through an edit", () => {
    const rings = editableRings("M0,0L4,0L4,4L0,4ZM1,1L3,1L3,3L1,3Z");
    assert.equal(rings.length, 2);
    const shape = sampleObjectShapePath(cubicRingsToPathData(rings));
    assert.ok(shape, "a holed shape must still render after a round trip");
  });
});

describe("editableRings -- opening whatever is stored", () => {
  it("leaves a detected shape's own anchors alone", () => {
    // re-fitting a shape merely to look at it would redraw work already
    // approved, so a path already within the cap opens verbatim
    const path = cubicRingsToPathData([fitCubicRing(DIAMOND)]);
    assert.equal(cubicRingsToPathData(editableRings(path)), path);
  });

  it("re-fits a legacy 128-gon down to something a pen can work", () => {
    const polyline =
      "M" +
      circlePoints(1, 128)
        .map(([x, y]) => `${x},${y}`)
        .join("L") +
      "Z";
    const rings = editableRings(polyline);
    assert.equal(rings.length, 1);
    assert.ok(rings[0].length <= EDITABLE_MAX_ANCHORS, `${rings[0].length} anchors is unusable`);
    assert.ok(rings[0].length >= 4, "it was thinned past being a shape");
  });

  it("keeps a re-fitted circle round", () => {
    const polyline =
      "M" +
      circlePoints(1, 128)
        .map(([x, y]) => `${x},${y}`)
        .join("L") +
      "Z";
    for (const point of flattenCubicRing(editableRings(polyline)[0])) {
      assert.ok(Math.abs(Math.hypot(...point) - 1) < 0.02, `re-fit drifted to r=${Math.hypot(...point)}`);
    }
  });
});

describe("fitCubicRing -- re-fitting a path with no boundary underneath it", () => {
  it("passes exactly through every anchor", () => {
    const flattened = flattenCubicRing(fitCubicRing(DIAMOND));
    for (const anchor of DIAMOND) {
      const nearest = Math.min(...flattened.map((p) => Math.hypot(p[0] - anchor[0], p[1] - anchor[1])));
      assert.ok(nearest < 1e-9, `${anchor} is not on the curve`);
    }
  });

  it("overshoots less than uniform weighting on uneven anchors", () => {
    // the reason for centripetal alpha
    const anchors: Point[] = [
      [-1, -0.2],
      [1, -0.2],
      [1.02, -0.18],
      [1, 0.2],
      [-1, 0.2],
    ];
    const hull = [Math.max(...anchors.map((a) => Math.abs(a[0]))), Math.max(...anchors.map((a) => Math.abs(a[1])))];
    const overshoot = (alpha: number): number => {
      const flat = flattenCubicRing(fitCubicRing(anchors, alpha));
      return Math.max(
        Math.max(...flat.map((p) => Math.abs(p[0]))) - hull[0],
        Math.max(...flat.map((p) => Math.abs(p[1]))) - hull[1],
      );
    };
    assert.ok(overshoot(0.5) < overshoot(0), "centripetal should beat uniform here");
    assert.ok(overshoot(0.5) < 0.2, `centripetal overshot by ${overshoot(0.5)}`);
  });
});

describe("anchorsForRing", () => {
  it("thins until it fits, however dense the input", () => {
    for (const count of [64, 128, 720]) {
      assert.ok(anchorsForRing(circlePoints(1, count)).length <= EDITABLE_MAX_ANCHORS);
    }
  });

  it("leaves a shape that already fits alone", () => {
    assert.equal(anchorsForRing(DIAMOND).length, 4);
  });
});

describe("dragging", () => {
  it("carries an anchor's handles with it, so the curve translates", () => {
    const ring = fitCubicRing(DIAMOND);
    const before = ring[0];
    const moved = moveAnchor(ring, 0, [2, 0.5]);
    assert.deepEqual(moved[0].point, [2, 0.5]);
    const shift: Point = [2 - before.point[0], 0.5 - before.point[1]];
    assert.deepEqual(moved[0].inControl, [before.inControl[0] + shift[0], before.inControl[1] + shift[1]]);
    assert.deepEqual(moved[0].outControl, [before.outControl[0] + shift[0], before.outControl[1] + shift[1]]);
  });

  it("leaves every other anchor untouched", () => {
    const ring = fitCubicRing(DIAMOND);
    const moved = moveAnchor(ring, 0, [2, 0.5]);
    for (let i = 1; i < ring.length; i++) assert.deepEqual(moved[i], ring[i]);
  });

  it("mirrors the opposite handle so the curve stays smooth", () => {
    const ring = fitCubicRing(DIAMOND);
    const moved = moveControl(ring, 1, "out", [0.5, 2]);
    assert.deepEqual(moved[1].outControl, [0.5, 2]);
    // reflected through the anchor at [0, 1]
    assert.deepEqual(moved[1].inControl, [-0.5, 0]);
  });

  it("leaves the opposite handle put when symmetry is broken, making a corner", () => {
    const ring = fitCubicRing(DIAMOND);
    const moved = moveControl(ring, 1, "out", [0.5, 2], true);
    assert.deepEqual(moved[1].outControl, [0.5, 2]);
    assert.deepEqual(moved[1].inControl, ring[1].inControl);
  });

  it("produces a path that still renders after a drag", () => {
    const ring = moveAnchor(fitCubicRing(DIAMOND), 0, [1.8, 0.2]);
    assert.ok(sampleObjectShapePath(cubicRingsToPathData([ring])));
  });
});

describe("what the editor writes is what the renderer reads", () => {
  it("agrees with flattenPathData about where the outline goes", () => {
    // two flatteners, one path: object-path's for drawing handles, and
    // object-shape's for rasterizing. They must not disagree, or the outline
    // drawn on screen sits somewhere the relief does not.
    const ring = fitCubicRing(DIAMOND);
    const viaEditor = flattenCubicRing(ring);
    const viaRenderer = flattenPathData(cubicRingsToPathData([ring]))[0];
    for (const point of viaEditor) {
      const nearest = Math.min(...viaRenderer.map((p) => Math.hypot(p[0] - point[0], p[1] - point[1])));
      assert.ok(nearest < 1e-4, `${point} is on one flattening but not the other`);
    }
  });
});

describe("normalizeEditedRings -- keeping an edit where it was drawn", () => {
  const object = { cx: 200, cy: 150, radius: 50 };

  it("leaves an untouched shape's geometry alone", () => {
    const rings = [fitCubicRing(DIAMOND)];
    const result = normalizeEditedRings(rings, object);
    assert.ok(result);
    assert.ok(Math.abs(result.cx - object.cx) < 1e-6, `cx moved to ${result.cx}`);
    assert.ok(Math.abs(result.cy - object.cy) < 1e-6, `cy moved to ${result.cy}`);
    assert.ok(Math.abs(result.radius - object.radius) < 1e-6, `radius moved to ${result.radius}`);
  });

  it("grows the radius rather than shrinking the shape when an anchor is pulled out", () => {
    // the failure this exists to prevent: the renderer re-normalizes whatever
    // it is given, so an edit that only widened the path would render smaller
    const pulled = moveAnchor(fitCubicRing(DIAMOND), 0, [2, 0]);
    const result = normalizeEditedRings([pulled], object);
    assert.ok(result);
    assert.ok(result.radius > object.radius, `radius should grow, got ${result.radius}`);
    // and the outline it stores is normalized again, ready to be scaled by it
    const reach = Math.max(...flattenPathData(result.path).flatMap((r) => r.map((p) => Math.hypot(...p))));
    assert.ok(Math.abs(reach - 1) < 1e-4, `stored path is not unit extent: ${reach}`);
  });

  it("puts the pulled anchor back where the pen left it, in mesh units", () => {
    const pulled = moveAnchor(fitCubicRing(DIAMOND), 0, [2, 0]);
    const result = normalizeEditedRings([pulled], object);
    assert.ok(result);
    // the anchor was dragged to normalized x=2 against the original geometry,
    // i.e. mesh x = 200 + 2*50 = 300; it must still land there afterwards
    const rings = parseCubicRings(result.path);
    assert.ok(rings);
    const meshX = Math.max(...rings[0].map((a) => result.cx + a.point[0] * result.radius));
    assert.ok(Math.abs(meshX - 300) < 0.5, `the anchor ended up at mesh x=${meshX}, not 300`);
  });

  it("recentres when an edit makes the shape lopsided", () => {
    const pulled = moveAnchor(fitCubicRing(DIAMOND), 0, [3, 0]);
    const result = normalizeEditedRings([pulled], object);
    assert.ok(result);
    assert.ok(result.cx > object.cx, "the centre should follow the shape it describes");
  });
});

describe("an edited outline must be read back with its own geometry", () => {
  const original = { cx: 200, cy: 150, radius: 50 };

  it("reproduces exactly where the pen left the anchor", () => {
    const dragged = moveAnchor(fitCubicRing(DIAMOND), 0, [1.7, 0.2]);
    const edit = normalizeEditedRings([dragged], original);
    assert.ok(edit);

    // where the reviewer actually dragged it, in mesh units
    const wanted: Point = [original.cx + 1.7 * original.radius, original.cy + 0.2 * original.radius];

    const reread = parseCubicRings(edit.path);
    assert.ok(reread);
    const withOwn = reread[0]
      .map((a): Point => [edit.cx + a.point[0] * edit.radius, edit.cy + a.point[1] * edit.radius])
      .reduce((best, p) =>
        Math.hypot(p[0] - wanted[0], p[1] - wanted[1]) < Math.hypot(best[0] - wanted[0], best[1] - wanted[1])
          ? p
          : best,
      );
    assert.ok(
      Math.hypot(withOwn[0] - wanted[0], withOwn[1] - wanted[1]) < 0.5,
      `landed at ${withOwn}, wanted ${wanted}`,
    );
  });

  it("lands somewhere else entirely if paired with the pre-edit geometry", () => {
    // the bug this guards: the editor was handed the edited path but the
    // candidate's original cx/cy/radius, so the curve sprang back toward where
    // it started the moment the pointer was released
    const dragged = moveAnchor(fitCubicRing(DIAMOND), 0, [1.7, 0.2]);
    const edit = normalizeEditedRings([dragged], original);
    assert.ok(edit);
    const wanted: Point = [original.cx + 1.7 * original.radius, original.cy + 0.2 * original.radius];

    const reread = parseCubicRings(edit.path);
    assert.ok(reread);
    const withStale = reread[0].map((a): Point => [
      original.cx + a.point[0] * original.radius,
      original.cy + a.point[1] * original.radius,
    ]);
    const nearest = Math.min(...withStale.map((p) => Math.hypot(p[0] - wanted[0], p[1] - wanted[1])));
    assert.ok(
      nearest > 5,
      `stale geometry happened to land right, at ${nearest.toFixed(2)}px -- test is not pinning the bug`,
    );
  });
});

describe("what the pen holds on to between commits", () => {
  /** As the editor holds its rings: in the canvas's own buffer coordinates. */
  const BUFFER_SPACE = { cx: 0, cy: 0, radius: 1 };
  const opened = { cx: 200, cy: 150, radius: 50 };
  /** Three successive drags of anchor 0, in buffer coordinates. */
  const DRAGS: Point[] = [
    [285, 160],
    [295, 165],
    [305, 170],
  ];
  const untouched = 2;

  const openInBufferSpace = (): CubicRing =>
    fitCubicRing(DIAMOND.map((p): Point => [opened.cx + p[0] * opened.radius, opened.cy + p[1] * opened.radius]));

  it("holds every other anchor still, however many times it commits", () => {
    let ring = openInBufferSpace();
    const startedAt = ring[untouched].point;
    let edit = normalizeEditedRings([ring], BUFFER_SPACE);

    for (const to of DRAGS) {
      ring = moveAnchor(ring, 0, to);
      edit = normalizeEditedRings([ring], BUFFER_SPACE);
      assert.ok(edit);
    }
    assert.ok(edit);

    // the pen's own numbers: nothing but the dragged anchor has moved
    assert.deepEqual(ring[untouched].point, startedAt);

    // and what it committed draws it in the same place -- the path is
    // normalized, so this is the renderer's reading of it
    const reread = parseCubicRings(edit.path);
    assert.ok(reread);
    const drawn: Point = [
      edit.cx + reread[0][untouched].point[0] * edit.radius,
      edit.cy + reread[0][untouched].point[1] * edit.radius,
    ];
    assert.ok(
      Math.hypot(drawn[0] - startedAt[0], drawn[1] - startedAt[1]) < 0.01,
      `anchor ${untouched} opened at ${startedAt} and is drawn at ${drawn}`,
    );
  });

  it("pins the drift: held in normalized space, each commit walks the ones nobody touched", () => {
    // The bug this guards. The editor used to keep its rings normalized
    // against the object's geometry -- and committing hands back *new*
    // geometry, which arrives as a prop while the rings stay as they were.
    // Every anchor then gets drawn against a radius it was never measured in,
    // so the whole outline slides a little further with each release while the
    // one under the cursor, read through that same new geometry, looks fine.
    let ring = fitCubicRing(DIAMOND);
    let geometry = opened;
    const startedAt: Point = [
      geometry.cx + ring[untouched].point[0] * geometry.radius,
      geometry.cy + ring[untouched].point[1] * geometry.radius,
    ];

    for (const to of DRAGS) {
      // the pointer, read through whatever geometry is on the prop now
      const at: Point = [(to[0] - geometry.cx) / geometry.radius, (to[1] - geometry.cy) / geometry.radius];
      ring = moveAnchor(ring, 0, at);
      const edit = normalizeEditedRings([ring], geometry);
      assert.ok(edit);
      geometry = { cx: edit.cx, cy: edit.cy, radius: edit.radius };
    }

    const drifted: Point = [
      geometry.cx + ring[untouched].point[0] * geometry.radius,
      geometry.cy + ring[untouched].point[1] * geometry.radius,
    ];
    assert.ok(
      Math.hypot(drifted[0] - startedAt[0], drifted[1] - startedAt[1]) > 5,
      `stale geometry happened not to drift -- test is not pinning the bug`,
    );
  });
});

describe("nearestOnRings -- reading a click back onto the curve", () => {
  it("lands on the curve, not on the anchors it was fitted through", () => {
    // a click just outside the bow between two anchors: the nearest anchor is
    // a long way round, and the nearest point on the curve is right there
    const ring = fitCubicRing(DIAMOND);
    const bow = flattenCubicRing(ring)[3];
    const place = nearestOnRings([ring], [bow[0] * 1.2, bow[1] * 1.2]);
    assert.ok(place);
    assert.ok(
      Math.hypot(place.point[0] - bow[0], place.point[1] - bow[1]) < 0.05,
      "the nearest point was not the bit of curve the click was over",
    );
  });

  it("reports the distance it actually found", () => {
    const ring = fitCubicRing(DIAMOND);
    const at: Point = [3, 3];
    const place = nearestOnRings([ring], at);
    assert.ok(place);
    const measured = Math.hypot(place.point[0] - at[0], place.point[1] - at[1]);
    assert.ok(Math.abs(measured - place.distance) < 1e-9);
  });

  it("beats the flattened outline it is refined out of", () => {
    // the refinement has to buy something over just taking the nearest drawn
    // sample, or the anchor lands visibly off the curve on a coarse segment
    const ring = fitCubicRing(circlePoints(1, 7));
    const at: Point = [0.37, 0.9];
    const place = nearestOnRings([ring], at);
    assert.ok(place);
    const coarse = Math.min(...flattenCubicRing(ring).map((p) => Math.hypot(p[0] - at[0], p[1] - at[1])));
    assert.ok(place.distance <= coarse + 1e-12, "the refinement found a point further off than a plain sample");
  });

  it("picks the nearer of several rings", () => {
    const near = fitCubicRing(circlePoints(1, 12, [0, 0]));
    const far = fitCubicRing(circlePoints(1, 12, [20, 0]));
    const place = nearestOnRings([far, near], [0, 0.5]);
    assert.ok(place);
    assert.equal(place.ring, 1);
  });

  it("has nothing to say about no rings", () => {
    assert.equal(nearestOnRings([], [0, 0]), undefined);
  });
});

describe("insertAnchor -- somewhere new to take hold", () => {
  it("adds exactly one anchor, in the segment it was asked for", () => {
    const ring = fitCubicRing(DIAMOND);
    const next = insertAnchor([ring], 0, 1, 0.5);
    assert.ok(next);
    assert.equal(next[0].length, ring.length + 1);
    // the new one sits between the anchors that bounded the segment
    assert.deepEqual(next[0][1].point, ring[1].point);
    assert.deepEqual(next[0][3].point, ring[2].point);
  });

  it("does not move the outline at all", () => {
    // The whole point of splitting rather than re-fitting: the reviewer asked
    // for a handle, not for a different shape. Checked against the original
    // segment rather than against a flattening of the whole ring, because the
    // split gives that ring an extra segment and so an extra helping of
    // samples -- which would put the two flattenings a step out of phase and
    // measure the subdivision instead of the curve.
    const ring = fitCubicRing(circlePoints(1, 9));
    const split = 0.37;
    for (const segment of [0, 3, 8]) {
      const from = ring[segment];
      const to = ring[(segment + 1) % ring.length];
      const next = insertAnchor([ring], 0, segment, split);
      assert.ok(next);
      const added = next[0][segment + 1];
      const beyond = next[0][(segment + 2) % next[0].length];

      for (let step = 0; step <= 32; step++) {
        const u = step / 32;
        // the two halves, walked at u, against the one curve at the parameter
        // that same point had before the split
        const halves: [Point, number][] = [
          [cubicPointAt(next[0][segment], added, u), u * split],
          [cubicPointAt(added, beyond, u), split + u * (1 - split)],
        ];
        for (const [was, t] of halves) {
          const should = cubicPointAt(from, to, t);
          const off = Math.hypot(was[0] - should[0], was[1] - should[1]);
          assert.ok(off < 1e-12, `splitting segment ${segment} moved the curve by ${off}`);
        }
      }
    }
  });

  it("puts the anchor where the curve was at t", () => {
    const ring = fitCubicRing(DIAMOND);
    const t = 0.62;
    const on = cubicPointAt(ring[2], ring[3], t);
    const next = insertAnchor([ring], 0, 2, t);
    assert.ok(next);
    assert.ok(Math.hypot(next[0][3].point[0] - on[0], next[0][3].point[1] - on[1]) < 1e-12);
  });

  it("splits the closing segment onto the end of the ring", () => {
    const ring = fitCubicRing(DIAMOND);
    const last = ring.length - 1;
    const next = insertAnchor([ring], 0, last, 0.5);
    assert.ok(next);
    assert.equal(next[0].length, ring.length + 1);
    assert.deepEqual(next[0][last].point, ring[last].point);
    assert.deepEqual(next[0][0].point, ring[0].point);
  });

  it("keeps a click at the very end of a segment off the anchor already there", () => {
    const ring = fitCubicRing(DIAMOND);
    for (const t of [0, 1, -5, 7]) {
      const next = insertAnchor([ring], 0, 0, t);
      assert.ok(next);
      const added = next[0][1].point;
      for (const twin of [ring[0].point, ring[1].point]) {
        assert.ok(
          Math.hypot(added[0] - twin[0], added[1] - twin[1]) > 0,
          `a split at ${t} landed on top of an anchor already there`,
        );
      }
    }
  });

  it("leaves every other ring alone", () => {
    const ring = fitCubicRing(DIAMOND);
    const hole = fitCubicRing(circlePoints(0.2, 6));
    const next = insertAnchor([ring, hole], 0, 0, 0.5);
    assert.ok(next);
    assert.equal(next[1], hole);
  });

  it("refuses a segment that is not there", () => {
    const ring = fitCubicRing(DIAMOND);
    assert.equal(insertAnchor([ring], 0, ring.length, 0.5), undefined);
    assert.equal(insertAnchor([ring], 0, -1, 0.5), undefined);
    assert.equal(insertAnchor([ring], 1, 0, 0.5), undefined);
    assert.equal(insertAnchor([ring], 0, 0, NaN), undefined);
  });

  it("survives the round trip through a stored path", () => {
    const ring = fitCubicRing(DIAMOND);
    const next = insertAnchor([ring], 0, 0, 0.5);
    assert.ok(next);
    const reopened = editableRings(cubicRingsToPathData(next));
    assert.equal(reopened.length, 1);
    assert.equal(reopened[0].length, ring.length + 1, "the added anchor did not survive being written out");
  });

  it("lands where nearestOnRings said it would", () => {
    // the two halves of one gesture: hit-test a click, then split there
    const ring = fitCubicRing(circlePoints(1, 8));
    const at: Point = [0.71, 0.75];
    const place = nearestOnRings([ring], at);
    assert.ok(place);
    const next = insertAnchor([ring], place.ring, place.segment, place.t);
    assert.ok(next);
    const added = next[0][place.segment + 1].point;
    assert.ok(Math.hypot(added[0] - place.point[0], added[1] - place.point[1]) < 1e-9);
  });

  it("still rasterizes once an anchor has been added", () => {
    const next = insertAnchor([fitCubicRing(DIAMOND)], 0, 0, 0.5);
    assert.ok(next);
    assert.ok(sampleObjectShapePath(cubicRingsToPathData(next)));
  });
});

describe("stitchRing -- cutting a bay out of an outline", () => {
  /** An n-gon on the unit circle, fitted so every anchor carries real controls. */
  function polygon(count: number): CubicRing {
    return fitCubicRing(
      Array.from({ length: count }, (_, i) => {
        const angle = (2 * Math.PI * i) / count;
        return [Math.cos(angle), Math.sin(angle)] as Point;
      }),
    );
  }

  /** Whether a ring's closing segment -- last anchor back to first -- is straight. */
  function closesStraight(ring: CubicRing): boolean {
    const last = ring[ring.length - 1];
    const first = ring[0];
    const thirds: [Point, Point] = [
      [last.point[0] + (first.point[0] - last.point[0]) / 3, last.point[1] + (first.point[1] - last.point[1]) / 3],
      [
        last.point[0] + ((first.point[0] - last.point[0]) * 2) / 3,
        last.point[1] + ((first.point[1] - last.point[1]) * 2) / 3,
      ],
    ];
    return (
      Math.hypot(last.outControl[0] - thirds[0][0], last.outControl[1] - thirds[0][1]) < 1e-9 &&
      Math.hypot(first.inControl[0] - thirds[1][0], first.inControl[1] - thirds[1][1]) < 1e-9
    );
  }

  it("branches a run of two or more off as its own island", () => {
    // 0 and 3 with 1 and 2 between them the short way round
    const next = stitchRing([polygon(8)], 0, 0, 3);
    assert.ok(next);
    assert.equal(next.length, 2);
    assert.equal(next[0].length, 6);
    assert.equal(next[1].length, 2);
  });

  it("closes both the outline and the island with a straight chord", () => {
    const next = stitchRing([polygon(10)], 0, 1, 5);
    assert.ok(next);
    assert.ok(closesStraight(next[0]), "the outline did not close straight across the two selected anchors");
    assert.ok(closesStraight(next[1]), "the island did not close straight");
  });

  it("leaves the selected anchors on the outline rather than copying them into the island", () => {
    const ring = polygon(8);
    const next = stitchRing([ring], 0, 0, 3);
    assert.ok(next);
    const island = next[1].map((anchor) => anchor.point);
    for (const selected of [ring[0].point, ring[3].point]) {
      assert.ok(
        !island.some((p) => Math.hypot(p[0] - selected[0], p[1] - selected[1]) < 1e-9),
        "a selected anchor was copied into the island",
      );
    }
    // and both are still on the outline
    const outline = next[0].map((anchor) => anchor.point);
    for (const selected of [ring[0].point, ring[3].point]) {
      assert.ok(outline.some((p) => Math.hypot(p[0] - selected[0], p[1] - selected[1]) < 1e-9));
    }
  });

  it("deletes a lone anchor rather than making an island of it", () => {
    // one anchor closed against itself encloses nothing, so there is no island
    // to make -- see stitchRing
    const ring = polygon(8);
    const next = stitchRing([ring], 0, 0, 2);
    assert.ok(next);
    assert.equal(next.length, 1);
    assert.equal(next[0].length, 7);
    assert.ok(
      !next[0].some(
        (anchor) => Math.hypot(anchor.point[0] - ring[1].point[0], anchor.point[1] - ring[1].point[1]) < 1e-9,
      ),
      "the anchor between the two selected ones survived",
    );
  });

  it("straightens the segment between two neighbours and makes nothing", () => {
    const next = stitchRing([polygon(8)], 0, 3, 4);
    assert.ok(next);
    assert.equal(next.length, 1);
    assert.equal(next[0].length, 8);
    assert.ok(closesStraight(next[0]));
  });

  it("takes the shorter run whichever anchor was clicked first", () => {
    const forward = stitchRing([polygon(12)], 0, 2, 5);
    const backward = stitchRing([polygon(12)], 0, 5, 2);
    assert.ok(forward);
    assert.ok(backward);
    assert.equal(forward[1].length, 2);
    assert.equal(backward[1].length, 2);
    assert.deepEqual(forward[1].map((a) => a.point).sort(), backward[1].map((a) => a.point).sort());
  });

  it("leaves the rings it was not pointed at alone", () => {
    const hole = polygon(5);
    const next = stitchRing([polygon(8), hole], 0, 0, 3);
    assert.ok(next);
    assert.equal(next.length, 3);
    assert.equal(next[1], hole);
  });

  it("refuses a stitch that is not one", () => {
    const rings = [polygon(8)];
    assert.equal(stitchRing(rings, 0, 2, 2), undefined);
    assert.equal(stitchRing(rings, 0, 0, 8), undefined);
    assert.equal(stitchRing(rings, 1, 0, 3), undefined);
  });

  it("does not mutate the rings it was handed", () => {
    const ring = polygon(8);
    const before = JSON.stringify(ring);
    stitchRing([ring], 0, 0, 3);
    assert.equal(JSON.stringify(ring), before);
  });

  it("survives the round trip out to a path and back", () => {
    // an island is a ring like any other downstream -- if it did not read back
    // it would vanish the next time the editor opened on the shape
    const next = stitchRing([polygon(10)], 0, 0, 4);
    assert.ok(next);
    const reread = parseCubicRings(cubicRingsToPathData(next));
    assert.ok(reread);
    assert.equal(reread.length, 2);
    assert.equal(reread[0].length, next[0].length);
    assert.equal(reread[1].length, next[1].length);
  });

  it("leaves the island filled rather than cut out of the outline", () => {
    // the whole point of an island. Containment is even-odd everywhere
    // downstream -- the rasterizer's insideMask, the mesh's clipTriangle -- so
    // a ring lying outside every other ring reads as more inside, and one
    // lying within the outline would read as a hole instead
    const next = stitchRing([polygon(12)], 0, 0, 5);
    assert.ok(next);
    const flat = next.map((ring) => flattenCubicRing(ring));
    const island = flat[1];
    const middle: Point = [
      island.reduce((sum, p) => sum + p[0], 0) / island.length,
      island.reduce((sum, p) => sum + p[1], 0) / island.length,
    ];
    assert.ok(insideRings(flat, middle), "the middle of the island read as outside the shape");
    assert.ok(!insideRings([flat[0]], middle), "the island sits inside the outline, so it is a hole and not an island");
  });

  it("rasterizes once stitched", () => {
    const next = stitchRing([polygon(12)], 0, 0, 5);
    assert.ok(next);
    assert.ok(sampleObjectShapePath(cubicRingsToPathData(next)), "the stitched shape did not rasterize at all");
  });
});

describe("ringPieces -- which rings draw which piece", () => {
  function square(cx: number, cy: number, half: number): Point[] {
    return [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx + half, cy + half],
      [cx - half, cy + half],
    ];
  }

  it("reads a lone ring as one piece", () => {
    const { depth, pieces } = ringPieces([square(0, 0, 10)]);
    assert.deepEqual(depth, [0]);
    assert.deepEqual(pieces, [[0]]);
  });

  it("keeps a hole with the piece it is cut out of", () => {
    const { depth, pieces } = ringPieces([square(0, 0, 10), square(0, 0, 3)]);
    assert.deepEqual(depth, [0, 1]);
    assert.deepEqual(pieces, [[0, 1]]);
  });

  it("counts rings lying apart as separate pieces", () => {
    const { depth, pieces } = ringPieces([square(-20, 0, 5), square(20, 0, 5)]);
    assert.deepEqual(depth, [0, 0]);
    assert.deepEqual(pieces, [[0], [1]]);
  });

  it("keeps an island sitting in a hole with the piece around it", () => {
    // depth two is filled again -- even-odd says so -- but it is still part of
    // the same piece, not one the reviewer has to choose between
    const { depth, pieces } = ringPieces([square(0, 0, 10), square(0, 0, 6), square(0, 0, 2)]);
    assert.deepEqual(depth, [0, 1, 2]);
    assert.deepEqual(pieces, [[0, 1, 2]]);
  });

  it("leads each piece with the ring that bounds it, whatever order they arrived in", () => {
    const { pieces } = ringPieces([square(0, 0, 3), square(0, 0, 10)]);
    assert.deepEqual(pieces, [[1, 0]]);
  });

  it("has nothing to say about no rings", () => {
    assert.deepEqual(ringPieces([]), { depth: [], pieces: [] });
  });

  it("sees the two pieces a stitch leaves behind", () => {
    const ring = fitCubicRing(
      Array.from({ length: 12 }, (_, i) => {
        const angle = (2 * Math.PI * i) / 12;
        return [Math.cos(angle), Math.sin(angle)] as Point;
      }),
    );
    const stitched = stitchRing([ring], 0, 0, 5);
    assert.ok(stitched);
    const { pieces } = ringPieces(stitched.map((r) => flattenCubicRing(r)));
    assert.equal(pieces.length, 2, "a stitched island read as a hole rather than a piece of its own");
  });
});

describe("unitCirclePath -- the outline a dropped object gets", () => {
  it("is a real circle", () => {
    // within a thousandth of a true arc is what kappa buys; anything looser
    // and a dropped object would visibly not be the circle it renders as
    for (const point of flattenCubicRing(unitCircleRing())) {
      const reach = Math.hypot(point[0], point[1]);
      assert.ok(Math.abs(reach - 1) < 1e-3, `${point} is ${reach} from the origin`);
    }
  });

  it("is already unit extent, so storing it moves no geometry", () => {
    // the drop writes this path straight to the object without going through
    // normalizeEditedRings, so it has to arrive in the space a shape is
    // stored in or the renderer would rescale the object on its first draw
    const object = { cx: 200, cy: 150, radius: 50 };
    const result = normalizeEditedRings([unitCircleRing()], object);
    assert.ok(result);
    assert.ok(Math.abs(result.cx - object.cx) < 1e-6, `cx moved to ${result.cx}`);
    assert.ok(Math.abs(result.cy - object.cy) < 1e-6, `cy moved to ${result.cy}`);
    assert.ok(Math.abs(result.radius - object.radius) < 1e-6, `radius moved to ${result.radius}`);
  });

  it("opens in the pen with four anchors to grab", () => {
    // the whole point of the change: editableRings on the empty path a drop
    // used to store returns no rings at all, and the editor drew nothing
    assert.equal(editableRings("").length, 0);
    const rings = editableRings(unitCirclePath());
    assert.equal(rings.length, 1);
    assert.equal(rings[0].length, 4);
  });

  it("renders, so the relief has a shape to build", () => {
    assert.ok(sampleObjectShapePath(unitCirclePath()));
  });
});
