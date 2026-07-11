import { useState } from "react";
import { LaurusClientSvg, SvgRepo } from "../svg-repo";
import { LaurusResolution } from "../landing.boot";

interface ToolbarButton {
  selected: boolean;
  svg: { svg: LaurusClientSvg; scale: number; cursor: string };
  onClick: () => void;
  tooltipId?: string;
  title?: string;
  resolution: LaurusResolution;
}
export default function ToolbarButton({ selected, svg, onClick, tooltipId, title, resolution }: ToolbarButton) {
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          svg: 50,
          width: 50,
          selectedWidth: 2,
        };
      case "midhigh":
        return {
          svg: 40,
          width: 40,
          selectedWidth: 2,
        };
      case "low":
      case "midlow":
        return {
          svg: 38,
          width: 38,
          selectedWidth: 2,
        };
    }
  });
  return (
    <div
      style={{
        display: "flex",
        width: "min-content",
        height: dynamicSizes.width,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: dynamicSizes.selectedWidth,
          height: dynamicSizes.width,
          background: "rgba(255,255,255,0)",
        }}
      />
      <div
        data-tooltip-id={tooltipId}
        title={title}
        style={{
          width: "min-content",
          height: "min-content",
        }}
      >
        <SvgRepo
          title={title}
          svg={svg.svg}
          scale={svg.scale}
          scaleToContaier={true}
          onContainerClick={onClick}
          containerStyle={{
            cursor: svg.cursor,
            width: dynamicSizes.svg,
            height: dynamicSizes.svg,
          }}
        />
      </div>
      <div
        style={{
          width: dynamicSizes.selectedWidth,
          height: dynamicSizes.width * 0.85,
          borderRadius: 10,
          background: selected ? "rgba(255,255,255,0.95)" : "none",
          boxShadow: selected ? "0px 0px 20px 1px rgba(255,255,255,0.5)" : "none",
        }}
      />
    </div>
  );
}
