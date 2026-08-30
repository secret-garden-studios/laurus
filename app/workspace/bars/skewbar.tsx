import Dial from "@/app/components/dial";
import Toggle from "@/app/components/toggle";
import { LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { SvgRepo, skew300, updateCounterClockwise } from "@/app/svg-repo";
import { useCallback, useContext, useRef, useState } from "react";
import { UIContext, CoreContext, HoverContext } from "../workspace.client";
import { CoreActionType } from "../states/core-state";
import { mediaArm } from "../states/ui-state";
import ToolGreeting from "./tool-greeting";
import { dellaRespira } from "@/app/fonts";

function toDialAngle(v: number, counterClockwise: boolean): number {
  const x = Math.round(v) % 360;
  const x2 = x < 0 ? x + 360 : x;
  return counterClockwise ? x2 * -1 : x2;
}

export default function Skewbar() {
  const { coreState, dispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const { selectedImgKeys, selectedSvgKeys, selectedMaskKeys } = useContext(HoverContext);
  const arm = mediaArm(uiState, "skew", selectedImgKeys, selectedSvgKeys, selectedMaskKeys);
  const [saving, setSaving] = useState(false);
  const [dynamicSizes] = useState(() => {
    const fill = { width: "100%", height: "100%" };
    const inputWidth = "4ch";
    switch (uiState.resolution.type) {
      case "high":
        return {
          svgSize: { width: 22, height: 22 },
          group: { paddingLeft: 20, paddingRight: 20, gap: 12, fontSize: 13 },
          toggle: {
            track: { width: 26, height: 12, borderRadius: 10, padding: 1 },
            button: { width: 8, height: 8 },
            translateX: 14,
          },
          dial: 36,
          input: { fontSize: 16, width: inputWidth, padding: 0 },
          container: fill,
          greeting: { height: "100%" },
          axisGroup: { height: "100%" },
          pair: { height: "100%", gap: 4 },
          ccwSvg: { width: 16, height: 16 },
        };
      case "midhigh":
        return {
          svgSize: { width: 18, height: 18 },
          group: { paddingLeft: 14, paddingRight: 14, gap: 8, fontSize: 12 },
          toggle: {
            track: { width: 22, height: 10, borderRadius: 10, padding: 1 },
            button: { width: 6, height: 6 },
            translateX: 12,
          },
          dial: 44,
          input: { fontSize: 13, width: inputWidth, padding: 0 },
          container: fill,
          greeting: { height: "100%" },
          axisGroup: { height: "100%" },
          pair: { height: "100%", gap: 3 },
          ccwSvg: { width: 13, height: 13 },
        };
      case "midlow":
      case "low":
        return {
          svgSize: { width: 16, height: 16 },
          group: { paddingLeft: 12, paddingRight: 12, gap: 8, fontSize: 11 },
          toggle: {
            track: { width: 20, height: 9, borderRadius: 10, padding: 1 },
            button: { width: 5, height: 5 },
            translateX: 11,
          },
          dial: 50,
          input: { fontSize: 12, width: inputWidth, padding: 0 },
          container: fill,
          greeting: { height: "100%" },
          axisGroup: { height: "100%" },
          pair: { height: "100%", gap: 3 },
          ccwSvg: { width: 11, height: 11 },
        };
    }
  });

  const axRef = useRef<HTMLInputElement>(null);
  const ayRef = useRef<HTMLInputElement>(null);

  const activeSkew = ((): [number, number] => {
    if (!arm) return [0, 0];
    switch (arm.type) {
      case "svg": {
        const svg = coreState.project.svgs.get(arm.key);
        return svg ? [svg.skew_ax, svg.skew_ay] : [0, 0];
      }
      case "img": {
        const img = coreState.project.imgs.get(arm.key);
        return img ? [img.skew_ax, img.skew_ay] : [0, 0];
      }
      case "mask": {
        const mask = coreState.project.masks.get(arm.key);
        return mask ? [mask.skew_ax, mask.skew_ay] : [0, 0];
      }
    }
  })();

  const saveSkew = useCallback(
    async (key: string, elementType: string, sAx: number | undefined, sAy: number | undefined) => {
      const snapshot: LaurusProjectResult = { ...coreState.project };
      switch (elementType) {
        case "svg": {
          const newSvg = snapshot.svgs.get(key);
          if (newSvg) {
            const rollbackSvgs = new Map(snapshot.svgs);
            const newSvgs = new Map(snapshot.svgs);
            newSvgs.set(key, {
              ...newSvg,
              ...(sAx !== undefined && { skew_ax: sAx }),
              ...(sAy !== undefined && { skew_ay: sAy }),
            });
            const newProject: LaurusProjectResult = { ...snapshot, svgs: newSvgs };
            const saved = await updateProject(
              coreState.apiOrigin,
              coreState.accessToken,
              newProject.project_id,
              newProject,
            );
            if (saved) {
              dispatch({ type: CoreActionType.SetProject, value: { ...newProject } });
            } else {
              dispatch({ type: CoreActionType.SetProject, value: { ...snapshot, svgs: rollbackSvgs } });
            }
          }
          break;
        }
        case "img": {
          const newImg = snapshot.imgs.get(key);
          if (newImg) {
            const rollbackImgs = new Map(snapshot.imgs);
            const newImgs = new Map(snapshot.imgs);
            newImgs.set(key, {
              ...newImg,
              ...(sAx !== undefined && { skew_ax: sAx }),
              ...(sAy !== undefined && { skew_ay: sAy }),
            });
            const newProject: LaurusProjectResult = { ...snapshot, imgs: newImgs };
            const saved = await updateProject(
              coreState.apiOrigin,
              coreState.accessToken,
              newProject.project_id,
              newProject,
            );
            if (saved) {
              dispatch({ type: CoreActionType.SetProject, value: { ...newProject } });
            } else {
              dispatch({ type: CoreActionType.SetProject, value: { ...snapshot, imgs: rollbackImgs } });
            }
          }
          break;
        }
        case "mask": {
          const newMask = snapshot.masks.get(key);
          if (newMask) {
            const rollbackMasks = new Map(snapshot.masks);
            const newMasks = new Map(snapshot.masks);
            newMasks.set(key, {
              ...newMask,
              ...(sAx !== undefined && { skew_ax: sAx }),
              ...(sAy !== undefined && { skew_ay: sAy }),
            });
            const newProject: LaurusProjectResult = { ...snapshot, masks: newMasks };
            const saved = await updateProject(
              coreState.apiOrigin,
              coreState.accessToken,
              newProject.project_id,
              newProject,
            );
            if (saved) {
              dispatch({ type: CoreActionType.SetProject, value: { ...newProject } });
            } else {
              dispatch({ type: CoreActionType.SetProject, value: { ...snapshot, masks: rollbackMasks } });
            }
          }
          break;
        }
      }
    },
    [coreState.accessToken, coreState.apiOrigin, coreState.project, dispatch],
  );

  if (!arm) {
    return (
      <ToolGreeting
        title="skew"
        svg={skew300()}
        svgSize={dynamicSizes.svgSize}
        textStyle={dynamicSizes.group}
        containerStyle={dynamicSizes.container}
      >
        {"click an image, an svg or a mask on the canvas to skew it"}
      </ToolGreeting>
    );
  }

  const axes = [
    { axis: "ax" as const, value: activeSkew[0], inputRef: axRef },
    { axis: "ay" as const, value: activeSkew[1], inputRef: ayRef },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", overflowX: "auto", ...dynamicSizes.container }}>
      <SvgRepo
        title="skew"
        svg={skew300()}
        containerStyle={{ ...dynamicSizes.svgSize }}
        scale={1}
        scaleToContaier={true}
      />
      {axes.map(({ axis, value, inputRef }) => {
        const counterClockwise = value < 0;
        const write = async (next: number) => {
          if (saving) return;
          setSaving(true);
          try {
            await saveSkew(arm.key, arm.type, axis === "ax" ? next : undefined, axis === "ay" ? next : undefined);
          } finally {
            setSaving(false);
          }
        };
        return (
          <div
            key={axis}
            style={{
              display: "flex",
              alignItems: "center",
              ...dynamicSizes.axisGroup,
              ...dynamicSizes.group,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", ...dynamicSizes.pair }}>
              <span style={{ userSelect: "none" }}>{axis}</span>
              <input
                className={dellaRespira.className}
                key={`${arm.key}|skew${axis}|${value}`}
                id={`${arm.key}|skew${axis}`}
                disabled
                ref={inputRef}
                defaultValue={value.toFixed() + "\xB0"}
                type="text"
                placeholder="0°"
                style={{
                  textAlign: "center",
                  background: "none",
                  color: "rgba(255, 255, 255, 0.8)",
                  border: "none",
                  outline: "none",
                  display: "inline-block",
                  ...dynamicSizes.input,
                }}
              />
            </div>
            <Dial
              resolution={{ ...uiState.resolution }}
              ids={{
                contextId: `${arm.key}|skew${axis}|c1`,
                draggableId: `${arm.key}|skew${axis}|d1`,
              }}
              value={Math.abs(value)}
              onMove={(v) => {
                if (!inputRef.current) return;
                inputRef.current.value = toDialAngle(v, counterClockwise).toFixed() + "\xB0";
              }}
              onNewValue={(v: number) => {
                write(toDialAngle(v, counterClockwise));
              }}
              disabled={saving}
              size={{
                container: dynamicSizes.dial,
                gauge: dynamicSizes.dial,
                gaugeTick: dynamicSizes.dial * (7 / 90),
                dial: dynamicSizes.dial * (80 / 90),
                dialTick: dynamicSizes.dial * (11 / 90),
              }}
            />
            <div style={{ display: "flex", alignItems: "center", ...dynamicSizes.pair }}>
              <SvgRepo
                containerStyle={{ ...dynamicSizes.ccwSvg }}
                scale={1}
                scaleToContaier={true}
                title={`${axis} counterclockwise`}
                svg={updateCounterClockwise()}
              />

              <Toggle
                value={counterClockwise}
                disabled={saving}
                onClick={() => {
                  const magnitude = Math.abs(value);
                  write(counterClockwise ? magnitude : magnitude * -1);
                }}
                trackStyles={{ ...dynamicSizes.toggle.track }}
                buttonStyles={{ ...dynamicSizes.toggle.button }}
                translateX={dynamicSizes.toggle.translateX}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
