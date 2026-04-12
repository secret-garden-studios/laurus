'use client'
import { use, useEffect, useState } from "react";
import { VideoMediaResult_V1_0 } from "./screens.server";
import Screens from "./screens.client";
import { italiana } from "../fonts";
import styles from "../app.module.css";
import { getScreenResolution, ScreensResolution } from "./screens-resolution";
import { MeDependencies } from "../page";

interface ScreensBoot {
    apiOriginInit: string | undefined,
    videoMediaPromise: Promise<VideoMediaResult_V1_0[]>,
    videoMediaPageSize: number,
    mePromise: Promise<MeDependencies>
}
export default function ScreensBoot({ apiOriginInit, videoMediaPromise, videoMediaPageSize, mePromise }: ScreensBoot) {
    const me = use(mePromise);
    const [booted, setBooted] = useState(false);
    const [resolution, setResolution] = useState<ScreensResolution | undefined>(undefined);

    useEffect(() => {
        (() => {
            if (!resolution)
                setResolution(getScreenResolution())
        })();
    }, [resolution]);

    useEffect(() => {
        function boot() {
            setBooted(true);
        }
        function loadYouTubeAPI() {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = () => {
                boot();
            };
        }
        if (!window.YT) {
            loadYouTubeAPI();
        } else {
            boot();
        }
        return () => { };
    }, []);

    return (
        <>
            {booted && resolution !== undefined ?
                <Screens
                    apiOrigin={apiOriginInit}
                    resolution={resolution}
                    videoMediaPromise={videoMediaPromise}
                    videoMediaPageSize={videoMediaPageSize}
                    me={me} />
                : <Skeleton />
            }
        </>
    );
};

function Skeleton() {
    return (<>
        <div
            className={`${styles["noisy-background"]} ${italiana.className}`}
            style={{ cursor: 'progress', width: '100vw', height: '100vh' }} />
    </>)
}
