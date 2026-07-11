import { useContext, useState } from "react";
import { UIContext } from "../workspace.client";
import { Tooltip } from "react-tooltip";
import { dellaRespira } from "../../fonts";
import {
  image200,
  polyline200,
  crop200,
  allOut200,
  earthquake200,
  experiment200,
  keyboardCommandKey200,
  cycle200,
  lassoSelect300,
  browse,
} from "../../svg-repo";
import { defaultMarqueeTool, UIActionType } from "../states/ui-state";
import ToolbarButton from "@/app/components/toolbar-button";
import { LaurusUserResult } from "@/app/landing.server";
import Navbar from "@/app/navbar";

interface Toolbar {
  handleMixRestoration: () => void;
  me: LaurusUserResult | undefined;
}
export default function Toolbar({ handleMixRestoration, me }: Toolbar) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const [tooltipDelay] = useState(1000);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          tooltipMarginBottom: 6,
          tooltipFont: 16,
          tooltipFont2: 14,
        };
      case "midhigh":
        return {
          tooltipMarginBottom: 6,
          tooltipFont: 14,
          tooltipFont2: 12,
        };
      case "low":
      case "midlow":
        return {
          tooltipMarginBottom: 6,
          tooltipFont: 14,
          tooltipFont2: 12,
        };
    }
  });

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateRows: uiState.showMediaBrowser
            ? "min-content min-content min-content min-content auto"
            : "min-content min-content auto",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          background: "rgba(31, 31, 31, 1)",
          width: "min-content",
          height: "100%",
          justifyContent: "center",
        }}
      >
        <Navbar resolution={{ ...uiState.resolution }} guest={!me} />
        <div
          style={{
            display: "grid",
            height: 16,
            width: "100%",
            alignContent: "center",
            justifyItems: "center",
          }}
        >
          <div
            style={{
              height: 1,
              borderRadius: 10,
              width: "25%",
              background: "rgba(255, 255, 255, 0.35)",
            }}
          />
        </div>
        {/* page tools */}
        <div>
          <ToolbarButton
            selected={uiState.tool.type == "marquee"}
            svg={{
              svg: lassoSelect300(),
              scale: 0.55,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              if (uiState.tool.type == "marquee") {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "none" },
                });
              } else {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: defaultMarqueeTool,
                });
              }
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            tooltipId="marquee-tool-tooltip"
          />
          <Tooltip
            className={dellaRespira.className}
            id="marquee-tool-tooltip"
            delayShow={tooltipDelay}
            content="marquee"
            style={{
              backgroundColor: "rgb(40, 40, 40)",
              color: "rgb(227, 227, 227)",
              fontSize: dynamicSizes.tooltipFont2,
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              maxWidth: "300px",
              zIndex: 99,
            }}
            render={() => (
              <div style={{ padding: 4, width: "100%" }}>
                <h4
                  style={{
                    marginBottom: dynamicSizes.tooltipMarginBottom,
                    color: "rgb(255, 255, 255)",
                    fontSize: dynamicSizes.tooltipFont,
                  }}
                >
                  Marquee Tool
                </h4>
                <p>
                  Select existing media on the canvas, or drop new media from the <strong>browser</strong> into an area
                  on the canvas.
                </p>
              </div>
            )}
          />
          <ToolbarButton
            selected={uiState.tool.type == "contextmenu"}
            svg={{
              svg: keyboardCommandKey200(),
              scale: 0.6,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              if (uiState.tool.type == "contextmenu") {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "none" },
                });
              } else {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "contextmenu" },
                });
              }
            }}
            resolution={{ ...uiState.resolution }}
            title="context menu tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "viewport"}
            svg={{
              svg: browse("rgba(255,255,255,0.75)"),
              scale: 0.55,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              if (uiState.tool.type == "viewport") {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "none" },
                });
              } else {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "viewport" },
                });
              }
            }}
            resolution={{ ...uiState.resolution }}
            tooltipId="viewport-tool-tooltip"
          />
          <Tooltip
            className={dellaRespira.className}
            id="viewport-tool-tooltip"
            delayShow={tooltipDelay}
            style={{
              backgroundColor: "rgb(40, 40, 40)",
              color: "rgb(227, 227, 227)",
              fontSize: dynamicSizes.tooltipFont2,
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              maxWidth: "300px",
              zIndex: 99,
            }}
            render={() => (
              <div style={{ padding: 4, width: "100%" }}>
                <h4
                  style={{
                    marginBottom: dynamicSizes.tooltipMarginBottom,
                    color: "rgb(255, 255, 255)",
                    fontSize: dynamicSizes.tooltipFont,
                  }}
                >
                  Viewport Tool
                </h4>
                <p>
                  Hide all media on the canvas that lands outside of the <strong>frame</strong>.
                </p>
              </div>
            )}
          />
          <ToolbarButton
            selected={uiState.tool.type == "move"}
            svg={{
              svg: earthquake200(),
              scale: 0.6,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              if (uiState.tool.type == "move") {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "none" },
                });
              } else {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "move" },
                });
              }
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="move tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "scale"}
            svg={{
              svg: allOut200(),
              scale: 0.65,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              if (uiState.tool.type == "scale") {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "none" },
                });
              } else {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "scale" },
                });
              }
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="scale tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "rotate"}
            svg={{
              svg: cycle200(),
              scale: 0.55,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              if (uiState.tool.type == "rotate") {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "none" },
                });
              } else {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "rotate" },
                });
              }
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="rotate tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "mix"}
            svg={{
              svg: experiment200(),
              scale: 0.55,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              if (uiState.tool.type == "mix") {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "none" },
                });
              } else {
                uiDispatch({
                  type: UIActionType.SetTool,
                  value: { type: "mix" },
                });
              }
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            tooltipId="mix-tool-tooltip"
          />
          <Tooltip
            className={dellaRespira.className}
            id="mix-tool-tooltip"
            delayShow={tooltipDelay}
            style={{
              backgroundColor: "rgb(40, 40, 40)",
              color: "rgb(227, 227, 227)",
              fontSize: dynamicSizes.tooltipFont2,
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              maxWidth: "300px",
              zIndex: 99,
            }}
            render={() => (
              <div style={{ padding: 4, width: "100%" }}>
                <h4
                  style={{
                    marginBottom: dynamicSizes.tooltipMarginBottom,
                    color: "rgb(255, 255, 255)",
                    fontSize: dynamicSizes.tooltipFont,
                  }}
                >
                  Mix Tool
                </h4>
                <p>
                  Render a composite of individual animations of the same type that are set to run at the same time.
                </p>
              </div>
            )}
          />
        </div>
        {uiState.showMediaBrowser && (
          <>
            <div
              style={{
                display: "grid",
                height: 16,
                width: "100%",
                alignContent: "center",
                justifyItems: "center",
              }}
            >
              <div
                style={{
                  height: 1,
                  borderRadius: 10,
                  width: "25%",
                  background: "rgba(255, 255, 255, 0.35)",
                }}
              />
            </div>
            {/* right panel tools */}
            <div>
              <ToolbarButton
                selected={uiState.mediaBrowserFilter == "img"}
                svg={{
                  svg: image200(),
                  scale: 0.55,
                  cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
                }}
                onClick={() => {
                  uiDispatch({
                    type: UIActionType.SetMediaBrowserFilter,
                    value: "img",
                  });
                }}
                resolution={{ ...uiState.resolution }}
                title="browse images"
              />
              <ToolbarButton
                selected={uiState.mediaBrowserFilter == "svg"}
                svg={{
                  svg: polyline200(),
                  scale: 0.55,
                  cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
                }}
                onClick={() => {
                  uiDispatch({
                    type: UIActionType.SetMediaBrowserFilter,
                    value: "svg",
                  });
                }}
                resolution={{ ...uiState.resolution }}
                title="browse svgs"
              />
              <ToolbarButton
                selected={uiState.mediaBrowserFilter == "frame"}
                svg={{
                  svg: crop200(),
                  scale: 0.55,
                  cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
                }}
                onClick={() => {
                  uiDispatch({
                    type: UIActionType.SetMediaBrowserFilter,
                    value: "frame",
                  });
                }}
                resolution={{ ...uiState.resolution }}
                title="browse frames"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
