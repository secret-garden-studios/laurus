
export interface VideoMedia_V1_0 {
    media_path: string
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
    video_media_id: string
    media_path: string
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
        if(offset) {
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
export async function findVideo(
    baseUrl: string | undefined,
    mediaPath: string) {
    try {
        const url = `${baseUrl}/media/video?media_path=${mediaPath}`;
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
    videoMedia: VideoMedia_V1_0) {
    const url = `${baseUrl}/media/video`;
    try {
        const body = JSON.stringify(videoMedia);
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
        const response: VideoMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function updateVideo(
    baseUrl: string | undefined,
    videoMediaId: string,
    videoMedia: VideoMedia_V1_0) {
    try {
        const body = JSON.stringify(videoMedia);
        const url = `${baseUrl}/media/video/${videoMediaId}`;
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
        const response: VideoMediaResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function deleteVideo(
    baseUrl: string | undefined,
    videoMediaId: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/media/video/${videoMediaId}`;
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
