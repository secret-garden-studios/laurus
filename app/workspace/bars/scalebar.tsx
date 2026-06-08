import { ParameterSliderXPlusMinus } from "@/app/components/parameter-slider";
import { ComplexTrackpadOptions, useComplexTrackpadState } from "@/app/hooks/useComplexTrackpadState";
import { LaurusProjectImg, LaurusProjectResult, LaurusProjectSvg } from "@/app/projects/projects.client";
import { updateProject } from "@/app/projects/projects.server";
import { SvgRepo, allOut, link, linkOff } from "@/app/svg-repo";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorkspaceActionType, WorkspaceContext, HoverContext } from "../workspace.client";
import { SCALE_MAX } from "../workspace.config";
import Toggle from "@/app/components/toggle";
import styles from "@/app/app.module.css";

export default function Scalebar() {
    const { appState, dispatch } = useContext(WorkspaceContext);
    const { selectedImgKeys, selectedSvgKeys } = useContext(HoverContext);
    const target = useMemo(() => {
        return selectedImgKeys.size > 0 ? { key: Array.from(selectedImgKeys)[0], type: 'img' as const } :
            selectedSvgKeys.size > 0 ? { key: Array.from(selectedSvgKeys)[0], type: 'svg' as const } :
                null;
    }, [selectedImgKeys, selectedSvgKeys]);
    const isMultiSelect = useMemo(() => (selectedImgKeys.size + selectedSvgKeys.size) > 1, [selectedImgKeys, selectedSvgKeys]);
    const [relativeScaleX, setRelativeScaleX] = useState(1);
    const [relativeScaleY, setRelativeScaleY] = useState(1);
    const [appliedScaleX, setAppliedScaleX] = useState(1);
    const [appliedScaleY, setAppliedScaleY] = useState(1);
    const [prevImgKeys, setPrevImgKeys] = useState(selectedImgKeys);
    const [prevSvgKeys, setPrevSvgKeys] = useState(selectedSvgKeys);
    const [isSaving, setIsSaving] = useState(false);

    // beta: render-phase state adjustment pattern
    if (selectedImgKeys !== prevImgKeys || selectedSvgKeys !== prevSvgKeys) {
        setPrevImgKeys(selectedImgKeys);
        setPrevSvgKeys(selectedSvgKeys);
        setRelativeScaleX(1);
        setRelativeScaleY(1);
        setAppliedScaleX(1);
        setAppliedScaleY(1);
    }

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
                    tickLeft: 0,
                    svgSize: { width: 24, height: 24 }
                },
                sliderRatio: 0.8,
                svgSize: {
                    width: 20,
                    height: 20
                },
                inputLabel: {
                    width: '6ch',
                    fontSize: 12
                },
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
                    tickLeft: 0,
                    svgSize: { width: 20, height: 20 }
                },
                sliderRatio: 0.8,
                svgSize: {
                    width: 18,
                    height: 18
                },
                inputLabel: {
                    width: '6ch',
                    fontSize: 10
                },
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
                inputLabel: {
                    width: '6ch',
                    fontSize: 11
                },
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
        if (isSaving) return;
        setIsSaving(true);

        const snapshot: LaurusProjectResult = { ...appState.project };
        const newImgs = new Map(snapshot.imgs);
        const newSvgs = new Map(snapshot.svgs);

        const updateItem = (key: string, type: 'img' | 'svg') => {
            const m = type === 'img' ? newImgs.get(key) : newSvgs.get(key);
            if (!m) return;

            let nextScaleX = m.scale_x;
            let nextScaleY = m.scale_y;

            if (isMultiSelect) {
                if (scaleX !== undefined) {
                    const multiplier = scaleX / appliedScaleX;
                    nextScaleX *= multiplier;
                }
                if (scaleY !== undefined) {
                    const multiplier = scaleY / appliedScaleY;
                    nextScaleY *= multiplier;
                }
            } else {
                if (scaleX !== undefined) nextScaleX = scaleX;
                if (scaleY !== undefined) nextScaleY = scaleY;
            }

            if (type === 'img') {
                newImgs.set(key, { ...m as LaurusProjectImg, scale_x: nextScaleX, scale_y: nextScaleY });
            } else {
                newSvgs.set(key, { ...m as LaurusProjectSvg, scale_x: nextScaleX, scale_y: nextScaleY });
            }
        };

        selectedImgKeys.forEach(key => updateItem(key, 'img'));
        selectedSvgKeys.forEach(key => updateItem(key, 'svg'));

        const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs, svgs: newSvgs };
        try {
            const saved = await updateProject(appState.apiOrigin, appState.accessToken, newProject.project_id, newProject);
            if (saved) {
                dispatch({ type: WorkspaceActionType.SetProject, value: { ...newProject } });
                if (isMultiSelect) {
                    if (scaleX !== undefined) setAppliedScaleX(scaleX);
                    if (scaleY !== undefined) setAppliedScaleY(scaleY);
                }
            } else {
                dispatch({ type: WorkspaceActionType.SetProject, value: snapshot });
            }
        } finally {
            setIsSaving(false);
        }
    }, [appState.accessToken, appState.apiOrigin, appState.project, dispatch, selectedImgKeys, selectedSvgKeys, isMultiSelect, appliedScaleX, appliedScaleY, isSaving]);

    const isSelectionEmpty = useMemo(() => {
        return selectedImgKeys.size === 0 && selectedSvgKeys.size === 0;
    }, [selectedImgKeys.size, selectedSvgKeys.size]);

    const getActiveDimensions = useCallback((newScaleValue: [number, number]): [number, number] => {
        if (isMultiSelect) return newScaleValue;
        if (!target) return [0, 0];

        const snapshot: LaurusProjectResult = { ...appState.project };
        if (target.type === "svg") {
            const svg = snapshot.svgs.get(target.key);
            if (!svg) return [0, 0];
            return [svg.width * newScaleValue[0], svg.height * newScaleValue[1]]
        } else {
            const img = snapshot.imgs.get(target.key);
            if (!img) return [0, 0];
            return [img.width * newScaleValue[0], img.height * newScaleValue[1]]
        }
    }, [appState.project, target, isMultiSelect]);

    const getActiveScale = useCallback((): [number, number] => {
        if (isMultiSelect) return [relativeScaleX, relativeScaleY];
        if (!target) return [1, 1];

        const snapshot: LaurusProjectResult = { ...appState.project };
        if (target.type === "svg") {
            const svg = snapshot.svgs.get(target.key);
            if (!svg) return [1, 1];
            return [svg.scale_x, svg.scale_y]
        } else {
            const img = snapshot.imgs.get(target.key);
            if (!img) return [1, 1];
            return [img.scale_x, img.scale_y]
        }
    }, [appState.project, target, isMultiSelect, relativeScaleX, relativeScaleY]);

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
                const precision = isMultiSelect ? 3 : 0;
                widthRef.current.value = (dimensions[0]).toFixed(precision);
                heightRef.current.value = (dimensions[1]).toFixed(precision);
            }
        })();
    }, [appState.tool.type, complexTrackpadOptions, getActiveDimensions, getActiveScale, getScaleXCursor, getScaleYCursor, sliderColumnSize, isMultiSelect]);

    const scaleXTitle = useMemo(() => {
        const scaleX = getActiveScale()[0];
        const decimalPlaces = scaleX >= 10 ? 2 : 3;
        return isSelectionEmpty ? '' : scaleX.toFixed(decimalPlaces) + 'x';
    }, [isSelectionEmpty, getActiveScale]);

    const scaleYTitle = useMemo(() => {
        const scaleY = getActiveScale()[1];
        const decimalPlaces = scaleY >= 10 ? 2 : 3;
        return isSelectionEmpty ? '' : scaleY.toFixed(decimalPlaces) + 'x';
    }, [isSelectionEmpty, getActiveScale]);

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
                    borderLeft: '1px solid rgba(255, 255, 255, 0)',
                    ...dynamicSizes.grid
                }}>
                <ParameterSliderXPlusMinus
                    label={"zoom"}
                    hash={`${target?.key ?? 'scalebar'}|scalex`}
                    size={dynamicSizes.paramSize}
                    containerRef={scaleXTrackRef}
                    cursor={scaleXCursor}
                    onCursorMove={(newCursor) => {
                        if (!scaleXTrackRef.current || !widthRef.current || !heightRef.current || !scaleXLiveTitleRef.current) return;
                        const newScaleXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
                        const scaledDimensions = getActiveDimensions([newScaleXValue, newScaleXValue]);
                        const precision = isMultiSelect ? 3 : 0;
                        widthRef.current.value = scaledDimensions[0].toFixed(precision);
                        const decimalPlaces = newScaleXValue >= 10 ? 2 : 3;
                        scaleXLiveTitleRef.current.innerHTML = newScaleXValue.toFixed(decimalPlaces) + 'x';
                        if (!unlockAspectRatio) {
                            heightRef.current.value = scaledDimensions[1].toFixed(precision);
                        }
                    }}
                    onNewCursor={(newCursor) => {
                        if (!scaleXTrackRef.current || !scaleYTrackRef.current) return;
                        setScaleXCursor({ ...newCursor, y: 0 });
                        const newXValue = getScaleXValue(newCursor.x, scaleXTrackRef.current.clientWidth, complexTrackpadOptions);
                        if (isMultiSelect) setRelativeScaleX(newXValue);

                        if (!unlockAspectRatio) {
                            const d = getActiveScale();
                            const r = d[0] / d[1];
                            const newYCursor = newCursor.x / r;
                            const newYValue = newXValue / r;
                            setScaleYCursor({ x: newYCursor, y: 0 });
                            if (isMultiSelect) setRelativeScaleY(newYValue);
                            saveActiveScale(newXValue, newYValue);
                        }
                        else {
                            saveActiveScale(newXValue, undefined);
                        }
                    }}
                    disabled={isSelectionEmpty}
                    title={scaleXTitle}
                    liveTitleRef={scaleXLiveTitleRef} />
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelectionEmpty ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                    ...dynamicSizes.inputLabel
                }}>
                    {'width'}
                </div>
                <input className={styles['numberInput']}
                    id={`${target?.key ?? 'scalebar'}|input|scalex`}
                    disabled
                    ref={widthRef}
                    type="text"
                    style={{
                        textAlign: "center",
                        background: 'none',
                        color: isSelectionEmpty ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                        outline: 'none',
                        border: 'none',
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
                    hash={`${target?.key ?? 'scalebar'}|scaley`}
                    size={dynamicSizes.paramSize}
                    containerRef={scaleYTrackRef}
                    cursor={scaleYCursor}
                    onCursorMove={(newCursor) => {
                        if (!scaleYTrackRef.current || !heightRef.current || !widthRef.current || !scaleYLiveTitleRef.current) return;
                        const newScaleYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
                        const scaledDimensions = getActiveDimensions([newScaleYValue, newScaleYValue]);
                        const decimalPlaces = newScaleYValue >= 10 ? 2 : 3;
                        const precision = isMultiSelect ? 3 : 0;
                        heightRef.current.value = scaledDimensions[1].toFixed(precision);
                        scaleYLiveTitleRef.current.innerHTML = newScaleYValue.toFixed(decimalPlaces) + 'x';
                        if (!unlockAspectRatio) {
                            widthRef.current.value = scaledDimensions[0].toFixed(precision);
                        }
                    }}
                    onNewCursor={(newCursor) => {
                        if (!scaleXTrackRef.current || !scaleYTrackRef.current) return;
                        setScaleYCursor({ ...newCursor, y: 0 });
                        const newYValue = getScaleYValue(newCursor.x, scaleYTrackRef.current.clientWidth, complexTrackpadOptions);
                        if (isMultiSelect) setRelativeScaleY(newYValue);

                        if (!unlockAspectRatio) {
                            const d = getActiveScale();
                            const r = d[0] / d[1];
                            const newXCursor = newCursor.x * r;
                            const newXValue = newYValue * r;
                            setScaleXCursor({ x: newXCursor, y: 0 });
                            if (isMultiSelect) setRelativeScaleX(newXValue);
                            saveActiveScale(newXValue, newYValue);
                        }
                        else {
                            saveActiveScale(undefined, newYValue);
                        }
                    }}
                    disabled={isSelectionEmpty}
                    title={scaleYTitle}
                    liveTitleRef={scaleYLiveTitleRef} />
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelectionEmpty ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                    ...dynamicSizes.inputLabel
                }}>
                    {'height'}
                </div>
                <input className={styles['numberInput']}
                    id={`${target?.key ?? 'scalebar'}|input|scaley`}
                    disabled
                    ref={heightRef}
                    type="text"
                    style={{
                        textAlign: "center",
                        background: 'none',
                        color: isSelectionEmpty ? 'rgb(67, 67, 67)' : "rgb(227, 227, 227)",
                        outline: 'none',
                        border: 'none',
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
