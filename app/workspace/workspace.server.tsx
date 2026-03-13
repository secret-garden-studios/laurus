
/* /discover */

export interface EncodedImg_V1_0 {
    media_path: string
    width: number
    height: number
    src: string
    categories: string[]
}
export async function getImgDiscoveryPage(
    baseUrl: string | undefined,
    page: number,
    size: number = 10) {
    try {
        const url = `${baseUrl}/discover/img?page=${page}&size=${size}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: EncodedImg_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
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
    categories: string[]
}
export async function getSvgDiscoveryPage(
    baseUrl: string | undefined,
    page: number,
    size: number = 10) {
    try {
        const url = `${baseUrl}/discover/svg?page=${page}&size=${size}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: EncodedSvg_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}

/* /media */

export interface ImgMedia_V1_0 {
    media_path: string
    width: number
    height: number
    categories: string[]
}
export interface ImgMediaResult_V1_0 {
    timestamp: string
    last_active: string
    img_media_id: string
    media_path: string
    width: number
    height: number
    categories: string[]
    src: string
}
export async function findImg(
    baseUrl: string | undefined,
    filename: string) {
    try {
        const url = `${baseUrl}/media/img?filename=${filename}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: ImgMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getImg(
    baseUrl: string | undefined,
    imgMediaId: string,
    filename?: string) {
    try {
        let url = `${baseUrl}/media/img/${imgMediaId}`;
        if (filename) {
            url += `?filename=${filename}`
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
        const response: ImgMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createImg(
    baseUrl: string | undefined,
    img: File) {
    const formData = new FormData();
    formData.append('img', img);
    const url = `${baseUrl}/media/img`;

    try {
        const raw_response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: ImgMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateImg(
    baseUrl: string | undefined,
    imgMediaId: string,
    imgMedia: ImgMedia_V1_0) {
    try {
        const body = JSON.stringify(imgMedia);
        const url = `${baseUrl}/media/img/${imgMediaId}`;
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
        const response: ImgMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function deleteImg(
    baseUrl: string | undefined,
    imgMediaId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/media/img/${imgMediaId}`;
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

interface SvgMedia_V1_0 {
    media_path: string
    width: number
    height: number
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
    categories: string[]
}
interface SvgMediaResult_V1_0 {
    timestamp: string
    last_active: string
    svg_media_id: string
    media_path: string
    width: number
    height: number
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
    categories: string[]
    markup: string
}
export async function findSvg(
    baseUrl: string | undefined,
    filename: string) {
    try {
        const url = `${baseUrl}/media/svg?filename=${filename}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: SvgMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getSvg(
    baseUrl: string | undefined,
    svgMediaId: string,
    filename?: string) {
    try {
        let url = `${baseUrl}/media/svg/${svgMediaId}`;
        if (filename) {
            url += `?filename=${filename}`
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
        const response: SvgMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createSvg(
    baseUrl: string | undefined,
    files: { svg: File, raster: File }) {
    const formData = new FormData();
    formData.append('svg', files.svg);
    formData.append('raster', files.raster);
    const url = `${baseUrl}/media/svg`;

    try {
        const raw_response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!raw_response.ok) {
            return undefined;
        }
        const response: EncodedSvg_V1_0 = await raw_response.json();
        return response;
    } catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateSvg(
    baseUrl: string | undefined,
    svgMediaId: string,
    svgMedia: SvgMedia_V1_0) {
    try {
        const body = JSON.stringify(svgMedia);
        const url = `${baseUrl}/media/svg/${svgMediaId}`;
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
        const response: SvgMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function deleteSvg(
    baseUrl: string | undefined,
    svgMediaId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/media/svg/${svgMediaId}`;
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

/* /projects */

export interface ProjectImg_V1_0 {
    img_media_id: string
    media_path: string
    width: number
    height: number
    top: number
    left: number
}
export interface ProjectSvg_V1_0 {
    svg_media_id: string
    media_path: string
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

/* /scales */

export interface ScaleEquation_V1_0 {
    input_id: string
    /**
     * ms
     */
    time: number
    scale: number
    loop: boolean
    solution: number[]
}
export interface Scale_V1_0 {
    /**
     * s
     */
    start: number
    /**
     * s
     */
    end: number
    project_id: string
    layer_id: string
    order: number
    fps: number
    math: Map<string, ScaleEquation_V1_0>
}
export interface ScaleResult_V1_0 {
    timestamp: string
    last_active: string
    scale_id: string
    /**
     * s
     */
    start: number
    /**
     * s
     */
    end: number
    project_id: string
    layer_id: string
    order: number
    fps: number
    math: Map<string, ScaleEquation_V1_0>
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
        return response.map(r => {
            return {
                ...r,
                math: new Map(Object.entries(r.math))
            }
        });
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getScale(
    baseUrl: string | undefined,
    scaleId: string,
    inputId: string | undefined) {
    try {
        let url = `${baseUrl}/scales/${scaleId}`;
        if (inputId) {
            url += `?input_id=${inputId}`
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
        const response: ScaleResult_V1_0 = await raw_response.json();
        return {
            ...response,
            math: new Map(Object.entries(response.math)),
        };
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
        const body = JSON.stringify({
            ...scale,
            math: Object.fromEntries(scale.math),
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

        const response: ScaleResult_V1_0 = await raw_response.json();
        return {
            ...response,
            math: new Map(Object.entries(response.math)),
        };
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
        const body = JSON.stringify({
            ...scale,
            math: Object.fromEntries(scale.math),
        });
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
        return {
            ...response,
            math: new Map(Object.entries(response.math)),
        };
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

/* /moves */

export interface MoveEquation_V1_0 {
    input_id: string
    angle: number
    amplitude: number
    frequency: number
    wavelength: number
    distance: number
    time: number
    loop: boolean
    solution: { x: number, y: number }[]
}
export interface Move_V1_0 {
    start: number
    end: number
    project_id: string
    layer_id: string
    order: number
    fps: number
    math: Map<string, MoveEquation_V1_0>
}
export interface MoveResult_V1_0 {
    timestamp: string
    last_active: string
    move_id: string
    start: number
    end: number
    project_id: string
    layer_id: string
    order: number
    fps: number
    math: Map<string, MoveEquation_V1_0>
}
export async function getMoves(baseUrl: string | undefined, projectId: string) {
    try {
        const url = `${baseUrl}/moves?project_id=${projectId}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: MoveResult_V1_0[] = await raw_response.json();
        return response.map(r => {
            return {
                ...r,
                math: new Map(Object.entries(r.math))
            }
        });
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getMove(
    baseUrl: string | undefined,
    moveId: string,
    inputId: string | undefined) {
    try {
        let url = `${baseUrl}/moves/${moveId}`;
        if (inputId) {
            url += `?input_id=${inputId}`
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
        const response: MoveResult_V1_0 = await raw_response.json();
        return {
            ...response,
            math: new Map(Object.entries(response.math)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createMove(
    baseUrl: string | undefined,
    move: Move_V1_0) {
    try {
        const url = `${baseUrl}/moves`;
        const body = JSON.stringify({
            ...move,
            math: Object.fromEntries(move.math),
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

        const response: MoveResult_V1_0 = await raw_response.json();
        return {
            ...response,
            math: new Map(Object.entries(response.math)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateMove(
    baseUrl: string | undefined,
    moveId: string,
    move: Move_V1_0) {
    try {
        const body = JSON.stringify({
            ...move,
            math: Object.fromEntries(move.math),
        });
        const url = `${baseUrl}/moves/${moveId}`;
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

        const response: MoveResult_V1_0 = await raw_response.json();
        return {
            ...response,
            math: new Map(Object.entries(response.math)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function deleteMove(
    baseUrl: string | undefined,
    moveId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/moves/${moveId}`;
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

/* /frames */

interface Frame_V1_0 {
    x: number
    y: number
    s: number
    input_id: string
}
export async function getFrames(
    baseUrl: string | undefined,
    projectId: string,
    inputId: string,
    fps: number) {
    try {
        const url = `${baseUrl}/frames?project_id=${projectId}&input_id=${inputId}&fps=${fps}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: Frame_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
