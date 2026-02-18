import { useContext, useState, useRef, useEffect } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import useDebounce from "../hooks/useDebounce";
import { LaurusProject, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { createProject, updateProject } from "./workspace.server";

export default function Projectbar() {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [projectName, setProjectName] = useState<string>(appState.project.name);
    const projectNameHook = useDebounce<string>(projectName, 1000);
    const projectRef = useRef<LaurusProject | undefined>(undefined);

    useEffect(() => {
        const renameProjectOnSever = (async () => {
            if (projectRef.current && projectRef.current.project_id &&
                projectRef.current.name && projectNameHook) {
                await updateProject(
                    appState.apiOrigin,
                    projectRef.current.project_id,
                    { ...projectRef.current, name: projectNameHook });
            }
            else if (projectRef.current && projectRef.current.name && projectNameHook) {
                const newProject = { ...projectRef.current, name: projectNameHook };
                const response = await createProject(
                    appState.apiOrigin,
                    newProject);
                if (response) {
                    const newProject2: LaurusProject = { ...newProject, project_id: response.project_id }
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
            className={styles["grainy-background"]}
            style={{
                height: 36,
                width: "100%",
                display: "flex",
                justifyContent: 'start',
                alignItems: "center",
                border: '1px solid black',
            }}>
            <div
                style={{
                    width: '100%',
                    display: 'grid',
                    placeContent: 'center',
                    height: '100%',
                    padding: 2,
                }}>
                <input
                    className={dellaRespira.className}
                    placeholder="name me..."
                    style={{
                        width: 1080,
                        letterSpacing: '3px',
                        background: 'none',
                        color: "rgb(227, 227, 227)",
                        fontSize: "16px",
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