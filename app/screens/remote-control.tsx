import { useRef, useState, useCallback, useLayoutEffect } from "react";
import ParameterSlider from "../components/parameter-slider";
import TimelineSlider from "../components/timeline-slider";
import { dellaRespira } from "../fonts";
import { useTrackpadState } from "../hooks/useTrackpadState";
import { ReactSvg, volumeUp, noSound, pauseNoFill, playArrowNoFill, firstPage, lastPage, upload, cancelCircle } from "../svg-repo";
import { VideoMediaResult, YouTubePlayerControl } from "./screens.client";

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
    onNewClip: (newStart: number, newEnd: number) => void,
    onNewControl: (newControl: YouTubePlayerControl) => void,
    onNewMute: (newMute: boolean) => void,
    onRemoteControl: (control: YouTubePlayerControl) => number | undefined,
    onNewNote: (newNote: string) => void,
    onDeleteVideoMedia: () => void, 
}
export default function RemoteControl({ i, videoMedia, onNewClip, onNewControl, onNewMute, onRemoteControl, onNewNote, onDeleteVideoMedia }: RemoteControl) {
    const timelineTrackRef = useRef<HTMLDivElement | null>(null);
    const [timelineTrackSize] = useState({ width: '100%', height: 54 });
    const [timelineTrackPadding] = useState(15);
    const [startCapSize] = useState({ width: 17, height: 54 });
    const [startCursor, setStartCursor] = useState({ x: 0, y: 0 });
    const startRef = useRef<HTMLInputElement | null>(null);
    const [endCapSize] = useState({ width: 17, height: 54 });
    const [endCursor, setEndCursor] = useState({ x: 0, y: 0 });
    const endRef = useRef<HTMLInputElement | null>(null);

    const { getTrackValue: getTimeValue, getTrackCursor: getTimeCursor } = useTrackpadState(0, videoMedia.duration);
    const cursorToTime = useCallback((cursorX: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getTimeValue(cursorX, (timelineTrackRef.current.clientWidth - timelineTrackPadding), 0);
    }, [getTimeValue, timelineTrackPadding]);
    const timeToCursor = useCallback((time: number): number => {
        if (!timelineTrackRef.current) return 0;
        return getTimeCursor(time, (timelineTrackRef.current.clientWidth - timelineTrackPadding));
    }, [getTimeCursor, timelineTrackPadding]);

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

    const volumeTrackRef = useRef<HTMLDivElement | null>(null);
    const [volumeTrackOffsets] = useState({ padding: 20, border: 2 });
    const [volumeCapSize] = useState({ width: 45, height: 21 });
    const [volumeTrackSize] = useState({ width: 45, height: '100%' });
    const [volumeCursor, setVolumeCursor] = useState({ x: 0, y: 0 });
    const [volumeLimit] = useState(100);
    const { getInverseTrackValue: getVolumeValue, getTrackCursor: getVolumeCursor } =
        useTrackpadState(
            volumeCapSize.height - volumeTrackOffsets.border,
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

    const [notepad, setNotepad] = useState<string>(videoMedia.notes);

    return (<>
        <div
            style={{

                display: 'grid',
                height: '100%',
                gridTemplateRows: 'auto min-content',
                gridTemplateColumns: 'min-content min-content auto',
                borderRadius: 10,
                gap: 10,
            }}>
            <div style={{
                gridRow: '1 / span 2',
                background: i % 2 == 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                width: 100,
                justifyContent: 'center',
                display: 'grid',
                gridTemplateRows: 'min-content auto min-content',
                border: '1px solid rgba(255,255,255, 0.1)',
                borderRadius: 10,
                padding: "20px 0px",
            }}>
                <div style={{
                    display: 'grid',
                    placeContent: 'center'
                }}>
                    <ReactSvg
                        svg={volumeUp()}
                        containerSize={{
                            width: 20,
                            height: 20
                        }}
                        scale={1} />
                </div>
                <div style={{ padding: "20px 0px" }}>
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
                                key: videoMedia.media_path,
                                value: Math.round(newVolume)
                            }
                            onNewControl(newControl);
                        }}
                        groveWidth={10} />
                </div>
                <div style={{
                    display: 'grid',
                    placeContent: 'center'
                }}>
                    <ReactSvg
                        svg={noSound()}
                        containerSize={{
                            width: 20,
                            height: 20
                        }}
                        scale={1} />
                </div>
            </div>
            <div
                style={{
                    gridRow: '1',
                    border: '1px solid rgba(255,255,255, 0.1)',
                    borderRadius: 10,
                    background: i % 2 == 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                    width: videoMedia.height - 100,
                    padding: 20,
                    display: 'grid',
                    placeContent: "center",
                }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <ReactSvg
                        svg={firstPage()}
                        containerSize={{
                            width: 20,
                            height: 20
                        }}
                        scale={1}
                        onContainerClick={() => {
                            const currentPlayTime = onRemoteControl({ type: 'getCurrentTime', key: videoMedia.media_path });
                            if (!currentPlayTime) return;
                            const newCursor = timeToCursor(currentPlayTime);
                            setStartCursor({ x: newCursor, y: 0 });
                            if (startRef.current) {
                                const newStart = cursorToTime(newCursor);
                                startRef.current.value = formatTime(newStart);
                            }
                            onNewClip(currentPlayTime, videoMedia.end);
                            onNewControl({ type: 'reload', key: videoMedia.media_path, value: { newStart: currentPlayTime, newEnd: videoMedia.end } });
                        }}
                    />
                    <div style={{ display: 'grid', placeContent: 'center', width: 100, height: 100 }}>
                        <ReactSvg
                            svg={videoMedia.playing ? pauseNoFill() : playArrowNoFill()}
                            containerSize={{
                                width: 60,
                                height: 60
                            }}
                            scale={videoMedia.playing ? 1 : 1.5}
                            onContainerClick={() => {
                                const newControl: YouTubePlayerControl = {
                                    type: 'playPause',
                                    key: videoMedia.media_path,
                                }
                                onNewControl(newControl);
                            }} />
                    </div>
                    <ReactSvg
                        svg={lastPage()}
                        containerSize={{
                            width: 20,
                            height: 20
                        }}
                        scale={1}
                        onContainerClick={() => {
                            const currentPlayTime = onRemoteControl({ type: 'getCurrentTime', key: videoMedia.media_path });
                            if (!currentPlayTime) return;
                            const newCursor = timeToCursor(currentPlayTime);
                            setEndCursor({ x: newCursor, y: 0 });
                            if (endRef.current) {
                                const newEnd = cursorToTime(newCursor);
                                endRef.current.value = formatTime(newEnd);
                            }
                            onNewClip(videoMedia.start, currentPlayTime);
                            onNewControl({ type: 'reload', key: videoMedia.media_path, value: { newStart: videoMedia.start, newEnd: currentPlayTime } });
                        }} />
                </div>
            </div>

            <div
                className={dellaRespira.className}
                style={{
                    gridRow: 1,
                    border: '1px solid rgba(255,255,255, 0.1)',
                    borderRadius: 10,
                    background: i % 2 == 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                    padding: 10,
                    display: 'grid',
                    gap: 0,
                    gridTemplateRows: 'min-content min-content min-content auto',
                    gridTemplateColumns: 'auto min-content'
                }}>
                <div
                    style={{ gridColumn: 1, fontSize: 14, letterSpacing: '2px', fontWeight: 'bold' }}>
                    {videoMedia.title}
                </div>
                <div
                    style={{ gridColumn: 1, fontSize: 11, letterSpacing: '1px', }}>
                    <i>{videoMedia.timestamp}</i>
                </div>
                <div style={{
                    gridColumn: 1,
                    paddingTop: 10,
                    letterSpacing: '0'
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
                        paddingTop: 2,
                        fontSize: 12,
                        letterSpacing: '1px',
                    }} />
                <div style={{
                    gridColumn: 2,
                    gridRow: '1 / -1',
                    width: 'min-content',
                    display: 'grid',
                    gridTemplateRows: 'min-content auto min-content'
                }}>
                    <ReactSvg
                        svg={upload()}
                        containerSize={{
                            width: 20,
                            height: 20
                        }}
                        scale={1}
                        onContainerClick={() => {
                            onNewNote(notepad);
                        }} />
                    <div/>
                    <ReactSvg
                        svg={cancelCircle()}
                        containerSize={{
                            width: 20,
                            height: 20
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
                    gridColumn: '2 / span 2',
                    padding: 5,
                    border: '1px solid rgba(255,255,255, 0.1)',
                    borderRadius: 10,
                    background: i % 2 == 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                    fontSize: 12,
                    color: 'rgb(227, 227, 227)'
                }}>
                <div style={{ padding: 5, display: 'flex', justifyContent: 'space-between', }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                        <div ref={startRef}>{formatTime(videoMedia.start)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                        <div ref={endRef}>{videoMedia.duration >= videoMedia.start ? formatTime(videoMedia.duration) : ""}</div>
                    </div>
                </div>
                <div
                    className={dellaRespira.className}
                    style={{
                        width: '100%',
                        padding: `0px ${timelineTrackPadding}px 10px ${timelineTrackPadding}px`,
                    }}>
                    <TimelineSlider
                        label={''}
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
                            onNewControl({ type: 'seekTo', key: videoMedia.media_path, value: newStart });
                        }}
                        rangeCursor={endCursor}
                        onNewRangeCursor={async (c) => {
                            setEndCursor({ ...c });
                            const adjustedStart = adjustStartCursor(c.x);
                            const newEnd: number = cursorToTime(c.x);
                            onNewClip(adjustedStart, newEnd);
                            onNewControl({ type: 'reload', key: videoMedia.media_path, value: { newStart: adjustedStart, newEnd } });
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