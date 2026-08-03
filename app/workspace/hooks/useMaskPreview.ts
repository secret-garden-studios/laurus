import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CoreContext } from "../workspace.client";
import {
  LaurusImgResult,
  LaurusMaskResult,
  MaskComplete_V1_0,
  MaskCurve_V1_0,
  MaskError_V1_0,
  MaskTriangle_V1_0,
  maskImage,
} from "../workspace.server";
import { colorToRGB01 } from "../mask-gl";

export type MaskStatus = "idle" | "connecting" | "streaming" | "done" | "error";

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
export function useMaskPreview() {
  const { coreState } = useContext(CoreContext);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const colorCtxRef = useRef<CanvasRenderingContext2D | undefined>(undefined);

  const positionsRef = useRef<number[]>([]);
  const colorsRef = useRef<number[]>([]);
  const barycentricsRef = useRef<number[]>([]);
  const uvsRef = useRef<number[]>([]);
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
  const [textureMix, setTextureMixState] = useState(0);
  const textureMixRef = useRef(0);

  const setTextureMix = useCallback((value: number) => {
    textureMixRef.current = value;
    setTextureMixState(value);
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
    vertexCountRef.current = 0;
    dirtyRef.current = true;
    curvesRef.current = [];
    glowColorRef.current = [1, 1, 1];
    setTriangleCount(0);
    setResult(undefined);
    setErrorMessage(undefined);
    setStatus("idle");
    setTextureMix(0);
    setPosition({ value: false, x: undefined, y: undefined });
    setSize({ value: false, width: undefined, height: undefined });
  }, [setTextureMix]);

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
      setTextureMix(0);

      socketRef.current?.close();
      socketRef.current = maskImage(
        coreState.apiOrigin,
        coreState.accessToken,
        { img_media_id: img.img_media_id },
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
              for (const [x, y] of corners) {
                positionsRef.current.push(x, y);
                colorsRef.current.push(r, g, b);
                uvsRef.current.push(x / img.width, 1 - y / img.height);
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
            for (const [x, y] of event.points) {
              positionsRef.current.push(x, y);
              colorsRef.current.push(r, g, b);
              uvsRef.current.push(x / img.width, 1 - y / img.height);
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
    [coreState.apiOrigin, coreState.accessToken, getColorCtx, setTextureMix],
  );

  return {
    status,
    triangleCount,
    result,
    errorMessage,
    textureMix,
    setTextureMix,
    textureMixRef,
    position,
    setPosition,
    size,
    setSize,
    start,
    reset,
    meshRefs: {
      positionsRef,
      colorsRef,
      barycentricsRef,
      uvsRef,
      vertexCountRef,
      dirtyRef,
      curvesRef,
      glowColorRef,
    },
  };
}

export type UseMaskPreview = ReturnType<typeof useMaskPreview>;
