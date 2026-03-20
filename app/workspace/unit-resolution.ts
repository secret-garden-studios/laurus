import { WorkspaceResolution } from "./workspace-resolution";

export function getDisplaySize(resolution: WorkspaceResolution) {
    return {
        'width': Math.round(400 * resolution.factor),
        'height': Math.round(450 * resolution.factor),
        'padding': 0,
        'activeElementSize': Math.round(300 * resolution.factor)
    }
}

export function getHeaderSize(resolution: WorkspaceResolution) {
    return {
        font: Math.round(32 * resolution.factor),
        logo: Math.round(40 * resolution.factor),
        more: Math.round(24 * resolution.factor),
        padding: Math.round(10 * resolution.factor),
    }
}

export function getTopLevelPadding(resolution: WorkspaceResolution) {
    const p = Math.round(20 * resolution.factor);
    return `0 ${p}px ${p}px ${p}px`;
}

export function getParamTrackPadding(resolution: WorkspaceResolution) {
    return `${Math.round(20 * resolution.factor)}px ${Math.round(15 * resolution.factor)}px`;
}

export function getParamCapSize(resolution: WorkspaceResolution) {
    return {
        width: Math.round(45 * resolution.factor),
        height: Math.round(21 * resolution.factor)
    }
}

export function getParamTrackSize(resolution: WorkspaceResolution) {
    return {
        width: Math.round(45 * resolution.factor),
        height: Math.round(200 * resolution.factor)
    }
}

export function getParamButtonSize(resolution: WorkspaceResolution) {
    return {
        container: Math.round(36 * resolution.factor),
        svg: Math.round(20 * resolution.factor)
    }
}

export function getParamGrooveWidth(resolution: WorkspaceResolution) {
    return Math.round(10 * resolution.factor);
}