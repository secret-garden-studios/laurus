import { LaurusProjectImg, LaurusProjectSvg, LaurusProjectMask } from "../../projects/projects.server";
import { toCssSkewAngle } from "../skew-angle.ts";

interface Point2D {
  x: number;
  y: number;
}
interface CornerTravel {
  topLeft: Point2D;
  topRight: Point2D;
  bottomLeft: Point2D;
  bottomRight: Point2D;
}
function calculate3DTravelWithPerspective(
  meta: LaurusProjectImg | LaurusProjectSvg | LaurusProjectMask,
  perspective: number = Infinity,
): CornerTravel {
  const {
    width,
    height,
    scale_x,
    scale_y,
    rotate_x: rx,
    rotate_y: ry,
    rotate_z: rz,
    rotate_angle,
    skew_ax,
    skew_ay,
  } = meta;
  const theta = rotate_angle * (Math.PI / 180);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const omc = 1 - cosT;

  const tanAx = Math.tan(toCssSkewAngle(skew_ax) * (Math.PI / 180));
  const tanAy = Math.tan(toCssSkewAngle(skew_ay) * (Math.PI / 180));
  const scaledW0 = width * scale_x;
  const scaledH0 = height * scale_y;

  const skewed = (x: number, y: number): Point2D => ({
    x: x + tanAx * y,
    y: y + tanAy * x,
  });

  const len = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (len === 0) {
    const travelOf = (x: number, y: number): Point2D => {
      const s = skewed(x, y);
      return { x: s.x - x, y: s.y - y };
    };
    return {
      topLeft: travelOf(0, 0),
      topRight: travelOf(scaledW0, 0),
      bottomLeft: travelOf(0, scaledH0),
      bottomRight: travelOf(scaledW0, scaledH0),
    };
  }

  const ux = rx / len;
  const uy = ry / len;
  const uz = rz / len;
  const r11 = cosT + ux * ux * omc;
  const r12 = ux * uy * omc - uz * sinT;
  const r13 = ux * uz * omc + uy * sinT;
  const r21 = uy * ux * omc + uz * sinT;
  const r22 = cosT + uy * uy * omc;
  const r23 = uy * uz * omc - ux * sinT;
  const r31 = uz * ux * omc - uy * sinT;
  const r32 = uz * uy * omc + ux * sinT;
  const r33 = cosT + uz * uz * omc;
  const scaledW = width * scale_x;
  const scaledH = height * scale_y;

  const getTravel = (origX: number, origY: number, origZ: number): Point2D => {
    const { x: skewX, y: skewY } = skewed(origX, origY);
    const rotX = r11 * skewX + r12 * skewY + r13 * origZ;
    const rotY = r21 * skewX + r22 * skewY + r23 * origZ;
    const rotZ = r31 * skewX + r32 * skewY + r33 * origZ;
    const f = perspective === Infinity ? 1 : perspective / (perspective - rotZ);
    const projX = rotX * f;
    const projY = rotY * f;
    return {
      x: projX - origX,
      y: projY - origY,
    };
  };

  return {
    topLeft: getTravel(0, 0, 0),
    topRight: getTravel(scaledW, 0, 0),
    bottomLeft: getTravel(0, scaledH, 0),
    bottomRight: getTravel(scaledW, scaledH, 0),
  };
}

function calculateBoundingDeltas(meta: LaurusProjectImg | LaurusProjectSvg | LaurusProjectMask): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const { width, height, scale_x, scale_y } = meta;
  const travel = calculate3DTravelWithPerspective(meta);
  const scaledW = width * scale_x;
  const scaledH = height * scale_y;
  const newX = [
    0 + travel.topLeft.x,
    scaledW + travel.topRight.x,
    0 + travel.bottomLeft.x,
    scaledW + travel.bottomRight.x,
  ];
  const newY = [
    0 + travel.topLeft.y,
    0 + travel.topRight.y,
    scaledH + travel.bottomLeft.y,
    scaledH + travel.bottomRight.y,
  ];
  return {
    top: Math.min(...newY),
    right: Math.max(...newX) - width,
    bottom: Math.max(...newY) - height,
    left: Math.min(...newX),
  };
}

export function calculateTransformedBounds(meta: LaurusProjectImg | LaurusProjectSvg | LaurusProjectMask): {
  width: number;
  height: number;
  deltas: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
} {
  const { width, height } = meta;
  const deltas = calculateBoundingDeltas(meta);
  return {
    width: width + deltas.right - deltas.left,
    height: height + deltas.bottom - deltas.top,
    deltas,
  };
}
