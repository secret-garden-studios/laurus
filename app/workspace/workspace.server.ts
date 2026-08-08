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
 * `captured` flags whether this triangle is part of the mask's current
 * "capture" (a client-selected subsection of the mesh, e.g. a light source
 * region) -- see updateMaskCapture. */
export interface PolygonPath_V1_0 {
  d: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  captured: boolean;
}
export type LaurusPolygonPath = PolygonPath_V1_0;

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
  fill: string;
  stroke: string;
  stroke_width: number;
  order: number;
  categories: string[];
  polygons: PolygonPath_V1_0[];
  curves: CurvePath_V1_0[];
  creator: string;
  last_editor: string;
}
export type LaurusMaskResult = MaskMediaResult_V1_0;

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
    return response;
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
    return response;
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
    return response;
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

/** Full-replace which of a mask's own polygons (by array index) are flagged
 * "captured" -- e.g. a light source region selected by dragging a circle
 * over the mesh. An empty polygonIndices array clears it. */
export async function updateMaskCapture(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  maskMediaId: string,
  polygonIndices: number[],
): Promise<LaurusMaskResult | undefined> {
  try {
    const body = JSON.stringify({ polygon_indices: polygonIndices });
    const url = `${baseUrl}/media/masks/${maskMediaId}/capture`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "mask", maskMediaId));
      return undefined;
    }
    const result: MaskMediaResult_V1_0 = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
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
        handlers.onComplete?.(message);
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
  light_source_size: number;
  light_source_intensity: number;
  light_source_falloff: number;
  light_source_darkness: number;
}
export interface LightSourceEquation_V1_0 {
  input_id: string;
  /**
   * ms
   */
  time: number;
  light_source_size: number;
  light_source_intensity: number;
  light_source_falloff: number;
  light_source_darkness: number;
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
  light_source_size: number;
  light_source_intensity: number;
  light_source_falloff: number;
  light_source_darkness: number;
  input_id: string;
}
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
    light_source_size: 0,
    light_source_intensity: 0,
    light_source_falloff: 0,
    light_source_darkness: 0,
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
    light_source_size: 0,
    light_source_intensity: 0,
    light_source_falloff: 0,
    light_source_darkness: 0,
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
    light_source_size: 0,
    light_source_intensity: 0,
    light_source_falloff: 0,
    light_source_darkness: 0,
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
