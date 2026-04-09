export type ProjectsResolution =
    | { type: 'high', factor: 1, value: { width: number, height: number } }
    | { type: 'midhigh', factor: 0.9, value: { width: number, height: number } }
    | { type: 'midlow', factor: 0.75, value: { width: number, height: number } }
    | { type: 'low', factor: 0.65, value: { width: number, height: number } }

export function getScreenResolution(): ProjectsResolution {
    if (typeof screen === 'undefined') return { type: 'midhigh', factor: 0.9, value: { width: 2560, height: 1440 } };
    if (screen.width > 2560) {
        return { type: 'high', factor: 1, value: { width: screen.width, height: screen.height } };
    }
    else if (screen.width > 1920) {
        return { type: 'midhigh', factor: 0.9, value: { width: screen.width, height: screen.height } };
    }
    else if (screen.width > 1280) {
        return { type: 'midlow', factor: 0.75, value: { width: screen.width, height: screen.height } };
    }
    else {
        return { type: 'low', factor: 0.65, value: { width: screen.width, height: screen.height } };
    }
}
