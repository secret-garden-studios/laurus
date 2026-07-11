import { CSSProperties, useMemo } from "react";

function base64Encode(markup: string) {
  const cleaned = markup.replace(/>\s+</g, "><").trim();
  return Buffer.from(cleaned).toString("base64");
}

export interface LaurusClientSvg {
  media_key: string;
  width: number;
  height: number;
  viewbox: string;
  fill: string;
  stroke: string;
  stroke_width: number;
  markup: string;
}

export type LaurusCropSvg =
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "5:4" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "7:5" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "3:2" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "16:9" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "9:16" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "2:3" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "5:7" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "4:5" }
  | { svg: LaurusClientSvg; order: number; timestamp: string; type: "1:1" };

export function getCrops(fill?: string): LaurusCropSvg[] {
  const now = new Date().toISOString();
  return [
    { svg: crop5_4(fill), order: 1, timestamp: now, type: "5:4" },
    { svg: crop7_5(fill), order: 2, timestamp: now, type: "7:5" },
    { svg: crop3_2(fill), order: 3, timestamp: now, type: "3:2" },
    { svg: crop16_9(fill), order: 4, timestamp: now, type: "16:9" },
    { svg: crop9_16(fill), order: 5, timestamp: now, type: "9:16" },
    { svg: crop2_3(fill), order: 6, timestamp: now, type: "2:3" },
    { svg: crop5_7(fill), order: 7, timestamp: now, type: "5:7" },
    { svg: crop4_5(fill), order: 8, timestamp: now, type: "4:5" },
    { svg: cropSquare(fill), order: 9, timestamp: now, type: "1:1" },
  ];
}

interface SvgRepo {
  svg: LaurusClientSvg;
  scale: number | undefined;
  scaleToContaier?: boolean;
  onContainerClick?: () => void;
  onSvgRef?: (element: SVGSVGElement | null, refKey: string) => void;
  inputId?: string;
  title?: string;
  style?: CSSProperties;
  containerStyle?: CSSProperties;
}
export function SvgRepo({
  svg,
  scale,
  scaleToContaier,
  onContainerClick,
  onSvgRef,
  inputId,
  title,
  style,
  containerStyle,
}: SvgRepo) {
  const decodedString = decodeURIComponent(
    atob(svg.markup)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );

  const width = useMemo(() => {
    if (!scale) return svg.width;
    const containerWidth: number = scaleToContaier ? parseFloat(containerStyle?.width?.toString() ?? "1") : 1;
    return scaleToContaier ? scale * containerWidth : scale * svg.width;
  }, [containerStyle?.width, scale, scaleToContaier, svg.width]);

  const height = useMemo(() => {
    if (!scale) return svg.height;
    const containerHeight: number = scaleToContaier ? parseFloat(containerStyle?.height?.toString() ?? "1") : 1;
    return scaleToContaier ? scale * containerHeight : scale * svg.height;
  }, [containerStyle?.height, scale, scaleToContaier, svg.height]);

  return (
    <div
      title={title ?? ""}
      onClick={() => {
        if (onContainerClick) onContainerClick();
      }}
      style={{
        display: "grid",
        placeContent: "center",
        cursor: onContainerClick ? "pointer" : "",
        ...containerStyle,
      }}
    >
      {decodedString && (
        <svg
          ref={(r) => {
            if (onSvgRef) {
              onSvgRef(r, `${inputId ?? svg.media_key}`);
            }
          }}
          style={style}
          version="1.1"
          width={width}
          height={height}
          fill={svg.fill}
          stroke={svg.stroke}
          strokeWidth={svg.stroke_width}
          viewBox={svg.viewbox}
          dangerouslySetInnerHTML={{ __html: decodedString }}
        />
      )}
    </div>
  );
}

export function videoCameraBack(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/video_camera_back_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M200-320h400L462-500l-92 120-62-80-108 140Zm-40 160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160H160Z"/>`,
    ),
  };
}

export function motionPhotosOn(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/motion_photos_on_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-32 5-64t15-63q5-16 20.5-21.5T150-626q15 8 21.5 23.5T173-570q-6 22-9.5 44.5T160-480q0 134 93 227t227 93q134 0 227-93t93-227q0-134-93-227t-227-93q-24 0-47.5 3.5T386-786q-17 5-32-1t-22-21q-7-15-.5-30.5T354-859q30-11 62-16t64-5q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80ZM177.5-697.5Q160-715 160-740t17.5-42.5Q195-800 220-800t42.5 17.5Q280-765 280-740t-17.5 42.5Q245-680 220-680t-42.5-17.5ZM480-480Z"/>`,
    ),
  };
}

export function arrowDropDown(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/arrow_drop_down_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M480-360 280-560h400L480-360Z"/>`),
  };
}

export function arrowDropUp(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/arrow_drop_up_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="m280-400 200-200 200 200H280Z"/>`),
  };
}

export function arrowLeft(
  fill: string = "rgba(227, 227, 227, 1)",
  stroke: string = "none",
  strokeWidth: number = 0,
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/arrow_left_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 187.99999 344.00002",
    fill,
    stroke,
    stroke_width: strokeWidth,
    markup: base64Encode(
      `<path d="M 154,-622 9,-767 Q 4,-772 2,-777 0,-782 0,-788 0,-794 2,-799 4,-804 9,-809 L 154,-954 Q 157,-957 160.5,-958.5 164,-960 168,-960 176,-960 182,-954.5 188,-949 188,-940 V -636 Q 188,-627 182,-621.5 176,-616 168,-616 166,-616 154,-622 Z" />`,
    ),
  };
}

export function arrowRight(
  fill: string = "rgba(227, 227, 227, 1)",
  stroke: string = "none",
  strokeWidth: number = 0,
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/arrow_right_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 187.99999 344.00002",
    fill,
    stroke,
    stroke_width: strokeWidth,
    markup: base64Encode(
      `<path d="M 20,-616 Q 12,-616 6,-621.5 0,-627 0,-636 V -940 Q 0,-949 6,-954.5 12,-960 20,-960 22,-960 34,-954 L 179,-809 Q 184,-804 186,-799 188,-794 188,-788 188,-782 186,-777 184,-772 179,-767 L 34,-622 Q 31,-619 27.5,-617.5 24,-616 20,-616 Z" />`,
    ),
  };
}

export function closeIcon(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/close_24dp_D9D9D9_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>`,
    ),
  };
}

export function check(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/check_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z"/>`,
    ),
  };
}

export function checkCircle(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/check_circle_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`,
    ),
  };
}

export function checkCircleNoFill(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/check_circle_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function cancelCircle(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/cancel_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`,
    ),
  };
}

export function cancelCircleFillZero(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/cancel_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m480-424 116 116q11 11 28 11t28-11q11-11 11-28t-11-28L536-480l116-116q11-11 11-28t-11-28q-11-11-28-11t-28 11L480-536 364-652q-11-11-28-11t-28 11q-11 11-11 28t11 28l116 116-116 116q-11 11-11 28t11 28q11 11 28 11t28-11l116-116Zm0 344q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function addCircle(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/add_circle_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`,
    ),
  };
}

export function circle(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/circle_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`,
    ),
  };
}

export function circleFillZero(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/circle_24dp_E3E3E3_FILL0_wght500_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-71.87q-84.91 0-159.34-32.12-74.44-32.12-129.5-87.17-55.05-55.06-87.17-129.5Q71.87-395.09 71.87-480t32.12-159.34q32.12-74.44 87.17-129.5 55.06-55.05 129.5-87.17 74.43-32.12 159.34-32.12t159.34 32.12q74.44 32.12 129.5 87.17 55.05 55.06 87.17 129.5 32.12 74.43 32.12 159.34t-32.12 159.34q-32.12 74.44-87.17 129.5-55.06 55.05-129.5 87.17Q564.91-71.87 480-71.87Zm0-91q133.04 0 225.09-92.04 92.04-92.05 92.04-225.09 0-133.04-92.04-225.09-92.05-92.04-225.09-92.04-133.04 0-225.09 92.04-92.04 92.05-92.04 225.09 0 133.04 92.04 225.09 92.05 92.04 225.09 92.04ZM480-480Z"/>`,
    ),
  };
}

export function ellipseFillZero(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/ellipse_24dp_E3E3E3_FILL0_wght500_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 480,-194.309 Q 386.599,-194.309 304.726,-216.793 222.842,-239.277 162.276,-277.812 101.721,-316.354 66.389,-368.462 31.057,-420.563 31.057,-480 31.057,-539.437 66.389,-591.538 101.721,-643.646 162.276,-682.188 222.842,-720.723 304.726,-743.207 386.599,-765.691 480,-765.691 573.401,-765.691 655.274,-743.207 737.158,-720.723 797.724,-682.188 858.279,-643.646 893.611,-591.538 928.943,-539.437 928.943,-480 928.943,-420.563 893.611,-368.462 858.279,-316.354 797.724,-277.812 737.158,-239.277 655.274,-216.793 573.401,-194.309 480,-194.309 Z M 480,-258.009 Q 626.344,-258.009 727.599,-322.437 828.843,-386.872 828.843,-480 828.843,-573.128 727.599,-637.563 626.344,-701.991 480,-701.991 333.656,-701.991 232.401,-637.563 131.157,-573.128 131.157,-480 131.157,-386.872 232.401,-322.437 333.656,-258.009 480,-258.009 Z M 480,-480 Z"/>`,
    ),
  };
}

export function updateDisabled(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/update_disabled_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 791,-55 671,-175 C 643,-157.66667 613,-144.16667 581,-134.5 549,-124.83333 515.33333,-120 480,-120 430,-120 383.16667,-129.5 339.5,-148.5 295.83333,-167.5 257.83333,-193.16667 225.5,-225.5 193.16667,-257.83333 167.5,-295.83333 148.5,-339.5 129.5,-383.16667 120,-430 120,-480 120,-515.33333 124.83333,-549 134.5,-581 144.16667,-613 157.66667,-643 175,-671 L 55,-791 112,-848 848,-112 Z M 480,-200 C 504,-200 527.16667,-202.83333 549.5,-208.5 571.83333,-214.16667 593,-222.33333 613,-233 L 233,-613 C 222.33333,-593 214.16667,-571.83333 208.5,-549.5 202.83333,-527.16667 200,-504 200,-480 200,-402 227.16667,-335.83333 281.5,-281.5 335.83333,-227.16667 402,-200 480,-200 Z M 600,-560 V -640 H 710 C 682.66667,-677.33333 649,-706.66667 609,-728 569,-749.33333 526,-760 480,-760 456,-760 432.83333,-757.16667 410.5,-751.5 388.16667,-745.83333 367,-737.66667 347,-727 L 289,-785 C 317,-802.33333 347,-815.83333 379,-825.5 411,-835.16667 444.66667,-840 480,-840 534.66667,-840 586.5,-828.33333 635.5,-805 684.5,-781.66667 726,-748.66667 760,-706 V -800 H 840 V -560 Z M 785,-289 727,-347 C 734.33333,-361.66667 740.5,-376.66667 745.5,-392 750.5,-407.33333 754,-423.33333 756,-440 H 838 C 834.66667,-412 828.5,-385.33333 819.5,-360 810.5,-334.66667 799,-311 785,-289 Z"/>`,
    ),
  };
}

export function syncAlt(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/sync_alt_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M280-120 80-320l200-200 57 56-104 104h607v80H233l104 104-57 56Zm400-320-57-56 104-104H120v-80h607L623-784l57-56 200 200-200 200Z"/>`,
    ),
  };
}

export function dragIndicator(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/drag_indicator_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/>`,
    ),
  };
}

export function hexagon(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/hexagon_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M318-120q-22 0-40-10.5T249-160L87-440q-11-19-11-40t11-40l162-280q11-19 29-29.5t40-10.5h324q22 0 40 10.5t29 29.5l162 280q11 19 11 40t-11 40L711-160q-11 19-29 29.5T642-120H318Z"/>`,
    ),
  };
}

export function remove(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/remove_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M240-440q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h480q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H240Z"/>`,
    ),
  };
}

export function add2(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/add_2_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M451.5-131.5Q440-143 440-160v-280H160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h280v-280q0-17 11.5-28.5T480-840q17 0 28.5 11.5T520-800v280h280q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H520v280q0 17-11.5 28.5T480-120q-17 0-28.5-11.5Z"/>`,
    ),
  };
}

export function playCircle(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/play_circle_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function autorenew(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/autorenew_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M204-318q-22-38-33-78t-11-82q0-134 93-228t227-94h7l-64-64 56-56 160 160-160 160-56-56 64-64h-7q-100 0-170 70.5T240-478q0 26 6 51t18 49l-60 60ZM481-40 321-200l160-160 56 56-64 64h7q100 0 170-70.5T720-482q0-26-6-51t-18-49l60-60q22 38 33 78t11 82q0 134-93 228t-227 94h-7l64 64-56 56Z"/>`,
    ),
  };
}

export function refresh(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/refresh_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>`,
    ),
  };
}

export function updateCounterClockwise(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/update_counter_clockwise_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 480,-120 Q 555,-120 620.5,-148.5 686,-177 734.5,-225.5 783,-274 811.5,-339.5 840,-405 840,-480 840,-555 811.5,-620.5 783,-686 734.5,-734.5 686,-783 620.5,-811.5 555,-840 480,-840 398,-840 324.5,-805 251,-770 200,-706 V -800 H 120 V -560 H 360 V -640 H 250 Q 291,-696 351,-728 411,-760 480,-760 597,-760 678.5,-678.5 760,-597 760,-480 760,-363 678.5,-281.5 597,-200 480,-200 375,-200 296.5,-268 218,-336 204,-440 H 122 Q 137,-303 239.5,-211.5 342,-120 480,-120 Z M 368,-312 520,-464 V -680 H 440 V -496 L 312,-368 Z" />`,
    ),
  };
}

export function fastRewind(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/fast_rewind_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M860-240 500-480l360-240v480Zm-400 0L100-480l360-240v480Z"/>`),
  };
}

export function skipNext(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/skip_next_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M660-240v-480h80v480h-80Zm-440 0v-480l360 240-360 240Z"/>`),
  };
}

export function skipPrevious(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/skip_previous_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M220-240v-480h80v480h-80Zm520 0L380-480l360-240v480Z"/>`),
  };
}

export function fastForward(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/fast_forward_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M100-240v-480l360 240-360 240Zm400 0v-480l360 240-360 240Z"/>`),
  };
}

export function playArrow(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/play_arrow_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M320-200v-560l440 280-440 280Z"/>`),
  };
}

export function playArrowNoFill(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/play_arrow_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M360-331.46v-297.08q0-14.69 9.69-23.5t22.62-8.81q4.23 0 8.57 1.12 4.35 1.11 8.58 3.34l233.69 149.31q7.47 5.23 11.2 11.93 3.73 6.69 3.73 15.15t-3.73 15.15q-3.73 6.7-11.2 11.93L409.46-303.61q-4.23 2.23-8.58 3.34-4.34 1.12-8.57 1.12-12.93 0-22.62-8.81-9.69-8.81-9.69-23.5ZM400-480Zm0 134 211.54-134L400-614v268Z"/>`,
    ),
  };
}

export function pause(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/pause_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z"/>`),
  };
}

export function pauseNoFill(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/pause_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M580-240q-16.08 0-28.04-11.96T540-280v-400q0-16.08 11.96-28.04T580-720h100q16.08 0 28.04 11.96T720-680v400q0 16.08-11.96 28.04T680-240H580Zm-300 0q-16.08 0-28.04-11.96T240-280v-400q0-16.08 11.96-28.04T280-720h100q16.08 0 28.04 11.96T420-680v400q0 16.08-11.96 28.04T380-240H280Zm300-40h100v-400H580v400Zm-300 0h100v-400H280v400Zm0-400v400-400Zm300 0v400-400Z"/>`,
    ),
  };
}

export function moreVert(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/more_vert_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/>`,
    ),
  };
}

export function allOut(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/all_out_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM282-282q-82-82-82-198t82-198q82-82 198-82t198 82q82 82 82 198t-82 198q-82 82-198 82t-198-82Zm198 2q83 0 141.5-58.5T680-480q0-83-58.5-141.5T480-680q-83 0-141.5 58.5T280-480q0 83 58.5 141.5T480-280ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80ZM480-480Z"/>`,
    ),
  };
}

export function earthquake(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/earthquake_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M361-80q-14 0-24.5-7.5T322-108L220-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h130q13 0 23.5 7.5T288-492l66 215 127-571q3-14 14-23t25-9q14 0 25 8.5t14 22.5l87 376 56-179q4-13 14.5-20.5T740-680q13 0 23 7t15 19l50 134h12q17 0 28.5 11.5T880-480q0 17-11.5 28.5T840-440h-40q-13 0-23-7t-15-19l-19-51-65 209q-4 13-15 21t-25 7q-14-1-24-9.5T601-311l-81-348-121 548q-3 14-13.5 22T361-80Z"/>`,
    ),
  };
}

export function lassoSelect(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/lasso_select_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m161-516-80-8q6-46 20.5-89.5T141-696l68 42q-20 31-31.5 66T161-516Zm36 316q-33-32-57-70.5T101-352l76-26q12 35 31 65.5t45 56.5l-56 56Zm110-552-42-68q39-25 82.5-39.5T437-880l8 80q-37 5-72 16.5T307-752ZM479-82q-35 0-69.5-5.5T343-106l26-76q27 9 54 14.5t56 5.5v80Zm226-626q-26-26-56.5-45T583-784l26-76q43 15 81.5 39t70.5 57l-56 56Zm86 594L679-226v104h-80v-240h240v80H735l112 112-56 56Zm8-368q0-29-5.5-56T779-592l76-26q13 32 18.5 66.5T879-482h-80Z"/>`,
    ),
  };
}

export function deployedCode(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/deployed_code_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-40-343 237-137-237-137-237 137 237 137ZM160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11L160-252Zm320-228Z"/>`,
    ),
  };
}

export function browse(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/browse_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M120-440v-320q0-33 23.5-56.5T200-840h240v400H120Zm400-400h240q33 0 56.5 23.5T840-760v160H520v-240Zm0 720v-400h320v320q0 33-23.5 56.5T760-120H520ZM120-360h320v240H200q-33 0-56.5-23.5T120-200v-160Z"/>`,
    ),
  };
}

export function menu(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/menu_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M140-254.62v-59.99h680v59.99H140ZM140-450v-60h680v60H140Zm0-195.39v-59.99h680v59.99H140Z"/>`,
    ),
  };
}

export function noSound(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/no_sound_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m616-320-56-56 104-104-104-104 56-56 104 104 104-104 56 56-104 104 104 104-56 56-104-104-104 104Zm-496-40v-240h160l200-200v640L280-360H120Z"/>`,
    ),
  };
}

export function volumeUp(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/volume_up_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320Z"/>`,
    ),
  };
}

export function firstPage(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/first_page_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M251.5-251.5Q240-263 240-280v-400q0-17 11.5-28.5T280-720q17 0 28.5 11.5T320-680v400q0 17-11.5 28.5T280-240q-17 0-28.5-11.5ZM552-480l156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L468-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L552-480Z"/>`,
    ),
  };
}

export function lastPage(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/last_page_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M408-480 252-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L308-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Zm300.5-228.5Q720-697 720-680v400q0 17-11.5 28.5T680-240q-17 0-28.5-11.5T640-280v-400q0-17 11.5-28.5T680-720q17 0 28.5 11.5Z"/>`,
    ),
  };
}

export function upload(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/upload_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M240-160q-33 0-56.5-23.5T160-240v-80q0-17 11.5-28.5T200-360q17 0 28.5 11.5T240-320v80h480v-80q0-17 11.5-28.5T760-360q17 0 28.5 11.5T800-320v80q0 33-23.5 56.5T720-160H240Zm200-486-75 75q-12 12-28.5 11.5T308-572q-11-12-11.5-28t11.5-28l144-144q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l144 144q12 12 11.5 28T652-572q-12 12-28.5 12.5T595-571l-75-75v286q0 17-11.5 28.5T480-320q-17 0-28.5-11.5T440-360v-286Z"/>`,
    ),
  };
}

export function bookmarkStacks(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/bookmark_stacks_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-256.16 83.39-467.38l62.84-34.47L480-324.46l334.15-177.39L877-467.38 480-256.16ZM480-100 83.39-311.23l62.84-34.46L480-168.31l334.15-177.38L877-311.23 480-100Zm0-312.31L60.39-636.15 480-860l30 16.23v177.62h334.69l55.31 30-420 223.84Zm0-68.3 239.62-125.54H450v-169.31L185.46-636.15 480-480.61Zm-30-125.54Z"/>`,
    ),
  };
}

export function timerArrowDown(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/timer_arrow_down_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M147.89-261.09q-80.96-81.08-80.96-196.92 0-115.84 80.99-196.99t196.7-81.15q49.69 0 93.96 16.31 44.27 16.3 79.96 45.3l19.38-19.38q8.31-8.31 20.58-8.42 12.27-.12 21.26 8.87 8.24 8.24 8.24 20.62 0 12.39-8.31 20.7l-19 19.38q29 35.69 45.5 80.27t16.5 94.42q0 115.87-81.08 196.97Q460.52-180 344.68-180q-115.83 0-196.79-81.09Zm138.26-523.52q-12.75 0-21.37-8.63-8.62-8.63-8.62-21.39 0-12.75 8.62-21.37 8.62-8.61 21.37-8.61h117.7q12.75 0 21.37 8.63 8.63 8.62 8.63 21.38t-8.63 21.37q-8.62 8.62-21.37 8.62h-117.7Zm213.09 481.16q63.45-63.45 63.45-154.65 0-91.21-63.45-154.63-63.44-63.42-154.65-63.42-91.2 0-154.44 63.44-63.23 63.45-63.23 154.66 0 91.2 63.23 154.63Q253.39-240 344.59-240q91.21 0 154.65-63.45ZM366-440.55q8.61-8.62 8.61-21.37v-116.16q0-12.75-8.62-21.37-8.63-8.63-21.39-8.63-12.75 0-21.37 8.63-8.61 8.62-8.61 21.37v116.16q0 12.75 8.63 21.37 8.62 8.63 21.38 8.63 12.75 0 21.37-8.63Zm-21.38-17.53Zm407.76 252.77-86.23-86.23q-8.69-9.31-8.69-21.38 0-12.08 9.31-20.77t21.38-9q12.08-.31 20.77 9l38.77 38.77V-750q0-12.75 8.63-21.37 8.63-8.63 21.39-8.63 12.75 0 21.37 8.63 8.61 8.62 8.61 21.37v455.69l39.39-39.38q8.69-8.69 21.07-8.69 12.39 0 21.08 8.69 8.69 8.69 8.69 21.07 0 12.39-8.69 21.08L803-205.31q-10.85 10.85-25.31 10.85-14.46 0-25.31-10.85Z"/>`,
    ),
  };
}

export function photo(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/photo_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M240-280h480L570-480 450-320l-90-120-120 160ZM120-120v-720h720v720H120Zm80-80h560v-560H200v560Zm0 0v-560 560Z"/>`,
    ),
  };
}

export function threeSixtyLeft(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/360_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M374-288q-128-17-211-70T80-480q0-83 115.5-141.5T480-680q169 0 284.5 58.5T880-480q0 56-54.5 101.5T681-307q-16 5-28.5-4.5T640-337q0-18 10.5-32t27.5-20q60-20 91-45.5t31-45.5q0-32-85.5-76T480-600q-149 0-234.5 44T160-480q0 24 51 57.5T356-372l-24-24q-11-11-11-28t11-28q11-11 28-11t28 11l104 104q12 12 12 28t-12 28L388-188q-11 11-27.5 11.5T332-188q-11-11-11.5-27.5T331-244l43-44Z"/>`,
    ),
  };
}

export function threeSixtyRight(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/360_right_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 586,-288 Q 714,-305 797,-358 880,-411 880,-480 880,-563 764.5,-621.5 649,-680 480,-680 311,-680 195.5,-621.5 80,-563 80,-480 80,-424 134.5,-378.5 189,-333 279,-307 295,-302 307.5,-311.5 320,-321 320,-337 320,-355 309.5,-369 299,-383 282,-389 222,-409 191,-434.5 160,-460 160,-480 160,-512 245.5,-556 331,-600 480,-600 629,-600 714.5,-556 800,-512 800,-480 800,-456 749,-422.5 698,-389 604,-372 L 628,-396 Q 639,-407 639,-424 639,-441 628,-452 617,-463 600,-463 583,-463 572,-452 L 468,-348 Q 456,-336 456,-320 456,-304 468,-292 L 572,-188 Q 583,-177 599.5,-176.5 616,-176 628,-188 639,-199 639.5,-215.5 640,-232 629,-244 Z"/>`,
    ),
  };
}

export function cropSquare(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_square_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M140-140v-680h680v680H140Zm60-60h560v-560H200v560Zm0 0v-560 560Z"/>`),
  };
}

export function crop16_9(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_16_9_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M140-300v-360h680v360H140Zm60-60h560v-240H200v240Zm0 0v-240 240Z"/>`),
  };
}

export function crop9_16(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_9_16_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M300-140v-680h360v680H300Zm60-620v560h240v-560H360Zm0 560v-560 560Z"/>`),
  };
}

export function crop7_5(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_7_5_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M140-220v-520h680v520H140Zm60-60h560v-400H200v400Zm0 0v-400 400Z"/>`),
  };
}

export function crop5_7(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_5_7_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 220,-820 H 740 V -140 H 220 Z M 280,-760 V -200 H 680 V -760 Z M 280,-760 H 680 Z"/>`,
    ),
  };
}

export function crop5_4(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_5_4_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M140-180v-600h680v600H140Zm60-60h560v-480H200v480Zm0 0v-480 480Z"/>`),
  };
}

export function crop4_5(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_4_5_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 180,-820 H 780 V -140 H 180 Z M 240,-760 V -200 H 720 V -760 Z M 240,-760 H 720 Z"/>`,
    ),
  };
}

export function crop3_2(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_3_2_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M140-260v-440h680v440H140Zm60-60h560v-320H200v320Zm0 0v-320 320Z"/>`),
  };
}

export function crop2_3(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_2_3_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 260,-820 H 700 V -140 H 260 Z M 320,-760 V -200 H 640 V -760 Z M 320,-760 H 640 Z"/>`,
    ),
  };
}

export function contentPaste(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/content_paste_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 166.29024,-120 V -840 H 381.52999 Q 391.11557,-875 419.00088,-897.5 446.88619,-920 480,-920 514.85664,-920 542.30624,-897.5 569.75585,-875 579.34142,-840 H 793.70976 V -120 Z M 236.00352,-200 H 723.99648 V -760 H 654.2832 V -640 H 305.7168 V -760 H 236.00352 Z M 504.83536,-771.5 Q 514.85664,-783 514.85664,-800 514.85664,-817 504.83536,-828.5 494.81407,-840 480,-840 465.18593,-840 455.16464,-828.5 445.14336,-817 445.14336,-800 445.14336,-783 455.16464,-771.5 465.18593,-760 480,-760 494.81407,-760 504.83536,-771.5 Z"/>`,
    ),
  };
}

export function fileCopy(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/file_copy_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M240-200v-720h360l240 240v480H240Zm320-440v-200H320v560h440v-360H560ZM80-40v-640h80v560h440v80H80Zm240-800v200-200 560-560Z"/>`,
    ),
  };
}

export function outbound(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/outbound_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m356-300 204-204v90h80v-226H414v80h89L300-357l56 57ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>`,
    ),
  };
}

export function outboundNoFill(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/outbound_24dp_E3E3E3_FILL0_wght400_GRAD0_OPSZ24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M560-504v50q0 17 11.5 28.5T600-414q17 0 28.5-11.5T640-454v-146q0-17-11.5-28.5T600-640H454q-17 0-28.5 11.5T414-600q0 17 11.5 28.5T454-560h49L328-385q-11 11-11 27.5t11 28.5q12 12 28.5 12t28.5-12l175-175ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function search(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/search_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>`,
    ),
  };
}

export function folder(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/folder_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/>`,
    ),
  };
}

export function arrowDownwardAlt(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/arrow_downward_alt_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M480-240 240-480l56-56 144 144v-368h80v368l144-144 56 56-240 240Z"/>`),
  };
}

export function arrowUpwardAlt(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/arrow_upward_alt_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z"/>`),
  };
}

export function visibility(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/visibility_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM235.5-272Q125-344 61-462q-5-9-7.5-18.5T51-500q0-10 2.5-19.5T61-538q64-118 174.5-190T480-800q134 0 244.5 72T899-538q5 9 7.5 18.5T909-500q0 10-2.5 19.5T899-462q-64 118-174.5 190T480-200q-134 0-244.5-72ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z"/>`,
    ),
  };
}

export function visibilityOff(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/visibility_off_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M607-627q29 29 42.5 66t9.5 76q0 15-11 25.5T622-449q-15 0-25.5-10.5T586-485q5-26-3-50t-25-41q-17-17-41-26t-51-4q-15 0-25.5-11T430-643q0-15 10.5-25.5T466-679q38-4 75 9.5t66 42.5Zm-127-93q-19 0-37 1.5t-36 5.5q-17 3-30.5-5T358-742q-5-16 3.5-31t24.5-18q23-5 46.5-7t47.5-2q137 0 250.5 72T904-534q4 8 6 16.5t2 17.5q0 9-1.5 17.5T905-466q-18 40-44.5 75T802-327q-12 11-28 9t-26-16q-10-14-8.5-30.5T753-392q24-23 44-50t35-58q-50-101-144.5-160.5T480-720Zm0 520q-134 0-245-72.5T60-463q-5-8-7.5-17.5T50-500q0-10 2-19t7-18q20-40 46.5-76.5T166-680l-83-84q-11-12-10.5-28.5T84-820q11-11 28-11t28 11l680 680q11 11 11.5 27.5T820-84q-11 11-28 11t-28-11L624-222q-35 11-71 16.5t-73 5.5ZM222-624q-29 26-53 57t-41 67q50 101 144.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z"/>`,
    ),
  };
}

export function lock(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/lock_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm296.5-223.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z"/>`,
    ),
  };
}

export function lockOpenRight(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/lock_open_right_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M536.5-303.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h280v-80q0-83 58.5-141.5T720-920q75 0 130.5 48.5T917-752q2 13-9 22.5t-28 9.5q-17 0-28-7t-16-23q-11-38-42.5-64T720-840q-50 0-85 35t-35 85v80h120q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Z"/>`,
    ),
  };
}

export function chevronLeft(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/chevron_left_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/>`),
  };
}

export function chevronRight(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/chevron_right_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/>`),
  };
}

export function keyboardCommandKey(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/keyboard_command_key_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M260-120q-58 0-99-41t-41-99q0-58 41-99t99-41h60v-160h-60q-58 0-99-41t-41-99q0-58 41-99t99-41q58 0 99 41t41 99v60h160v-60q0-58 41-99t99-41q58 0 99 41t41 99q0 58-41 99t-99 41h-60v160h60q58 0 99 41t41 99q0 58-41 99t-99 41q-58 0-99-41t-41-99v-60H400v60q0 58-41 99t-99 41Zm0-80q25 0 42.5-17.5T320-260v-60h-60q-25 0-42.5 17.5T200-260q0 25 17.5 42.5T260-200Zm440 0q25 0 42.5-17.5T760-260q0-25-17.5-42.5T700-320h-60v60q0 25 17.5 42.5T700-200ZM400-400h160v-160H400v160ZM260-640h60v-60q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm380 0h60q25 0 42.5-17.5T760-700q0-25-17.5-42.5T700-760q-25 0-42.5 17.5T640-700v60Z"/>`,
    ),
  };
}

export function link(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/link_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M280-280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h120q17 0 28.5 11.5T440-640q0 17-11.5 28.5T400-600H280q-50 0-85 35t-35 85q0 50 35 85t85 35h120q17 0 28.5 11.5T440-320q0 17-11.5 28.5T400-280H280Zm80-160q-17 0-28.5-11.5T320-480q0-17 11.5-28.5T360-520h240q17 0 28.5 11.5T640-480q0 17-11.5 28.5T600-440H360Zm200 160q-17 0-28.5-11.5T520-320q0-17 11.5-28.5T560-360h120q50 0 85-35t35-85q0-50-35-85t-85-35H560q-17 0-28.5-11.5T520-640q0-17 11.5-28.5T560-680h120q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H560Z"/>`,
    ),
  };
}

export function linkOff(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/link_off_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m625-449-71-71h46q17 0 28.5 11.5T640-480q0 10-4 18t-11 13ZM820-84q-11 11-28 11t-28-11L84-764q-11-11-11-28t11-28q11-11 28-11t28 11l680 680q11 11 11 28t-11 28ZM280-280q-83 0-141.5-58.5T80-480q0-69 42-123t108-71l74 74h-24q-50 0-85 35t-35 85q0 50 35 85t85 35h120q17 0 28.5 11.5T440-320q0 17-11.5 28.5T400-280H280Zm80-160q-17 0-28.5-11.5T320-480q0-17 11.5-28.5T360-520h25l79 80H360Zm380 112q-9-14-6.5-30t16.5-25q23-17 36.5-42t13.5-55q0-50-35-85t-85-35H560q-17 0-28.5-11.5T520-640q0-17 11.5-28.5T560-680h120q83 0 141.5 58.5T880-480q0 49-22.5 91.5T795-318q-14 9-30 6.5T740-328Z"/>`,
    ),
  };
}

export function rotateLeft(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/rotate_left_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M440-80q-50-5-96-24.5T256-156l56-58q29 21 61.5 34t66.5 18v82Zm80 0v-82q104-15 172-93.5T760-438q0-117-81.5-198.5T480-718h-8l64 64-56 56-160-160 160-160 56 58-62 62h6q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-438q0 137-91 238.5T520-80ZM198-214q-32-42-51.5-88T122-398h82q5 34 18 66.5t34 61.5l-58 56Zm-76-264q6-51 25-98t51-86l58 56q-21 29-34 61.5T204-478h-82Z"/>`,
    ),
  };
}

export function tune(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/tune_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M451.5-131.5Q440-143 440-160v-160q0-17 11.5-28.5T480-360q17 0 28.5 11.5T520-320v40h280q17 0 28.5 11.5T840-240q0 17-11.5 28.5T800-200H520v40q0 17-11.5 28.5T480-120q-17 0-28.5-11.5ZM160-200q-17 0-28.5-11.5T120-240q0-17 11.5-28.5T160-280h160q17 0 28.5 11.5T360-240q0 17-11.5 28.5T320-200H160Zm131.5-171.5Q280-383 280-400v-40H160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h120v-40q0-17 11.5-28.5T320-600q17 0 28.5 11.5T360-560v160q0 17-11.5 28.5T320-360q-17 0-28.5-11.5ZM480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520h320q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H480Zm131.5-171.5Q600-623 600-640v-160q0-17 11.5-28.5T640-840q17 0 28.5 11.5T680-800v40h120q17 0 28.5 11.5T840-720q0 17-11.5 28.5T800-680H680v40q0 17-11.5 28.5T640-600q-17 0-28.5-11.5ZM160-680q-17 0-28.5-11.5T120-720q0-17 11.5-28.5T160-760h320q17 0 28.5 11.5T520-720q0 17-11.5 28.5T480-680H160Z"/>`,
    ),
  };
}

export function publicIcon(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/public_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M324-111.5Q251-143 197-197t-85.5-127Q80-397 80-480t31.5-156Q143-709 197-763t127-85.5Q397-880 480-880t156 31.5Q709-817 763-763t85.5 127Q880-563 880-480t-31.5 156Q817-251 763-197t-127 85.5Q563-80 480-80t-156-31.5ZM440-162v-78q-33 0-56.5-23.5T360-320v-40L168-552q-3 18-5.5 36t-2.5 36q0 121 79.5 212T440-162Zm276-102q41-45 62.5-100.5T800-480q0-98-54.5-179T600-776v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h240q17 0 28.5 11.5T600-440v120h40q26 0 47 15.5t29 40.5Z"/>`,
    ),
  };
}

export function experiment(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/experiment_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M200-120q-51 0-72.5-45.5T138-250l222-270v-240h-40q-17 0-28.5-11.5T280-800q0-17 11.5-28.5T320-840h320q17 0 28.5 11.5T680-800q0 17-11.5 28.5T640-760h-40v240l222 270q32 39 10.5 84.5T760-120H200Zm80-120h400L544-400H416L280-240Zm-80 40h560L520-492v-268h-80v268L200-200Zm280-280Z"/>`,
    ),
  };
}

export function scienceOff(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/science_off_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m600-473-80-80v-207h-80v127l-80-80v-47h-40q-17 0-28.5-11.5T280-800q0-17 11.5-28.5T320-840h320q17 0 28.5 11.5T680-800q0 17-11.5 28.5T640-760h-40v287ZM200-200h448L402-446 200-200ZM764-84l-36-36H200q-51 0-72.5-45.5T138-250l208-252L84-764q-11-11-11-28t11-28q11-11 28-11t28 11l680 680q11 11 11 28t-11 28q-11 11-28 11t-28-11ZM402-446Zm78-147Z"/>`,
    ),
  };
}

export function send(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/send_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24_45deg.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M 575.77836,-148.75092 Q 567.29308,-128.95193 546.43343,-124.35573 525.57378,-119.75954 510.01743,-135.31589 L 382.73821,-262.5951 552.44384,-545.43782 269.60112,-375.73219 142.32191,-503.01141 Q 126.76556,-518.56776 131.36175,-539.42741 135.95795,-560.28706 155.75693,-568.77234 L 775.18247,-820.50235 Q 800.63832,-830.40185 819.02309,-812.01707 837.40787,-793.6323 827.50837,-768.17645 Z"/>`,
    ),
  };
}

export function adjust(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/adjust_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M565-395q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function stopCircle(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/stop_circle_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M320-320h320v-320H320v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function stopIcon(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/stop_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M240-240v-480h480v480H240Z"/>`),
  };
}

export function forward(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/forward_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m640-280-57-56 184-184-184-184 57-56 240 240-240 240ZM80-200v-160q0-83 58.5-141.5T280-560h247L383-704l57-56 240 240-240 240-57-56 144-144H280q-50 0-85 35t-35 85v160H80Z"/>`,
    ),
  };
}

export function download(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/download_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM160-160v-200h80v120h480v-120h80v200H160Z"/>`,
    ),
  };
}

export function openInNew(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/open_in_new_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M120-120v-720h360v80H200v560h560v-280h80v360H120Zm268-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/>`,
    ),
  };
}

export function folderOpenLite(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/folder_open_24dp_E3E3E3_FILL0_wght100_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M186-212q-23 0-38.5-15.5T132-266v-422q0-23 18.5-41.5T192-748h162q12 0 23.5 5t19.5 13l62 62h346q6 0 10 4t4 10q0 6-4 10t-10 4H448l-80-80H192q-14 0-23 9t-9 23v448q0-14 5.5-10.5T180-242l76-255q6-19 22-31t36-12h512q30 0 48.5 24t9.5 53l-64 213q-5 17-19.5 27.5T768-212H186Zm23-28h555q11 0 19.5-6t11.5-17l62-208q5-16-5-28.5T826-512H314q-11 0-19.5 6T283-489l-74 249Zm-49-257v-223 223Zm49 257 74-249q3-11 5-17l2-6-3.5 12.5Q283-487 278-471l-62 208q-3 11-5 17l-2 6Z"/>`,
    ),
  };
}

export function deployedCodeLite(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/deployed_code_24dp_E3E3E3_FILL0_wght100_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M466-168v-304L200-626v286q0 8 4 15t12 12l250 145Zm28 0 250-145q8-5 12-12t4-15v-286L494-472v304Zm-14-328 263-152-247-143q-8-5-16-5t-16 5L217-648l263 152ZM202-288q-14-8-22-22t-8-30v-280q0-16 8-30t22-22l248-143q14-8 30-8t30 8l248 143q14 8 22 22t8 30v280q0 16-8 30t-22 22L510-145q-14 8-30 8t-30-8L202-288Zm278-192Z"/>`,
    ),
  };
}

export function resizeLite(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/resize_24dp_E3E3E3_FILL0_wght100_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M178-754q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm144 0q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm144 0q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6ZM178-610q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0 144q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm576 0q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0 144q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6ZM466-178q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm144 0q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm144 0q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm6-440v-110q0-14-9-23t-23-9H618q-6 0-10-4t-4-10q0-6 4-10t10-4h110q25 0 42.5 17.5T788-728v110q0 6-4 10t-10 4q-6 0-10-4t-4-10ZM172-232v-110q0-6 4-10t10-4q6 0 10 4t4 10v110q0 14 9 23t23 9h110q6 0 10 4t4 10q0 6-4 10t-10 4H232q-25 0-42.5-17.5T172-232Z"/>`,
    ),
  };
}

export function animatedImagesLite(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/animated_images_24dp_E3E3E3_FILL0_wght100_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m506-459 177-121-177-121v242Zm218 231h10l3 27-543 69-64-495 98-9v28l-64 6 54 438 506-64Zm-416-80v-520h520v520H308Zm28-28h464v-464H336v464ZM218-164Zm350-404Z"/>`,
    ),
  };
}

export function image200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/image_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M300-300h366.15L553.08-450.77 448.46-318.46l-70-84.62L300-300ZM160-160v-640h640v640H160Zm40-40h560v-560H200v560Zm0 0v-560 560Z"/>`,
    ),
  };
}

export function polyline200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/polyline_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M620-100v-92.31L324.62-340H140v-200h161.23L420-676.31V-860h200v200H458.77L340-523.69v146l280 140V-300h200v200H620ZM460-700h120v-120H460v120ZM180-380h120v-120H180v120Zm480 240h120v-120H660v120ZM520-760ZM240-440Zm480 240Z"/>`,
    ),
  };
}

export function crop200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/crop_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M700-60v-160H220v-480H60v-40h160v-160h40v640h640v40H740v160h-40Zm0-240v-400H300v-40h440v440h-40Z"/><`,
    ),
  };
}

export function allOut200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/all_out_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M280-160h-55.38q-26.66 0-45.64-18.98T160-224.62V-280q0-8.5 5.76-14.25t14.27-5.75q8.51 0 14.24 5.75T200-280v55.38q0 10.77 6.92 17.7 6.93 6.92 17.7 6.92H280q8.5 0 14.25 5.76t5.75 14.27q0 8.51-5.75 14.24T280-160Zm455.38 0H680q-8.5 0-14.25-5.76T660-180.03q0-8.51 5.75-14.24T680-200h55.38q10.77 0 17.7-6.92 6.92-6.93 6.92-17.7V-280q0-8.5 5.76-14.25t14.27-5.75q8.51 0 14.24 5.75T800-280v55.38q0 26.66-18.98 45.64T735.38-160Zm-425.3-150.08Q240-380.15 240-480t70.08-169.92Q380.15-720 480-720t169.92 70.08Q720-579.85 720-480t-70.08 169.92Q579.85-240 480-240t-169.92-70.08ZM480-280q83 0 141.5-58.5T680-480q0-83-58.5-141.5T480-680q-83 0-141.5 58.5T280-480q0 83 58.5 141.5T480-280ZM160-735.38q0-26.66 18.98-45.64T224.62-800H280q8.5 0 14.25 5.76t5.75 14.27q0 8.51-5.75 14.24T280-760h-55.38q-10.77 0-17.7 6.92-6.92 6.93-6.92 17.7V-680q0 8.5-5.76 14.25T179.97-660q-8.51 0-14.24-5.75T160-680v-55.38Zm605.73 69.63Q760-671.5 760-680v-55.38q0-10.77-6.92-17.7-6.93-6.92-17.7-6.92H680q-8.5 0-14.25-5.76T660-780.03q0-8.51 5.75-14.24T680-800h55.38q26.66 0 45.64 18.98T800-735.38V-680q0 8.5-5.76 14.25T779.97-660q-8.51 0-14.24-5.75ZM480-480Z"/>`,
    ),
  };
}

export function browse200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/browse_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M160-440v-295.38q0-27.62 18.5-46.12Q197-800 224.62-800H440v360H160Zm240-40Zm120-320h215.38q27.62 0 46.12 18.5Q800-763 800-735.13V-600H520v-200Zm0 640v-360h280v295.38q0 27.62-18.5 46.12Q763-160 735.38-160H520ZM160-360h280v200H224.62q-27.62 0-46.12-18.5Q160-197 160-224.87V-360Zm240 40Zm160-320Zm0 160Zm-360 0h200v-280H224.62q-10.77 0-17.7 6.92-6.92 6.93-6.92 17.7V-480Zm360-160h200v-95.38q0-10.77-6.92-17.7-6.93-6.92-17.7-6.92H560v120Zm0 160v280h175.38q10.77 0 17.7-6.92 6.92-6.93 6.92-17.7V-480H560ZM200-320v95.38q0 10.77 6.92 17.7 6.93 6.92 17.7 6.92H400v-120H200Z"/>`,
    ),
  };
}

export function earthquake200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/earthquake_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M366.38-120q-7.07 0-12.19-4.04-5.11-4.04-7.57-10.88L247.69-460H140q-8.54 0-14.27-5.73T120-480q0-8.54 5.73-14.27T140-500h122.31q6.84 0 11.96 3.65 5.11 3.66 7.58 10.5L364-219.31l134.69-604.07q1.46-7.08 6.69-11.85 5.24-4.77 12.31-4.77 7.08 0 12.31 4.65 5.23 4.66 6.69 11.73l97.77 418.31 72.16-231.31q2.46-6.84 7.57-10.88 5.12-4.04 11.96-4.04 6.85 0 11.47 3.54 4.61 3.54 7.3 10.15L797.23-500h22q8.54 0 14.27 5.73t5.73 14.27q0 8.54-5.73 14.27T819.23-460h-36.92q-6.85 0-11.46-3.54-4.62-3.54-7.31-9.38l-35.92-97.16-77.31 246.7q-2.46 6.84-7.31 11-4.85 4.15-11.92 3.92-7.08-.23-12.46-4.89-5.39-4.65-6.85-11.5l-94.08-404.92-131.77 593.39q-2.23 7.07-7.34 11.61-5.12 4.54-12.2 4.77Z"/>`,
    ),
  };
}

export function experiment200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/experiment_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M200-160q-25.54 0-36.31-22.81-10.77-22.81 5.08-42.57L400-506.15V-760h-55.38q-8.5 0-14.25-5.76t-5.75-14.27q0-8.51 5.75-14.24t14.25-5.73h270.76q8.5 0 14.25 5.76t5.75 14.27q0 8.51-5.75 14.24T615.38-760H560v253.85l231.23 280.77q15.85 19.76 5.08 42.57T760-160H200Zm80-80h400L544-400H416L280-240Zm-80 40h560L520-492v-268h-80v268L200-200Zm280-280Z"/>`,
    ),
  };
}

export function keyboardCommandKey200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/keyboard_command_key_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M260-140q-50.31 0-85.15-34.85Q140-209.69 140-260t34.85-85.15Q209.69-380 260-380h80v-200h-80q-50.31 0-85.15-34.85Q140-649.69 140-700t34.85-85.15Q209.69-820 260-820t85.15 34.85Q380-750.31 380-700v80h200v-80q0-50.31 34.85-85.15Q649.69-820 700-820t85.15 34.85Q820-750.31 820-700t-34.85 85.15Q750.31-580 700-580h-80v200h80q50.31 0 85.15 34.85Q820-310.31 820-260t-34.85 85.15Q750.31-140 700-140t-85.15-34.85Q580-209.69 580-260v-80H380v80q0 50.31-34.85 85.15Q310.31-140 260-140Zm0-40q32.69 0 56.35-23.65Q340-227.31 340-260v-80h-80q-32.69 0-56.35 23.65Q180-292.69 180-260t23.65 56.35Q227.31-180 260-180Zm440 0q32.69 0 56.35-23.65Q780-227.31 780-260t-23.65-56.35Q732.69-340 700-340h-80v80q0 32.69 23.65 56.35Q667.31-180 700-180ZM380-380h200v-200H380v200ZM260-620h80v-80q0-32.69-23.65-56.35Q292.69-780 260-780t-56.35 23.65Q180-732.69 180-700t23.65 56.35Q227.31-620 260-620Zm360 0h80q32.69 0 56.35-23.65Q780-667.31 780-700t-23.65-56.35Q732.69-780 700-780t-56.35 23.65Q620-732.69 620-700v80Z"/>`,
    ),
  };
}

export function keyboardCommandKey300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/keyboard_command_key_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M260-130q-54.15 0-92.08-37.92Q130-205.85 130-260t37.92-92.08Q205.85-390 260-390h70v-180h-70q-54.15 0-92.08-37.92Q130-645.85 130-700t37.92-92.08Q205.85-830 260-830t92.08 37.92Q390-754.15 390-700v70h180v-70q0-54.15 37.92-92.08Q645.85-830 700-830t92.08 37.92Q830-754.15 830-700t-37.92 92.08Q754.15-570 700-570h-70v180h70q54.15 0 92.08 37.92Q830-314.15 830-260t-37.92 92.08Q754.15-130 700-130t-92.08-37.92Q570-205.85 570-260v-70H390v70q0 54.15-37.92 92.08Q314.15-130 260-130Zm0-60q28.85 0 49.42-20.58Q330-231.15 330-260v-70h-70q-28.85 0-49.42 20.58Q190-288.85 190-260t20.58 49.42Q231.15-190 260-190Zm440 0q28.85 0 49.42-20.58Q770-231.15 770-260t-20.58-49.42Q728.85-330 700-330h-70v70q0 28.85 20.58 49.42Q671.15-190 700-190ZM390-390h180v-180H390v180ZM260-630h70v-70q0-28.85-20.58-49.42Q288.85-770 260-770t-49.42 20.58Q190-728.85 190-700t20.58 49.42Q231.15-630 260-630Zm370 0h70q28.85 0 49.42-20.58Q770-671.15 770-700t-20.58-49.42Q728.85-770 700-770t-49.42 20.58Q630-728.85 630-700v70Z"/>`,
    ),
  };
}

export function lassoSelect200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/lasso_select_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M479-120.46q-31.12 0-61.79-5.5-30.67-5.5-60.36-16.96-6.62-2.46-10.27-7.26-3.66-4.8-3.66-11.51 0-8.5 5.75-14.25t14.25-5.75l7.08 1.23q27 9 53.5 14.5t55.5 5.5q8.5 0 14.25 5.76 5.75 5.75 5.75 14.27 0 8.51-5.75 14.24T479-120.46Zm131.88-39.6q-5.73-5.75-5.73-14.25V-322q0-13.73 9.29-23.02t23.02-9.29h147.69q8.5 0 14.25 5.76t5.75 14.27q0 8.51-5.75 14.24t-14.25 5.73H673.46l117.85 117.85q5.61 5.61 6.11 13.65t-6.28 14.82q-6.22 6.22-13.99 6.22-7.77 0-14.15-6.38L645.15-286v111.69q0 8.5-5.75 14.25-5.76 5.75-14.27 5.75t-14.25-5.75Zm-372.16-60.25q-4.03 0-7.78-1.7-3.75-1.71-6.25-4.14-28.92-29.04-49.96-63.52-21.04-34.48-35.27-73.64-1.23-2.46-1.23-7.38 0-8.37 5.77-14.03 5.76-5.66 14.29-5.66 7.02 0 11.63 3.76 4.62 3.77 7.08 10.39 12 35.22 31 65.41 19 30.19 45 56.36 2.44 2.52 4.14 6.3 1.71 3.78 1.71 7.82 0 8.57-5.79 14.3t-14.34 5.73Zm566.01-245.9q-5.73-5.75-5.73-14.25 0-28.23-4.73-55.12-4.73-26.88-14.5-53.11-.46-.93-2-7.85 0-8.5 5.77-14.25 5.76-5.75 14.29-5.75 7.02 0 11.63 3.66 4.62 3.65 7.08 10.26 11.46 28.93 16.96 59.86 5.5 30.92 5.5 62.3 0 8.5-5.76 14.25t-14.27 5.75q-8.51 0-14.24-5.75Zm-664.06-29.94q-8.36 0-14.01-5.86-5.66-5.85-5.66-14.5V-520.08q5.38-40.7 18.85-79.59 13.46-38.89 35-73.25 2.51-4.12 7.03-6.94 4.52-2.83 10.04-2.83 8.54 0 14.27 5.75t5.73 14.25q0 2.79-.9 5.58t-2.25 5.11q-20 31.77-31.39 66.27Q166-551.23 161-514.46q-.46 7.31-6.46 12.81-6 5.5-13.87 5.5Zm578.36-204.47q-4.03 0-7.78-1.7-3.75-1.71-6.25-4.14-26-26-56-45t-65-31q-6.62-2.46-10.38-7.26-3.77-4.8-3.77-11.51 0-8.5 5.75-14.25t14.25-5.75q.77 0 7.07 1.23 38.39 14.23 72.87 35.27 34.48 21.03 63.52 49.96 2.43 2.52 4.14 6.3 1.7 3.79 1.7 7.82 0 8.57-5.78 14.3-5.79 5.73-14.34 5.73Zm-422.39-46.92q-8.41 0-14.14-5.77-5.73-5.78-5.73-14.32 0-5.52 2.83-10.01 2.82-4.48 6.94-6.98 34.92-21.69 73.63-35.09 38.71-13.39 79.21-18.75h3.57q8.65 0 14.5 5.65 5.86 5.66 5.86 14.02 0 7.87-5.5 13.87-5.5 6-12.81 6.46-36.77 5-71.27 16-34.5 11-65.5 31-2.69 2.23-5.66 3.08-2.97.84-5.93.84Z"/>`,
    ),
  };
}

export function lassoSelect300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/lasso_select_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M479-101.23q-33.06 0-65.64-5.5-32.59-5.5-63.44-17.73-9.3-3.23-14.88-10.63t-5.58-17.76q0-12.75 8.63-21.37 8.62-8.63 21.37-8.63l10.54 1.62q27 9 53.5 14.5t55.5 5.5q12.75 0 21.37 8.63 8.63 8.63 8.63 21.38 0 12.76-8.63 21.37-8.62 8.62-21.37 8.62Zm131.69-45.55q-8.61-8.62-8.61-21.37V-322q0-15.37 10.39-25.76 10.4-10.39 25.76-10.39h153.85q12.75 0 21.37 8.63 8.63 8.62 8.63 21.38 0 12.75-8.63 21.37-8.62 8.61-21.37 8.61h-87.85l100.92 100.93q8.31 8.31 8.81 20.58.5 12.26-8.89 21.66-8.61 8.6-20.99 8.6-12.39 0-21.08-8.69L662.08-256v87.85q0 12.75-8.63 21.37-8.63 8.62-21.39 8.62-12.75 0-21.37-8.62Zm-378.83-57.38q-6.01 0-11.64-2.6-5.62-2.6-9.37-6.32-30.97-30.52-53.48-66.76-22.52-36.24-37.14-77.31-1.61-3.24-1.61-10.7 0-12.68 8.63-21.26 8.63-8.58 21.39-8.58 10.51 0 17.82 5.88 7.31 5.89 10.54 15.19 12 35.12 31 65.21 19 30.1 45 56.18 3.72 3.76 6.32 9.4 2.6 5.64 2.6 11.66 0 12.78-8.64 21.4-8.64 8.61-21.42 8.61Zm575.76-255.7q-8.62-8.62-8.62-21.37 0-28.62-5.12-55.31-5.11-26.69-14.5-53.31-1.23-2.46-2-10.92 0-12.75 8.64-21.37 8.63-8.63 21.39-8.63 10.51 0 17.82 5.58 7.31 5.58 10.54 14.88 12.23 30.46 17.73 63.18 5.5 32.71 5.5 65.9 0 12.75-8.63 21.37-8.63 8.63-21.38 8.63-12.76 0-21.37-8.63Zm-676.78-28.22q-12.68 0-21.26-8.67-8.58-8.68-8.58-21.51v-5.28q5.69-42.85 19.92-83.79 14.24-40.95 37-77.13 3.76-6.06 10.52-10.22 6.76-4.16 15.02-4.16 12.77 0 21.39 8.62 8.61 8.62 8.61 21.37 0 4.4-1.45 8.79-1.45 4.4-3.63 8.06-20 31.38-31.19 65.88Q166-551.62 161-515.23q-1.23 11.15-9.73 19.15-8.5 8-20.43 8Zm595.17-210.23q-6.01 0-11.64-2.6-5.62-2.6-9.37-6.32-26-26-56-45t-65-31q-9.31-3.23-15.19-10.63-5.89-7.4-5.89-17.75 0-12.75 8.63-21.38 8.62-8.62 21.37-8.62.39 0 10.54 1.61 40.69 14.62 76.93 37.14 36.24 22.51 66.76 53.48 3.72 3.76 6.32 9.4 2.61 5.64 2.61 11.66 0 12.78-8.65 21.4-8.64 8.61-21.42 8.61Zm-434.69-48.46q-12.7 0-21.32-8.64-8.61-8.63-8.61-21.4 0-8.27 4.16-15.01t10.22-10.49q36.46-22.84 77.32-37.04 40.85-14.2 83.6-19.88h5.28q12.83 0 21.51 8.58 8.67 8.58 8.67 21.26 0 11.93-8 20.43T445-799.23q-36.38 5-70.88 16-34.5 11-65.5 31-3.85 2.61-8.33 4.04-4.49 1.42-8.97 1.42Z"/>`,
    ),
  };
}

export function cycle200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/cycle_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M161.54-479.77q0 98.85 55.96 179.54T365.69-184q9.39 3.62 13.73 11.42 4.35 7.81.2 14.89-4.93 8.07-14.12 10.65t-18.04-.81q-103-40.15-164.84-131-61.85-90.84-61.85-201.69 0-31.38 5.42-62.15 5.43-30.77 16.81-60.39l-69.92 40.31q-7.08 4.39-15 2.19-7.93-2.19-12.08-9.27-4.15-7.07-1.96-15.11 2.19-8.04 9.27-12.19l111-63.85q11.69-6.46 24.73-3.12 13.04 3.35 19.5 15.04l63.84 110q4.16 7.08 1.97 15.12-2.2 8.04-9.27 12.19-7.08 4.15-15.12 1.96-8.04-2.19-12.19-9.27L187.62-605q-13.31 29.54-19.7 61.23-6.38 31.69-6.38 64ZM480-799.23q-54.08 0-104.46 18.19Q325.15-762.85 283-729q-7.31 5.69-16.12 5.12-8.8-.58-12.96-7.66-5.15-8.31-2.46-17.5 2.69-9.19 10.23-15.11 47.31-36.77 102.58-55.93 55.27-19.15 114.96-19.15 78.23 0 148.04 31.42 69.81 31.43 121.42 90.5v-83.46q0-8.54 5.73-14.27t14.27-5.73q8.54 0 14.27 5.73t5.73 14.27v127.69q0 13.93-9.19 23.12-9.19 9.19-23.12 9.19H628.69q-8.54 0-14.27-5.73t-5.73-14.27q0-8.54 5.73-14.27t14.27-5.73h99q-45.23-57-110.23-87.73-65-30.73-137.46-30.73ZM718.92-269q48.77-55.54 67.62-125.46 18.84-69.92 5-141.77-1.54-9.31 3.42-16.92 4.96-7.62 13.5-7.62 10.08 0 16.58 7.62 6.5 7.61 8.04 17.69 13.07 75.77-7.04 149.73-20.12 73.96-69.89 133.65-39.77 48.16-93.27 79.77-53.5 31.62-114.96 43.46L617.15-89q7.08 4.15 9.16 12.19 2.07 8.04-2.08 15.12-4.15 7.07-12.08 9.15-7.92 2.08-15-2.08l-110.46-64.61q-11.69-6.46-15.04-19.5-3.34-13.04 3.12-24.73l63.85-109.46q4.15-7.08 12.07-9.16 7.93-2.07 15 2.08 7.08 4.15 9.27 12.19 2.19 8.04-1.96 15.12l-52.38 89.15q57.76-8 109.03-34.73Q680.92-225 718.92-269Z"/>`,
    ),
  };
}

export function cycle400(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/cycle_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M160-479q0 85 42.5 158T318-204q14 9 19.5 24.5T335-150q-8 15-24.5 19.5T279-134q-93-54-146-146T80-479q0-26 3.5-51t9.5-50l-13 8q-14 9-30 4.5T26-586q-8-14-3.5-30.5T41-641l121-70q14-8 30.5-3.5T217-696l70 120q8 14 3.5 30.5T272-521q-14 8-30.5 3.5T217-536l-34-59q-11 28-17 57t-6 59Zm320-321q-41 0-81 10.5T323-759q-15 8-31.5 5.5T267-770q-9-16-4-32.5t21-25.5q45-26 94.5-39T480-880q79 0 151.5 29.5T761-765v-15q0-17 11.5-28.5T801-820q17 0 28.5 11.5T841-780v140q0 17-11.5 28.5T801-600H661q-17 0-28.5-11.5T621-640q0-17 11.5-28.5T661-680h69q-46-57-111-88.5T480-800Zm242 531q38-44 58-97t20-111q0-17 11.5-30t28.5-13q17 0 28.5 13t11.5 30q0 65-20.5 125.5T800-239q-39 52-92.5 89T591-95l10 6q14 8 18 24.5T615-34q-8 14-24 18t-30-4L439-90q-14-8-18.5-24.5T424-145l70-121q8-14 24-18t30 4q14 8 18.5 24.5T563-225l-37 63q57-8 107.5-35.5T722-269Z"/>`,
    ),
  };
}

export function dockToRight200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/dock_to_right_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M200-200h120v-560H200v560Zm160 0h400v-560H360v560Zm-40 0H200h120Zm-160 40v-640h640v640H160Z"/>`,
    ),
  };
}

export function dockToLeft200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/dock_to_left_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M640-200h120v-560H640v560Zm-440 0h400v-560H200v560Zm440 0h120-120Zm-480 40v-640h640v640H160Z"/>`,
    ),
  };
}

export function dockToRightFilled200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/dock_to_right_24dp_E3E3E3_FILL1_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M360-200h400v-560H360v560Zm-200 40v-640h640v640H160Z"/>`),
  };
}

export function dockToLeftFilled200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/dock_to_left_24dp_E3E3E3_FILL1_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M200-200h400v-560H200v560Zm-40 40v-640h640v640H160Z"/>`),
  };
}

export function addCircle200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/add_circle_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M460-300h40v-160h160v-40H500v-160h-40v160H300v40h160v160Zm20.13 180q-74.67 0-140.41-28.34-65.73-28.34-114.36-76.92-48.63-48.58-76.99-114.26Q120-405.19 120-479.87q0-74.67 28.34-140.41 28.34-65.73 76.92-114.36 48.58-48.63 114.26-76.99Q405.19-840 479.87-840q74.67 0 140.41 28.34 65.73 28.34 114.36 76.92 48.63 48.58 76.99 114.26Q840-554.81 840-480.13q0 74.67-28.34 140.41-28.34 65.73-76.92 114.36-48.58 48.63-114.26 76.99Q554.81-120 480.13-120Zm-.13-40q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function pinboard200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/pinboard_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="m272.31-120-20-20v-170.77H120v-40l56.92-114.46v-119.39H120v-40h304.62v40h-56.93v119.39l56.93 114.46v40H292.31V-140l-20 20Zm225.38-80v-40H800v-480H120v-40h720v560H497.69ZM165.85-350.77h212.92l-51.08-101.69v-132.16H216.92v132.16l-51.07 101.69Zm106.46 0Z"/>`,
    ),
  };
}

export function sort200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/sort_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M160-280v-40h190v40H160Zm0-180v-40h414.62v40H160Zm0-180v-40h640v40H160Z"/>`),
  };
}

export function keep200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/keep_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M600-463.08 663.08-400v40H500v200l-20 20-20-20v-200H296.92v-40L360-463.08V-760h-40v-40h320v40h-40v296.92ZM354-400h252l-46-46v-314H400v314l-46 46Zm126 0Z"/>`,
    ),
  };
}

export function keep300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/keep_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M620-471.54 691.54-400v60H510v220l-30 30-30-30v-220H268.46v-60L340-471.54V-760h-40v-60h360v60h-40v288.46ZM354-400h252l-46-46v-314H400v314l-46 46Zm126 0Z"/>`,
    ),
  };
}

export function add2200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/add_2_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M460-160v-300H160v-40h300v-300h40v300h300v40H500v300h-40Z"/>`),
  };
}

export function add2300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/add_2_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M450-140v-310H140v-60h310v-310h60v310h310v60H510v310h-60Z"/>`),
  };
}

export function addCircleFill0(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/add_circle_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>`,
    ),
  };
}

export function addBox300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/add_box_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M450-290h60v-160h160v-60H510v-160h-60v160H290v60h160v160ZM140-140v-680h680v680H140Zm60-60h560v-560H200v560Zm0 0v-560 560Z"/>`,
    ),
  };
}

export function sort300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/sort_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M140-260v-60h215v60H140Zm0-190v-60h447.31v60H140Zm0-190v-60h680v60H140Z"/>`),
  };
}

export function undo300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/undo_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M288.08-220v-60h287.07q62.62 0 107.77-41.35 45.16-41.34 45.16-102.11 0-60.77-45.16-101.93-45.15-41.15-107.77-41.15H294.31l111.3 111.31-42.15 42.15L180-596.54 363.46-780l42.15 42.15-111.3 111.31h280.84q87.77 0 150.35 58.58t62.58 144.5q0 85.92-62.58 144.69Q662.92-220 575.15-220H288.08Z"/>`,
    ),
  };
}

export function refresh200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/refresh_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M483.08-200q-117.25 0-198.63-81.34-81.37-81.34-81.37-198.54 0-117.2 81.37-198.66Q365.83-760 483.08-760q71.3 0 133.54 33.88 62.23 33.89 100.3 94.58V-760h40v209.23H547.69v-40h148q-31.23-59.85-87.88-94.54Q551.15-720 483.08-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h42.46Q725.08-310.15 651-255.08 576.92-200 483.08-200Z"/>`,
    ),
  };
}

export function stat0200Fill0(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/stat_0_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M480-256.92 256.92-480 480-703.08 703.08-480 480-256.92Zm0-57.08 166-166-166-166-166 166 166 166Zm0-166Z"/>`,
    ),
  };
}

export function stat0200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/stat_0_24dp_E3E3E3_FILL1_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(`<path d="M480-256.92 256.92-480 480-703.08 703.08-480 480-256.92Z"/>`),
  };
}

export function accountBox200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/account_box_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `><path d="M200-230.62q54-53 125.5-83.5t154.5-30.5q83 0 154.5 30.5t125.5 83.5V-760H200v529.38Zm365.15-241.15Q600-506.62 600-556.92q0-50.31-34.85-85.16-34.84-34.84-85.15-34.84t-85.15 34.84Q360-607.23 360-556.92q0 50.3 34.85 85.15 34.84 34.85 85.15 34.85t85.15-34.85ZM160-160v-640h640v640H160Zm263.65-340.58Q400-524.23 400-556.92q0-32.7 23.65-56.35 23.66-23.65 56.35-23.65t56.35 23.65Q560-589.62 560-556.92q0 32.69-23.65 56.34-23.66 23.66-56.35 23.66t-56.35-23.66Zm56.35 5.27ZM225.15-200h509.7Q677-254.38 612.27-279.5 547.54-304.62 480-304.62q-66 0-131.73 25.12-65.73 25.12-123.12 79.5Z"/>`,
    ),
  };
}

export function accountBox300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/account_box_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M200-238.31q54-53 125.5-83.5t154.5-30.5q83 0 154.5 30.5t125.5 83.5V-760H200v521.69Zm372.08-238.07Q610-514.31 610-568.46t-37.92-92.08q-37.93-37.92-92.08-37.92t-92.08 37.92Q350-622.61 350-568.46t37.92 92.08q37.93 37.92 92.08 37.92t92.08-37.92ZM140-140v-680h680v680H140Zm290.58-379.04Q410-539.61 410-568.46t20.58-49.42q20.57-20.58 49.42-20.58t49.42 20.58Q550-597.31 550-568.46t-20.58 49.42q-20.57 20.58-49.42 20.58t-49.42-20.58ZM480-499.15ZM247.08-200h465.84Q662-246.69 601.89-269.5 541.77-292.31 480-292.31q-61 0-122.12 22.81-61.11 22.81-110.8 69.5Z"/>`,
    ),
  };
}

export function cardsStack200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/cards_stack_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M329.23-352.15q-27.61 0-46.11-18.5t-18.5-46.12v-318.61q0-27.62 18.5-46.12 18.5-18.5 46.11-18.5h446.15q27.62 0 46.12 18.5Q840-763 840-735.38v318.61q0 27.62-18.5 46.12-18.5 18.5-46.12 18.5H329.23Zm0-40h446.15q10.77 0 17.7-6.93Q800-406 800-416.77v-318.61q0-10.77-6.92-17.7-6.93-6.92-17.7-6.92H329.23q-10.77 0-17.69 6.92-6.92 6.93-6.92 17.7v318.61q0 10.77 6.92 17.69 6.92 6.93 17.69 6.93Zm-24.61 0V-760v367.85Zm-100 194.46Zm467.69-421.54q7.77 0 13.88-5.73 6.12-5.73 6.12-14.27t-6.12-14.27q-6.11-5.73-13.88-5.73h-241q-7.77 0-13.39 5.73-5.61 5.73-5.61 14.27t5.73 14.27q5.73 5.73 14.27 5.73h240Zm-120 126.15q7.77 0 13.88-5.73 6.12-5.73 6.12-14.27t-6.12-14.27q-6.11-5.73-13.88-5.73h-121q-7.77 0-13.39 5.73-5.61 5.73-5.61 14.27t5.73 14.27q5.73 5.73 14.27 5.73h120ZM233.38-161.77q-26.07 3.46-46.69-12.69-20.61-16.16-24.84-42.23l-49.93-356.77q-1.23-8.54 3.77-15.39 5-6.84 14.31-8.07 8.31-1.23 15.15 4.04 6.85 5.26 8.08 13.8l49.08 357.54q1.54 10 9.23 16.16 7.69 6.15 17.69 4.61l300.15-38.77 193.23-24.54q8.77-1.46 15.47 4 6.69 5.46 7.46 14.46.77 8.08-4.62 14.2-5.38 6.11-13.46 7.34l-494.08 62.31Z"/>`,
    ),
  };
}

export function cardsStack300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/cards_stack_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M324.62-334.08q-30.31 0-51.31-21-21-21-21-51.31v-341.3q0-30.31 21-51.31 21-21 51.31-21h463.07Q818-820 839-799q21 21 21 51.31v341.3q0 30.31-21 51.31-21 21-51.31 21H324.62Zm0-60h463.07q5.39 0 8.85-3.46t3.46-8.85v-341.3q0-5.39-3.46-8.85t-8.85-3.46H324.62q-5.39 0-8.85 3.46t-3.46 8.85v341.3q0 5.39 3.46 8.85t8.85 3.46Zm-12.31 0V-760v365.92Zm-105 195.23Zm468.84-410.77q12.39 0 21.2-8.61 8.8-8.62 8.8-21.39 0-12.76-8.8-21.38-8.81-8.61-21.2-8.61h-241q-12.38 0-20.69 8.61-8.31 8.62-8.31 21.38 0 12.77 8.62 21.39 8.61 8.61 21.38 8.61h240Zm-120 123.08q12.39 0 21.2-8.61 8.8-8.62 8.8-21.39 0-12.77-8.8-21.38-8.81-8.62-21.2-8.62h-121q-12.38 0-20.69 8.62-8.31 8.61-8.31 21.38t8.62 21.39q8.61 8.61 21.38 8.61h120ZM225.69-141.39q-29.54 4.23-52.84-13.84-23.31-18.08-27.93-47.62L93.46-579.23q-1.61-12.77 5.89-22.69 7.5-9.92 20.65-11.54 12.15-1.62 22.08 5.77 9.92 7.38 11.54 20.15l52.53 376.77q.77 5 4.62 8.08 3.85 3.07 8.85 2.31l287.07-38.39 178.62-23.77q13.38-2.23 23.73 6.5t10.73 22.73q.39 11.54-7.31 20.35-7.69 8.8-19.23 10.42l-467.54 61.15Z"/>`,
    ),
  };
}

export function desktopMac200(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/desktop_mac_24dp_E3E3E3_FILL0_wght200_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M446.15-266.15H184.62q-27.62 0-46.12-18.5-18.5-18.5-18.5-46.12v-404.61q0-27.62 18.5-46.12Q157-800 184.62-800h590.76q27.62 0 46.12 18.5Q840-763 840-735.38v404.61q0 27.62-18.5 46.12-18.5 18.5-46.12 18.5H513.85l70.92 70.92q2 2 4.46 10.92v8.93q0 6.46-4.46 10.92T573.85-160H381.69q-4.46 0-7.69-3.23-3.23-3.23-3.23-7.69v-15.39q0-2 3.23-7.69l72.15-72.15ZM160-366.15h640v-369.23q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H184.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93v369.23Zm0 0V-760v393.85Z"/>`,
    ),
  };
}

export function desktopMac300(
  fill: string = "rgba(227, 227, 227, 1)",
  width: number = 24,
  height: number = 24,
): LaurusClientSvg {
  return {
    media_key: "/material-ui/thin/desktop_mac_24dp_E3E3E3_FILL0_wght300_GRAD0_opsz24.svg",
    width,
    height,
    viewbox: "0 -960 960 960",
    fill,
    stroke: "none",
    stroke_width: 0,
    markup: base64Encode(
      `<path d="M423.08-253.08H172.31q-30.31 0-51.31-21-21-21-21-51.31v-422.3Q100-778 121-799q21-21 51.31-21h615.38Q818-820 839-799q21 21 21 51.31v422.3q0 30.31-21 51.31-21 21-51.31 21H536.92l72.46 72.46q2 2 5.23 12.46v10.47q0 7.23-5.23 12.46T596.92-140H357.85q-5.23 0-8.85-3.62-3.61-3.61-3.61-8.84v-17.7q0-2 3.61-8.84l74.08-74.08ZM160-403.07h640v-344.62q0-4.62-3.85-8.46-3.84-3.85-8.46-3.85H172.31q-4.62 0-8.46 3.85-3.85 3.84-3.85 8.46v344.62Zm0 0V-760v356.93Z"/>`,
    ),
  };
}
