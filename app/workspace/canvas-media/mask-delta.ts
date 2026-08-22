import type {
  CaptureUpdateDelta_V1_0,
  LaurusMaskResult,
  LaurusPolygonPath,
  ObjectUpdateDelta_V1_0,
} from "../workspace.server";
import { carryGeometryForward } from "./mask-geometry.ts";

/** Applying an edit to a mask without touching the parts it did not change.
 *
 *  These edits used to arrive as a whole replacement mask, which meant the
 *  client re-derived everything downstream of it -- parsed geometry, fill
 *  colours, the triangulation -- for a change that moved one record. A delta
 *  rewrites only the polygons whose tag actually moved and hands the parsed
 *  geometry forward, since no edit here can change a polygon's path data. */

function retagPolygons(
  polygons: LaurusPolygonPath[],
  tagged: number[],
  cleared: number[],
  apply: (polygon: LaurusPolygonPath, id: number) => LaurusPolygonPath,
  id: number,
): LaurusPolygonPath[] {
  if (tagged.length === 0 && cleared.length === 0) return polygons;
  // A shallow copy so the array identity changes for React, but every polygon
  // outside the edit keeps its own identity -- and the geometry cache is told
  // the paths are the same ones it already parsed.
  const next = polygons.slice();
  for (const index of cleared) {
    const polygon = next[index];
    if (polygon) next[index] = apply(polygon, 0);
  }
  for (const index of tagged) {
    const polygon = next[index];
    if (polygon) next[index] = apply(polygon, id);
  }
  carryGeometryForward(polygons, next);
  return next;
}

export function applyObjectDelta(mask: LaurusMaskResult, delta: ObjectUpdateDelta_V1_0): LaurusMaskResult {
  const polygons = retagPolygons(
    mask.polygons,
    delta.tagged_polygon_indices,
    delta.cleared_polygon_indices,
    (polygon, object_id) => ({ ...polygon, object_id }),
    delta.object_id,
  );
  const withoutEdited = mask.objects.filter((o) => o.id !== delta.object_id);
  return {
    ...mask,
    polygons,
    objects: delta.removed || !delta.object ? withoutEdited : [...withoutEdited, delta.object],
    last_active: delta.last_active,
    last_editor: delta.last_editor,
  };
}

export function applyCaptureDelta(mask: LaurusMaskResult, delta: CaptureUpdateDelta_V1_0): LaurusMaskResult {
  const polygons = retagPolygons(
    mask.polygons,
    delta.tagged_polygon_indices,
    delta.cleared_polygon_indices,
    (polygon, capture_id) => ({ ...polygon, capture_id }),
    delta.capture_id,
  );
  const withoutEdited = mask.captures.filter((c) => c.id !== delta.capture_id);
  return {
    ...mask,
    polygons,
    captures: delta.removed || !delta.capture ? withoutEdited : [...withoutEdited, delta.capture],
    last_active: delta.last_active,
    last_editor: delta.last_editor,
  };
}
