import { EncodedSvg_V1_0 } from "./workspace/workspace.server";

function base64Encode(markup: string) {
    const cleaned = markup.replace(/>\s+</g, '><').trim();
    return Buffer.from(cleaned).toString('base64');
};

export function videoCameraBack(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/video_camera_back_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
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
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/motion_photos_on_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
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
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/arrow_drop_down_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M480-360 280-560h400L480-360Z"/>`)
    }
}

export function closeIcon(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/close_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
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
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/close_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
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
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/close_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`)
    }
}


export function circle(
    fill: string = 'rgba(227, 227, 227, 1)',
    width: number = 24,
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/close_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
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
    height: number = 24): EncodedSvg_V1_0 {
    return {
        media_path: "/material-ui/close_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
        width,
        height,
        viewbox: "0 -960 960 960",
        fill,
        stroke: "none",
        stroke_width: 0,
        markup: base64Encode(`<path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/>`)
    }
}