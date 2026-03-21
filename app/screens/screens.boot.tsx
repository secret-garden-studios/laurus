'use client'
import { useEffect, useLayoutEffect, useState } from "react";
import { VideoMediaResult_V1_0 } from "./screens.server";
import Screens from "./screens.client";
import { italiana } from "../fonts";
import styles from "../app.module.css";
import { getScreenResolution, ScreensResolution } from "./screens-resolution";

interface ScreensBoot {
    apiOriginInit: string | undefined,
    videoMediaPromise: Promise<VideoMediaResult_V1_0[]>,
    videoMediaPageSize: number,
}
export default function ScreensBoot({ apiOriginInit, videoMediaPromise, videoMediaPageSize }: ScreensBoot) {
    const [booted, setBooted] = useState(false);
    const [resolution, setResolution] = useState<ScreensResolution | undefined>(undefined);

    useLayoutEffect(() => {
        (() => {
            if (!resolution)
                setResolution(getScreenResolution())
        })();
    });

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
            {booted && resolution ?
                <Screens
                    apiOrigin={apiOriginInit}
                    resolution={resolution}
                    videoMediaPromise={videoMediaPromise}
                    videoMediaPageSize={videoMediaPageSize} />
                : <Skeleton />
            }
        </>
    );
};

function Skeleton() {
    return (<>
        <div
            className={`${styles["animated-grainy-background"]} ${italiana.className}`}
            style={{ width: '100vw', height: '100vh' }} />
    </>)
}
