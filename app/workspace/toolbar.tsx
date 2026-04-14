import { useContext, useState } from "react"
import { WorkspaceActionType, WorkspaceContext } from "./workspace.client"
import { Tooltip } from "react-tooltip";
import { dellaRespira } from "../fonts";
import { SvgRepo, lassoSelect, deployedCode, browse } from "../svg-repo";
import { WorkspaceResolution } from "./workspace-resolution";

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
                tooltipMarginBottom: 12,
                tooltipMarginBottom2: 10,
                tooltipFont: 16,
                tooltipFont2: 14
            }
            case "midhigh": return {
                svg: 40,
                width: 40,
                tooltipMarginBottom: 12,
                tooltipMarginBottom2: 10,
                tooltipFont: 16,
                tooltipFont2: 14
            }
            case "low":
            case "midlow": return {
                svg: 38,
                width: 38,
                tooltipMarginBottom: 12,
                tooltipMarginBottom2: 10,
                tooltipFont: 16,
                tooltipFont2: 14
            }
        }
    });
    return <>
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
                    <p style={{ marginBottom: rightPanelSize.tooltipMarginBottom2 }}>
                        With this tool selected, drop the <strong>browser element</strong> onto the canvas by dragging the cursor over the desired area.
                    </p>
                </div>
            )}
        />
        <div
            data-tooltip-id="activate-tool-tooltip"
            style={{
                width: 'min-content',
                height: 'min-content',
                background: appState.tool.type == 'activate' ? 'rgba(255, 255, 255, 0.1)' : 'none',
            }}>
            <SvgRepo
                svg={deployedCode()}
                containerSize={{
                    width: rightPanelSize.svg,
                    height: rightPanelSize.svg
                }}
                scale={0.5}
                onContainerClick={() => {
                    if (appState.tool.type == 'activate') {
                        dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'none' } });
                    }
                    else {
                        dispatch({ type: WorkspaceActionType.SetTool, value: { type: 'activate' } })
                    }
                }} />
        </div>
        <Tooltip
            className={dellaRespira.className}
            id="activate-tool-tooltip"
            content="activate"
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
                    <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Activate Tool</h4>
                    <p style={{ marginBottom: rightPanelSize.tooltipMarginBottom2 }}>
                        With this tool selected, click an image or svg on the canvas to view its <strong>context menu</strong>.
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
    </>
}