'use client'
import { useEffect, useState } from "react";
import { VideoMediaResult_V1_0 } from "./screens.server";
import Screens from "./screens.client";
import { italiana } from "../fonts";
import styles from "../app.module.css";

interface TestCard {
    apiOriginInit: string | undefined,
    videoMediaPromise: Promise<VideoMediaResult_V1_0[]>,
    videoMediaPageSize: number,
}
export default function TestCard({ apiOriginInit, videoMediaPromise, videoMediaPageSize }: TestCard) {
    const [booted, setBooted] = useState(false);

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
        };

        if (!window.YT) {
            loadYouTubeAPI();
        } else {
            boot();
        }

        return () => { };
    }, []);

    return (
        <>
            {booted ?
                <Screens
                    apiOrigin={apiOriginInit}
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