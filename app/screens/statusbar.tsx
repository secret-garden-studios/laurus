'use client'

import { useCallback, useState } from "react";
import { dellaRespira } from "../fonts";
import { VideoMedia, VideoMediaResult } from "./screens.client";
import { getYouTubeEmbed, createVideo } from "./screens.server";
import { VideoOrigin, VideoOriginType, YouTubeVideoOrigin } from "./video-origin";
import { ScreensResolution } from "./screens-resolution";

export interface Statusbar {
    action: string,
    apiOrigin: string | undefined,
    resolution: ScreensResolution,
    defaultStyle: { width: number, height: number, filter: string },
    defaultMuted: boolean,
    defaultPlaying: boolean,
    onNewVideo: (newVideo: VideoMediaResult) => void,
    onNewAdmin: (key: string) => void,
}
export default function Statusbar({
    action,
    apiOrigin,
    resolution,
    defaultStyle,
    defaultMuted,
    defaultPlaying,
    onNewVideo,
    onNewAdmin }: Statusbar) {

    const [statusbarSize] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                height: 30,
                fontSize: 9,
                inputFontSize: 10,
                padding: "0px 12px",
                gap: 10
            }
            case "midhigh": return {
                height: 24,
                fontSize: 8,
                inputFontSize: 9,
                padding: "0px 12px",
                gap: 10
            }
            case "midlow":
            case "low": return {
                height: 20,
                fontSize: 7,
                inputFontSize: 8,
                padding: "0px 12px",
                gap: 10
            }
        }
    });

    const handleVideoDrop = useCallback(async (event: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = event.clipboardData.getData('text/plain');
        const videoOrigins = VideoOrigin.parse(pastedText);
        if (videoOrigins) {
            for (let i = 0; i < videoOrigins.length; i++) {
                const videoOrigin = videoOrigins[i];
                switch (videoOrigin.type) {
                    case (VideoOriginType.YouTube): {
                        const [videoId, start] = (videoOrigin as YouTubeVideoOrigin).parseParams();
                        const ytMeta = await getYouTubeEmbed(videoOrigin.rawData)
                        if (videoId && ytMeta) {
                            const newVideoMedia: VideoMedia = {
                                media_path: videoId,
                                origin: videoOrigin.type,
                                title: ytMeta.title,
                                start: start,
                                end: -1,
                                duration: -1,
                                notes: "",
                                categories: [],
                            };
                            const response = await createVideo(apiOrigin, newVideoMedia);
                            if (response) {
                                const newVideoMedia: VideoMediaResult = {
                                    ...response,
                                    ...defaultStyle,
                                    muted: defaultMuted,
                                    playing: defaultPlaying,
                                }
                                onNewVideo(newVideoMedia);
                            }
                        }
                        break;
                    }
                    case (VideoOriginType.YouTubeMusic):
                    case (VideoOriginType.Unknown): {
                        break;
                    }
                }
            }
        }
    }, [apiOrigin, defaultMuted, defaultStyle, defaultPlaying, onNewVideo]);

    const handleNewAdmin = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = event.clipboardData.getData('text/plain');
        onNewAdmin(pastedText);
    }, [onNewAdmin]);

    return (
        <>
            <div style={{
                height: statusbarSize.height,
                width: "100%",
                display: "flex",
                alignItems: "center",
                left: "0",
                bottom: "0",
                backgroundColor: "#121212ff",
                overflow: "hidden",
                whiteSpace: "nowrap",
                padding: statusbarSize.padding,
                gap: statusbarSize.gap
            }}>
                <div style={{
                    fontFamily: "monospace",
                    fontWeight: "bolder",
                    fontSize: statusbarSize.fontSize,
                }}>
                    {action}
                </div>
                <input
                    id={`laurus-screens-statusbar-secret-input`}
                    className={dellaRespira.className}
                    style={{
                        width: '50%',
                        height: '100%',
                        background: 'none',
                        color: "rgb(227, 227, 227)",
                        fontSize: statusbarSize.inputFontSize,
                        border: 'none',
                        outline: 'none',
                    }}
                    type="text"
                    onPaste={handleVideoDrop}
                />
                <input
                    id={`laurus-screens-statusbar-secret-login`}
                    className={dellaRespira.className}
                    style={{
                        textAlign: 'right',
                        width: '50%',
                        height: '100%',
                        background: 'none',
                        color: "rgb(227, 227, 227)",
                        fontSize: statusbarSize.inputFontSize,
                        border: 'none',
                        outline: 'none',
                    }}
                    type="text"
                    onPaste={handleNewAdmin}
                />
                <div style={{
                    marginLeft: "auto",
                    fontFamily: "monospace",
                    fontWeight: "normal",
                    fontSize: statusbarSize.fontSize,
                }}>
                    {`${resolution.value.width}x${resolution.value.height}`}
                </div>
            </div>
        </>
    );
}
