export type WorkspaceResolution =
    | { type: 'high', factor: 1, value: { width: number, height: number } }
    | { type: 'midhigh', factor: 0.7, value: { width: number, height: number } }
    | { type: 'midlow', factor: 0.5, value: { width: number, height: number } }
    | { type: 'low', factor: 0.25, value: { width: number, height: number } }

export function getScreenResolution(): WorkspaceResolution {
    if (screen.width > 2560) {
        return { type: 'high', factor: 1, value: { width: screen.width, height: screen.height } };
    }
    else if (screen.width > 1920) {
        return { type: 'midhigh', factor: 0.7, value: { width: screen.width, height: screen.height } };
    }
    else if (screen.width > 1280) {
        return { type: 'midlow', factor: 0.5, value: { width: screen.width, height: screen.height } };
    }
    else {
        return { type: 'low', factor: 0.25, value: { width: screen.width, height: screen.height } };
    }
}
