'use client'

import Menubar from "../menubar";
import styles from "../app.module.css";
import YoutubePlayer from './youtube-player';
import { createVideo, deleteVideo, getVideoDiscoveryPage, getYouTubeEmbed, updateVideo, VideoMedia_V1_0, VideoMediaResult_V1_0 } from "./screens.server";
import { RefObject, use, useCallback, useEffect, useRef, useState } from "react";
import Statusbar from "./statusbar";
import RemoteControl from "./remote-control";
import { ScreensResolution } from "./screens-resolution";
import { MeDependencies } from "../page";
import { VideoOrigin, VideoOriginType, YouTubeVideoOrigin } from "./video-origin";
import { dellaRespira } from "../fonts";
import { bookmarkStacks, pause, SvgRepo } from "../svg-repo";

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
    | { type: 'reload', key: string, value: { newStart: number, newEnd: number, videoId: string } }
    | { type: 'getCurrentTime', key: string }
    | { type: 'startPollingCurrentTime', key: string }
    | { type: 'stopPollingCurrentTime', key: string }

interface Screens {
    apiOrigin: string | undefined,
    resolution: ScreensResolution,
    videoMediaPromise: Promise<VideoMediaResult_V1_0[]>,
    videoMediaPageSize: number,
    me: MeDependencies,
}
export default function Screens({ apiOrigin, resolution, videoMediaPromise, videoMediaPageSize, me }: Screens) {
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
    const containerRef = useRef<HTMLDivElement>(null);
    const lastScrollTop = useRef<number>(0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRefs = useRef<Map<string, any>>(new Map());
    const intervalRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const timeDisplayRefs = useRef<Map<string, HTMLDivElement | null>>(null);
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

    const lazyLoadTimeDisplayRef = () => {
        if (!timeDisplayRefs.current) {
            timeDisplayRefs.current = new Map();
        }
        return timeDisplayRefs.current;
    };

    const onTimeDisplayRef = (element: HTMLDivElement | null, refKey: string) => {
        const m = lazyLoadTimeDisplayRef();
        if (element) {
            m.set(refKey, element);
        }
        else {
            m.delete(refKey);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startPolling = (key: string, player: any) => {
        if (intervalRefs.current.has(key) || !timeDisplayRefs.current) return;
        const timeDisplayRef = timeDisplayRefs.current.get(key);
        const pollingRate = 30;
        const interval = setInterval(() => {
            if (player && typeof player.getCurrentTime === 'function' && timeDisplayRef) {
                const t = player.getCurrentTime();
                const time: number = Number(t) || 0;
                timeDisplayRef.innerHTML = time.toFixed(3);
            }
        }, pollingRate);
        intervalRefs.current.set(key, interval);
    };

    const stopPolling = (key: string) => {
        const interval = intervalRefs.current.get(key);
        if (interval) {
            clearInterval(interval);
            intervalRefs.current.delete(key);
        }
    };

    useEffect(() => {
        const activeIntervals = intervalRefs.current;
        return () => {
            activeIntervals.forEach((intervalId) => {
                clearInterval(intervalId);
            });
            activeIntervals.clear();
        };
    }, []);

    const youtubeController = (control: YouTubePlayerControl): number | undefined => {
        const playerRef = playerRefs.current.get(control.key);
        if (playerRef) {
            switch (control.type) {
                case 'unmute':
                    playerRef.unMute?.();
                    break;
                case 'mute':
                    playerRef.mute?.();
                    break;
                case "seekTo":
                    playerRef.seekTo?.(control.value);
                    break;
                case "play":
                    playerRef.playVideo?.();
                    startPolling(control.key, playerRef);
                    break;
                case "playPause":
                    if (typeof playerRef.getPlayerState === 'function') {
                        const state = playerRef.getPlayerState();
                        if (state === 1) {
                            playerRef.pauseVideo?.();
                            stopPolling(control.key);
                        } else {
                            playerRef.playVideo?.();
                            startPolling(control.key, playerRef);
                        }
                    }
                    break;
                case "fastForward":
                    if (typeof playerRef.getCurrentTime === 'function') {
                        playerRef.seekTo?.(playerRef.getCurrentTime() + 10);
                    }
                    break;
                case "rewind":
                    if (typeof playerRef.getCurrentTime === 'function') {
                        playerRef.seekTo?.(playerRef.getCurrentTime() - 10);
                    }
                    break;
                case "setVolume":
                    playerRef.setVolume?.(control.value);
                    break;
                case "reload":
                    playerRef.loadVideoById?.({
                        videoId: control.value.videoId,
                        startSeconds: control.value.newStart,
                        endSeconds: control.value.newEnd
                    });
                    break;
                case "getCurrentTime":
                    return playerRef.getCurrentTime?.();
                case "startPollingCurrentTime": {
                    startPolling(control.key, playerRef);
                    break;
                }
                case "stopPollingCurrentTime": {
                    stopPolling(control.key);
                    break;
                }
            }
        }
    };

    const pauseAll = () => {
        playerRefs.current.forEach((player, key) => {
            if (player && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
                stopPolling(key);
            }
        });

        setVideoMedia(prev => {
            const next = new Map(prev);
            next.forEach(value => {
                value.playing = false;
            });
            return next;
        });
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
                                media_key: videoId,
                                origin: videoOrigin.type,
                                title: ytMeta.title,
                                start: start,
                                end: -1,
                                duration: -1,
                                notes: "",
                                categories: [],
                            };
                            const created = await createVideo(apiOrigin, me.accessToken, newVideoMedia);
                            if (created) {
                                const newVideoResult: VideoMediaResult = {
                                    ...created,
                                    ...defaultStyle,
                                    muted: defaultMuted,
                                    playing: defaultPlaying,
                                }
                                const playerDataRefValues = Array.from(playerDataRefs.current.values());
                                const newVideoMediaArray = [newVideoResult, ...playerDataRefValues];
                                const newVideoMediaResults = new Map<string, VideoMediaResult>(newVideoMediaArray.map(v => [v.video_media_id, v]));
                                setVideoMedia(newVideoMediaResults)
                                playerDataRefs.current.set(newVideoResult.video_media_id, { ...newVideoResult });
                            }
                            else {
                                alert('You do not have permission to do that.');
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
    }, [apiOrigin, me.accessToken, defaultStyle, defaultMuted, defaultPlaying]);

    return (<>
        <div
            className={styles[`${resolution.type == 'high' ? 'noisy-background-16-2' : 'noisy-background-16-2-low-res'}`]}
            style={{
                width: "100vw",
                height: '100vh',
                display: 'grid',
                gridTemplateRows: 'min-content 1fr min-content'
            }}>
            <div style={{ gridRow: 1 }}>
                <Menubar resolution={resolution} me={me.me} />
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
                    <div style={{
                        justifySelf: 'start',
                        display: 'flex',
                        width: '100%',
                        gap: 10,
                        height: 40,
                    }}>
                        <div
                            className={dellaRespira.className}
                            style={{
                                width: 'min-content',
                                padding: '0px 10px',
                                height: '100%',
                                display: 'grid',
                                placeContent: 'center',
                                cursor: 'pointer',
                            }}>
                            <SvgRepo
                                svg={bookmarkStacks()}
                                scale={1} />
                        </div>
                        <input
                            id={`laurus-screens-statusbar-secret-input`}
                            className={dellaRespira.className}
                            placeholder="paste a video link here..."
                            style={{
                                textAlign: 'center',
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(10deg, rgb(16, 16, 16), rgb(23, 23, 23))',
                                color: "rgb(227, 227, 227)",
                                fontSize: 14,
                                borderRadius: 10,
                                border: 'none',
                            }}
                            type="text"
                            onPaste={handleVideoDrop} />
                        <div
                            onClick={pauseAll}
                            className={dellaRespira.className}
                            style={{
                                width: 'min-content',
                                padding: '0px 10px',
                                height: '100%',
                                display: 'grid',
                                placeContent: 'center',
                                cursor: 'pointer',
                            }}>
                            <SvgRepo
                                svg={pause()}
                                scale={1} />
                        </div>
                    </div>
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
                                    onRemoteControl={youtubeController}
                                    me={me} />
                                <div
                                    style={{
                                        paddingLeft: 10,
                                        height: `${media.height}px`,
                                    }}>
                                    <RemoteControl
                                        i={i}
                                        videoMedia={media}
                                        resolution={resolution}
                                        onTimeDisplayRef={onTimeDisplayRef}
                                        onNewClip={async function (newStart: number, newEnd: number) {
                                            const newMedia: VideoMediaResult = { ...media, start: newStart, end: newEnd };
                                            const updated = await updateVideo(apiOrigin, me.accessToken, key, { ...newMedia });
                                            if (updated) {
                                                const newVideoMedia = new Map(playerDataRefs.current);
                                                newVideoMedia.set(key, { ...newMedia });
                                                setVideoMedia(newVideoMedia);
                                                playerDataRefs.current.set(key, { ...newMedia });
                                                youtubeController({ type: 'reload', key: newMedia.video_media_id, value: { newStart, newEnd, videoId: newMedia.media_key } });
                                                youtubeController({ type: 'startPollingCurrentTime', key: newMedia.video_media_id });
                                            }
                                        }}
                                        onNewControl={youtubeController}
                                        onNewMute={(newMute) => {
                                            if (newMute) {
                                                youtubeController({ type: 'mute', key: media.video_media_id });
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
                                                youtubeController({ type: 'unmute', key: media.video_media_id });
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
                                        onNewNote={async (newNote) => {
                                            const snapshot: VideoMediaResult = { ...media }
                                            const newMedia: VideoMediaResult = { ...snapshot, notes: newNote };
                                            const updated = await updateVideo(apiOrigin, me.accessToken, key, { ...newMedia });
                                            if (!updated) {
                                                alert('Your note was not saved on the server because you do not have permission to edit it.');
                                            }
                                        }}
                                        onDeleteVideoMedia={async () => {
                                            const deleted = await deleteVideo(apiOrigin, me.accessToken, key);
                                            if (deleted) {
                                                const newVideoMedia = new Map(playerDataRefs.current);
                                                newVideoMedia.delete(key);
                                                setVideoMedia(newVideoMedia);
                                                playerDataRefs.current.delete(key);
                                                youtubeController({ type: 'stopPollingCurrentTime', key: media.video_media_id });
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
                    resolution={resolution} />
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
    me: MeDependencies,
}
function Screen({
    apiOrigin,
    playerRefs,
    playerDataRefs,
    videoMedia,
    onNewMedia,
    onRemoteControl,
    me }: Screen) {
    return (<>
        <YoutubePlayer
            playerRefs={playerRefs}
            videoId={videoMedia.media_key}
            videoMediaId={videoMedia.video_media_id}
            start={videoMedia.start}
            end={videoMedia.end}
            width={videoMedia.width}
            height={videoMedia.height}
            filter={videoMedia.filter}
            autoplay={true}
            muted={videoMedia.muted}
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onVideoEnded={(_videoId) => {
                const playerDataRef = playerDataRefs.current.get(videoMedia.video_media_id);
                if (!playerDataRef) return;
                onRemoteControl({ type: 'seekTo', key: videoMedia.video_media_id, value: playerDataRef.start });
                onRemoteControl({ type: 'play', key: videoMedia.video_media_id });
            }}
            onReady={async (newDuration) => {
                const playerDataRef = playerDataRefs.current.get(videoMedia.video_media_id);
                if (!playerDataRef) return;
                const newMedia: VideoMediaResult = {
                    ...playerDataRef,
                    duration: newDuration
                }
                onNewMedia(newMedia);
                onRemoteControl({ type: 'startPollingCurrentTime', key: videoMedia.video_media_id });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const updated = await updateVideo(apiOrigin, me.accessToken, newMedia.video_media_id, { ...newMedia });
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
