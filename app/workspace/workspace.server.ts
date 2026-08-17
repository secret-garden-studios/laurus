import { authFetch, FORBIDDEN_ACTION, UNAUTHORIZED_EDIT } from "../landing.server";

const onNotOk = (status: number, message?: string) => {
  const suffix = message ? ` ${message}` : "";
  switch (status) {
    case 401: {
      alert(`${UNAUTHORIZED_EDIT}${suffix}`);
      return;
    }
    case 403: {
      alert(`${FORBIDDEN_ACTION}${suffix}`);
      return;
    }
  }
};

const getOnNotOkMessage = (
  action: "creating" | "updating" | "deleting",
  type: "scale" | "move" | "rotate" | "light_source" | "effect_group" | "media_group" | "svg" | "mask",
  description?: string,
) => {
  return description?.trim() ? `This occurred while ${action} the ${type} described as "${description}".` : undefined;
};

/* /discover */
interface ImgPageSearch_V1_0 {
  exlusions: string[];
  size: number;
}
export type LaurusImgPageSearch = ImgPageSearch_V1_0;
interface SvgPageSearch_V1_0 {
  exlusions: string[];
  size: number;
}
export type LaurusSvgPageSearch = SvgPageSearch_V1_0;

export async function downloadImgs(baseUrl: string | undefined, size: number = 10, offset?: string) {
  try {
    let url = `${baseUrl}/discover/img?&size=${size}`;
    if (offset) {
      url += `&offset=${offset}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: ImgMediaResult_V1_0[] = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function searchImgs(baseUrl: string | undefined, search: ImgPageSearch_V1_0) {
  try {
    const url = `${baseUrl}/discover/img/search`;
    const body = JSON.stringify(search);
    const raw_response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: ImgMediaResult_V1_0[] = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function downloadSvgs(baseUrl: string | undefined, size: number = 10, offset?: string) {
  try {
    let url = `${baseUrl}/discover/svg?&size=${size}`;
    if (offset) {
      url += `&offset=${offset}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: SvgMediaResult_V1_0[] = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function searchSvgs(baseUrl: string | undefined, search: SvgPageSearch_V1_0) {
  try {
    const url = `${baseUrl}/discover/svg/search`;
    const body = JSON.stringify(search);
    const raw_response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: SvgMediaResult_V1_0[] = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

/* /media/img */

export interface ImgMedia_V1_0 {
  media_uri: string;
  media_key: string;
  width: number;
  height: number;
  categories: string[];
}
export type LaurusImg = ImgMedia_V1_0;
export interface ImgMediaResult_V1_0 {
  timestamp: string;
  last_active: string;
  img_media_id: string;
  media_uri: string;
  media_key: string;
  order: number;
  width: number;
  height: number;
  categories: string[];
  src: string;
  creator: string;
  last_editor: string;
}
export type LaurusImgResult = ImgMediaResult_V1_0;
export async function getImg(baseUrl: string | undefined, imgMediaId: string, filename?: string) {
  try {
    let url = `${baseUrl}/media/img/${imgMediaId}`;
    if (filename) {
      url += `?filename=${filename}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: ImgMediaResult_V1_0 = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createImg(baseUrl: string | undefined, accessToken: string | undefined, img: File) {
  const url = `${baseUrl}/media/img`;
  try {
    const formData = new FormData();
    formData.append("img", img);
    const authResponse = await authFetch(baseUrl, accessToken, formData, url, "POST");
    const response = authResponse.newToken
      ? (await authFetch(baseUrl, authResponse.newToken, formData, url, "POST")).response
      : authResponse.response;
    if (!response.ok) {
      return undefined;
    }
    const created: ImgMediaResult_V1_0 = await response.json();
    return created;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

/* /media/svg */

export interface SvgMedia_V1_0 {
  media_uri: string;
  media_key: string;
  width: number;
  height: number;
  viewbox: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  categories: string[];
}
export interface SvgMediaResult_V1_0 {
  timestamp: string;
  last_active: string;
  svg_media_id: string;
  media_uri: string;
  media_key: string;
  width: number;
  height: number;
  viewbox: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  order: number;
  categories: string[];
  markup: string;
  creator: string;
  last_editor: string;
}
export type LaurusSvgResult = SvgMediaResult_V1_0;
export async function getSvg(baseUrl: string | undefined, svgMediaId: string, filename?: string) {
  try {
    let url = `${baseUrl}/media/svg/${svgMediaId}`;
    if (filename) {
      url += `?filename=${filename}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: SvgMediaResult_V1_0 = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createSvg(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  files: { svg: File; raster: File },
) {
  const url = `${baseUrl}/media/svg`;
  try {
    const formData = new FormData();
    formData.append("svg", files.svg);
    formData.append("raster", files.raster);
    const authResponse = await authFetch(baseUrl, accessToken, formData, url, "POST");
    const response = authResponse.newToken
      ? (await authFetch(baseUrl, authResponse.newToken, formData, url, "POST")).response
      : authResponse.response;
    if (!response.ok) {
      return undefined;
    }
    const created: SvgMediaResult_V1_0 = await response.json();
    return created;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function deleteSvg(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  svgMediaId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/media/svg/${svgMediaId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "svg", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/* /media/masks */

/** One triangle of the mesh interior. `d` goes straight into `new Path2D(d)`.
 * `capture_id` is 0 if this triangle isn't part of any of the mask's
 * "captures" (client-selected subsections of the mesh, e.g. light source
 * regions -- see MaskMediaResult_V1_0.captures), otherwise the id of the
 * capture it belongs to -- see MaskCaptureUpdateRequest_V1_0.
 *
 * `peak_id` mirrors `capture_id` for the mask's topology peaks (see
 * Peak_V1_0 and MaskPeakUpdateRequest_V1_0): 0 if not part of any peak,
 * otherwise the id of the peak it belongs to. Bookkeeping only (highlighting,
 * future effect-wiring) -- a peak's shape comes from the height field
 * mask-gl.ts's shaders evaluate from cx/cy/radius/elevation/falloff as
 * uniforms, a continuous function of position that never consults which
 * polygons carry its id. */
export interface PolygonPath_V1_0 {
  d: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  capture_id: number;
  peak_id: number;
}
export type LaurusPolygonPath = PolygonPath_V1_0;

/** One named, client-selected subsection of a mask's mesh (e.g. a light
 * source region). `id` is referenced by any number of the mask's own
 * PolygonPath_V1_0.capture_id fields.
 *
 * `size`/`intensity`/`falloff`/`darkness` are this capture's own resting
 * light appearance -- the seed a wired "light_source" effect's equation
 * ramps from, the same way a ProjectMask_V1_0's own capture_preview_*
 * fields are the seed for the mesh-wide mouse-hover preview instead (see
 * ProjectMask_V1_0). Lightsourcebar's "capture" dials read and write these
 * fields directly. */
export interface Capture_V1_0 {
  id: number;
  name: string;
  size: number;
  intensity: number;
  falloff: number;
  darkness: number;
}
export type LaurusCapture = Capture_V1_0;

/** One client-placed topology adjustment: one term of the signed height field
 * `h(x, y)` the mask's shaders evaluate to give the mesh its relief. An
 * epicenter (`cx`/`cy`, in the mask's own mesh space, same as
 * PolygonPath_V1_0's `d` strings), the `radius` its influence reaches, the
 * signed `elevation` at that epicenter (negative is a dent/crater, not an
 * error), and the `falloff` exponent shaping how it decays to nothing at the
 * rim:
 *
 *     h(p) = sum over peaks of  elevation * (1 - u^2)^falloff,
 *            u = min(|p - (cx, cy)| / radius, 1)
 *
 * The whole field is a uniform-driven, continuous function of position: the
 * server stores these five numbers and computes nothing from them, and both
 * of mask-gl.ts's shader stages read the same one -- the vertex stage to
 * displace geometry, the fragment stage to take the field's analytic gradient
 * and light the perturbed surface normal (which is where the illusion of a
 * bump actually comes from; see PEAK_FIELD_GLSL there). Because the field is
 * a function of position alone, nothing about the mesh's own triangulation can
 * change the shape a peak takes.
 *
 * PolygonPath_V1_0.peak_id mirrors Capture_V1_0's own polygon tagging, but
 * only for bookkeeping (highlighting, future effect-wiring); it never feeds
 * the field. See MaskPeakUpdateRequest_V1_0. */
export interface Peak_V1_0 {
  id: number;
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  /** This peak's custom silhouette, or `""` for a circle -- which generalizes
   * `radius` from one distance into a distance per direction:
   *
   *     u = |p - (cx, cy)| / (radius * rho(theta))
   *
   * `rho` is in (0, 1] with a maximum of exactly 1, so `radius` still means
   * this peak's furthest reach and an empty shape reproduces the circle above
   * exactly rather than approximately -- shaped peaks are a generalization of
   * the circle, not a second mode beside it.
   *
   * A normalized closed `M ... L ... Z` polygon, already centered on the origin
   * and scaled so its own furthest point sits at radius 1 (see
   * canvas-media/peak-shape.ts, which authors it from an svg and re-samples it
   * on load). The server stores this string and computes nothing from it; the
   * client samples it into an angular table and uploads that as texture data
   * for both shader stages to read (see peakShapeAt in mask-gl.ts). */
  shape: string;
  /** This peak's own black point, each channel 0-1 -- the darkest colour the
   * peak's shading can reach, standing in for the black everything outside a
   * peak still falls to.
   *
   * A black point in the photographic sense rather than a tint: the shader
   * rescales the peak's whole tonal range onto [black point, white], so the
   * floor lands exactly on this colour, highlights still reach pure white, and
   * every tone between is carried proportionally. Set it green and the peak
   * renders as shades of green running up to white, with black unreachable
   * anywhere inside it (see liftToBlackPoint in mask-gl.ts).
   *
   * Flat rather than nested because this interface is the wire shape, and the
   * server stores four floats (see RedisPeak); toPeakBlackPoint below is what
   * turns them back into one value for everything that reads them. */
  black_point_r: number;
  black_point_g: number;
  black_point_b: number;
  black_point_a: number;
}
export type LaurusPeak = Peak_V1_0;

/** One peak's black point, gathered back up out of Peak_V1_0's four flat wire
 * fields. Every consumer on this side wants it as one value -- it travels as a
 * unit through PendingTopologyEdit, the staged peak, and the shader's own vec4
 * uniform -- and passing four loose numbers around is the same transposition
 * hazard MaskPeakUpdateRequest_V1_0 already exists to avoid (see
 * useMaskPeakSockets' own note on why that request is an object).
 *
 * `a` is how strongly the black point is applied rather than a compositing
 * opacity: at 0 the peak shades exactly as it did before this field existed, so
 * the swatch is off rather than black, and at 1 the peak's floor sits fully on
 * the colour. Values between fade the floor back toward black proportionally. */
export interface PeakBlackPoint_V1_0 {
  r: number;
  g: number;
  b: number;
  a: number;
}
export type LaurusPeakBlackPoint = PeakBlackPoint_V1_0;

/** No black point at all -- what a peak drawn before the swatch existed loads
 * as, and what a freshly drawn one starts at. The alpha is the load-bearing
 * part (see PeakBlackPoint_V1_0); the colour channels are only along for the
 * ride until someone opens the swatch. Mirrors the identical per-field defaults
 * on the server's own RedisPeak/Peak/PeakUpdate models, the same way
 * PEAK_FALLOFF_DEFAULT does. */
export const PEAK_BLACK_POINT_DEFAULT: PeakBlackPoint_V1_0 = { r: 0, g: 0, b: 0, a: 0 };

/** The one place a peak's four wire fields become a black point, so nothing
 * downstream has to know they were ever flat. */
export function toPeakBlackPoint(peak: Peak_V1_0): PeakBlackPoint_V1_0 {
  return {
    r: peak.black_point_r,
    g: peak.black_point_g,
    b: peak.black_point_b,
    a: peak.black_point_a,
  };
}

/** Exponent of a peak's radial profile `k(u) = (1 - u^2)^falloff` that
 * reproduces the smooth dome `(1 - u^2)^2`, whose slope vanishes at *both* the
 * epicenter and the rim -- that C1 join at the rim is what lets a peak sit in
 * the middle of the mesh with no crease ring around it.
 *
 * Lives here beside Peak_V1_0 rather than in mask-gl.ts with the rest of the
 * peak constants because it's the *schema* default: it's what normalizeMaskResult
 * backfills onto a peak persisted before falloff existed, mirroring the identical
 * default on the server's own RedisPeak/Peak/PeakUpdate models. mask-gl.ts (which
 * already imports from this module, so the dependency can only point this way)
 * owns the *authoring* bounds instead -- see MIN/MAX_MASK_PEAK_FALLOFF there. */
export const PEAK_FALLOFF_DEFAULT = 2.0;

/**
 * One sample of a silhouette's outward alpha falloff: `offset` pixels outside
 * the curve, the source is `opacity` opaque. Reproduced by stroking the curve
 * at `lineWidth = offset * 2` -- a stroke is centred on its path, so
 * half-width `offset` reaches exactly that far out.
 */
export interface GlowStop_V1_0 {
  offset: number;
  opacity: number;
}
export type LaurusGlowStop = GlowStop_V1_0;

/**
 * One closed, smoothly curved silhouette region, as cubic Bezier path data
 * (`M ... C ... Z`, one subpath per ring: the outer ring first, then any
 * holes, wound for the default nonzero fill rule).
 *
 * A triangle mesh's boundary is a chain of straight chords, so a curved edge
 * comes out visibly faceted no matter how many triangles are spent on it.
 * This is that same edge described smoothly. Fill it as a backing, then clip
 * the mesh to it -- on a 2d context that is `ctx.clip(new Path2D(curve.d))`;
 * on WebGL there is no clip, so rasterize it into a mask instead (see
 * uploadCurveMask in mask-gl.ts).
 *
 * `glow` is the soft falloff living outside that clip -- a glow, a drop
 * shadow, any alpha the hard silhouette edge cuts off -- measured off the
 * source rather than assumed, since the profile's shape is the whole
 * character of the effect. Empty when there was none worth reproducing.
 * `glow_color` is the colour of the light actually spilling out, which is
 * often nothing like the subject's own (a shadow is dark, a neon glow
 * saturated), so it is carried separately. Draw the bands widest first,
 * before the fill, compensating for the overlap between them:
 *
 *     ctx.lineJoin = "round";        // or big offsets spike at corners
 *     ctx.strokeStyle = curve.glow_color;
 *     let covered = 0;
 *     for (const stop of [...curve.glow].sort((a, b) => b.offset - a.offset)) {
 *       ctx.globalAlpha = (stop.opacity - covered) / (1 - covered);
 *       ctx.lineWidth = stop.offset * 2;
 *       ctx.stroke(outline);
 *       covered = stop.opacity;
 *     }
 */
export interface CurvePath_V1_0 {
  d: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  glow: GlowStop_V1_0[];
  glow_color: string;
}
export type LaurusCurvePath = CurvePath_V1_0;

export interface MaskMediaResult_V1_0 {
  timestamp: string;
  last_active: string;
  mask_media_id: string;
  source_img_media_id: string;
  width: number;
  height: number;
  order: number;
  categories: string[];
  polygons: PolygonPath_V1_0[];
  curves: CurvePath_V1_0[];
  captures: Capture_V1_0[];
  peaks: Peak_V1_0[];
  creator: string;
  last_editor: string;
}
export type LaurusMaskResult = MaskMediaResult_V1_0;

/** A mask document exactly as it can actually come off the wire, which is not the same shape as
 * MaskMediaResult_V1_0: that interface describes the *current* schema, while what's sitting in the
 * database spans every schema a mask was ever saved under. Several generations of drift are live --
 * documents from before topology peaks existed carry no `peaks` key at all, documents from
 * before the height field's falloff existed carry peaks without one, documents from before
 * custom shapes existed carry peaks without a `shape`, and documents from before the black point
 * existed carry peaks without its four channels. Spelling them all out as optional here is
 * what lets normalizeMaskResult read them without a cast. */
type RawPeak_V1_0 = Omit<Peak_V1_0, "falloff" | "shape" | `black_point_${"r" | "g" | "b" | "a"}`> & {
  falloff?: number;
  shape?: string;
  black_point_r?: number;
  black_point_g?: number;
  black_point_b?: number;
  black_point_a?: number;
};
type RawMaskMediaResult_V1_0 = Omit<MaskMediaResult_V1_0, "peaks"> & { peaks?: RawPeak_V1_0[] };

// The one place both of those generations get repaired, so nothing downstream has to know they
// exist. Every raw parse of a mask document (below, plus the socket response handlers in
// useMaskCaptureSockets/useMaskPeakSockets) goes through this: a legacy mask loads with no peaks of
// its own instead of crashing the first time ProjectMaskItem's render() tries to .map over an
// undefined array, and a pre-falloff peak loads as the default dome instead of reaching the shader
// with falloff undefined (which NaNs the whole height field, taking the mesh's geometry with it).
//
// Deliberately no longer short-circuits on `mask.peaks` being present: a document can have peaks
// and still predate falloff, so the peaks array always gets walked. The server backfills the same
// defaults via its own model defaults -- this is the client-side belt to that suspenders.
//
// `shape` backfills to "" rather than to undefined so that "is this peak a circle" is one check
// everywhere downstream (a falsy string) instead of two. Unlike falloff, an absent shape cannot NaN
// the field -- rho is only consulted when a shape is present -- so this one is about keeping the
// type honest rather than about repairing a document that would otherwise render wrong.
//
// The black point's four channels backfill for the same type-honesty reason, and its alpha is the
// one that matters: at 0 the shader leaves the peak shading exactly as it did before the swatch
// existed (see peakBlackPoint in mask-gl.ts), so a pre-swatch peak needs no special case anywhere
// downstream either. An absent channel reaching the shader as undefined would NaN the vec4 the way
// an absent falloff NaNs the field, so this one *is* also a repair.
export function normalizeMaskResult(mask: RawMaskMediaResult_V1_0): MaskMediaResult_V1_0 {
  return {
    ...mask,
    peaks: (mask.peaks ?? []).map((peak) => ({
      ...peak,
      falloff: peak.falloff ?? PEAK_FALLOFF_DEFAULT,
      shape: peak.shape ?? "",
      black_point_r: peak.black_point_r ?? PEAK_BLACK_POINT_DEFAULT.r,
      black_point_g: peak.black_point_g ?? PEAK_BLACK_POINT_DEFAULT.g,
      black_point_b: peak.black_point_b ?? PEAK_BLACK_POINT_DEFAULT.b,
      black_point_a: peak.black_point_a ?? PEAK_BLACK_POINT_DEFAULT.a,
    })),
  };
}

export async function getMask(baseUrl: string | undefined, maskId: string) {
  try {
    const url = `${baseUrl}/media/masks/${maskId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: MaskMediaResult_V1_0 = await raw_response.json();
    return normalizeMaskResult(response);
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function getMasks(baseUrl: string | undefined, mediaId: string) {
  try {
    const url = `${baseUrl}/media/masks?media_id=${mediaId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: MaskMediaResult_V1_0[] = await raw_response.json();
    return response.map(normalizeMaskResult);
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

/** Bulk hydration for a project's masks dict -- one round trip for every mask's
 * mask_media_id, instead of one getMask call per mask. */
export async function getMasksByIds(baseUrl: string | undefined, maskMediaIds: string[]) {
  if (maskMediaIds.length === 0) return [];
  try {
    const params = new URLSearchParams();
    maskMediaIds.forEach((id) => params.append("ids", id));
    const url = `${baseUrl}/media/masks/by-ids?${params.toString()}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: MaskMediaResult_V1_0[] = await raw_response.json();
    return response.map(normalizeMaskResult);
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function deleteMask(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  maskMediaId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/media/masks/${maskMediaId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "mask", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/** Smallest capture id not already used by any of this mask's own captures
 * -- how the client mints a new light source's identity, the same way
 * polygon array indices already stand in for a stable id elsewhere in this
 * feature (see PolygonPath_V1_0's own doc comment): no server-side
 * allocator needed since a mask's own captures list is always read before
 * a new one is created. */
export function nextCaptureId(captures: Capture_V1_0[]): number {
  return 1 + captures.reduce((max, c) => Math.max(max, c.id), 0);
}

/** Smallest peak id not already used by any of this mask's own peaks -- the
 * same "no server-side allocator needed" reasoning as nextCaptureId. */
export function nextPeakId(peaks: Peak_V1_0[]): number {
  return 1 + peaks.reduce((max, p) => Math.max(max, p.id), 0);
}

/* /media/masks/mask (websocket) */

export interface MaskRequest_V1_0 {
  img_media_id: string;
  max_triangle_area?: number;
  /** vertex budget -- higher means finer triangles and a closer match to the source image. */
  detail_points?: number;
  canny_low?: number;
  canny_high?: number;
  /**
   * Alpha at or above which a pixel is inside the silhouette the curves trace.
   * 128 puts the outline down the middle of an antialiased edge.
   */
  alpha_threshold?: number;
  /**
   * How tightly the curves hug the traced silhouette, as a fraction of its
   * perimeter. Lower means more, shorter Bezier segments and a closer fit;
   * higher means a smoother, looser outline.
   */
  curve_tolerance?: number;
}
export type LaurusMaskRequest = MaskRequest_V1_0;

export interface MaskGroupStart_V1_0 {
  type: "group_start";
  color: string;
  group_index: number;
  group_count: number;
}
/** See CurvePath_V1_0. Always streamed before any triangle. */
export interface MaskCurve_V1_0 {
  type: "curve";
  color: string;
  fill: string;
  d: string;
  glow: GlowStop_V1_0[];
  glow_color: string;
  curve_index: number;
  curve_count: number;
}
export interface MaskTriangle_V1_0 {
  type: "triangle";
  color: string;
  shaded: string;
  d: string;
  points: [number, number][];
}
export interface MaskComplete_V1_0 {
  type: "complete";
  result: MaskMediaResult_V1_0;
}
export interface MaskError_V1_0 {
  type: "error";
  message: string;
}
export type MaskMessage_V1_0 =
  MaskGroupStart_V1_0 | MaskCurve_V1_0 | MaskTriangle_V1_0 | MaskComplete_V1_0 | MaskError_V1_0;

function toWebSocketUrl(baseUrl: string): string {
  return baseUrl.replace(/^http/, "ws");
}

export interface MaskImageHandlers {
  onGroupStart?: (event: MaskGroupStart_V1_0) => void;
  onCurve?: (event: MaskCurve_V1_0) => void;
  onTriangle?: (event: MaskTriangle_V1_0) => void;
  onComplete?: (event: MaskComplete_V1_0) => void;
  onError?: (message: string) => void;
}

/**
 * Opens a websocket to /media/masks/mask and streams the silhouette
 * curves and triangle mesh for img_media_id back through the given handlers
 * as they're produced. Returns the underlying WebSocket so the caller can
 * close it early (e.g. on unmount); it closes itself once a "complete"
 * message is received.
 *
 * onCurve always fires before the first onTriangle, because that is the order
 * the two have to be drawn in: the curves define the silhouette the mesh is
 * clipped to, so they have to be in hand before anything is painted inside
 * them. An image with no alpha channel has no silhouette to trace and so
 * produces no curves at all -- just the mesh.
 */
export function maskImage(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  request: MaskRequest_V1_0,
  handlers: MaskImageHandlers,
): WebSocket | undefined {
  if (!baseUrl || !accessToken) {
    handlers.onError?.("missing api origin or access token");
    return undefined;
  }
  const url = `${toWebSocketUrl(baseUrl)}/media/masks/mask?token=${encodeURIComponent(accessToken)}`;
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch (error) {
    console.log({ error });
    handlers.onError?.("failed to open websocket");
    return undefined;
  }

  socket.onopen = () => {
    socket.send(JSON.stringify(request));
  };
  socket.onmessage = (event: MessageEvent<string>) => {
    let message: MaskMessage_V1_0;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.log({ error });
      handlers.onError?.("received malformed message from server");
      return;
    }
    switch (message.type) {
      case "group_start":
        handlers.onGroupStart?.(message);
        break;
      case "curve":
        handlers.onCurve?.(message);
        break;
      case "triangle":
        handlers.onTriangle?.(message);
        break;
      case "complete":
        handlers.onComplete?.({ ...message, result: normalizeMaskResult(message.result) });
        socket.close();
        break;
      case "error":
        handlers.onError?.(message.message);
        break;
    }
  };
  socket.onerror = () => {
    handlers.onError?.("websocket connection error");
  };

  return socket;
}

/* /media/masks/{mask_media_id}/captures (websocket) */

/** Full-replace which of a mask's own polygons (by array index) belong to
 * the single capture identified by capture_id -- e.g. a light source region
 * selected by dragging a circle over the mesh, or relocating one -- leaving
 * the mask's other captures untouched. Upserts a captures registry entry
 * named `name` with the given `size`/`intensity`/`falloff`/`darkness` (see
 * Capture_V1_0). An empty polygon_indices array clears this one capture.
 * Sent any number of times over the life of one mask's capture socket --
 * see useMaskCaptureSockets, which owns that socket and this message's
 * request/response pairing. */
export interface MaskCaptureUpdateRequest_V1_0 {
  capture_id: number;
  name: string;
  polygon_indices: number[];
  size: number;
  intensity: number;
  falloff: number;
  darkness: number;
}
export interface MaskCaptureUpdateComplete_V1_0 {
  type: "capture_update_complete";
  result: MaskMediaResult_V1_0;
}
export type MaskCaptureSocketMessage_V1_0 = MaskCaptureUpdateComplete_V1_0 | MaskError_V1_0;

export function toMaskCaptureSocketUrl(baseUrl: string, maskMediaId: string, accessToken: string): string {
  return `${toWebSocketUrl(baseUrl)}/media/masks/${maskMediaId}/captures?token=${encodeURIComponent(accessToken)}`;
}

/* /media/masks/{mask_media_id}/peaks (websocket) */

/** Full-replace upsert (or, when `remove` is set, deletion) of the single peak
 * identified by peak_id -- e.g. a topology bump dragged out over the mesh, or
 * relocated/re-elevated/re-shaped -- leaving the mask's other peaks untouched.
 * Sent any number of times over the life of one mask's peak socket -- see
 * useMaskPeakSockets, which owns that socket and this message's
 * request/response pairing (mirrors useMaskCaptureSockets exactly).
 *
 * `remove` is the delete signal, and it's a field of its own rather than the
 * `radius <= 0` sentinel this used to overload for two reasons: a radius is now
 * directly authored by a slider the user can drag to its own floor (so the
 * sentinel would be reachable by accident), and a zero radius is degenerate in
 * the height field itself (`u = dist / radius`), so it was never a legitimate
 * value that merely happened to be spoken for. The server still honours
 * `radius <= 0` as a legacy delete so a stale cached client's delete doesn't
 * persist an invisible peak, but this client never sends it that way.
 *
 * `polygon_indices` mirrors MaskCaptureUpdateRequest_V1_0.polygon_indices:
 * which of the mask's own polygons (by array index) carry this peak's id.
 * Bookkeeping only -- never read back to compute the field. Callers derive
 * this from the same circle being sent as cx/cy/radius rather than running
 * a separate selection gesture -- see captureTriangleIndicesInCircle in
 * light-source-capture.ts, which already does exactly this test for
 * captures and takes an arbitrary circle. Note this has to be recomputed
 * whenever `radius` changes, not just when the epicenter moves: a resize
 * changes which polygons fall inside the circle.
 *
 * `shape` is this peak's custom silhouette, or `""` for a circle (see
 * Peak_V1_0.shape). It goes out on *every* update rather than only on the one
 * that authored it, because this request is a full-replace upsert rather than
 * a partial verb: leaving it off a later move or resize would clear the shape
 * rather than leave it alone.
 *
 * `black_point_*` is this peak's own black point (see Peak_V1_0), and rides
 * along on every update for that same full-replace reason -- a caller that only
 * sent it from the swatch would have every elevation nudge, epicenter drag and
 * radius change silently reset it. Flat here because this is the wire shape;
 * callers carrying it as one value spread it in through toPeakBlackPointFields
 * below rather than listing the four by hand at each send. */
export interface MaskPeakUpdateRequest_V1_0 {
  peak_id: number;
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  shape: string;
  black_point_r: number;
  black_point_g: number;
  black_point_b: number;
  black_point_a: number;
  remove: boolean;
  polygon_indices: number[];
}

/** A black point, flattened back into the four wire fields a peak update sends.
 * The inverse of toPeakBlackPoint, and the reason both exist: every one of the
 * four call sites that sends a peak update carries its black point as one value,
 * so without this each would restate the same four-line spread -- which is
 * exactly the enumeration hazard useMaskPeakSockets' own comment describes,
 * where a field added to the request is invisible at a call site that lists keys
 * and gets cleared on every unrelated edit. */
export function toPeakBlackPointFields(blackPoint: PeakBlackPoint_V1_0) {
  return {
    black_point_r: blackPoint.r,
    black_point_g: blackPoint.g,
    black_point_b: blackPoint.b,
    black_point_a: blackPoint.a,
  };
}
export interface MaskPeakUpdateComplete_V1_0 {
  type: "peak_update_complete";
  result: MaskMediaResult_V1_0;
}
export type MaskPeakSocketMessage_V1_0 = MaskPeakUpdateComplete_V1_0 | MaskError_V1_0;

export function toMaskPeakSocketUrl(baseUrl: string, maskMediaId: string, accessToken: string): string {
  return `${toWebSocketUrl(baseUrl)}/media/masks/${maskMediaId}/peaks?token=${encodeURIComponent(accessToken)}`;
}

/* /media/groups */

interface MediaGroup_V1_0 {
  project_id: string;
  description: string;
  order: number;
  disabled: boolean;
}

export type LaurusMediaGroup = MediaGroup_V1_0;

interface MediaGroupResult_V1_0 {
  timestamp: string;
  last_active: string;
  media_group_id: string;
  project_id: string;
  description: string;
  order: number;
  disabled: boolean;
}
export type LaurusMediaGroupResult = MediaGroupResult_V1_0;
export async function getMediaGroups(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/media/groups?project_id=${projectId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: MediaGroupResult_V1_0[] = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function getMediaGroup(baseUrl: string | undefined, mediaGroupId: string) {
  try {
    const url = `${baseUrl}/media/groups/${mediaGroupId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: MediaGroupResult_V1_0 = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createMediaGroup(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  mediaGroup: MediaGroup_V1_0,
) {
  try {
    const url = `${baseUrl}/media/groups`;
    const body = JSON.stringify(mediaGroup);
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }

    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("creating", "media_group", mediaGroup.description));
      return undefined;
    }

    const result: MediaGroupResult_V1_0 = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function updateMediaGroup(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  mediaGroupId: string,
  mediaGroup: MediaGroup_V1_0,
): Promise<boolean> {
  try {
    const body = JSON.stringify(mediaGroup);
    const url = `${baseUrl}/media/groups/${mediaGroupId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "media_group", mediaGroup.description));
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: MediaGroupResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}
export async function deleteMediaGroup(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  mediaGroupId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/media/groups/${mediaGroupId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "media_group", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/* /effects */

export async function getEffects(baseUrl: string | undefined) {
  try {
    const url = `${baseUrl}/effects`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: string[] = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

/* /effects/groups */

export interface EffectGroup_V1_0 {
  project_id: string;
  description: string;
  order: number;
  disabled: boolean;
}
export interface EffectGroupResult_V1_0 {
  timestamp: string;
  last_active: string;
  effect_group_id: string;
  project_id: string;
  description: string;
  order: number;
  disabled: boolean;
}
export type LaurusEffectGroup = EffectGroup_V1_0;
export type LaurusEffectGroupResult = EffectGroupResult_V1_0;
export async function getEffectGroups(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/effects/groups?project_id=${projectId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: EffectGroupResult_V1_0[] = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function getEffectGroup(baseUrl: string | undefined, effectGroupId: string) {
  try {
    const url = `${baseUrl}/effects/groups/${effectGroupId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: EffectGroupResult_V1_0 = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createEffectGroup(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  effectGroup: EffectGroup_V1_0,
) {
  try {
    const url = `${baseUrl}/effects/groups`;
    const body = JSON.stringify(effectGroup);
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }

    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("creating", "effect_group", effectGroup.description));
      return undefined;
    }

    const result: EffectGroupResult_V1_0 = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function updateEffectGroup(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  effectGroupId: string,
  effectGroup: EffectGroup_V1_0,
): Promise<boolean> {
  try {
    const body = JSON.stringify(effectGroup);
    const url = `${baseUrl}/effects/groups/${effectGroupId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "effect_group", effectGroup.description));
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: EffectGroupResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}
export async function deleteEffectGroup(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  effectGroupId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/effects/groups/${effectGroupId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "effect_group", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/* /scales */

export interface ScaleSolution_V1_0 {
  x: number;
  y: number;
}
export interface ScaleEquation_V1_0 {
  input_id: string;
  /**
   * ms
   */
  time: number;
  scale_x: number;
  scale_y: number;
  loop: LaurusLoopType;
  solution: ScaleSolution_V1_0[];
  limit_factor: number;
}
export interface Scale_V1_0 {
  /**
   * s
   */
  start: number;
  /**
   * s
   */
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, ScaleEquation_V1_0>;
}
export interface ScaleResult_V1_0 {
  timestamp: string;
  last_active: string;
  scale_id: string;
  /**
   * s
   */
  start: number;
  /**
   * s
   */
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, ScaleEquation_V1_0>;
  creator: string;
  last_editor: string;
}
export type LaurusScaleEquation = ScaleEquation_V1_0;
export interface LaurusScale extends Scale_V1_0 {
  math: Map<string, LaurusScaleEquation>;
}
export interface LaurusScaleResult extends ScaleResult_V1_0 {
  math: Map<string, LaurusScaleEquation>;
  mixState: LaurusMixState;
}
export async function getScales(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/scales?project_id=${projectId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: ScaleResult_V1_0[] = await raw_response.json();
    return response.map((r) => {
      return {
        ...r,
        math: new Map(Object.entries(r.math)),
      };
    });
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function getScale(baseUrl: string | undefined, scaleId: string, inputId: string | undefined) {
  try {
    let url = `${baseUrl}/scales/${scaleId}`;
    if (inputId) {
      url += `?input_id=${inputId}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: ScaleResult_V1_0 = await raw_response.json();
    return {
      ...response,
      math: new Map(Object.entries(response.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createScale(baseUrl: string | undefined, accessToken: string | undefined, scale: Scale_V1_0) {
  try {
    const url = `${baseUrl}/scales`;
    const body = JSON.stringify({
      ...scale,
      math: Object.fromEntries(scale.math),
    });
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }

    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("creating", "scale", scale.description));
      return undefined;
    }

    const result: ScaleResult_V1_0 = await response.json();
    return {
      ...result,
      math: new Map(Object.entries(result.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function updateScale(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  scaleId: string,
  scale: Scale_V1_0,
): Promise<boolean> {
  try {
    const body = JSON.stringify({
      ...scale,
      math: Object.fromEntries(scale.math),
    });
    const url = `${baseUrl}/scales/${scaleId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "scale", scale.description));
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: ScaleResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}
export async function deleteScale(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  scaleId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/scales/${scaleId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "scale", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/* /moves */

export interface MoveEquation_V1_0 {
  input_id: string;
  angle: number;
  amplitude: number;
  frequency: number;
  wavelength: number;
  distance: number;
  time: number;
  loop: LaurusLoopType;
  shape: LaurusShapeType;
  solution: { x: number; y: number }[];
  limit_factor: number;
}
export interface Move_V1_0 {
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, MoveEquation_V1_0>;
}
export interface MoveResult_V1_0 {
  timestamp: string;
  last_active: string;
  move_id: string;
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, MoveEquation_V1_0>;
  creator: string;
  last_editor: string;
}
export type LaurusMoveEquation = MoveEquation_V1_0;
export interface LaurusMove extends Move_V1_0 {
  math: Map<string, LaurusMoveEquation>;
}
export interface LaurusMoveResult extends MoveResult_V1_0 {
  math: Map<string, LaurusMoveEquation>;
  mixState: LaurusMixState;
}
export async function getMoves(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/moves?project_id=${projectId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: MoveResult_V1_0[] = await raw_response.json();
    return response.map((r) => {
      return {
        ...r,
        math: new Map(Object.entries(r.math)),
      };
    });
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function getMove(baseUrl: string | undefined, moveId: string, inputId: string | undefined) {
  try {
    let url = `${baseUrl}/moves/${moveId}`;
    if (inputId) {
      url += `?input_id=${inputId}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: MoveResult_V1_0 = await raw_response.json();
    return {
      ...response,
      math: new Map(Object.entries(response.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createMove(baseUrl: string | undefined, accessToken: string | undefined, move: Move_V1_0) {
  try {
    const url = `${baseUrl}/moves`;
    const body = JSON.stringify({
      ...move,
      math: Object.fromEntries(move.math),
    });
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }

    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("creating", "move", move.description));
      return undefined;
    }

    const result: MoveResult_V1_0 = await response.json();
    return {
      ...result,
      math: new Map(Object.entries(result.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function updateMove(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  moveId: string,
  move: Move_V1_0,
): Promise<boolean> {
  try {
    const body = JSON.stringify({
      ...move,
      math: Object.fromEntries(move.math),
    });
    const url = `${baseUrl}/moves/${moveId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "move", move.description));
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: MoveResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export async function deleteMove(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  moveId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/moves/${moveId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "move", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/* /rotates */

export interface RotateEquation_V1_0 {
  input_id: string;
  x: number;
  y: number;
  z: number;
  angle: number;
  time: number;
  loop: LaurusLoopType;
  solution: { x: number; y: number; z: number; angle: number }[];
  limit_factor: number;
}
export interface Rotate_V1_0 {
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, RotateEquation_V1_0>;
}
export interface RotateResult_V1_0 {
  timestamp: string;
  last_active: string;
  rotate_id: string;
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, RotateEquation_V1_0>;
  creator: string;
  last_editor: string;
}
export type LaurusRotateEquation = RotateEquation_V1_0;
export interface LaurusRotate extends Rotate_V1_0 {
  math: Map<string, LaurusRotateEquation>;
}
export interface LaurusRotateResult extends RotateResult_V1_0 {
  math: Map<string, LaurusRotateEquation>;
  mixState: LaurusMixState;
}
export async function getRotates(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/rotates?project_id=${projectId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: RotateResult_V1_0[] = await raw_response.json();
    return response.map((r) => {
      return {
        ...r,
        math: new Map(Object.entries(r.math)),
      };
    });
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function getRotate(baseUrl: string | undefined, rotateId: string, inputId: string | undefined) {
  try {
    let url = `${baseUrl}/rotates/${rotateId}`;
    if (inputId) {
      url += `?input_id=${inputId}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: RotateResult_V1_0 = await raw_response.json();
    return {
      ...response,
      math: new Map(Object.entries(response.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createRotate(baseUrl: string | undefined, accessToken: string | undefined, rotate: Rotate_V1_0) {
  try {
    const url = `${baseUrl}/rotates`;
    const body = JSON.stringify({
      ...rotate,
      math: Object.fromEntries(rotate.math),
    });
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }

    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("creating", "rotate", rotate.description));
      return undefined;
    }

    const result: RotateResult_V1_0 = await response.json();
    return {
      ...result,
      math: new Map(Object.entries(result.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function updateRotate(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  rotateId: string,
  rotate: Rotate_V1_0,
): Promise<boolean> {
  try {
    const body = JSON.stringify({
      ...rotate,
      math: Object.fromEntries(rotate.math),
    });
    const url = `${baseUrl}/rotates/${rotateId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "rotate", rotate.description));
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: RotateResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}
export async function deleteRotate(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  rotateId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/rotates/${rotateId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "rotate", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/* /light_sources */

export interface LightSourceSolution_V1_0 {
  capture_size: number;
  capture_intensity: number;
  capture_falloff: number;
  capture_darkness: number;
  /** A light_source equation wired to a topology peak (input_id
   * "<mask_key>:peak:<peak_id>", see maskPeakInputId in effects-utils.ts) ramps
   * these three instead of the four capture_* fields above, which stay at
   * zero for a peak-flavored equation. One solution type rather than two, so a
   * caller never has to branch on which flavor it solved before reading the
   * result -- mirrors the server's own LightSourceSolution. */
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
}
export interface LightSourceEquation_V1_0 {
  input_id: string;
  /**
   * ms
   */
  time: number;
  capture_size: number;
  capture_intensity: number;
  capture_falloff: number;
  capture_darkness: number;
  /** The peak shape this equation ramps toward, for a peak-flavored input_id --
   * see LightSourceSolution_V1_0 above. Absolute targets, not deltas: the ramp
   * starts from the peak's own persisted elevation/radius/falloff (the server's
   * resolve_light_source_seed) and lands exactly here. */
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
  loop: LaurusLoopType;
  solution: LightSourceSolution_V1_0[];
  limit_factor: number;
}
export interface LightSource_V1_0 {
  /**
   * s
   */
  start: number;
  /**
   * s
   */
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, LightSourceEquation_V1_0>;
}
export interface LightSourceResult_V1_0 {
  timestamp: string;
  last_active: string;
  light_source_id: string;
  /**
   * s
   */
  start: number;
  /**
   * s
   */
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  fps: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, LightSourceEquation_V1_0>;
  creator: string;
  last_editor: string;
}
export type LaurusLightSourceEquation = LightSourceEquation_V1_0;
export interface LaurusLightSource extends LightSource_V1_0 {
  math: Map<string, LaurusLightSourceEquation>;
}
export interface LaurusLightSourceResult extends LightSourceResult_V1_0 {
  math: Map<string, LaurusLightSourceEquation>;
  mixState: LaurusMixState;
}
export async function getLightSources(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/light_sources?project_id=${projectId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: LightSourceResult_V1_0[] = await raw_response.json();
    return response.map((r) => {
      return {
        ...r,
        math: new Map(Object.entries(r.math)),
      };
    });
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function getLightSource(baseUrl: string | undefined, lightSourceId: string, inputId: string | undefined) {
  try {
    let url = `${baseUrl}/light_sources/${lightSourceId}`;
    if (inputId) {
      url += `?input_id=${inputId}`;
    }
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: LightSourceResult_V1_0 = await raw_response.json();
    return {
      ...response,
      math: new Map(Object.entries(response.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createLightSource(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  lightSource: LightSource_V1_0,
) {
  try {
    const url = `${baseUrl}/light_sources`;
    const body = JSON.stringify({
      ...lightSource,
      math: Object.fromEntries(lightSource.math),
    });
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }

    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("creating", "light_source", lightSource.description));
      return undefined;
    }

    const result: LightSourceResult_V1_0 = await response.json();
    return {
      ...result,
      math: new Map(Object.entries(result.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function updateLightSource(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  lightSourceId: string,
  lightSource: LightSource_V1_0,
): Promise<boolean> {
  try {
    const body = JSON.stringify({
      ...lightSource,
      math: Object.fromEntries(lightSource.math),
    });
    const url = `${baseUrl}/light_sources/${lightSourceId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "light_source", lightSource.description));
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: LightSourceResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}
export async function deleteLightSource(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  lightSourceId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/light_sources/${lightSourceId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "light_source", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

/* /frames */
export type LaurusFrame = Frame_V1_0;
interface Frame_V1_0 {
  x: number;
  y: number;
  sx: number;
  sy: number;
  rx: number;
  ry: number;
  rz: number;
  rangle: number;
  capture_size: number;
  capture_intensity: number;
  capture_falloff: number;
  capture_darkness: number;
  // Only ever non-neutral on a frame solved for a peak-flavored input_id (see
  // LightSourceSolution_V1_0) -- every other effect's frames leave them at the neutral
  // "no relief change" values below, the same way they leave sx/sy at 1.
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
  input_id: string;
}

// What a frame carries for peak fields when nothing peak-flavored solved it -- elevation/radius
// at 0 (a peak of no size, i.e. no displacement at all) and the schema's own smooth-dome falloff,
// matching the server's own NEUTRAL_FRAME. Spread into every non-light_source frame builder below
// so a caller reading frame.peak_* never has to distinguish "unsolved" from "solved to nothing".
const NEUTRAL_PEAK_FRAME = {
  peak_elevation: 0,
  peak_radius: 0,
  peak_falloff: PEAK_FALLOFF_DEFAULT,
};
export async function getScaleFrames(
  baseUrl: string | undefined,
  scaleId: string,
  inputId: string,
): Promise<LaurusFrame[] | undefined> {
  const scaleResult = await getScale(baseUrl, scaleId, inputId);
  if (!scaleResult) return undefined;
  const eq: ScaleEquation_V1_0 | undefined = scaleResult.math.get(inputId);
  if (!eq) return undefined;
  return eq.solution.map((frame) => ({
    sx: frame.x,
    sy: frame.y,
    x: 0,
    y: 0,
    rangle: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    capture_size: 0,
    capture_intensity: 0,
    capture_falloff: 0,
    capture_darkness: 0,
    ...NEUTRAL_PEAK_FRAME,
    input_id: inputId,
  }));
}
export async function getMoveFrames(
  baseUrl: string | undefined,
  moveId: string,
  inputId: string,
): Promise<LaurusFrame[] | undefined> {
  const moveResult = await getMove(baseUrl, moveId, inputId);
  if (!moveResult) return undefined;
  const eq: MoveEquation_V1_0 | undefined = moveResult.math.get(inputId);
  if (!eq) return undefined;
  return eq.solution.map((frame) => ({
    ...frame,
    sx: 1,
    sy: 1,
    rangle: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    capture_size: 0,
    capture_intensity: 0,
    capture_falloff: 0,
    capture_darkness: 0,
    ...NEUTRAL_PEAK_FRAME,
    input_id: inputId,
  }));
}
export async function getRotateFrames(
  baseUrl: string | undefined,
  rotateId: string,
  inputId: string,
): Promise<LaurusFrame[] | undefined> {
  const rotateResult = await getRotate(baseUrl, rotateId, inputId);
  if (!rotateResult) return undefined;
  const eq: RotateEquation_V1_0 | undefined = rotateResult.math.get(inputId);
  if (!eq) return undefined;
  return eq.solution.map((frame) => ({
    rx: frame.x,
    ry: frame.y,
    rz: frame.z,
    rangle: frame.angle,
    x: 0,
    y: 0,
    sx: 1,
    sy: 1,
    capture_size: 0,
    capture_intensity: 0,
    capture_falloff: 0,
    capture_darkness: 0,
    ...NEUTRAL_PEAK_FRAME,
    input_id: inputId,
  }));
}
export async function getLightSourceFrames(
  baseUrl: string | undefined,
  lightSourceId: string,
  inputId: string,
): Promise<LaurusFrame[] | undefined> {
  const lightSourceResult = await getLightSource(baseUrl, lightSourceId, inputId);
  if (!lightSourceResult) return undefined;
  const eq: LightSourceEquation_V1_0 | undefined = lightSourceResult.math.get(inputId);
  if (!eq) return undefined;
  return eq.solution.map((frame) => ({
    ...frame,
    x: 0,
    y: 0,
    sx: 1,
    sy: 1,
    rangle: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    input_id: inputId,
  }));
}
export async function getFrames(
  baseUrl: string | undefined,
  projectId: string,
  inputId: string,
  fps: number,
  signal?: AbortSignal,
) {
  try {
    const url = `${baseUrl}/frames?project_id=${projectId}&input_id=${inputId}&fps=${fps}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal,
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: Frame_V1_0[] = await raw_response.json();
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return undefined;
    }
    console.log({ error });
    return undefined;
  }
}

export enum LaurusMixState {
  None = "none",
  Waiting = "waiting",
  Selected = "selected",
  Active = "active",
}

export type LaurusEffect =
  | { type: "scale"; key: string; value: LaurusScaleResult }
  | { type: "move"; key: string; value: LaurusMoveResult }
  | { type: "rotate"; key: string; value: LaurusRotateResult }
  | { type: "light_source"; key: string; value: LaurusLightSourceResult };

export enum LaurusLoopType {
  none = "none",
  loop = "loop",
  loop_infinite = "loop_infinite",
  loop_reverse_infinite = "loop_reverse_infinite",
  loop_reverse = "loop_reverse",
}

export enum LaurusShapeType {
  wave = "wave",
  circle = "circle",
  ellipse = "ellipse",
}
