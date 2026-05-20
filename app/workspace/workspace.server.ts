import { authFetch, FORBIDDEN_ACTION, UNAUTHORIZED_EDIT } from "../landing.server";

const onNotOk = (status: number) => {
    switch (status) {
        case 401: { alert(UNAUTHORIZED_EDIT); return; }
        case 403: { alert(FORBIDDEN_ACTION); return; }
    }
}

/* /discover */

export async function getImgDiscoveryPage(
    baseUrl: string | undefined,
    size: number = 10,
    exclusion?: string[],
    offset?: string) {
    try {
        let url = `${baseUrl}/discover/img?&size=${size}`;
        if (exclusion) {
            exclusion.forEach(e => {
                url += `&x=${e}`
            });
        }
        else if (offset) {
            url += `&offset=${offset}`
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
        const response: ImgMediaResult_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getSvgDiscoveryPage(
    baseUrl: string | undefined,
    size: number = 10,
    exclusion?: string[],
    offset?: string) {
    try {
        let url = `${baseUrl}/discover/svg?&size=${size}`;
        if (exclusion) {
            exclusion.forEach(e => {
                url += `&x=${e}`
            });
        }
        else if (offset) {
            url += `&offset=${offset}`
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
        const response: SvgMediaResult_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}

/* /media */

export interface ImgMedia_V1_0 {
    media_uri: string
    media_key: string
    width: number
    height: number
    categories: string[]
}
export interface ImgMediaResult_V1_0 {
    timestamp: string
    last_active: string
    img_media_id: string
    media_uri: string
    media_key: string
    order: number
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

export interface SvgMedia_V1_0 {
    media_uri: string
    media_key: string
    width: number
    height: number
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
    categories: string[]
}
export interface SvgMediaResult_V1_0 {
    timestamp: string
    last_active: string
    svg_media_id: string
    media_uri: string
    media_key: string
    width: number
    height: number
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
    order: number
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
        const response: SvgMediaResult_V1_0 = await raw_response.json();
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

/* /effects */

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

export enum LaurusLoopType {
    none = 'none',
    loop = 'loop',
    loop_infinite = 'loop_infinite',
    loop_reverse_infinite = 'loop_reverse_infinite',
    loop_reverse = 'loop_reverse'
}

export enum LaurusShapeType {
    wave = 'wave',
    circle = 'circle',
    ellipse = 'ellipse',
}

/* /scales */

export interface ScaleSolution_V1_0 {
    x: number
    y: number
}
export interface ScaleEquation_V1_0 {
    input_id: string
    /**
     * ms
     */
    time: number
    scale_x: number
    scale_y: number
    loop: LaurusLoopType
    solution: ScaleSolution_V1_0[]
    limit_factor: number
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
    locked: boolean
    description: string
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
    locked: boolean
    description: string
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
    accessToken: string | undefined,
    scale: Scale_V1_0) {
    try {
        const url = `${baseUrl}/scales`;
        const body = JSON.stringify({
            ...scale,
            math: Object.fromEntries(scale.math),
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

        const result: ScaleResult_V1_0 = await response.json();
        return {
            ...result,
            math: new Map(Object.entries(result.math)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateScale(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    scaleId: string,
    scale: Scale_V1_0): Promise<boolean> {
    try {
        const body = JSON.stringify({
            ...scale,
            math: Object.fromEntries(scale.math),
        });
        const url = `${baseUrl}/scales/${scaleId}`;
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
        const result: ScaleResult_V1_0 = await response.json();
        return true;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}
export async function deleteScale(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    scaleId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/scales/${scaleId}`;
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
        }
        return response.ok;
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
    loop: LaurusLoopType
    shape: LaurusShapeType
    solution: { x: number, y: number }[]
    limit_factor: number
}
export interface Move_V1_0 {
    start: number
    end: number
    project_id: string
    layer_id: string
    order: number
    fps: number
    locked: boolean
    description: string
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
    locked: boolean
    description: string
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
    accessToken: string | undefined,
    move: Move_V1_0) {
    try {
        const url = `${baseUrl}/moves`;
        const body = JSON.stringify({
            ...move,
            math: Object.fromEntries(move.math),
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

        const result: MoveResult_V1_0 = await response.json();
        return {
            ...result,
            math: new Map(Object.entries(result.math)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateMove(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    moveId: string,
    move: Move_V1_0): Promise<boolean> {
    try {
        const body = JSON.stringify({
            ...move,
            math: Object.fromEntries(move.math),
        });
        const url = `${baseUrl}/moves/${moveId}`;
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
        const result: MoveResult_V1_0 = await response.json();
        return true;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}

export async function deleteMove(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    moveId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/moves/${moveId}`;
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
        }
        return response.ok;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}

/* /rotates */

export interface RotateEquation_V1_0 {
    input_id: string
    x: number
    y: number
    z: number
    angle: number
    time: number
    loop: LaurusLoopType
    solution: { x: number, y: number, z: number, angle: number }[]
    limit_factor: number
}
export interface Rotate_V1_0 {
    start: number
    end: number
    project_id: string
    layer_id: string
    order: number
    fps: number
    locked: boolean
    description: string
    math: Map<string, RotateEquation_V1_0>
}
export interface RotateResult_V1_0 {
    timestamp: string
    last_active: string
    rotate_id: string
    start: number
    end: number
    project_id: string
    layer_id: string
    order: number
    fps: number
    locked: boolean
    description: string
    math: Map<string, RotateEquation_V1_0>
}
export async function getRotates(baseUrl: string | undefined, projectId: string) {
    try {
        const url = `${baseUrl}/rotates?project_id=${projectId}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: RotateResult_V1_0[] = await raw_response.json();
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
export async function getRotate(
    baseUrl: string | undefined,
    rotateId: string,
    inputId: string | undefined) {
    try {
        let url = `${baseUrl}/rotates/${rotateId}`;
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
        const response: RotateResult_V1_0 = await raw_response.json();
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
export async function createRotate(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    rotate: Rotate_V1_0) {
    try {
        const url = `${baseUrl}/rotates`;
        const body = JSON.stringify({
            ...rotate,
            math: Object.fromEntries(rotate.math),
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

        const result: RotateResult_V1_0 = await response.json();
        return {
            ...result,
            math: new Map(Object.entries(result.math)),
        };
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateRotate(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    rotateId: string,
    rotate: Rotate_V1_0): Promise<boolean> {
    try {
        const body = JSON.stringify({
            ...rotate,
            math: Object.fromEntries(rotate.math),
        });
        const url = `${baseUrl}/rotates/${rotateId}`;
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
        const result: RotateResult_V1_0 = await response.json();
        return true;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}
export async function deleteRotate(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    rotateId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/rotates/${rotateId}`;
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
        }
        return response.ok;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}

/* /frames */
export type LaurusFrame = Frame_V1_0;
interface Frame_V1_0 {
    x: number
    y: number
    sx: number
    sy: number
    rx: number
    ry: number
    rz: number
    rangle: number
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
