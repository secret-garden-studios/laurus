import { Suspense } from "react";
import Workspace from "./workspace.client";
import { getProjects } from "./workspace.server";
import styles from "../app.module.css"

export default function Page() {
    const projects = getProjects();

    return (
        <Suspense fallback={<Skeleton />}>
            <Workspace
                projectsInit={projects}
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