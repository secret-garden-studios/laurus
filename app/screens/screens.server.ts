import { authFetch, FORBIDDEN_NAV, UNAUTHORIZED_EDIT } from "../landing.server";
const onNotOk = (status: number) => {
    switch (status) {
        case 401: { console.log(UNAUTHORIZED_EDIT); return; }
        case 403: { console.log(FORBIDDEN_NAV); return; }
    }
}
export interface VideoMedia_V1_0 {
    media_key: string
    origin: string
    title: string
    start: number
    end: number
    duration: number
    notes: string
    categories: string[]
}
export interface VideoMediaResult_V1_0 {
    timestamp: string
    last_active: string
    creator: string
    last_editor: string
    video_media_id: string
    media_key: string
    origin: string
    title: string
    start: number
    end: number
    duration: number
    notes: string
    categories: string[]
}
export async function getVideoDiscoveryPage(
    baseUrl: string | undefined,
    size: number = 10,
    offset?: string) {
    try {
        let url = `${baseUrl}/discover/video?size=${size}`;
        if (offset) {
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
        const response: VideoMediaResult_V1_0[] = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function getVideo(
    baseUrl: string | undefined,
    videoMediaId: string) {
    try {
        const url = `${baseUrl}/media/video/${videoMediaId}`;
        const raw_response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!raw_response.ok) {
            return undefined;
        }
        const response: VideoMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function createVideo(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    videoMedia: VideoMedia_V1_0) {
    try {
        const url = `${baseUrl}/media/video`;
        const body = JSON.stringify(videoMedia);
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
        const result: VideoMediaResult_V1_0 = await response.json();
        return result;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateVideo(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    videoMediaId: string,
    videoMedia: VideoMedia_V1_0): Promise<boolean> {
    try {
        const body = JSON.stringify(videoMedia);
        const url = `${baseUrl}/media/video/${videoMediaId}`;
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
        const result: VideoMediaResult_V1_0 = await response.json();
        return true;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}
export async function deleteVideo(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    videoMediaId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/media/video/${videoMediaId}`;
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

interface YouTubeOEmbedResult {
    title: string
    author_name: string
    author_url: string
    type: "video"
    height: number
    width: number
    version: string
    provider_name: "YouTube"
    provider_url: string
    thumbnail_height: number
    thumbnail_width: number
    thumbnail_url: string
    html: string
}
export async function getYouTubeEmbed(videoUrl: string) {
    const oEmbedBase = "https://www.youtube.com/oembed";
    const params = new URLSearchParams({
        url: videoUrl,
        format: "json"
    });

    try {
        const raw_response = await fetch(`${oEmbedBase}?${params.toString()}`);
        if (!raw_response.ok) return undefined;
        const response: YouTubeOEmbedResult = await raw_response.json();
        return response;
    } catch (error) {
        console.log({ error });
        return undefined;
    }
}
