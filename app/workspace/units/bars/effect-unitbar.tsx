import { SvgRepo, allOut, circle, earthquake, experiment, lock, lockOpenRight, cycle400, tune } from "@/app/svg-repo";
import { Dispatch, SetStateAction, useCallback, useContext, useMemo, useState } from "react";
import { CoreContext, HoverContext, UIContext } from "../../workspace.client";
import {
  deleteMove,
  deleteRotate,
  deleteScale,
  LaurusEffect,
  LaurusMixState,
  LaurusMoveResult,
  LaurusRotateResult,
  LaurusScaleResult,
} from "../../workspace.server";
import styles from "@/app/app.module.css";
import { CoreActionType } from "../../states/core-state";

interface EffectUnitbar {
  effect: LaurusEffect;
  showUnitControls: boolean;
  setShowUnitControls: Dispatch<SetStateAction<boolean>>;
  setMoveCarouselIndex: Dispatch<SetStateAction<number>>;
  setRotateCarouselIndex: Dispatch<SetStateAction<number>>;
  setScaleCarouselIndex: Dispatch<SetStateAction<number>>;
  saveEffect: (effect: LaurusEffect, rollback: LaurusEffect) => Promise<void>;
}
export default function EffectUnitbar({
  effect,
  showUnitControls,
  setShowUnitControls,
  saveEffect,
  setMoveCarouselIndex,
  setRotateCarouselIndex,
  setScaleCarouselIndex,
}: EffectUnitbar) {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { isAltKeyPressed } = useContext(HoverContext);

  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          toolbar: {
            width: 24,
          },
        };
      case "midhigh":
        return {
          toolbar: {
            width: 19,
          },
        };
      case "midlow":
      case "low":
        return {
          toolbar: {
            width: 19,
          },
        };
    }
  });

  const effectIsMixableAndHasMixState = useMemo(() => {
    if (!uiState.mixableEffects) return false;
    return (
      uiState.mixableEffects.includes(effect.type) &&
      effect.value.mixState &&
      effect.value.mixState !== LaurusMixState.None
    );
  }, [uiState.mixableEffects, effect.type, effect.value.mixState]);

  const deleteEffect = useCallback(
    async (effect: LaurusEffect) => {
      switch (effect.type) {
        case "move": {
          const deleted = await deleteMove(coreState.apiOrigin, coreState.accessToken, effect.value.move_id);
          if (deleted) {
            dispatch({ type: CoreActionType.DeleteEffect, key: effect.key });
          }
          break;
        }
        case "rotate": {
          const deleted = await deleteRotate(coreState.apiOrigin, coreState.accessToken, effect.value.rotate_id);
          if (deleted) {
            dispatch({ type: CoreActionType.DeleteEffect, key: effect.key });
          }
          break;
        }
        case "scale": {
          const deleted = await deleteScale(coreState.apiOrigin, coreState.accessToken, effect.value.scale_id);
          if (deleted) {
            dispatch({ type: CoreActionType.DeleteEffect, key: effect.key });
          }
          break;
        }
      }
    },
    [coreState.accessToken, coreState.apiOrigin, dispatch],
  );

  return (
    <>
      <div
        style={{
          height: "100%",
          background: "rgba(22, 22, 22, 0.9)",
          display: "flex",
          flexDirection: "column",
          ...dynamicSizes.toolbar,
        }}
      >
        <SvgRepo
          svg={(() => {
            switch (effect.type) {
              case "scale":
                return allOut();
              case "move":
                return earthquake();
              case "rotate":
                return cycle400();
            }
          })()}
          scale={0.6}
          scaleToContaier={true}
          containerStyle={{
            width: dynamicSizes.toolbar.width,
            height: dynamicSizes.toolbar.width,
            cursor: isAltKeyPressed ? "crosshair" : "",
          }}
        />
        <SvgRepo
          title={"parameters"}
          svg={tune()}
          scale={0.65}
          scaleToContaier={true}
          onContainerClick={() => {
            if (isAltKeyPressed) return;
            const closed = !showUnitControls;
            if (closed) {
              if (!uiState.activeElement) {
                switch (effect.type) {
                  case "move": {
                    const moveEqautionKeys = Array.from(effect.value.math.keys());
                    const keys = uiState.carouselEntries;
                    const k = keys.findIndex((k) => moveEqautionKeys.includes(k.key));
                    const newIndex = k > -1 ? k : 0;
                    setMoveCarouselIndex(newIndex);
                    break;
                  }
                  case "rotate": {
                    const eqKeys = Array.from(effect.value.math.keys());
                    const carouselKeys = uiState.carouselEntries;
                    const k = carouselKeys.findIndex((k) => eqKeys.includes(k.key));
                    const newIndex = k > -1 ? k : 0;
                    setRotateCarouselIndex(newIndex);
                    break;
                  }
                  case "scale": {
                    const moveEqautionKeys = Array.from(effect.value.math.keys());
                    const keys = uiState.carouselEntries;
                    const k = keys.findIndex((k) => moveEqautionKeys.includes(k.key));
                    const newIndex = k > -1 ? k : 0;
                    setScaleCarouselIndex(newIndex);
                    break;
                  }
                }
              } else if (uiState.activeElement.locallyActivatedEffectKey == undefined) {
                const activeKey = uiState.activeElement.key;
                const initialIndex = uiState.carouselEntries.findIndex((c) => c.key == activeKey);
                if (initialIndex > -1) {
                  setScaleCarouselIndex(initialIndex);
                  setMoveCarouselIndex(initialIndex);
                  setRotateCarouselIndex(initialIndex);
                }
              }
              setShowUnitControls(true);
            } else {
              setShowUnitControls(false);
            }
          }}
          containerStyle={{
            cursor: isAltKeyPressed ? "crosshair" : "pointer",
            width: dynamicSizes.toolbar.width,
            height: dynamicSizes.toolbar.width,
            background: showUnitControls ? "rgba(255,255,255,0.075)" : "none",
            border: "1px solid rgba(0,0,0,0)",
          }}
        />
        {effectIsMixableAndHasMixState &&
          (() => {
            return (
              <>
                <div
                  style={{
                    position: "relative",
                    width: dynamicSizes.toolbar.width,
                    height: dynamicSizes.toolbar.width,
                  }}
                >
                  <SvgRepo
                    title={"mix"}
                    svg={experiment()}
                    scale={0.65}
                    scaleToContaier={true}
                    containerStyle={{
                      width: dynamicSizes.toolbar.width,
                      height: dynamicSizes.toolbar.width,
                      border: "1px solid rgba(0,0,0,0)",
                      transition: "all 0.2s ease-out",
                      animation:
                        effect.value.mixState === LaurusMixState.Waiting ||
                        effect.value.mixState === LaurusMixState.Selected
                          ? `${styles["pulse-opacity"]} 1.5s infinite`
                          : "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: dynamicSizes.toolbar.width,
                      height: dynamicSizes.toolbar.width,
                      background:
                        effect.value.mixState === LaurusMixState.Selected ? "rgba(255, 255, 255, 0.075)" : "none",
                      border: "1px solid rgba(0,0,0,0)",
                      cursor: isAltKeyPressed
                        ? "crosshair"
                        : effect.value.mixState === LaurusMixState.Waiting ||
                            effect.value.mixState === LaurusMixState.Selected
                          ? "pointer"
                          : "",
                    }}
                    onClick={() => {
                      if (isAltKeyPressed) return;
                      const newEffects: LaurusEffect[] = coreState.effects.map((e) => {
                        if (e.key !== effect.key) return e;
                        const currentMixUiState = e.value.mixState;
                        if (!currentMixUiState) return e;
                        const newMixUiState =
                          currentMixUiState == LaurusMixState.Waiting
                            ? LaurusMixState.Selected
                            : currentMixUiState == LaurusMixState.Selected
                              ? LaurusMixState.Waiting
                              : undefined;

                        if (uiState.mixableEffects.includes(e.type)) {
                          switch (e.type) {
                            case "move":
                              return {
                                ...e,
                                value: {
                                  ...e.value,
                                  mixState: newMixUiState,
                                } as LaurusMoveResult,
                              };
                            case "rotate":
                              return {
                                ...e,
                                value: {
                                  ...e.value,
                                  mixState: newMixUiState,
                                } as LaurusRotateResult,
                              };
                            case "scale":
                              return {
                                ...e,
                                value: {
                                  ...e.value,
                                  mixState: newMixUiState,
                                } as LaurusScaleResult,
                              };
                          }
                        }
                        return e;
                      });
                      dispatch({
                        type: CoreActionType.SetEffects,
                        value: newEffects,
                      });
                    }}
                  />
                </div>
              </>
            );
          })()}
        <SvgRepo
          title={"lock"}
          svg={effect.value.locked ? lock() : lockOpenRight()}
          scale={0.6}
          scaleToContaier={true}
          onContainerClick={async () => {
            if (isAltKeyPressed) return;
            const rollback: LaurusEffect = { ...effect };
            let newEffect: LaurusEffect;
            switch (effect.type) {
              case "scale":
                newEffect = {
                  ...effect,
                  value: { ...effect.value, locked: !effect.value.locked },
                };
                break;
              case "move":
                newEffect = {
                  ...effect,
                  value: { ...effect.value, locked: !effect.value.locked },
                };
                break;
              case "rotate":
                newEffect = {
                  ...effect,
                  value: { ...effect.value, locked: !effect.value.locked },
                };
                break;
            }
            await saveEffect(newEffect, rollback);
          }}
          containerStyle={{
            width: dynamicSizes.toolbar.width,
            height: dynamicSizes.toolbar.width,
            cursor: isAltKeyPressed ? "crosshair" : "pointer",
            background: "none",
            border: "1px solid rgba(0,0,0,0)",
            transition: "border-left 0.25s ease-out",
          }}
        />
        <SvgRepo
          title={"disable"}
          svg={effect.value.disabled ? circle("rgb(255, 255, 95)") : circle("rgba(255, 255, 255, 0.15)")}
          scale={0.5}
          scaleToContaier={true}
          onContainerClick={async () => {
            if (isAltKeyPressed) return;
            const rollback: LaurusEffect = { ...effect };
            let newEffect: LaurusEffect;
            switch (effect.type) {
              case "scale":
                newEffect = {
                  ...effect,
                  value: { ...effect.value, disabled: !effect.value.disabled },
                };
                break;
              case "move":
                newEffect = {
                  ...effect,
                  value: { ...effect.value, disabled: !effect.value.disabled },
                };
                break;
              case "rotate":
                newEffect = {
                  ...effect,
                  value: { ...effect.value, disabled: !effect.value.disabled },
                };
                break;
            }
            await saveEffect(newEffect, rollback);
          }}
          containerStyle={{
            width: dynamicSizes.toolbar.width,
            height: dynamicSizes.toolbar.width,
            cursor: isAltKeyPressed ? "crosshair" : "pointer",
            background: "none",
            border: "1px solid rgba(0,0,0,0)",
            transition: "border-left 0.25s ease-out",
          }}
        />
        {showUnitControls && (
          <>
            <SvgRepo
              title={"delete"}
              svg={circle("rgb(220, 112, 112)")}
              scale={0.5}
              scaleToContaier={true}
              onContainerClick={() => {
                if (isAltKeyPressed) return;
                const confirmed = confirm("are you sure you want to delete this effect?");
                if (confirmed) {
                  deleteEffect(effect);
                }
              }}
              containerStyle={{
                cursor: isAltKeyPressed ? "crosshair" : "pointer",
                width: dynamicSizes.toolbar.width,
                height: dynamicSizes.toolbar.width,
                background: "none",
                border: "1px solid rgba(0,0,0,0)",
                transition: "border-left 0.25s ease-out",
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
