import { CSSProperties, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import styles from "../app.module.css";
import { dellaRespira } from "../fonts";
import {
  addCircle,
  adjust,
  allOut,
  circle,
  closeIcon,
  earthquake,
  LaurusClientSvg,
  playArrow,
  skipNext,
  skipPrevious,
  stopIcon,
  SvgRepo,
  cycle400,
  asterisk300,
  skew400,
} from "../svg-repo";
import { CoreContext, HoverContext, UIContext } from "./workspace.client";
import {
  createEffectGroup,
  createLightSource,
  createMove,
  createRotate,
  createSkew,
  createScale,
  deleteEffectGroup,
  LaurusEffect,
  LaurusEffectGroup,
  LaurusEffectGroupResult,
  LaurusLightSource,
  LaurusMixState,
  LaurusMove,
  LaurusRotate,
  LaurusSkew,
  LaurusScale,
  updateEffectGroup,
  updateLightSource,
  updateMove,
  updateRotate,
  updateSkew,
  updateScale,
} from "./workspace.server";
import EffectUnit from "./units/effect-unit";
import { WorkspaceResolution } from "./workspace.config";
import { updateProject, createProject, LaurusProjectResult } from "../projects/projects.server";
import Toggle from "../components/toggle";
import { CoreActionType } from "./states/core-state";
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { beginBodyDragCursor, endBodyDragCursor, isAnyDragActive } from "./hooks/useToolCursor";

function reindexEffectGroups(effectGroups: Map<string, LaurusEffectGroupResult>): LaurusEffectGroupResult[] {
  return Array.from(effectGroups.values())
    .sort((a, b) => a.order - b.order || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((g, i) => ({ ...g, order: i }));
}

async function persistReindexedGroups(
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  reindexedGroups: LaurusEffectGroupResult[],
  previousGroups: Map<string, LaurusEffectGroupResult>,
) {
  const updates = reindexedGroups.filter((ng) => {
    const og = previousGroups.get(ng.effect_group_id);
    return !og || og.order !== ng.order;
  });
  for (const group of updates) {
    await updateEffectGroup(apiOrigin, accessToken, group.effect_group_id, group);
  }
}

function reindexEffects(effects: LaurusEffect[], effectGroups: Map<string, LaurusEffectGroupResult>): LaurusEffect[] {
  const sortedGroups = Array.from(effectGroups.values()).sort(
    (a, b) => a.order - b.order || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const groupOrderMap = new Map(sortedGroups.map((g, index) => [g.effect_group_id, index]));

  return [...effects]
    .sort((a, b) => {
      const groupOrderA = groupOrderMap.get(a.value.effect_group_id) ?? -1;
      const groupOrderB = groupOrderMap.get(b.value.effect_group_id) ?? -1;

      if (groupOrderA !== groupOrderB) {
        return groupOrderA - groupOrderB;
      }

      return (
        a.value.order - b.value.order || new Date(a.value.timestamp).getTime() - new Date(b.value.timestamp).getTime()
      );
    })
    .map((e, i) => ({ ...e, value: { ...e.value, order: i } }) as LaurusEffect);
}

async function persistReindexedEffects(
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  reindexedEffects: LaurusEffect[],
  previousEffects: LaurusEffect[],
) {
  const updates = reindexedEffects.filter((ne) => {
    const oe = previousEffects.find((e) => e.key === ne.key);
    return !oe || oe.value.effect_group_id !== ne.value.effect_group_id || oe.value.order !== ne.value.order;
  });
  let updateCount = 0;
  for (const effect of updates) {
    switch (effect.type) {
      case "scale": {
        const updatedScale = await updateScale(apiOrigin, accessToken, effect.key, effect.value);
        if (updatedScale) updateCount++;
        break;
      }
      case "move": {
        const updatedMove = await updateMove(apiOrigin, accessToken, effect.key, effect.value);
        if (updatedMove) updateCount++;
        break;
      }
      case "rotate": {
        const updatedRotate = await updateRotate(apiOrigin, accessToken, effect.key, effect.value);
        if (updatedRotate) updateCount++;
        break;
      }
      case "skew": {
        const updatedSkew = await updateSkew(apiOrigin, accessToken, effect.key, effect.value);
        if (updatedSkew) updateCount++;
        break;
      }
      case "light_source": {
        const updatedLightSource = await updateLightSource(apiOrigin, accessToken, effect.key, effect.value);
        if (updatedLightSource) updateCount++;
        break;
      }
    }
  }
  return updateCount > 0 ? updateCount == updates.length : false;
}

export default function TimelineArea() {
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { selectedEffectUnitKeys } = useContext(HoverContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return { width: 1000 };
      case "midhigh":
        return { width: 754 };
      case "midlow":
      case "low":
        return { width: 600 };
    }
  });

  const [showSelectionPanel, setShowSelectionPanel] = useState(false);
  const selectionPanelVisible = useMemo(() => {
    return selectedEffectUnitKeys.size > 0 || showSelectionPanel;
  }, [selectedEffectUnitKeys.size, showSelectionPanel]);
  const [isTimelineAreaHovered, setIsTimelineAreaHovered] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSelectionPanel(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [coreState.project.imgs, coreState.project.svgs, uiState.tool.type]);

  return (
    <>
      <div
        className={
          styles[`${uiState.resolution.type == "high" ? "noisy-background-20-2" : "noisy-background-20-2-low-res"}`]
        }
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gridTemplateRows: `min-content auto min-content`,
        }}
        onMouseEnter={() => setIsTimelineAreaHovered(true)}
        onMouseLeave={() => setIsTimelineAreaHovered(false)}
      >
        <TimelineRuler
          containerStyle={{
            gridRow: "1",
            gridColumn: "span 2",
          }}
        />
        <div
          style={{
            overflowX: "hidden",
            overflowY: "auto",
            gridRow: "2",
            gridColumn: "1",
            display: "grid",
            alignContent: "start",
            ...dynamicSizes,
          }}
        >
          {coreState.effectGroups.size == 0 ? (
            <EffectGroupSkeleton maxWidth={dynamicSizes.width} />
          ) : (
            <>
              {Array.from(coreState.effectGroups.entries())
                .sort((a, b) => {
                  if (a[1].order !== b[1].order) {
                    return a[1].order - b[1].order;
                  }
                  return new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime();
                })
                .map((groupEntry) => {
                  const [effectGroupId, effectGroup] = groupEntry;
                  return (
                    <div key={effectGroupId}>
                      <EffectGroup
                        effectGroupId={effectGroupId}
                        effectGroupResult={effectGroup}
                        maxWidth={dynamicSizes.width}
                        isTimelineAreaHovered={isTimelineAreaHovered}
                      />
                    </div>
                  );
                })}
            </>
          )}
        </div>
        <div
          style={{
            width: 1,
            display: "grid",
            placeContent: "center",
            background: "rgba(255, 255, 255, 0.05)",
          }}
        />
        <div
          style={{
            gridRow: "3",
            gridColumn: "span 2",
            display: "grid",
            alignContent: "space-between",
          }}
        >
          {selectionPanelVisible ? (
            <SelectionControlPanel />
          ) : (
            <ControlPanel onSwitchViews={() => setShowSelectionPanel(true)} />
          )}
        </div>
      </div>
    </>
  );
}

interface TimelineRuler {
  containerStyle?: CSSProperties;
}
function TimelineRuler({ containerStyle }: TimelineRuler) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [rulerSize] = useState(20);
  function calculateRuler(timelineMaxValue: number, resolution: WorkspaceResolution) {
    switch (resolution.type) {
      case "high": {
        switch (timelineMaxValue) {
          case 15: {
            return { modulo: 10, factor: 0.25, ticks: 61 };
          }
          default:
          case 30: {
            return { modulo: 10, factor: 0.5, ticks: 61 };
          }
          case 60: {
            return { modulo: 10, factor: 1, ticks: 61 };
          }
          case 90: {
            return { modulo: 10, factor: 1.5, ticks: 61 };
          }
        }
      }
      case "midhigh": {
        switch (timelineMaxValue) {
          case 15: {
            return { modulo: 5, factor: 0.5, ticks: 31 };
          }
          default:
          case 30: {
            return { modulo: 5, factor: 1, ticks: 31 };
          }
          case 60: {
            return { modulo: 5, factor: 2, ticks: 31 };
          }
          case 90: {
            return { modulo: 5, factor: 3, ticks: 31 };
          }
        }
      }
      case "midlow":
      case "low": {
        switch (timelineMaxValue) {
          case 15: {
            return { modulo: 1, factor: 2.5, ticks: 7 };
          }
          default:
          case 30: {
            return { modulo: 1, factor: 5, ticks: 7 };
          }
          case 60: {
            return { modulo: 1, factor: 10, ticks: 7 };
          }
          case 90: {
            return { modulo: 1, factor: 15, ticks: 7 };
          }
        }
      }
    }
  }
  const [rulerParams, setRulerParams] = useState(() => calculateRuler(coreState.timelineMaxValue, uiState.resolution));
  return (
    <div
      style={{
        display: "flex",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        borderBottom: "1px solid rgba(255,255,255,0.15)",
        borderRight: "1px solid rgba(255,255,255,0.15)",
        height: rulerSize,
        ...containerStyle,
      }}
    >
      <div
        style={{
          padding: (() => {
            switch (uiState.resolution.type) {
              case "high":
                return "0px 16px 0px 32px";
              case "midhigh":
                return "0px 12px 0px 28px";
              case "midlow":
              case "low":
                return "0px 10px 0px 26px";
            }
          })(),
          fontSize: 10,
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          background: "rgba(46,46,46,1)",
        }}
        onDoubleClick={() => {
          if (uiState.playbackMode.type !== "stopped") return;
          const currentTimelineValues = [...uiState.timelineValues];
          const currentIndex = currentTimelineValues.findIndex((v) => v == coreState.timelineMaxValue);
          const newValue: number =
            currentIndex >= 0 && currentIndex + 1 < currentTimelineValues.length
              ? currentTimelineValues[currentIndex + 1]
              : currentTimelineValues[0];
          setRulerParams(calculateRuler(newValue, uiState.resolution));
          dispatch({
            type: CoreActionType.SetTimelineMaxValue,
            value: newValue,
          });
        }}
      >
        {[...Array(rulerParams.ticks)].map((_, i) => {
          return (
            <div key={i}>
              {i % rulerParams.modulo == 0 ? (
                <div
                  style={{
                    paddingLeft: 2,
                    width: 10,
                    height: "75%",
                    borderLeft: `1px solid ${"rgb(72, 72, 72)"}`,
                  }}
                >
                  {`${i * rulerParams.factor}`}
                </div>
              ) : (
                <div
                  style={{
                    height: "50%",
                    width: 10,
                    borderLeft: `1px solid ${"rgb(72, 72, 72)"}`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          fontSize: 12,
          textAlign: "center",
          position: "relative",
          width: 38,
          backgroundColor: "rgb(33, 33, 33)",
          color: "rgb(255, 255, 255)",
        }}
        onDoubleClick={() => {
          if (uiState.playbackMode.type !== "stopped") return;
          const currentUnit = coreState.timelineUnit;
          const currentUnits = [...uiState.timelineUnits];
          const currentIndex = currentUnits.findIndex((v) => v == currentUnit);
          const newUnit: string =
            currentIndex >= 0 && currentIndex + 1 < currentUnits.length
              ? currentUnits[currentIndex + 1]
              : currentUnits[0];
          dispatch({ type: CoreActionType.SetTimelineUnit, value: newUnit });
        }}
      >
        {(() => {
          return (
            <>
              <div style={{ position: "absolute", width: "100%", height: "100%" }}>{coreState.timelineUnit}</div>
              <div style={{ position: "absolute", width: "100%", height: "100%" }} />
            </>
          );
        })()}
      </div>
    </div>
  );
}

interface EffectGroup {
  effectGroupId: string;
  effectGroupResult: LaurusEffectGroupResult;
  maxWidth: number;
  isTimelineAreaHovered: boolean;
}
function EffectGroup({ effectGroupId, effectGroupResult, maxWidth, isTimelineAreaHovered }: EffectGroup) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { setMostRecentlyEnteredEffectUnitKey, setSelectedEffectUnitKeys, selectedEffectUnitKeys, isAltKeyPressed } =
    useContext(HoverContext);
  const [effectsBrowserToggle, setEffectsBrowserToggle] = useState(false);
  const [updating, setUpdating] = useState(false);
  const showEffectsBrowser = useMemo(() => {
    return effectsBrowserToggle && selectedEffectUnitKeys.size === 0;
  }, [effectsBrowserToggle, selectedEffectUnitKeys.size]);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          timelineAreaContent: {
            height: 40,
            padding: "0px 8px",
            svg: { width: 20, height: 40 },
          },
          indexColumn: {
            width: "4ch",
            fontSize: 9,
          },
        };
      case "midhigh":
        return {
          timelineAreaContent: {
            height: 32,
            padding: "0px 6px",
            svg: { width: 16, height: 32 },
          },
          indexColumn: {
            width: "4ch",
            fontSize: 7,
          },
        };
      case "midlow":
      case "low":
        return {
          timelineAreaContent: {
            height: 32,
            padding: "0px 6px",
            svg: { width: 16, height: 32 },
          },
          indexColumn: {
            width: "4ch",
            fontSize: 7,
          },
        };
    }
  });

  const onEffectsBrowserExpandClick = useCallback(async () => {
    if (updating || uiState.playbackMode.type !== "stopped") return;
    if (selectedEffectUnitKeys.size > 0) {
      setUpdating(true);
      try {
        const snapshot = [...coreState.effects];
        const effectsWithNewGroups = snapshot.map((e) => {
          if (selectedEffectUnitKeys.has(e.key)) {
            return {
              ...e,
              value: { ...e.value, effect_group_id: effectGroupId },
            } as LaurusEffect;
          }
          return e;
        });
        const reindexedEffects = reindexEffects(effectsWithNewGroups, coreState.effectGroups);
        const updated = await persistReindexedEffects(
          coreState.apiOrigin,
          coreState.accessToken,
          reindexedEffects,
          snapshot,
        );
        if (updated) {
          dispatch({
            type: CoreActionType.SetEffects,
            value: reindexedEffects,
          });
          setSelectedEffectUnitKeys(new Set<string>());
        }
      } catch (error) {
        console.error("Failed to update effect groups:", error);
      } finally {
        setUpdating(false);
      }
    } else {
      setEffectsBrowserToggle((v) => !v);
    }
  }, [
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.effectGroups,
    coreState.effects,
    dispatch,
    effectGroupId,
    selectedEffectUnitKeys,
    setSelectedEffectUnitKeys,
    uiState.playbackMode.type,
    updating,
  ]);

  const groupEffects = useMemo(() => {
    return coreState.effects
      .filter((e) => e.value.effect_group_id === effectGroupId)
      .sort((a, b) => {
        if (a.value.order !== b.value.order) {
          return a.value.order - b.value.order;
        }
        return new Date(a.value.timestamp).getTime() - new Date(b.value.timestamp).getTime();
      });
  }, [coreState.effects, effectGroupId]);

  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onEffectDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || uiState.playbackMode.type !== "stopped") return;
      const oldIndex = groupEffects.findIndex((e) => e.key === active.id);
      const newIndex = groupEffects.findIndex((e) => e.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reorderedGroupEffects = arrayMove(groupEffects, oldIndex, newIndex).map(
        (e, i) => ({ ...e, value: { ...e.value, order: i } }) as LaurusEffect,
      );
      const snapshot = [...coreState.effects];
      const mergedEffects = snapshot.map((e) => reorderedGroupEffects.find((re) => re.key === e.key) ?? e);
      const reindexedEffects = reindexEffects(mergedEffects, coreState.effectGroups);
      dispatch({ type: CoreActionType.SetEffects, value: reindexedEffects });
      persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexedEffects, snapshot).then(
        (updated) => {
          if (!updated) {
            dispatch({ type: CoreActionType.SetEffects, value: snapshot });
          }
        },
      );
    },
    [
      groupEffects,
      coreState.effects,
      coreState.effectGroups,
      coreState.apiOrigin,
      coreState.accessToken,
      dispatch,
      uiState.playbackMode.type,
    ],
  );

  return (
    <div
      style={{
        maxWidth,
        display: "grid",
        width: "100%",
        gridTemplateRows: "min-content auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          background: "linear-gradient(10deg, rgb(25, 25, 25), rgb(23, 23, 23))",
        }}
      >
        <EffectGroupTitlebar effectGroupId={effectGroupId} effectGroupResult={effectGroupResult} />
      </div>
      <div
        style={{
          display: "grid",
          alignContent: "start",
          minHeight: dynamicSizes.timelineAreaContent.height,
        }}
      >
        <DndContext
          sensors={dragSensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={beginBodyDragCursor}
          onDragEnd={(e) => {
            endBodyDragCursor();
            onEffectDragEnd(e);
          }}
        >
          <SortableContext items={groupEffects.map((e) => e.key)} strategy={verticalListSortingStrategy}>
            {groupEffects.map((effect, index) => (
              <EffectGroupRow
                key={effect.key}
                effect={effect}
                index={index}
                isSelected={selectedEffectUnitKeys.has(effect.key)}
                isAltKeyPressed={isAltKeyPressed}
                dragDisabled={uiState.playbackMode.type !== "stopped"}
                indexColumnStyle={dynamicSizes.indexColumn}
                effectGroupResult={effectGroupResult}
                onToggleSelect={() =>
                  setSelectedEffectUnitKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(effect.key)) next.delete(effect.key);
                    else next.add(effect.key);
                    return next;
                  })
                }
                onEnter={() => setMostRecentlyEnteredEffectUnitKey(effect.key)}
              />
            ))}
          </SortableContext>
        </DndContext>
        <div
          style={{
            width: "100%",
            padding: dynamicSizes.timelineAreaContent.padding,
            background: showEffectsBrowser ? "rgba(255,255,255, 0.01)" : "none",
            border: showEffectsBrowser ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0)",
            display: "flex",
            justifyContent: showEffectsBrowser ? "start" : "start",
            cursor: updating ? "wait" : "",
          }}
        >
          {!isAltKeyPressed && !updating && isTimelineAreaHovered ? (
            <SvgRepo
              title={`${showEffectsBrowser ? "close effects browser" : selectedEffectUnitKeys.size > 0 ? "add to group" : "open effects browser"}`}
              svg={showEffectsBrowser ? closeIcon("rgba(204, 204, 204, 0.8)") : addCircle("rgba(204, 204, 204, 0.8)")}
              containerStyle={{
                width: dynamicSizes.timelineAreaContent.svg.width,
                height: dynamicSizes.timelineAreaContent.svg.height,
                cursor: uiState.playbackMode.type !== "stopped" ? "" : "pointer",
              }}
              scale={1}
              scaleToContaier={true}
              onContainerClick={onEffectsBrowserExpandClick}
            />
          ) : (
            <SvgRepo
              svg={addCircle("rgb(67, 67, 67)")}
              containerStyle={{
                width: dynamicSizes.timelineAreaContent.svg.width,
                height: dynamicSizes.timelineAreaContent.svg.height,
              }}
              scale={1}
              scaleToContaier={true}
            />
          )}
        </div>
        {showEffectsBrowser && (
          <EffectsBrowser onAddClick={() => setEffectsBrowserToggle(false)} effect_group_id={effectGroupId} />
        )}
      </div>
    </div>
  );
}

interface EffectGroupRow {
  effect: LaurusEffect;
  index: number;
  isSelected: boolean;
  isAltKeyPressed: boolean;
  dragDisabled: boolean;
  indexColumnStyle: { width: string; fontSize: number };
  effectGroupResult: LaurusEffectGroupResult;
  onToggleSelect: () => void;
  onEnter: () => void;
}
function EffectGroupRow({
  effect,
  index,
  isSelected,
  isAltKeyPressed,
  dragDisabled,
  indexColumnStyle,
  effectGroupResult,
  onToggleSelect,
  onEnter,
}: EffectGroupRow) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: effect.key,
    disabled: dragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (e.altKey) onToggleSelect();
      }}
      onMouseEnter={() => {
        if (isAnyDragActive()) return;
        onEnter();
      }}
      className={styles["effect-group-row"]}
      data-selected={isSelected ? "" : undefined}
      style={{
        display: "flex",
        borderRadius: 0,
        cursor: isAltKeyPressed ? "crosshair" : "",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          height: "100%",
          background: "rgba(22, 22, 22, 0.9)",
          display: "grid",
          placeContent: "center",
          cursor: dragDisabled ? "" : "grab",
          touchAction: "none",
          width: indexColumnStyle.width,
          fontSize: indexColumnStyle.fontSize,
        }}
      >
        {(index + 1).toFixed()}
      </div>
      <EffectUnit effect={effect} showUnitControlsInit={!effectGroupResult.disabled} />
    </div>
  );
}

interface EffectGroupSkeleton {
  maxWidth: number;
}
function EffectGroupSkeleton({ maxWidth }: EffectGroupSkeleton) {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          timelineAreaContent: {
            padding: "0px 8px",
            svg: { width: 20, height: 40 },
          },
        };
      case "midhigh":
        return {
          timelineAreaContent: {
            padding: "0px 6px",
            svg: { width: 16, height: 32 },
          },
        };
      case "midlow":
      case "low":
        return {
          timelineAreaContent: {
            padding: "0px 6px",
            svg: { width: 16, height: 32 },
          },
        };
    }
  });

  const [showEffectsBrowser, setShowEffectsBrowser] = useState(false);

  return (
    <>
      <div
        style={{
          maxWidth,
          display: "grid",
          width: "100%",
          gridTemplateRows: "min-content auto",
        }}
      >
        <div
          style={{
            display: "grid",
            alignContent: "start",
            minHeight: 46,
          }}
        >
          <div
            style={{
              width: "100%",
              padding: dynamicSizes.timelineAreaContent.padding,
              background: showEffectsBrowser ? "rgba(255,255,255, 0.01)" : "none",
              border: showEffectsBrowser ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0)",
              display: "flex",
              justifyContent: showEffectsBrowser ? "start" : "end",
            }}
          >
            <SvgRepo
              title={`${showEffectsBrowser ? "close effects browser" : "open effects browser"}`}
              svg={showEffectsBrowser ? closeIcon("rgba(204, 204, 204, 0.8)") : addCircle("rgba(204, 204, 204, 0.8)")}
              containerStyle={{
                width: dynamicSizes.timelineAreaContent.svg.width,
                height: dynamicSizes.timelineAreaContent.svg.height,
              }}
              scale={1}
              scaleToContaier={true}
              onContainerClick={() => setShowEffectsBrowser((v) => !v)}
            />
          </div>
          {showEffectsBrowser && (
            <EffectsBrowser onAddClick={() => setShowEffectsBrowser(false)} effect_group_id={""} />
          )}
        </div>
      </div>
    </>
  );
}

interface EffectGroupTitlebar {
  effectGroupId: string;
  effectGroupResult: LaurusEffectGroupResult;
}
function EffectGroupTitlebar({ effectGroupId, effectGroupResult }: EffectGroupTitlebar) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { isAltKeyPressed, setSelectedEffectUnitKeys } = useContext(HoverContext);
  const [isTitleBarHovered, setIsTitleBarHovered] = useState(false);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          flex: {
            height: 32,
            paddingLeft: 0,
          },
          input: {
            fontSize: 10,
          },
          svg: {
            width: 24,
            height: 32,
          },
          toggle: {
            div: {
              paddingLeft: 6,
              paddingRight: 10,
              gap: 0,
              fontSize: 10,
            },
            track: {
              width: 22,
              height: 10,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 6,
              height: 6,
            },
            translateX: 12,
          },
          delete: {
            container: {
              width: 40,
              height: 32,
            },
            button: {
              width: 10,
              height: 10,
            },
          },
        };
      case "midhigh":
        return {
          flex: {
            height: 24,
            paddingLeft: 0,
          },
          input: {
            fontSize: 8,
          },
          svg: {
            width: 19,
            height: 24,
          },
          toggle: {
            div: {
              paddingLeft: 6,
              paddingRight: 6,
              gap: 0,
              fontSize: 10,
            },
            track: {
              width: 18,
              height: 8,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 5,
              height: 5,
            },
            translateX: 9,
          },
          delete: {
            container: {
              width: 36,
              height: 24,
            },
            button: {
              width: 12,
              height: 12,
            },
          },
        };
      case "midlow":
      case "low":
        return {
          flex: {
            height: 24,
            paddingLeft: 0,
          },
          input: {
            fontSize: 8,
          },
          svg: {
            width: 19,
            height: 24,
          },
          toggle: {
            div: {
              paddingLeft: 6,
              paddingRight: 6,
              gap: 0,
              fontSize: 10,
            },
            track: {
              width: 18,
              height: 8,
              borderRadius: 10,
              padding: 1,
            },
            button: {
              width: 5,
              height: 5,
            },
            translateX: 9,
          },
          delete: {
            container: {
              width: 30,
              height: 24,
            },
            button: {
              width: 10,
              height: 10,
            },
          },
        };
    }
  });
  const effectGroupDescriptionRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onEffectGroupDescriptionChange = useCallback(
    (newValue: string) => {
      const snapshot = { ...effectGroupResult };
      const newEffectGroup: LaurusEffectGroupResult = {
        ...snapshot,
        description: newValue,
      };
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        updateEffectGroup(coreState.apiOrigin, coreState.accessToken, effectGroupId, newEffectGroup).then((updated) => {
          if (!updated) {
            dispatch({ type: CoreActionType.SetEffectGroup, value: snapshot, preserveCache: true });
            const inputEl = effectGroupDescriptionRef.current;
            if (inputEl) {
              inputEl.value = snapshot.description;
            }
          } else {
            dispatch({
              type: CoreActionType.SetEffectGroup,
              value: newEffectGroup,
              preserveCache: true,
            });
          }
        });
      }, 1000);
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch, effectGroupId, effectGroupResult],
  );

  const deleteEffectGroupClick = useCallback(async () => {
    setIsTitleBarHovered(false);
    if (!isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
    const confirmed = confirm("are you sure you want to delete this effect group?");
    if (!confirmed) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const deleted = await deleteEffectGroup(coreState.apiOrigin, coreState.accessToken, effectGroupId);
    if (deleted) {
      const localEffectGroups = new Map(coreState.effectGroups);
      localEffectGroups.delete(effectGroupId);
      const reindexedGroups = reindexEffectGroups(localEffectGroups);
      await persistReindexedGroups(coreState.apiOrigin, coreState.accessToken, reindexedGroups, coreState.effectGroups);
      const reindexedGroupsMap = new Map(reindexedGroups.map((g) => [g.effect_group_id, g]));
      const snapshot = [...coreState.effects];
      const remainingEffects = snapshot.filter((e) => e.value.effect_group_id !== effectGroupId);
      const reindexedEffects = reindexEffects(remainingEffects, reindexedGroupsMap);
      await persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexedEffects, remainingEffects);
      dispatch({ type: CoreActionType.DeleteEffectGroup, key: effectGroupId });
      reindexedGroups.forEach((g) => dispatch({ type: CoreActionType.SetEffectGroup, value: g }));
      dispatch({ type: CoreActionType.SetEffects, value: reindexedEffects });
      setSelectedEffectUnitKeys((prev) => {
        const next = new Set(prev);
        snapshot.filter((e) => e.value.effect_group_id === effectGroupId).forEach((e) => next.delete(e.key));
        return next;
      });
    }
  }, [
    coreState.accessToken,
    coreState.apiOrigin,
    coreState.effectGroups,
    coreState.effects,
    dispatch,
    effectGroupId,
    isAltKeyPressed,
    setSelectedEffectUnitKeys,
    uiState.playbackMode.type,
  ]);

  const onToggleClick = useCallback(async () => {
    if (uiState.playbackMode.type !== "stopped") return;
    const newEffectGroup: LaurusEffectGroupResult = {
      ...effectGroupResult,
      disabled: !effectGroupResult.disabled,
    };
    const updated = await updateEffectGroup(coreState.apiOrigin, coreState.accessToken, effectGroupId, newEffectGroup);
    if (updated) {
      dispatch({ type: CoreActionType.SetEffectGroup, value: newEffectGroup });
    }
  }, [
    coreState.accessToken,
    coreState.apiOrigin,
    dispatch,
    effectGroupId,
    effectGroupResult,
    uiState.playbackMode.type,
  ]);

  useEffect(() => {
    const inputEl = effectGroupDescriptionRef.current;
    if (inputEl) {
      inputEl.value = effectGroupResult.description;
    }
  }, [effectGroupResult.description]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.025)",
        borderRadius: 0,
        ...dynamicSizes.flex,
      }}
      onMouseEnter={() => setIsTitleBarHovered(true)}
      onMouseLeave={() => setIsTitleBarHovered(false)}
    >
      <SvgRepo
        title={"delete effect group"}
        svg={isAltKeyPressed && isTitleBarHovered ? circle("rgb(220, 112, 112)") : circle("rgba(255, 255, 255, 0.05)")}
        scale={0.4}
        scaleToContaier={true}
        onContainerClick={deleteEffectGroupClick}
        style={{
          cursor: isAltKeyPressed && isTitleBarHovered && uiState.playbackMode.type == "stopped" ? "pointer" : "",
        }}
        containerStyle={{
          cursor: "",
          ...dynamicSizes.delete.container,
        }}
      />
      <input
        id={`effect-group-description-input-${effectGroupId}`}
        ref={effectGroupDescriptionRef}
        className={dellaRespira.className}
        disabled={uiState.playbackMode.type !== "stopped" ? true : false}
        placeholder="name me..."
        style={{
          textAlign: "center",
          letterSpacing: "3px",
          background: "none",
          color: "rgb(227, 227, 227)",
          border: "none",
          outline: "none",
          width: "100%",
          ...dynamicSizes.input,
        }}
        type="text"
        autoComplete="off"
        onChange={(e) => onEffectGroupDescriptionChange(e.target.value)}
      />
      <div
        title="enable effect group"
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          ...dynamicSizes.toggle.div,
        }}
      >
        <Toggle
          value={!effectGroupResult.disabled}
          onClick={onToggleClick}
          trackStyles={{
            cursor: uiState.playbackMode.type !== "stopped" ? "" : "pointer",
            ...dynamicSizes.toggle.track,
          }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
    </div>
  );
}

interface EffectsBrowser {
  effect_group_id: string;
  onAddClick: () => void;
}
function EffectsBrowser({ effect_group_id, onAddClick }: EffectsBrowser) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [effectBrowserSize] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          height: 96,
          itemFontSize: 14,
          itemHeight: 36,
          itemPadding: 10,
          svg: 20,
        };
      case "midhigh":
        return {
          height: 96,
          itemFontSize: 12,
          itemHeight: 36,
          itemPadding: 10,
          svg: 16,
        };
      case "midlow":
      case "low":
        return {
          height: 96,
          itemFontSize: 10,
          itemHeight: 32,
          itemPadding: 8,
          svg: 14,
        };
    }
  });

  const onAddEffectClick = useCallback(
    async (effectName: string) => {
      const effectsSnapshot = [...coreState.effects];
      const effectGroupsSnapshot = new Map(coreState.effectGroups);
      let newProjectIdAck = "";
      if (!coreState.project.project_id) {
        const newProject: LaurusProjectResult = { ...coreState.project };
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
        const newProject: LaurusProjectResult = { ...coreState.project };
        const projectUpdated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (projectUpdated) {
          newProjectIdAck = newProject.project_id;
          dispatch({ type: CoreActionType.SetProject, value: newProject });
        }
      }
      if (!newProjectIdAck) return;

      let newEffectGroupIdAck = "";
      if (!effect_group_id) {
        const reindexedGroups = reindexEffectGroups(effectGroupsSnapshot);
        await persistReindexedGroups(coreState.apiOrigin, coreState.accessToken, reindexedGroups, effectGroupsSnapshot);
        const newEffectGroup: LaurusEffectGroup = {
          description: "",
          order:
            reindexedGroups.length > 0
              ? Math.max(-1, ...Array.from(effectGroupsSnapshot.values()).flatMap((g) => g.order)) + 1
              : 0,
          project_id: newProjectIdAck,
          disabled: false,
        };
        const created = await createEffectGroup(coreState.apiOrigin, coreState.accessToken, newEffectGroup);
        if (created) {
          newEffectGroupIdAck = created.effect_group_id;
          dispatch({
            type: CoreActionType.SetEffectGroup,
            value: { ...created },
          });
          effectGroupsSnapshot.set(created.effect_group_id, created);
        }
      } else {
        newEffectGroupIdAck = effect_group_id;
      }
      if (!newEffectGroupIdAck) return;

      const newOrder =
        Math.max(
          -1,
          ...effectsSnapshot.filter((e) => e.value.effect_group_id === effect_group_id).flatMap((e) => e.value.order),
        ) + 1;
      switch (effectName) {
        case "scale": {
          const newScale: LaurusScale = {
            math: new Map(),
            start: 0,
            end: 0,
            project_id: newProjectIdAck,
            effect_group_id: newEffectGroupIdAck,
            locked: false,
            order: newOrder,
            mix: false,
            description: "",
            disabled: false,
          };
          const created = await createScale(coreState.apiOrigin, coreState.accessToken, newScale);
          if (created) {
            const newEffect: LaurusEffect = {
              type: "scale",
              key: created.scale_id,
              value: { ...created, mixState: LaurusMixState.None },
            };
            const reindexed = reindexEffects([...effectsSnapshot, newEffect], effectGroupsSnapshot);
            await persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexed, [
              ...effectsSnapshot,
              newEffect,
            ]);
            dispatch({ type: CoreActionType.SetEffects, value: reindexed, preserveCache: true });
          }
          break;
        }
        case "move": {
          const newMove: LaurusMove = {
            math: new Map(),
            start: 0,
            end: 0,
            project_id: newProjectIdAck,
            effect_group_id: newEffectGroupIdAck,
            locked: false,
            order: newOrder,
            mix: false,
            description: "",
            disabled: false,
          };
          const created = await createMove(coreState.apiOrigin, coreState.accessToken, newMove);
          if (created) {
            const newEffect: LaurusEffect = {
              type: "move",
              key: created.move_id,
              value: { ...created, mixState: LaurusMixState.None },
            };
            const reindexed = reindexEffects([...effectsSnapshot, newEffect], effectGroupsSnapshot);
            await persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexed, [
              ...effectsSnapshot,
              newEffect,
            ]);
            dispatch({ type: CoreActionType.SetEffects, value: reindexed, preserveCache: true });
          }
          break;
        }
        case "rotate": {
          const newRotate: LaurusRotate = {
            math: new Map(),
            start: 0,
            end: 0,
            project_id: newProjectIdAck,
            effect_group_id: newEffectGroupIdAck,
            locked: false,
            order: newOrder,
            mix: false,
            description: "",
            disabled: false,
          };
          const created = await createRotate(coreState.apiOrigin, coreState.accessToken, newRotate);
          if (created) {
            const newEffect: LaurusEffect = {
              type: "rotate",
              key: created.rotate_id,
              value: { ...created, mixState: LaurusMixState.None },
            };
            const reindexed = reindexEffects([...effectsSnapshot, newEffect], effectGroupsSnapshot);
            await persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexed, [
              ...effectsSnapshot,
              newEffect,
            ]);
            dispatch({ type: CoreActionType.SetEffects, value: reindexed, preserveCache: true });
          }
          break;
        }
        case "skew": {
          const newSkew: LaurusSkew = {
            math: new Map(),
            start: 0,
            end: 0,
            project_id: newProjectIdAck,
            effect_group_id: newEffectGroupIdAck,
            locked: false,
            order: newOrder,
            mix: false,
            description: "",
            disabled: false,
          };
          const created = await createSkew(coreState.apiOrigin, coreState.accessToken, newSkew);
          if (created) {
            const newEffect: LaurusEffect = {
              type: "skew",
              key: created.skew_id,
              value: { ...created, mixState: LaurusMixState.None },
            };
            const reindexed = reindexEffects([...effectsSnapshot, newEffect], effectGroupsSnapshot);
            await persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexed, [
              ...effectsSnapshot,
              newEffect,
            ]);
            dispatch({ type: CoreActionType.SetEffects, value: reindexed, preserveCache: true });
          }
          break;
        }
        case "light_source": {
          const newLightSource: LaurusLightSource = {
            math: new Map(),
            start: 0,
            end: 0,
            project_id: newProjectIdAck,
            effect_group_id: newEffectGroupIdAck,
            locked: false,
            order: newOrder,
            mix: false,
            description: "",
            disabled: false,
          };
          const created = await createLightSource(coreState.apiOrigin, coreState.accessToken, newLightSource);
          if (created) {
            const newEffect: LaurusEffect = {
              type: "light_source",
              key: created.light_source_id,
              value: { ...created, mixState: LaurusMixState.None },
            };
            const reindexed = reindexEffects([...effectsSnapshot, newEffect], effectGroupsSnapshot);
            await persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexed, [
              ...effectsSnapshot,
              newEffect,
            ]);
            dispatch({ type: CoreActionType.SetEffects, value: reindexed, preserveCache: true });
          }
          break;
        }
      }
    },
    [
      coreState.accessToken,
      coreState.apiOrigin,
      coreState.effectGroups,
      coreState.effects,
      coreState.project,
      dispatch,
      effect_group_id,
    ],
  );

  return (
    <div
      style={{
        width: "100%",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        borderLeft: "1px solid rgba(255, 255, 255, 0.05)",
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
        height: effectBrowserSize.height,
        overflowY: "auto",
        overflowX: "hidden",
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
      }}
    >
      {uiState.effectNames.map((effectName, i) => {
        return (
          <div
            key={effectName}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = i % 2 == 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)";
              e.currentTarget.style.border = "1px solid rgba(0, 0, 0, 0)";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: effectBrowserSize.itemFontSize,
              letterSpacing: "3px",
              height: effectBrowserSize.itemHeight,
              border: "1px solid rgba(0, 0, 0, 0)",
              padding: effectBrowserSize.itemPadding,
              background: i % 2 == 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
              color: "rgb(227,227,227)",
            }}
          >
            <div>{effectName === "light_source" ? "shader" : `${effectName.replaceAll("_", " ")}`}</div>
            <SvgRepo
              svg={(() => {
                switch (effectName) {
                  case "scale":
                    return allOut();
                  case "move":
                    return earthquake();
                  case "rotate":
                    return cycle400();
                  case "skew":
                    return skew400();
                  case "light_source":
                    return asterisk300();
                  default:
                    return circle("rgba(0,0,0,0)");
                }
              })()}
              containerStyle={{
                width: effectBrowserSize.svg,
                height: effectBrowserSize.svg,
              }}
              scale={(() => {
                switch (effectName) {
                  case "rotate":
                    return 0.6;
                  case "skew":
                    return 0.65;
                  case "light_source":
                    return 0.75;
                  default:
                    return 0.7;
                }
              })()}
              scaleToContaier={true}
            />
            <div style={{ marginLeft: "auto" }} />
            <SvgRepo
              svg={addCircle("rgba(204, 204, 204, 0.8)")}
              containerStyle={{
                width: effectBrowserSize.svg,
                height: effectBrowserSize.svg,
                cursor: uiState.playbackMode.type !== "stopped" ? "" : "pointer",
              }}
              scale={1}
              scaleToContaier={true}
              onContainerClick={async () => {
                if (uiState.playbackMode.type !== "stopped") return;
                await onAddEffectClick(effectName);
                onAddClick();
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

interface ControlPanel {
  onSwitchViews: () => void;
  containerStyle?: CSSProperties;
}
function ControlPanel({ onSwitchViews, containerStyle }: ControlPanel) {
  const { coreState, dispatch, handleRewindAll, handlePlayAll, handleFastForwardAll, handleStopAll } =
    useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);
  const [isControlPanelHovered, setIsControlPanelHovered] = useState(false);
  const [playbackRate] = useState(10);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          padding: 10,
          fpsInputWidth: "3ch",
          fpsInputFontSize: 16,
          fpsLabelFontSize: 15,
          fpsInputGap: 2,
          mainSvg: 50,
          secondarySvg: 20,
          recordingLightSize: 15,
        };
      case "midhigh":
        return {
          padding: 10,
          fpsInputWidth: "3ch",
          fpsInputFontSize: 14,
          fpsLabelFontSize: 13,
          fpsInputGap: 2,
          mainSvg: 40,
          secondarySvg: 16,
          recordingLightSize: 12,
        };
      case "midlow":
      case "low":
        return {
          padding: 10,
          fpsInputWidth: "3ch",
          fpsInputFontSize: 12,
          fpsLabelFontSize: 11,
          fpsInputGap: 2,
          mainSvg: 38,
          secondarySvg: 14,
          recordingLightSize: 11,
        };
    }
  });
  const fpsInputRef = useRef<HTMLInputElement | null>(null);
  const fpsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onFpsChange = useCallback(
    async (newFps: number) => {
      const snapshot = { ...coreState.project };
      const newProject: LaurusProjectResult = { ...snapshot, fps: newFps };
      const rollback = () => {
        dispatch({ type: CoreActionType.SetProject, value: snapshot });
        const inputEl = fpsInputRef.current;
        if (inputEl) {
          inputEl.value = `${snapshot.fps}`;
        }
      };
      if (!newProject.project_id) {
        const created = await createProject(coreState.apiOrigin, coreState.accessToken, newProject);
        if (created) {
          dispatch({ type: CoreActionType.SetProject, value: created, preserveCache: false });
        } else {
          rollback();
        }
      } else {
        const updated = await updateProject(
          coreState.apiOrigin,
          coreState.accessToken,
          newProject.project_id,
          newProject,
        );
        if (updated) {
          dispatch({ type: CoreActionType.SetProject, value: newProject, preserveCache: false });
        } else {
          rollback();
        }
      }
    },
    [coreState.accessToken, coreState.apiOrigin, coreState.project, dispatch],
  );

  useEffect(() => {
    const inputEl = fpsInputRef.current;
    if (inputEl) {
      inputEl.value = `${coreState.project.fps ?? 60}`;
    }
  }, [coreState.project.fps]);
  const mainControlIcon = useMemo<LaurusClientSvg>(() => {
    switch (uiState.playbackMode.type) {
      case "stopped":
        return playArrow();
      case "playing":
        return stopIcon();
      case "waiting":
        return playArrow("rgba(255, 255, 255, 0.2)");
    }
  }, [uiState.playbackMode.type]);
  return (
    <div
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        borderLeft: "1px solid rgba(255, 255, 255, 0.05)",
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
        background: "rgba(23, 23, 23, 1)",
        padding: dynamicSizes.padding,
        display: "flex",
        width: "100%",
        justifyContent: "space-between",
        alignItems: "center",
        ...containerStyle,
      }}
      onMouseEnter={() => setIsControlPanelHovered(true)}
      onMouseLeave={() => setIsControlPanelHovered(false)}
    >
      <div title={"frame rate"} style={{ display: "flex", gap: dynamicSizes.fpsInputGap }}>
        <input
          ref={fpsInputRef}
          className={dellaRespira.className + " " + styles["numberInput"]}
          id={`fps-input`}
          type="text"
          autoComplete="off"
          disabled={uiState.playbackMode.type !== "stopped" ? true : false}
          onChange={(e) => {
            const newFps: number = parseFloat(e.currentTarget.value) || 60;
            if (fpsUpdateTimerRef.current) {
              clearTimeout(fpsUpdateTimerRef.current);
            }
            fpsUpdateTimerRef.current = setTimeout(() => {
              onFpsChange(newFps);
            }, 1000);
          }}
          style={{
            textAlign: "center",
            background: "none",
            color: "rgb(227, 227, 227)",
            borderRadius: "2px",
            border: "none",
            outline: "none",
            lineHeight: "1",
            display: "inline-block",
            overflowX: "scroll",
            width: dynamicSizes.fpsInputWidth,
            fontSize: dynamicSizes.fpsInputFontSize,
          }}
        />
        <div
          style={{
            fontSize: dynamicSizes.fpsLabelFontSize,
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          {<i>{"fps"}</i>}
        </div>
      </div>
      <div style={{ display: "flex", height: "100%", alignItems: "center" }}>
        <SvgRepo
          title={"rewind all"}
          svg={uiState.playbackMode.type == "stopped" ? skipPrevious() : skipPrevious("rgba(255, 255, 255, 0.2)")}
          scale={1}
          scaleToContaier={true}
          onContainerClick={() => {
            switch (uiState.playbackMode.type) {
              case "stopped": {
                handleRewindAll(playbackRate);
                break;
              }
              case "playing": {
                return;
              }
              case "waiting": {
                return;
              }
            }
          }}
          containerStyle={
            uiState.playbackMode.type !== "stopped"
              ? {
                  cursor: "progress",
                  width: dynamicSizes.secondarySvg,
                  height: dynamicSizes.secondarySvg,
                }
              : {
                  width: dynamicSizes.secondarySvg,
                  height: dynamicSizes.secondarySvg,
                }
          }
        />
        <SvgRepo
          title={uiState.playbackMode.type == "playing" ? "stop all" : "play all"}
          svg={mainControlIcon}
          scale={uiState.playbackMode.type == "playing" ? 0.75 : 1}
          scaleToContaier={true}
          onContainerClick={() => {
            switch (uiState.playbackMode.type) {
              case "stopped": {
                handlePlayAll();
                break;
              }
              case "playing": {
                handleStopAll();
                break;
              }
              case "waiting": {
                return;
              }
            }
          }}
          containerStyle={
            uiState.playbackMode.type === "waiting"
              ? {
                  cursor: "progress",
                  width: dynamicSizes.mainSvg,
                  height: dynamicSizes.mainSvg,
                }
              : {
                  width: dynamicSizes.mainSvg,
                  height: dynamicSizes.mainSvg,
                }
          }
        />
        <SvgRepo
          title={"fast-forward all"}
          svg={uiState.playbackMode.type == "stopped" ? skipNext() : skipNext("rgba(255, 255, 255, 0.2)")}
          scale={1}
          scaleToContaier={true}
          onContainerClick={() => {
            switch (uiState.playbackMode.type) {
              case "stopped": {
                handleFastForwardAll(playbackRate);
                break;
              }
              case "playing": {
                return;
              }
              case "waiting": {
                return;
              }
            }
          }}
          containerStyle={
            uiState.playbackMode.type !== "stopped"
              ? {
                  cursor: "progress",
                  width: dynamicSizes.secondarySvg,
                  height: dynamicSizes.secondarySvg,
                }
              : {
                  width: dynamicSizes.secondarySvg,
                  height: dynamicSizes.secondarySvg,
                }
          }
        />
      </div>
      <div title={isAltKeyPressed && isControlPanelHovered ? "switch to selection panel" : "light"}>
        {isAltKeyPressed && isControlPanelHovered ? (
          <SvgRepo
            title={"switch to selection panel"}
            svg={adjust()}
            scale={1.2}
            scaleToContaier={true}
            onContainerClick={() => onSwitchViews()}
            containerStyle={{
              width: dynamicSizes.recordingLightSize,
              height: dynamicSizes.recordingLightSize,
            }}
          />
        ) : (
          <div
            style={{
              width: dynamicSizes.recordingLightSize,
              height: dynamicSizes.recordingLightSize,
              borderRadius: "50%",
              border: uiState.recordingLight ? "1px solid rgb(239, 239, 239)" : "1px solid rgba(255, 255, 255, 0.03)",
              background: uiState.recordingLight
                ? "linear-gradient(270deg, rgb(224, 224, 224), rgb(255, 255, 255))"
                : "rgba(255, 255, 255, 0.03)",
              boxShadow: uiState.recordingLight ? "rgba(255, 255, 255, 1) 0px 0px 100px 10px" : "none",
            }}
          />
        )}
      </div>
    </div>
  );
}

interface SelectionControlPanel {
  containerStyle?: CSSProperties;
}
function SelectionControlPanel({ containerStyle }: SelectionControlPanel) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { selectedEffectUnitKeys, setSelectedEffectUnitKeys } = useContext(HoverContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          padding: 10,
          selectedInputWidth: "2ch",
          selectedInputFontSize: 16,
          selectedLabelFontSize: 15,
          selectedInputGap: 2,
          mainSvg: 50,
          recordingLightSize: 15,
          input: {
            fontSize: 12,
            padding: 10,
          },
        };
      case "midhigh":
        return {
          padding: 10,
          selectedInputWidth: "2ch",
          selectedInputFontSize: 14,
          selectedLabelFontSize: 13,
          selectedInputGap: 2,
          mainSvg: 40,
          recordingLightSize: 12,
          input: {
            fontSize: 10,
            padding: 10,
          },
        };
      case "midlow":
      case "low":
        return {
          padding: 10,
          selectedInputWidth: "2ch",
          selectedInputFontSize: 12,
          selectedLabelFontSize: 11,
          selectedInputGap: 2,
          mainSvg: 38,
          recordingLightSize: 11,
          input: {
            fontSize: 10,
            padding: 10,
          },
        };
    }
  });

  const [effectGroupDescription, setEffectGroupDescription] = useState<string>("");

  const onCreateEffectGroupClick = useCallback(async () => {
    if (!coreState.project.project_id || uiState.playbackMode.type !== "stopped") return;
    const effectGroupsSnapshot = new Map(coreState.effectGroups);
    const reindexedGroups = reindexEffectGroups(effectGroupsSnapshot);
    const newEffectGroup: LaurusEffectGroup = {
      description: effectGroupDescription,
      order:
        reindexedGroups.length > 0
          ? Math.max(-1, ...Array.from(effectGroupsSnapshot.values()).flatMap((g) => g.order)) + 1
          : 0,
      project_id: coreState.project.project_id,
      disabled: false,
    };

    const created = await createEffectGroup(coreState.apiOrigin, coreState.accessToken, newEffectGroup);
    if (created) {
      const reindexedGroupsMap: Map<string, LaurusEffectGroupResult> = new Map();
      reindexedGroups.forEach((g) => {
        reindexedGroupsMap.set(g.effect_group_id, g);
      });
      reindexedGroupsMap.set(created.effect_group_id, created);
      const effectsSnapshot = [...coreState.effects];
      const newEffects = effectsSnapshot.map((e) => {
        if (selectedEffectUnitKeys.has(e.key)) {
          return {
            ...e,
            value: { ...e.value, effect_group_id: created.effect_group_id },
          } as LaurusEffect;
        }
        return e;
      });

      const reindexedNewEffects = reindexEffects(newEffects, reindexedGroupsMap);
      await persistReindexedEffects(coreState.apiOrigin, coreState.accessToken, reindexedNewEffects, effectsSnapshot);
      dispatch({ type: CoreActionType.SetEffects, value: reindexedNewEffects });

      const newGroupsArray = Array.from(reindexedGroupsMap.values());
      await persistReindexedGroups(coreState.apiOrigin, coreState.accessToken, newGroupsArray, effectGroupsSnapshot);
      newGroupsArray.forEach((g) => dispatch({ type: CoreActionType.SetEffectGroup, value: g }));

      setSelectedEffectUnitKeys(new Set());
    }
  }, [
    coreState.project.project_id,
    coreState.effectGroups,
    coreState.apiOrigin,
    coreState.accessToken,
    coreState.effects,
    uiState.playbackMode.type,
    effectGroupDescription,
    dispatch,
    setSelectedEffectUnitKeys,
    selectedEffectUnitKeys,
  ]);

  return (
    <div
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        borderLeft: "1px solid rgba(255, 255, 255, 0.05)",
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
        borderTopRightRadius: 0,
        borderTopLeftRadius: 0,
        background: "rgba(23, 23, 23, 1)",
        padding: dynamicSizes.padding,
        display: "flex",
        width: "100%",
        justifyContent: "space-between",
        alignItems: "center",
        ...containerStyle,
      }}
    >
      <div title={"effect selection count"} style={{ display: "flex", gap: dynamicSizes.selectedInputGap }}>
        <input
          className={dellaRespira.className + " " + styles["numberInput"]}
          id={`fps-input`}
          type="text"
          disabled
          autoComplete="off"
          value={selectedEffectUnitKeys.size.toString()}
          style={{
            textAlign: "center",
            background: "none",
            color: "rgb(227, 227, 227)",
            borderRadius: "2px",
            border: "none",
            outline: "none",
            lineHeight: "1",
            display: "inline-block",
            overflowX: "scroll",
            width: dynamicSizes.selectedInputWidth,
            fontSize: dynamicSizes.selectedInputFontSize,
          }}
        />
        <div
          style={{
            color: "rgba(255, 255, 255, 0.5)",
            userSelect: "none",
            fontSize: dynamicSizes.selectedLabelFontSize,
          }}
        >
          {<i>{"selected"}</i>}
        </div>
      </div>
      <input
        id={`new-effect-group-description-input`}
        className={dellaRespira.className}
        placeholder="new fx group name..."
        disabled={uiState.playbackMode.type !== "stopped" ? true : false}
        style={{
          textAlign: "center",
          letterSpacing: "3px",
          background: "none",
          color: "rgb(227, 227, 227)",
          border: "none",
          outline: "none",
          width: "100%",
          ...dynamicSizes.input,
        }}
        type="text"
        autoComplete="off"
        onKeyUp={(e) => {
          if (e.key == "Enter") {
            onCreateEffectGroupClick();
          }
        }}
        autoFocus
        value={effectGroupDescription}
        onChange={(e) => {
          setEffectGroupDescription(e.target.value);
        }}
      />
      <SvgRepo
        title={"create effect group"}
        svg={addCircle()}
        scale={1.25}
        scaleToContaier={true}
        onContainerClick={onCreateEffectGroupClick}
        style={{
          cursor: uiState.playbackMode.type !== "stopped" ? "" : "pointer",
        }}
        containerStyle={{
          cursor: "",
          width: dynamicSizes.recordingLightSize,
          height: dynamicSizes.mainSvg,
        }}
      />
    </div>
  );
}
