"use client";

import { useContext } from "react";
import LaurusImage, { pxSizes } from "../../components/laurus-image";
import { CoreContext, HoverContext } from "../workspace.client";
import { CoreState } from "../states/core-state";
import { UIState } from "../states/ui-state";
import { useUIBrowserImgs } from "../states/ui-store";
import { ShapePreview, type ShapePreviewSizes } from "./object-shape-editor";
import { unitCirclePath } from "./object-path";

export const CIRCLE_SHAPE = unitCirclePath();

export function resolveSourceImgSrc(
  coreState: CoreState,
  browserImgs: UIState["browserImgs"],
  sourceImgMediaId: string,
) {
  for (const [key, img] of coreState.project.imgs) {
    if (img.img_media_id === sourceImgMediaId) {
      return coreState.canvasImgs.get(key)?.src;
    }
  }
  return browserImgs.find((img) => img.img_media_id === sourceImgMediaId)?.src;
}

export interface ObjectOrLightThumbnailSizes {
  display: {
    width: number;
    height: number;
    borderRadius: number;
  };
  scrim: {
    blur: number;
  };
  shape: ShapePreviewSizes & {
    size: number;
    glow: number;
  };
}

export function ObjectOrLightThumbnail({
  title,
  shape,
  sourceImgMediaId,
  sizes,
  dimmed,
  onClick,
}: {
  title: string;
  shape: string;
  sourceImgMediaId: string;
  sizes: ObjectOrLightThumbnailSizes;
  dimmed?: boolean;
  onClick: () => void;
}) {
  const { isAltKeyPressed } = useContext(HoverContext);
  const { coreState } = useContext(CoreContext);
  const browserImgs = useUIBrowserImgs();
  const sourceImgSrc = resolveSourceImgSrc(coreState, browserImgs, sourceImgMediaId);
  return (
    <div
      title={title}
      onClick={onClick}
      style={{
        ...sizes.display,
        position: "relative",
        display: "grid",
        placeContent: "center",
        cursor: isAltKeyPressed ? "crosshair" : "pointer",
        backgroundColor: "rgb(50, 50, 50)",
        filter: `drop-shadow(0px 0px ${sizes.shape.glow}px rgba(0, 0, 0, 0.75))`,
      }}
    >
      <LaurusImage
        draggable={false}
        alt={sourceImgSrc ?? ""}
        src={sourceImgSrc ?? ""}
        fill
        sizes={pxSizes(sizes.display.width, 200)}
        style={{
          objectFit: "cover",
          borderRadius: sizes.display.borderRadius,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.05)",
          backdropFilter: `blur(${sizes.scrim.blur}px)`,
          borderRadius: sizes.display.borderRadius,
        }}
      />
      <ShapePreview
        shape={shape}
        size={sizes.shape.size}
        sizes={sizes.shape}
        style={{
          position: "relative",
          overflow: "visible",
          opacity: dimmed ? 0.45 : 1,
          filter: `drop-shadow(0px 0px ${sizes.shape.glow}px rgba(0, 0, 0, 0.9))`,
        }}
      />
    </div>
  );
}
