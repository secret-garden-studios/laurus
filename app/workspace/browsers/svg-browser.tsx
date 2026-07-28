import { useContext, useState, useMemo, useCallback, useEffect, RefObject } from "react";
import { CoreContext, HoverContext, UIContext } from "../workspace.client";
import styles from "../../app.module.css";
import { LaurusFrame, LaurusSvgResult } from "../workspace.server";
import { BrowserContextMenu } from "../context-menu";
import { LaurusTool, UIActionType, defaultMarqueeTool } from "../states/ui-state";

export interface SvgBrowser {
  svg: LaurusSvgResult;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
}
export default function SvgBrowser({ svg, framesCacheRef }: SvgBrowser) {
  const { coreState } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isMetaKeyPressed } = useContext(HoverContext);
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
        };
      case "midhigh":
        return {
          mediaItemSize: {
            container: 230,
            svg: 72,
            padding: "0px 0px 14px 0px",
            marginTop: 18,
          },
        };
      case "midlow":
      case "low":
        return {
          mediaItemSize: {
            container: 180,
            svg: 50,
            padding: "0px 0px 10px 0px",
            marginTop: 18,
          },
        };
    }
  });

  const [showContextMenu, setShowContextMenu] = useState(false);
  const browserElementMediaId = useMemo(() => {
    return uiState.browserElement?.type == "svg" ? uiState.browserElement.value.svg_media_id : "";
  }, [uiState.browserElement]);

  const onSvgClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, svg: LaurusSvgResult) => {
      if (e.metaKey) {
        let newShowContextMenu = false;
        const thisIsNotSelected =
          !browserElementMediaId || (browserElementMediaId && browserElementMediaId != svg.svg_media_id);
        if (thisIsNotSelected && showContextMenu) {
          newShowContextMenu = true;
        } else {
          newShowContextMenu = !showContextMenu;
        }
        setShowContextMenu(newShowContextMenu);
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: { value: { ...svg }, type: "svg" },
        });
      } else {
        if (showContextMenu) setShowContextMenu(false);
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: { value: { ...svg }, type: "svg" },
        });
        if (uiState.playbackMode.type == "stopped") {
          const currentTool = { ...uiState.tool };
          const newTool: LaurusTool = currentTool.type == "marquee" ? currentTool : defaultMarqueeTool;
          uiDispatch({
            type: UIActionType.SetTool,
            value: newTool,
          });
        }
      }
    },
    [browserElementMediaId, showContextMenu, uiDispatch, uiState.playbackMode.type, uiState.tool],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowContextMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  let decodedString = "";
  try {
    decodedString = decodeURIComponent(
      atob(svg.markup)
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
        padding: dynamicSizes.mediaItemSize.padding,
        display: "grid",
        alignItems: "start",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: dynamicSizes.mediaItemSize.container,
          height: dynamicSizes.mediaItemSize.container,
          position: "relative",
        }}
      >
        <div
          className={styles["transparent-checkerboard-background"]}
          onClick={(e) => onSvgClick(e, svg)}
          style={{
            width: dynamicSizes.mediaItemSize.container,
            height: dynamicSizes.mediaItemSize.container,
            position: "relative",
            display: "grid",
            placeContent: "center",
            borderRadius: 10,
            boxShadow: "5px 5px 12px rgba(11, 11, 11, 0.6)",
            border: "1px solid rgba(255,255,255,0.05)",
            cursor: isMetaKeyPressed ? "context-menu" : "pointer",
            outline:
              uiState.browserElement?.type == "svg" && uiState.browserElement.value.svg_media_id == svg.svg_media_id
                ? "2px solid rgba(66, 133, 244, 1)"
                : "none",
          }}
        >
          <svg
            version="1.1"
            width={dynamicSizes.mediaItemSize.svg}
            height={dynamicSizes.mediaItemSize.svg}
            fill={svg.fill}
            stroke={svg.stroke}
            strokeWidth={svg.stroke_width}
            viewBox={svg.viewbox}
            dangerouslySetInnerHTML={{ __html: decodedString }}
          />
        </div>
        {showContextMenu && browserElementMediaId == svg.svg_media_id && (
          <BrowserContextMenu
            media={{
              type: "svg",
              key: coreState.project.svgs.entries().find((e) => e[1].svg_media_id == svg.svg_media_id)?.[0] ?? "",
              data: svg,
            }}
            framesCacheRef={framesCacheRef}
            position={{
              position: "absolute",
              right: 0,
              bottom: 0,
              top: 0,
              left: 0,
            }}
          />
        )}
      </div>
    </div>
  );
}
