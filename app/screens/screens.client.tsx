'use client'

import Menubar from "../menubar";
import styles from "../app.module.css";
import YoutubePlayer from './youtube-player';
import { deleteVideo, getVideoDiscoveryPage, updateVideo, VideoMedia_V1_0, VideoMediaResult_V1_0 } from "./screens.server";
import { RefObject, use, useCallback, useRef, useState } from "react";
import Statusbar from "./statusbar";
import RemoteControl from "./remote-control";
import { ScreensResolution } from "./screens-resolution";

export interface VideoMediaResult extends VideoMediaResult_V1_0 {
    filter: string
    width: number
    height: number
    muted: boolean
    playing: boolean
}
export type VideoMedia = VideoMedia_V1_0;
export type YouTubePlayerControl =
    | { type: 'mute', key: string }
    | { type: 'unmute', key: string }
    | { type: 'seekTo', key: string, value: number }
    | { type: 'play', key: string }
    | { type: 'playPause', key: string }
    | { type: 'fastForward', key: string }
    | { type: 'rewind', key: string }
    | { type: 'setVolume', key: string, value: number }
    | { type: 'reload', key: string, value: { newStart: number, newEnd: number } }
    | { type: 'getCurrentTime', key: string }

interface Screens {
    apiOrigin: string | undefined,
    resolution: ScreensResolution,
    videoMediaPromise: Promise<VideoMediaResult_V1_0[]>,
    videoMediaPageSize: number,
}
export default function Screens({ apiOrigin, resolution, videoMediaPromise, videoMediaPageSize }: Screens) {
    const videoMediaInit = use(videoMediaPromise);
    const [defaultStyle] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                width: 788,
                height: 444,
                filter: ""
            }
            case "midhigh": return {
                width: 660,
                height: 371,
                filter: ""
            }
            case "midlow": return {
                width: 560,
                height: 315,
                filter: ""
            }
            case "low": return {
                width: 256,
                height: 256,
                filter: ""
            }
        }
    });
    const [defaultMuted] = useState<boolean>(true);
    const [defaultPlaying] = useState<boolean>(false);
    const [userPlacerholder, setUserPlaceholder] = useState("");

    const [videoMedia, setVideoMedia] = useState<Map<string, VideoMediaResult>>(
        () => new Map<string, VideoMediaResult>(videoMediaInit.map(v => {
            const newVideoMedia: VideoMediaResult = {
                ...v,
                ...defaultStyle,
                muted: defaultMuted,
                playing: defaultPlaying,
            }
            return [newVideoMedia.video_media_id, newVideoMedia];
        })));

    const containerRef = useRef<HTMLDivElement>(null);
    const lastScrollTop = useRef<number>(0);
    const playerDataRefs = useRef<Map<string, VideoMediaResult>>(
        new Map<string, VideoMediaResult>(videoMediaInit.map(v => {
            const newVideoMedia: VideoMediaResult = {
                ...v,
                ...defaultStyle,
                muted: defaultMuted,
                playing: defaultPlaying,
            }
            return [newVideoMedia.video_media_id, newVideoMedia];
        })));

    const [alertMsg] = useState("You need an account to do that! Send an email over to laurusim@gmail.com if you interested in getting early access to the platform.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRefs = useRef<Map<string, any>>(new Map());
    const youtubeController = (control: YouTubePlayerControl): number | undefined => {
        const playerRef = playerRefs.current.get(control.key);
        if (playerRef) {
            switch (control.type) {
                case 'unmute': {
                    if (typeof playerRef.unMute === 'function') {
                        playerRef.unMute();
                    }
                    break;
                }
                case 'mute': {
                    if (typeof playerRef.mute === 'function') {
                        playerRef.mute();
                    }
                    break;
                }
                case "seekTo": {
                    if (typeof playerRef.seekTo === 'function') {
                        playerRef.seekTo(control.value);
                    }
                    break;
                }
                case "play": {
                    if (typeof playerRef.playVideo === 'function') {
                        playerRef.playVideo();
                    }
                    break;
                }
                case "playPause": {
                    if (typeof playerRef.getPlayerState === 'function' &&
                        typeof playerRef.pauseVideo === 'function' &&
                        typeof playerRef.playVideo === 'function'
                    ) {
                        const state = playerRef.getPlayerState();
                        if (state === 1) {
                            playerRef.pauseVideo();
                        } else if (state === 2) {
                            playerRef.playVideo();
                        }
                    }
                    break;
                }
                case "fastForward": {
                    if (typeof playerRef.seekTo === 'function' &&
                        typeof playerRef.getCurrentTime === 'function') {
                        const currentTime = playerRef.getCurrentTime();
                        playerRef.seekTo(currentTime + 10);
                    }
                    break;
                }
                case "rewind": {
                    if (typeof playerRef.seekTo === 'function' &&
                        typeof playerRef.getCurrentTime === 'function') {
                        const currentTime = playerRef.getCurrentTime();
                        playerRef.seekTo(currentTime - 10);
                    }
                    break;
                }
                case "setVolume": {
                    if (typeof playerRef.setVolume === 'function') {
                        playerRef.setVolume(control.value);
                    }
                    break;
                }
                case "reload": {
                    if (typeof playerRef.loadVideoById === 'function') {
                        playerRef.loadVideoById({
                            videoId: control.key,
                            startSeconds: control.value.newStart,
                            endSeconds: control.value.newEnd
                        });
                    }
                    break;
                }
                case "getCurrentTime": {
                    if (typeof playerRef.getCurrentTime === 'function') {
                        return playerRef.getCurrentTime();
                    }
                    break;
                }
            }
        }
    };

    const fetchVideoPage = useCallback(async () => {
        const mediaArray = Array.from(videoMedia.values());
        const oldestObject = mediaArray.length > 0 ? mediaArray.reduce((oldest, current) => {
            return new Date(current.timestamp) < new Date(oldest.timestamp) ? current : oldest;
        }) : undefined;
        const response = await getVideoDiscoveryPage(apiOrigin, videoMediaPageSize, oldestObject?.video_media_id ?? "");
        if (response && response.length > 0) {
            const newVideoMedia = new Map(videoMedia);
            response.forEach(r => {
                const newVideo = {
                    ...r,
                    ...defaultStyle,
                    muted: defaultMuted,
                    playing: defaultPlaying,
                }
                playerDataRefs.current.set(newVideo.video_media_id, { ...newVideo });
                newVideoMedia.set(newVideo.video_media_id, { ...newVideo })
                return newVideo
            });
            setVideoMedia(newVideoMedia);
        }
    }, [apiOrigin, defaultMuted, defaultPlaying, defaultStyle, videoMedia, videoMediaPageSize]);

    const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isScrollingDown = scrollTop > lastScrollTop.current;
        lastScrollTop.current = scrollTop;
        if (!isScrollingDown) return;
        const isBottom = Math.abs(scrollHeight - (scrollTop + clientHeight)) <= 1;
        if (isBottom) {
            await fetchVideoPage();
        }
    }, [fetchVideoPage]);

    return (<>
        <div
            className={styles["grainy-background"]}
            style={{
                width: "100vw",
                height: '100vh',
                display: 'grid',
                gridTemplateRows: 'min-content 1fr min-content'
            }}>
            <div style={{ gridRow: 1 }}>
                <Menubar />
            </div>
            <div
                ref={containerRef}
                onScroll={handleScroll}
                style={{
                    overflowY: 'auto',
                    gridRow: 2,
                }}>
                <div style={{
                    display: 'grid',
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    gap: 10,
                    alignContent: 'start',
                    height: '100vh',
                }}>
                    {Array.from(videoMedia.entries())
                        .sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime())
                        .map((e, i) => {
                            const [key, media] = e;
                            return <div
                                key={media.video_media_id}
                                style={{
                                    height: 'min-content',
                                    display: 'grid',
                                    gridTemplateRows: `${media.height}px`,
                                    gridTemplateColumns: 'min-content auto',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                }}>
                                <Screen
                                    apiOrigin={apiOrigin}
                                    playerRefs={playerRefs}
                                    playerDataRefs={playerDataRefs}
                                    videoMedia={media}
                                    onNewMedia={(newMedia) => {
                                        const newVideoMedia = new Map(playerDataRefs.current);
                                        newVideoMedia.set(key, { ...newMedia });
                                        setVideoMedia(newVideoMedia);

                                        playerDataRefs.current.set(key, { ...newMedia });
                                    }}
                                    onRemoteControl={youtubeController} />
                                <div
                                    style={{
                                        paddingLeft: 10,
                                        height: `${media.height}px`,
                                    }}>
                                    <RemoteControl
                                        i={i}
                                        videoMedia={media}
                                        resolution={resolution}
                                        onNewClip={function (newStart: number, newEnd: number): void {
                                            const newMedia: VideoMediaResult = { ...media, start: newStart, end: newEnd };

                                            const newVideoMedia = new Map(playerDataRefs.current);
                                            newVideoMedia.set(key, { ...newMedia });
                                            setVideoMedia(newVideoMedia);

                                            playerDataRefs.current.set(key, { ...newMedia });

                                            updateVideo(apiOrigin, key, { ...newMedia });
                                        }}
                                        onNewControl={youtubeController}
                                        onNewMute={(newMute) => {
                                            if (newMute) {
                                                youtubeController({ type: 'mute', key: media.media_path });
                                                const newMedia: VideoMediaResult = {
                                                    ...media,
                                                    filter: ''
                                                }
                                                const newVideoMedia = new Map(playerDataRefs.current);
                                                newVideoMedia.set(key, { ...newMedia });
                                                setVideoMedia(newVideoMedia);

                                                playerDataRefs.current.set(key, { ...newMedia });
                                            }
                                            else {
                                                youtubeController({ type: 'unmute', key: media.media_path });
                                                const newMedia: VideoMediaResult = {
                                                    ...media,
                                                    filter: `none`
                                                }
                                                const newVideoMedia = new Map(playerDataRefs.current);
                                                newVideoMedia.set(key, { ...newMedia });
                                                setVideoMedia(newVideoMedia);

                                                playerDataRefs.current.set(key, { ...newMedia });
                                            }
                                        }}
                                        onRemoteControl={youtubeController}
                                        onNewNote={(newNote) => {
                                            if (!userPlacerholder) {
                                                alert(alertMsg);
                                            }
                                            else {
                                                const newMedia: VideoMediaResult = { ...media, notes: newNote };
                                                updateVideo(apiOrigin, key, { ...newMedia });
                                            }
                                        }}
                                        onDeleteVideoMedia={async () => {
                                            if (!userPlacerholder) {
                                                alert(alertMsg);
                                            }
                                            else {
                                                const response = await deleteVideo(apiOrigin, key);
                                                if (response) {
                                                    const newVideoMedia = new Map(playerDataRefs.current);
                                                    newVideoMedia.delete(key);
                                                    setVideoMedia(newVideoMedia);
                                                    playerDataRefs.current.delete(key);
                                                }
                                            }
                                        }} />
                                </div>
                            </div>
                        })}
                </div>
            </div>
            <div style={{ gridRow: 3 }}>
                <Statusbar
                    action={"laurus screens"}
                    onNewVideo={async (newVideo) => {
                        const videoMediaArray = Array.from(playerDataRefs.current.values());
                        const newVideoMediaArray = [newVideo, ...videoMediaArray];
                        const newVideoMedia = new Map<string, VideoMediaResult>(newVideoMediaArray.map(v => [v.video_media_id, v]));
                        setVideoMedia(newVideoMedia)
                        playerDataRefs.current.set(newVideo.video_media_id, { ...newVideo });
                    }}
                    apiOrigin={apiOrigin}
                    resolution={resolution}
                    defaultStyle={defaultStyle}
                    defaultMuted={defaultMuted}
                    defaultPlaying={defaultPlaying}
                    onNewAdmin={setUserPlaceholder} />
            </div>
        </div>
    </>)
}

interface Screen {
    apiOrigin: string | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playerRefs: RefObject<Map<string, any>>,
    playerDataRefs: RefObject<Map<string, VideoMediaResult>>,
    videoMedia: VideoMediaResult,
    onNewMedia: (newMedia: VideoMediaResult) => void,
    onRemoteControl: (control: YouTubePlayerControl) => number | undefined,
}
function Screen({
    apiOrigin,
    playerRefs,
    playerDataRefs,
    videoMedia,
    onNewMedia,
    onRemoteControl }: Screen) {
    return (<>
        <YoutubePlayer
            playerRefs={playerRefs}
            videoId={videoMedia.media_path}
            start={videoMedia.start}
            end={videoMedia.end}
            width={videoMedia.width}
            height={videoMedia.height}
            filter={videoMedia.filter}
            autoplay={true}
            muted={videoMedia.muted}
            onVideoEnded={(mediaPath) => {
                const vid = playerDataRefs.current.get(videoMedia.video_media_id);
                if (!vid) return;
                onRemoteControl({ type: 'seekTo', key: mediaPath, value: vid.start });
                onRemoteControl({ type: 'play', key: mediaPath });
            }}
            onReady={(newDuration) => {
                const vid = playerDataRefs.current.get(videoMedia.video_media_id);
                if (!vid) return;
                const newMedia: VideoMediaResult = {
                    ...vid,
                    duration: newDuration
                }
                onNewMedia(newMedia);
                updateVideo(apiOrigin, newMedia.video_media_id, { ...newMedia });
            }}
            onNewPlaying={(newPlaying) => {
                const vid = playerDataRefs.current.get(videoMedia.video_media_id);
                if (!vid) return;
                const newMedia: VideoMediaResult = {
                    ...vid,
                    playing: newPlaying
                }
                onNewMedia(newMedia);
            }} />
    </>)
}
