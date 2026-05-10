import { useCallback, useContext, useState } from "react"
import { WorkspaceActionType, WorkspaceContext } from "./workspace.client"
import { Tooltip } from "react-tooltip";
import { dellaRespira } from "../fonts";
import { SvgRepo, lassoSelect, browse, keyboardCommandKey, allOut, toysFan, earthquake } from "../svg-repo";
import { WorkspaceResolution } from "./workspace-resolution";
import { LaurusProjectResult } from "../projects/projects.client";

interface Toolbar {
    resolution: WorkspaceResolution,
}
export default function Toolbar({ resolution }: Toolbar) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [rightPanelSize] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                svg: 50,
                width: 50,
                tooltipMarginBottom: 6,
                tooltipFont: 16,
                tooltipFont2: 14
            }
            case "midhigh": return {
                svg: 40,
                width: 40,
                tooltipMarginBottom: 6,
                tooltipFont: 14,
                tooltipFont2: 12
            }
            case "low":
            case "midlow": return {
                svg: 38,
                width: 38,
                tooltipMarginBottom: 6,
                tooltipFont: 14,
                tooltipFont2: 12
            }
        }
    });

    const setShowActiveContextMenu = useCallback((newShowContextMenu: boolean): void => {
        if (!appState.activeElement) return;
        const activeElement = { ...appState.activeElement };
        if (!activeElement) return;
        const snapshot: LaurusProjectResult = { ...appState.project };
        switch (activeElement.type) {
            case "svg": {
                const svg = snapshot.svgs.get(activeElement.key);
                if (!svg) return;
                dispatch({ type: WorkspaceActionType.SetProjectSvg, key: activeElement.key, value: { ...svg, showContextMenu: newShowContextMenu } });
            }
            case "img": {
                const img = snapshot.imgs.get(activeElement.key);
                if (!img) return;
                dispatch({ type: WorkspaceActionType.SetProjectImg, key: activeElement.key, value: { ...img, showContextMenu: newShowContextMenu } });
            }
        }
    }, [appState.activeElement, appState.project, dispatch]);

    return <>
        <div
            style={{
                display: "grid",
                gridTemplateRows: 'min-content min-content min-content min-content min-content auto',
                borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                background: "linear-gradient(34deg, rgba(25, 25, 25, 1) 34%, rgba(21, 21, 21, 1))",
                width: 'min-content',
                height: '100%',
                justifyContent: 'center'
            }}>
            <div
                data-tooltip-id="drop-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: appState.tool.type == 'drop' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={lassoSelect()}
                    containerSize={{
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }}
                    scale={0.5}
                    onContainerClick={() => {
                        if (appState.tool.type == 'drop') {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'drop' } })
                        }
                        const inactiveImgs = Array.from(appState.project.imgs.entries());
                        const inactiveSvgs = Array.from(appState.project.svgs.entries());
                        inactiveImgs.forEach(i => {
                            dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                        });
                        inactiveSvgs.forEach(i => {
                            dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                        });
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="drop-tool-tooltip"
                content="drop"
                style={{
                    backgroundColor: 'rgb(40, 40, 40)',
                    color: 'rgb(227, 227, 227)',
                    fontSize: rightPanelSize.tooltipFont2,
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    maxWidth: "300px",
                    zIndex: 99
                }}
                render={() => (
                    <div style={{ padding: 4, width: '100%' }}>
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Drop Tool</h4>
                        <p>
                            Select this tool then click and drag anywhere on the canvas to drop the <strong>browser element</strong> in that area.
                        </p>
                    </div>
                )}
            />
            <div
                data-tooltip-id="contextmenu-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: appState.tool.type == 'contextmenu' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={keyboardCommandKey()}
                    containerSize={{
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }}
                    scale={0.5}
                    onContainerClick={() => {
                        if (appState.tool.type == 'contextmenu') {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'contextmenu' } })
                        }
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="contextmenu-tool-tooltip"
                content="contextmenu"
                style={{
                    backgroundColor: 'rgb(40, 40, 40)',
                    color: 'rgb(227, 227, 227)',
                    fontSize: rightPanelSize.tooltipFont2,
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    maxWidth: "300px",
                    zIndex: 99
                }}
                render={() => (
                    <div style={{ padding: 4, width: '100%' }}>
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Context Menu Tool</h4>
                        <p>
                            Select this tool then click an image or svg on the canvas to view its <strong>context menu</strong>.
                        </p>
                    </div>
                )}
            />
            <div
                data-tooltip-id="viewport-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: appState.tool.type == 'viewport' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={browse()}
                    containerSize={{
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }}
                    scale={0.5}
                    onContainerClick={() => {
                        if (appState.tool.type == 'viewport') {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'viewport' } })
                        }
                        const inactiveImgs = Array.from(appState.project.imgs.entries());
                        const inactiveSvgs = Array.from(appState.project.svgs.entries());
                        inactiveImgs.forEach(i => {
                            dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                        });
                        inactiveSvgs.forEach(i => {
                            dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                        });
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="viewport-tool-tooltip"
                style={{
                    backgroundColor: 'rgb(40, 40, 40)',
                    color: 'rgb(227, 227, 227)',
                    fontSize: rightPanelSize.tooltipFont2,
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    maxWidth: "300px",
                    zIndex: 99
                }}
                render={() => (
                    <div style={{ padding: 4, width: '100%' }}>
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Viewport Tool</h4>
                        <p>
                            Hides all media on the canvas that lands outside of the <strong>frame</strong>.
                        </p>
                    </div>
                )}
            />
            <div
                data-tooltip-id="move-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: appState.tool.type == 'move' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={earthquake()}
                    containerSize={{
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }}
                    scale={0.5}
                    onContainerClick={() => {
                        if (appState.tool.type == 'move') {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'move' } })
                        }
                        const inactiveImgs = Array.from(appState.project.imgs.entries());
                        const inactiveSvgs = Array.from(appState.project.svgs.entries());
                        inactiveImgs.forEach(i => {
                            dispatch({ type: WorkspaceActionType.SetProjectImg, key: i[0], value: { ...i[1], showContextMenu: false } });
                        });
                        inactiveSvgs.forEach(i => {
                            dispatch({ type: WorkspaceActionType.SetProjectSvg, key: i[0], value: { ...i[1], showContextMenu: false } });
                        });
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="move-tool-tooltip"
                style={{
                    backgroundColor: 'rgb(40, 40, 40)',
                    color: 'rgb(227, 227, 227)',
                    fontSize: rightPanelSize.tooltipFont2,
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    maxWidth: "300px",
                    zIndex: 99
                }}
                render={() => (
                    <div style={{ padding: 4, width: '100%' }}>
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Move Tool</h4>
                        <p>
                            With this tool selected everything on the canvas becomes draggable.
                        </p>
                    </div>
                )}
            />
            <div
                data-tooltip-id="scale-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: appState.tool.type == 'scale' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={allOut()}
                    containerSize={{
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }}
                    scale={0.5}
                    onContainerClick={() => {
                        if (appState.tool.type == 'scale') {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                            setShowActiveContextMenu(false);
                        }
                        else {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'scale' } });
                            setShowActiveContextMenu(true);
                        }
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="scale-tool-tooltip"
                style={{
                    backgroundColor: 'rgb(40, 40, 40)',
                    color: 'rgb(227, 227, 227)',
                    fontSize: rightPanelSize.tooltipFont2,
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    maxWidth: "300px",
                    zIndex: 99
                }}
                render={() => (
                    <div style={{ padding: 4, width: '100%' }}>
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Scale Tool</h4>
                        <p>
                            Select this tool then click an image or svg on the canvas to adjust its scaling via the <strong>project toolbar</strong>.
                        </p>
                    </div>
                )}
            />
            <div
                data-tooltip-id="rotate-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: appState.tool.type == 'rotate' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={toysFan()}
                    containerSize={{
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }}
                    scale={0.5}
                    onContainerClick={() => {
                        if (appState.tool.type == 'rotate') {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                            setShowActiveContextMenu(false);
                        }
                        else {
                            dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'rotate' } });
                            setShowActiveContextMenu(true);
                        }
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="rotate-tool-tooltip"
                style={{
                    backgroundColor: 'rgb(40, 40, 40)',
                    color: 'rgb(227, 227, 227)',
                    fontSize: rightPanelSize.tooltipFont2,
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    maxWidth: "300px",
                    zIndex: 99
                }}
                render={() => (
                    <div style={{ padding: 4, width: '100%' }}>
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Rotate Tool</h4>
                        <p>
                            Select this tool then click an image or svg on the canvas to rotate it via the <strong>project toolbar</strong>.
                        </p>
                    </div>
                )}
            />
        </div>
    </>
}
