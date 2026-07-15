import { dmSans } from "@/app/fonts";
import {
  LaurusClientSvg,
  SvgRepo,
  add2,
  autorenew,
  cancelCircle,
  contentPaste,
  fileCopy,
  playArrow,
  remove,
  syncAlt,
  updateCounterClockwise,
  updateDisabled,
} from "@/app/svg-repo";
import { Dispatch, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { RotateUnitControls, defaultRotateEquation } from "../rotate-unit";
import { CoreContext, HoverContext, UIContext } from "../../workspace.client";
import {
  getRotateFrames,
  LaurusEffect,
  LaurusLoopType,
  LaurusRotateEquation,
  LaurusRotateResult,
  updateRotate,
} from "../../workspace.server";
import { getDynamicUnitSizes, LIMIT_FACTOR_STEP, MAX_LIMIT_FACTOR, MIN_LIMIT_FACTOR } from "../../workspace.config";
import { UIActionType } from "../../states/ui-state";
import { CoreActionType } from "../../states/core-state";

interface RotateUnitbar {
  rotate: LaurusRotateResult;
  carouselEntryKey: string;
  saveNewEquation: (rollback: LaurusRotateResult, newEquation: LaurusRotateEquation) => Promise<void>;
  updateTrackpads: (newControls: RotateUnitControls) => void;
  currentControls: RotateUnitControls;
  setCurrentControls: Dispatch<SetStateAction<RotateUnitControls>>;
  counterClockwise: boolean;
  setCounterClockwise: Dispatch<SetStateAction<boolean>>;
}

export default function RotateUnitbar({
  rotate,
  carouselEntryKey,
  saveNewEquation,
  updateTrackpads,
  currentControls,
  setCurrentControls,
  counterClockwise,
  setCounterClockwise,
}: RotateUnitbar) {
  const { coreState, dispatch, handlePlayTarget } = useContext(CoreContext);
  const { uiState, uiDispatch } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);

  const [dynamicSizes] = useState(() => {
    const ds = getDynamicUnitSizes(uiState.resolution);
    switch (uiState.resolution.type) {
      case "high":
        return {
          ...ds,
          angleParam: { padding: 15 },
        };
      case "midhigh":
        return {
          ...ds,
          angleParam: { padding: Math.round(15 * uiState.resolution.factor) },
        };
      case "midlow":
        return {
          ...ds,
          angleParam: { padding: Math.round(15 * uiState.resolution.factor) },
        };
      case "low":
        return {
          ...ds,
          angleParam: { padding: Math.round(15 * uiState.resolution.factor) },
        };
    }
  });

  const loopSvg = useMemo((): LaurusClientSvg => {
    const loopType = rotate.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    const enabled = rotate.math.has(carouselEntryKey) ? true : false;
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
  }, [carouselEntryKey, rotate.math]);

  const loopSvgScale = useMemo((): number => {
    const loopType = rotate.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
    switch (loopType) {
      case LaurusLoopType.none:
        return 0.85;
      default:
        return 0.9;
    }
  }, [carouselEntryKey, rotate.math]);

  const loopType = useMemo((): LaurusLoopType => {
    return rotate.math.get(carouselEntryKey)?.loop ?? LaurusLoopType.none;
  }, [carouselEntryKey, rotate.math]);

  const getNextLoopType = useCallback((): LaurusLoopType => {
    const currentLoop = rotate.math.get(carouselEntryKey)?.loop;
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
  }, [carouselEntryKey, rotate.math]);

  const decrementLimitFactor = useCallback((): number => {
    const currentFactor = rotate.math.get(carouselEntryKey)?.limit_factor ?? defaultRotateEquation.limit_factor;
    return Math.max(MIN_LIMIT_FACTOR, Math.round((currentFactor - LIMIT_FACTOR_STEP) * 100) / 100);
  }, [carouselEntryKey, rotate.math]);

  const incrementLimitFactor = useCallback((): number => {
    const currentFactor = rotate.math.get(carouselEntryKey)?.limit_factor ?? defaultRotateEquation.limit_factor;
    return Math.min(MAX_LIMIT_FACTOR, Math.round((currentFactor + LIMIT_FACTOR_STEP) * 100) / 100);
  }, [carouselEntryKey, rotate.math]);

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
            if (rotate.locked || isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            const activeKey = carouselEntryKey;
            if (activeKey) {
              const nextLoop = getNextLoopType();
              const snapshot: LaurusRotateResult = { ...rotate };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    loop: nextLoop,
                  }
                : {
                    ...defaultRotateEquation,
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
                : rotate.locked || uiState.playbackMode.type !== "stopped"
                  ? ""
                  : rotate.math.has(carouselEntryKey)
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
          title="counterclockwise"
          onClick={() => {
            if (isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            const newCounterClockwise: boolean = !counterClockwise;
            const activeKey = carouselEntryKey;
            if (!activeKey) return;
            const snapshot: LaurusRotateResult = { ...rotate };
            const activeEquation = snapshot.math.get(activeKey);
            if (activeEquation) {
              const newAngle: number = ((currentAngle) => {
                const x = Math.abs(currentAngle);
                return newCounterClockwise ? x * -1 : x;
              })(activeEquation.angle);
              const newEquation: LaurusRotateEquation = {
                ...activeEquation,
                angle: newAngle,
              };
              saveNewEquation(snapshot, newEquation);
            } else {
              const newEquation: LaurusRotateEquation = {
                ...defaultRotateEquation,
                input_id: activeKey,
              };
              saveNewEquation(snapshot, newEquation);
            }
            setCounterClockwise(newCounterClockwise);
          }}
          style={{
            display: "grid",
            placeContent: "center",
            background: counterClockwise ? "rgba(255, 255, 255, 0.1)" : "none",
            ...dynamicSizes.paramButtonContainer,
          }}
        >
          <SvgRepo
            title="counterclockwise"
            svg={
              rotate.math.has(carouselEntryKey) ? updateCounterClockwise() : updateCounterClockwise("rgb(62, 62, 62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : rotate.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
                  ? "pointer"
                  : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.9}
            scaleToContaier={true}
          />
        </div>
        <div
          title="preview"
          onClick={() => {
            if (isAltKeyPressed || uiState.playbackMode.type !== "stopped") return;
            handlePlayTarget({
              inputKey: carouselEntryKey,
              getFrames: (apiOrigin) => getRotateFrames(apiOrigin, rotate.rotate_id, carouselEntryKey),
              effectKey: rotate.rotate_id,
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
              rotate.math.has(carouselEntryKey) && uiState.playbackMode.type === "stopped"
                ? playArrow()
                : playArrow("rgb(62, 62, 62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : rotate.math.has(carouselEntryKey) && uiState.playbackMode.type === "stopped"
                  ? "pointer"
                  : rotate.math.has(carouselEntryKey)
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
              rotate.locked ||
              uiState.playbackMode.type !== "stopped" ||
              (rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor == MAX_LIMIT_FACTOR)
            )
              return;
            const activeKey = carouselEntryKey;
            if (activeKey && rotate.math.has(activeKey)) {
              const nextFactor = incrementLimitFactor();
              const snapshot: LaurusRotateResult = { ...rotate };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    limit_factor: nextFactor,
                  }
                : {
                    ...defaultRotateEquation,
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
              rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor != MAX_LIMIT_FACTOR
                ? add2()
                : add2("rgb(62, 62, 62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : rotate.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
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
              rotate.locked ||
              uiState.playbackMode.type !== "stopped" ||
              (rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor == MIN_LIMIT_FACTOR)
            )
              return;
            const activeKey = carouselEntryKey;
            if (activeKey && rotate.math.has(activeKey)) {
              const nextFactor = decrementLimitFactor();
              const snapshot: LaurusRotateResult = { ...rotate };
              const activeEquation = snapshot.math.get(activeKey);
              const newEquation = activeEquation
                ? {
                    ...activeEquation,
                    limit_factor: nextFactor,
                  }
                : {
                    ...defaultRotateEquation,
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
              rotate.math.has(carouselEntryKey) && rotate.math.get(carouselEntryKey)!.limit_factor != MIN_LIMIT_FACTOR
                ? remove()
                : remove("rgb(62,62,62)")
            }
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : rotate.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
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
            let clipboardData: RotateUnitControls = { ...currentControls };
            const activeEquation = rotate.math.get(carouselEntryKey);
            if (activeEquation) {
              clipboardData = { ...activeEquation };
            }
            const currentEq: LaurusRotateEquation = {
              ...clipboardData,
              input_id: "clipboard",
              solution: defaultRotateEquation.solution,
            };
            const newMath: Map<string, LaurusRotateEquation> = new Map();
            newMath.set("clipboard", currentEq);
            const newClipboardEffect: LaurusEffect = {
              type: "rotate",
              key: rotate.rotate_id,
              value: { ...rotate, math: newMath },
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
            svg={rotate.math.has(carouselEntryKey) ? fileCopy() : fileCopy("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed ? "crosshair" : rotate.math.has(carouselEntryKey) ? "pointer" : "",
              ...dynamicSizes.paramButton,
            }}
            scale={0.8}
            scaleToContaier={true}
          />
        </div>
        <div
          title="paste"
          onClick={() => {
            if (isAltKeyPressed || uiState.playbackMode.type == "stopped") return;
            if (uiState.effectClipboard && uiState.effectClipboard.type == "rotate") {
              const clipboardEquation = uiState.effectClipboard.value.math.get("clipboard");
              if (!clipboardEquation) return;
              const snapshot: LaurusRotateResult = { ...rotate };
              const activeKey = carouselEntryKey;
              const newEquation: LaurusRotateEquation = {
                ...clipboardEquation,
              };
              const newControls: RotateUnitControls = { ...newEquation };
              setCurrentControls(newControls);
              updateTrackpads(newControls);
              if (activeKey) {
                const newMath: LaurusRotateEquation = {
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
            svg={uiState.effectClipboard?.type == "rotate" ? contentPaste() : contentPaste("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : rotate.math.has(carouselEntryKey) && uiState.playbackMode.type == "stopped"
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
            if (isAltKeyPressed || rotate.locked || uiState.playbackMode.type !== "stopped") return;
            const activeKey = carouselEntryKey;
            if (activeKey && rotate.math.has(activeKey)) {
              const confirmed = confirm("are you sure you want to clear this equation?");
              if (!confirmed) return;
              const snapshot: LaurusRotateResult = { ...rotate };
              const newMath = new Map(snapshot.math);
              newMath.delete(activeKey);
              const newRotate: LaurusRotateResult = {
                ...snapshot,
                math: newMath,
              };
              const defaultControls: RotateUnitControls = {
                ...defaultRotateEquation,
                time: 0,
              };
              setCurrentControls(defaultControls);
              updateTrackpads(defaultControls);
              dispatch({
                type: CoreActionType.SetEffect,
                value: {
                  type: "rotate",
                  value: { ...newRotate },
                  key: newRotate.rotate_id,
                },
              });
              const updated = await updateRotate(coreState.apiOrigin, coreState.accessToken, snapshot.rotate_id, {
                ...newRotate,
              });
              if (!updated) {
                dispatch({
                  type: CoreActionType.SetEffect,
                  value: {
                    type: "rotate",
                    value: { ...snapshot },
                    key: snapshot.rotate_id,
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
            svg={rotate.math.has(carouselEntryKey) ? cancelCircle() : cancelCircle("rgb(62, 62, 62)")}
            containerStyle={{
              cursor: isAltKeyPressed
                ? "crosshair"
                : rotate.locked || uiState.playbackMode.type !== "stopped"
                  ? ""
                  : rotate.math.has(carouselEntryKey)
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
