import { LaurusCropSvg } from "../svg-repo";

export const HIGH_FACTOR = 1;
export const MIDHIGH_FACTOR = 0.7;
export const MIDLOW_FACTOR = 0.5;
export const LOW_FACTOR = 0.25;
export const NEW_PROJECT_CANVAS_SIZE = 5000;
export const FRAME_WIDTH_5_7 = 810;
export const FRAME_HEIGHT_5_7 = 1134;
export const FRAME_WIDTH_7_5 = FRAME_HEIGHT_5_7;
export const FRAME_HEIGHT_7_5 = FRAME_WIDTH_5_7;
export const FRAME_WIDTH_4_5 = 857;
export const FRAME_HEIGHT_4_5 = 1072;
export const FRAME_WIDTH_5_4 = FRAME_HEIGHT_4_5;
export const FRAME_HEIGHT_5_4 = FRAME_WIDTH_4_5;
export const FRAME_WIDTH_2_3 = 783;
export const FRAME_HEIGHT_2_3 = 1174;
export const FRAME_WIDTH_3_2 = FRAME_HEIGHT_2_3;
export const FRAME_HEIGHT_3_2 = FRAME_WIDTH_2_3;
export const FRAME_WIDTH_9_16 = 719;
export const FRAME_HEIGHT_9_16 = 1278;
export const FRAME_WIDTH_16_9 = FRAME_HEIGHT_9_16;
export const FRAME_HEIGHT_16_9 = FRAME_WIDTH_9_16;
export const FRAME_WIDTH_1_1 = 719;
export const FRAME_HEIGHT_1_1 = FRAME_WIDTH_1_1;

export type WorkspaceResolution =
    | { type: 'high', factor: number, value: { width: number, height: number } }
    | { type: 'midhigh', factor: number, value: { width: number, height: number } }
    | { type: 'midlow', factor: number, value: { width: number, height: number } }
    | { type: 'low', factor: number, value: { width: number, height: number } }

export function getScreenResolution(): WorkspaceResolution {
    if (typeof screen === 'undefined') return { type: 'midhigh', factor: MIDHIGH_FACTOR, value: { width: 2560, height: 1440 } };
    if (screen.width > 2560) {
        return { type: 'high', factor: HIGH_FACTOR, value: { width: screen.width, height: screen.height } };
    }
    else if (screen.width > 1920) {
        return { type: 'midhigh', factor: MIDHIGH_FACTOR, value: { width: screen.width, height: screen.height } };
    }
    else if (screen.width > 1280) {
        return { type: 'midlow', factor: MIDLOW_FACTOR, value: { width: screen.width, height: screen.height } };
    }
    else {
        return { type: 'low', factor: LOW_FACTOR, value: { width: screen.width, height: screen.height } };
    }
}

export function getCropSize(crop: LaurusCropSvg): { width: number, height: number } {
    switch (crop.type) {
        case "5:4": return { width: FRAME_WIDTH_5_4, height: FRAME_HEIGHT_5_4 };
        case "7:5": return { width: FRAME_WIDTH_7_5, height: FRAME_HEIGHT_7_5 };
        case "3:2": return { width: FRAME_WIDTH_3_2, height: FRAME_HEIGHT_3_2 };
        case "16:9": return { width: FRAME_WIDTH_16_9, height: FRAME_HEIGHT_16_9 };
        case "9:16": return { width: FRAME_WIDTH_9_16, height: FRAME_HEIGHT_9_16 };
        case "2:3": return { width: FRAME_WIDTH_2_3, height: FRAME_HEIGHT_2_3 };
        case "5:7": return { width: FRAME_WIDTH_5_7, height: FRAME_HEIGHT_5_7 };
        case "4:5": return { width: FRAME_WIDTH_4_5, height: FRAME_HEIGHT_4_5 };
        case "1:1": return { width: FRAME_WIDTH_1_1, height: FRAME_HEIGHT_1_1 };
    }
}

export function getDynamicUnitSizes(resolution: WorkspaceResolution) {
    {
        switch (resolution.type) {
            case "high": return {
                param: {
                    padding: '0 20px 20px 20px'
                },
                paramFlex: {
                    gap: 38,
                    padding: '20px 15px'
                },
                paramSlider: {
                    containerHeight: '100%',
                    containerWidth: 45,
                    trackWidth: 1,
                    capWidth: 16,
                    capHeight: 16,
                    capBorderOffset: 0
                },
                paramButtonContainer: {
                    width: 36,
                    height: 36
                },
                paramButton: {
                    width: 20,
                    height: 20
                },
                display: {
                    width: 400,
                    height: 450,
                    padding: 0,
                },
                displayImg: {
                    width: 280,
                    height: 280,
                },
                displaySvg: {
                    width: 200,
                    height: 200
                }
            }
            case "midhigh": return {
                param: {
                    padding: '0 22px 14px 14px'
                },
                paramFlex: {
                    gap: 26,
                    padding: '14px 10px'
                },
                paramSlider: {
                    containerHeight: '100%',
                    containerWidth: 40,
                    trackWidth: 1,
                    capWidth: 12,
                    capHeight: 12,
                    capBorderOffset: 0
                },
                paramButtonContainer: {
                    width: 24,
                    height: 24
                },
                paramButton: {
                    width: 14,
                    height: 14
                },
                display: {
                    width: 280,
                    height: 315,
                    padding: 0,
                },
                displayImg: {
                    width: 196,
                    height: 196,
                },
                displaySvg: {
                    width: 140,
                    height: 140
                }
            }
            case "midlow":
            case "low": return {
                param: { padding: '0 18px 10px 10px' },
                paramFlex: {
                    gap: 26,
                    padding: '14px 10px'
                },
                paramSlider: {
                    containerHeight: '100%',
                    containerWidth: 20,
                    trackWidth: 1,
                    capWidth: 10,
                    capHeight: 10,
                    capBorderOffset: 0
                },
                paramButtonContainer: { width: Math.round(36 * resolution.factor), height: Math.round(36 * resolution.factor) },
                paramButton: { width: Math.round(20 * resolution.factor), height: Math.round(20 * resolution.factor) },
                display: {
                    width: Math.round(400 * resolution.factor),
                    height: Math.round(450 * resolution.factor),
                    padding: 0,
                },
                displayImg: {
                    width: Math.round(280 * resolution.factor),
                    height: Math.round(280 * resolution.factor),
                },
                displaySvg: {
                    width: Math.round(200 * resolution.factor),
                    height: Math.round(200 * resolution.factor)
                }
            }
        }
    }
}
