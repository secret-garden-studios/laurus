
export interface ImgMetadata_V1_0 {
    media_path: string
}
export interface ImgMetadataPage_V1_0 {
    page_size: number
    page_number: number
    value: ImgMetadata_V1_0[]
}
export async function enumerateImgs(
    baseUrl: string | undefined,
    pageSize: number,
    top: number | undefined,
    pageCount: number | undefined) {
    try {
        let url = `${baseUrl}/media/img?page_size=${pageSize}`;
        if (top) {
            url += `&top=${top}`;
        }
        if (pageCount) {
            url += `&page_count=${pageCount}`;
        }
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: ImgMetadataPage_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
/**
 * metadata + absolute positioning
 */
export interface ProjectImg_V1_0 {
    media_path: string
    width: number
    height: number
    top: number,
    left: number,
}
export interface EncodedImg_V1_0 {
    media_path: string
    width: number
    height: number
    src: string
}
export async function getImg(
    baseUrl: string | undefined,
    filename: string) {
    try {
        const url = `${baseUrl}/media/img/${filename}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: EncodedImg_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getFirstImg(
    baseUrl: string | undefined,
    media: Promise<ImgMetadataPage_V1_0[] | undefined>) {
    const page: ImgMetadataPage_V1_0[] | undefined = await media;
    if (page && page.length > 0 && page[0].value.length > 0) {
        const filename = page[0].value[0].media_path;
        return await getImg(baseUrl, filename);
    }
    return undefined;
}
export async function getImgsByPage(
    baseUrl: string | undefined,
    page: ImgMetadataPage_V1_0) {
    const newEncodings: EncodedImg_V1_0[] = [];
    for (let i = 0; i < page.value.length; i++) {
        const m: ImgMetadata_V1_0 = page.value[i];
        const encoding: EncodedImg_V1_0 | undefined = await getImg(baseUrl, m.media_path);
        if (encoding) {
            newEncodings.push({ ...encoding });
        }
    }
    return newEncodings;
};

export interface SvgMetadata_V1_0 {
    media_path: string
}
export interface SvgMetadataPage_V1_0 {
    page_size: number
    page_number: number
    value: SvgMetadata_V1_0[]
}
export async function enumerateSvgs(
    baseUrl: string | undefined,
    pageSize: number,
    top: number | undefined,
    pageCount: number | undefined) {
    try {
        let url = `${baseUrl}/media/svg?page_size=${pageSize}`;
        if (top) {
            url += `&top=${top}`;
        }
        if (pageCount) {
            url += `&page_count=${pageCount}`;
        }
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: SvgMetadataPage_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
/**
 * metadata + absolute positioning
 */
export interface ProjectSvg_V1_0 {
    media_path: string
    width: number
    height: number
    top: number,
    left: number,
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
}
export interface EncodedSvg_V1_0 {
    media_path: string
    width: number
    height: number
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
    markup: string
}
export async function getSvg(
    baseUrl: string | undefined,
    filename: string) {
    try {
        const url = `${baseUrl}/media/svg/${filename}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: EncodedSvg_V1_0 = await raw_response.json();
        return response;
    }
    catch {
        return undefined;
    }
}
export async function getSvgsByPage(
    baseUrl: string | undefined,
    page: SvgMetadataPage_V1_0) {
    const newEncodings: EncodedSvg_V1_0[] = [];
    for (let i = 0; i < page.value.length; i++) {
        const m: SvgMetadata_V1_0 = page.value[i];
        const encoding: EncodedSvg_V1_0 | undefined = await getSvg(baseUrl, m.media_path);
        if (encoding) {
            newEncodings.push({ ...encoding });
        }
    }
    return newEncodings;
};

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
                svgs: new Map(Object.entries(r.svgs)),
                imgs: new Map(Object.entries(r.imgs)),
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
            svgs: new Map(Object.entries(response.svgs)),
            imgs: new Map(Object.entries(response.imgs)),
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
            svgs: Object.fromEntries(project.svgs),
            imgs: Object.fromEntries(project.imgs),
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
            svgs: new Map(Object.entries(response.svgs)),
            imgs: new Map(Object.entries(response.imgs)),
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
            svgs: Object.fromEntries(project.svgs),
            imgs: Object.fromEntries(project.imgs),
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
            svgs: new Map(Object.entries(response.svgs)),
            imgs: new Map(Object.entries(response.imgs)),
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
export async function getEffects(baseUrl: string | undefined) {
    try {
        const url = `${baseUrl}/effects`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: string[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}

export interface ScaleEquation_V1_0 {
    input_id: string
    time: number
    scale: number
    loop: boolean
    solution: number[]
}
export interface Scale_V1_0 {
    offset: number
    duration: number
    project_id: string
    layer_id: string
    fps: number
    math: ScaleEquation_V1_0[]
}
export interface ScaleResult_V1_0 {
    timestamp: string
    last_active: string
    scale_id: string
    offset: number
    duration: number
    project_id: string
    layer_id: string
    fps: number
    math: ScaleEquation_V1_0[]
}
export async function getScales(baseUrl: string | undefined, projectId: string) {
    try {
        const url = `${baseUrl}/scales?project_id=${projectId}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: ScaleResult_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getScale(
    baseUrl: string | undefined,
    scaleId: string) {
    try {
        const url = `${baseUrl}/scales/${scaleId}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: ScaleResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createScale(
    baseUrl: string | undefined,
    scale: Scale_V1_0) {
    try {
        const url = `${baseUrl}/scales`;
        const body = JSON.stringify(scale);
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

        const response: ScaleResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateScale(
    baseUrl: string | undefined,
    scaleId: string,
    scale: Scale_V1_0) {
    try {
        const body = JSON.stringify(scale);
        const url = `${baseUrl}/scales/${scaleId}`;
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

        const response: ScaleResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function deleteScale(
    baseUrl: string | undefined,
    scaleId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/scales/${scaleId}`;
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