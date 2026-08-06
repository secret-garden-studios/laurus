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
import { dellaRespira } from "../../fonts";
import { CoreContext, UIContext } from "../workspace.client";
import styles from "../../app.module.css";
import { publicIcon, refresh200, sort300, SvgRepo } from "../../svg-repo";
import { createImg, LaurusFrame, LaurusImgResult, LaurusSvgResult } from "../workspace.server";
import { updateProject, createProject, LaurusProjectResult } from "../../projects/projects.server";
import { LaurusTool, UIActionType, defaultMarqueeTool, defaultUIState } from "../states/ui-state";
import { CoreActionType } from "../states/core-state";
import { createAndRegisterSvg } from "../svg-upload-utils";
import MediaGroupBrowser, { MediaGroupSkeleton } from "./media-group-browser";
import ImgBrowser from "./img-browser";
import SvgBrowser from "./svg-browser";
import FrameBrowser from "./frame-browser";
import SelectionControlPanel from "./selection-control-panel";

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
          mediaSortSize: {
            container: 65,
            svg: 24,
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
          mediaGroup: {
            container: {
              padding: 30,
              gap: 30,
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
          mediaSortSize: {
            container: 60,
            svg: 20,
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
          mediaGroup: {
            container: {
              padding: 30,
              gap: 30,
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
          mediaSortSize: {
            container: 50,
            svg: 18,
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
          mediaGroup: {
            container: {
              padding: 30,
              gap: 30,
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
              const created = await createAndRegisterSvg(
                coreState.apiOrigin,
                coreState.accessToken,
                uiState,
                uiDispatch,
                file,
                svgString,
                width,
                height,
                file.name.split(".")[0],
              );
              if (created) {
                if (++actualSvgUploads == expectedSvgUploads) {
                  setMediaUploading(false);
                }
              } else {
                setMediaUploading(false);
              }
            } catch (err) {
              setMediaUploading(false);
              console.error("svg upload error", err);
            }
          };
          reader.readAsText(file);
        } else if (file.type.startsWith("image/")) {
          try {
            const created = await createImg(coreState.apiOrigin, coreState.accessToken, file);
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
                first: false,
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
            } else {
              setMediaUploading(false);
            }
          } catch (err) {
            setMediaUploading(false);
            console.error("img upload error", err);
          }
        }
      }
    },
    [coreState.apiOrigin, coreState.accessToken, uiState, uiDispatch],
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
        cursor: "default",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={handleUpload}
    >
      {/* content container */}
      <div
        style={{
          display: "grid",
          overflowY: "auto",
        }}
      >
        {/* uploading light */}
        {(() => {
          switch (uiState.mediaBrowserFilter) {
            case "frame":
              return <></>;
            case "group":
              return <></>;
            case "img":
            case "svg":
              return (
                <>
                  <div
                    style={{
                      display: "grid",
                      alignContent: "center",
                      justifyContent: "end",
                      position: "sticky",
                      top: 0,
                      right: 0.0,
                      ...dynamicSizes.uploadingLight.container,
                    }}
                  >
                    <div
                      title={"uploading light"}
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
                </>
              );
          }
        })()}
        {/* content body */}
        {(() => {
          switch (uiState.mediaBrowserFilter) {
            case "frame":
              return (
                <>
                  {uiState.browserFrames.map((frame, i) => {
                    return (
                      <div key={frame.svg.media_key}>
                        <FrameBrowser frame={frame} i={i} />
                      </div>
                    );
                  })}
                </>
              );
            case "group":
              return (
                <>
                  <div
                    style={{
                      display: "grid",
                      alignContent: coreState.mediaGroups.size == 0 ? "center" : "start",
                      width: "100%",
                      ...dynamicSizes.mediaGroup.container,
                    }}
                  >
                    {coreState.mediaGroups.size == 0 ? (
                      <MediaGroupSkeleton maxWidth={dynamicSizes.width} />
                    ) : (
                      Array.from(coreState.mediaGroups.entries())
                        .sort((a, b) => {
                          if (a[1].order !== b[1].order) {
                            return a[1].order - b[1].order;
                          }
                          return new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime();
                        })
                        .map(([mediaGroupId, mediaGroupResult]) => (
                          <div key={mediaGroupId}>
                            <MediaGroupBrowser
                              mediaGroupId={mediaGroupId}
                              mediaGroupResult={mediaGroupResult}
                              maxWidth={dynamicSizes.width}
                            />
                          </div>
                        ))
                    )}
                  </div>
                </>
              );
            case "img":
              return (
                <>
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
                    {sortBrowserMedia(uiState.browserImgs, mediaSort).map((media, i) => {
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
                  </div>
                </>
              );
            case "svg":
              return (
                <>
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
                    {sortBrowserMedia(uiState.browserSvgs, mediaSort).map((media, i) => {
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
                  </div>
                </>
              );
          }
        })()}
        {/* observer (auto refresh) */}
        {(() => {
          switch (uiState.mediaBrowserFilter) {
            case "frame":
              return <></>;
            case "group":
              return <></>;
            case "img":
            case "svg":
              return (
                <>
                  {publicIconSelected && (
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
                </>
              );
          }
        })()}
      </div>
      {/* input area */}
      {(() => {
        switch (uiState.mediaBrowserFilter) {
          case "frame":
            return <></>;
          case "group":
            return (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: dynamicSizes.mediaSortSize.container,
                    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(23, 23, 23, 1)",
                  }}
                >
                  <SelectionControlPanel />
                </div>
              </>
            );
          case "img":
          case "svg":
            return (
              <>
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
                        svg={
                          publicIconSelected ? publicIcon("rgb(220, 220, 220)") : publicIcon("rgba(255,255,255,0.2)")
                        }
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
              </>
            );
        }
      })()}
    </div>
  );
}
