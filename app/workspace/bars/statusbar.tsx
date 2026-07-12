"use client";

import { RefObject, useContext, useState } from "react";
import { CoreContext, UIContext } from "../workspace.client";
import { dellaRespira, ubuntuMono } from "../../fonts";
import {
  allOut,
  autorenew,
  browse,
  contentPaste,
  earthquake,
  experiment,
  forward,
  keyboardCommandKey,
  lassoSelect,
  SvgRepo,
  cycle400,
} from "../../svg-repo";
import { RiToolsLine } from "react-icons/ri";
import { Tooltip } from "react-tooltip";
import { LaurusFrame } from "../workspace.server";
import { CoreActionType } from "../states/core-state";

export interface Statusbar {
  action: string;
  body: string[];
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
}
export default function Statusbar({ action, body, framesCacheRef }: Statusbar) {
  const { coreState, dispatch } = useContext(CoreContext);
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
        gap: dynamicSizes.gap,
      }}
    >
      <div
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
        title={uiState.effectClipboard ? "" : "clipboard"}
        data-tooltip-id="clipboard-tooltip-id"
        style={{
          marginLeft: "auto",
          fontSize: dynamicSizes.actionFont,
        }}
      >
        <SvgRepo
          title={uiState.effectClipboard ? "" : "clipboard"}
          svg={uiState.effectClipboard ? contentPaste() : contentPaste("rgb(62, 62, 62)")}
          containerStyle={{
            width: 30,
            height: 30,
          }}
          scale={0.5}
        />
      </div>
      {uiState.effectClipboard && (
        <>
          <Tooltip
            className={dellaRespira.className}
            id="clipboard-tooltip-id"
            data-tooltip-place="top-start"
            style={{
              backgroundColor: "rgb(40, 40, 40)",
              color: "rgb(227, 227, 227)",
              fontSize: 14,
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              maxWidth: "300px",
            }}
            render={() => {
              const clipboardData = uiState.effectClipboard?.value.math.get("clipboard") ?? undefined;
              return (
                <div style={{ padding: 4, width: "100%" }}>
                  <SvgRepo
                    svg={(() => {
                      switch (uiState.effectClipboard!.type) {
                        case "scale":
                          return allOut();
                        case "move":
                          return earthquake();
                        case "rotate":
                          return cycle400();
                      }
                    })()}
                    containerStyle={{
                      width: 30,
                      height: 30,
                    }}
                    scale={1}
                  />
                  {clipboardData && (
                    <div
                      style={{
                        margin: "0 0 8px 0",
                        overflowWrap: "break-word",
                        whiteSpace: "pre-wrap",
                        maxWidth: "100%",
                        padding: 10,
                      }}
                    >
                      <div>
                        {JSON.stringify(
                          clipboardData,
                          (key, value) => {
                            if (key === "solution" || key === "input_id") return undefined;
                            return value;
                          },
                          2,
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />
        </>
      )}
      <div
        title={"cache"}
        onDoubleClick={() => {
          if (framesCacheRef.current) {
            framesCacheRef.current.clear();
            dispatch({
              type: CoreActionType.SetInputsToRender,
              value: new Set<string>(["*"]),
            });
          }
        }}
        style={{
          fontSize: dynamicSizes.actionFont,
        }}
      >
        <SvgRepo
          title={"cache"}
          svg={coreState.inputsToRender.size == 0 ? autorenew() : autorenew("rgb(62, 62, 62)")}
          containerStyle={{
            width: 30,
            height: 30,
          }}
          scale={0.5}
        />
      </div>
      <div
        title={"filled forwards"}
        style={{
          fontSize: dynamicSizes.actionFont,
        }}
      >
        <SvgRepo
          title={"filled forwards"}
          svg={uiState.filledForwards ? forward() : forward("rgb(62, 62, 62)")}
          containerStyle={{
            width: 30,
            height: 30,
          }}
          scale={0.5}
        />
      </div>
      <div
        title="active tool"
        style={{
          fontSize: dynamicSizes.actionFont,
        }}
      >
        {uiState.tool.type == "none" ? (
          <div
            style={{
              width: 30,
              height: 30,
              display: "grid",
              placeContent: "center",
            }}
          >
            <RiToolsLine size={15} color="rgb(62, 62, 62)" />
          </div>
        ) : (
          <SvgRepo
            title="active tool"
            svg={(() => {
              switch (uiState.tool.type) {
                case "marquee":
                  return lassoSelect();
                case "contextmenu":
                  return keyboardCommandKey();
                case "viewport":
                  return browse();
                case "move":
                  return earthquake();
                case "scale":
                  return allOut();
                case "rotate":
                  return cycle400();
                case "mix":
                  return experiment();
              }
            })()}
            containerStyle={{
              width: 30,
              height: 30,
            }}
            scale={0.5}
          />
        )}
      </div>
      <div
        title="screen resolution"
        className={dellaRespira.className}
        style={{
          fontSize: dynamicSizes.bodyFont,
          letterSpacing: "1px",
          userSelect: "none",
        }}
      >
        {`${uiState.resolution.value.width}x${uiState.resolution.value.height}`}
      </div>
    </div>
  );
}
