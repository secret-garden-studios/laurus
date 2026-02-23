import { useContext, useRef, useState } from "react";
import { LaurusScaleResult, WorkspaceActionType, WorkspaceContext } from "./workspace.client";
import { dellaRespira, dmSans } from "../fonts";
import { ReactSvg } from "./media";
import { circle } from "../svg-repo";
import styles from "../app.module.css";
import { PointerStyle, Trackpad } from "../components/trackpad";
import { deleteScale } from "./workspace.server";

interface ScaleUnitProps {
    scale: LaurusScaleResult
}

export default function ScaleUnit({ scale }: ScaleUnitProps) {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const scaleRef = useRef<HTMLInputElement>(null);
    const placeholderElementRef = useRef<HTMLDivElement>(null);
    const [maxScale] = useState({
        time: 90000,
        zoomIn: 30,
        zoomOut: 1
    });

    const [displaySize] = useState({ 'width': 400, 'height': 400, 'padding': 0 });
    const [mainControls, setMainControls] = useState(true);

    const [timeCapSize] = useState({ width: 45, height: 21 });
    const [timeTrackSize] = useState({ width: 45, height: 200 });

    const [timeCursor, setTimeCursor] = useState({ x: 0, y: timeTrackSize.height - timeCapSize.height });

    const [scaleCapSize] = useState({ width: 51, height: 50 });
    const [scaleTrackSize] = useState({ width: 430, height: 50 });
    const [scaleCursor, setScaleCursor] = useState({ x: ((scaleTrackSize.width) / 2) - (scaleCapSize.width / 2), y: 0 });
    return (
        <div style={{
            gridTemplateRows: 'min-content auto',
            gridTemplateColumns: 'min-content auto',
            display: "grid",
            borderTop: '1px solid rgba(255,255,255,0.05)',
            alignItems: 'center',
        }}>
            {/* row 1 */}
            <div
                className={dellaRespira.className}
                style={{
                    gridColumn: 'span 2',
                    display: 'flex',
                    height: '100%',
                    alignItems: 'center',
                    padding: 10,
                }}>
                <div
                    style={{
                        fontSize: 32,
                        display: 'grid', placeContent: 'center', width: 'min-content', height: '100%'
                    }}>
                    {'Scale'}
                </div>
                <ReactSvg
                    svg={circle()}
                    containerSize={{
                        width: 24,
                        height: 24
                    }}
                    scale={1} />
                <div
                    style={{ display: 'grid', placeContent: 'start', width: 'min-content', height: '100%', marginLeft: 'auto' }}
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default'; }}
                    onClick={() => { setMainControls(v => !v); }}
                >
                    <ReactSvg
                        svg={circle()}
                        containerSize={{
                            width: 12,
                            height: 12
                        }}
                        scale={1} />
                </div>
            </div>

            {mainControls ?
                <>
                    {/* display */}
                    <div style={{ padding: '0 20px 20px 20px' }}>
                        <div
                            className={styles["tiled-background-squares"]}
                            style={{
                                padding: `${displaySize.padding}px`,
                                display: 'grid',
                                width: `${displaySize.width}px`, height: `${displaySize.height}px`,
                                borderRadius: 10,
                                border: '1px solid black',
                                position: 'relative',
                            }}>
                            {/* active element */}
                            <div style={{ position: 'absolute', width: '100%', height: '100%', }}>
                                <div style={{
                                    position: 'relative',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '100%', height: '100%',
                                    overflow: 'hidden'
                                }}>
                                    <div
                                        className={dmSans.className}
                                        ref={placeholderElementRef}
                                        style={{
                                            position: 'absolute',
                                            fontSize: 14,
                                            color: 'rgb(246, 246, 246)',
                                        }}>
                                        {'[n/a]'}
                                    </div>
                                </div>
                            </div>
                            {/* main parameter */}
                            <div style={{
                                position: 'absolute', top: 0, right: 0,
                                display: 'flex',
                                padding: '8px 16px'
                            }}>
                                <input
                                    ref={scaleRef}
                                    type="text"
                                    placeholder="0.00"
                                    style={{
                                        textAlign: "right",
                                        background: 'none',
                                        color: "rgba(255, 255, 255, 0.8)",
                                        borderRadius: "2px",
                                        padding: '0px 0px',
                                        border: 'none',
                                        outline: 'none',
                                        lineHeight: '1',
                                        display: 'inline-block',
                                        overflowX: 'scroll',
                                        fontSize: 24,
                                        width: "70px",
                                        height: '30px',
                                        textShadow: '2px 2px 3px rgba(0, 0, 0, 1)',
                                    }} />
                            </div>
                        </div>
                    </div>

                    {/* controls */}
                    <div style={{
                        justifySelf: 'start',
                        display: 'grid',
                        gridTemplateRows: 'min-content auto',
                    }}>
                        <div style={{ padding: '0 20px 20px 20px' }}>
                            <div style={{
                                border: '1px solid black',
                                borderRadius: 0,
                                padding: 0
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'min-content 3fr min-content', }}>
                                    <div style={{
                                        gridRow: 1,
                                        gridColumn: 1,
                                        height: 'min-content',
                                        display: 'flex',
                                        padding: '20px 15px',
                                        gap: 20,
                                        borderRight: 'solid rgba(0, 0, 0, 1) 1px',
                                    }}>
                                        <VerticalSlider
                                            label={"speed"}
                                            hash={`${scale.scale_id}|${2}`}
                                            capSize={timeCapSize}
                                            trackSize={timeTrackSize}
                                            cursor={timeCursor}
                                            onNewCursor={(newCursor: { x: number, y: number }) => {
                                                setTimeCursor({ ...newCursor, x: 0 });
                                            }} />
                                    </div>
                                    <div style={{
                                        gridRow: 1,
                                        gridColumn: 2,
                                        padding: 0,
                                        display: 'grid', placeContent: 'center',
                                    }}>
                                        <div style={{
                                            gridRow: 2,
                                            gridColumn: 'span 2',
                                            placeSelf: 'center',
                                        }}>{'rate'}</div>
                                    </div>
                                    <div style={{
                                        borderLeft: '2px solid black',
                                        background: 'linear-gradient(45deg, rgb(13, 13, 13), rgb(17, 17, 17))',
                                        padding: 0,
                                        display: 'grid', alignContent: 'start',
                                    }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                display: 'grid', placeContent: 'center',
                                                border: '1px solid rgb(0, 0, 0)',
                                            }}>
                                            <ReactSvg
                                                svg={circle()}
                                                containerSize={{
                                                    width: 20,
                                                    height: 20
                                                }}
                                                scale={1} />
                                        </div>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                display: 'grid', placeContent: 'center',
                                                border: '1px solid rgb(0, 0, 0)',
                                            }}>
                                            <ReactSvg
                                                svg={circle()}
                                                containerSize={{
                                                    width: 20,
                                                    height: 20
                                                }}
                                                scale={1} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '0 20px 20px 20px' }}>
                            <div style={{
                                width: 'min-content',
                                padding: '20px 15px',
                                display: 'flex',
                                alignItems: 'start',
                                border: 'solid rgba(0, 0, 0, 1) 1px',
                                backgroundColor: "rgb(20, 20, 20)",
                                borderRadius: 0,
                            }}>
                                <HorizontalSlider
                                    label={"zoom"}
                                    hash={`${scale.scale_id}|${1}`}
                                    capSize={scaleCapSize}
                                    trackSize={scaleTrackSize}
                                    cursor={scaleCursor}
                                    onNewCursor={(newCursor: { x: number, y: number }) => {
                                        if (scaleRef.current) {
                                            const medianX: number = Math.round(((scaleTrackSize.width) / 2) - (scaleCapSize.width / 2));
                                            const maxX: number = scaleTrackSize.width - scaleCapSize.width;
                                            const rightSector: number = maxX - medianX;
                                            const leftSector: number = medianX;
                                            let rightReBase = 0;
                                            for (let coordinate = 0; coordinate < rightSector; coordinate++) {
                                                const xP: number = coordinate / rightSector;
                                                const zoomInP: number = xP * maxScale.zoomIn;
                                                if (zoomInP <= 1) {
                                                    rightReBase = coordinate;
                                                }
                                                else {
                                                    break;
                                                }
                                            };

                                            if (newCursor.x === medianX) {
                                                scaleRef.current.value = '1';
                                            }
                                            else if (newCursor.x > medianX) {
                                                const xP: number = (newCursor.x - leftSector) / rightSector;
                                                const zoomInP: number = xP * maxScale.zoomIn;
                                                if (zoomInP <= 1) {
                                                    const rebasedP = ((newCursor.x - leftSector) / rightReBase);
                                                    const maxRebasedScale = ((rightReBase / rightSector) * maxScale.zoomIn) / 10;
                                                    const newScale = (rebasedP * maxRebasedScale);
                                                    scaleRef.current.value = (1 + newScale).toFixed(2);
                                                }
                                                else {
                                                    scaleRef.current.value = zoomInP.toFixed(2);
                                                }
                                            }
                                            else {
                                                scaleRef.current.value = "";
                                            }
                                        }
                                        setScaleCursor({ ...newCursor, y: 0 });
                                    }} />
                            </div>
                        </div>

                    </div>
                </> :
                <>
                    {/* deep controls */}
                    <div
                        style={{
                            gridColumn: 'span 2', padding: '0 20px 20px 20px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: 16,
                        }}>
                        <div
                            style={{
                                display: 'grid',
                                height: `${displaySize.height}px`,
                                alignContent: 'center',
                                gap: 4,
                            }}>
                            <div>{'You are about to part ways with this effect forever...'}</div>
                            <div style={{ justifySelf: 'end' }}>{'Click'}
                                <span
                                    onClick={async () => {
                                        await deleteScale(appState.apiOrigin, scale.scale_id);
                                        dispatch({
                                            type: WorkspaceActionType.SetEffects,
                                            value: appState.effects.filter(e => {
                                                switch (e.type) {
                                                    case "scale": {
                                                        return e.value.scale_id != scale.scale_id;
                                                    }
                                                    case "move": {
                                                        return true;
                                                    }
                                                }
                                            })
                                        });
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                                    style={{ color: 'rgb(243, 115, 120)' }}>
                                    {' delete '}
                                </span>
                                {'to proceed.'}
                            </div>
                        </div>
                    </div>
                </>
            }
        </div >
    )
}

interface ScaleUnitSliderProps {
    label: string,
    hash: string,
    capSize: { width: number | string, height: number | string }
    trackSize: { width: number | string, height: number | string }
    cursor: { x: number, y: number },
    onNewCursor: (newCursor: { x: number, y: number }) => void,
}
function VerticalSlider({
    label,
    hash,
    capSize,
    trackSize,
    cursor,
    onNewCursor,
}: ScaleUnitSliderProps) {
    return (<>
        <div style={{ height: '100%', width: 'min-content' }}>
            <div style={{ position: "relative", ...trackSize, }}>
                <div style={{ position: 'absolute', height: '100%', width: '100%', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `dnd-context-${hash}`, draggableId: `dnd-draggable-${hash}` }}
                        width={capSize.width}
                        height={'100%'}
                        coarsePointer={{
                            ...capSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor} />
                </div>
                <div
                    onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        onNewCursor({ x, y });
                    }}
                    style={{
                        zIndex: 0,
                        cursor: 'crosshair',
                        position: "absolute",
                        justifySelf: 'center',
                        height: trackSize.height,
                        width: 10,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(5, 5, 5)'
                    }}
                />
            </div>
            <div className={dmSans.className}
                style={{
                    alignSelf: "start", justifySelf: "center",
                    fontSize: "10px", paddingTop: '10px'
                }}>{label}</div>
        </div>
    </>)
}

function HorizontalSlider({
    label,
    hash,
    capSize,
    trackSize,
    cursor,
    onNewCursor,
}: ScaleUnitSliderProps) {
    return (<>
        <div style={{ width: 'min-content', height: '100%', }}>
            <div style={{
                position: "relative",
                ...trackSize,
                alignContent: 'center',
            }}>
                <div style={{ position: 'absolute', width: '100%', alignSelf: 'center', justifySelf: 'center', }}>
                    <Trackpad
                        ids={{ contextId: `dnd-context-${hash}`, draggableId: `dnd-draggable-${hash}` }}
                        width={'100%'}
                        height={capSize.height}
                        coarsePointer={{
                            ...capSize,
                            pointerStyle: PointerStyle.Blurry,
                            zIndex: 2
                        }}
                        value={cursor}
                        onNewValue={onNewCursor} />
                </div>
                <div
                    style={{
                        zIndex: 1,
                        top: 0,
                        width: trackSize.width,
                        height: 8,
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{
                        height: '100%', width: '50%',
                        background: "linear-gradient(45deg, rgb(136, 176, 231), rgb(172, 171, 232))",
                        border: '1px solid rgb(125, 166, 255)',
                    }} />
                    <div style={{
                        height: '100%', width: '50%',
                        background: "linear-gradient(45deg, rgb(231, 136, 136), rgb(232, 171, 171))",
                        border: '1px solid rgb(255, 116, 116)',
                    }} />

                </div>
                <div
                    onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        onNewCursor({ x, y });
                    }}
                    style={{
                        zIndex: 0,
                        cursor: 'crosshair',
                        position: "absolute",
                        justifySelf: 'start',
                        alignSelf: 'center',
                        ...trackSize,
                        background: "linear-gradient(45deg, rgb(22, 22, 22), rgba(40, 40, 40, 1))",
                        border: '1px solid rgb(5, 5, 5)'
                    }}
                />

            </div>
            <div
                className={dmSans.className}
                style={{
                    alignSelf: "start", justifySelf: "center",
                    fontSize: "10px", paddingTop: '10px'
                }}>{label}</div>
        </div>
    </>)
}