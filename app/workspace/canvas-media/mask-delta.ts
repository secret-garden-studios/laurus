import type {
  LightUpdateDelta_V1_0,
  LaurusMaskResult,
  LaurusPolygonPath,
  ObjectUpdateDelta_V1_0,
} from "../workspace.server";
import { carryGeometryForward } from "./mask-geometry.ts";

function retagPolygons(
  polygons: LaurusPolygonPath[],
  tagged: number[],
  cleared: number[],
  apply: (polygon: LaurusPolygonPath, id: number) => LaurusPolygonPath,
  id: number,
): LaurusPolygonPath[] {
  if (tagged.length === 0 && cleared.length === 0) return polygons;
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

export function applyLightDelta(mask: LaurusMaskResult, delta: LightUpdateDelta_V1_0): LaurusMaskResult {
  const polygons = retagPolygons(
    mask.polygons,
    delta.tagged_polygon_indices,
    delta.cleared_polygon_indices,
    (polygon, light_id) => ({ ...polygon, light_id }),
    delta.light_id,
  );
  const withoutEdited = mask.lights.filter((c) => c.id !== delta.light_id);
  return {
    ...mask,
    polygons,
    lights: delta.removed || !delta.light ? withoutEdited : [...withoutEdited, delta.light],
    last_active: delta.last_active,
    last_editor: delta.last_editor,
  };
}
