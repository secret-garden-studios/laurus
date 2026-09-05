import { useContext, useState, useMemo, useCallback, useEffect, RefObject, memo } from "react";
import { CoreContext, HoverContext, MaskNotifyContext } from "../workspace.client";
import styles from "../../app.module.css";
import { LaurusFrame, LaurusSvgResult } from "../workspace.server";
import { BrowserContextMenu } from "../context-menu";
import { defaultMarqueeTool, LaurusTool, UIActionType } from "../states/ui-state";
import { decodeSvgMarkup } from "../canvas-media/object-shape";
import { useUIBrowserElement, useUIDispatch, useUIMaskEdit, useUIResolution, useUITool } from "../states/ui-store";

export interface SvgBrowser {
  svg: LaurusSvgResult;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
}

const clearedKeys = (previous: Set<string>) => (previous.size === 0 ? previous : new Set<string>());

function SvgBrowser({ svg, framesCacheRef }: SvgBrowser) {
  const { coreState } = useContext(CoreContext);
  const { notifyMaskToolChanged } = useContext(MaskNotifyContext);
  const uiDispatch = useUIDispatch();
  const browserElement = useUIBrowserElement();
  const tool = useUITool();
  const maskEdit = useUIMaskEdit();
  const resolution = useUIResolution();
  const { isMetaKeyPressed, setSelectedImgKeys, setSelectedSvgKeys } = useContext(HoverContext);
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
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
    return browserElement?.type == "svg" ? browserElement.value.svg_media_id : "";
  }, [browserElement]);

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
        setSelectedImgKeys(clearedKeys);
        setSelectedSvgKeys(clearedKeys);
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: { value: { ...svg }, type: "svg" },
        });
        if (maskEdit === undefined && tool.type !== "mask" && tool.type !== "marquee") {
          const newTool: LaurusTool = defaultMarqueeTool;
          uiDispatch({
            type: UIActionType.SetTool,
            value: newTool,
          });
          notifyMaskToolChanged(newTool.type);
        }
      }
    },
    [
      browserElementMediaId,
      showContextMenu,
      uiDispatch,
      setSelectedImgKeys,
      setSelectedSvgKeys,
      tool.type,
      maskEdit,
      notifyMaskToolChanged,
    ],
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

  const decodedString = decodeSvgMarkup(svg.markup);
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
              browserElement?.type == "svg" && browserElement.value.svg_media_id == svg.svg_media_id
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

export default memo(SvgBrowser);
