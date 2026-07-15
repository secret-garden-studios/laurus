import {
  useContext,
  useRef,
  useState,
  DragEvent,
  useCallback,
  useMemo,
  useEffect,
  RefObject,
  useLayoutEffect,
} from "react";
import { dellaRespira } from "../fonts";
import { CoreContext, HoverContext, UIContext } from "./workspace.client";
import LaurusImage from "../components/laurus-image";
import styles from "../app.module.css";
import { LaurusCropSvg, publicIcon, refresh200, sort300, SvgRepo } from "../svg-repo";
import { createImg, createSvg, LaurusFrame, LaurusImgResult, LaurusSvgResult } from "./workspace.server";
import { getCropSize } from "./workspace.config";
import { updateProject, createProject, LaurusProjectResult } from "../projects/projects.server";
import { BrowserContextMenu } from "./context-menu";
import { LaurusTool, UIActionType, defaultMarqueeTool, defaultUIState } from "./states/ui-state";
import { CoreActionType } from "./states/core-state";
import { RESOLUTION } from "../landing.config";

export type MediaSortValue =
  "last_active_123" | "last_active_321" | "timestamp_123" | "timestamp_321" | "name_az" | "name_za" | "ai" | "none";

export interface MediaSortOption {
  value: MediaSortValue;
  label: string;
}

export const sortOptions: MediaSortOption[] = [
  { value: "none", label: "" },
  { value: "last_active_123", label: "date edited (oldest first)" },
  { value: "last_active_321", label: "date edited (newest first)" },
  { value: "name_az", label: "filename A to Z" },
  { value: "name_za", label: "filename Z to A" },
  { value: "timestamp_123", label: "date created (oldest first)" },
  { value: "timestamp_321", label: "date created (newest first)" },
  { value: "ai", label: "ai tags" },
];

export const defaultMediaSortValue: MediaSortValue = "last_active_321";

export function parseMediaSortValue(
  inputString: string | null | undefined,
  fallback: MediaSortValue = defaultMediaSortValue,
): MediaSortValue {
  if (!inputString) {
    return fallback;
  }
  const matchExists = sortOptions.some((option) => option.value === inputString);
  return matchExists ? (inputString as MediaSortValue) : fallback;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

async function rasterizeSvg(svgXml: string, width: number = 1120, height: number = 1120): Promise<string> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const pngDataUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(url);
      resolve(pngDataUrl);
    };

    img.onerror = (err) => {
      console.log({ err });
      reject(err);
    };
    img.src = url;
  });
}

function sortByNameAz(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
  return a.media_key.localeCompare(b.media_key);
}

function sortByNameZa(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
  return b.media_key.localeCompare(a.media_key);
}

function sortByTimestamp321(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function sortByTimestamp123(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function sortByLastActive321(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
  return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
}

function sortByLastActive123(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
  return new Date(a.last_active).getTime() - new Date(b.last_active).getTime();
}

function sortByOrder(a: LaurusImgResult | LaurusSvgResult, b: LaurusImgResult | LaurusSvgResult) {
  return a.order - b.order;
}

function sortBrowserMedia(
  projects: (LaurusImgResult | LaurusSvgResult)[],
  sort: MediaSortValue,
): (LaurusImgResult | LaurusSvgResult)[] {
  return [...projects].sort((a, b) => {
    switch (sort) {
      case "name_az":
        return sortByNameAz(a, b);
      case "name_za":
        return sortByNameZa(a, b);
      case "timestamp_123":
        return sortByTimestamp123(a, b);
      case "timestamp_321":
        return sortByTimestamp321(a, b);
      case "last_active_321":
        return sortByLastActive321(a, b);
      case "last_active_123":
        return sortByLastActive123(a, b);
      case "ai":
        return sortByOrder(a, b);
      case "none":
        return 0;
    }
  });
}

interface MediaBrowser {
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
  refreshIconRef: RefObject<SVGSVGElement | null>;
  onNextPage: () => void;
  onPrevPage?: () => void;
}
export default function MediaBrowser({ framesCacheRef, refreshIconRef, onNextPage }: MediaBrowser) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          width: 440,
          input: {
            container: {
              padding: "6px 18px",
              gap: 8,
            },
            input: {
              padding: 0,
              letterSpacing: 2,
              fontSize: 12,
            },
          },
          mediaItemSize: {
            container: 300,
            svg: 100,
            padding: "0px 0px 20px 0px",
            marginTop: 18,
          },
          mediaSortSize: {
            container: 65,
            svg: 24,
          },
          frameScales: {
            high: 1.6,
            midhigh: 1.1,
            midlow: 0.6,
          },
          uploadingLight: {
            container: {
              height: 40,
              padding: 10,
            },
            dot: {
              width: 14,
              height: 14,
            },
          },
          observer: {
            containter: { height: 100, margin: "10px 0px 20px 0px" },
            svg: {
              width: 60,
              height: 60,
            },
          },
        };
      case "midhigh":
        return {
          width: 330,
          input: {
            container: {
              padding: "6px 18px",
              gap: 8,
            },
            input: {
              padding: 0,
              letterSpacing: 2,
              fontSize: 10,
            },
          },
          mediaItemSize: {
            container: 230,
            svg: 72,
            padding: "0px 0px 14px 0px",
            marginTop: 18,
          },
          mediaSortSize: {
            container: 60,
            svg: 20,
          },
          frameScales: {
            high: 1.12,
            midhigh: 0.77,
            midlow: 0.42,
          },
          uploadingLight: {
            container: {
              height: 30,
              padding: "8px 10px",
            },
            dot: {
              width: 12,
              height: 12,
            },
          },
          observer: {
            containter: { height: 70, margin: "10px 0px 20px 0px" },
            svg: {
              width: 45,
              height: 45,
            },
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
  const [mediaSort, setMediaSort] = useState<MediaSortValue>("none");
  const [mediaUploading, setMediaUploading] = useState<boolean>(false);

  const handleUpload = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const MAX_DIMENSION = 4096;
      const files = Array.from(event.dataTransfer.files);
      const expectedSvgUploads = files.filter((f) => f.type == "image/svg+xml").length;
      const expectedImgUploads = files.filter((f) => f.type.startsWith("image/") && f.type != "image/svg+xml").length;
      let actualSvgUploads = 0;
      let actualImgUploads = 0;
      setMediaUploading(true);
      for (const file of files) {
        if (file.type === "image/svg+xml") {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const svgString = e.target?.result;
            if (typeof svgString !== "string") {
              setMediaUploading(false);
              return;
            }
            try {
              const parser = new DOMParser();
              const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
              const svgElement = svgDoc.documentElement as unknown as SVGSVGElement;
              let width = svgElement.viewBox.baseVal.width || parseFloat(svgElement.getAttribute("width") || "1120");
              let height = svgElement.viewBox.baseVal.height || parseFloat(svgElement.getAttribute("height") || "1120");
              if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
              }
              const pngDataUrl = await rasterizeSvg(svgString, width, height);
              const svgFile: File = dataUrlToFile(pngDataUrl, `${file.name.split(".")[0]}.png`);
              const created = await createSvg(coreState.apiOrigin, {
                svg: file,
                raster: svgFile,
              });
              if (created) {
                const existingSvg = uiState.browserSvgs.find((v) => v.media_key === created.media_key);
                if (existingSvg && existingSvg.svg_media_id !== created.svg_media_id) {
                  uiDispatch({
                    type: UIActionType.DeleteBrowserSvg,
                    value: existingSvg.svg_media_id,
                  });
                }
                uiDispatch({
                  type: UIActionType.AddBrowserSvg,
                  value: created,
                  first: true,
                });
                uiDispatch({
                  type: UIActionType.SetBrowserElement,
                  value: { type: "svg", value: { ...created } },
                });
                const currentTool = { ...uiState.tool };
                const newTool: LaurusTool = currentTool.type == "marquee" ? currentTool : defaultMarqueeTool;
                uiDispatch({ type: UIActionType.SetTool, value: newTool });
                if (++actualSvgUploads == expectedSvgUploads) {
                  setMediaUploading(false);
                }
              }
            } catch (err) {
              setMediaUploading(false);
              console.error("svg upload error", err);
            }
          };
          reader.readAsText(file);
        } else if (file.type.startsWith("image/")) {
          try {
            const created = await createImg(coreState.apiOrigin, file);
            if (created) {
              const existingImg = uiState.browserImgs.find((v) => v.media_key === created.media_key);
              if (existingImg && existingImg.img_media_id !== created.img_media_id) {
                uiDispatch({
                  type: UIActionType.DeleteBrowserImg,
                  value: existingImg.img_media_id,
                });
              }
              uiDispatch({
                type: UIActionType.AddBrowserImg,
                value: { ...created },
                first: true,
              });
              uiDispatch({
                type: UIActionType.SetBrowserElement,
                value: { type: "img", value: { ...created } },
              });
              const currentTool = { ...uiState.tool };
              const newTool: LaurusTool = currentTool.type == "marquee" ? currentTool : defaultMarqueeTool;
              uiDispatch({ type: UIActionType.SetTool, value: newTool });
              if (++actualImgUploads == expectedImgUploads) {
                setMediaUploading(false);
              }
            }
          } catch (err) {
            setMediaUploading(false);
            console.error("img upload error", err);
          }
        }
      }
    },
    [coreState.apiOrigin, uiState.browserSvgs, uiState.tool, uiState.browserImgs, uiDispatch],
  );

  const onPublicImgToggle = useCallback(async () => {
    let newProjectIdAck = "";
    const newBrowsePublicImgs = !coreState.project.browse_public_imgs;
    const newProject: LaurusProjectResult = {
      ...coreState.project,
      browse_public_imgs: newBrowsePublicImgs,
    };
    if (!coreState.project.project_id) {
      const projectCreated = await createProject(coreState.apiOrigin, coreState.accessToken, { ...newProject });
      if (projectCreated) {
        newProjectIdAck = projectCreated.project_id;
        const newProject2: LaurusProjectResult = {
          ...newProject,
          project_id: newProjectIdAck,
        };
        dispatch({ type: CoreActionType.SetProject, value: newProject2 });
      }
    } else {
      const projectUpdated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (projectUpdated) {
        newProjectIdAck = newProject.project_id;
        dispatch({ type: CoreActionType.SetProject, value: newProject });
      }
    }
    if (!newBrowsePublicImgs && newProjectIdAck) {
      const newBrowserImgs = uiState.browserImgs.filter((b) =>
        Array.from(newProject.imgs.values())
          .flatMap((v) => v.img_media_id)
          .includes(b.img_media_id),
      );
      uiDispatch({ type: UIActionType.SetBrowserImgs, value: newBrowserImgs });
      uiDispatch({
        type: UIActionType.SetBrowserElement,
        value: defaultUIState.browserElement == undefined ? undefined : { ...defaultUIState.browserElement },
      });
    }
    if (newBrowsePublicImgs && uiState.browserImgs.length == 0) {
      onNextPage();
    }
    setMediaSort("none");
  }, [
    coreState.project,
    coreState.apiOrigin,
    coreState.accessToken,
    dispatch,
    uiState.browserImgs,
    uiDispatch,
    onNextPage,
  ]);

  const onPublicSvgToggle = useCallback(async () => {
    let newProjectIdAck = "";
    const newBrowsePublicSvgs = !coreState.project.browse_public_svgs;
    const newProject: LaurusProjectResult = {
      ...coreState.project,
      browse_public_svgs: newBrowsePublicSvgs,
    };
    if (!coreState.project.project_id) {
      const projectCreated = await createProject(coreState.apiOrigin, coreState.accessToken, { ...newProject });
      if (projectCreated) {
        newProjectIdAck = projectCreated.project_id;
        const newProject2: LaurusProjectResult = {
          ...newProject,
          project_id: newProjectIdAck,
        };
        dispatch({ type: CoreActionType.SetProject, value: newProject2 });
      }
    } else {
      const projectUpdated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
        ...newProject,
      });
      if (projectUpdated) {
        newProjectIdAck = newProject.project_id;
        dispatch({ type: CoreActionType.SetProject, value: newProject });
      }
    }
    if (!newBrowsePublicSvgs && newProjectIdAck) {
      const newBrowserSvgs = uiState.browserSvgs.filter((b) =>
        Array.from(newProject.svgs.values())
          .flatMap((v) => v.svg_media_id)
          .includes(b.svg_media_id),
      );
      uiDispatch({ type: UIActionType.SetBrowserSvgs, value: newBrowserSvgs });
      uiDispatch({
        type: UIActionType.SetBrowserElement,
        value: defaultUIState.browserElement == undefined ? undefined : { ...defaultUIState.browserElement },
      });
    }
    if (newBrowsePublicSvgs && uiState.browserSvgs.length == 0) {
      onNextPage();
    }
    setMediaSort("none");
  }, [
    coreState.project,
    coreState.apiOrigin,
    coreState.accessToken,
    uiState.browserSvgs,
    dispatch,
    uiDispatch,
    onNextPage,
  ]);

  const publicIconSelected = useMemo(() => {
    switch (uiState.mediaBrowserFilter) {
      case "img": {
        return coreState.project.browse_public_imgs ? true : false;
      }
      case "svg": {
        return coreState.project.browse_public_svgs ? true : false;
      }
      case "frame":
      default:
        return false;
    }
  }, [coreState.project.browse_public_imgs, coreState.project.browse_public_svgs, uiState.mediaBrowserFilter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [uiDispatch]);

  const mediaBrowserRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    mediaBrowserRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [uiState.browserImgs.length, uiState.browserSvgs.length, uiState.browserFrames.length]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && mediaSort == "none") {
          onNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [mediaSort, onNextPage],
  );

  return (
    <div
      className={
        styles[`${uiState.resolution.type == "high" ? "noisy-background-20-2" : "noisy-background-20-2-low-res"}`]
      }
      style={{
        display: "grid",
        gridTemplateRows: uiState.mediaBrowserFilter != "frame" ? "auto min-content" : "auto",
        height: "100%",
        width: dynamicSizes.width,
        borderLeft: "1px solid rgba(255,255,255,0.1)",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={handleUpload}
    >
      <div
        style={{
          display: "grid",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            alignContent: "center",
            justifyContent: "end",
            ...dynamicSizes.uploadingLight.container,
          }}
        >
          <div
            title={"light"}
            style={{
              borderRadius: "50%",
              border: mediaUploading ? "1px solid rgb(239, 239, 239)" : "1px solid rgba(255, 255, 255, 0.03)",
              background: mediaUploading
                ? "linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))"
                : "rgba(255, 255, 255, 0.03)",
              boxShadow: mediaUploading ? "rgba(255, 255, 255, 1) 0px 0px 100px 10px" : "none",
              ...dynamicSizes.uploadingLight.dot,
            }}
          />
        </div>
        {/* content area */}
        <div
          ref={mediaBrowserRef}
          style={{
            display: "grid",
            alignContent: "start",
            justifyContent: "center",
            width: "100%",
            color: "rgba(220, 220, 220, 1)",
          }}
        >
          {/* media thumbnails */}
          {uiState.mediaBrowserFilter == "img" &&
            sortBrowserMedia(uiState.browserImgs, mediaSort).map((media, i) => {
              const img = media as LaurusImgResult;
              const publicImg: boolean = !Array.from(coreState.project.imgs.values())
                .flatMap((i) => i.img_media_id)
                .includes(img.img_media_id);
              if (publicImg && !coreState.project.browse_public_imgs) return;
              return (
                <div key={i}>
                  <ImgBrowser img={img} framesCacheRef={framesCacheRef} />
                </div>
              );
            })}
          {uiState.mediaBrowserFilter == "svg" &&
            sortBrowserMedia(uiState.browserSvgs, mediaSort).map((media, i) => {
              const svg: LaurusSvgResult = media as LaurusSvgResult;
              const publicSvg: boolean = !Array.from(coreState.project.svgs.values())
                .flatMap((i) => i.svg_media_id)
                .includes(svg.svg_media_id);
              if (publicSvg && !coreState.project.browse_public_svgs) return;
              return (
                <div key={i}>
                  <SvgBrowser svg={svg} framesCacheRef={framesCacheRef} />
                </div>
              );
            })}
          {uiState.mediaBrowserFilter == "frame" &&
            uiState.browserFrames.map((frame, i) => {
              const decodedString = decodeURIComponent(
                atob(frame.svg.markup)
                  .split("")
                  .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                  .join(""),
              );
              return (
                <div
                  key={frame.svg.media_key}
                  style={{
                    gridColumn: 2,
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
            })}
        </div>
        {publicIconSelected && uiState.mediaBrowserFilter != "frame" && (
          <div
            ref={lastElementRef}
            style={{
              display: "grid",
              placeContent: "center",
              ...dynamicSizes.observer.containter,
            }}
          >
            <SvgRepo
              onContainerClick={() => {
                if (mediaSort != "none") {
                  onNextPage();
                }
              }}
              onSvgRef={(svgRef) => {
                if (svgRef) {
                  refreshIconRef.current = svgRef;
                }
              }}
              svg={refresh200("rgba(255,255,255,0.25)")}
              scale={1}
              containerStyle={{
                cursor: mediaSort != "none" ? "pointer" : "",
                ...dynamicSizes.observer.svg,
              }}
              scaleToContaier={true}
            />
          </div>
        )}
      </div>
      {uiState.mediaBrowserFilter != "frame" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: dynamicSizes.mediaSortSize.container,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(23, 23, 23, 1)",
          }}
        >
          <div
            style={{
              display: "flex",
              height: "100%",
              width: "100%",
              alignItems: "center",
              ...dynamicSizes.input.container,
            }}
          >
            <div
              onClick={() => {
                if (mediaUploading) return;
                switch (uiState.mediaBrowserFilter) {
                  case "img": {
                    onPublicImgToggle();
                    break;
                  }
                  case "svg": {
                    onPublicSvgToggle();
                    break;
                  }
                  case "frame":
                  default:
                    break;
                }
              }}
              style={{
                cursor: "pointer",
                display: "grid",
                placeContent: "center",
                height: "100%",
              }}
            >
              <SvgRepo
                title={"toggle public media"}
                svg={publicIconSelected ? publicIcon("rgb(220, 220, 220)") : publicIcon("rgba(255,255,255,0.2)")}
                containerStyle={{
                  cursor: mediaUploading ? "progress" : "pointer",
                  width: dynamicSizes.mediaSortSize.svg,
                  height: dynamicSizes.mediaSortSize.svg,
                }}
                scale={0.8}
                scaleToContaier={true}
              />
            </div>
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "60%",
                alignItems: "center",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "0px 10px",
              }}
            >
              <SvgRepo
                svg={mediaSort != "none" ? sort300("rgb(220, 220, 220)") : sort300("rgba(255,255,255,0.2)")}
                containerStyle={{
                  cursor: "pointer",
                  width: dynamicSizes.mediaSortSize.svg,
                  height: "100%",
                }}
                scale={0.9}
                scaleToContaier={true}
              />

              <select
                id={"media-browser-sort-select-input"}
                className={dellaRespira.className}
                style={{
                  width: "100%",
                  height: "100%",
                  color: "rgba(227,227,227,1)",
                  border: "none",
                  outline: "none",
                  background: "none",
                  textAlign: "center",
                  cursor: "pointer",
                  ...dynamicSizes.input.input,
                }}
                value={mediaSort}
                autoComplete="off"
                onChange={(e) => {
                  const newSortValue: MediaSortValue = parseMediaSortValue(e.target.value);
                  setMediaSort(newSortValue);
                }}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ImgBrowser {
  img: LaurusImgResult;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
}
function ImgBrowser({ img, framesCacheRef }: ImgBrowser) {
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
        uiDispatch({
          type: UIActionType.SetBrowserElement,
          value: { value: { ...img }, type: "img" },
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
        justifyContent: "center",
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

interface SvgBrowser {
  svg: LaurusSvgResult;
  framesCacheRef: RefObject<Map<string, LaurusFrame[]>>;
}
function SvgBrowser({ svg, framesCacheRef }: SvgBrowser) {
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
    <>
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
    </>
  );
}
