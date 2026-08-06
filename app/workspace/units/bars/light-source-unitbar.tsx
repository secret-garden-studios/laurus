import {
  LaurusClientSvg,
  SvgRepo,
  add2,
  autorenew,
  bookmarkStacks300,
  cancelCircle,
  contentPaste,
  fileCopy,
  playArrow,
  remove,
  syncAlt,
  updateDisabled,
} from "@/app/svg-repo";
import { dmSans } from "@/app/fonts";
import { Dispatch, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { LightSourceUnitControls, defaultLightSourceEquation } from "../light-source-unit";
import { CoreContext, HoverContext, UIContext } from "../../workspace.client";
import {
  getLightSourceFrames,
  LaurusEffect,
  LaurusLightSourceEquation,
  LaurusLightSourceResult,
  LaurusLoopType,
  updateLightSource,
} from "../../workspace.server";
import { getDynamicUnitSizes, LIMIT_FACTOR_STEP, MAX_LIMIT_FACTOR, MIN_LIMIT_FACTOR } from "../../workspace.config";
import { UIActionType } from "../../states/ui-state";
import { CoreActionType } from "../../states/core-state";

interface LightSourceUnitbar {
  lightSource: LaurusLightSourceResult;
  carouselEntryKey: string;
  saveNewEquation: (rollback: LaurusLightSourceResult, newEquation: LaurusLightSourceEquation) => Promise<void>;
  updateTrackpads: (newControls: LightSourceUnitControls) => void;
  currentControls: LightSourceUnitControls;
  setCurrentControls: Dispatch<SetStateAction<LightSourceUnitControls>>;
}

export default function LightSourceUnitbar({
  lightSource,
  carouselEntryKey,
  saveNewEquation,
  updateTrackpads,
  currentControls,
  setCurrentControls,
}: LightSourceUnitbar) {
  const { coreState, dispatch, handlePlayTarget } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);

  const [dynamicSizes] = useState(() => getDynamicUnitSizes(uiState.resolution));

  const loopSvg = useMemo((): LaurusClientSvg => {
    const loopType = lightSource.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    const enabled = lightSource.math.has(carouselEntryKey) ? true : false;
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
  }, [carouselEntryKey, lightSource.math]);

  const loopSvgScale = useMemo((): number => {
    const loopType = lightSource.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    switch (loopType) {
      case LaurusLoopType.none:
        return 0.85;
      default:
        return 0.9;
    }
  }, [carouselEntryKey, lightSource.math]);

  const loopType = useMemo((): LaurusLoopType => {
    return lightSource.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
  }, [carouselEntryKey, lightSource.math]);

  const getNextLoopType = useCallback((): LaurusLoopType => {
    const currentLoop = lightSource.math.get(carouselEntryKey)?.loop;
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
  }, [carouselEntryKey, lightSource.math]);

  const decrementLimitFactor = useCallback((): number => {
    const currentFactor =
      lightSource.math.get(carouselEntryKey)?.limit_factor ?? defaultLightSourceEquation.limit_factor;
    return Math.max(MIN_LIMIT_FACTOR, Math.round((currentFactor - LIMIT_FACTOR_STEP) * 100) / 100);
  }, [carouselEntryKey, lightSource.math]);

  const incrementLimitFactor = useCallback((): number => {
    const currentFactor =
      lightSource.math.get(carouselEntryKey)?.limit_factor ?? defaultLightSourceEquation.limit_factor;
    return Math.min(MAX_LIMIT_FACTOR, Math.round((currentFactor + LIMIT_FACTOR_STEP) * 100) / 100);
  }, [carouselEntryKey, lightSource.math]);

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
    if (!uiState.effectClipboard || uiState.effectClipboard.type !== "light_source") return;
    const clipboardEquation = uiState.effectClipboard.value.math.get("clipboard");
    if (!clipboardEquation) return;
    const snapshot: LaurusLightSourceResult = { ...lightSource };
    const newMath = new Map(snapshot.math);
    otherGroupKeys.forEach((key) => {
      newMath.set(key, { ...clipboardEquation, input_id: key });
    });
    const newLightSource: LaurusLightSourceResult = { ...snapshot, math: newMath };
    const updated = await updateLightSource(coreState.apiOrigin, coreState.accessToken, snapshot.light_source_id, {
      ...newLightSource,
    });
    if (updated) {
      dispatch({
        type: CoreActionType.SetEffect,
        value: { type: "light_source", value: { ...newLightSource }, key: newLightSource.light_source_id },
      });
    }
  }, [
    isAltKeyPressed,
    uiState.playbackMode.type,
    uiState.effectClipboard,
    otherGroupKeys,
    lightSource,
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
          title="loop"
          onDoubleClick={() => {
            if (lightSource.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            const activeKey = carouselEntryKey;
            if (activeKey) {
              const nextLoop = getNextLoopType();
              const snapshot: LaurusLightSourceResult = { ...lightSource };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    loop: nextLoop,
                  }
                : {
                    ...defaultLightSourceEquation,
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
            borderTopRightRadius: 6,
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="loop"
            svg={loopSvg}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : lightSource.locked || uiState.playbackMode.type !== "stopped"
                  ? ""
                  : lightSource.math.has(carouselEntryKey)
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
              getFrames: (apiOrigin) => getLightSourceFrames(apiOrigin, lightSource.light_source_id, carouselEntryKey),
              effectKey: lightSource.light_source_id,
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
              lightSource.math.has(carouselEntryKey) && uiState.playbackMode.type === "stopped"
                ? playArrow()
                : playArrow("rgb(62, 62, 62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : lightSource.math.has(carouselEntryKey) && uiState.playbackMode.type === "stopped"
                  ? "pointer"
                  : lightSource.math.has(carouselEntryKey)
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
              lightSource.locked ||
              uiState.playbackMode.type !== "stopped" ||
              (lightSource.math.has(carouselEntryKey) &&
                lightSource.math.get(carouselEntryKey)!.limit_factor == MAX_LIMIT_FACTOR)
            )
              return;
            const activeKey = carouselEntryKey;
            if (activeKey && lightSource.math.has(activeKey)) {
              const nextFactor = incrementLimitFactor();
              const snapshot: LaurusLightSourceResult = { ...lightSource };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    limit_factor: nextFactor,
                  }
                : {
                    ...defaultLightSourceEquation,
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
              lightSource.math.has(carouselEntryKey) &&
              lightSource.math.get(carouselEntryKey)!.limit_factor != MAX_LIMIT_FACTOR
                ? add2()
                : add2("rgb(62, 62, 62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : lightSource.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
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
              lightSource.locked ||
              uiState.playbackMode.type !== "stopped" ||
              (lightSource.math.has(carouselEntryKey) &&
                lightSource.math.get(carouselEntryKey)!.limit_factor == MIN_LIMIT_FACTOR)
            )
              return;
            const activeKey = carouselEntryKey;
            if (activeKey && lightSource.math.has(activeKey)) {
              const nextFactor = decrementLimitFactor();
              const snapshot: LaurusLightSourceResult = { ...lightSource };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    limit_factor: nextFactor,
                  }
                : {
                    ...defaultLightSourceEquation,
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
              lightSource.math.has(carouselEntryKey) &&
              lightSource.math.get(carouselEntryKey)!.limit_factor != MIN_LIMIT_FACTOR
                ? remove()
                : remove("rgb(62,62,62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : lightSource.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
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
            let clipboardData: LightSourceUnitControls = { ...currentControls };
            const activeEquation = lightSource.math.get(carouselEntryKey);
            if (activeEquation) {
              clipboardData = { ...activeEquation };
            }
            const currentEq: LaurusLightSourceEquation = {
              ...clipboardData,
              input_id: "clipboard",
              solution: defaultLightSourceEquation.solution,
            };
            const newMath: Map<string, LaurusLightSourceEquation> = new Map();
            newMath.set("clipboard", currentEq);
            const newClipboardEffect: LaurusEffect = {
              type: "light_source",
              key: lightSource.light_source_id,
              value: { ...lightSource, math: newMath },
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
            svg={lightSource.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed ? "crosshair" : lightSource.math.has(carouselEntryKey) ? "pointer" : "",
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
            if (uiState.effectClipboard && uiState.effectClipboard.type == "light_source") {
              const clipboardEquation = uiState.effectClipboard.value.math.get("clipboard");
              if (!clipboardEquation) return;
              const snapshot: LaurusLightSourceResult = { ...lightSource };
              const activeKey = carouselEntryKey;
              const newEquation: LaurusLightSourceEquation = {
                ...clipboardEquation,
              };
              const newControls: LightSourceUnitControls = { ...newEquation };
              setCurrentControls(newControls);
              updateTrackpads(newControls);
              if (activeKey) {
                const newMath: LaurusLightSourceEquation = {
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
            svg={uiState.effectClipboard?.type == "light_source" ? contentPaste() : contentPaste("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : lightSource.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
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
              uiState.effectClipboard?.type == "light_source" && otherGroupKeys.length > 0
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
            if (isAltKeyPressed || lightSource.locked || uiState.playbackMode.type !== "stopped") return;
            const activeKey = carouselEntryKey;
            if (activeKey && lightSource.math.has(activeKey)) {
              const confirmed = confirm("are you sure you want to clear this equation?");
              if (!confirmed) return;
              const snapshot: LaurusLightSourceResult = { ...lightSource };
              const newMath = new Map(snapshot.math);
              newMath.delete(activeKey);
              const newLightSource: LaurusLightSourceResult = {
                ...snapshot,
                math: newMath,
              };
              const defaultControls: LightSourceUnitControls = {
                ...defaultLightSourceEquation,
                time: 0,
              };
              setCurrentControls(defaultControls);
              updateTrackpads(defaultControls);
              dispatch({
                type: CoreActionType.SetEffect,
                value: {
                  type: "light_source",
                  value: { ...newLightSource },
                  key: newLightSource.light_source_id,
                },
              });
              const updated = await updateLightSource(
                coreState.apiOrigin,
                coreState.accessToken,
                snapshot.light_source_id,
                {
                  ...newLightSource,
                },
              );
              if (!updated) {
                dispatch({
                  type: CoreActionType.SetEffect,
                  value: {
                    type: "light_source",
                    value: { ...snapshot },
                    key: snapshot.light_source_id,
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
            svg={lightSource.math.has(carouselEntryKey) ? cancelCircle() : cancelCircle("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : lightSource.locked || uiState.playbackMode.type !== "stopped"
                  ? ""
                  : lightSource.math.has(carouselEntryKey)
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
