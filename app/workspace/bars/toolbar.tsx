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
  bookmarkStacks200,
  texture200,
  asterisk200,
  inkPen300,
  skew300,
} from "../../svg-repo";
import {
  defaultLightSourceTool,
  defaultMarqueeTool,
  defaultMaskTool,
  defaultPenTool,
  LaurusTool,
  UIActionType,
} from "../states/ui-state";
import { useToolSwitch } from "../hooks/useMaskEditExit";
import ToolbarButton from "@/app/components/toolbar-button";
import { LaurusUserResult } from "@/app/landing.server";
import Navbar from "@/app/navbar";

interface Toolbar {
  handleMixRestoration: () => void;
  me: LaurusUserResult | undefined;
}
export default function Toolbar({ handleMixRestoration, me }: Toolbar) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const switchTool = useToolSwitch();
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
          cursor: "default",
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
              const next: LaurusTool = uiState.tool.type == "marquee" ? { type: "none" } : defaultMarqueeTool;
              if (!switchTool(next)) return;
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="marquee tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "mask"}
            svg={{
              svg: texture200(),
              scale: 0.55,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              const next: LaurusTool = uiState.tool.type == "mask" ? { type: "none" } : defaultMaskTool;
              if (!switchTool(next)) return;
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="mask tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "light_source"}
            svg={{
              svg: asterisk200(),
              scale: 0.65,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              const next: LaurusTool = uiState.tool.type == "light_source" ? { type: "none" } : defaultLightSourceTool;
              if (!switchTool(next)) return;
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="shader tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "pen"}
            svg={{
              svg: inkPen300(),
              scale: 0.5,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              const next: LaurusTool = uiState.tool.type == "pen" ? { type: "none" } : defaultPenTool;
              if (!switchTool(next)) return;
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="pen tool"
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
              const next: LaurusTool = uiState.tool.type == "contextmenu" ? { type: "none" } : { type: "contextmenu" };
              if (!switchTool(next)) return;
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
              const next: LaurusTool = uiState.tool.type == "viewport" ? { type: "none" } : { type: "viewport" };
              if (!switchTool(next)) return;
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
              const next: LaurusTool = uiState.tool.type == "move" ? { type: "none" } : { type: "move" };
              if (!switchTool(next)) return;
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
              const next: LaurusTool = uiState.tool.type == "scale" ? { type: "none" } : { type: "scale" };
              if (!switchTool(next)) return;
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="scale tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "rotate"}
            svg={{
              svg: cycle200(),
              scale: 0.525,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              const next: LaurusTool = uiState.tool.type == "rotate" ? { type: "none" } : { type: "rotate" };
              if (!switchTool(next)) return;
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="rotate tool"
          />
          <ToolbarButton
            selected={uiState.tool.type == "skew"}
            svg={{
              svg: skew300(),
              scale: 0.55,
              cursor: uiState.playbackMode.type != "stopped" ? "wait" : "pointer",
            }}
            onClick={() => {
              if (uiState.playbackMode.type !== "stopped") return;
              handleMixRestoration();
              const next: LaurusTool = uiState.tool.type == "skew" ? { type: "none" } : { type: "skew" };
              if (!switchTool(next)) return;
              uiDispatch({ type: UIActionType.CloseAllContextMenus });
            }}
            resolution={{ ...uiState.resolution }}
            title="skew tool"
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
              const next: LaurusTool = uiState.tool.type == "mix" ? { type: "none" } : { type: "mix" };
              if (!switchTool(next)) return;
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
                  Composite Tool
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
            <div>
              <ToolbarButton
                selected={uiState.mediaBrowserFilter == "img"}
                svg={{
                  svg: image200(),
                  scale: 0.55,
                  cursor: "pointer",
                }}
                onClick={() => {
                  uiDispatch({
                    type: UIActionType.SetMediaBrowserFilter,
                    value: "img",
                  });
                }}
                resolution={{ ...uiState.resolution }}
                title="images"
              />
              <ToolbarButton
                selected={uiState.mediaBrowserFilter == "svg"}
                svg={{
                  svg: polyline200(),
                  scale: 0.55,
                  cursor: "pointer",
                }}
                onClick={() => {
                  uiDispatch({
                    type: UIActionType.SetMediaBrowserFilter,
                    value: "svg",
                  });
                }}
                resolution={{ ...uiState.resolution }}
                title="vectors"
              />
              <ToolbarButton
                selected={uiState.mediaBrowserFilter == "frame"}
                svg={{
                  svg: crop200(),
                  scale: 0.55,
                  cursor: "pointer",
                }}
                onClick={() => {
                  uiDispatch({
                    type: UIActionType.SetMediaBrowserFilter,
                    value: "frame",
                  });
                }}
                resolution={{ ...uiState.resolution }}
                title="frames"
              />
              <ToolbarButton
                selected={uiState.mediaBrowserFilter == "group"}
                svg={{
                  svg: bookmarkStacks200(),
                  scale: 0.55,
                  cursor: "pointer",
                }}
                onClick={() => {
                  uiDispatch({
                    type: UIActionType.SetMediaBrowserFilter,
                    value: "group",
                  });
                }}
                resolution={{ ...uiState.resolution }}
                title="media groups"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
