import { Suspense } from "react";
import Workspace from "./workspace.client";
import { enumerateImgs, enumerateSvgs, getProjects } from "./workspace.server";
import { geistSansLite, italiana } from "../fonts";
import styles from "../app.module.css"

export default function Page() {
    const mediaBrowserPageSize = 5;
    const preloadLimit = mediaBrowserPageSize * 1;
    const projects = getProjects();
    const imgMetas = enumerateImgs(mediaBrowserPageSize, preloadLimit, undefined);
    const svgMetas = enumerateSvgs(mediaBrowserPageSize, 0, undefined);

    return (
        <Suspense fallback={<Skeleton />}>
            <Workspace
                projectsInit={projects}
                imgsInit={imgMetas}
                svgsInit={svgMetas}
                mediaBrowserPageSize={mediaBrowserPageSize}
            />
        </Suspense>
    );
}

function Skeleton() {
    return (<>
        <div
            className={italiana.className + ' ' + styles['grainy-background']}
            style={{
                color: 'rgb(255, 255, 255)',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                fontSize: 12,
                letterSpacing: 11,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }
            }>
            {"loading..."}
        </div>
    </>)
}