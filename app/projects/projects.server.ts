
/* /projects */

export interface ProjectImg_V1_0 {
    img_media_id: string
    media_key: string
    width: number
    height: number
    top: number
    left: number
}
export interface ProjectSvg_V1_0 {
    svg_media_id: string
    media_key: string
    width: number
    height: number
    top: number
    left: number
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
    project_id: string
    timestamp: string
    last_active: string
    imgs: Map<string, ProjectImg_V1_0>
    svgs: Map<string, ProjectSvg_V1_0>
    layers: Map<string, ProjectLayer_V1_0>
}
export async function getProjects(baseUrl: string | undefined) {
    try {
        const url = `${baseUrl}/projects`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: ProjectResult_V1_0[] = await raw_response.json();
        return response.map(r => {
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
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: ProjectResult_V1_0 = await raw_response.json();
        return {
            ...response,
            imgs: new Map(Object.entries(response.imgs)),
            svgs: new Map(Object.entries(response.svgs)),
            layers: new Map(Object.entries(response.layers)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createProject(
    baseUrl: string | undefined,
    project: Project_V1_0) {
    try {
        const url = `${baseUrl}/projects`;
        const body = JSON.stringify({
            ...project,
            imgs: Object.fromEntries(project.imgs),
            svgs: Object.fromEntries(project.svgs),
            layers: Object.fromEntries(project.layers),
        });
        const raw_response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!raw_response.ok) {
            return undefined;
        }

        const response: ProjectResult_V1_0 = await raw_response.json();
        return {
            ...response,
            imgs: new Map(Object.entries(response.imgs)),
            svgs: new Map(Object.entries(response.svgs)),
            layers: new Map(Object.entries(response.layers)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateProject(
    baseUrl: string | undefined,
    projectId: string,
    project: Project_V1_0) {
    try {
        const body = JSON.stringify({
            ...project,
            imgs: Object.fromEntries(project.imgs),
            svgs: Object.fromEntries(project.svgs),
            layers: Object.fromEntries(project.layers),
        });
        const url = `${baseUrl}/projects/${projectId}`;
        const raw_response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!raw_response.ok) {
            return undefined;
        }

        const response: ProjectResult_V1_0 = await raw_response.json();
        return {
            ...response,
            imgs: new Map(Object.entries(response.imgs)),
            svgs: new Map(Object.entries(response.svgs)),
            layers: new Map(Object.entries(response.layers)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function deleteProject(
    baseUrl: string | undefined,
    projectId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/projects/${projectId}`;
        const raw_response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        return raw_response.ok;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}