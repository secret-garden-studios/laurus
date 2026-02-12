export interface ImgMetadata_V1_0 {
    media_path: string
}
export interface ImgMetadataPage_V1_0 {
    page_size: number
    page_number: number
    value: ImgMetadata_V1_0[]
}
export async function enumerateImgs(
    pageSize: number,
    top: number | undefined,
    pageCount: number | undefined) {
    try {
        let url = `${process.env.NEXT_PUBLIC_LAURUS_API}/media/img?page_size=${pageSize}`;
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
    catch (e) {
        console.log({ e });
        return undefined;
    }
}
/**
 * metadata + absolute positioning
 */
export interface ProjectImg_V1_0 {
    key: string,
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
export async function getImg(filename: string) {
    try {
        const url = `${process.env.NEXT_PUBLIC_LAURUS_API}/media/img/${filename}`;
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
export async function getFirstImg(media: Promise<ImgMetadataPage_V1_0[] | undefined>) {
    const page: ImgMetadataPage_V1_0[] | undefined = await media;
    if (page && page.length > 0 && page[0].value.length > 0) {
        const filename = page[0].value[0].media_path;
        return await getImg(filename);
    }
    return undefined;
}
export async function getImgsByPage(page: ImgMetadataPage_V1_0) {
    const newEncodings: EncodedImg_V1_0[] = [];
    for (let i = 0; i < page.value.length; i++) {
        const m: ImgMetadata_V1_0 = page.value[i];
        const encoding: EncodedImg_V1_0 | undefined = await getImg(m.media_path);
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
    pageSize: number,
    top: number | undefined,
    pageCount: number | undefined) {
    try {
        let url = `${process.env.NEXT_PUBLIC_LAURUS_API}/media/svg?page_size=${pageSize}`;
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
    key: string,
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
export async function getSvg(filename: string) {
    try {
        const url = `${process.env.NEXT_PUBLIC_LAURUS_API}/media/svg/${filename}`;
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
export async function getSvgsByPage(page: SvgMetadataPage_V1_0) {
    const newEncodings: EncodedSvg_V1_0[] = [];
    for (let i = 0; i < page.value.length; i++) {
        const m: SvgMetadata_V1_0 = page.value[i];
        const encoding: EncodedSvg_V1_0 | undefined = await getSvg(m.media_path);
        if (encoding) {
            newEncodings.push({ ...encoding });
        }
    }
    return newEncodings;
};

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
}
export async function getProjects() {
    try {
        const url = `${process.env.NEXT_PUBLIC_LAURUS_API}/projects`;
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
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getProject(projectId: string) {
    try {
        const url = `${process.env.NEXT_PUBLIC_LAURUS_API}/projects/${projectId}`;
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
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createProject(project: Project_V1_0) {
    try {
        const url = `${process.env.NEXT_PUBLIC_LAURUS_API}/projects`;
        const body = JSON.stringify({ ...project });
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
        return response;
    }
    catch (error) {
        console.log({ e: error });
        return undefined;
    }
}
export async function updateProject(projectId: string, project: Project_V1_0) {
    try {
        const body = JSON.stringify({ ...project });
        const url = `${process.env.NEXT_PUBLIC_LAURUS_API}/projects/${projectId}`;
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
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function deleteProject(projectId: string): Promise<boolean> {
    try {
        const url = `${process.env.NEXT_PUBLIC_LAURUS_API}/projects/${projectId}`;
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