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