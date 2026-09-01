import { authFetch, FORBIDDEN_ACTION, UNAUTHORIZED_EDIT } from "../landing.server";
import { MASK_ORDER_UNRANKED } from "./canvas-media/mask-order.ts";

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
  type: "scale" | "move" | "rotate" | "skew" | "light_source" | "effect_group" | "media_group" | "svg" | "mask",
  description?: string,
) => {
  return description?.trim() ? `This occurred while ${action} the ${type} described as "${description}".` : undefined;
};

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
export async function getImg(baseUrl: string | undefined, imgMediaId: string) {
  try {
    const url = `${baseUrl}/media/img/${imgMediaId}`;
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
export async function getSvg(baseUrl: string | undefined, svgMediaId: string) {
  try {
    const url = `${baseUrl}/media/svg/${svgMediaId}`;
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

export interface PolygonPath_V1_0 {
  d: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  light_id: number;
  object_id: number;
}
export type LaurusPolygonPath = PolygonPath_V1_0;

export interface Light_V1_0 {
  id: number;
  name: string;
  size: number;
  intensity: number;
  falloff: number;
  darkness: number;
  cx: number;
  cy: number;
  radius: number;
  shape: string;
  description: string;
  order: number;
}
export type LaurusLight = Light_V1_0;

export interface Object_V1_0 {
  id: number;
  name: string;
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  shape: string;
  fill_r: number;
  fill_g: number;
  fill_b: number;
  fill_a: number;
  fill_h: number;
  fill_s: number;
  description: string;
  reviewed: boolean;
  lift: boolean;
  order: number;
}
export type LaurusObject = Object_V1_0;

export interface ObjectFill_V1_0 {
  r: number;
  g: number;
  b: number;
  a: number;
  h: number;
  s: number;
}
export type LaurusObjectFill = ObjectFill_V1_0;

export const OBJECT_FILL_DEFAULT: ObjectFill_V1_0 = { r: 0, g: 0, b: 0, a: 0, h: 0, s: 0 };

export function toObjectFill(object: Object_V1_0): ObjectFill_V1_0 {
  return {
    r: object.fill_r,
    g: object.fill_g,
    b: object.fill_b,
    a: object.fill_a,
    h: object.fill_h,
    s: object.fill_s,
  };
}

export const OBJECT_FALLOFF_DEFAULT = 2.0;

export interface GlowStop_V1_0 {
  offset: number;
  opacity: number;
}
export type LaurusGlowStop = GlowStop_V1_0;

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
  lights: Light_V1_0[];
  objects: Object_V1_0[];
  creator: string;
  last_editor: string;
}
export type LaurusMaskResult = MaskMediaResult_V1_0;

type RawObject_V1_0 = Omit<
  Object_V1_0,
  | "name"
  | "falloff"
  | "shape"
  | `fill_${"r" | "g" | "b" | "a" | "h" | "s"}`
  | "description"
  | "reviewed"
  | "lift"
  | "order"
> & {
  name?: string;
  falloff?: number;
  shape?: string;
  fill_r?: number;
  fill_g?: number;
  fill_b?: number;
  fill_a?: number;
  fill_h?: number;
  fill_s?: number;
  description?: string;
  reviewed?: boolean;
  lift?: boolean;
  order?: number;
};
type RawLight_V1_0 = Omit<Light_V1_0, "order"> & { order?: number };
type RawMaskMediaResult_V1_0 = Omit<MaskMediaResult_V1_0, "objects" | "lights"> & {
  objects?: RawObject_V1_0[];
  lights?: RawLight_V1_0[];
};

export function normalizeObject(object: RawObject_V1_0): Object_V1_0 {
  return {
    ...object,
    name: object.name ?? `object ${object.id}`,
    falloff: object.falloff ?? OBJECT_FALLOFF_DEFAULT,
    shape: object.shape ?? "",
    fill_r: object.fill_r ?? OBJECT_FILL_DEFAULT.r,
    fill_g: object.fill_g ?? OBJECT_FILL_DEFAULT.g,
    fill_b: object.fill_b ?? OBJECT_FILL_DEFAULT.b,
    fill_a: object.fill_a ?? OBJECT_FILL_DEFAULT.a,
    fill_h: object.fill_h ?? OBJECT_FILL_DEFAULT.h,
    fill_s: object.fill_s ?? OBJECT_FILL_DEFAULT.s,
    description: object.description ?? "",
    reviewed: object.reviewed ?? false,
    lift: object.lift ?? true,
    order: object.order ?? MASK_ORDER_UNRANKED,
  };
}

export function normalizeLight(light: RawLight_V1_0): Light_V1_0 {
  return { ...light, order: light.order ?? MASK_ORDER_UNRANKED };
}

export function normalizeMaskResult(mask: RawMaskMediaResult_V1_0): MaskMediaResult_V1_0 {
  return {
    ...mask,
    objects: (mask.objects ?? []).map(normalizeObject),
    lights: (mask.lights ?? []).map(normalizeLight),
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

export function nextLightId(lights: Light_V1_0[]): number {
  return 1 + lights.reduce((max, c) => Math.max(max, c.id), 0);
}

export function nextObjectId(objects: Object_V1_0[]): number {
  return 1 + objects.reduce((max, p) => Math.max(max, p.id), 0);
}

export interface MaskRequest_V1_0 {
  img_media_id: string;
  max_triangle_area?: number;
  detail_points?: number;
  canny_low?: number;
  canny_high?: number;
  alpha_threshold?: number;
  curve_tolerance?: number;
  edge_objects?: boolean;
  object_elevation?: number;
  object_falloff?: number;
}
export type LaurusMaskRequest = MaskRequest_V1_0;

export interface MaskGroupStart_V1_0 {
  type: "group_start";
  color: string;
  group_index: number;
  group_count: number;
}

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
export interface MaskObject_V1_0 {
  type: "object";
  object: Object_V1_0;
  polygon_indices: number[];
  object_index: number;
  object_count: number;
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
  MaskGroupStart_V1_0 | MaskCurve_V1_0 | MaskTriangle_V1_0 | MaskObject_V1_0 | MaskComplete_V1_0 | MaskError_V1_0;

function toWebSocketUrl(baseUrl: string): string {
  return baseUrl.replace(/^http/, "ws");
}

export interface MaskImageHandlers {
  onGroupStart?: (event: MaskGroupStart_V1_0) => void;
  onCurve?: (event: MaskCurve_V1_0) => void;
  onTriangle?: (event: MaskTriangle_V1_0) => void;
  onObject?: (event: MaskObject_V1_0) => void;
  onComplete?: (event: MaskComplete_V1_0) => void;
  onError?: (message: string) => void;
}

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
      case "object":
        handlers.onObject?.(message);
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

export interface MaskLightUpdateRequest_V1_0 {
  light_id: number;
  name: string;
  polygon_indices: number[];
  size: number;
  intensity: number;
  falloff: number;
  darkness: number;
  cx: number;
  cy: number;
  radius: number;
  shape: string;
  description: string;
  order: number;
  retouch?: RetouchedMesh_V1_0;
}
export interface MaskEditDelta_V1_0 {
  tagged_polygon_indices: number[];
  cleared_polygon_indices: number[];
  last_active: string;
  last_editor: string;
}

export interface ObjectUpdateDelta_V1_0 extends MaskEditDelta_V1_0 {
  object_id: number;
  object: Object_V1_0 | null;
  removed: boolean;
}

export interface LightUpdateDelta_V1_0 extends MaskEditDelta_V1_0 {
  light_id: number;
  light: Light_V1_0 | null;
  removed: boolean;
}

export function newLight(id: number, name: string): Light_V1_0 {
  return {
    id,
    name,
    size: 0,
    intensity: 0,
    falloff: 0,
    darkness: 0,
    cx: 0,
    cy: 0,
    radius: 0,
    shape: "",
    description: "",
    order: MASK_ORDER_UNRANKED,
  };
}

export function toLightUpdate(
  light: Light_V1_0,
  changes: Partial<Omit<MaskLightUpdateRequest_V1_0, "light_id">> & { polygon_indices: number[] },
): MaskLightUpdateRequest_V1_0 {
  return {
    light_id: light.id,
    name: light.name,
    size: light.size,
    intensity: light.intensity,
    falloff: light.falloff,
    darkness: light.darkness,
    cx: light.cx,
    cy: light.cy,
    radius: light.radius,
    shape: light.shape,
    description: light.description,
    order: light.order,
    ...changes,
  };
}

export interface MaskLightUpdateComplete_V1_0 {
  type: "light_update_complete";
  delta: LightUpdateDelta_V1_0;
}
export type MaskLightSocketMessage_V1_0 = MaskLightUpdateComplete_V1_0 | MaskError_V1_0;

export function toMaskLightSocketUrl(baseUrl: string, maskMediaId: string, accessToken: string): string {
  return `${toWebSocketUrl(baseUrl)}/media/masks/${maskMediaId}/lights?token=${encodeURIComponent(accessToken)}`;
}

export interface MaskObjectUpdateRequest_V1_0 {
  object_id: number;
  name: string;
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  shape: string;
  fill_r: number;
  fill_g: number;
  fill_b: number;
  fill_a: number;
  fill_h: number;
  fill_s: number;
  description: string;
  reviewed: boolean;
  lift: boolean;
  order: number;
  remove: boolean;
  polygon_indices: number[];
  retouch?: RetouchedMesh_V1_0;
}

export function newObject(id: number, name: string): Object_V1_0 {
  return {
    id,
    name,
    cx: 0,
    cy: 0,
    radius: 0,
    elevation: 0,
    falloff: OBJECT_FALLOFF_DEFAULT,
    shape: "",
    ...toObjectFillFields(OBJECT_FILL_DEFAULT),
    description: "",
    reviewed: false,
    lift: true,
    order: MASK_ORDER_UNRANKED,
  };
}

export function toObjectUpdate(
  object: Object_V1_0,
  changes: Partial<Omit<MaskObjectUpdateRequest_V1_0, "object_id">> & { polygon_indices: number[] },
): MaskObjectUpdateRequest_V1_0 {
  return {
    object_id: object.id,
    name: object.name,
    cx: object.cx,
    cy: object.cy,
    radius: object.radius,
    elevation: object.elevation,
    falloff: object.falloff,
    shape: object.shape,
    ...toObjectFillFields(toObjectFill(object)),
    description: object.description,
    reviewed: object.reviewed,
    lift: object.lift,
    order: object.order,
    remove: false,
    ...changes,
  };
}

export function toObjectFillFields(fill: ObjectFill_V1_0) {
  return {
    fill_r: fill.r,
    fill_g: fill.g,
    fill_b: fill.b,
    fill_a: fill.a,
    fill_h: fill.h,
    fill_s: fill.s,
  };
}
export interface MaskObjectUpdateComplete_V1_0 {
  type: "object_update_complete";
  delta: ObjectUpdateDelta_V1_0;
}
export type MaskObjectSocketMessage_V1_0 = MaskObjectUpdateComplete_V1_0 | MaskError_V1_0;

export function toMaskObjectSocketUrl(baseUrl: string, maskMediaId: string, accessToken: string): string {
  return `${toWebSocketUrl(baseUrl)}/media/masks/${maskMediaId}/objects?token=${encodeURIComponent(accessToken)}`;
}

export interface ObjectReviewCandidate_V1_0 {
  object: Object_V1_0;
  polygon_indices: number[];
}
export type LaurusObjectReviewCandidate = ObjectReviewCandidate_V1_0;

export interface RetouchedMesh_V1_0 {
  replaced: { index: number; d: string }[];
  added: PolygonPath_V1_0[];
}
export type LaurusRetouchedMesh = RetouchedMesh_V1_0;

export interface ObjectReviewDecision_V1_0 {
  object_id: number;
  decision: "accepted" | "rejected";
  added_polygon_indices: number[];
  removed_polygon_indices: number[];
  decided_at: string;
}

export interface ObjectReviewState_V1_0 {
  mask_media_id: string;
  candidates: ObjectReviewCandidate_V1_0[];
  decisions: ObjectReviewDecision_V1_0[];
}
export type LaurusObjectReview = ObjectReviewState_V1_0;

export interface ObjectReviewDecisionResponse_V1_0 {
  review: ObjectReviewState_V1_0;
  delta: ObjectUpdateDelta_V1_0 | null;
}

export async function postObjectReviewDecision(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  maskMediaId: string,
  objectId: number,
  decision: "accepted" | "rejected",
  description?: string,
  addedPolygonIndices?: number[],
  removedPolygonIndices?: number[],
  shape?: { path: string; cx: number; cy: number; radius: number },
  retouch?: RetouchedMesh_V1_0,
): Promise<ObjectReviewDecisionResponse_V1_0 | undefined> {
  try {
    const url = `${baseUrl}/media/masks/${maskMediaId}/object-review/decisions`;
    const body = JSON.stringify({
      object_id: objectId,
      decision,
      description,
      added_polygon_indices: addedPolygonIndices ?? [],
      removed_polygon_indices: removedPolygonIndices ?? [],
      ...(shape === undefined ? {} : { shape: shape.path, cx: shape.cx, cy: shape.cy, radius: shape.radius }),
      ...(retouch === undefined ? {} : { retouch }),
    });
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) return undefined;
    const raw: ObjectReviewDecisionResponse_V1_0 = await response.json();
    return {
      review: raw.review,
      delta: raw.delta ? { ...raw.delta, object: raw.delta.object ? normalizeObject(raw.delta.object) : null } : null,
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function getObjectReview(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  maskMediaId: string,
): Promise<ObjectReviewState_V1_0 | undefined> {
  try {
    const url = `${baseUrl}/media/masks/${maskMediaId}/object-review`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "GET");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "GET");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) return undefined;
    const raw: ObjectReviewState_V1_0 = await response.json();
    return raw;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

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

export interface ScaleSolution_V1_0 {
  x: number;
  y: number;
}
export interface ScaleEquation_V1_0 {
  input_id: string;
  time: number;
  scale_x: number;
  scale_y: number;
  loop: LaurusLoopType;
  solution: ScaleSolution_V1_0[];
  limit_factor: number;
}
export interface Scale_V1_0 {
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
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
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
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

export interface SkewEquation_V1_0 {
  input_id: string;
  ax: number;
  ay: number;
  time: number;
  loop: LaurusLoopType;
  solution: { ax: number; ay: number }[];
  limit_factor: number;
}
export interface Skew_V1_0 {
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, SkewEquation_V1_0>;
}
export interface SkewResult_V1_0 {
  timestamp: string;
  last_active: string;
  skew_id: string;
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
  locked: boolean;
  disabled: boolean;
  description: string;
  mix: boolean;
  math: Map<string, SkewEquation_V1_0>;
  creator: string;
  last_editor: string;
}
export type LaurusSkewEquation = SkewEquation_V1_0;
export interface LaurusSkew extends Skew_V1_0 {
  math: Map<string, LaurusSkewEquation>;
}
export interface LaurusSkewResult extends SkewResult_V1_0 {
  math: Map<string, LaurusSkewEquation>;
  mixState: LaurusMixState;
}
export async function getSkews(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/skews?project_id=${projectId}`;
    const raw_response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!raw_response.ok) {
      return undefined;
    }
    const response: SkewResult_V1_0[] = await raw_response.json();
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
export async function getSkew(baseUrl: string | undefined, skewId: string, inputId: string | undefined) {
  try {
    let url = `${baseUrl}/skews/${skewId}`;
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
    const response: SkewResult_V1_0 = await raw_response.json();
    return {
      ...response,
      math: new Map(Object.entries(response.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function createSkew(baseUrl: string | undefined, accessToken: string | undefined, skew: Skew_V1_0) {
  try {
    const url = `${baseUrl}/skews`;
    const body = JSON.stringify({
      ...skew,
      math: Object.fromEntries(skew.math),
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
      onNotOk(response.status, getOnNotOkMessage("creating", "skew", skew.description));
      return undefined;
    }

    const result: SkewResult_V1_0 = await response.json();
    return {
      ...result,
      math: new Map(Object.entries(result.math)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function updateSkew(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  skewId: string,
  skew: Skew_V1_0,
): Promise<boolean> {
  try {
    const body = JSON.stringify({
      ...skew,
      math: Object.fromEntries(skew.math),
    });
    const url = `${baseUrl}/skews/${skewId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("updating", "skew", skew.description));
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: SkewResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}
export async function deleteSkew(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  skewId: string,
  description?: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/skews/${skewId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status, getOnNotOkMessage("deleting", "skew", description));
    }
    return response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export interface LightSourceSolution_V1_0 {
  light_intensity: number;
  light_falloff: number;
  light_darkness: number;
  object_elevation: number;
  object_falloff: number;
  object_fill_r: number;
  object_fill_g: number;
  object_fill_b: number;
  object_fill_a: number;
}
export interface LightSourceEquation_V1_0 {
  input_id: string;
  time: number;
  light_intensity: number;
  light_falloff: number;
  light_darkness: number;
  object_elevation: number;
  object_falloff: number;
  object_fill_r: number;
  object_fill_g: number;
  object_fill_b: number;
  object_fill_a: number;
  object_fill_h: number;
  object_fill_s: number;
  loop: LaurusLoopType;
  solution: LightSourceSolution_V1_0[];
  limit_factor: number;
}
export function toObjectFillEquationFields(fill: ObjectFill_V1_0) {
  return {
    object_fill_r: fill.r,
    object_fill_g: fill.g,
    object_fill_b: fill.b,
    object_fill_a: fill.a,
    object_fill_h: fill.h,
    object_fill_s: fill.s,
  };
}

export function toEquationObjectFill(fields: {
  object_fill_r: number;
  object_fill_g: number;
  object_fill_b: number;
  object_fill_a: number;
  object_fill_h?: number;
  object_fill_s?: number;
}): ObjectFill_V1_0 {
  return {
    r: fields.object_fill_r,
    g: fields.object_fill_g,
    b: fields.object_fill_b,
    a: fields.object_fill_a,
    h: fields.object_fill_h ?? OBJECT_FILL_DEFAULT.h,
    s: fields.object_fill_s ?? OBJECT_FILL_DEFAULT.s,
  };
}

export interface LightSource_V1_0 {
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
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
  start: number;
  end: number;
  project_id: string;
  effect_group_id: string;
  order: number;
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
  ax: number;
  ay: number;
  light_intensity: number;
  light_falloff: number;
  light_darkness: number;
  object_elevation: number;
  object_falloff: number;
  object_fill_r: number;
  object_fill_g: number;
  object_fill_b: number;
  object_fill_a: number;
  input_id: string;
}

const NEUTRAL_SKEW_FRAME = {
  ax: 0,
  ay: 0,
};

const NEUTRAL_OBJECT_FRAME = {
  object_elevation: 0,
  object_falloff: OBJECT_FALLOFF_DEFAULT,
  ...toObjectFillEquationFields(OBJECT_FILL_DEFAULT),
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
    light_intensity: 0,
    light_falloff: 0,
    light_darkness: 0,
    ...NEUTRAL_SKEW_FRAME,
    ...NEUTRAL_OBJECT_FRAME,
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
    light_intensity: 0,
    light_falloff: 0,
    light_darkness: 0,
    ...NEUTRAL_SKEW_FRAME,
    ...NEUTRAL_OBJECT_FRAME,
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
    light_intensity: 0,
    light_falloff: 0,
    light_darkness: 0,
    ...NEUTRAL_SKEW_FRAME,
    ...NEUTRAL_OBJECT_FRAME,
    input_id: inputId,
  }));
}
export async function getSkewFrames(
  baseUrl: string | undefined,
  skewId: string,
  inputId: string,
): Promise<LaurusFrame[] | undefined> {
  const skewResult = await getSkew(baseUrl, skewId, inputId);
  if (!skewResult) return undefined;
  const eq: SkewEquation_V1_0 | undefined = skewResult.math.get(inputId);
  if (!eq) return undefined;
  return eq.solution.map((frame) => ({
    ax: frame.ax,
    ay: frame.ay,
    x: 0,
    y: 0,
    sx: 1,
    sy: 1,
    rangle: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    light_intensity: 0,
    light_falloff: 0,
    light_darkness: 0,
    ...NEUTRAL_OBJECT_FRAME,
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
    ...NEUTRAL_SKEW_FRAME,
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
  | { type: "skew"; key: string; value: LaurusSkewResult }
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
