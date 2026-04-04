import { useRef, useState, useCallback, useLayoutEffect } from "react";
import ParameterSlider from "../components/parameter-slider";
import TimelineSlider from "../components/timeline-slider";
import { dellaRespira } from "../fonts";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { SvgRepo, volumeUp, noSound, pauseNoFill, playArrowNoFill, upload, cancelCircle, threeSixtyLeft, threeSixtyRight } from "../svg-repo";
import { VideoMediaResult, YouTubePlayerControl } from "./screens.client";
import { ScreensResolution } from "./screens-resolution";

function formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return [hours, minutes, seconds]
        .map(unit => String(unit).padStart(2, '0'))
        .join(':');
}

interface RemoteControl {
    i: number,
    videoMedia: VideoMediaResult,
    resolution: ScreensResolution,
    onNewClip: (newStart: number, newEnd: number) => void,
    onNewControl: (newControl: YouTubePlayerControl) => void,
    onNewMute: (newMute: boolean) => void,
    onRemoteControl: (control: YouTubePlayerControl) => number | undefined,
    onNewNote: (newNote: string) => void,
    onDeleteVideoMedia: () => void,
}
export default function RemoteControl({
    i,
    videoMedia,
    resolution,
    onNewClip,
    onNewControl,
    onNewMute,
    onRemoteControl,
    onNewNote,
    onDeleteVideoMedia }: RemoteControl) {

    const timelineTrackRef = useRef<HTMLDivElement | null>(null);
    const endRef = useRef<HTMLInputElement | null>(null);
    const startRef = useRef<HTMLInputElement | null>(null);
    const volumeTrackRef = useRef<HTMLDivElement | null>(null);

    const [notepad, setNotepad] = useState<string>(videoMedia.notes);
    const [gapSize] = useState({ outer: Math.round(10 * resolution.factor), inner: Math.round(5 * resolution.factor) });
    const [controlPanelSize] = useState({
        padding: Math.round(20 * resolution.factor),
        playContainer: Math.round(96 * resolution.factor),
        playSvg: Math.round(60 * resolution.factor),
        clipSvg: Math.round(22 * resolution.factor)
    });
    const [notesPanelSize] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                padding: Math.round(10 * resolution.factor),
                notesPaddingTop: Math.round(10 * resolution.factor),
                textareaPaddingTop: 2,
                svg: Math.round(20 * resolution.factor),
                titleFont: 14,
                timestampFont: 11,
                notesFont: 13,
                textareaFont: 12,
            }
            case "midhigh": return {
                padding: Math.round(10 * resolution.factor),
                notesPaddingTop: Math.round(10 * resolution.factor),
                textareaPaddingTop: 2,
                svg: Math.round(20 * resolution.factor),
                titleFont: 12,
                timestampFont: 10,
                notesFont: 12,
                textareaFont: 11,
            }
            case "midlow": return {
                padding: Math.round(10 * resolution.factor),
                notesPaddingTop: Math.round(10 * resolution.factor),
                textareaPaddingTop: 2,
                svg: Math.round(20 * resolution.factor),
                titleFont: 11,
                timestampFont: 9,
                notesFont: 11,
                textareaFont: 10,
            }
            case "low": return {
                padding: Math.round(10 * resolution.factor),
                notesPaddingTop: Math.round(10 * resolution.factor),
                textareaPaddingTop: 2,
                svg: Math.round(20 * resolution.factor),
                titleFont: 11,
                timestampFont: 9,
                notesFont: 11,
                textareaFont: 10,
            }
        }
    });

    const [timelineSize] = useState(() => {
        const minW = 400;
        switch (resolution.type) {
            case "high": {
                const w = window.innerWidth - videoMedia.width - 140;
                return {
                    padding: Math.round(5 * resolution.factor),
                    width: w > minW ? w : Math.max(window.innerHeight, window.innerWidth),
                    font: 12
                }
            }
            case "midhigh": {
                const w = window.innerWidth - videoMedia.width - Math.round(140 * resolution.factor) - 4;
                return {
                    padding: Math.round(5 * resolution.factor),
                    width: w > minW ? w : Math.max(window.innerHeight, window.innerWidth),
                    font: 10
                }
            }
            case "midlow": {
                const w = window.innerWidth - videoMedia.width - Math.round(140 * resolution.factor) - 8;
                return {
                    padding: Math.round(5 * resolution.factor),
                    width: w > minW ? w : Math.max(window.innerHeight, window.innerWidth),
                    font: 9
                }
            }
            case "low": {
                const w = window.innerWidth - videoMedia.width - Math.round(140 * resolution.factor) - 12;
                return {
                    padding: 0,
                    width: w > minW ? w : Math.max(window.innerHeight, window.innerWidth),
                    font: 8
                }
            }
        }
    });

    const [timelineTrackPadding] = useState({
        right: Math.round(15 * resolution.factor),
        left: Math.round(15 * resolution.factor),
        bottom: 10
    });
    const [timelineTrackSize] = useState({
        width: '100%',
        height: Math.round(resolution.type == 'high' ? 56 : 50 * resolution.factor)
    });
    const [startCapSize] = useState({
        width: Math.round(17 * resolution.factor),
        height: Math.round(resolution.type == 'high' ? 56 : 50 * resolution.factor)
    });
    const [endCapSize] = useState({
        width: Math.round(17 * resolution.factor),
        height: Math.round(resolution.type == 'high' ? 56 : 50 * resolution.factor)
    });
    const [startCursor, setStartCursor] = useState({ x: 0, y: 0 });
    const [endCursor, setEndCursor] = useState({ x: 0, y: 0 });

    const [volumeSize] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                width: 100,
                padding: "20px 0px",
                innerPadding: "20px 0px",
                svg: Math.round(20 * resolution.factor),
            }
            case "midhigh": return {
                width: 90,
                padding: "20px 0px",
                innerPadding: "20px 0px",
                svg: Math.round(20 * resolution.factor),
            }
            case "midlow": return {
                width: Math.round(100 * resolution.factor),
                padding: "20px 0px",
                innerPadding: "20px 0px",
                svg: Math.round(20 * resolution.factor),
            }
            case "low": return {
                width: Math.round(100 * resolution.factor),
                padding: "20px 0px",
                innerPadding: "20px 0px",
                svg: Math.round(20 * resolution.factor),
            }
        }
    });
    const [volumeCapSize] = useState({
        width: Math.round(45 * resolution.factor),
        height: Math.round(21 * resolution.factor)
    });
    const [volumeTrackSize] = useState({
        width: Math.round(45 * resolution.factor),
        height: '100%'
    });
    const [volumeGrooveWidth] = useState(Math.round(10 * resolution.factor));
    const [volumeCursor, setVolumeCursor] = useState({ x: 0, y: 0 });
    const [volumeLimit] = useState(100);

    const { getTrackValue: getTimeValue, getTrackCursor: getTimeCursor } =
        useTrackpadState(0, videoMedia.duration);

    const cursorToTime = useCallback((cursorX: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getTimeValue(cursorX, (timelineTrackRef.current.clientWidth - timelineTrackPadding.right), 0);
    }, [getTimeValue, timelineTrackPadding.right]);

    const timeToCursor = useCallback((time: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getTimeCursor(time, (timelineTrackRef.current.clientWidth - timelineTrackPadding.right));
    }, [getTimeCursor, timelineTrackPadding.right]);

    const adjustEndCursor = useCallback((newX: number): number => {
        if (endCursor.x < newX && endRef.current) {
            const newValue = cursorToTime(newX);
            setEndCursor({ ...endCursor, x: newX });
            endRef.current.innerHTML = formatTime(newValue);
            return newValue;
        }
        return cursorToTime(endCursor.x);
    }, [cursorToTime, endCursor]);

    const adjustStartCursor = useCallback((newX: number): number => {
        if (startCursor.x > newX && startRef.current) {
            const newValue = cursorToTime(newX);
            setStartCursor({ ...startCursor, x: newX });
            const newStart = formatTime(newValue)
            startRef.current.innerHTML = newStart;
            return newValue;
        }
        return cursorToTime(startCursor.x);
    }, [cursorToTime, startCursor]);

    const { getInverseTrackValue: getVolumeValue, getTrackCursor: getVolumeCursor } =
        useTrackpadState(
            volumeCapSize.height - 2,
            volumeLimit);

    useLayoutEffect(() => {
        (async () => {
            if (!volumeTrackRef.current) return;
            const volumeInit = 0;
            const newVolumeCursor = getVolumeCursor(
                volumeLimit - volumeInit,
                (volumeTrackRef.current.clientHeight));
            setVolumeCursor({ y: newVolumeCursor, x: 0 });

        })();
    }, [getVolumeCursor, volumeLimit]);

    useLayoutEffect(() => {
        (async () => {
            const startInit = Math.min(videoMedia.duration, Math.max(0, videoMedia.start));
            const endInit = Math.min(videoMedia.duration, Math.max(0, videoMedia.end >= videoMedia.start ? videoMedia.end : videoMedia.duration));
            const newStartCursor = timeToCursor(startInit);
            const newEndCursor = timeToCursor(endInit);
            setStartCursor({ x: newStartCursor, y: 0 });
            setEndCursor({ x: newEndCursor, y: 0 });

            if (startRef.current) {
                const newStart = cursorToTime(newStartCursor);
                startRef.current.value = formatTime(newStart);
            }

            if (endRef.current) {
                const newEnd = cursorToTime(newEndCursor);
                endRef.current.value = formatTime(newEnd);
            }
        })();
    }, [cursorToTime, timeToCursor, videoMedia.duration, videoMedia.start, videoMedia.end]);

    return (<>
        <div
            style={{
                display: 'grid',
                height: '100%',
                justifyContent: 'start',
                gridTemplateRows: 'auto min-content',
                gridTemplateColumns: `min-content ${videoMedia.height * (3 / 4)}px auto`,
                borderRadius: 10,
                gap: gapSize.outer,
            }}>
            <div style={{
                gridColumn: 1,
                gridRow: '1 / span 2',
                background: i % 2 == 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.01)',
                width: volumeSize.width,
                padding: volumeSize.padding,
                justifyContent: 'center',
                display: 'grid',
                gridTemplateRows: 'min-content auto min-content',
                border: '1px solid rgba(255,255,255, 0.1)',
                borderRadius: 10,
            }}>
                <div style={{
                    display: 'grid',
                    placeContent: 'center'
                }}>
                    <SvgRepo
                        svg={volumeUp()}
                        containerSize={{
                            width: volumeSize.svg,
                            height: volumeSize.svg
                        }}
                        scale={1} />
                </div>
                <div style={{ padding: volumeSize.innerPadding }}>
                    <ParameterSlider
                        label={""}
                        hash={`${videoMedia.video_media_id}|p1`}
                        capSize={volumeCapSize}
                        trackSize={volumeTrackSize}
                        trackRef={volumeTrackRef}
                        cursor={volumeCursor}
                        onNewCursor={(newCursor) => {
                            if (!volumeTrackRef.current) return;
                            setVolumeCursor({ ...newCursor, x: 0 });
                            const newVolume = getVolumeValue(newCursor.y, volumeTrackRef.current.clientHeight, 0);
                            onNewMute(newVolume == 0 ? true : false);
                        }}
                        onCursorMove={(newCursor) => {
                            if (!volumeTrackRef.current) return;
                            const newVolume = getVolumeValue(newCursor.y, volumeTrackRef.current.clientHeight, 0);
                            const newControl: YouTubePlayerControl = {
                                type: 'setVolume',
                                key: videoMedia.media_key,
                                value: Math.round(newVolume)
                            }
                            onNewControl(newControl);
                        }}
                        grooveWidth={volumeGrooveWidth} />
                </div>
                <div style={{
                    display: 'grid',
                    placeContent: 'center'
                }}>
                    <SvgRepo
                        svg={noSound()}
                        containerSize={{
                            width: volumeSize.svg,
                            height: volumeSize.svg
                        }}
                        scale={1} />
                </div>
            </div>
            <div
                style={{
                    gridColumn: 2,
                    gridRow: '1',
                    border: '1px solid rgba(255,255,255, 0.1)',
                    borderRadius: 10,
                    background: i % 2 == 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.01)',
                    width: videoMedia.height * (3 / 4),
                    height: "100%",
                    padding: controlPanelSize.padding,
                    display: 'grid',
                    placeContent: "center",
                }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <SvgRepo
                        svg={threeSixtyLeft()}
                        containerSize={{
                            width: controlPanelSize.clipSvg,
                            height: controlPanelSize.clipSvg
                        }}
                        scale={1}
                        onContainerClick={() => {
                            const currentPlayTime = onRemoteControl({ type: 'getCurrentTime', key: videoMedia.media_key });
                            if (!currentPlayTime) return;
                            const newCursor = timeToCursor(currentPlayTime);
                            setStartCursor({ x: newCursor, y: 0 });
                            if (startRef.current) {
                                const newStart = cursorToTime(newCursor);
                                startRef.current.value = formatTime(newStart);
                            }
                            onNewClip(currentPlayTime, videoMedia.end);
                            onNewControl({ type: 'reload', key: videoMedia.media_key, value: { newStart: currentPlayTime, newEnd: videoMedia.end } });
                        }}
                    />
                    <div style={{
                        display: 'grid',
                        placeContent: 'center',
                        width: controlPanelSize.playContainer,
                        height: controlPanelSize.playContainer
                    }}>
                        <SvgRepo
                            svg={videoMedia.playing ? pauseNoFill() : playArrowNoFill()}
                            containerSize={{
                                width: controlPanelSize.playSvg,
                                height: controlPanelSize.playSvg
                            }}
                            scale={videoMedia.playing ? 1 : 1.5}
                            onContainerClick={() => {
                                const newControl: YouTubePlayerControl = {
                                    type: 'playPause',
                                    key: videoMedia.media_key,
                                }
                                onNewControl(newControl);
                            }} />
                    </div>
                    <SvgRepo
                        svg={threeSixtyRight()}
                        containerSize={{
                            width: controlPanelSize.clipSvg,
                            height: controlPanelSize.clipSvg
                        }}
                        scale={1}
                        onContainerClick={() => {
                            const currentPlayTime = onRemoteControl({ type: 'getCurrentTime', key: videoMedia.media_key });
                            if (!currentPlayTime) return;
                            const newCursor = timeToCursor(currentPlayTime);
                            setEndCursor({ x: newCursor, y: 0 });
                            if (endRef.current) {
                                const newEnd = cursorToTime(newCursor);
                                endRef.current.value = formatTime(newEnd);
                            }
                            onNewClip(videoMedia.start, currentPlayTime);
                            onNewControl({ type: 'reload', key: videoMedia.media_key, value: { newStart: videoMedia.start, newEnd: currentPlayTime } });
                        }} />
                </div>
            </div>

            <div
                className={dellaRespira.className}
                style={{
                    gridColumn: 3,
                    gridRow: 1,
                    border: '1px solid rgba(255,255,255, 0.1)',
                    borderRadius: 10,
                    background: i % 2 == 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.01)',
                    padding: notesPanelSize.padding,
                    display: 'grid',
                    gridTemplateRows: 'min-content min-content min-content auto',
                    gridTemplateColumns: 'auto min-content'
                }}>
                <div
                    style={{
                        gridColumn: 1,
                        fontSize: notesPanelSize.titleFont,
                        letterSpacing: '2px',
                        fontWeight: 'bold',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                        marginRight: 6,
                    }}>
                    {videoMedia.title}
                </div>
                <div
                    style={{
                        gridColumn: 1,
                        fontSize: notesPanelSize.timestampFont,
                        letterSpacing: '1px',
                    }}>
                    <i>{videoMedia.timestamp}</i>
                </div>
                <div style={{
                    gridColumn: 1,
                    paddingTop: notesPanelSize.notesPaddingTop,
                    fontSize: notesPanelSize.notesFont,
                }}><i>{'notes:'}</i></div>
                <textarea
                    value={notepad}
                    onChange={(e) => {
                        setNotepad(e.currentTarget.value);
                    }}
                    className={dellaRespira.className}
                    style={{
                        gridColumn: 1,
                        width: '100%',
                        resize: 'none',
                        borderRadius: 0,
                        border: 'none',
                        background: 'rgba(7,7,7,0)',
                        caretColor: 'rgb(255, 255, 255)',
                        outline: 'none',
                        paddingTop: notesPanelSize.textareaPaddingTop,
                        fontSize: notesPanelSize.textareaFont,
                        letterSpacing: '1px',
                    }} />
                <div style={{
                    gridColumn: 2,
                    gridRow: '1 / -1',
                    width: 'min-content',
                    display: 'grid',
                    gridTemplateRows: 'min-content auto min-content'
                }}>
                    <SvgRepo
                        svg={upload()}
                        containerSize={{
                            width: notesPanelSize.svg,
                            height: notesPanelSize.svg
                        }}
                        scale={1}
                        onContainerClick={() => {
                            onNewNote(notepad);
                        }} />
                    <div />
                    <SvgRepo
                        svg={cancelCircle()}
                        containerSize={{
                            width: notesPanelSize.svg,
                            height: notesPanelSize.svg
                        }}
                        scale={0.9}
                        onContainerClick={() => {
                            onDeleteVideoMedia();
                        }} />
                </div>
            </div>
            <div
                className={dellaRespira.className}
                style={{
                    gridRow: '2',
                    gridColumn: '2 / -1',
                    padding: timelineSize.padding,
                    border: '1px solid rgba(255,255,255, 0.1)',
                    borderRadius: 10,
                    background: i % 2 == 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.01)',
                    fontSize: timelineSize.font,
                    width: timelineSize.width,
                    height: videoMedia.height * (1 / 4),
                    color: 'rgb(227, 227, 227)'
                }}>
                <div style={{ padding: 5, display: 'flex', justifyContent: 'space-between', }}>
                    <div style={{ display: 'flex', gap: gapSize.inner }}>
                        <div ref={startRef}>{formatTime(videoMedia.start)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: gapSize.inner }}>
                        <div ref={endRef}>{videoMedia.duration >= videoMedia.start ? formatTime(videoMedia.duration) : ""}</div>
                    </div>
                </div>
                <div
                    className={dellaRespira.className}
                    style={{
                        width: '100%',
                        paddingRight: timelineTrackPadding.right,
                        paddingBottom: timelineTrackPadding.bottom,
                        paddingLeft: timelineTrackPadding.left
                    }}>
                    <TimelineSlider
                        label={''}
                        labelSize={undefined}
                        hash={`${videoMedia.video_media_id}|t1`}
                        capSize={startCapSize}
                        rangeCapSize={endCapSize}
                        trackSize={timelineTrackSize}
                        trackRef={timelineTrackRef}
                        cursor={startCursor}
                        onNewCursor={async (c) => {
                            setStartCursor({ ...c });
                            const adjustedEnd = adjustEndCursor(c.x);
                            const newStart: number = cursorToTime(c.x);
                            onNewClip(newStart, adjustedEnd);
                            onNewControl({ type: 'seekTo', key: videoMedia.media_key, value: newStart });
                        }}
                        rangeCursor={endCursor}
                        onNewRangeCursor={async (c) => {
                            setEndCursor({ ...c });
                            const adjustedStart = adjustStartCursor(c.x);
                            const newEnd: number = cursorToTime(c.x);
                            onNewClip(adjustedStart, newEnd);
                            onNewControl({ type: 'reload', key: videoMedia.media_key, value: { newStart: adjustedStart, newEnd } });
                        }}
                        onCursorMove={(c) => {
                            if (!startRef.current) return;
                            const newValue = cursorToTime(c.x);
                            startRef.current.innerHTML = formatTime(newValue);
                        }}
                        onRangeMove={(c) => {
                            if (!endRef.current) return;
                            const newValue = cursorToTime(c.x);
                            endRef.current.innerHTML = formatTime(newValue);
                        }}
                    />
                </div>
            </div>
        </div>
    </>)
}