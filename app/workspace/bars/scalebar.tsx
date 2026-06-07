import { ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { ComplexTrackpadOptions, useComplexTrackpadState } from "@/app/hooks/useComplexTrackpadState";
import { LaurusProjectResult } from "@/app/projects/projects.client";
import { updateProject } from "@/app/projects/projects.server";
import { SvgRepo, allOut, link, linkOff } from "@/app/svg-repo";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorkspaceActionType, WorkspaceContext } from "../workspace.client";
import { SCALE_MAX } from "../workspace.config";
import Toggle from "@/app/components/toggle";
import styles from "@/app/app.module.css";

export default function Scalebar() {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const [unlockAspectRatio, setUnlockAspectRatio] = useState(false);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                paramSize: {
                    containerHeight: 38,
                    containerWidth: '100%',
                    capWidth: 17,
                    capHeight: 17,
                    capBorderOffset: 0,
                    trackHeight: 1,
                    tickHeight: 22,
                    tickLeft: 2,
                    svgSize: { width: 24, height: 24 }
                },
                sliderRatio: 0.8,
                svgSize: {
                    width: 20,
                    height: 20
                },
                unitFontSize: 12,
                input: {
                    fontSize: 13,
                    width: '6ch',
                    padding: 0
                },
                grid: {
                    gap: 10,
                    padding: '0 10px'
                },
                toggle: {
                    div: {
                        paddingLeft: 20,
                        paddingRight: 20,
                        gap: 12,
                        fontSize: 13,
                    },
                    track: {
                        width: 30,
                        height: 16,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 10,
                        height: 10,
                    }
                },
            }
            case "midhigh": return {
                paramSize: {
                    capWidth: 15,
                    capHeight: 15,
                    capBorderOffset: 0,
                    containerWidth: '100%',
                    containerHeight: 36,
                    trackHeight: 1,
                    tickHeight: 20,
                    tickLeft: 1,
                    svgSize: { width: 20, height: 20 }
                },
                sliderRatio: 0.8,
                svgSize: {
                    width: 18,
                    height: 18
                },
                unitFontSize: 10,
                input: {
                    fontSize: 11,
                    width: '6ch',
                    padding: 0
                },
                grid: {
                    gap: 10,
                    padding: '0 10px'
                },
                toggle: {
                    div: {
                        paddingLeft: 14,
                        paddingRight: 14,
                        gap: 8,
                        fontSize: 12,
                    },
                    track: {
                        width: 28,
                        height: 14,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 8,
                        height: 8,
                    }
                },
            }
            case "midlow":
            case "low": return {
                paramSize: {
                    capWidth: 14,
                    capHeight: 14,
                    capBorderOffset: 0,
                    containerWidth: '100%',
                    containerHeight: 36,
                    trackHeight: 1,
                    tickHeight: 20,
                    tickLeft: 0,
                    svgSize: { width: 20, height: 20 }
                },
                sliderRatio: 0.75,
                svgSize: {
                    width: 20,
                    height: 20
                },
                unitFontSize: 11,
                input: {
                    fontSize: 13,
                    width: '6ch',
                    padding: 0
                },
                grid: {
                    gap: 10,
                    padding: '0 10px'
                },
                toggle: {
                    div: {
                        paddingLeft: 16,
                        paddingRight: 16,
                        gap: 12,
                        fontSize: 12,
                    },
                    track: {
                        width: 28,
                        height: 14,
                        borderRadius: 20,
                        padding: 2,
                    },
                    button: {
                        width: 8,
                        height: 8,
                    }
                },
            }
        }
    });
    const [complexTrackpadOptions] = useState<ComplexTrackpadOptions>({ fineTuningLimit: 2, minValue: 0.000001 });
    const scaleXTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleXCursor, setScaleXCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleXValue, getComplexTrackCursor: getScaleXCursor } =
        useComplexTrackpadState(
            dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
            SCALE_MAX);
    const scaleYTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleYCursor, setScaleYCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleYValue, getComplexTrackCursor: getScaleYCursor } =
        useComplexTrackpadState(
            dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
            SCALE_MAX);
    const widthRef = useRef<HTMLInputElement>(null);
    const heightRef = useRef<HTMLInputElement>(null);
    const scaleXLiveTitleRef = useRef<HTMLDivElement | null>(null);
    const scaleYLiveTitleRef = useRef<HTMLDivElement | null>(null);

    const saveActiveScale = useCallback(async (scaleX: number | undefined, scaleY: number | undefined) => {
        if (!appState.activeElement) return;
        const activeElement = { ...appState.activeElement };
        if (!activeElement) return;
        const snapshot: LaurusProjectResult = { ...appState.project };

        switch (activeElement.type) {
            case "svg": {
                const newSvg = snapshot.svgs.get(activeElement.key);
                if (newSvg) {
                    const rollbackSvgs = new Map(snapshot.svgs);

                    const newSvgs = new Map(snapshot.svgs);
                    newSvgs.set(activeElement.key, {
                        ...newSvg,
                        ...(scaleX !== undefined && { scale_x: scaleX }),
                        ...(scaleY !== undefined && { scale_y: scaleY }),
                    });
                    const newProject: LaurusProjectResult = { ...snapshot, svgs: newSvgs }
                    const saved = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, newProject);
                    if (saved) {
                        dispatch({ type: WorkspaceActionType.SetProject, value: { ...newProject } });
                    }
                    else {
                        dispatch({ type: WorkspaceActionType.SetProject, value: { ...snapshot, svgs: rollbackSvgs } });
                    }
                }
                break;
            }
            case "img": {
                const newImg = snapshot.imgs.get(activeElement.key);
                if (newImg) {
                    const rollbackImgs = new Map(snapshot.imgs);

                    const newImgs = new Map(snapshot.imgs);
                    newImgs.set(activeElement.key, {
                        ...newImg,
                        ...(scaleX !== undefined && { scale_x: scaleX }),
                        ...(scaleY !== undefined && { scale_y: scaleY }),
                    });
                    const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs }
                    const saved = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, newProject);
                    if (saved) {
                        dispatch({ type: WorkspaceActionType.SetProject, value: { ...newProject } });
                    }
                    else {
                        dispatch({ type: WorkspaceActionType.SetProject, value: { ...snapshot, imgs: rollbackImgs } });
                    }
                }
                break;
            }
        }
    }, [appState.accessToken, appState.activeElement, appState.apiOrigin, appState.project, dispatch]);

    const getActiveDimensions = useCallback((newScaleValue: [number, number]): [number, number] => {
        if (!appState.activeElement) return [0, 0];
        const activeElement = { ...appState.activeElement };
        if (!activeElement) return [0, 0];
        const snapshot: LaurusProjectResult = { ...appState.project };
        switch (activeElement.type) {
            case "svg": {
                const svg = snapshot.svgs.get(activeElement.key);
                if (!svg) return [0, 0];
                return [svg.width * newScaleValue[0], svg.height * newScaleValue[1]]
            }
            case "img": {
                const img = snapshot.imgs.get(activeElement.key);
                if (!img) return [0, 0];
                return [img.width * newScaleValue[0], img.height * newScaleValue[1]]
            }
        }
    }, [appState.activeElement, appState.project]);

    const getActiveScale = useCallback((): [number, number] => {
        if (!appState.activeElement) return [1, 1];
        const activeElement = { ...appState.activeElement };
        if (!activeElement) return [1, 1];
        const snapshot: LaurusProjectResult = { ...appState.project };
        switch (activeElement.type) {
            case "svg": {
                const svg = snapshot.svgs.get(activeElement.key);
                if (!svg) return [1, 1];
                return [svg.scale_x, svg.scale_y]
            }
            case "img": {
                const img = snapshot.imgs.get(activeElement.key);
                if (!img) return [1, 1];
                return [img.scale_x, img.scale_y]
            }
        }
    }, [appState.activeElement, appState.project]);

    const sliderXContainerRef = useRef<HTMLDivElement | null>(null);
    const sliderYContainerRef = useRef<HTMLDivElement | null>(null);
    const [sliderColumnSize, setSliderColumnSize] = useState(0);
    useLayoutEffect(() => {
        (() => {
            if (sliderXContainerRef.current && sliderColumnSize <= 0) {
                const newSize = sliderXContainerRef.current.clientWidth * dynamicSizes.sliderRatio;
                setSliderColumnSize(newSize);
            }
        })();
    }, [dynamicSizes.sliderRatio, sliderColumnSize]);

    useEffect(() => {
        (() => {
            const scaleInit = getActiveScale();
            if (scaleXTrackRef.current && scaleXTrackRef.current.clientWidth > 0) {
                const newScaleCursor = getScaleXCursor(scaleInit[0], scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
                setScaleXCursor({ x: newScaleCursor, y: 0 });
            }
            else if (sliderColumnSize > 0) {
                const newScaleCursor = getScaleXCursor(scaleInit[0], sliderColumnSize, complexTrackpadOptions);
                setScaleXCursor({ x: newScaleCursor, y: 0 });
            }
            else {
                setScaleXCursor({ x: 0, y: 0 });
            }

            if (scaleYTrackRef.current && scaleYTrackRef.current.clientWidth > 0) {
                const newScaleYCursor = getScaleYCursor(scaleInit[1], scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
                setScaleYCursor({ x: newScaleYCursor, y: 0 });
            }
            else if (sliderColumnSize > 0) {
                const newScaleYCursor = getScaleYCursor(scaleInit[1], sliderColumnSize, complexTrackpadOptions);
                setScaleYCursor({ x: newScaleYCursor, y: 0 });
            }
            else {
                setScaleYCursor({ x: 0, y: 0 });
            }

            if (widthRef.current && heightRef.current) {
                const dimensions = getActiveDimensions(scaleInit);
                widthRef.current.value = (dimensions[0]).toFixed(0);
                heightRef.current.value = (dimensions[1]).toFixed(0);
            }
        })();
    }, [appState.tool.type, complexTrackpadOptions, getActiveDimensions, getActiveScale, getScaleXCursor, getScaleYCursor, sliderColumnSize]);

    const scaleXTitle = useMemo(() => {
        const scaleX = getActiveScale()[0];
        const decimalPlaces = scaleX >= 10 ? 2 : 3;
        return appState.activeElement == undefined ? '' : scaleX.toFixed(decimalPlaces) + 'x';
    }, [appState.activeElement, getActiveScale]);

    const scaleYTitle = useMemo(() => {
        const scaleY = getActiveScale()[1];
        const decimalPlaces = scaleY >= 10 ? 2 : 3;
        return appState.activeElement == undefined ? '' : scaleY.toFixed(decimalPlaces) + 'x';
    }, [appState.activeElement, getActiveScale]);

    return <>
        <div style={
            {
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                width: '100%',
                overflowX: 'auto',
            }}>
            <SvgRepo
                svg={allOut()}
                containerStyle={{
                    width: dynamicSizes.svgSize.width,
                    height: dynamicSizes.svgSize.height
                }}
                scale={1}
                scaleToContaier={true} />
            <div ref={sliderXContainerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    gridTemplateRows: 'auto',
                    gridTemplateColumns: `${sliderColumnSize}px min-content min-content`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...dynamicSizes.grid
                }}>
                <ParameterSliderXPlusMinus
                    label={"zoom"}
                    hash={`${appState.activeElement?.key ?? 'scalebar'}|scalex`}
                    size={dynamicSizes.paramSize}
                    containerRef={scaleXTrackRef}
                    cursor={scaleXCursor}
                    onCursorMove={(newCursor) => {
                        if (!scaleXTrackRef.current || !widthRef.current || !heightRef.current || !scaleXLiveTitleRef.current) return;
                        const newScaleXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
                        const scaledDimensions = getActiveDimensions([newScaleXValue, newScaleXValue]);
                        widthRef.current.value = scaledDimensions[0].toFixed(0);
                        const decimalPlaces = newScaleXValue >= 10 ? 2 : 3;
                        scaleXLiveTitleRef.current.innerHTML = newScaleXValue.toFixed(decimalPlaces) + 'x';
                        if (!unlockAspectRatio) {
                            heightRef.current.value = scaledDimensions[1].toFixed(0);
                        }
                    }}
                    onNewCursor={(newCursor) => {
                        if (!scaleXTrackRef.current || !scaleYTrackRef.current) return;
                        setScaleXCursor({ ...newCursor, y: 0 });
                        if (!unlockAspectRatio) {
                            const d = getActiveScale();
                            const r = d[0] / d[1];
                            const newYCursor = newCursor.x / r;
                            const newXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
                            const newYValue = newXValue / r;
                            setScaleYCursor({ x: newYCursor, y: 0 });
                            saveActiveScale(newXValue, newYValue);
                        }
                        else {
                            const newXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
                            saveActiveScale(newXValue, undefined);
                        }
                    }}
                    disabled={appState.activeElement == undefined}
                    title={scaleXTitle}
                    liveTitleRef={scaleXLiveTitleRef} />
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: appState.activeElement == undefined ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                    fontSize: dynamicSizes.unitFontSize,
                }}>
                    {'width'}
                </div>
                <input className={styles['numberInput']}
                    id={`${appState.activeElement?.key ?? 'scalebar'}|input|scalex`}
                    disabled
                    ref={widthRef}
                    type="text"
                    style={{
                        textAlign: "center",
                        background: 'none',
                        color: appState.activeElement == undefined ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                        border: 'none',
                        outline: 'none',
                        display: 'inline-block',
                        overflowX: 'scroll',
                        ...dynamicSizes.input
                    }}
                />
            </div>
            <div ref={sliderYContainerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    gridTemplateRows: 'auto',
                    gridTemplateColumns: `${sliderColumnSize}px min-content min-content`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                    ...dynamicSizes.grid
                }}>
                <ParameterSliderXPlusMinus
                    label={"zoom"}
                    hash={`${appState.activeElement?.key ?? 'scalebar'}|scaley`}
                    size={dynamicSizes.paramSize}
                    containerRef={scaleYTrackRef}
                    cursor={scaleYCursor}
                    onCursorMove={(newCursor) => {
                        if (!scaleYTrackRef.current || !heightRef.current || !widthRef.current || !scaleYLiveTitleRef.current) return;
                        const newScaleYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
                        const scaledDimensions = getActiveDimensions([newScaleYValue, newScaleYValue]);
                        const decimalPlaces = newScaleYValue >= 10 ? 2 : 3;
                        heightRef.current.value = scaledDimensions[1].toFixed();
                        scaleYLiveTitleRef.current.innerHTML = newScaleYValue.toFixed(decimalPlaces) + 'x';
                        if (!unlockAspectRatio) {
                            widthRef.current.value = scaledDimensions[0].toFixed();
                        }
                    }}
                    onNewCursor={(newCursor) => {
                        if (!scaleXTrackRef.current || !scaleYTrackRef.current) return;
                        setScaleYCursor({ ...newCursor, y: 0 });
                        if (!unlockAspectRatio) {
                            const d = getActiveScale();
                            const r = d[0] / d[1];
                            const newXCursor = newCursor.x * r;
                            const newYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
                            const newXValue = newYValue * r;
                            setScaleXCursor({ x: newXCursor, y: 0 });
                            saveActiveScale(newXValue, newYValue);
                        }
                        else {
                            const newYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
                            saveActiveScale(undefined, newYValue);
                        }
                    }}
                    disabled={appState.activeElement == undefined}
                    title={scaleYTitle}
                    liveTitleRef={scaleYLiveTitleRef} />
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: appState.activeElement == undefined ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                    fontSize: dynamicSizes.unitFontSize
                }}>
                    {'height'}
                </div>
                <input className={styles['numberInput']}
                    id={`${appState.activeElement?.key ?? 'scalebar'}|input|scaley`}
                    disabled
                    ref={heightRef}
                    type="text"
                    style={{
                        textAlign: "center",
                        background: 'none',
                        color: appState.activeElement == undefined ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                        border: 'none',
                        outline: 'none',
                        display: 'inline-block',
                        overflowX: 'scroll',
                        ...dynamicSizes.input
                    }}
                />
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                ...dynamicSizes.toggle.div
            }}>
                <SvgRepo
                    title="aspect ratio lock"
                    svg={unlockAspectRatio ? linkOff() : link()}
                    containerStyle={{
                        width: dynamicSizes.svgSize.width,
                        height: dynamicSizes.svgSize.height
                    }}
                    scale={1}
                    scaleToContaier={true} />
                <Toggle
                    value={!unlockAspectRatio}
                    onClick={() => {
                        setUnlockAspectRatio(v => !v);
                    }}
                    trackStyles={{ ...dynamicSizes.toggle.track }}
                    buttonStyles={{ ...dynamicSizes.toggle.button }} />
            </div>
        </div>
    </>
}
