import Dial from "@/app/components/dial";
import { ParameterSliderX } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import { LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { SvgRepo, toysFan } from "@/app/svg-repo";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UIContext, CoreContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";

export default function Rotatebar() {
    const { appState, dispatch } = useContext(CoreContext);
    const { uiState } = useContext(UIContext);
    const [angle, setAngle] = useState<number>(0);
    const [dynamicSizes] = useState(() => {
        switch (uiState.resolution.type) {
            case "high": return {
                paramSize: {
                    containerHeight: 38,
                    containerWidth: 190,
                    capWidth: 17,
                    capHeight: 17,
                    capBorderOffset: 0,
                    trackHeight: 1,
                    tickHeight: 0,
                    tickLeft: 2,
                    svgSize: { width: 24, height: 24 }
                },
                svgSize: {
                    width: 20,
                    height: 20
                },
                unitFontSize: 11,
                input: {
                    fontSize: 13,
                    width: '4ch',
                    padding: 0
                },
                grid: {
                    gap: 10
                }
            }
            case "midhigh": return {
                paramSize: {
                    capWidth: 13,
                    capHeight: 13,
                    capBorderOffset: 0,
                    containerWidth: 170,
                    containerHeight: 36,
                    trackHeight: 1,
                    tickHeight: 20,
                    tickLeft: 1,
                    svgSize: { width: 20, height: 20 }
                },
                svgSize: {
                    width: 18,
                    height: 18
                },
                unitFontSize: 10,
                input: {
                    fontSize: 11,
                    width: '4ch',
                    padding: 0
                },
                grid: {
                    gap: 10
                }
            }
            case "midlow":
            case "low": return {
                paramSize: {
                    capWidth: 13,
                    capHeight: 13,
                    capBorderOffset: 0,
                    containerWidth: 170,
                    containerHeight: 36,
                    trackHeight: 1,
                    tickHeight: 20,
                    tickLeft: 1,
                    svgSize: { width: 20, height: 20 }
                },
                svgSize: {
                    width: 20,
                    height: 20
                },
                unitFontSize: 11,
                input: {
                    fontSize: 13,
                    width: '4ch',
                    padding: 0
                },
                grid: {
                    gap: 10
                }
            }
        }
    });

    // param 1
    const xTrackRef = useRef<HTMLDivElement | null>(null);
    const [xCursor, setXCursor] = useState({ x: 0, y: 0 });
    const { getTrackValue: getXValue, getTrackCursor: getXCursor } =
        useTrackpadState(
            dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
            1);

    // param 2
    const yTrackRef = useRef<HTMLDivElement | null>(null);
    const [yCursor, setYCursor] = useState({ x: 0, y: 0 });
    const { getTrackValue: getYValue, getTrackCursor: getYCursor } =
        useTrackpadState(
            dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
            1);

    // param 3
    const zTrackRef = useRef<HTMLDivElement | null>(null);
    const [zCursor, setZCursor] = useState({ x: 0, y: 0 });
    const { getTrackValue: getZValue, getTrackCursor: getZCursor } =
        useTrackpadState(
            dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
            1);

    const angleRef = useRef<HTMLInputElement>(null);

    const getActiveRotate = useCallback((): [number, number, number, number] => {
        if (!uiState.activeElement) return [0, 0, 0, 0];
        const activeElement = { ...uiState.activeElement };
        if (!activeElement) return [0, 0, 0, 0];
        const snapshot: LaurusProjectResult = { ...appState.project };
        switch (activeElement.type) {
            case "svg": {
                const svg = snapshot.svgs.get(activeElement.key);
                if (!svg) return [0, 0, 0, 0];
                return [svg.rotate_x, svg.rotate_y, svg.rotate_z, svg.rotate_angle];
            }
            case "img": {
                const img = snapshot.imgs.get(activeElement.key);
                if (!img) return [0, 0, 0, 0];
                return [img.rotate_x, img.rotate_y, img.rotate_z, img.rotate_angle];
            }
        }
    }, [uiState.activeElement, appState.project]);

    const saveRotate = useCallback(async (
        key: string,
        elementType: string,
        rX: number | undefined,
        rY: number | undefined,
        rZ: number | undefined,
        rAngle: number | undefined) => {
        const snapshot: LaurusProjectResult = { ...appState.project };
        switch (elementType) {
            case "svg": {
                const newSvg = snapshot.svgs.get(key);
                if (newSvg) {
                    const rollbackSvgs = new Map(snapshot.svgs);
                    const newSvgs = new Map(snapshot.svgs);
                    newSvgs.set(key, {
                        ...newSvg,
                        ...(rX !== undefined && { rotate_x: rX }),
                        ...(rY !== undefined && { rotate_y: rY }),
                        ...(rZ !== undefined && { rotate_z: rZ }),
                        ...(rAngle !== undefined && { rotate_angle: rAngle }),
                    });
                    const newProject: LaurusProjectResult = { ...snapshot, svgs: newSvgs }
                    const saved = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, newProject);
                    if (saved) {
                        dispatch({ type: CoreActionType.SetProject, value: { ...newProject } });
                    }
                    else {
                        dispatch({ type: CoreActionType.SetProject, value: { ...snapshot, svgs: rollbackSvgs } });
                    }
                }
                break;
            }
            case "img": {
                const newImg = snapshot.imgs.get(key);
                if (newImg) {
                    const rollbackImgs = new Map(snapshot.imgs);
                    const newImgs = new Map(snapshot.imgs);
                    newImgs.set(key, {
                        ...newImg,
                        ...(rX !== undefined && { rotate_x: rX }),
                        ...(rY !== undefined && { rotate_y: rY }),
                        ...(rZ !== undefined && { rotate_z: rZ }),
                        ...(rAngle !== undefined && { rotate_angle: rAngle }),
                    });
                    const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs }
                    const saved = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, newProject);
                    if (saved) {
                        dispatch({ type: CoreActionType.SetProject, value: { ...newProject } });
                    }
                    else {
                        dispatch({ type: CoreActionType.SetProject, value: { ...snapshot, imgs: rollbackImgs } });
                    }
                }
                break;
            }
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, dispatch]);

    useEffect(() => {
        (async () => {
            const rotateInit = getActiveRotate();
            if (xTrackRef.current) {
                const newScaleCursor = getXCursor(rotateInit[0], xTrackRef.current.clientWidth);
                setXCursor({ x: newScaleCursor, y: 0 });
            }
            if (yTrackRef.current) {
                const newScaleYCursor = getYCursor(rotateInit[1], yTrackRef.current.clientWidth);
                setYCursor({ x: newScaleYCursor, y: 0 });
            }
            if (zTrackRef.current) {
                const newScaleZCursor = getZCursor(rotateInit[2], zTrackRef.current.clientWidth);
                setZCursor({ x: newScaleZCursor, y: 0 });
            }
            if (angleRef.current) {
                angleRef.current.value = rotateInit[3].toFixed() + "\xB0";
                setAngle(rotateInit[3]);
            }
        })();
    }, [getActiveRotate, getXCursor, getYCursor, getZCursor]);

    return <>
        <div style={
            {
                width: '100%',
                display: 'grid',
                alignItems: 'center',
                height: '100%',
                overflowX: 'auto',
                gridTemplateRows: 'auto',
                gridTemplateColumns: 'min-content min-content min-content min-content min-content min-content min-content min-content min-content auto',
                ...dynamicSizes.grid
            }}>
            <SvgRepo
                svg={toysFan()}
                containerStyle={{
                    width: dynamicSizes.svgSize.width,
                    height: dynamicSizes.svgSize.height
                }}
                scale={1}
                scaleToContaier={true} />
            <div style={{ paddingLeft: 4 }}>{'x'}</div>
            <ParameterSliderX
                resolution={{ ...uiState.resolution }}
                hash={`${uiState.activeElement?.key ?? 'rotatebar'}|rotatex`}
                size={dynamicSizes.paramSize}
                containerRef={xTrackRef}
                cursor={xCursor}
                onNewCursor={(newCursor) => {
                    setXCursor({ ...newCursor, y: 0 });
                    if (!xTrackRef.current) return;
                    const newX = getXValue(newCursor.x, xTrackRef.current.clientWidth, 0);
                    saveRotate(uiState.activeElement?.key ?? "", uiState.activeElement?.type ?? "", newX, undefined, undefined, undefined);
                }}
                disabled={uiState.activeElement == undefined} />
            <div>{'y'}</div>
            <ParameterSliderX
                resolution={{ ...uiState.resolution }}
                hash={`${uiState.activeElement?.key ?? 'rotatebar'}|rotatey`}
                size={dynamicSizes.paramSize}
                containerRef={yTrackRef}
                cursor={yCursor}
                onNewCursor={(newCursor) => {
                    setYCursor({ ...newCursor, y: 0 });
                    if (!yTrackRef.current) return;
                    const newY = getYValue(newCursor.x, yTrackRef.current.clientWidth, 0);
                    saveRotate(uiState.activeElement?.key ?? "", uiState.activeElement?.type ?? "", undefined, newY, undefined, undefined);
                }}
                disabled={uiState.activeElement == undefined} />
            <div>{'z'}</div>
            <ParameterSliderX
                resolution={{ ...uiState.resolution }}
                hash={`${uiState.activeElement?.key ?? 'rotatebar'}|rotatez`}
                size={dynamicSizes.paramSize}
                containerRef={zTrackRef}
                cursor={zCursor}
                onNewCursor={(newCursor) => {
                    setZCursor({ ...newCursor, y: 0 });
                    if (!zTrackRef.current) return;
                    const newZ = getZValue(newCursor.x, zTrackRef.current.clientWidth, 0);
                    saveRotate(uiState.activeElement?.key ?? "", uiState.activeElement?.type ?? "", undefined, undefined, newZ, undefined);
                }}
                disabled={uiState.activeElement == undefined} />
            <div style={{}}>
                {/* todo: the main tick mark on this mini dial is not rendered properly */}
                <Dial
                    resolution={{ ...uiState.resolution }}
                    ids={{
                        contextId: `{rotate.rotate_id}|main|c1`,
                        draggableId: `{rotate.rotate_id}|main|d1`
                    }}
                    value={angle}
                    onMove={(v) => {
                        if (!angleRef.current) return;
                        const newAngle: number = ((v) => { const x = (Math.round(v) % 360); return x < 0 ? x + 360 : x; })(v);
                        angleRef.current.value = newAngle.toFixed() + "\xB0";

                    }}
                    onNewValue={function (v: number): void {
                        const newAngle: number = ((v) => { const x = (Math.round(v) % 360); return x < 0 ? x + 360 : x; })(v);
                        saveRotate(uiState.activeElement?.key ?? "", uiState.activeElement?.type ?? "", undefined, undefined, undefined, newAngle);
                        setAngle(newAngle);
                    }}
                    size={{
                        container: 90 * 0.45,
                        gauge: 90 * 0.45,
                        gaugeTick: 7 * 0.45,
                        dial: 80 * 0.45,
                        dialTick: 11 * 0.45
                    }}
                    disabled={uiState.activeElement == undefined} />
            </div>
            <div style={{}}>
                <input id={`${uiState.activeElement?.key ?? 'rotatebar'}|rotateangle`}
                    disabled
                    ref={angleRef}
                    type="text"
                    placeholder="0.00"
                    style={{
                        textAlign: "center",
                        background: 'none',
                        color: "rgba(255, 255, 255, 0.8)",
                        border: 'none',
                        outline: 'none',
                        display: 'inline-block',
                        overflowX: 'scroll',
                        ...dynamicSizes.input
                    }}
                />
            </div>
            <div />
        </div>
    </>
}
