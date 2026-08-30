import { CSSProperties } from "react";
import { LaurusClientSvg, SvgRepo } from "@/app/svg-repo";

interface ToolGreeting {
  title: string;
  svg: LaurusClientSvg;
  svgSize: { width: number; height: number };
  textStyle: CSSProperties;
  containerStyle?: CSSProperties;
  children: string;
}
export default function ToolGreeting({ title, svg, svgSize, textStyle, containerStyle, children }: ToolGreeting) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        width: "100%",
        overflowX: "auto",
        ...containerStyle,
      }}
    >
      <SvgRepo title={title} svg={svg} containerStyle={{ ...svgSize }} scale={1} scaleToContaier={true} />
      <span
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          userSelect: "none",
          ...textStyle,
        }}
      >
        {children}
      </span>
    </div>
  );
}
