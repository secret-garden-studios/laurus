import { useContext, useState, useRef, useEffect } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import useDebounce from "../hooks/useDebounce";
import { WorkspaceActionType, WorkspaceContext, LaurusProjectResult } from "./workspace.client";
import { updateProject, createProject } from "../projects/projects.server";

export default function Projectbar() {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [projectName, setProjectName] = useState<string>(appState.project.name);
    const projectNameHook = useDebounce<string>(projectName, 1000);
    const projectRef = useRef<LaurusProjectResult | undefined>(undefined);
    const [projectbarSize] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                height: Math.round(36 * appState.resolution.factor),
                font: 16,
                inputPadding: '0px 20px'
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
                const response = await updateProject(
                    appState.apiOrigin,
                    projectRef.current.project_id,
                    newProject);
                if (response) {
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject });
                }
            }
            else if (projectRef.current && projectRef.current.name && projectNameHook) {
                const newProject = { ...projectRef.current, name: projectNameHook };
                const response = await createProject(
                    appState.apiOrigin,
                    newProject);
                if (response) {
                    const newProject2: LaurusProjectResult = { ...newProject, project_id: response.project_id }
                    dispatch({ type: WorkspaceActionType.SetProject, value: newProject2 });
                }
            }
        });

        renameProjectOnSever();
    }, [appState.apiOrigin, projectNameHook, dispatch]);

    const onProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        projectRef.current = { ...appState.project, name: e.target.value };
        setProjectName(e.target.value);
    };

    return (<>
        <div
            className={styles["noisy-background-lite"]}
            style={{
                height: projectbarSize.height,
                width: "100%",
                display: "flex",
                justifyContent: 'start',
                alignItems: "center",
                overflowX: 'auto'
            }}>
            <div
                style={{
                    width: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    height: '100%',
                    padding: projectbarSize.inputPadding,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 0,
                    background: 'linear-gradient(45deg, rgba(11, 11, 11, 0.3), rgba(19, 19, 19, 0.3))',
                }}>
                <input
                    id={`porject-name-input-${appState.project.project_id}`}
                    className={dellaRespira.className}
                    placeholder="name me..."
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        letterSpacing: '3px',
                        background: 'none',
                        color: "rgb(227, 227, 227)",
                        fontSize: projectbarSize.font,
                        border: 'none',
                        textAlign: 'center',
                        outline: 'none',
                        padding: 4,
                    }}
                    type="text"
                    value={projectName}
                    onChange={onProjectNameChange}
                />
            </div>
        </div>
    </>)
}