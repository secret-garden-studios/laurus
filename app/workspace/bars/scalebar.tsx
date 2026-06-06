import { ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { useComplexTrackpadState } from "@/app/hooks/useComplexTrackpadState";
import { LaurusProjectResult } from "@/app/projects/projects.client";
import { updateProject } from "@/app/projects/projects.server";
import { SvgRepo, allOut, link, linkOff } from "@/app/svg-repo";
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { WorkspaceActionType, WorkspaceContext } from "../workspace.client";
import { SCALE_MAX } from "../workspace.config";

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
                    capBorderOffset: 2,
                    trackHeight: 1,
                    tickHeight: 22,
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
                    containerWidth: '100%',
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
                    containerWidth: '100%',
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
    const [maxScale, setMaxScale] = useState(SCALE_MAX);
    const scaleXTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleXCursor, setScaleXCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleXValue, getComplexTrackCursor: getScaleXCursor } =
        useComplexTrackpadState(
            dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
            maxScale);
    const scaleYTrackRef = useRef<HTMLDivElement | null>(null);
    const [scaleYCursor, setScaleYCursor] = useState({ x: 0, y: 0 });
    const { getComplexTrackValue: getScaleYValue, getComplexTrackCursor: getScaleYCursor } =
        useComplexTrackpadState(
            dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
            maxScale);
    const widthRef = useRef<HTMLInputElement>(null);
    const heightRef = useRef<HTMLInputElement>(null);

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

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [sliderColumnSize, setSliderColumnSize] = useState(0);
    useLayoutEffect(() => {
        (() => {
            if (containerRef.current && sliderColumnSize <= 0) {
                const newSize = containerRef.current.clientWidth / 2;
                setSliderColumnSize(newSize);
            }
        })();
    }, [sliderColumnSize]);

    useEffect(() => {
        (() => {
            const scaleInit = getActiveScale();
            if (scaleXTrackRef.current && scaleXTrackRef.current.clientWidth > 0) {
                const newScaleCursor = getScaleXCursor(scaleInit[0], scaleXTrackRef.current.clientWidth);
                setScaleXCursor({ x: newScaleCursor, y: 0 });
            }
            else if (sliderColumnSize > 0) {
                const newScaleCursor = getScaleXCursor(scaleInit[0], sliderColumnSize);
                setScaleXCursor({ x: newScaleCursor, y: 0 });
            }
            else {
                setScaleXCursor({ x: 0, y: 0 });
            }

            if (scaleYTrackRef.current && scaleYTrackRef.current.clientWidth > 0) {
                const newScaleYCursor = getScaleYCursor(scaleInit[1], scaleYTrackRef.current.clientWidth);
                setScaleYCursor({ x: newScaleYCursor, y: 0 });
            }
            else if (sliderColumnSize > 0) {
                const newScaleYCursor = getScaleYCursor(scaleInit[1], sliderColumnSize);
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
    }, [appState.tool.type, getActiveDimensions, getActiveScale, getScaleXCursor, getScaleYCursor, sliderColumnSize]);

    useEffect(() => {
        (() => {
            const dimensions = getActiveDimensions([1, 1]);
            if (dimensions[0] > 0 && dimensions[1] > 0) {
                const quarterCanvas = 1500;
                const x = quarterCanvas / Math.max(dimensions[0], dimensions[1]);
                setMaxScale(x);
            }
        })()
    }, [getActiveDimensions]);

    return <>
        <div ref={containerRef} style={
            {
                width: '100%',
                display: 'grid',
                gridTemplateRows: 'auto',
                gridTemplateColumns: `min-content ${sliderColumnSize}px min-content ${sliderColumnSize}px min-content`,
                alignItems: 'center',
                height: '100%',
                overflowX: 'auto',
                ...dynamicSizes.grid,
            }}>
            <SvgRepo
                svg={allOut()}
                containerStyle={{
                    width: dynamicSizes.svgSize.width,
                    height: dynamicSizes.svgSize.height
                }}
                scale={1}
                scaleToContaier={true} />
            <ParameterSliderXPlusMinus
                label={"zoom"}
                hash={`${appState.activeElement?.key ?? 'scalebar'}|scalex`}
                size={dynamicSizes.paramSize}
                containerRef={scaleXTrackRef}
                cursor={scaleXCursor}
                onCursorMove={(newCursor) => {
                    if (!scaleXTrackRef.current || !widthRef.current || !heightRef.current) return;
                    const newScaleValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, { minValue: 0.000001 });
                    const scaledDimensions = getActiveDimensions([newScaleValue, newScaleValue]);
                    widthRef.current.value = (scaledDimensions[0]).toFixed(0);
                    if (!unlockAspectRatio) {
                        heightRef.current.value = (scaledDimensions[1]).toFixed(0);
                    }
                }}
                onNewCursor={(newCursor) => {
                    if (!scaleXTrackRef.current || !scaleYTrackRef.current) return;
                    setScaleXCursor({ ...newCursor, y: 0 });
                    if (!unlockAspectRatio) {
                        const d = getActiveScale();
                        const r = d[0] / d[1];
                        const newYCursor = newCursor.x / r;
                        const newXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, { minValue: 0.000001 });
                        const newYValue = newXValue / r;
                        setScaleYCursor({ x: newYCursor, y: 0 });
                        saveActiveScale(newXValue, newYValue);
                    }
                    else {
                        const newXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, { minValue: 0.000001 });
                        saveActiveScale(newXValue, undefined);
                    }
                }}
                disabled={appState.activeElement == undefined} />
            <SvgRepo
                svg={unlockAspectRatio ? linkOff() : link()}
                containerStyle={{
                    width: dynamicSizes.svgSize.width,
                    height: dynamicSizes.svgSize.height
                }}
                scale={0.75}
                scaleToContaier={true}
                onContainerClick={() => {
                    setUnlockAspectRatio(v => !v);
                }} />
            <ParameterSliderXPlusMinus
                label={"zoom"}
                hash={`${appState.activeElement?.key ?? 'scalebar'}|scaley`}
                size={dynamicSizes.paramSize}
                containerRef={scaleYTrackRef}
                cursor={scaleYCursor}
                onCursorMove={(newCursor) => {
                    if (!scaleYTrackRef.current || !heightRef.current || !widthRef.current) return;
                    const newScaleValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, { minValue: 0.000001 });
                    const scaledDimensions = getActiveDimensions([newScaleValue, newScaleValue]);
                    heightRef.current.value = (scaledDimensions[1]).toFixed(0);
                    if (!unlockAspectRatio) {
                        widthRef.current.value = (scaledDimensions[0]).toFixed(0);
                    }
                }}
                onNewCursor={(newCursor) => {
                    if (!scaleXTrackRef.current || !scaleYTrackRef.current) return;
                    setScaleYCursor({ ...newCursor, y: 0 });
                    if (!unlockAspectRatio) {
                        const d = getActiveScale();
                        const r = d[0] / d[1];
                        const newXCursor = newCursor.x * r;
                        const newYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, { minValue: 0.000001 });
                        const newXValue = newYValue * r;
                        setScaleXCursor({ x: newXCursor, y: 0 });
                        saveActiveScale(newXValue, newYValue);
                    }
                    else {
                        const newYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, { minValue: 0.000001 });
                        saveActiveScale(undefined, newYValue);
                    }
                }}
                disabled={appState.activeElement == undefined} />
            <div style={{
                display: 'grid',
                height: '100%',
                gridTemplateRows: 'min-content',
                gridTemplateColumns: 'min-content auto min-content auto',
                alignContent: 'center',
                ...dynamicSizes.grid
            }}>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: dynamicSizes.unitFontSize, letterSpacing: 0 }}>{'w'}</div>
                <input
                    id={`${appState.activeElement?.key ?? 'scalebar'}|input|scalex`}
                    disabled
                    ref={widthRef}
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
                <div style={{ display: 'flex', alignItems: 'center', fontSize: dynamicSizes.unitFontSize, letterSpacing: 0 }}>{'h'}</div>
                <input
                    id={`${appState.activeElement?.key ?? 'scalebar'}|input|scaley`}
                    disabled
                    ref={heightRef}
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
        </div>
    </>
}
