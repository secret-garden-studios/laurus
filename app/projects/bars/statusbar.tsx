import { useContext, useState } from "react";
import { dellaRespira, ubuntuMono } from "../../fonts";
import { UIContext } from "../projects.client";

export interface Statusbar {
  action: string;
  body: string[];
}
export default function Statusbar({ action, body }: Statusbar) {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          gap: 6,
          height: 30,
          actionFont: 11,
          bodyFont: 10,
          padding: "0px 12px",
        };
      case "midhigh":
        return {
          gap: 6,
          height: 24,
          actionFont: 8,
          bodyFont: 7,
          padding: "0px 12px",
        };
      case "midlow":
      case "low":
        return {
          gap: 6,
          height: 20,
          actionFont: 7,
          bodyFont: 7,
          padding: "0px 12px",
        };
    }
  });

  return (
    <>
      <div
        style={{
          height: dynamicSizes.height,
          width: "100%",
          display: "flex",
          alignItems: "center",
          backgroundColor: "rgb(23, 23, 23)",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          whiteSpace: "nowrap",
          padding: dynamicSizes.padding,
        }}
      >
        <div
          title="page"
          className={dellaRespira.className}
          style={{
            fontWeight: "bolder",
            fontSize: dynamicSizes.actionFont,
          }}
        >
          {action}
        </div>
        <div
          className={ubuntuMono.className}
          style={{
            overflowX: "auto",
            display: "flex",
            fontSize: dynamicSizes.bodyFont,
          }}
        >
          {body.map((m, i) => {
            return <div key={i}>{`${m} `}</div>;
          })}
        </div>
        <div
          title="screen resolution"
          className={dellaRespira.className}
          style={{
            marginLeft: "auto",
            fontSize: dynamicSizes.bodyFont,
            letterSpacing: "1px",
            userSelect: "none",
          }}
        >
          {`${uiState.resolution.value.width}x${uiState.resolution.value.height}`}
        </div>
      </div>
    </>
  );
}
