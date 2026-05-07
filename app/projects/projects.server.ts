
/* /projects */

import { authFetch, FORBIDDEN_ACTION, UNAUTHORIZED_EDIT } from "../landing.server";
const onNotOk = (status: number) => {
    switch (status) {
        case 401: { alert(UNAUTHORIZED_EDIT); return; }
        case 403: { alert(FORBIDDEN_ACTION); return; }
    }
}
export interface ProjectImg_V1_0 {
    img_media_id: string
    media_key: string
    width: number
    height: number
    top: number
    left: number
    order: number
    scale_x: number
    scale_y: number
    rotate_x: number
    rotate_y: number
    rotate_z: number
    rotate_angle: number
}
export interface ProjectSvg_V1_0 {
    svg_media_id: string
    media_key: string
    width: number
    height: number
    top: number
    left: number
    order: number
    scale_x: number
    scale_y: number
    rotate_x: number
    rotate_y: number
    rotate_z: number
    rotate_angle: number
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
}
export interface ProjectLayer_V1_0 {
    name: string,
    order: number,
}
export interface Project_V1_0 {
    name: string
    canvas_width: number
    canvas_height: number
    frame_top: number
    frame_left: number
    frame_width: number
    frame_height: number
    frame_scale_x: number
    frame_scale_y: number
    frame_rotate_x: number
    frame_rotate_y: number
    frame_rotate_z: number
    frame_rotate_angle: number
    imgs: Map<string, ProjectImg_V1_0>
    svgs: Map<string, ProjectSvg_V1_0>
    layers: Map<string, ProjectLayer_V1_0>
}
export interface ProjectResult_V1_0 {
    name: string
    canvas_width: number
    canvas_height: number
    frame_top: number
    frame_left: number
    frame_width: number
    frame_height: number
    frame_scale_x: number
    frame_scale_y: number
    frame_rotate_x: number
    frame_rotate_y: number
    frame_rotate_z: number
    frame_rotate_angle: number
    project_id: string
    timestamp: string
    last_active: string
    imgs: Map<string, ProjectImg_V1_0>
    svgs: Map<string, ProjectSvg_V1_0>
    layers: Map<string, ProjectLayer_V1_0>
    creator: string
    last_editor: string
}
export async function getProjects(baseUrl: string | undefined) {
    try {
        const url = `${baseUrl}/projects`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            return undefined;
        }
        const result: ProjectResult_V1_0[] = await response.json();
        return result.map(r => {
            return {
                ...r,
                imgs: new Map(Object.entries(r.imgs)),
                svgs: new Map(Object.entries(r.svgs)),
                layers: new Map(Object.entries(r.layers)),
            }
        });
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getProject(
    baseUrl: string | undefined,
    projectId: string) {
    try {
        const url = `${baseUrl}/projects/${projectId}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            return undefined;
        }
        const result: ProjectResult_V1_0 = await response.json();
        return {
            ...result,
            imgs: new Map(Object.entries(result.imgs)),
            svgs: new Map(Object.entries(result.svgs)),
            layers: new Map(Object.entries(result.layers)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createProject(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    project: Project_V1_0) {
    try {
        const url = `${baseUrl}/projects`;
        const body = JSON.stringify({
            ...project,
            imgs: Object.fromEntries(project.imgs),
            svgs: Object.fromEntries(project.svgs),
            layers: Object.fromEntries(project.layers),
        });
        let response: Response | undefined = undefined;
        const authResponse = await authFetch(baseUrl, accessToken, body, url, 'POST');
        if (authResponse.newToken) {
            const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, 'POST');
            response = authResponse2.response;
        }
        else {
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
            layers: new Map(Object.entries(result.layers)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateProject(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    projectId: string,
    project: Project_V1_0): Promise<boolean> {
    try {
        const url = `${baseUrl}/projects/${projectId}`;
        const body = JSON.stringify({
            ...project,
            imgs: Object.fromEntries(project.imgs),
            svgs: Object.fromEntries(project.svgs),
            layers: Object.fromEntries(project.layers),
        });
        let response: Response | undefined = undefined;
        const authResponse = await authFetch(baseUrl, accessToken, body, url, 'PUT');
        if (authResponse.newToken) {
            const authResponse2 = await authFetch(baseUrl, authResponse.newToken, body, url, 'PUT');
            response = authResponse2.response;
        }
        else {
            response = authResponse.response;
        }
        if (!response.ok) {
            onNotOk(response.status);
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const result: ProjectResult_V1_0 = await response.json();
        return true;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}
export async function deleteProject(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    projectId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/projects/${projectId}`;
        let response: Response | undefined = undefined;
        const authResponse = await authFetch(baseUrl, accessToken, undefined, url, 'DELETE');
        if (authResponse.newToken) {
            const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, 'DELETE');
            response = authResponse2.response;
        }
        else {
            response = authResponse.response;
        }
        if (!response.ok) {
            onNotOk(response.status);
            return false;
        }
        else {
            return true;
        }
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}