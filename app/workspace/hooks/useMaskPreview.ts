import { useCallback, useEffect, useRef, useState } from "react";
import {
  LaurusImgResult,
  LaurusMaskResult,
  LaurusObjectReviewCandidate,
  MaskComplete_V1_0,
  MaskCurve_V1_0,
  MaskError_V1_0,
  MaskObject_V1_0,
  MaskTriangle_V1_0,
  maskImage,
} from "../workspace.server";
import {
  colorToRGB01,
  LIGHT_DARKNESS_DEFAULT,
  LIGHT_FALLOFF_CSS_PX_DEFAULT,
  LIGHT_INTENSITY_DEFAULT,
  LIGHT_SIZE_CSS_PX_DEFAULT,
  MASK_BACKING_VERTEX_COUNT,
  TEXTURE_MIX_DEFAULT,
} from "../mask-gl";

export type MaskStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export type MaskResolutionFactor = 1 | 2 | 3;
export const MASK_RESOLUTION_DEFAULT: MaskResolutionFactor = 1;
const BASE_MAX_TRIANGLE_AREA = 600.0;
const BASE_DETAIL_POINTS = 3000;

export interface MaskPositionOverride {
  value: boolean;
  x: number | undefined;
  y: number | undefined;
}
export interface MaskSizeOverride {
  value: boolean;
  width: number | undefined;
  height: number | undefined;
}

export interface EdgeObjectSeed {
  elevation: number;
  falloff: number;
}

export function useMaskPreview(apiOrigin: string | undefined, accessToken: string | undefined) {
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const colorCtxRef = useRef<CanvasRenderingContext2D | undefined>(undefined);

  const positionsRef = useRef<number[]>([]);
  const colorsRef = useRef<number[]>([]);
  const barycentricsRef = useRef<number[]>([]);
  const uvsRef = useRef<number[]>([]);
  const centroidsRef = useRef<number[]>([]);
  const vertexCountRef = useRef(0);
  const dirtyRef = useRef(false);
  const curvesRef = useRef<MaskCurve_V1_0[]>([]);
  const backingVertexCountRef = useRef(0);
  const glowColorRef = useRef<[number, number, number]>([1, 1, 1]);
  const objectCandidatesRef = useRef<LaurusObjectReviewCandidate[]>([]);

  const [status, setStatusState] = useState<MaskStatus>("idle");
  const statusRef = useRef<MaskStatus>("idle");
  const setStatus = useCallback((value: MaskStatus) => {
    statusRef.current = value;
    setStatusState(value);
  }, []);
  const [triangleCount, setTriangleCount] = useState(0);
  const [result, setResult] = useState<LaurusMaskResult | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [textureMix, setTextureMixState] = useState(TEXTURE_MIX_DEFAULT);
  const textureMixRef = useRef(TEXTURE_MIX_DEFAULT);

  const setTextureMix = useCallback((value: number) => {
    textureMixRef.current = value;
    setTextureMixState(value);
  }, []);

  const [lightSize, setLightSizeState] = useState(LIGHT_SIZE_CSS_PX_DEFAULT);
  const lightSizeRef = useRef(LIGHT_SIZE_CSS_PX_DEFAULT);

  const setLightSize = useCallback((value: number) => {
    lightSizeRef.current = value;
    setLightSizeState(value);
  }, []);

  const [lightIntensity, setLightIntensityState] = useState(LIGHT_INTENSITY_DEFAULT);
  const lightIntensityRef = useRef(LIGHT_INTENSITY_DEFAULT);

  const setLightIntensity = useCallback((value: number) => {
    lightIntensityRef.current = value;
    setLightIntensityState(value);
  }, []);

  const [lightFalloff, setLightFalloffState] = useState(LIGHT_FALLOFF_CSS_PX_DEFAULT);
  const lightFalloffRef = useRef(LIGHT_FALLOFF_CSS_PX_DEFAULT);

  const setLightFalloff = useCallback((value: number) => {
    lightFalloffRef.current = value;
    setLightFalloffState(value);
  }, []);

  const [lightDarkness, setLightDarknessState] = useState(LIGHT_DARKNESS_DEFAULT);
  const lightDarknessRef = useRef(LIGHT_DARKNESS_DEFAULT);

  const setLightDarkness = useCallback((value: number) => {
    lightDarknessRef.current = value;
    setLightDarknessState(value);
  }, []);

  const [resolution, setResolutionState] = useState<MaskResolutionFactor>(MASK_RESOLUTION_DEFAULT);
  const resolutionRef = useRef<MaskResolutionFactor>(MASK_RESOLUTION_DEFAULT);

  const setResolution = useCallback((value: MaskResolutionFactor) => {
    resolutionRef.current = value;
    setResolutionState(value);
  }, []);

  const [position, setPosition] = useState<MaskPositionOverride>({
    value: false,
    x: undefined,
    y: undefined,
  });
  const [size, setSize] = useState<MaskSizeOverride>({
    value: false,
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  const getColorCtx = useCallback((): CanvasRenderingContext2D | undefined => {
    if (colorCtxRef.current) return colorCtxRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) colorCtxRef.current = ctx;
    return colorCtxRef.current;
  }, []);

  const pushBackingSheet = useCallback((img: LaurusImgResult) => {
    const corners: [number, number][] = [
      [0, 0],
      [img.width, 0],
      [0, img.height],
      [img.width, 0],
      [img.width, img.height],
      [0, img.height],
    ];
    for (const [x, y] of corners) {
      positionsRef.current.push(x, y);
      colorsRef.current.push(1, 1, 1);
      uvsRef.current.push(x / img.width, 1 - y / img.height);
      centroidsRef.current.push(x, y);
      barycentricsRef.current.push(1, 1, 1);
    }
    backingVertexCountRef.current = MASK_BACKING_VERTEX_COUNT;
    dirtyRef.current = true;
  }, []);

  const reset = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = undefined;
    backingVertexCountRef.current = 0;
    positionsRef.current = [];
    colorsRef.current = [];
    barycentricsRef.current = [];
    uvsRef.current = [];
    centroidsRef.current = [];
    vertexCountRef.current = 0;
    dirtyRef.current = true;
    curvesRef.current = [];
    glowColorRef.current = [1, 1, 1];
    objectCandidatesRef.current = [];
    setTriangleCount(0);
    setResult(undefined);
    setErrorMessage(undefined);
    setStatus("idle");
    setTextureMix(TEXTURE_MIX_DEFAULT);
    setLightSize(LIGHT_SIZE_CSS_PX_DEFAULT);
    setLightIntensity(LIGHT_INTENSITY_DEFAULT);
    setLightFalloff(LIGHT_FALLOFF_CSS_PX_DEFAULT);
    setLightDarkness(LIGHT_DARKNESS_DEFAULT);
    setPosition({ value: false, x: undefined, y: undefined });
    setSize({ value: false, width: undefined, height: undefined });
  }, [setStatus, setTextureMix, setLightSize, setLightIntensity, setLightFalloff, setLightDarkness]);

  const start = useCallback(
    (img: LaurusImgResult, onComplete?: (result: LaurusMaskResult) => void, objectSeed?: EdgeObjectSeed) => {
      positionsRef.current = [];
      colorsRef.current = [];
      barycentricsRef.current = [];
      uvsRef.current = [];
      centroidsRef.current = [];
      vertexCountRef.current = 0;
      dirtyRef.current = true;
      pushBackingSheet(img);
      curvesRef.current = [];
      glowColorRef.current = [1, 1, 1];
      objectCandidatesRef.current = [];
      setTriangleCount(0);
      setResult(undefined);
      setErrorMessage(undefined);
      setStatus("connecting");
      setTextureMix(TEXTURE_MIX_DEFAULT);
      setLightSize(LIGHT_SIZE_CSS_PX_DEFAULT);
      setLightIntensity(LIGHT_INTENSITY_DEFAULT);
      setLightFalloff(LIGHT_FALLOFF_CSS_PX_DEFAULT);
      setLightDarkness(LIGHT_DARKNESS_DEFAULT);

      const resolutionFactor = resolutionRef.current;
      socketRef.current?.close();
      socketRef.current = maskImage(
        apiOrigin,
        accessToken,
        {
          img_media_id: img.img_media_id,
          ...(resolutionFactor === 1
            ? {}
            : {
                max_triangle_area: BASE_MAX_TRIANGLE_AREA / resolutionFactor,
                detail_points: BASE_DETAIL_POINTS * resolutionFactor,
              }),
          ...(objectSeed
            ? { edge_objects: true, object_elevation: objectSeed.elevation, object_falloff: objectSeed.falloff }
            : {}),
        },
        {
          onGroupStart: () => {
            setStatus("streaming");
          },
          onCurve: (event: MaskCurve_V1_0) => {
            curvesRef.current.push(event);
            if (event.glow_color) {
              const colorCtx = getColorCtx();
              if (colorCtx) glowColorRef.current = colorToRGB01(colorCtx, event.glow_color);
            }

            if (curvesRef.current.length === 1) {
              const colorCtx = getColorCtx();
              const [r, g, b] = colorCtx ? colorToRGB01(colorCtx, event.fill) : [1, 1, 1];
              for (let i = 0; i < MASK_BACKING_VERTEX_COUNT; i++) {
                colorsRef.current[i * 3] = r;
                colorsRef.current[i * 3 + 1] = g;
                colorsRef.current[i * 3 + 2] = b;
              }
              dirtyRef.current = true;
            }
          },
          onTriangle: (event: MaskTriangle_V1_0) => {
            const colorCtx = getColorCtx();
            const [r, g, b] = colorCtx ? colorToRGB01(colorCtx, event.shaded) : [1, 1, 1];
            const centroid: [number, number] = [
              event.points.reduce((sum, [x]) => sum + x, 0) / event.points.length,
              event.points.reduce((sum, [, y]) => sum + y, 0) / event.points.length,
            ];
            for (const [x, y] of event.points) {
              positionsRef.current.push(x, y);
              colorsRef.current.push(r, g, b);
              uvsRef.current.push(x / img.width, 1 - y / img.height);
              centroidsRef.current.push(...centroid);
            }
            barycentricsRef.current.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
            dirtyRef.current = true;
            setTriangleCount((n) => n + 1);
          },
          onObject: (event: MaskObject_V1_0) => {
            objectCandidatesRef.current = [
              ...objectCandidatesRef.current,
              { object: event.object, polygon_indices: event.polygon_indices },
            ];
          },
          onComplete: (event: MaskComplete_V1_0) => {
            setStatus("done");
            setResult(event.result);
            onComplete?.(event.result);
          },
          onError: (message: MaskError_V1_0["message"]) => {
            setStatus("error");
            setErrorMessage(message);
          },
        },
      );
    },
    [
      apiOrigin,
      accessToken,
      getColorCtx,
      pushBackingSheet,
      setStatus,
      setTextureMix,
      setLightSize,
      setLightIntensity,
      setLightFalloff,
      setLightDarkness,
    ],
  );

  return {
    status,
    statusRef,
    triangleCount,
    result,
    objectCandidatesRef,
    errorMessage,
    textureMix,
    setTextureMix,
    textureMixRef,
    lightSize,
    setLightSize,
    lightSizeRef,
    lightIntensity,
    setLightIntensity,
    lightIntensityRef,
    lightFalloff,
    setLightFalloff,
    lightFalloffRef,
    lightDarkness,
    setLightDarkness,
    lightDarknessRef,
    position,
    setPosition,
    size,
    setSize,
    resolution,
    setResolution,
    start,
    reset,
    meshRefs: {
      positionsRef,
      colorsRef,
      barycentricsRef,
      uvsRef,
      centroidsRef,
      vertexCountRef,
      dirtyRef,
      curvesRef,
      glowColorRef,
      backingVertexCountRef,
    },
  };
}

export type UseMaskPreview = ReturnType<typeof useMaskPreview>;
