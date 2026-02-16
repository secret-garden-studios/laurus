import { useContext, useState, useRef, useEffect } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import useDebounce from "../hooks/useDebounce";
import { LaurusProject, WorkspaceContext } from "./workspace.client";
import { createProject, updateProject } from "./workspace.server";

export default function Projectbar() {
    const { appState } = useContext(WorkspaceContext);
    const [projectName, setProjectName] = useState<string>(appState.project.name);
    const projectNameHook = useDebounce<string>(projectName, 3333);
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
                await createProject(
                    appState.apiOrigin,
                    { ...projectRef.current, name: projectNameHook });
            }
        });

        renameProjectOnSever();
    }, [appState.apiOrigin, projectNameHook]);

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