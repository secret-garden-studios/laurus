import { useCallback, useEffect, useRef, useState } from "react";
import {
  LaurusImgResult,
  LaurusMaskResult,
  MaskComplete_V1_0,
  MaskCurve_V1_0,
  MaskError_V1_0,
  MaskTriangle_V1_0,
  maskImage,
} from "../workspace.server";
import {
  colorToRGB01,
  CAPTURE_DARKNESS_DEFAULT,
  CAPTURE_FALLOFF_CSS_PX_DEFAULT,
  CAPTURE_INTENSITY_DEFAULT,
  CAPTURE_SIZE_CSS_PX_DEFAULT,
  TEXTURE_MIX_DEFAULT,
} from "../mask-gl";

export type MaskStatus = "idle" | "connecting" | "streaming" | "done" | "error";

/** "1x"/"2x"/"3x" -- how much finer the generated mesh should be relative to the server's own
 * defaults. 2x/3x scale max_triangle_area and detail_points to divide the mesh into 2x/3x as
 * many points; see the request built in start() below. */
export type MaskResolutionFactor = 1 | 2 | 3;
export const MASK_RESOLUTION_DEFAULT: MaskResolutionFactor = 1;
// Mirrors the server's own MaskRequest defaults (app/pydantic_schemas.py) -- 1x sends no override
// at all, so the server's defaults apply exactly as before this control existed.
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

/**
 * Owns the /media/masks/mask websocket and the mesh data it streams back, independent of
 * any specific <canvas>/GL context -- the GL rendering itself lives in canvas.tsx (see
 * MaskUnitbar and Canvas), which reads the refs this hook exposes on every animation frame.
 * Splitting it this way lets the "Mask" trigger button (in the unitbar) and the WebGL
 * preview (layered into the main canvas) live in different parts of the tree while sharing one
 * in-flight masking.
 */
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
  const glowColorRef = useRef<[number, number, number]>([1, 1, 1]);

  const [status, setStatus] = useState<MaskStatus>("idle");
  const [triangleCount, setTriangleCount] = useState(0);
  const [result, setResult] = useState<LaurusMaskResult | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  // Mirrored into a ref so the GL render loop (set up once per overlay mount) can read the live
  // slider value every frame without being torn down and re-created each time it moves.
  const [textureMix, setTextureMixState] = useState(TEXTURE_MIX_DEFAULT);
  const textureMixRef = useRef(TEXTURE_MIX_DEFAULT);

  const setTextureMix = useCallback((value: number) => {
    textureMixRef.current = value;
    setTextureMixState(value);
  }, []);

  // Same mirrored state+ref pattern as textureMix, for Maskbar's epicenter size/intensity sliders.
  const [captureSize, setCaptureSizeState] = useState(CAPTURE_SIZE_CSS_PX_DEFAULT);
  const captureSizeRef = useRef(CAPTURE_SIZE_CSS_PX_DEFAULT);

  const setCaptureSize = useCallback((value: number) => {
    captureSizeRef.current = value;
    setCaptureSizeState(value);
  }, []);

  const [captureIntensity, setCaptureIntensityState] = useState(CAPTURE_INTENSITY_DEFAULT);
  const captureIntensityRef = useRef(CAPTURE_INTENSITY_DEFAULT);

  const setCaptureIntensity = useCallback((value: number) => {
    captureIntensityRef.current = value;
    setCaptureIntensityState(value);
  }, []);

  const [captureFalloff, setCaptureFalloffState] = useState(CAPTURE_FALLOFF_CSS_PX_DEFAULT);
  const captureFalloffRef = useRef(CAPTURE_FALLOFF_CSS_PX_DEFAULT);

  const setCaptureFalloff = useCallback((value: number) => {
    captureFalloffRef.current = value;
    setCaptureFalloffState(value);
  }, []);

  const [captureDarkness, setCaptureDarknessState] = useState(CAPTURE_DARKNESS_DEFAULT);
  const captureDarknessRef = useRef(CAPTURE_DARKNESS_DEFAULT);

  const setCaptureDarkness = useCallback((value: number) => {
    captureDarknessRef.current = value;
    setCaptureDarknessState(value);
  }, []);

  // Mirrored state+ref like textureMix/captureSize above, but never reset in reset()/start() --
  // this is a standing quality preference the user dials in once, not a per-run override tied to
  // a specific mesh the way position/size are, so a fresh mask trigger should keep using it.
  const [resolution, setResolutionState] = useState<MaskResolutionFactor>(MASK_RESOLUTION_DEFAULT);
  const resolutionRef = useRef<MaskResolutionFactor>(MASK_RESOLUTION_DEFAULT);

  const setResolution = useCallback((value: MaskResolutionFactor) => {
    resolutionRef.current = value;
    setResolutionState(value);
  }, []);

  // Where/how big the generated mask should land, overriding the default of overlaying it
  // directly on top of the source image at the image's own frame. Lives here (rather than as
  // local state in Maskbar) so the live preview in canvas.tsx can read the same values and
  // match, instead of always showing the un-overridden overlay while streaming and only jumping
  // to the override once the result is persisted.
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

  const reset = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = undefined;
    positionsRef.current = [];
    colorsRef.current = [];
    barycentricsRef.current = [];
    uvsRef.current = [];
    centroidsRef.current = [];
    vertexCountRef.current = 0;
    dirtyRef.current = true;
    curvesRef.current = [];
    glowColorRef.current = [1, 1, 1];
    setTriangleCount(0);
    setResult(undefined);
    setErrorMessage(undefined);
    setStatus("idle");
    setTextureMix(TEXTURE_MIX_DEFAULT);
    setCaptureSize(CAPTURE_SIZE_CSS_PX_DEFAULT);
    setCaptureIntensity(CAPTURE_INTENSITY_DEFAULT);
    setCaptureFalloff(CAPTURE_FALLOFF_CSS_PX_DEFAULT);
    setCaptureDarkness(CAPTURE_DARKNESS_DEFAULT);
    setPosition({ value: false, x: undefined, y: undefined });
    setSize({ value: false, width: undefined, height: undefined });
  }, [setTextureMix, setCaptureSize, setCaptureIntensity, setCaptureFalloff, setCaptureDarkness]);

  const start = useCallback(
    // onComplete fires exactly once, straight off the websocket's one and only "complete"
    // message -- callers that need to act on the finished result (e.g. Maskbar persisting
    // it) should hook this rather than watching `status`/`result` in a useEffect, which re-fires
    // on every remount that still finds status "done" from a previous run with no way to tell
    // "already handled" from "new" without extra bookkeeping.
    (img: LaurusImgResult, onComplete?: (result: LaurusMaskResult) => void) => {
      positionsRef.current = [];
      colorsRef.current = [];
      barycentricsRef.current = [];
      uvsRef.current = [];
      vertexCountRef.current = 0;
      dirtyRef.current = true;
      curvesRef.current = [];
      glowColorRef.current = [1, 1, 1];
      setTriangleCount(0);
      setResult(undefined);
      setErrorMessage(undefined);
      setStatus("connecting");
      setTextureMix(TEXTURE_MIX_DEFAULT);
      setCaptureSize(CAPTURE_SIZE_CSS_PX_DEFAULT);
      setCaptureIntensity(CAPTURE_INTENSITY_DEFAULT);
      setCaptureFalloff(CAPTURE_FALLOFF_CSS_PX_DEFAULT);
      setCaptureDarkness(CAPTURE_DARKNESS_DEFAULT);

      const resolutionFactor = resolutionRef.current;
      socketRef.current?.close();
      socketRef.current = maskImage(
        apiOrigin,
        accessToken,
        resolutionFactor === 1
          ? { img_media_id: img.img_media_id }
          : {
              img_media_id: img.img_media_id,
              max_triangle_area: BASE_MAX_TRIANGLE_AREA / resolutionFactor,
              detail_points: BASE_DETAIL_POINTS * resolutionFactor,
            },
        {
          onGroupStart: () => {
            setStatus("streaming");
          },
          onCurve: (event: MaskCurve_V1_0) => {
            curvesRef.current.push(event);
            if (event.glow_color) {
              const colorCtx = getColorCtx();
              // One glow colour for the image: the server measures the falloff
              // across the whole alpha channel, so every curve reports the same
              // one and the shader only needs a uniform.
              if (colorCtx) glowColorRef.current = colorToRGB01(colorCtx, event.glow_color);
            }

            // A backing quad over the whole image, pushed before any triangle
            // arrives so the mesh paints on top of it. The mask trims it to the
            // silhouette, and what's left visible is only the sliver between the
            // mesh's straight boundary chords and the curve they're inscribed in
            // -- without it that sliver would read as a transparent fringe
            // nibbling the smooth edge we just went to the trouble of making.
            if (curvesRef.current.length === 1) {
              const colorCtx = getColorCtx();
              const [r, g, b] = colorCtx ? colorToRGB01(colorCtx, event.fill) : [1, 1, 1];
              const corners: [number, number][] = [
                [0, 0],
                [img.width, 0],
                [0, img.height],
                [img.width, 0],
                [img.width, img.height],
                [0, img.height],
              ];
              // Each corner carries its own position as its "centroid" rather than one shared
              // value -- see the matching comment in buildStaticMaskMesh (mask-gl.ts). A single
              // shared centroid (e.g. the image's own center) reads wrong wherever the fringe's
              // true position isn't near that center: too bright on whichever side sits farthest
              // from a light source (the shadow never seems to reach it), and too dark right next
              // to a light source pushed toward a mask edge (the sliver there lags behind how lit
              // the real mesh beside it is, since it's being evaluated as if it sat at the image's
              // center instead of at the edge).
              for (const [x, y] of corners) {
                positionsRef.current.push(x, y);
                colorsRef.current.push(r, g, b);
                uvsRef.current.push(x / img.width, 1 - y / img.height);
                centroidsRef.current.push(x, y);
                // All-ones barycentrics keep edgeDist at 1 across the quad, so
                // the wireframe doesn't draw an outline around the backing.
                barycentricsRef.current.push(1, 1, 1);
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
      setTextureMix,
      setCaptureSize,
      setCaptureIntensity,
      setCaptureFalloff,
      setCaptureDarkness,
    ],
  );

  return {
    status,
    triangleCount,
    result,
    errorMessage,
    textureMix,
    setTextureMix,
    textureMixRef,
    captureSize,
    setCaptureSize,
    captureSizeRef,
    captureIntensity,
    setCaptureIntensity,
    captureIntensityRef,
    captureFalloff,
    setCaptureFalloff,
    captureFalloffRef,
    captureDarkness,
    setCaptureDarkness,
    captureDarknessRef,
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
    },
  };
}

export type UseMaskPreview = ReturnType<typeof useMaskPreview>;
