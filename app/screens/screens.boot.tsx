'use client'
import { useEffect, useState } from "react";
import { VideoMediaResult_V1_0 } from "./screens.server";
import Screens from "./screens.client";
import { italiana } from "../fonts";
import styles from "../app.module.css";
import { getScreenResolution, ScreensResolution } from "./screens-resolution";
import { LaurusUserResult } from "../landing.server";

interface ScreensBoot {
    apiOriginInit: string | undefined,
    accessTokenInit: string | undefined,
    videoMediaPromise: Promise<VideoMediaResult_V1_0[]>,
    videoMediaPageSize: number,
    me: Promise<LaurusUserResult | undefined> | undefined
}
export default function ScreensBoot({ apiOriginInit, accessTokenInit, videoMediaPromise, videoMediaPageSize, me }: ScreensBoot) {
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
                    accessToken={accessTokenInit}
                    resolution={resolution}
                    videoMediaPromise={videoMediaPromise}
                    videoMediaPageSize={videoMediaPageSize}
                    mePromise={me} />
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
