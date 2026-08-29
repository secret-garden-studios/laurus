import { useContext, useState, useMemo, useCallback, useEffect, useRef, RefObject } from "react";
import { CoreContext, HoverContext, MaskContext, UIContext } from "../workspace.client";
import LaurusImage from "../../components/laurus-image";
import styles from "../../app.module.css";
import { LaurusFrame, LaurusImgResult } from "../workspace.server";
import { BrowserContextMenu } from "../context-menu";
import { LaurusTool, UIActionType, defaultMarqueeTool } from "../states/ui-state";

export interface ImgBrowser {
  img: LaurusImgResult;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
}
export default function ImgBrowser({ img, framesCacheRef }: ImgBrowser) {
  const { coreState } = useContext(CoreContext);
  const { notifyMaskToolChanged } = useContext(MaskContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isMetaKeyPressed, setSelectedImgKeys, setSelectedSvgKeys, setSelectedMaskKeys } = useContext(HoverContext);
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
    return uiState.browserElement?.type == "img" ? uiState.browserElement.value.img_media_id : "";
  }, [uiState.browserElement]);

  const onImgClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement, MouseEvent>, img: LaurusImgResult) => {
      if (e.metaKey) {
        let newShowContextMenu = false;
        const thisIsNotSelected =
          !browserElementMediaId || (browserElementMediaId && browserElementMediaId != img.img_media_id);
        if (thisIsNotSelected && showContextMenu) {
          newShowContextMenu = true;
        } else {
          newShowContextMenu = !showContextMenu;
        }
        setShowContextMenu(newShowContextMenu);
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: { value: { ...img }, type: "img" },
        });
      } else {
        if (showContextMenu) setShowContextMenu(false);
        setSelectedImgKeys(new Set());
        setSelectedSvgKeys(new Set());
        setSelectedMaskKeys(new Set());
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: { value: { ...img }, type: "img" },
        });
        if (uiState.maskEdit === undefined && uiState.tool.type !== "mask" && uiState.tool.type !== "marquee") {
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
      uiState.tool,
      uiState.maskEdit,
      setSelectedImgKeys,
      setSelectedSvgKeys,
      setSelectedMaskKeys,
      notifyMaskToolChanged,
    ],
  );

  const display = useMemo(() => {
    const containerSize = dynamicSizes.mediaItemSize.container;
    const aspectRatio = img.width / img.height;
    const isSquareish = aspectRatio >= 0.9 && aspectRatio <= 1.1;
    let displayWidth, displayHeight;
    if (isSquareish) {
      displayWidth = containerSize;
      displayHeight = containerSize;
    } else {
      const targetSize = containerSize * 1.33;
      const scale = Math.max(targetSize / img.width, targetSize / img.height);
      displayWidth = Math.round(img.width * scale);
      displayHeight = Math.round(img.height * scale);
    }
    return { isSquareish, displayWidth, displayHeight };
  }, [dynamicSizes.mediaItemSize.container, img.height, img.width]);

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

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const scrollLeft = (display.displayWidth - container.clientWidth) / 2;
      const scrollTop = (display.displayHeight - container.clientHeight) / 2;
      container.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: "instant",
      });
    }
  }, [display.displayWidth, display.displayHeight]);

  return (
    <div
      style={{
        padding: dynamicSizes.mediaItemSize.padding,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: dynamicSizes.mediaItemSize.container,
          height: dynamicSizes.mediaItemSize.container,
          position: "relative",
          borderRadius: 10,
          outline:
            uiState.browserElement?.type == "img" && uiState.browserElement.value.img_media_id == img.img_media_id
              ? "2px solid rgba(66, 133, 244, 1)"
              : "none",
        }}
      >
        {img.src && (
          <div
            className={styles["transparent-checkerboard-background"]}
            ref={containerRef}
            style={{
              width: "100%",
              height: "100%",
              overflow: display.isSquareish ? "none" : "auto",
              borderRadius: 10,
              boxShadow: "5px 5px 12px rgba(11, 11, 11, 0.6)",
            }}
          >
            <LaurusImage
              onClick={(e) => onImgClick(e, img)}
              draggable={false}
              alt={img.media_key}
              src={img.src}
              width={display.displayWidth}
              height={display.displayHeight}
              style={{
                display: "block",
                objectFit: display.isSquareish ? "cover" : "unset",
                borderRadius: 10,
                cursor: isMetaKeyPressed ? "context-menu" : "pointer",
              }}
            />
          </div>
        )}
        {showContextMenu && browserElementMediaId == img.img_media_id && (
          <BrowserContextMenu
            media={{
              type: "img",
              key: coreState.project.imgs.entries().find((e) => e[1].img_media_id == img.img_media_id)?.[0] ?? "",
              data: img,
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
