import { dmSans } from "@/app/fonts";
import {
  LaurusClientSvg,
  SvgRepo,
  add2,
  antigravity300,
  asterisk300,
  autorenew,
  bookmarkStacks300,
  cancelCircle,
  contentPaste,
  fileCopy,
  image400,
  playArrow,
  polyline300,
  remove,
  syncAlt,
  texture300,
  updateDisabled,
} from "@/app/svg-repo";
import { Dispatch, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { SkewUnitControls, SkewUnitTarget, defaultSkewEquation } from "../skew-unit";
import { CoreContext, HoverContext, UIContext } from "../../workspace.client";
import {
  getSkewFrames,
  LaurusEffect,
  LaurusLoopType,
  LaurusSkewEquation,
  LaurusSkewResult,
  updateSkew,
} from "../../workspace.server";
import { LIMIT_FACTOR_STEP, MAX_LIMIT_FACTOR, MIN_LIMIT_FACTOR } from "../../workspace.config";
import { UIActionType } from "../../states/ui-state";
import { CoreActionType } from "../../states/core-state";

interface SkewUnitbar {
  skew: LaurusSkewResult;
  carouselEntryKey: string;
  saveNewEquation: (rollback: LaurusSkewResult, newEquation: LaurusSkewEquation) => Promise<void>;
  updateTrackpads: (newControls: SkewUnitControls) => void;
  currentControls: SkewUnitControls;
  setCurrentControls: Dispatch<SetStateAction<SkewUnitControls>>;
  target: SkewUnitTarget;
  onToggleTarget: () => void;
}

export default function SkewUnitbar({
  skew,
  carouselEntryKey,
  saveNewEquation,
  updateTrackpads,
  currentControls,
  setCurrentControls,
  target,
  onToggleTarget,
}: SkewUnitbar) {
  const { coreState, dispatch, handlePlayTarget } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);

  const targetSvg = useMemo((): LaurusClientSvg => {
    switch (target) {
      case "img":
        return image400();
      case "svg":
        return polyline300();
      case "mask":
        return texture300();
      case "light":
        return asterisk300();
      case "object":
        return antigravity300();
    }
  }, [target]);

  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          paramButtonContainer: {
            width: 36,
            height: 36,
          },
          paramButton: {
            width: 20,
            height: 20,
          },
          angleParam: { padding: 15 },
        };
      case "midhigh":
        return {
          paramButtonContainer: {
            width: 24,
            height: 24,
          },
          paramButton: {
            width: 14,
            height: 14,
          },
          angleParam: { padding: Math.round(15 * uiState.resolution.factor) },
        };
      case "midlow":
        return {
          paramButtonContainer: {
            width: Math.round(36 * uiState.resolution.factor),
            height: Math.round(36 * uiState.resolution.factor),
          },
          paramButton: {
            width: Math.round(20 * uiState.resolution.factor),
            height: Math.round(20 * uiState.resolution.factor),
          },
          angleParam: { padding: Math.round(15 * uiState.resolution.factor) },
        };
      case "low":
        return {
          paramButtonContainer: {
            width: Math.round(36 * uiState.resolution.factor),
            height: Math.round(36 * uiState.resolution.factor),
          },
          paramButton: {
            width: Math.round(20 * uiState.resolution.factor),
            height: Math.round(20 * uiState.resolution.factor),
          },
          angleParam: { padding: Math.round(15 * uiState.resolution.factor) },
        };
    }
  });

  const loopSvg = useMemo((): LaurusClientSvg => {
    const loopType = skew.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    const enabled = skew.math.has(carouselEntryKey) ? true : false;
    switch (loopType) {
      default:
      case LaurusLoopType.none: {
        return enabled ? updateDisabled() : updateDisabled("rgb(62,62,62)");
      }
      case LaurusLoopType.loop_reverse_infinite: {
        return enabled ? syncAlt() : syncAlt("rgb(62,62,62)");
      }
      case LaurusLoopType.loop_reverse: {
        return enabled ? syncAlt() : syncAlt("rgb(62,62,62)");
      }
      case LaurusLoopType.loop_infinite: {
        return enabled ? autorenew() : autorenew("rgb(62,62,62)");
      }
    }
  }, [carouselEntryKey, skew.math]);

  const loopSvgScale = useMemo((): number => {
    const loopType = skew.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    switch (loopType) {
      case LaurusLoopType.none:
        return 0.85;
      default:
        return 0.9;
    }
  }, [carouselEntryKey, skew.math]);

  const loopType = useMemo((): LaurusLoopType => {
    return skew.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
  }, [carouselEntryKey, skew.math]);

  const getNextLoopType = useCallback((): LaurusLoopType => {
    const currentLoop = skew.math.get(carouselEntryKey)?.loop;
    switch (currentLoop) {
      case LaurusLoopType.loop:
      case LaurusLoopType.none: {
        return LaurusLoopType.loop_infinite;
      }
      case LaurusLoopType.loop_infinite: {
        return LaurusLoopType.loop_reverse_infinite;
      }
      case LaurusLoopType.loop_reverse_infinite: {
        return LaurusLoopType.loop_reverse;
      }
      default:
      case LaurusLoopType.loop_reverse: {
        return LaurusLoopType.none;
      }
    }
  }, [carouselEntryKey, skew.math]);

  const decrementLimitFactor = useCallback((): number => {
    const currentFactor = skew.math.get(carouselEntryKey)?.limit_factor ?? defaultSkewEquation.limit_factor;
    return Math.max(MIN_LIMIT_FACTOR, Math.round((currentFactor - LIMIT_FACTOR_STEP) * 100) / 100);
  }, [carouselEntryKey, skew.math]);

  const incrementLimitFactor = useCallback((): number => {
    const currentFactor = skew.math.get(carouselEntryKey)?.limit_factor ?? defaultSkewEquation.limit_factor;
    return Math.min(MAX_LIMIT_FACTOR, Math.round((currentFactor + LIMIT_FACTOR_STEP) * 100) / 100);
  }, [carouselEntryKey, skew.math]);

  const mediaGroupId = useMemo(() => {
    const imgMeta = coreState.project.imgs.get(carouselEntryKey);
    if (imgMeta) return imgMeta.media_group_id;
    const svgMeta = coreState.project.svgs.get(carouselEntryKey);
    return svgMeta?.media_group_id ?? "";
  }, [carouselEntryKey, coreState.project.imgs, coreState.project.svgs]);

  const otherGroupKeys = useMemo(() => {
    if (!mediaGroupId) return [];
    const imgKeys = Array.from(coreState.project.imgs.entries())
      .filter(([key, meta]) => key !== carouselEntryKey && meta.media_group_id === mediaGroupId)
      .map(([key]) => key);
    const svgKeys = Array.from(coreState.project.svgs.entries())
      .filter(([key, meta]) => key !== carouselEntryKey && meta.media_group_id === mediaGroupId)
      .map(([key]) => key);
    return [...imgKeys, ...svgKeys];
  }, [mediaGroupId, carouselEntryKey, coreState.project.imgs, coreState.project.svgs]);

  const onPasteToGroupClick = useCallback(async () => {
    if (isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
    if (otherGroupKeys.length === 0) return;
    if (!uiState.effectClipboard || uiState.effectClipboard.type !== "skew") return;
    const clipboardEquation = uiState.effectClipboard.value.math.get("clipboard");
    if (!clipboardEquation) return;
    const snapshot: LaurusSkewResult = { ...skew };
    const newMath = new Map(snapshot.math);
    otherGroupKeys.forEach((key) => {
      newMath.set(key, { ...clipboardEquation, input_id: key });
    });
    const newSkew: LaurusSkewResult = { ...snapshot, math: newMath };
    const updated = await updateSkew(coreState.apiOrigin, coreState.accessToken, snapshot.skew_id, {
      ...newSkew,
    });
    if (updated) {
      dispatch({
        type: CoreActionType.SetEffect,
        value: { type: "skew", value: { ...newSkew }, key: newSkew.skew_id },
      });
    }
  }, [
    isAltKeyPressed,
    uiState.playbackMode.type,
    uiState.effectClipboard,
    otherGroupKeys,
    skew,
    dispatch,
    coreState.apiOrigin,
    coreState.accessToken,
  ]);

  return (
    <>
      <div
        style={{
          background: "linear-gradient(45deg, rgb(18, 18, 18), rgb(22, 22, 22))",
          borderLeft: "1px solid rgba(255, 255, 255, 0.025)",
          padding: 0,
          display: "grid",
          alignContent: "start",
          overflowY: "auto",
          borderTopRightRadius: 6,
          borderBottomRightRadius: 6,
        }}
      >
        <div
          title={`targeting ${target} -- double-click for the next kind of media`}
          onDoubleClick={() => {
            if (isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            onToggleTarget();
          }}
          style={{
            display: "grid",
            placeContent: "center",
            borderTopRightRadius: 6,
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title={target}
            svg={targetSvg}
            containerStyle={{
              cursor: isAltKeyPressed ? "crosshair" : uiState.playbackMode.type !== "stopped" ? "" : "pointer",
              ...dynamicSizes.paramButton,
            }}
            scale={0.85}
            scaleToContaier={true}
          />
        </div>
        <div
          title="loop"
          onDoubleClick={() => {
            if (skew.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            const activeKey = carouselEntryKey;
            if (activeKey) {
              const nextLoop = getNextLoopType();
              const snapshot: LaurusSkewResult = { ...skew };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    loop: nextLoop,
                  }
                : {
                    ...defaultSkewEquation,
                    input_id: activeKey,
                    loop: nextLoop,
                  };
              setCurrentControls((v) => ({ ...v, loop: nextLoop }));
              saveNewEquation(snapshot, newEquation);
            }
          }}
          style={{
            position: "relative",
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="loop"
            svg={loopSvg}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : skew.locked || uiState.playbackMode.type !== "stopped"
                  ? ""
                  : skew.math.has(carouselEntryKey)
                    ? "pointer"
                    : "",
              ...dynamicSizes.paramButton,
            }}
            scale={loopSvgScale}
            scaleToContaier={true}
          />
          {loopType === LaurusLoopType.loop_reverse && (
            <div
              className={dmSans.className}
              style={{
                position: "absolute",
                top: 1,
                right: 1,
                width: "2ch",
                height: "2ch",
                backgroundColor: "rgb(220, 112, 112)",
                borderRadius: "50%",
                color: "rgb(15, 15, 15)",
                fontSize: 11,
                fontWeight: "bolder",
                display: "grid",
                placeContent: "center",
                textAlign: "center",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {"1"}
            </div>
          )}
        </div>
        <div
          title="preview"
          onClick={() => {
            if (isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            handlePlayTarget({
              inputKey: carouselEntryKey,
              getFrames: (apiOrigin) => getSkewFrames(apiOrigin, skew.skew_id, carouselEntryKey),
              effectKey: skew.skew_id,
            });
          }}
          style={{
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="preview"
            svg={
              skew.math.has(carouselEntryKey) && uiState.playbackMode.type === "stopped"
                ? playArrow()
                : playArrow("rgb(62, 62, 62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : skew.math.has(carouselEntryKey) && uiState.playbackMode.type === "stopped"
                  ? "pointer"
                  : skew.math.has(carouselEntryKey)
                    ? "progress"
                    : "",
              ...dynamicSizes.paramButton,
            }}
            scale={1}
            scaleToContaier={true}
          />
        </div>
        <div
          title="increase limits"
          onClick={() => {
            if (
              isAltKeyPressed ||
              skew.locked ||
              uiState.playbackMode.type !== "stopped" ||
              (skew.math.has(carouselEntryKey) && skew.math.get(carouselEntryKey)!.limit_factor == MAX_LIMIT_FACTOR)
            )
              return;
            const activeKey = carouselEntryKey;
            if (activeKey && skew.math.has(activeKey)) {
              const nextFactor = incrementLimitFactor();
              const snapshot: LaurusSkewResult = { ...skew };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    limit_factor: nextFactor,
                  }
                : {
                    ...defaultSkewEquation,
                    input_id: activeKey,
                    limit_factor: nextFactor,
                  };
              setCurrentControls((v) => ({ ...v, limit_factor: nextFactor }));
              saveNewEquation(snapshot, newEquation);
            }
          }}
          style={{
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="increase limits"
            svg={
              skew.math.has(carouselEntryKey) && skew.math.get(carouselEntryKey)!.limit_factor != MAX_LIMIT_FACTOR
                ? add2()
                : add2("rgb(62, 62, 62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : skew.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
                  ? "pointer"
                  : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.88}
            scaleToContaier={true}
          />
        </div>
        <div
          title="decrease limits"
          onClick={() => {
            if (
              isAltKeyPressed ||
              skew.locked ||
              uiState.playbackMode.type !== "stopped" ||
              (skew.math.has(carouselEntryKey) && skew.math.get(carouselEntryKey)!.limit_factor == MIN_LIMIT_FACTOR)
            )
              return;
            const activeKey = carouselEntryKey;
            if (activeKey && skew.math.has(activeKey)) {
              const nextFactor = decrementLimitFactor();
              const snapshot: LaurusSkewResult = { ...skew };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    limit_factor: nextFactor,
                  }
                : {
                    ...defaultSkewEquation,
                    input_id: activeKey,
                    limit_factor: nextFactor,
                  };
              setCurrentControls((v) => ({ ...v, limit_factor: nextFactor }));
              saveNewEquation(snapshot, newEquation);
            }
          }}
          style={{
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="decrease limits"
            svg={
              skew.math.has(carouselEntryKey) && skew.math.get(carouselEntryKey)!.limit_factor != MIN_LIMIT_FACTOR
                ? remove()
                : remove("rgb(62,62,62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : skew.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
                  ? "pointer"
                  : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.88}
            scaleToContaier={true}
          />
        </div>
        <div
          title="copy"
          onClick={() => {
            if (isAltKeyPressed) return;
            let clipboardData: SkewUnitControls = { ...currentControls };
            const activeEquation = skew.math.get(carouselEntryKey);
            if (activeEquation) {
              clipboardData = { ...activeEquation };
            }
            const currentEq: LaurusSkewEquation = {
              ...clipboardData,
              input_id: "clipboard",
              solution: defaultSkewEquation.solution,
            };
            const newMath: Map<string, LaurusSkewEquation> = new Map();
            newMath.set("clipboard", currentEq);
            const newClipboardEffect: LaurusEffect = {
              type: "skew",
              key: skew.skew_id,
              value: { ...skew, math: newMath },
            };
            uiDispatch({
              type: UIActionType.SetEffectClipboard,
              value: newClipboardEffect,
            });
          }}
          style={{
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="copy"
            svg={skew.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed ? "crosshair" : skew.math.has(carouselEntryKey) ? "pointer" : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.8}
            scaleToContaier={true}
          />
        </div>
        <div
          title="paste"
          onClick={() => {
            if (isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            if (uiState.effectClipboard && uiState.effectClipboard.type == "skew") {
              const clipboardEquation = uiState.effectClipboard.value.math.get("clipboard");
              if (!clipboardEquation) return;
              const snapshot: LaurusSkewResult = { ...skew };
              const activeKey = carouselEntryKey;
              const newEquation: LaurusSkewEquation = {
                ...clipboardEquation,
              };
              const newControls: SkewUnitControls = { ...newEquation };
              setCurrentControls(newControls);
              updateTrackpads(newControls);
              if (activeKey) {
                const newMath: LaurusSkewEquation = {
                  ...newEquation,
                  input_id: activeKey,
                };
                saveNewEquation(snapshot, newMath);
              }
            }
          }}
          style={{
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="paste"
            svg={uiState.effectClipboard?.type == "skew" ? contentPaste() : contentPaste("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : skew.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
                  ? "pointer"
                  : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.9}
            scaleToContaier={true}
          />
        </div>
        <div
          title={"paste to group"}
          onClick={onPasteToGroupClick}
          style={{
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="paste to group"
            svg={
              uiState.effectClipboard?.type == "skew" && otherGroupKeys.length > 0
                ? bookmarkStacks300()
                : bookmarkStacks300("rgb(67, 67, 67)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : otherGroupKeys.length > 0 && uiState.playbackMode.type == "stopped"
                  ? "pointer"
                  : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.9}
            scaleToContaier={true}
          />
        </div>
        <div
          title="clear"
          onClick={async () => {
            if (isAltKeyPressed || skew.locked || uiState.playbackMode.type !== "stopped") return;
            const activeKey = carouselEntryKey;
            if (activeKey && skew.math.has(activeKey)) {
              const confirmed = confirm("are you sure you want to clear this equation?");
              if (!confirmed) return;
              const snapshot: LaurusSkewResult = { ...skew };
              const newMath = new Map(snapshot.math);
              newMath.delete(activeKey);
              const newSkew: LaurusSkewResult = {
                ...snapshot,
                math: newMath,
              };
              const defaultControls: SkewUnitControls = {
                ...defaultSkewEquation,
                time: 0,
              };
              setCurrentControls(defaultControls);
              updateTrackpads(defaultControls);
              dispatch({
                type: CoreActionType.SetEffect,
                value: {
                  type: "skew",
                  value: { ...newSkew },
                  key: newSkew.skew_id,
                },
              });
              const updated = await updateSkew(coreState.apiOrigin, coreState.accessToken, snapshot.skew_id, {
                ...newSkew,
              });
              if (!updated) {
                dispatch({
                  type: CoreActionType.SetEffect,
                  value: {
                    type: "skew",
                    value: { ...snapshot },
                    key: snapshot.skew_id,
                  },
                });
              }
            }
          }}
          style={{
            display: "grid",
            placeContent: "center",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="clear"
            svg={skew.math.has(carouselEntryKey) ? cancelCircle() : cancelCircle("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : skew.locked || uiState.playbackMode.type !== "stopped"
                  ? ""
                  : skew.math.has(carouselEntryKey)
                    ? "pointer"
                    : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.8}
            scaleToContaier={true}
          />
        </div>
      </div>
    </>
  );
}
