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

/* /media/masks */

export interface PolygonPath_V1_0 {
  d: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  capture_id: number;
  peak_id: number;
}
export type LaurusPolygonPath = PolygonPath_V1_0;

export interface Capture_V1_0 {
  id: number;
  name: string;
  size: number;
  intensity: number;
  falloff: number;
  darkness: number;
}
export type LaurusCapture = Capture_V1_0;

export interface Peak_V1_0 {
  id: number;
  name: string;
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
}
export type LaurusPeak = Peak_V1_0;

export interface PeakBlackPoint_V1_0 {
  r: number;
  g: number;
  b: number;
  a: number;
}
export type LaurusPeakBlackPoint = PeakBlackPoint_V1_0;

export const PEAK_BLACK_POINT_DEFAULT: PeakBlackPoint_V1_0 = { r: 0, g: 0, b: 0, a: 0 };

export function toPeakBlackPoint(peak: Peak_V1_0): PeakBlackPoint_V1_0 {
  return {
    r: peak.black_point_r,
    g: peak.black_point_g,
    b: peak.black_point_b,
    a: peak.black_point_a,
  };
}

export const PEAK_FALLOFF_DEFAULT = 2.0;

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
  captures: Capture_V1_0[];
  peaks: Peak_V1_0[];
  creator: string;
  last_editor: string;
}
export type LaurusMaskResult = MaskMediaResult_V1_0;

type RawPeak_V1_0 = Omit<Peak_V1_0, "name" | "falloff" | "shape" | `black_point_${"r" | "g" | "b" | "a"}`> & {
  name?: string;
  falloff?: number;
  shape?: string;
  black_point_r?: number;
  black_point_g?: number;
  black_point_b?: number;
  black_point_a?: number;
};
type RawMaskMediaResult_V1_0 = Omit<MaskMediaResult_V1_0, "peaks"> & { peaks?: RawPeak_V1_0[] };

export function normalizeMaskResult(mask: RawMaskMediaResult_V1_0): MaskMediaResult_V1_0 {
  return {
    ...mask,
    peaks: (mask.peaks ?? []).map((peak) => ({
      ...peak,
      name: peak.name ?? `peak ${peak.id}`,
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

export function nextCaptureId(captures: Capture_V1_0[]): number {
  return 1 + captures.reduce((max, c) => Math.max(max, c.id), 0);
}

export function nextPeakId(peaks: Peak_V1_0[]): number {
  return 1 + peaks.reduce((max, p) => Math.max(max, p.id), 0);
}

/* /media/masks/mask (websocket) */

export interface MaskRequest_V1_0 {
  img_media_id: string;
  max_triangle_area?: number;
  detail_points?: number;
  canny_low?: number;
  canny_high?: number;
  alpha_threshold?: number;
  curve_tolerance?: number;
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

export interface MaskPeakUpdateRequest_V1_0 {
  peak_id: number;
  name: string;
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
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
  peak_black_point_r: number;
  peak_black_point_g: number;
  peak_black_point_b: number;
  peak_black_point_a: number;
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
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
  peak_black_point_r: number;
  peak_black_point_g: number;
  peak_black_point_b: number;
  peak_black_point_a: number;
  loop: LaurusLoopType;
  solution: LightSourceSolution_V1_0[];
  limit_factor: number;
}
export function toPeakBlackPointEquationFields(blackPoint: PeakBlackPoint_V1_0) {
  return {
    peak_black_point_r: blackPoint.r,
    peak_black_point_g: blackPoint.g,
    peak_black_point_b: blackPoint.b,
    peak_black_point_a: blackPoint.a,
  };
}

export function toEquationPeakBlackPoint(fields: {
  peak_black_point_r: number;
  peak_black_point_g: number;
  peak_black_point_b: number;
  peak_black_point_a: number;
}): PeakBlackPoint_V1_0 {
  return {
    r: fields.peak_black_point_r,
    g: fields.peak_black_point_g,
    b: fields.peak_black_point_b,
    a: fields.peak_black_point_a,
  };
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
  peak_elevation: number;
  peak_radius: number;
  peak_falloff: number;
  peak_black_point_r: number;
  peak_black_point_g: number;
  peak_black_point_b: number;
  peak_black_point_a: number;
  input_id: string;
}

const NEUTRAL_PEAK_FRAME = {
  peak_elevation: 0,
  peak_radius: 0,
  peak_falloff: PEAK_FALLOFF_DEFAULT,
  ...toPeakBlackPointEquationFields(PEAK_BLACK_POINT_DEFAULT),
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
