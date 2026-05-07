import { useContext, useState, useRef, useEffect } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import useDebounce from "../hooks/useDebounce";
import { WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { updateProject, createProject } from "../projects/projects.server";
import { LaurusProjectResult } from "../projects/projects.client";

export default function Projectbar() {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [projectName, setProjectName] = useState<string>(appState.project.name);
    const [projectNameSnapshot] = useState<string>(appState.project.name);
    const projectNameHook = useDebounce<string>(projectName, 1000);
    const projectRef = useRef<LaurusProjectResult | undefined>(undefined);
    const projectTitleRef = useRef<HTMLInputElement>(null);
    const [projectbarSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                height: '',
                font: 14,
                inputPadding: '4px 20px'
            }
            case "midhigh": return {
                height: 32,
                font: 11,
                inputPadding: '0px 20px'
            }
            case "low":
            case "midlow": return {
                height: 30,
                font: 11,
                inputPadding: '0px 20px'
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
            className={styles["noisy-background"]}
            style={{
                height: projectbarSize.height,
                width: "100%",
                display: "grid",
                gridTemplateRows: 'min-content',
                gridTemplateColumns: '1fr',
                placeContent: 'start',
                overflowX: 'auto',
                overflowY: 'hidden',
                borderBottom: '1px solid rgb(33, 33, 33)',
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
                            fontSize: projectbarSize.font,
                            letterSpacing: 1,
                            textAlign: 'center',
                            border: 'none',
                            outline: 'none',
                            padding: 4,
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
