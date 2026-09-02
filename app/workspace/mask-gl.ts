import type { MaskCurve_V1_0, ObjectFill_V1_0 } from "./workspace.server";
import { isBehindMask, MASK_ORDER_EPSILON, occludes } from "./canvas-media/mask-order.ts";
import { toCssSkewAngle } from "./skew-angle.ts";
import { OBJECT_SDF_TILE, objectShapeProfileU, type ObjectShape } from "./canvas-media/object-shape.ts";
import {
  LIGHT_SDF_ATLAS,
  LIGHT_SDF_GRID,
  MASK_OBJECT_SWELL,
  MASK_OBJECT_SWELL_LIMIT,
  MAX_MASK_LIGHT_SOURCES,
  MAX_MASK_OBJECTS,
  MIN_MASK_OBJECT_FALLOFF,
  OBJECT_SDF_ATLAS,
  OBJECT_SDF_GRID,
  OBJECT_SDF_RANGE,
  OBJECT_SUBDIVISION_TOLERANCE_PX,
} from "./mask-constants.ts";
import { LIGHT_SOURCE_SHADER, type Shader } from "./shaders/index.ts";

export * from "./mask-constants.ts";
export { LIGHT_SOURCE_SHADER, type Shader } from "./shaders/index.ts";
export function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log("shader compile error", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return undefined;
  }
  return shader;
}

export function createProgram(gl: WebGLRenderingContext, shader: Shader): WebGLProgram | undefined {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, shader.vertex);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, shader.fragment);
  if (!vertexShader || !fragmentShader) return undefined;
  const program = gl.createProgram();
  if (!program) return undefined;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log("program link error", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return undefined;
  }
  return program;
}

export interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  barycentricBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  centroidBuffer: WebGLBuffer;
  highlightBuffer: WebGLBuffer;
  fillOverlayBuffer: WebGLBuffer;
  positionLoc: number;
  colorLoc: number;
  barycentricLoc: number;
  uvLoc: number;
  centroidLoc: number;
  highlightLoc: number;
  fillOverlayLoc: number;
  resolutionLoc: WebGLUniformLocation;
  lightSourceCentersLoc: WebGLUniformLocation;
  lightSourceRadiiLoc: WebGLUniformLocation;
  lightTransformsLoc: WebGLUniformLocation;
  lightSourceSpreadsLoc: WebGLUniformLocation;
  lightSourceIntensitiesLoc: WebGLUniformLocation;
  lightSourceShadowsLoc: WebGLUniformLocation;
  lightSourceCastsLoc: WebGLUniformLocation;
  lightSourceCountLoc: WebGLUniformLocation;
  objectsLoc: WebGLUniformLocation;
  objectRotationsLoc: WebGLUniformLocation;
  objectFalloffsLoc: WebGLUniformLocation;
  objectOrdersLoc: WebGLUniformLocation;
  objectCountLoc: WebGLUniformLocation;
  objectShapesLoc: WebGLUniformLocation;
  objectShapeRowsLoc: WebGLUniformLocation;
  objectShapeMaxDepthLoc: WebGLUniformLocation;
  objectFillsLoc: WebGLUniformLocation;
  objectLiftsLoc: WebGLUniformLocation;
  objectShapeTexture: WebGLTexture;
  objectShapeSignature: string;
  lightShapesLoc: WebGLUniformLocation;
  lightShapeRowsLoc: WebGLUniformLocation;
  lightShapeMaxDepthLoc: WebGLUniformLocation;
  lightOrdersLoc: WebGLUniformLocation;
  lightGridlinesLoc: WebGLUniformLocation;
  lightLowpolyLoc: WebGLUniformLocation;
  lightShapeTexture: WebGLTexture;
  lightShapeSignature: string;
  supportsVertexTextures: boolean;
  textureMixLoc: WebGLUniformLocation;
  textureLoc: WebGLUniformLocation;
  hasTextureLoc: WebGLUniformLocation;
  maskLoc: WebGLUniformLocation;
  maskActiveLoc: WebGLUniformLocation;
  glowColorLoc: WebGLUniformLocation;
  backingGreyLoc: WebGLUniformLocation;
}

export function encodeObjectSdfAtlas(shapes: (ObjectShape | undefined)[], grid = OBJECT_SDF_GRID): Uint8Array {
  const atlas = grid * OBJECT_SDF_TILE;
  const data = new Uint8Array(atlas * atlas * 4);
  shapes.forEach((shape, slot) => {
    if (!shape || slot >= grid * grid) return;
    const tileCol = slot % grid;
    const tileRow = Math.floor(slot / grid);
    for (let row = 0; row < OBJECT_SDF_TILE; row++) {
      for (let col = 0; col < OBJECT_SDF_TILE; col++) {
        const sourceRow = Math.min(shape.tile - 1, Math.floor((row * shape.tile) / OBJECT_SDF_TILE));
        const sourceCol = Math.min(shape.tile - 1, Math.floor((col * shape.tile) / OBJECT_SDF_TILE));
        const source = sourceRow * shape.tile + sourceCol;

        const biased = Math.min(Math.max(shape.sdf[source] / (2 * OBJECT_SDF_RANGE) + 0.5, 0), 1) * 255;
        const x = tileCol * OBJECT_SDF_TILE + col;
        const y = tileRow * OBJECT_SDF_TILE + row;
        const offset = (y * atlas + x) * 4;
        data[offset] = Math.floor(biased);
        data[offset + 1] = Math.round((biased - Math.floor(biased)) * 255);
        data[offset + 2] = Math.round(((shape.grad[source * 2] / 127) * 0.5 + 0.5) * 255);
        data[offset + 3] = Math.round(((shape.grad[source * 2 + 1] / 127) * 0.5 + 0.5) * 255);
      }
    }
  });
  return data;
}

export function objectShapeAtlasSignature(shapes: readonly (ObjectShape | undefined)[]): string {
  return shapes.map((shape) => (shape ? `${shape.tile}:${shape.path}` : "")).join("|");
}

export function initGLState(canvas: HTMLCanvasElement): GLState | undefined {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) return undefined;
  if (!gl.getExtension("OES_standard_derivatives")) return undefined;
  const program = createProgram(gl, LIGHT_SOURCE_SHADER);
  if (!program) return undefined;

  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const barycentricBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const centroidBuffer = gl.createBuffer();
  const highlightBuffer = gl.createBuffer();
  const fillOverlayBuffer = gl.createBuffer();
  if (
    !positionBuffer ||
    !colorBuffer ||
    !barycentricBuffer ||
    !uvBuffer ||
    !centroidBuffer ||
    !highlightBuffer ||
    !fillOverlayBuffer
  )
    return undefined;

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const colorLoc = gl.getAttribLocation(program, "a_color");
  const barycentricLoc = gl.getAttribLocation(program, "a_barycentric");
  const uvLoc = gl.getAttribLocation(program, "a_uv");
  const centroidLoc = gl.getAttribLocation(program, "a_centroid");
  const highlightLoc = gl.getAttribLocation(program, "a_highlight");
  const fillOverlayLoc = gl.getAttribLocation(program, "a_fillOverlay");
  const objectShapeTexture = gl.createTexture();
  const lightShapeTexture = gl.createTexture();
  if (!objectShapeTexture || !lightShapeTexture) return undefined;
  for (const texture of [objectShapeTexture, lightShapeTexture]) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const lightSourceCentersLoc = gl.getUniformLocation(program, "u_lightSourceCenters");
  const lightSourceRadiiLoc = gl.getUniformLocation(program, "u_lightSourceRadii");
  const lightTransformsLoc = gl.getUniformLocation(program, "u_lightTransforms");
  const lightSourceSpreadsLoc = gl.getUniformLocation(program, "u_lightSourceSpreads");
  const lightSourceIntensitiesLoc = gl.getUniformLocation(program, "u_lightSourceIntensities");
  const lightSourceShadowsLoc = gl.getUniformLocation(program, "u_lightSourceShadows");
  const lightSourceCastsLoc = gl.getUniformLocation(program, "u_lightSourceCasts");
  const lightSourceCountLoc = gl.getUniformLocation(program, "u_lightSourceCount");
  const objectsLoc = gl.getUniformLocation(program, "u_objects");
  const objectRotationsLoc = gl.getUniformLocation(program, "u_objectRotations");
  const objectFalloffsLoc = gl.getUniformLocation(program, "u_objectFalloffs");
  const objectOrdersLoc = gl.getUniformLocation(program, "u_objectOrders");
  const objectCountLoc = gl.getUniformLocation(program, "u_objectCount");
  const objectShapesLoc = gl.getUniformLocation(program, "u_objectShapes");
  const objectShapeRowsLoc = gl.getUniformLocation(program, "u_objectShapeRows");
  const objectShapeMaxDepthLoc = gl.getUniformLocation(program, "u_objectShapeMaxDepth");
  const lightShapesLoc = gl.getUniformLocation(program, "u_lightShapes");
  const lightShapeRowsLoc = gl.getUniformLocation(program, "u_lightShapeRows");
  const lightShapeMaxDepthLoc = gl.getUniformLocation(program, "u_lightShapeMaxDepth");
  const lightOrdersLoc = gl.getUniformLocation(program, "u_lightOrders");
  const lightGridlinesLoc = gl.getUniformLocation(program, "u_lightGridlines");
  const lightLowpolyLoc = gl.getUniformLocation(program, "u_lightLowpoly");
  const objectFillsLoc = gl.getUniformLocation(program, "u_objectFills");
  const objectLiftsLoc = gl.getUniformLocation(program, "u_objectLifts");
  const textureMixLoc = gl.getUniformLocation(program, "u_textureMix");
  const textureLoc = gl.getUniformLocation(program, "u_texture");
  const hasTextureLoc = gl.getUniformLocation(program, "u_hasTexture");
  const maskLoc = gl.getUniformLocation(program, "u_mask");
  const maskActiveLoc = gl.getUniformLocation(program, "u_maskActive");
  const glowColorLoc = gl.getUniformLocation(program, "u_glowColor");
  const backingGreyLoc = gl.getUniformLocation(program, "u_backingGrey");
  if (
    positionLoc < 0 ||
    colorLoc < 0 ||
    barycentricLoc < 0 ||
    uvLoc < 0 ||
    centroidLoc < 0 ||
    highlightLoc < 0 ||
    fillOverlayLoc < 0 ||
    !resolutionLoc ||
    !lightSourceCentersLoc ||
    !lightSourceRadiiLoc ||
    !lightTransformsLoc ||
    !lightSourceSpreadsLoc ||
    !lightSourceIntensitiesLoc ||
    !lightSourceShadowsLoc ||
    !lightSourceCastsLoc ||
    !lightSourceCountLoc ||
    !objectsLoc ||
    !objectRotationsLoc ||
    !objectFalloffsLoc ||
    !objectOrdersLoc ||
    !objectCountLoc ||
    !objectShapesLoc ||
    !objectShapeRowsLoc ||
    !objectShapeMaxDepthLoc ||
    !lightShapesLoc ||
    !lightShapeRowsLoc ||
    !lightShapeMaxDepthLoc ||
    !lightOrdersLoc ||
    !lightGridlinesLoc ||
    !lightLowpolyLoc ||
    !objectFillsLoc ||
    !objectLiftsLoc ||
    !textureMixLoc ||
    !textureLoc ||
    !hasTextureLoc ||
    !maskLoc ||
    !maskActiveLoc ||
    !glowColorLoc ||
    !backingGreyLoc
  )
    return undefined;

  return {
    gl,
    program,
    positionBuffer,
    colorBuffer,
    barycentricBuffer,
    uvBuffer,
    centroidBuffer,
    highlightBuffer,
    fillOverlayBuffer,
    positionLoc,
    colorLoc,
    barycentricLoc,
    uvLoc,
    centroidLoc,
    highlightLoc,
    fillOverlayLoc,
    resolutionLoc,
    lightSourceCentersLoc,
    lightSourceRadiiLoc,
    lightTransformsLoc,
    lightSourceSpreadsLoc,
    lightSourceIntensitiesLoc,
    lightSourceShadowsLoc,
    lightSourceCastsLoc,
    lightSourceCountLoc,
    objectsLoc,
    objectRotationsLoc,
    objectFalloffsLoc,
    objectOrdersLoc,
    objectCountLoc,
    objectShapesLoc,
    objectShapeRowsLoc,
    objectShapeMaxDepthLoc,
    objectFillsLoc,
    objectLiftsLoc,
    objectShapeTexture,
    objectShapeSignature: "",
    lightShapesLoc,
    lightShapeRowsLoc,
    lightShapeMaxDepthLoc,
    lightOrdersLoc,
    lightGridlinesLoc,
    lightLowpolyLoc,
    lightShapeTexture,
    lightShapeSignature: "",
    supportsVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0,
    textureMixLoc,
    textureLoc,
    hasTextureLoc,
    maskLoc,
    maskActiveLoc,
    glowColorLoc,
    backingGreyLoc,
  };
}

export interface MaskLightSource {
  x: number;
  y: number;
  radius: number;
  spread: number;
  intensity: number;
  shadow: number;
  cast: number;
  order: number;
  shape?: ObjectShape;
  transform?: ObjectRotation;
  gridlines?: number;
  lowpoly?: boolean;
}

export interface DrawMaskMeshOptions {
  vertexCount: number;
  lightSources: MaskLightSource[];
  objects: ObjectGeometryInput[];
  textureMix: number;
  texture: WebGLTexture | undefined;
  maskTexture: WebGLTexture | undefined;
  glowColor: [number, number, number];
  backingVertexCount?: number;
  backingGrey?: number;
}

export function drawMaskMesh(state: GLState, options: DrawMaskMeshOptions): void {
  const { gl } = state;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (options.vertexCount === 0) return;

  gl.useProgram(state.program);
  gl.uniform2f(state.resolutionLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);

  const activeLights = options.lightSources.filter((l) => l.radius > 0).slice(0, MAX_MASK_LIGHT_SOURCES);
  gl.uniform1i(state.lightSourceCountLoc, activeLights.length);
  if (activeLights.length > 0) {
    const centers = new Float32Array(activeLights.length * 2);
    const radii = new Float32Array(activeLights.length);
    const spreads = new Float32Array(activeLights.length);
    const intensities = new Float32Array(activeLights.length);
    const shadows = new Float32Array(activeLights.length);
    const casts = new Float32Array(activeLights.length);
    const orders = new Float32Array(activeLights.length);
    const gridlines = new Float32Array(activeLights.length);
    const lowpoly = new Float32Array(activeLights.length);
    activeLights.forEach((light, i) => {
      centers[i * 2] = light.x;
      centers[i * 2 + 1] = light.y;
      radii[i] = Math.max(light.radius, 1);
      spreads[i] = Math.max(light.spread, 1);
      intensities[i] = light.intensity;
      shadows[i] = light.shadow;
      casts[i] = light.cast;
      orders[i] = light.order;
      gridlines[i] = light.gridlines ?? 0;
      lowpoly[i] = light.lowpoly ? 1 : 0;
    });
    gl.uniform2fv(state.lightSourceCentersLoc, centers);
    gl.uniform1fv(state.lightSourceRadiiLoc, radii);
    gl.uniform1fv(state.lightSourceSpreadsLoc, spreads);
    gl.uniform1fv(state.lightSourceIntensitiesLoc, intensities);
    gl.uniform1fv(state.lightSourceShadowsLoc, shadows);
    gl.uniform1fv(state.lightSourceCastsLoc, casts);
    gl.uniform1fv(state.lightOrdersLoc, orders);
    gl.uniform1fv(state.lightGridlinesLoc, gridlines);
    gl.uniform1fv(state.lightLowpolyLoc, lowpoly);
  }

  const lightTransforms = new Float32Array(MAX_MASK_LIGHT_SOURCES * 4);
  for (let i = 0; i < MAX_MASK_LIGHT_SOURCES; i++) {
    const transform = activeLights[i]?.transform?.inverse ?? OBJECT_ROTATION_NONE.inverse;
    lightTransforms[i * 4] = transform[0];
    lightTransforms[i * 4 + 1] = transform[1];
    lightTransforms[i * 4 + 2] = transform[2];
    lightTransforms[i * 4 + 3] = transform[3];
  }
  gl.uniform4fv(state.lightTransformsLoc, lightTransforms);

  const lightShapeRows = new Float32Array(MAX_MASK_LIGHT_SOURCES).fill(-1);
  const lightShapeMaxDepth = new Float32Array(MAX_MASK_LIGHT_SOURCES).fill(1);
  const lightShapes = activeLights.map((light) => light.shape);
  if (lightShapes.some((shape) => shape !== undefined)) {
    lightShapes.forEach((shape, i) => {
      if (!shape) return;
      lightShapeRows[i] = i;
      lightShapeMaxDepth[i] = shape.maxDepth;
    });
    const signature = objectShapeAtlasSignature(lightShapes);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, state.lightShapeTexture);
    if (signature !== state.lightShapeSignature) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        LIGHT_SDF_ATLAS,
        LIGHT_SDF_ATLAS,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        encodeObjectSdfAtlas(lightShapes, LIGHT_SDF_GRID),
      );
      state.lightShapeSignature = signature;
    }
    gl.uniform1i(state.lightShapesLoc, 3);
  }
  gl.uniform1fv(state.lightShapeRowsLoc, lightShapeRows);
  gl.uniform1fv(state.lightShapeMaxDepthLoc, lightShapeMaxDepth);

  const activeObjects = drawnMaskObjects(options.objects, activeLights);
  gl.uniform1i(state.objectCountLoc, activeObjects.length);
  if (activeObjects.length > 0) {
    const objects = new Float32Array(activeObjects.length * 4);
    const falloffs = new Float32Array(activeObjects.length);
    const orders = new Float32Array(activeObjects.length);
    const fills = new Float32Array(activeObjects.length * 4);
    const lifts = new Float32Array(activeObjects.length * 4);
    const rotations = new Float32Array(activeObjects.length * 4);
    activeObjects.forEach((object, i) => {
      objects[i * 4] = object.cx;
      objects[i * 4 + 1] = object.cy;
      objects[i * 4 + 2] = Math.max(object.radius, 1);
      objects[i * 4 + 3] = object.elevation;
      falloffs[i] = Math.max(object.falloff, MIN_MASK_OBJECT_FALLOFF);
      orders[i] = object.order;
      fills[i * 4] = object.fill?.r ?? 0;
      fills[i * 4 + 1] = object.fill?.g ?? 0;
      fills[i * 4 + 2] = object.fill?.b ?? 0;
      fills[i * 4 + 3] = object.fill?.a ?? 0;
      lifts[i * 4] = object.lift?.cx ?? object.cx;
      lifts[i * 4 + 1] = object.lift?.cy ?? object.cy;
      lifts[i * 4 + 2] = Math.max(object.lift?.radius ?? object.radius, 1);
      lifts[i * 4 + 3] = object.lift ? 1 : 0;
      const rotation = object.rotation?.inverse ?? OBJECT_ROTATION_NONE.inverse;
      rotations[i * 4] = rotation[0];
      rotations[i * 4 + 1] = rotation[1];
      rotations[i * 4 + 2] = rotation[2];
      rotations[i * 4 + 3] = rotation[3];
    });
    gl.uniform4fv(state.objectsLoc, objects);
    gl.uniform4fv(state.objectRotationsLoc, rotations);
    gl.uniform1fv(state.objectFalloffsLoc, falloffs);
    gl.uniform1fv(state.objectOrdersLoc, orders);
    gl.uniform4fv(state.objectFillsLoc, fills);
    gl.uniform4fv(state.objectLiftsLoc, lifts);
  }

  const shapeRows = new Float32Array(MAX_MASK_OBJECTS).fill(-1);
  const shapeMaxDepth = new Float32Array(MAX_MASK_OBJECTS).fill(1);
  const shapes = activeObjects.map((object) => object.shape);
  const usableShapes = state.supportsVertexTextures ? shapes : shapes.map(() => undefined);
  if (usableShapes.some((shape) => shape !== undefined)) {
    usableShapes.forEach((shape, i) => {
      if (!shape) return;
      shapeRows[i] = i;
      shapeMaxDepth[i] = shape.maxDepth;
    });
    const signature = objectShapeAtlasSignature(usableShapes);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.objectShapeTexture);
    if (signature !== state.objectShapeSignature) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        OBJECT_SDF_ATLAS,
        OBJECT_SDF_ATLAS,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        encodeObjectSdfAtlas(usableShapes),
      );
      state.objectShapeSignature = signature;
    }
    gl.uniform1i(state.objectShapesLoc, 2);
  }
  gl.uniform1fv(state.objectShapeRowsLoc, shapeRows);
  gl.uniform1fv(state.objectShapeMaxDepthLoc, shapeMaxDepth);

  gl.uniform1f(state.textureMixLoc, options.textureMix);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, options.texture ?? null);
  gl.uniform1i(state.textureLoc, 0);
  gl.uniform1f(state.hasTextureLoc, options.texture ? 1 : 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, options.maskTexture ?? null);
  gl.uniform1i(state.maskLoc, 1);
  gl.uniform1f(state.maskActiveLoc, options.maskTexture ? 1 : 0);
  gl.uniform3fv(state.glowColorLoc, options.glowColor);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
  gl.enableVertexAttribArray(state.positionLoc);
  gl.vertexAttribPointer(state.positionLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
  gl.enableVertexAttribArray(state.colorLoc);
  gl.vertexAttribPointer(state.colorLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
  gl.enableVertexAttribArray(state.barycentricLoc);
  gl.vertexAttribPointer(state.barycentricLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
  gl.enableVertexAttribArray(state.uvLoc);
  gl.vertexAttribPointer(state.uvLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.centroidBuffer);
  gl.enableVertexAttribArray(state.centroidLoc);
  gl.vertexAttribPointer(state.centroidLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
  gl.enableVertexAttribArray(state.highlightLoc);
  gl.vertexAttribPointer(state.highlightLoc, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.fillOverlayBuffer);
  gl.enableVertexAttribArray(state.fillOverlayLoc);
  gl.vertexAttribPointer(state.fillOverlayLoc, 4, gl.FLOAT, false, 0, 0);

  const backingGrey = options.backingGrey ?? 0;
  const backingCount = Math.min(options.backingVertexCount ?? 0, options.vertexCount);
  if (backingGrey <= 0 || backingCount === 0) {
    gl.uniform1f(state.backingGreyLoc, 0);
    gl.drawArrays(gl.TRIANGLES, 0, options.vertexCount);
    return;
  }

  gl.uniform1f(state.backingGreyLoc, backingGrey);
  gl.drawArrays(gl.TRIANGLES, 0, backingCount);
  gl.uniform1f(state.backingGreyLoc, 0);
  gl.drawArrays(gl.TRIANGLES, backingCount, options.vertexCount - backingCount);
}

export function colorToRGB01(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

export function uploadCurveMask(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  curves: { d: string; glow: { offset: number; opacity: number }[] }[],
  existing: WebGLTexture | undefined,
): WebGLTexture | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return existing;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ff0000";

  for (const curve of curves) {
    const path = new Path2D(curve.d);
    let covered = 0;
    for (const stop of [...curve.glow].sort((a, b) => b.offset - a.offset)) {
      const alpha = (stop.opacity - covered) / (1 - covered);
      if (!(alpha > 0)) continue;
      ctx.globalAlpha = Math.min(alpha, 1);
      ctx.lineWidth = stop.offset * 2;
      ctx.stroke(path);
      covered = stop.opacity;
    }
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  for (const curve of curves) ctx.fill(new Path2D(curve.d));

  const texture = existing ?? gl.createTexture();
  if (!texture) return undefined;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

const warmedImages = new Map<string, HTMLImageElement>();
const WARMED_IMAGE_LIMIT = 4;

function warmedImage(src: string): HTMLImageElement {
  const held = warmedImages.get(src);
  if (held) return held;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  warmedImages.set(src, image);
  while (warmedImages.size > WARMED_IMAGE_LIMIT) {
    const oldest = warmedImages.keys().next();
    if (oldest.done || oldest.value === src) break;
    warmedImages.delete(oldest.value);
  }
  return image;
}

export function warmImageTexture(src: string | undefined): void {
  if (!src) return;
  warmedImage(src);
}

export function loadImageTexture(
  gl: WebGLRenderingContext,
  src: string,
  onLoaded: (texture: WebGLTexture) => void,
  onError?: (error: unknown) => void,
): void {
  let image = warmedImage(src);
  if (image.complete && image.naturalWidth === 0) {
    warmedImages.delete(src);
    image = warmedImage(src);
  }
  const upload = () => {
    try {
      const texture = gl.createTexture();
      if (!texture) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      onLoaded(texture);
    } catch (error) {
      onError?.(error);
    }
  };
  if (image.complete && image.naturalWidth > 0) {
    upload();
    return;
  }
  const onImageLoad = () => {
    image.removeEventListener("error", onImageError);
    upload();
  };
  const onImageError = (error: unknown) => {
    image.removeEventListener("load", onImageLoad);
    warmedImages.delete(src);
    onError?.(error);
  };
  image.addEventListener("load", onImageLoad, { once: true });
  image.addEventListener("error", onImageError, { once: true });
}

export function parsePathPoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  const re = /(-?\d*\.?\d+(?:e[-+]?\d+)?)[,\s]+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) {
    points.push([parseFloat(match[1]), parseFloat(match[2])]);
  }
  return points;
}

const WELD_EPSILON_PX = 0.1;

function weldPoints(pointGroups: [number, number][][]): void {
  const canonical = new Map<string, [number, number]>();
  for (const points of pointGroups) {
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      const key = `${Math.round(x / WELD_EPSILON_PX)},${Math.round(y / WELD_EPSILON_PX)}`;
      const existing = canonical.get(key);
      if (existing) {
        points[i] = existing;
      } else {
        canonical.set(key, points[i]);
      }
    }
  }
}

export function buildWeldedMaskPointGroups(maskData: {
  width: number;
  height: number;
  polygons: { d: string }[];
  curves: { d: string }[];
}): {
  corners: [number, number][];
  polygonPointSets: [number, number][][];
} {
  const corners: [number, number][] =
    maskData.curves.length > 0
      ? [
          [0, 0],
          [maskData.width, 0],
          [0, maskData.height],
          [maskData.width, 0],
          [maskData.width, maskData.height],
          [0, maskData.height],
        ]
      : [];
  const polygonPointSets = maskData.polygons.map((polygon) => parsePathPoints(polygon.d));
  weldPoints([corners, ...polygonPointSets]);
  return { corners, polygonPointSets };
}

function assembleMaskMeshPositions(
  maskData: { width: number; height: number },
  corners: [number, number][],
  polygonPointSets: [number, number][][],
): { positions: number[]; uvs: number[]; centroids: number[] } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const centroids: number[] = [];

  for (const [x, y] of corners) {
    positions.push(x, y);
    uvs.push(x / maskData.width, 1 - y / maskData.height);
    centroids.push(x, y);
  }

  polygonPointSets.forEach((points) => {
    const centroid: [number, number] = [
      points.reduce((sum, [x]) => sum + x, 0) / points.length,
      points.reduce((sum, [, y]) => sum + y, 0) / points.length,
    ];
    for (const [x, y] of points) {
      positions.push(x, y);
      uvs.push(x / maskData.width, 1 - y / maskData.height);
      centroids.push(...centroid);
    }
  });

  return { positions, uvs, centroids };
}

export type ObjectOutline = Pick<ObjectGeometryInput, "cx" | "cy" | "radius" | "shape" | "rotation">;

export interface ObjectGeometryInput {
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  order: number;
  shape?: ObjectShape;
  fill?: ObjectFill_V1_0;
  lift?: { cx: number; cy: number; radius: number };
  rotation?: ObjectRotation;
}

export interface ObjectRotation {
  inverse: [number, number, number, number];
  visible: boolean;
}

export const OBJECT_ROTATION_NONE: ObjectRotation = { inverse: [1, 0, 0, 1], visible: true };

const OBJECT_ROTATION_EDGE_ON = 1e-4;

export function objectRotation(x: number, y: number, z: number, angleDegrees: number): ObjectRotation | undefined {
  return objectTransform({ x, y, z, angleDegrees }, undefined);
}

type Matrix2 = [number, number, number, number];

function multiply2(outer: Matrix2, inner: Matrix2): Matrix2 {
  return [
    outer[0] * inner[0] + outer[1] * inner[2],
    outer[0] * inner[1] + outer[1] * inner[3],
    outer[2] * inner[0] + outer[3] * inner[2],
    outer[2] * inner[1] + outer[3] * inner[3],
  ];
}

function invert2(forward: Matrix2): ObjectRotation {
  const determinant = forward[0] * forward[3] - forward[1] * forward[2];
  if (Math.abs(determinant) < OBJECT_ROTATION_EDGE_ON) return { inverse: [1, 0, 0, 1], visible: false };
  return {
    inverse: [forward[3] / determinant, -forward[1] / determinant, -forward[2] / determinant, forward[0] / determinant],
    visible: true,
  };
}

function rotationForward(x: number, y: number, z: number, angleDegrees: number): Matrix2 | undefined {
  const length = Math.hypot(x, y, z);
  if (length === 0 || angleDegrees % 360 === 0) return undefined;
  const angle = (angleDegrees * Math.PI) / 180;
  const [ax, ay, az] = [x / length, y / length, z / length];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = 1 - cos;
  return [t * ax * ax + cos, t * ax * ay - sin * az, t * ax * ay + sin * az, t * ay * ay + cos];
}

function skewForward(ax: number, ay: number): Matrix2 | undefined {
  if (ax === 0 && ay === 0) return undefined;
  const tanAx = Math.tan((toCssSkewAngle(ax) * Math.PI) / 180);
  const tanAy = Math.tan((toCssSkewAngle(ay) * Math.PI) / 180);
  return [1, tanAx, tanAy, 1];
}

export function objectTransform(
  rotate: { x: number; y: number; z: number; angleDegrees: number } | undefined,
  skew: { ax: number; ay: number } | undefined,
): ObjectRotation | undefined {
  const rotation = rotate ? rotationForward(rotate.x, rotate.y, rotate.z, rotate.angleDegrees) : undefined;
  const skewed = skew ? skewForward(skew.ax, skew.ay) : undefined;
  if (!rotation && !skewed) return undefined;
  const forward = rotation && skewed ? multiply2(rotation, skewed) : (rotation ?? skewed)!;
  return invert2(forward);
}

export function objectToShape(rotation: ObjectRotation | undefined, x: number, y: number): [number, number] {
  if (!rotation) return [x, y];
  const [a, b, c, d] = rotation.inverse;
  return [a * x + b * y, c * x + d * y];
}

export function isActiveObject(object: ObjectGeometryInput): boolean {
  if (isBehindMask(object)) return false;
  return object.radius > 0 && object.elevation !== 0 && (object.rotation?.visible ?? true);
}

export function isDrawnObject(object: ObjectGeometryInput, lights: readonly { order: number }[] = []): boolean {
  if (object.radius <= 0 || !(object.rotation?.visible ?? true)) return false;
  if (lights.some((light) => occludes(object.order, light.order))) return true;
  if (isBehindMask(object)) return (object.fill?.a ?? 0) > 0 || object.lift !== undefined;
  return object.elevation !== 0 || (object.fill?.a ?? 0) > 0 || object.lift !== undefined;
}

function cappedByElevation<T extends ObjectGeometryInput>(objects: T[]): T[] {
  return objects.sort((a, b) => Math.abs(b.elevation) - Math.abs(a.elevation)).slice(0, MAX_MASK_OBJECTS);
}

export function activeMaskObjects<T extends ObjectGeometryInput>(objects: T[]): T[] {
  return cappedByElevation(objects.filter(isActiveObject));
}

export function drawnMaskObjects<T extends ObjectGeometryInput>(
  objects: T[],
  lights: readonly { order: number }[] = [],
): T[] {
  return cappedByElevation(objects.filter((object) => isDrawnObject(object, lights)));
}

export function objectProfileK(u: number, falloff: number): number {
  const s = Math.max(1 - u * u, 0);
  return Math.pow(Math.max(s, 1e-4), falloff);
}

export function objectProfileUAt(object: ObjectOutline, point: [number, number]): number {
  const [nx, ny] = objectToShape(
    object.rotation,
    (point[0] - object.cx) / object.radius,
    (point[1] - object.cy) / object.radius,
  );
  if (!object.shape) return Math.hypot(nx, ny);
  return objectShapeProfileU(object.shape, nx, ny);
}

export function liftSourceAt<T extends ObjectGeometryInput>(
  objects: readonly T[],
  point: [number, number],
  behind = false,
): T | undefined {
  let winner: T | undefined;
  let bestOrder = -Infinity;
  let nearest = 1;
  for (const object of objects) {
    if (object.lift === undefined) continue;
    if (isBehindMask(object) !== behind) continue;
    const u = objectProfileUAt(object, point);
    if (u >= 1) continue;
    if (object.order < bestOrder - MASK_ORDER_EPSILON) continue;
    if (object.order <= bestOrder + MASK_ORDER_EPSILON && u >= nearest) continue;
    bestOrder = object.order;
    nearest = u;
    winner = object;
  }
  return winner;
}

export function objectSwellAt(point: [number, number], objects: ObjectGeometryInput[]): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const object of objects) {
    const toPointX = point[0] - object.cx;
    const toPointY = point[1] - object.cy;
    const u = objectProfileUAt(object, point);
    if (u >= 1) continue;
    const height = object.elevation * objectProfileK(u, Math.max(object.falloff, MIN_MASK_OBJECT_FALLOFF));
    const coefficient = Math.min(
      Math.max((MASK_OBJECT_SWELL * height) / object.radius, -MASK_OBJECT_SWELL_LIMIT),
      MASK_OBJECT_SWELL_LIMIT,
    );
    dx += coefficient * toPointX;
    dy += coefficient * toPointY;
  }
  return [dx, dy];
}

const MAX_EDGE_SUBDIVISION_POINTS = 6;

function edgeSwellSag(a: [number, number], b: [number, number], objects: ObjectGeometryInput[]): number {
  const swellA = objectSwellAt(a, objects);
  const swellB = objectSwellAt(b, objects);
  let worst = 0;
  for (const t of [0.25, 0.5, 0.75]) {
    const at: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const swellAt = objectSwellAt(at, objects);
    worst = Math.max(
      worst,
      Math.hypot(
        swellA[0] + (swellB[0] - swellA[0]) * t - swellAt[0],
        swellA[1] + (swellB[1] - swellA[1]) * t - swellAt[1],
      ),
    );
  }
  return worst;
}

function edgeSubdivisionCount(a: [number, number], b: [number, number], objects: ObjectGeometryInput[]): number {
  const sag = edgeSwellSag(a, b, objects);
  if (!(sag > OBJECT_SUBDIVISION_TOLERANCE_PX)) return 0;
  return Math.min(Math.ceil(Math.sqrt(sag / OBJECT_SUBDIVISION_TOLERANCE_PX)) - 1, MAX_EDGE_SUBDIVISION_POINTS);
}

function pointsAlongEdge(a: [number, number], b: [number, number], n: number): [number, number][] {
  const points: [number, number][] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return points;
}

function pointId(point: [number, number], ids: Map<[number, number], number>): number {
  let id = ids.get(point);
  if (id === undefined) {
    id = ids.size;
    ids.set(point, id);
  }
  return id;
}

function edgeKey(idA: number, idB: number): string {
  return idA < idB ? `${idA},${idB}` : `${idB},${idA}`;
}

function computeEdgeSubdivisionCounts(
  triangles: [number, number][][],
  objects: ObjectGeometryInput[],
): { ids: Map<[number, number], number>; counts: Map<string, number> } {
  const ids = new Map<[number, number], number>();
  const counts = new Map<string, number>();
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  for (const tri of triangles) {
    for (const [i, j] of edges) {
      const a = tri[i];
      const b = tri[j];
      const key = edgeKey(pointId(a, ids), pointId(b, ids));
      if (!counts.has(key)) counts.set(key, edgeSubdivisionCount(a, b, objects));
    }
  }
  return { ids, counts };
}

function boundaryLoopForTriangle(
  tri: [number, number][],
  ids: Map<[number, number], number>,
  counts: Map<string, number>,
): [number, number][] {
  const [a, b, c] = tri;
  const loop: [number, number][] = [];
  for (const [p, q] of [
    [a, b],
    [b, c],
    [c, a],
  ] as [number, number][][]) {
    loop.push(p);
    const n = counts.get(edgeKey(pointId(p, ids), pointId(q, ids))) ?? 0;
    if (n > 0) loop.push(...pointsAlongEdge(p, q, n));
  }
  return loop;
}

function isStrictlyInsideTriangle(point: [number, number], tri: [number, number][]): boolean {
  const [a, b, c] = tri;
  const cross = (p: [number, number], q: [number, number]): number =>
    (q[0] - p[0]) * (point[1] - p[1]) - (q[1] - p[1]) * (point[0] - p[0]);
  const ab = cross(a, b);
  const bc = cross(b, c);
  const ca = cross(c, a);
  const epsilon = 1e-6;
  return (ab > epsilon && bc > epsilon && ca > epsilon) || (ab < -epsilon && bc < -epsilon && ca < -epsilon);
}

function fanTriangulate(
  loop: [number, number][],
  tri: [number, number][],
  objects: ObjectGeometryInput[],
): [number, number][][] {
  if (loop.length === 3) return [[loop[0], loop[1], loop[2]]];

  let anchor: [number, number] | undefined;
  let bestElevation = 0;
  for (const object of objects) {
    const epicenter: [number, number] = [object.cx, object.cy];
    if (Math.abs(object.elevation) <= bestElevation) continue;
    if (!isStrictlyInsideTriangle(epicenter, tri)) continue;
    anchor = epicenter;
    bestElevation = Math.abs(object.elevation);
  }
  const center: [number, number] = anchor ?? [
    loop.reduce((sum, [x]) => sum + x, 0) / loop.length,
    loop.reduce((sum, [, y]) => sum + y, 0) / loop.length,
  ];

  const triangles: [number, number][][] = [];
  for (let i = 0; i < loop.length; i++) {
    triangles.push([center, loop[i], loop[(i + 1) % loop.length]]);
  }
  return triangles;
}

function subdivideForObjects(
  triangles: [number, number][][],
  objects: ObjectGeometryInput[],
): { outputTriangles: [number, number][][]; outputCounts: number[] } {
  const { ids, counts } = computeEdgeSubdivisionCounts(triangles, objects);
  const outputTriangles: [number, number][][] = [];
  const outputCounts: number[] = [];
  for (const tri of triangles) {
    const fanned = fanTriangulate(boundaryLoopForTriangle(tri, ids, counts), tri, objects);
    outputTriangles.push(...fanned);
    outputCounts.push(fanned.length);
  }
  return { outputTriangles, outputCounts };
}

export function subdivideMeshForObjects(
  corners: [number, number][],
  polygonPointSets: [number, number][][],
  objects: ObjectGeometryInput[],
): {
  corners: [number, number][];
  polygonPointSets: [number, number][][];
  polygonOutputCounts: number[];
} {
  const active = objects.filter(isActiveObject);
  if (active.length === 0) {
    return { corners, polygonPointSets, polygonOutputCounts: polygonPointSets.map(() => 1) };
  }

  const cornerTriangles: [number, number][][] = [];
  for (let i = 0; i + 3 <= corners.length; i += 3) cornerTriangles.push(corners.slice(i, i + 3));

  const { outputTriangles, outputCounts } = subdivideForObjects([...cornerTriangles, ...polygonPointSets], active);

  const cornerOutputCount = outputCounts.slice(0, cornerTriangles.length).reduce((sum, n) => sum + n, 0);
  return {
    corners: outputTriangles.slice(0, cornerOutputCount).flat(),
    polygonPointSets: outputTriangles.slice(cornerOutputCount),
    polygonOutputCounts: outputCounts.slice(cornerTriangles.length),
  };
}

export function buildStaticMaskMesh(
  maskData: {
    width: number;
    height: number;
    polygons: { d: string; fill: string }[];
    curves: { d: string; fill: string }[];
    objects: ObjectGeometryInput[];
  },
  colorCtx: CanvasRenderingContext2D,
  precomputed?: { corners: [number, number][]; polygonPointSets: [number, number][][] },
  precomputedColors?: [number, number, number][],
): {
  positions: number[];
  colors: number[];
  barycentrics: number[];
  uvs: number[];
  centroids: number[];
  vertexCount: number;
  vertexRanges: [number, number][];
} {
  const built = precomputed ?? buildWeldedMaskPointGroups(maskData);
  let corners = built.corners;
  let polygonPointSets = built.polygonPointSets;
  let polygonOutputCounts = polygonPointSets.map(() => 1);

  if (maskData.objects.some(isActiveObject)) {
    const subdivided = subdivideMeshForObjects(corners, polygonPointSets, maskData.objects);
    corners = subdivided.corners;
    polygonPointSets = subdivided.polygonPointSets;
    polygonOutputCounts = subdivided.polygonOutputCounts;
  }

  const { positions, uvs, centroids } = assembleMaskMeshPositions(maskData, corners, polygonPointSets);
  const colors: number[] = [];
  const barycentrics: number[] = [];

  if (maskData.curves.length > 0) {
    const [r, g, b] = colorToRGB01(colorCtx, maskData.curves[0].fill);
    for (let i = 0; i < corners.length; i++) {
      colors.push(r, g, b);
      barycentrics.push(1, 1, 1);
    }
  }

  const vertexRanges: [number, number][] = [];
  let vertex = corners.length;
  maskData.polygons.forEach((polygon, i) => {
    const [r, g, b] = precomputedColors?.[i] ?? colorToRGB01(colorCtx, polygon.fill);
    const outputCount = polygonOutputCounts[i] ?? 1;
    for (let t = 0; t < outputCount; t++) {
      colors.push(r, g, b, r, g, b, r, g, b);
      barycentrics.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
    }
    vertexRanges.push([vertex, outputCount * 3]);
    vertex += outputCount * 3;
  });

  return { positions, colors, barycentrics, uvs, centroids, vertexCount: positions.length / 2, vertexRanges };
}

export function uploadStaticMaskMesh(
  state: GLState,
  mesh: { positions: number[]; colors: number[]; barycentrics: number[]; uvs: number[]; centroids: number[] },
): void {
  const { gl } = state;
  gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.colors), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.barycentrics), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.centroidBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.centroids), gl.STATIC_DRAW);
}

export type MaskMeshRefs = {
  positionsRef: React.RefObject<number[]>;
  colorsRef: React.RefObject<number[]>;
  barycentricsRef: React.RefObject<number[]>;
  uvsRef: React.RefObject<number[]>;
  centroidsRef: React.RefObject<number[]>;
  vertexCountRef: React.RefObject<number>;
  dirtyRef: React.RefObject<boolean>;
  curvesRef: React.RefObject<MaskCurve_V1_0[]>;
  glowColorRef: React.RefObject<[number, number, number]>;
  backingVertexCountRef: React.RefObject<number>;
};
