import styles from "@/app/app.module.css";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { SvgRepo, cancelCircle, download, fileCopy, keep200, openInNew } from "../svg-repo";
import { CoreContext, UIContext } from "./projects.client";
import {
  createPin,
  deletePin,
  deleteProject,
  downloadProject,
  duplicateProject,
  LaurusPin,
  LaurusProjectResult,
} from "./projects.server";
import { CoreActionType } from "./states/core-state";
import { useRouter } from "next/navigation";

interface ContextMenuProps {
  project: LaurusProjectResult;
  width: number;
  height: number;
}
export default function ContextMenu({ project, width, height }: ContextMenuProps) {
  const { coreState, coreDispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const router = useRouter();
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          contextMenu: {
            widthFactor: 1,
            heightFactor: 1,
          },
          innerClipPath: {
            width: 8,
            height: 6,
            radius: 8,
            triangleRadius: 0,
            caretS: 10,
            caretHeight: 24,
          },
          clipPath: {
            width: 0,
            height: 0,
            radius: 8,
            triangleRadius: 0,
            caretS: 12,
            caretHeight: 30,
          },
          clipPathDiv: {
            top: 3,
            fontSize: 12,
            gap: 12,
            letterSpacing: 2,
          },
          clipPathDivSizeOffset: {
            width: 4,
            height: 4,
          },
          clipPathDivPadding: "14px 16px",
          clipPathDivLeft: 4,
          hDiv: {
            gap: 4,
          },
          h1: {
            fontSize: 18,
          },
          h2: {
            fontSize: 12,
          },
          toggle: {
            container: {
              padding: "20px 0px",
              gap: 12,
              fontSize: 13,
            },
          },
          cell: {
            fontSize: 13,
            gap: 12,
            height: 60,
          },
          footer: {
            div: {
              padding: 10,
              fontSize: 12,
            },
            svg: {
              width: 24,
              height: 24,
            },
          },
        };
      case "midhigh":
        return {
          contextMenu: {
            widthFactor: 1,
            heightFactor: 1,
          },
          innerClipPath: {
            width: 8,
            height: 6,
            radius: 8,
            triangleRadius: 0,
            caretS: 10,
            caretHeight: 24,
          },
          clipPath: {
            width: 0,
            height: 0,
            radius: 8,
            triangleRadius: 0,
            caretS: 12,
            caretHeight: 30,
          },
          clipPathDiv: {
            top: 3,
            fontSize: 12,
            gap: 6,
            letterSpacing: 2,
          },
          clipPathDivSizeOffset: {
            width: 4,
            height: 4,
          },
          clipPathDivPadding: "10px 12px",
          clipPathDivLeft: 4,
          hDiv: {
            gap: 4,
          },
          h1: {
            fontSize: 13,
          },
          h2: {
            fontSize: 10,
          },
          toggle: {
            container: {
              padding: "16px 0px",
              gap: 12,
              fontSize: 11,
            },
          },
          cell: {
            fontSize: 10,
            gap: 10,
            height: 55,
          },
          footer: {
            div: {
              padding: 6,
              fontSize: 10,
            },
            svg: {
              width: 18,
              height: 18,
            },
          },
        };
      case "midlow":
      case "low":
        return {
          contextMenu: {
            widthFactor: 1,
            heightFactor: 1,
          },
          innerClipPath: {
            width: 8,
            height: 6,
            radius: 8,
            triangleRadius: 0,
            caretS: 10,
            caretHeight: 24,
          },
          clipPath: {
            width: 0,
            height: 0,
            radius: 8,
            triangleRadius: 0,
            caretS: 12,
            caretHeight: 30,
          },
          clipPathDiv: {
            top: 3,
            fontSize: 12,
            gap: 6,
            letterSpacing: 2,
          },
          clipPathDivSizeOffset: {
            width: 4,
            height: 4,
          },
          clipPathDivPadding: "10px 12px",
          clipPathDivLeft: 4,
          hDiv: {
            gap: 4,
          },
          h1: {
            fontSize: 12,
          },
          h2: {
            fontSize: 10,
          },
          toggle: {
            container: {
              padding: "16px 0px",
              gap: 12,
              fontSize: 11,
            },
          },
          cell: {
            fontSize: 10,
            gap: 10,
            height: 55,
          },
          footer: {
            div: {
              padding: 8,
              fontSize: 10,
            },
            svg: {
              width: 18,
              height: 18,
            },
          },
        };
    }
  });

  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);

  const contextMenuWidth = useMemo(() => {
    return width * dynamicSizes.contextMenu.widthFactor;
  }, [dynamicSizes.contextMenu.widthFactor, width]);

  const contextMenuHeight = useMemo(() => {
    return height * dynamicSizes.contextMenu.heightFactor;
  }, [dynamicSizes.contextMenu.heightFactor, height]);

  const dynamicClipPathNoCaret = useMemo(() => {
    const getPath = (isInner: boolean) => {
      const w = isInner
        ? contextMenuWidth - dynamicSizes.innerClipPath.width
        : contextMenuWidth - dynamicSizes.clipPath.width;
      const h = isInner
        ? contextMenuHeight - dynamicSizes.innerClipPath.height
        : contextMenuHeight - dynamicSizes.clipPath.height;
      const r = isInner ? dynamicSizes.innerClipPath.radius : dynamicSizes.clipPath.radius;
      return `path('M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z')`;
    };
    return {
      outer: getPath(false),
      inner: getPath(true),
    };
  }, [
    contextMenuWidth,
    contextMenuHeight,
    dynamicSizes.innerClipPath.width,
    dynamicSizes.innerClipPath.height,
    dynamicSizes.innerClipPath.radius,
    dynamicSizes.clipPath.width,
    dynamicSizes.clipPath.height,
    dynamicSizes.clipPath.radius,
  ]);

  const onOpenClick = useCallback(() => {
    if (uiState.tool.type == "pin") return;
    if (toolbarContainerRef.current) {
      toolbarContainerRef.current.style.cursor = "wait";
    }
    router.push(`/workspace?project_id=${project.project_id}`);
  }, [project.project_id, router, uiState.tool.type]);

  const onDuplicateClick = useCallback(async () => {
    if (uiState.tool.type == "pin") return;
    const duplicate = await duplicateProject(coreState.apiOrigin, coreState.accessToken, project.project_id);
    if (duplicate) {
      const newProjects = [...coreState.projects, duplicate];
      coreDispatch({ type: CoreActionType.SetProjects, value: newProjects });
    }
  }, [
    coreDispatch,
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.projects,
    project.project_id,
    uiState.tool.type,
  ]);

  const onDownloadClick = useCallback(async () => {
    if (uiState.tool.type == "pin") return;
    const downloaded = await downloadProject(coreState.apiOrigin, coreState.accessToken, project.project_id);
    if (!downloaded) {
      console.error(`failed to download the project "${project.name}"`);
    }
  }, [coreState.accessToken, coreState.apiOrigin, project.name, project.project_id, uiState.tool.type]);

  const onDeleteClick = useCallback(async () => {
    if (uiState.tool.type == "pin") return;
    const confirmed = window.confirm(`Are you sure you want to delete "${project.name}"?`);
    if (confirmed) {
      const selectedProjectId = project.project_id;
      const deleted = await deleteProject(coreState.apiOrigin, coreState.accessToken, selectedProjectId);
      if (deleted) {
        coreDispatch({
          type: CoreActionType.SetProjects,
          value: coreState.projects.filter((p) => p.project_id != selectedProjectId),
        });
      }
    }
  }, [
    coreDispatch,
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.projects,
    project.name,
    project.project_id,
    uiState.tool.type,
  ]);

  const onContextMenuClick = useCallback(async () => {
    if (uiState.tool.type != "pin") return;
    const snapshot = new Map(coreState.pinsByProject);
    const pin = snapshot.get(project.project_id);
    if (!pin) {
      const newPin: LaurusPin = {
        project_id: project.project_id,
        pinned: true,
      };
      const created = await createPin(coreState.apiOrigin, coreState.accessToken, newPin);
      if (created) {
        snapshot.set(newPin.project_id, { ...created });
        coreDispatch({
          type: CoreActionType.SetPinByProject,
          value: { ...created },
        });
      }
    } else {
      const deleted = await deletePin(coreState.apiOrigin, coreState.accessToken, pin.pin_id);
      if (deleted) {
        snapshot.delete(pin.project_id);
        coreDispatch({
          type: CoreActionType.DeletePinByProject,
          projectId: pin.project_id,
        });
      }
    }
  }, [
    coreDispatch,
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.pinsByProject,
    project.project_id,
    uiState.tool.type,
  ]);

  const cursor = useMemo(() => {
    return uiState.tool.type == "pin" ? "crosshair" : "";
  }, [uiState.tool.type]);

  return (
    <>
      <div
        style={{
          display: "grid",
          height: "100%",
          gridTemplateColumns: `${contextMenuWidth}px`,
          gridTemplateRows: "auto",
          cursor,
        }}
        onClick={onContextMenuClick}
      >
        <div
          style={{
            gridColumn: 1,
            gridRow: 1,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: contextMenuWidth,
              height: contextMenuHeight,
              backdropFilter: "blur(10px)",
              background: "rgba(255, 255, 255, 0.06)",
              clipPath: dynamicClipPathNoCaret.outer,
              overflow: "hidden",
              display: "grid",
            }}
          />
          <div
            style={{
              clipPath: dynamicClipPathNoCaret.inner,
              position: "absolute",
              background: "rgba(0, 0, 0, 0.37)",
              display: "grid",
              gridTemplateColumns: "1fr",
              gridTemplateRows: "min-content min-content min-content auto min-content",
              textAlign: "left",
              whiteSpace: "nowrap",
              textWrap: "nowrap",
              padding: dynamicSizes.clipPathDivPadding,
              left: dynamicSizes.clipPathDivLeft,
              width: contextMenuWidth - dynamicSizes.clipPathDivSizeOffset.width,
              height: contextMenuHeight - dynamicSizes.clipPathDivSizeOffset.height,
              ...dynamicSizes.clipPathDiv,
            }}
          >
            <div style={{ display: "grid", ...dynamicSizes.hDiv }}>
              <div
                style={{
                  overflowX: "auto",
                  fontWeight: "bold",
                  ...dynamicSizes.h1,
                }}
              >
                {project.name}
              </div>
              <div
                title="description"
                style={{
                  overflowX: "auto",
                  display: "flex",
                  ...dynamicSizes.h2,
                }}
              >
                {`edited ${new Date(project.last_active).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })} by ${project.last_editor}`}
              </div>
            </div>
            {/* project stats */}
            <div style={{ display: "grid" }}>
              <div
                style={{
                  display: "flex",
                  ...dynamicSizes.toggle.container,
                }}
              >
                <div style={{ display: "flex", gap: "1ch" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      textShadow: "0 0 1px rgba(255, 255, 255, 1)",
                    }}
                  >
                    {`${[...project.imgs.values()].length}`}
                  </div>
                  <div>{`img`}</div>
                </div>
                <div style={{ display: "flex", gap: "1ch" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      textShadow: "0 0 1px rgba(255, 255, 255, 1)",
                    }}
                  >
                    {`${[...project.svgs.values()].length}`}
                  </div>
                  <div>{`svg`}</div>
                </div>
                <div style={{ display: "flex", gap: "1ch" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      textShadow: "0 0 1px rgba(255, 255, 255, 1)",
                    }}
                  >
                    {`${coreState.effectsMetadata.get(project.project_id) ?? 0}`}
                  </div>
                  <div>{`fx`}</div>
                </div>
              </div>
            </div>
            {/* toolbar */}
            <div
              ref={toolbarContainerRef}
              style={{
                display: "grid",
                overflowY: "auto",
                alignSelf: "start",
                height: dynamicSizes.cell.height * 3,
                cursor: "pointer",
              }}
            >
              <div
                className={styles[uiState.tool.type == "pin" ? "" : "animated-nav-dark"]}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderTop: "none",
                  ...dynamicSizes.cell,
                }}
                onClick={onOpenClick}
              >
                <SvgRepo
                  title="open project"
                  svg={openInNew("rgba(255, 255, 255, 0.81)")}
                  containerStyle={{
                    ...dynamicSizes.footer.svg,
                  }}
                  scale={0.9}
                  scaleToContaier={true}
                />
                <div>{"open"}</div>
              </div>
              <div
                className={styles[uiState.tool.type == "pin" ? "" : "animated-nav-dark"]}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  ...dynamicSizes.cell,
                }}
                onClick={onDuplicateClick}
              >
                <SvgRepo
                  title="duplicate project"
                  svg={fileCopy()}
                  containerStyle={{
                    ...dynamicSizes.footer.svg,
                  }}
                  scale={0.8}
                  scaleToContaier={true}
                />
                <div>{"duplicate"}</div>
              </div>
              <div
                className={styles[uiState.tool.type == "pin" ? "" : "animated-nav-dark"]}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  ...dynamicSizes.cell,
                }}
                onClick={onDownloadClick}
              >
                <SvgRepo
                  title="download project"
                  svg={download()}
                  containerStyle={{
                    ...dynamicSizes.footer.svg,
                  }}
                  scale={1}
                  scaleToContaier={true}
                />
                <div>{"download"}</div>
              </div>
              <div
                className={styles[uiState.tool.type == "pin" ? "" : "animated-nav-dark"]}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  ...dynamicSizes.cell,
                }}
                onClick={onDeleteClick}
              >
                <SvgRepo
                  title="delete project"
                  svg={cancelCircle("rgb(220, 112, 112)")}
                  containerStyle={{
                    ...dynamicSizes.footer.svg,
                  }}
                  scale={0.9}
                  scaleToContaier={true}
                />
                <div>{"delete"}</div>
              </div>
            </div>
            <div />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: "100%",
                ...dynamicSizes.footer.div,
              }}
            >
              <SvgRepo
                svg={keep200(
                  coreState.pinsByProject.get(project.project_id)?.pinned
                    ? "rgb(227, 227, 227)"
                    : "rgba(255,255,255,0)",
                )}
                scale={1.25}
                containerStyle={{ ...dynamicSizes.footer.svg }}
                scaleToContaier={true}
              />
              <div style={{ textShadow: "none" }}>
                {`created ${new Date(project.timestamp).toLocaleString("en-US", { dateStyle: "short" })} by ${project.creator}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
