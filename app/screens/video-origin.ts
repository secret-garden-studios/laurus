
export enum VideoOriginType {
    Unknown = "unknown",
    YouTube = "youtube",
    YouTubeMusic = "youtube_music",
}

const typeMap: { [key: string]: VideoOriginType } = {
    "unknown": VideoOriginType.Unknown,
    "UNKNOWN": VideoOriginType.Unknown,
    "youtu.be": VideoOriginType.YouTube,
    "www.youtube.com": VideoOriginType.YouTube,
    "music.youtube.com": VideoOriginType.YouTubeMusic,
}

interface VideoOriginInterface {
    type: string,
}

const record: Record<VideoOriginType, VideoOriginInterface> = {
    [VideoOriginType.Unknown]: {
        type: VideoOriginType.Unknown.toString(),
    },
    [VideoOriginType.YouTube]: {
        type: VideoOriginType.YouTube.toString(),
    },
    [VideoOriginType.YouTubeMusic]: {
        type: VideoOriginType.YouTubeMusic.toString(),
    },
}

export class VideoOrigin implements VideoOriginInterface {
    type: string;
    rawData: string;
    private _url: URL | undefined;

    constructor(rawData: string, url?: URL) {
        this.rawData = rawData;
        if (url) {
            this._url = url;
        }
        else {
            this._url = this.tryParseUrl();
        }
        const hostname = this.getSafeHostname();
        const safeType = typeMap[hostname] ? typeMap[hostname] : VideoOriginType.Unknown;

        this.type = record[safeType].type;
    }

    getUrl(): URL | undefined {
        return this._url;
    }

    static parse(rawData: string): VideoOrigin[] | undefined {
        const videoOrigin = new VideoOrigin(rawData);
        switch (videoOrigin.type) {
            case (VideoOriginType.YouTube):
                const youtubeUrl = videoOrigin._url;
                if (youtubeUrl) {
                    return [new YouTubeVideoOrigin(videoOrigin.rawData, videoOrigin._url)];
                }
                else {
                    return undefined;
                }
            default:
                return [videoOrigin];
        }
    }

    private tryParseUrl(): URL | undefined {
        try {
            const url = new URL(this.rawData);
            return url;
        } catch {
            return undefined;
        }
    }

    private getSafeHostname(): string {
        if (this._url) {
            return this._url.hostname;
        }
        else {
            return "unknown";
        }
    }
}

interface YouTubeOriginInterface extends VideoOriginInterface {
    parseParams(youtubeUrl: URL): [string | undefined, number]
}

export class YouTubeVideoOrigin extends VideoOrigin implements YouTubeOriginInterface {

    constructor(rawData: string, url?: URL) {
        super(rawData, url);
    }

    parseParams(): [string | undefined, number] {
        let start = 0;
        let videoId: string | undefined = undefined;
        const youtubeUrl = this.getUrl();
        if (youtubeUrl) {
            const tSearch = youtubeUrl.searchParams.get("t");
            if (tSearch) {
                start = parseInt(tSearch);
            }
            if (youtubeUrl.hostname == "youtu.be") {
                videoId = youtubeUrl.pathname.replace("/", "");
            }
            else {
                const vSearch = youtubeUrl.searchParams.get("v");
                if (vSearch) {
                    videoId = vSearch;
                }
            }
        }
        return [videoId, start];
    }
}
