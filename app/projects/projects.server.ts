/* /projects */

import { authFetch, FORBIDDEN_ACTION, UNAUTHORIZED_EDIT } from "../landing.server";
const onNotOk = (status: number) => {
  switch (status) {
    case 401: {
      alert(UNAUTHORIZED_EDIT);
      return;
    }
    case 403: {
      alert(FORBIDDEN_ACTION);
      return;
    }
  }
};
export interface ProjectImg_V1_0 {
  img_media_id: string;
  media_key: string;
  width: number;
  height: number;
  top: number;
  left: number;
  order: number;
  scale_x: number;
  scale_y: number;
  rotate_x: number;
  rotate_y: number;
  rotate_z: number;
  rotate_angle: number;
  description: string;
}
export interface ProjectSvg_V1_0 {
  svg_media_id: string;
  media_key: string;
  width: number;
  height: number;
  top: number;
  left: number;
  order: number;
  scale_x: number;
  scale_y: number;
  rotate_x: number;
  rotate_y: number;
  rotate_z: number;
  rotate_angle: number;
  viewbox: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  description: string;
}
export interface Project_V1_0 {
  name: string;
  canvas_width: number;
  canvas_height: number;
  frame_top: number;
  frame_left: number;
  frame_width: number;
  frame_height: number;
  frame_scale_x: number;
  frame_scale_y: number;
  frame_rotate_x: number;
  frame_rotate_y: number;
  frame_rotate_z: number;
  frame_rotate_angle: number;
  imgs: Map<string, ProjectImg_V1_0>;
  svgs: Map<string, ProjectSvg_V1_0>;
  browse_public_imgs: boolean;
  browse_public_svgs: boolean;
}
export interface ProjectResult_V1_0 {
  name: string;
  canvas_width: number;
  canvas_height: number;
  frame_top: number;
  frame_left: number;
  frame_width: number;
  frame_height: number;
  frame_scale_x: number;
  frame_scale_y: number;
  frame_rotate_x: number;
  frame_rotate_y: number;
  frame_rotate_z: number;
  frame_rotate_angle: number;
  project_id: string;
  timestamp: string;
  last_active: string;
  imgs: Map<string, ProjectImg_V1_0>;
  svgs: Map<string, ProjectSvg_V1_0>;
  browse_public_imgs: boolean;
  browse_public_svgs: boolean;
  creator: string;
  last_editor: string;
}
export interface ProjectSearch_V1_0 {
  query: string;
}
export interface Pin_V1_0 {
  pinned: boolean;
  project_id: string;
}
export interface PinResult_V1_0 {
  pinned: boolean;
  project_id: string;
  pin_id: string;
  creator: string;
  timestamp: string;
  last_active: string;
}

export enum AbsolutePosition {
  topRight = "topRight",
  topLeft = "topLeft",
  bottomRight = "bottomRight",
  bottomLeft = "bottomLeft",
}
export type ContextMenuConfig =
  | { position: AbsolutePosition.topRight; width: number; height: number }
  | { position: AbsolutePosition.topLeft; width: number; height: number }
  | { position: AbsolutePosition.bottomRight; width: number; height: number }
  | { position: AbsolutePosition.bottomLeft; width: number; height: number };
export const DEFAULT_CONTEXT_MENU_CONFIG: ContextMenuConfig = {
  position: AbsolutePosition.topRight,
  width: 300,
  height: 400,
};
export type LaurusProjectImg = ProjectImg_V1_0;
export type LaurusProjectSvg = ProjectSvg_V1_0;
export interface LaurusProjectResult extends ProjectResult_V1_0 {
  imgs: Map<string, LaurusProjectImg>;
  svgs: Map<string, LaurusProjectSvg>;
}
export interface LaurusProject extends Project_V1_0 {
  imgs: Map<string, LaurusProjectImg>;
  svgs: Map<string, LaurusProjectSvg>;
}
export type LaurusProjectSearch = ProjectSearch_V1_0;
export type LaurusPin = Pin_V1_0;
export type LaurusPinResult = PinResult_V1_0;

export async function getProjects(baseUrl: string | undefined) {
  try {
    const url = `${baseUrl}/projects`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return undefined;
    }
    const result: ProjectResult_V1_0[] = await response.json();
    return result.map((r) => {
      return {
        ...r,
        imgs: new Map(Object.entries(r.imgs)),
        svgs: new Map(Object.entries(r.svgs)),
      };
    });
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function getProject(baseUrl: string | undefined, projectId: string) {
  try {
    const url = `${baseUrl}/projects/${projectId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return undefined;
    }
    const result: ProjectResult_V1_0 = await response.json();
    return {
      ...result,
      imgs: new Map(Object.entries(result.imgs)),
      svgs: new Map(Object.entries(result.svgs)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function createProject(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  project: Project_V1_0,
) {
  try {
    const url = `${baseUrl}/projects`;
    const body = JSON.stringify({
      ...project,
      imgs: Object.fromEntries(project.imgs),
      svgs: Object.fromEntries(project.svgs),
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
      onNotOk(response.status);
      return undefined;
    }
    const result: ProjectResult_V1_0 = await response.json();
    return {
      ...result,
      imgs: new Map(Object.entries(result.imgs)),
      svgs: new Map(Object.entries(result.svgs)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function updateProject(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  projectId: string,
  project: Project_V1_0,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/projects/${projectId}`;
    const body = JSON.stringify({
      ...project,
      imgs: Object.fromEntries(project.imgs),
      svgs: Object.fromEntries(project.svgs),
    });
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: ProjectResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export async function deleteProject(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  projectId: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/projects/${projectId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return false;
    } else {
      return true;
    }
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export async function getPins(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  projectId: string | undefined,
): Promise<LaurusPinResult[] | undefined> {
  try {
    let url = `${baseUrl}/pins`;
    if (projectId) {
      url += `&project_id=${projectId}`;
    }
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "GET");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "GET");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return undefined;
    }
    const result: PinResult_V1_0[] = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function getPin(baseUrl: string | undefined, pinId: string): Promise<LaurusPinResult | undefined> {
  try {
    const url = `${baseUrl}/pins/${pinId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return undefined;
    }
    const result: PinResult_V1_0 = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function createPin(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  pin: Pin_V1_0,
): Promise<LaurusPinResult | undefined> {
  try {
    const url = `${baseUrl}/pins`;
    const body = JSON.stringify(pin);
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return undefined;
    }
    const result: PinResult_V1_0 = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function updatePin(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  pinId: string,
  pin: Pin_V1_0,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/pins/${pinId}`;
    const body = JSON.stringify(pin);
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, body, url, "PUT");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, "PUT");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result: PinResult_V1_0 = await response.json();
    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export async function deletePin(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  pinId: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/pins/${pinId}`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "DELETE");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "DELETE");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return false;
    } else {
      return true;
    }
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export async function downloadProject(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  projectId: string,
): Promise<boolean> {
  try {
    const url = `${baseUrl}/projects/${projectId}/download`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "GET");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "GET");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response || !response.ok) {
      if (response) onNotOk(response.status);
      return false;
    } else {
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `project_${projectId}.json`;
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const matches = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      return true;
    }
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export async function duplicateProject(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  projectId: string,
): Promise<LaurusProjectResult | undefined> {
  try {
    const url = `${baseUrl}/projects/${projectId}/duplicate`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "POST");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "POST");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      onNotOk(response.status);
      return undefined;
    }
    const result: ProjectResult_V1_0 = await response.json();
    return {
      ...result,
      imgs: new Map(Object.entries(result.imgs)),
      svgs: new Map(Object.entries(result.svgs)),
    };
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function searchProjects(
  baseUrl: string | undefined,
  project_search: ProjectSearch_V1_0,
): Promise<LaurusProjectResult[] | undefined> {
  try {
    const body = JSON.stringify(project_search);
    const url = `${baseUrl}/projects/search`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    if (!response.ok) {
      return undefined;
    }
    const result: ProjectResult_V1_0[] = await response.json();
    return result.map((r) => {
      return {
        ...r,
        imgs: new Map(Object.entries(r.imgs)),
        svgs: new Map(Object.entries(r.svgs)),
      };
    });
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
