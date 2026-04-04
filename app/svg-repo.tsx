
function base64Encode(markup: string) {
    const cleaned = markup.replace(/>\s+</g, '><').trim();
    return Buffer.from(cleaned).toString('base64');
};

export interface LaurusClientSvg {
    media_key: string
    width: number
    height: number
    viewbox: string
    fill: string
    stroke: string
    stroke_width: number
    markup: string
}

export type LaurusCropSvg =
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '5:4' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '7:5' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '3:2' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '16:9' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '9:16' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '2:3' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '5:7' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '4:5' }
    | { svg: LaurusClientSvg, order: number, timestamp: string, type: '1:1' }

export function getCrops(fill?: string): LaurusCropSvg[] {
    const now = new Date().toISOString();
    return [
        { svg: crop5_4(fill), order: 1, timestamp: now, type: '5:4' },
        { svg: crop7_5(fill), order: 2, timestamp: now, type: '7:5' },
        { svg: crop3_2(fill), order: 3, timestamp: now, type: '3:2' },
        { svg: crop16_9(fill), order: 4, timestamp: now, type: '16:9' },
        { svg: crop9_16(fill), order: 5, timestamp: now, type: '9:16' },
        { svg: crop2_3(fill), order: 6, timestamp: now, type: '2:3' },
        { svg: crop5_7(fill), order: 7, timestamp: now, type: '5:7' },
        { svg: crop4_5(fill), order: 8, timestamp: now, type: '4:5' },
        { svg: cropSquare(fill), order: 9, timestamp: now, type: '1:1' },
    ]
}

interface SvgRepo {
    svg: LaurusClientSvg,
    containerSize: { width: number, height: number }
    scale: number | undefined,
    onContainerClick?: () => void,
    onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void,
    inputId?: string,
    title?: string,
}
export function SvgRepo({ svg, containerSize, scale, onContainerClick, onSvgRef, inputId, title, }: SvgRepo) {
    const decodedString = decodeURIComponent(
        atob(svg.markup)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
    );
    return (
        <div
            title={title ?? ""}
            onMouseEnter={(e) => { if (onContainerClick) e.currentTarget.style.cursor = 'pointer' }}
            onMouseLeave={(e) => { if (onContainerClick) e.currentTarget.style.cursor = 'default' }}
            onClick={() => { if (onContainerClick) onContainerClick() }}
            style={{
                width: containerSize.width,
                height: containerSize.height,
                display: 'grid',
                placeContent: 'center',
            }}>
            {decodedString && <svg
                ref={(r) => {
                    if (onSvgRef) {
                        onSvgRef(r, `${inputId ?? svg.media_key}`);
                    }
                }}
                version="1.1"
                width={scale ? scale * containerSize.width : svg.width}
                height={scale ? scale * containerSize.height : svg.height}
                fill={svg.fill}
                stroke={svg.stroke}
                strokeWidth={svg.stroke_width}
                viewBox={svg.viewbox}
                dangerouslySetInnerHTML={{ __html: decodedString }} />}
        </div>
    )
}

export function videoCameraBack(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/video_camera_back_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M200-320h400L462-500l-92 120-62-80-108 140Zm-40 160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160H160Z"/>`)
    }
}

export function motionPhotosOn(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/motion_photos_on_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-32 5-64t15-63q5-16 20.5-21.5T150-626q15 8 21.5 23.5T173-570q-6 22-9.5 44.5T160-480q0 134 93 227t227 93q134 0 227-93t93-227q0-134-93-227t-227-93q-24 0-47.5 3.5T386-786q-17 5-32-1t-22-21q-7-15-.5-30.5T354-859q30-11 62-16t64-5q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80ZM177.5-697.5Q160-715 160-740t17.5-42.5Q195-800 220-800t42.5 17.5Q280-765 280-740t-17.5 42.5Q245-680 220-680t-42.5-17.5ZM480-480Z"/>`)
    }
}

export function arrowDropDown(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/arrow_drop_down_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M480-360 280-560h400L480-360Z"/>`)
    }
}

export function arrowDropUp(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/arrow_drop_up_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m280-400 200-200 200 200H280Z"/>`)
    }
}

export function closeIcon(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/close_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>`)
    }
}

export function checkCircle(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/check_circle_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`)
    }
}

export function cancelCircle(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/cancel_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`)
    }
}

export function cancelCircleFillZero(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/cancel_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m480-424 116 116q11 11 28 11t28-11q11-11 11-28t-11-28L536-480l116-116q11-11 11-28t-11-28q-11-11-28-11t-28 11L480-536 364-652q-11-11-28-11t-28 11q-11 11-11 28t11 28l116 116-116 116q-11 11-11 28t11 28q11 11 28 11t28-11l116-116Zm0 344q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`)
    }
}

export function addCircle(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/add_circle_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`)
    }
}

export function circle(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/circle_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`)
    }
}

export function dragIndicator(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/drag_indicator_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/>`)
    }
}

export function hexagon(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/hexagon_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M318-120q-22 0-40-10.5T249-160L87-440q-11-19-11-40t11-40l162-280q11-19 29-29.5t40-10.5h324q22 0 40 10.5t29 29.5l162 280q11 19 11 40t-11 40L711-160q-11 19-29 29.5T642-120H318Z"/>`)
    }
}

export function remove(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/remove_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M240-440q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h480q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H240Z"/>`)
    }
}

export function add2(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/add_2_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M451.5-131.5Q440-143 440-160v-280H160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h280v-280q0-17 11.5-28.5T480-840q17 0 28.5 11.5T520-800v280h280q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H520v280q0 17-11.5 28.5T480-120q-17 0-28.5-11.5Z"/>`)
    }
}

export function playCircle(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/play_circle_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`)
    }
}

export function autorenew(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/autorenew_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M204-318q-22-38-33-78t-11-82q0-134 93-228t227-94h7l-64-64 56-56 160 160-160 160-56-56 64-64h-7q-100 0-170 70.5T240-478q0 26 6 51t18 49l-60 60ZM481-40 321-200l160-160 56 56-64 64h7q100 0 170-70.5T720-482q0-26-6-51t-18-49l60-60q22 38 33 78t11 82q0 134-93 228t-227 94h-7l64 64-56 56Z"/>`)
    }
}

export function fastRewind(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/fast_rewind_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M860-240 500-480l360-240v480Zm-400 0L100-480l360-240v480Z"/>`)
    }
}

export function skipNext(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/skip_next_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M660-240v-480h80v480h-80Zm-440 0v-480l360 240-360 240Z"/>`)
    }
}

export function skipPrevious(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/skip_previous_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M220-240v-480h80v480h-80Zm520 0L380-480l360-240v480Z"/>`)
    }
}

export function fastForward(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/fast_forward_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M100-240v-480l360 240-360 240Zm400 0v-480l360 240-360 240Z"/>`)
    }
}

export function playArrow(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/play_arrow_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M320-200v-560l440 280-440 280Z"/>`)
    }
}

export function playArrowNoFill(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/play_arrow_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M360-331.46v-297.08q0-14.69 9.69-23.5t22.62-8.81q4.23 0 8.57 1.12 4.35 1.11 8.58 3.34l233.69 149.31q7.47 5.23 11.2 11.93 3.73 6.69 3.73 15.15t-3.73 15.15q-3.73 6.7-11.2 11.93L409.46-303.61q-4.23 2.23-8.58 3.34-4.34 1.12-8.57 1.12-12.93 0-22.62-8.81-9.69-8.81-9.69-23.5ZM400-480Zm0 134 211.54-134L400-614v268Z"/>`)
    }
}

export function pause(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/pause_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z"/>`)
    }
}

export function pauseNoFill(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/pause_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M580-240q-16.08 0-28.04-11.96T540-280v-400q0-16.08 11.96-28.04T580-720h100q16.08 0 28.04 11.96T720-680v400q0 16.08-11.96 28.04T680-240H580Zm-300 0q-16.08 0-28.04-11.96T240-280v-400q0-16.08 11.96-28.04T280-720h100q16.08 0 28.04 11.96T420-680v400q0 16.08-11.96 28.04T380-240H280Zm300-40h100v-400H580v400Zm-300 0h100v-400H280v400Zm0-400v400-400Zm300 0v400-400Z"/>`)
    }
}

export function moreVert(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/more_vert_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/>`)
    }
}

export function allOut(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/all_out_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM282-282q-82-82-82-198t82-198q82-82 198-82t198 82q82 82 82 198t-82 198q-82 82-198 82t-198-82Zm198 2q83 0 141.5-58.5T680-480q0-83-58.5-141.5T480-680q-83 0-141.5 58.5T280-480q0 83 58.5 141.5T480-280ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80ZM480-480Z"/>`)
    }
}

export function earthquake(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/earthquake_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M361-80q-14 0-24.5-7.5T322-108L220-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h130q13 0 23.5 7.5T288-492l66 215 127-571q3-14 14-23t25-9q14 0 25 8.5t14 22.5l87 376 56-179q4-13 14.5-20.5T740-680q13 0 23 7t15 19l50 134h12q17 0 28.5 11.5T880-480q0 17-11.5 28.5T840-440h-40q-13 0-23-7t-15-19l-19-51-65 209q-4 13-15 21t-25 7q-14-1-24-9.5T601-311l-81-348-121 548q-3 14-13.5 22T361-80Z"/>`)
    }
}

export function lassoSelect(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/lasso_select_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m161-516-80-8q6-46 20.5-89.5T141-696l68 42q-20 31-31.5 66T161-516Zm36 316q-33-32-57-70.5T101-352l76-26q12 35 31 65.5t45 56.5l-56 56Zm110-552-42-68q39-25 82.5-39.5T437-880l8 80q-37 5-72 16.5T307-752ZM479-82q-35 0-69.5-5.5T343-106l26-76q27 9 54 14.5t56 5.5v80Zm226-626q-26-26-56.5-45T583-784l26-76q43 15 81.5 39t70.5 57l-56 56Zm86 594L679-226v104h-80v-240h240v80H735l112 112-56 56Zm8-368q0-29-5.5-56T779-592l76-26q13 32 18.5 66.5T879-482h-80Z"/>`)
    }
}

export function deployedCode(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/deployed_code_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-40-343 237-137-237-137-237 137 237 137ZM160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11L160-252Zm320-228Z"/>`)
    }
}

export function browse(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/browse_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M120-440v-320q0-33 23.5-56.5T200-840h240v400H120Zm400-400h240q33 0 56.5 23.5T840-760v160H520v-240Zm0 720v-400h320v320q0 33-23.5 56.5T760-120H520ZM120-360h320v240H200q-33 0-56.5-23.5T120-200v-160Z"/>`)
    }
}

export function menu(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/menu_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M140-254.62v-59.99h680v59.99H140ZM140-450v-60h680v60H140Zm0-195.39v-59.99h680v59.99H140Z"/>`)
    }
}

export function noSound(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/no_sound_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m616-320-56-56 104-104-104-104 56-56 104 104 104-104 56 56-104 104 104 104-56 56-104-104-104 104Zm-496-40v-240h160l200-200v640L280-360H120Z"/>`)
    }
}

export function volumeUp(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/volume_up_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320Z"/>`)
    }
}

export function firstPage(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/first_page_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M251.5-251.5Q240-263 240-280v-400q0-17 11.5-28.5T280-720q17 0 28.5 11.5T320-680v400q0 17-11.5 28.5T280-240q-17 0-28.5-11.5ZM552-480l156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L468-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L552-480Z"/>`)
    }
}

export function lastPage(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/last_page_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M408-480 252-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L308-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Zm300.5-228.5Q720-697 720-680v400q0 17-11.5 28.5T680-240q-17 0-28.5-11.5T640-280v-400q0-17 11.5-28.5T680-720q17 0 28.5 11.5Z"/>`)
    }
}

export function upload(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/upload_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M240-160q-33 0-56.5-23.5T160-240v-80q0-17 11.5-28.5T200-360q17 0 28.5 11.5T240-320v80h480v-80q0-17 11.5-28.5T760-360q17 0 28.5 11.5T800-320v80q0 33-23.5 56.5T720-160H240Zm200-486-75 75q-12 12-28.5 11.5T308-572q-11-12-11.5-28t11.5-28l144-144q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l144 144q12 12 11.5 28T652-572q-12 12-28.5 12.5T595-571l-75-75v286q0 17-11.5 28.5T480-320q-17 0-28.5-11.5T440-360v-286Z"/>`)
    }
}

export function bookmarkStacks(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/bookmark_stacks_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M480-256.16 83.39-467.38l62.84-34.47L480-324.46l334.15-177.39L877-467.38 480-256.16ZM480-100 83.39-311.23l62.84-34.46L480-168.31l334.15-177.38L877-311.23 480-100Zm0-312.31L60.39-636.15 480-860l30 16.23v177.62h334.69l55.31 30-420 223.84Zm0-68.3 239.62-125.54H450v-169.31L185.46-636.15 480-480.61Zm-30-125.54Z"/>`)
    }
}

export function timerArrowDown(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/timer_arrow_down_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M147.89-261.09q-80.96-81.08-80.96-196.92 0-115.84 80.99-196.99t196.7-81.15q49.69 0 93.96 16.31 44.27 16.3 79.96 45.3l19.38-19.38q8.31-8.31 20.58-8.42 12.27-.12 21.26 8.87 8.24 8.24 8.24 20.62 0 12.39-8.31 20.7l-19 19.38q29 35.69 45.5 80.27t16.5 94.42q0 115.87-81.08 196.97Q460.52-180 344.68-180q-115.83 0-196.79-81.09Zm138.26-523.52q-12.75 0-21.37-8.63-8.62-8.63-8.62-21.39 0-12.75 8.62-21.37 8.62-8.61 21.37-8.61h117.7q12.75 0 21.37 8.63 8.63 8.62 8.63 21.38t-8.63 21.37q-8.62 8.62-21.37 8.62h-117.7Zm213.09 481.16q63.45-63.45 63.45-154.65 0-91.21-63.45-154.63-63.44-63.42-154.65-63.42-91.2 0-154.44 63.44-63.23 63.45-63.23 154.66 0 91.2 63.23 154.63Q253.39-240 344.59-240q91.21 0 154.65-63.45ZM366-440.55q8.61-8.62 8.61-21.37v-116.16q0-12.75-8.62-21.37-8.63-8.63-21.39-8.63-12.75 0-21.37 8.63-8.61 8.62-8.61 21.37v116.16q0 12.75 8.63 21.37 8.62 8.63 21.38 8.63 12.75 0 21.37-8.63Zm-21.38-17.53Zm407.76 252.77-86.23-86.23q-8.69-9.31-8.69-21.38 0-12.08 9.31-20.77t21.38-9q12.08-.31 20.77 9l38.77 38.77V-750q0-12.75 8.63-21.37 8.63-8.63 21.39-8.63 12.75 0 21.37 8.63 8.61 8.62 8.61 21.37v455.69l39.39-39.38q8.69-8.69 21.07-8.69 12.39 0 21.08 8.69 8.69 8.69 8.69 21.07 0 12.39-8.69 21.08L803-205.31q-10.85 10.85-25.31 10.85-14.46 0-25.31-10.85Z"/>`)
    }
}

export function photo(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/photo_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M240-280h480L570-480 450-320l-90-120-120 160ZM120-120v-720h720v720H120Zm80-80h560v-560H200v560Zm0 0v-560 560Z"/>`)
    }
}

export function threeSixtyLeft(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/360_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M374-288q-128-17-211-70T80-480q0-83 115.5-141.5T480-680q169 0 284.5 58.5T880-480q0 56-54.5 101.5T681-307q-16 5-28.5-4.5T640-337q0-18 10.5-32t27.5-20q60-20 91-45.5t31-45.5q0-32-85.5-76T480-600q-149 0-234.5 44T160-480q0 24 51 57.5T356-372l-24-24q-11-11-11-28t11-28q11-11 28-11t28 11l104 104q12 12 12 28t-12 28L388-188q-11 11-27.5 11.5T332-188q-11-11-11.5-27.5T331-244l43-44Z"/>`)
    }
}

export function threeSixtyRight(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/360_right_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M 586,-288 Q 714,-305 797,-358 880,-411 880,-480 880,-563 764.5,-621.5 649,-680 480,-680 311,-680 195.5,-621.5 80,-563 80,-480 80,-424 134.5,-378.5 189,-333 279,-307 295,-302 307.5,-311.5 320,-321 320,-337 320,-355 309.5,-369 299,-383 282,-389 222,-409 191,-434.5 160,-460 160,-480 160,-512 245.5,-556 331,-600 480,-600 629,-600 714.5,-556 800,-512 800,-480 800,-456 749,-422.5 698,-389 604,-372 L 628,-396 Q 639,-407 639,-424 639,-441 628,-452 617,-463 600,-463 583,-463 572,-452 L 468,-348 Q 456,-336 456,-320 456,-304 468,-292 L 572,-188 Q 583,-177 599.5,-176.5 616,-176 628,-188 639,-199 639.5,-215.5 640,-232 629,-244 Z"/>`)
    }
}

export function cropSquare(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_square_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M140-140v-680h680v680H140Zm60-60h560v-560H200v560Zm0 0v-560 560Z"/>`)
    }
}

export function crop16_9(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_16_9_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M140-300v-360h680v360H140Zm60-60h560v-240H200v240Zm0 0v-240 240Z"/>`)
    }
}

export function crop9_16(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_9_16_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M300-140v-680h360v680H300Zm60-620v560h240v-560H360Zm0 560v-560 560Z"/>`)
    }
}

export function crop7_5(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_7_5_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M140-220v-520h680v520H140Zm60-60h560v-400H200v400Zm0 0v-400 400Z"/>`)
    }
}

export function crop5_7(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_5_7_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M 220,-820 H 740 V -140 H 220 Z M 280,-760 V -200 H 680 V -760 Z M 280,-760 H 680 Z"/>`)
    }
}

export function crop5_4(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_5_4_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M140-180v-600h680v600H140Zm60-60h560v-480H200v480Zm0 0v-480 480Z"/>`)
    }
}

export function crop4_5(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_4_5_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M 180,-820 H 780 V -140 H 180 Z M 240,-760 V -200 H 720 V -760 Z M 240,-760 H 720 Z"/>`)
    }
}

export function crop3_2(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_3_2_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M140-260v-440h680v440H140Zm60-60h560v-320H200v320Zm0 0v-320 320Z"/>`)
    }
}

export function crop2_3(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/crop_2_3_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M 260,-820 H 700 V -140 H 260 Z M 320,-760 V -200 H 640 V -760 Z M 320,-760 H 640 Z"/>`)
    }
}

export function contentPaste(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/content_paste_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M 166.29024,-120 V -840 H 381.52999 Q 391.11557,-875 419.00088,-897.5 446.88619,-920 480,-920 514.85664,-920 542.30624,-897.5 569.75585,-875 579.34142,-840 H 793.70976 V -120 Z M 236.00352,-200 H 723.99648 V -760 H 654.2832 V -640 H 305.7168 V -760 H 236.00352 Z M 504.83536,-771.5 Q 514.85664,-783 514.85664,-800 514.85664,-817 504.83536,-828.5 494.81407,-840 480,-840 465.18593,-840 455.16464,-828.5 445.14336,-817 445.14336,-800 445.14336,-783 455.16464,-771.5 465.18593,-760 480,-760 494.81407,-760 504.83536,-771.5 Z"/>`)
    }
}

export function fileCopy(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/file_copy_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M240-200v-720h360l240 240v480H240Zm320-440v-200H320v560h440v-360H560ZM80-40v-640h80v560h440v80H80Zm240-800v200-200 560-560Z"/>`)
    }
}

export function outbound(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/outbound_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m356-300 204-204v90h80v-226H414v80h89L300-357l56 57ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`)
    }
}

export function search(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/search_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>`)
    }
}


export function folder(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/folder_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/>`)
    }
}

export function arrowDownwardAlt(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/arrow_downward_alt_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M480-240 240-480l56-56 144 144v-368h80v368l144-144 56 56-240 240Z"/>`)
    }
}

export function arrowUpwardAlt(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): LaurusClientSvg {
    return {
        media_key: "/material-ui/arrow_upward_alt_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z"/>`)
    }
}
