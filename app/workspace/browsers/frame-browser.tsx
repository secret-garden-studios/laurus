import { useContext, useState } from "react";
import { dellaRespira } from "../../fonts";
import { CoreContext, UIContext } from "../workspace.client";
import { LaurusCropSvg } from "../../svg-repo";
import { RESOLUTION } from "../../landing.config";
import { getCropSize } from "../workspace.config";
import { updateProject, createProject, LaurusProjectResult } from "../../projects/projects.server";
import { CoreActionType } from "../states/core-state";

export interface FrameBrowser {
  frame: LaurusCropSvg;
  i: number;
}
export default function FrameBrowser({ frame, i }: FrameBrowser) {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          mediaItemSize: {
            container: 300,
            svg: 100,
            padding: "0px 0px 20px 0px",
            marginTop: 18,
          },
          frameScales: {
            high: 1.6,
            midhigh: 1.1,
            midlow: 0.6,
          },
        };
      case "midhigh":
        return {
          mediaItemSize: {
            container: 230,
            svg: 72,
            padding: "0px 0px 14px 0px",
            marginTop: 18,
          },
          frameScales: {
            high: 1.12,
            midhigh: 0.77,
            midlow: 0.42,
          },
        };
      case "midlow":
      case "low":
        return {
          width: 280,
          input: {
            container: {
              padding: "6px 18px",
              gap: 8,
            },
            input: {
              padding: 0,
              letterSpacing: 2,
              fontSize: 8,
            },
          },
          mediaItemSize: {
            container: 230,
            svg: 72,
            padding: "0px 0px 14px 0px",
            marginTop: 18,
          },
          mediaSortSize: {
            container: 50,
            svg: 18,
          },
          frameScales: {
            high: 1.12,
            midhigh: 0.77,
            midlow: 0.42,
          },
          uploadingLight: {
            container: {
              height: 26,
              padding: "8px 10px",
            },
            dot: {
              width: 10,
              height: 10,
            },
          },
          observer: {
            containter: { height: 60, margin: "6px 0px 16px 0px" },
            svg: {
              width: 40,
              height: 40,
            },
          },
        };
    }
  });
  let decodedString = "";
  try {
    decodedString = decodeURIComponent(
      atob(frame.svg.markup)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch (error) {
    console.log("Failed to decodeURIComponent from svg markup", { error });
  }
  if (!decodedString) return;
  return (
    <div
      style={{
        //gridColumn: 2,
        padding: dynamicSizes.mediaItemSize.padding,
        display: "grid",
        alignItems: "start",
        justifyContent: "center",
        marginTop: i == 0 ? dynamicSizes.mediaItemSize.marginTop : 0,
      }}
    >
      <FrameSvg
        scale={dynamicSizes.frameScales.high}
        footer="3x"
        crop={frame}
        cropFactor={RESOLUTION.HIGH_FACTOR}
        decodedString={decodedString}
        containerSize={dynamicSizes.mediaItemSize.container}
        svgSize={dynamicSizes.mediaItemSize.svg}
      />
      <div
        style={{
          paddingTop: Math.round(20 * uiState.resolution.factor),
          paddingBottom: Math.round(20 * uiState.resolution.factor),
        }}
      >
        <FrameSvg
          scale={dynamicSizes.frameScales.midhigh}
          footer="2x"
          crop={frame}
          cropFactor={RESOLUTION.MIDHIGH_FACTOR}
          decodedString={decodedString}
          containerSize={dynamicSizes.mediaItemSize.container}
          svgSize={dynamicSizes.mediaItemSize.svg}
        />
      </div>
      <FrameSvg
        scale={dynamicSizes.frameScales.midlow}
        footer="1x"
        crop={frame}
        cropFactor={RESOLUTION.MIDLOW_FACTOR}
        decodedString={decodedString}
        containerSize={dynamicSizes.mediaItemSize.container}
        svgSize={dynamicSizes.mediaItemSize.svg}
      />
    </div>
  );
}

interface FrameSvg {
  scale: number;
  footer: string;
  crop: LaurusCropSvg;
  cropFactor: number;
  decodedString: string;
  containerSize: number;
  svgSize: number;
}
function FrameSvg({ scale, footer, crop, cropFactor, decodedString, containerSize, svgSize }: FrameSvg) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [cropSize] = useState(() => {
    const s = getCropSize(crop);
    return {
      width: Math.round(s.width * cropFactor),
      height: Math.round(s.height * cropFactor),
    };
  });
  const [overlaySize] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          padding: "9px 13px",
          xWidth: 17,
          footerPaddingBottom: 9,
          dimensionFont: 17,
          xFont: 15,
          aspectFont: 17,
          footerFont: 16,
        };
      case "midhigh":
        return {
          padding: "6px 10px",
          xWidth: 11,
          footerPaddingBottom: 6,
          dimensionFont: 11,
          xFont: 9,
          aspectFont: 11,
          footerFont: 10,
        };
      case "low":
      case "midlow":
        return {
          padding: "5px 9px",
          xWidth: 8,
          footerPaddingBottom: 5,
          dimensionFont: 10,
          xFont: 8,
          aspectFont: 10,
          footerFont: 9,
        };
    }
  });

  return (
    <div
      onClick={async () => {
        const newProject: LaurusProjectResult = {
          ...coreState.project,
          frame_width: cropSize.width,
          frame_height: cropSize.height,
        };
        if (coreState.project.project_id) {
          dispatch({ type: CoreActionType.SetProject, value: newProject });
          await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, { ...newProject });
        } else {
          const response = await createProject(coreState.apiOrigin, coreState.accessToken, { ...newProject });
          if (response) {
            dispatch({
              type: CoreActionType.SetProject,
              value: { ...response },
            });
          }
        }
      }}
      style={{
        width: containerSize,
        height: containerSize,
        position: "relative",
        display: "grid",
        placeContent: "center",
        boxShadow: "5px 5px 12px rgba(0, 0, 0, 0.2)",
        border: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(255,255,255,0.005)",
        borderRadius: 5,
        cursor: "pointer",
        outline:
          coreState.project.frame_width == cropSize.width && coreState.project.frame_height == cropSize.height
            ? "2px solid rgba(66, 133, 244, 1)"
            : "none",
      }}
    >
      {decodedString && (
        <svg
          version="1.1"
          width={svgSize * scale}
          height={svgSize * scale}
          fill={crop.svg.fill}
          stroke={crop.svg.stroke}
          strokeWidth={crop.svg.stroke_width}
          viewBox={crop.svg.viewbox}
          dangerouslySetInnerHTML={{ __html: decodedString }}
        />
      )}
      <div
        style={{
          position: "absolute",
          display: "grid",
          width: "100%",
          height: "100%",
          gridTemplateRows: "min-content auto min-content",
        }}
      >
        <div
          className={dellaRespira.className}
          style={{
            display: "flex",
            padding: overlaySize.padding,
          }}
        >
          <div style={{ fontSize: overlaySize.dimensionFont }}>{cropSize.width}</div>
          <div
            style={{
              fontSize: overlaySize.xFont,
              width: overlaySize.xWidth,
              textAlign: "center",
            }}
          >
            {"x"}
          </div>
          <div style={{ fontSize: overlaySize.dimensionFont }}>{cropSize.height}</div>
          <div
            className={dellaRespira.className}
            style={{
              marginLeft: "auto",
              fontSize: overlaySize.aspectFont,
              alignSelf: "start",
            }}
          >
            {crop.type}
          </div>
        </div>
        <div
          className={dellaRespira.className}
          style={{
            gridRow: 3,
            display: "grid",
            placeContent: "center",
            paddingBottom: overlaySize.footerPaddingBottom,
            fontSize: overlaySize.footerFont,
          }}
        >
          <i>{footer}</i>
        </div>
      </div>
    </div>
  );
}
