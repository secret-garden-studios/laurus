import { WorkspaceResolution } from "./workspace-resolution";

export function getDisplaySize(resolution: WorkspaceResolution) {
    return {
        width: Math.round(400 * resolution.factor),
        height: Math.round(450 * resolution.factor),
        padding: 0,
        activeImgElementSize: Math.round(280 * resolution.factor),
        activeSvgElementSize: Math.round(200 * resolution.factor),
    }
}

export function getHeaderSize(resolution: WorkspaceResolution) {
    switch (resolution.type) {
        case "high": return {
            font: 32,
            logo: 40,
            more: 24,
            padding: 10,
        }
        case "midhigh": return {
            font: 24,
            logo: 28,
            more: 18,
            padding: 12,
        }
        case "midlow":
        case "low": return {
            font: 20,
            logo: 24,
            more: 16,
            padding: 6,
        }
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