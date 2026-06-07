import { useContext, useState, useRef, useEffect } from "react";
import styles from "../../app.module.css";
import { dellaRespira } from "../../fonts";
import useDebounce from "../../hooks/useDebounce";
import { WorkspaceActionType, WorkspaceContext } from "../workspace.client";
import { updateProject, createProject } from "../../projects/projects.server";
import { LaurusProjectResult } from "../../projects/projects.client";
import Mixbar from "./mixbar";
import Rotatebar from "./rotatebar";
import Scalebar from "./scalebar";
import Marqueebar from "./marqueebar";
import Viewportbar from "./viewportbar";

export default function Projectbar() {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [projectName, setProjectName] = useState<string>(appState.project.name);
    const [projectNameSnapshot] = useState<string>(appState.project.name);
    const projectNameHook = useDebounce<string>(projectName, 1000);
    const projectRef = useRef<LaurusProjectResult | undefined>(undefined);
    const projectTitleRef = useRef<HTMLInputElement>(null);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                input: {
                    fontSize: 14,
                    padding: 4,
                    letterSpacing: 1,
                }
            }
            case "midhigh": return {
                input: {
                    fontSize: 11,
                    padding: 4,
                    letterSpacing: 1,
                }
            }
            case "low":
            case "midlow": return {
                input: {
                    fontSize: 11,
                    padding: 4,
                    letterSpacing: 1,
                }
            }
        }
    });

    useEffect(() => {
        const renameProjectOnSever = (async () => {
            if (projectRef.current && projectRef.current.project_id &&
                projectRef.current.name && projectNameHook) {
                const newProject = { ...projectRef.current, name: projectNameHook }
                const updated = await updateProject(
                    appState.apiOrigin,
                    appState.accessToken,
                    newProject.project_id,
                    newProject);
                if (updated) {
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                }
                else {
                    if (projectTitleRef.current) {
                        projectTitleRef.current.value = projectNameSnapshot;
                    }
                }
            }
            else if (projectRef.current && projectRef.current.name && projectNameHook) {
                const newProject = { ...projectRef.current, name: projectNameHook };
                const created = await createProject(
                    appState.apiOrigin,
                    appState.accessToken,
                    newProject);
                if (created) {
                    const newProject2: LaurusProjectResult = { ...created }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                }
                else {
                    if (projectTitleRef.current) {
                        projectTitleRef.current.value = projectNameSnapshot;
                    }
                }
            }
        });

        renameProjectOnSever();
    }, [appState.apiOrigin, projectNameHook, dispatch, appState.accessToken, projectNameSnapshot]);

    const onProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        projectRef.current = { ...appState.project, name: e.target.value };
        setProjectName(e.target.value);
    };

    return (<>
        <div
            className={styles[`${appState.resolution.type == 'high' ? 'noisy-background-16-2' : 'noisy-background-16-2-low-res'}`]}
            style={{
                width: "100%",
                display: "grid",
                gridTemplateRows: 'min-content',
                gridTemplateColumns: '1fr',
                placeContent: 'start',
                overflowX: 'auto',
                overflowY: 'hidden',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                padding: 6,
            }}>
            <div
                style={{
                    width: '100%',
                    display: 'flex',
                    placeItems: 'center',
                    height: '100%',
                    padding: 0,
                }}>
                <div style={{
                    width: "100%",
                    padding: 0,
                }}>
                    <input
                        ref={projectTitleRef}
                        id={`project-name-input-${appState.project.project_id}`}
                        className={dellaRespira.className}
                        placeholder="name me..."
                        style={{
                            fontWeight: 'bold',
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'none',
                            color: "rgb(242, 242, 242)",
                            textAlign: 'center',
                            border: 'none',
                            outline: 'none',
                            ...dynamicSizes.input
                        }}
                        type="text"
                        value={projectName}
                        onChange={onProjectNameChange}
                    />
                </div>
            </div>
        </div>
    </>)
}

export function ProjectbarLevel2() {
    const { appState } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                container: {
                    height: 50,
                    fontSize: 14,
                    padding: '0px 18px',
                    letterSpacing: 0,
                },
            }
            case "midhigh": return {
                container: {
                    height: 40,
                    fontSize: 11,
                    padding: '0px 13px 0px 10px',
                    letterSpacing: 0,
                },
            }
            case "low":
            case "midlow": return {
                container: {
                    height: 38,
                    fontSize: 11,
                    padding: '0px 13px 0px 10px',
                    letterSpacing: 0,
                },
            }
        }
    });
    return (<>
        <div
            style={{
                background: "linear-gradient(10deg, rgb(23, 23, 23), rgb(15,15,15))",
                display: "flex",
                alignItems: "center",
                color: 'rgb(227, 227, 227)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                ...dynamicSizes.container
            }}>
            {(() => {
                switch (appState.tool.type) {
                    case "marquee": return <Marqueebar />
                    case "none":
                    case "contextmenu":
                    case "move": return <></>
                    case "viewport": return <Viewportbar />
                    case "scale": return <Scalebar />
                    case "rotate": return <Rotatebar />
                    case "mix": return <Mixbar />
                }
            })()}
        </div>
    </>)
}