import { Suspense } from "react";
import Workspace from "./workspace.client";
import { getEffects, getProjects } from "./workspace.server";
import styles from "../app.module.css";
export const dynamic = 'force-dynamic';

export default function Page() {
    const projects = getProjects(process.env.LAURUS_API);
    const effectsEnum = getEffects(process.env.LAURUS_API);
    const mediaPreloadLimit = process.env.MEDIA_PRELOAD_LIMIT;
    return (
        <Suspense fallback={<Skeleton />}>
            <Workspace
                apiOrigin={process.env.LAURUS_API}
                mediaPreloadLimit={mediaPreloadLimit}
                projectsInit={projects}
                effectsEnum={effectsEnum}
            />
        </Suspense>
    );
}

function Skeleton() {
    return (<>
        <div
            className={styles['grainy-background']}
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }
            }>
        </div>
    </>)
}