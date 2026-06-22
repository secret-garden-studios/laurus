import { useContext, useState } from "react"
import { CoreContext, UIContext } from "../workspace.client"
import { Tooltip } from "react-tooltip";
import { dellaRespira } from "../../fonts";
import { SvgRepo, lassoSelect, browse, keyboardCommandKey, allOut, toysFan, earthquake, experiment } from "../../svg-repo";
import { WorkspaceResolution } from "../workspace.config";
import { defaultMarqueeTool, UIActionType } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";

interface Toolbar {
    resolution: WorkspaceResolution,
    handleMixRestoration: () => void,
}
export default function Toolbar({ resolution, handleMixRestoration }: Toolbar) {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState, uiDispatch } = useContext(UIContext);
    const [tooltipDelay] = useState(1000);
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

    return <>
        <div
            style={{
                display: "grid",
                gridTemplateRows: 'min-content min-content min-content min-content min-content min-content auto',
                borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                background: "linear-gradient(34deg, rgba(25, 25, 25, 1) 34%, rgba(21, 21, 21, 1))",
                width: 'min-content',
                height: '100%',
                justifyContent: 'center'
            }}>
            <div
                data-tooltip-id="marquee-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: uiState.tool.type == 'marquee' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={lassoSelect()}
                    scale={0.5}
                    scaleToContaier={true}
                    onContainerClick={() => {
                        if (uiState.playbackMode.type !== 'stopped') return;
                        handleMixRestoration();
                        if (uiState.tool.type == 'marquee') {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            uiDispatch({ type: UIActionType.SetTool, value: defaultMarqueeTool })
                        }
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                    }}
                    containerStyle={uiState.playbackMode.type !== 'stopped' ? {
                        cursor: 'progress',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    } : {
                        cursor: 'pointer',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="marquee-tool-tooltip"
                delayShow={tooltipDelay}
                content="marquee"
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
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Marquee Tool</h4>
                        <p>
                            Use this tool to select multiple elements at once or to drop the <strong>browser element</strong> into an area on the canvas.
                        </p>
                    </div>
                )}
            />
            <div
                data-tooltip-id="contextmenu-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: uiState.tool.type == 'contextmenu' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={keyboardCommandKey()}
                    scale={0.5}
                    scaleToContaier={true}
                    onContainerClick={() => {
                        if (uiState.playbackMode.type !== 'stopped') return;
                        handleMixRestoration();
                        if (uiState.tool.type == 'contextmenu') {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'contextmenu' } });
                        }
                    }}
                    containerStyle={uiState.playbackMode.type !== 'stopped' ? {
                        cursor: 'progress',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    } : {
                        cursor: 'pointer',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="contextmenu-tool-tooltip"
                content="contextmenu"
                delayShow={tooltipDelay}
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
                    background: uiState.tool.type == 'viewport' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={browse()}
                    scale={0.5}
                    scaleToContaier={true}
                    onContainerClick={() => {
                        if (uiState.playbackMode.type !== 'stopped') return;
                        handleMixRestoration();
                        if (uiState.tool.type == 'viewport') {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'viewport' } })
                        }
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                    }}
                    containerStyle={uiState.playbackMode.type !== 'stopped' ? {
                        cursor: 'progress',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    } : {
                        cursor: 'pointer',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="viewport-tool-tooltip"
                delayShow={tooltipDelay}
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
                    background: uiState.tool.type == 'move' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={earthquake()}
                    scale={0.5}
                    scaleToContaier={true}
                    onContainerClick={() => {
                        if (uiState.playbackMode.type !== 'stopped') return;
                        handleMixRestoration();
                        if (uiState.tool.type == 'move') {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'move' } });
                        }
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                    }}
                    containerStyle={uiState.playbackMode.type !== 'stopped' ? {
                        cursor: 'progress',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    } : {
                        cursor: 'pointer',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="move-tool-tooltip"
                delayShow={tooltipDelay}
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
                    background: uiState.tool.type == 'scale' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={allOut()}
                    scale={0.5}
                    scaleToContaier={true}
                    onContainerClick={() => {
                        if (uiState.playbackMode.type !== 'stopped') return;
                        handleMixRestoration();
                        if (uiState.tool.type == 'scale') {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'scale' } });
                        }
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                    }}
                    containerStyle={uiState.playbackMode.type !== 'stopped' ? {
                        cursor: 'progress',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    } : {
                        cursor: 'pointer',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="scale-tool-tooltip"
                delayShow={tooltipDelay}
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
                    background: uiState.tool.type == 'rotate' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={toysFan()}
                    scale={0.5}
                    scaleToContaier={true}
                    onContainerClick={() => {
                        if (uiState.playbackMode.type !== 'stopped') return;
                        handleMixRestoration();
                        if (uiState.tool.type == 'rotate') {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'rotate' } });
                        }
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                    }}
                    containerStyle={uiState.playbackMode.type !== 'stopped' ? {
                        cursor: 'progress',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    } : {
                        cursor: 'pointer',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="rotate-tool-tooltip"
                delayShow={tooltipDelay}
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
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>{'Rotate Tool'}</h4>
                        <p>
                            Select this tool then click an image or svg on the canvas to rotate it via the <strong>project toolbar</strong>.
                        </p>
                    </div>
                )}
            />
            <div
                data-tooltip-id="mix-tool-tooltip"
                style={{
                    width: 'min-content',
                    height: 'min-content',
                    background: uiState.tool.type == 'mix' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                }}>
                <SvgRepo
                    svg={experiment()}
                    scale={0.5}
                    scaleToContaier={true}
                    onContainerClick={() => {
                        if (uiState.playbackMode.type !== 'stopped') return;
                        handleMixRestoration();
                        if (uiState.tool.type == 'mix') {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'none' } });
                        }
                        else {
                            uiDispatch({ type: UIActionType.SetTool, value: { type: 'mix' } });
                        }
                        uiDispatch({ type: UIActionType.CloseAllContextMenus });
                    }}
                    containerStyle={uiState.playbackMode.type !== 'stopped' ? {
                        cursor: 'progress',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    } : {
                        cursor: 'pointer',
                        width: rightPanelSize.svg,
                        height: rightPanelSize.svg
                    }} />
            </div>
            <Tooltip
                className={dellaRespira.className}
                id="mix-tool-tooltip"
                delayShow={tooltipDelay}
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
                        <h4 style={{ marginBottom: rightPanelSize.tooltipMarginBottom, color: "rgb(255, 255, 255)", fontSize: rightPanelSize.tooltipFont }}>Mix Tool</h4>
                        <p>
                            Select this tool to mix eligible effects using the <strong>project toolbar</strong>.
                        </p>
                    </div>
                )}
            />
        </div>
    </>
}
