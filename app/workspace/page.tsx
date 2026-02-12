import { Suspense } from "react";
import Workspace from "./workspace.client";
import { enumerateImgs, enumerateSvgs, getProjects } from "./workspace.server";
import { geistSansLite } from "../fonts";

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
            className={geistSansLite.className}
            style={{
                fontSize: 11,
                letterSpacing: 3,
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