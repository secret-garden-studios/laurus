'use client'
import { use, useEffect, useState } from "react";
import { VideoMediaResult_V1_0 } from "./screens.server";
import Screens from "./screens.client";
import { dellaRespira, italiana } from "../fonts";
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
                resolution.type != 'low' ?
                    <Screens
                        apiOrigin={apiOriginInit}
                        resolution={resolution}
                        videoMediaPromise={videoMediaPromise}
                        videoMediaPageSize={videoMediaPageSize}
                        me={me} />
                    :
                    <Forbidden resolution={resolution} /> :
                <Skeleton />
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

interface Forbidden { resolution: ScreensResolution }
function Forbidden({ resolution }: Forbidden) {
    return (<>
        <div
            className={`${styles["noisy-background"]} ${dellaRespira.className}`}
            style={{
                width: '100vw',
                height: '100vh',
                display: 'grid',
                placeContent: 'center',
                letterSpacing: '1px',
            }} >
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div className={`${italiana.className}`}
                    style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', padding: "10px 0px", textAlign: 'center' }}>
                    <p style={{ fontSize: 54 }}>{resolution.value.width > 0 ? resolution.value.width : '[undefined]'}</p>
                    <p style={{ fontSize: 38, padding: '0px 10px' }}>{'x'}</p>
                    <p style={{ fontSize: 54 }}>{resolution.value.height > 0 ? resolution.value.height : '[undefined]'}</p>
                    <p style={{ fontSize: 32, padding: '0px 16px' }}>{':('}</p>
                </div>
                <div style={{ fontSize: 18, justifySelf: 'center', padding: 4, marginTop: 10, textAlign: 'center' }}>
                    <div >{`Laurus is not designed for small screens.`}</div>
                </div>
            </div>
        </div>
    </>)
}
