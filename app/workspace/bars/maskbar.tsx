import { useContext, useMemo, useRef, useState, CSSProperties, useCallback, useEffect } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { SvgRepo, texture300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import styles from "@/app/app.module.css";
import { CoreActionType } from "../states/core-state";
import { maskArm, UIActionType } from "../states/ui-state";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { UNAUTHORIZED_EDIT } from "@/app/landing.server";
import { LaurusImgResult } from "../workspace.server";
import { WorkspaceResolution } from "../workspace.config";
import { TEXTURE_MIX_DEFAULT } from "../mask-gl";

const GRIDLINES_OPTIONS = [
  { label: "off", value: 0 },
  { label: "dim", value: 0.5 },
  { label: "bright", value: 1 },
] as const;

function maskbarSizes(resolution: WorkspaceResolution) {
  switch (resolution.type) {
    case "high":
      return {
        flex: {
          gap: 0,
        },
        svgSize: {
          width: 22,
          height: 22,
        },
        toggle: {
          div: {
            paddingLeft: 20,
            paddingRight: 20,
            gap: 12,
            fontSize: 13,
          },
          track: {
            width: 26,
            height: 12,
            borderRadius: 10,
            padding: 1,
          },
          button: {
            width: 8,
            height: 8,
          },
          translateX: 14,
        },
        input: {
          container: {
            gap: 10,
            paddingRight: 20,
          },
          label: {
            fontSize: 12,
          },
          input: {
            fontSize: 12,
            padding: 4,
            letterSpacing: 1,
          },
        },
      };
    case "midhigh":
      return {
        flex: {
          gap: 0,
        },
        svgSize: {
          width: 18,
          height: 18,
        },
        toggle: {
          div: {
            paddingLeft: 14,
            paddingRight: 14,
            gap: 8,
            fontSize: 12,
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
        input: {
          container: {
            gap: 10,
            paddingRight: 14,
          },
          label: {
            fontSize: 11,
          },
          input: {
            fontSize: 11,
            padding: 4,
            letterSpacing: 1,
          },
        },
      };
    case "low":
    case "midlow":
      return {
        flex: {
          gap: 0,
        },
        svgSize: {
          width: 20,
          height: 20,
        },
        toggle: {
          div: {
            paddingLeft: 16,
            paddingRight: 16,
            gap: 12,
            fontSize: 12,
          },
          track: {
            width: 20,
            height: 9,
            borderRadius: 10,
            padding: 1,
          },
          button: {
            width: 6,
            height: 6,
          },
          translateX: 10,
        },
        input: {
          container: {
            gap: 10,
            paddingRight: 16,
          },
          label: {
            fontSize: 11,
          },
          input: {
            fontSize: 11,
            padding: 4,
            letterSpacing: 1,
          },
        },
      };
  }
}

type MaskbarSizes = ReturnType<typeof maskbarSizes>;

export default function Maskbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { selectedMaskKeys } = useContext(HoverContext);
  const { notifyMaskToolChanged, status, reset } = useContext(MaskContext);
  const [dynamicSizes] = useState(() => maskbarSizes(uiState.resolution));

  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const arm = maskArm(uiState, selectedMaskKey);
  const armType = arm?.type;
  const armedImgKey = arm?.type === "img" ? arm.img.media_key : undefined;

  useEffect(() => {
    if (status === "connecting" || status === "streaming") return;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armedImgKey]);

  useEffect(() => {
    if (uiState.tool.type !== "mask") return;
    const nextLight = armType === "mask" && uiState.tool.lightingMeshSection;
    const nextRaising = armType !== undefined && uiState.tool.raisingObjects;
    if (nextLight === uiState.tool.lightingMeshSection && nextRaising === uiState.tool.raisingObjects) return;
    uiDispatch({
      type: UIActionType.SetTool,
      value: { type: "mask", lightingMeshSection: nextLight, raisingObjects: nextRaising },
    });
    notifyMaskToolChanged("mask");
  }, [armType, uiState.tool, uiDispatch, notifyMaskToolChanged]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        overflow: "auto",
        ...dynamicSizes.flex,
      }}
    >
      <SvgRepo
        title="mask"
        svg={texture300()}
        containerStyle={{
          width: dynamicSizes.svgSize.width,
          height: dynamicSizes.svgSize.height,
        }}
        scale={1}
        scaleToContaier={true}
      />
      {arm === undefined ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            ...dynamicSizes.toggle.div,
            overflowX: "auto",
          }}
        >
          <div
            style={{
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {
              "select an image from the browser to generate a mask, or select an existing mask to add lights and objects to it"
            }
          </div>
        </div>
      ) : arm.type === "img" ? (
        <MaskGenerationControls img={arm.img} />
      ) : (
        <MaskMeshControls maskKey={arm.maskKey} />
      )}
    </div>
  );
}

interface MaskGenerationControls {
  img: LaurusImgResult;
}

function MaskGenerationControls({ img }: MaskGenerationControls) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const {
    notifyMaskToolChanged,
    position,
    setPosition,
    size,
    setSize,
    resolution,
    setResolution,
    textureMix,
    setTextureMix,
  } = useContext(MaskContext);
  const [dynamicSizes] = useState(() => maskbarSizes(uiState.resolution));

  const xInputRef = useRef<HTMLInputElement | null>(null);
  const yInputRef = useRef<HTMLInputElement | null>(null);
  const wInputRef = useRef<HTMLInputElement | null>(null);
  const hInputRef = useRef<HTMLInputElement | null>(null);

  const isPositionOn = position.value;
  const isSizeOn = size.value;
  const xValue = position.x?.toString() ?? "0";
  const yValue = position.y?.toString() ?? "0";
  const widthValue = size.width?.toFixed() ?? "0";
  const heightValue = size.height?.toFixed() ?? "0";
  const positionInputStyle = useMemo<CSSProperties>(() => {
    return {
      textAlign: "center",
      background: "none",
      color: isPositionOn ? "inherit" : "rgb(67,67,67)",
      border: "none",
      outline: "none",
      display: "inline-block",
      overflowX: "scroll",
      width: "6ch",
      ...dynamicSizes.input.input,
    };
  }, [dynamicSizes.input.input, isPositionOn]);
  const sizeInputStyle = useMemo<CSSProperties>(() => {
    return {
      textAlign: "center",
      background: "none",
      color: isSizeOn ? "inherit" : "rgb(67,67,67)",
      border: "none",
      outline: "none",
      display: "inline-block",
      overflowX: "scroll",
      width: "6ch",
      ...dynamicSizes.input.input,
    };
  }, [dynamicSizes.input.input, isSizeOn]);

  const updateToolPosition = useCallback(() => {
    const newX = parseFloat(xInputRef.current?.value || "");
    const newY = parseFloat(yInputRef.current?.value || "");
    setPosition((prev) => ({
      ...prev,
      x: isNaN(newX) ? undefined : newX,
      y: isNaN(newY) ? undefined : newY,
    }));
  }, [setPosition]);

  const sourceAspectRatio = useMemo(() => {
    if (!img.height) return undefined;
    return img.width / img.height;
  }, [img.width, img.height]);

  const updateToolWidth = useCallback(() => {
    const newWidth = parseFloat(wInputRef.current?.value || "");
    setSize((prev) => ({
      ...prev,
      width: isNaN(newWidth) ? undefined : newWidth,
      height: isNaN(newWidth) || !sourceAspectRatio ? prev.height : newWidth / sourceAspectRatio,
    }));
  }, [sourceAspectRatio, setSize]);

  const updateToolHeight = useCallback(() => {
    const newHeight = parseFloat(hInputRef.current?.value || "");
    setSize((prev) => ({
      ...prev,
      height: isNaN(newHeight) ? undefined : newHeight,
      width: isNaN(newHeight) || !sourceAspectRatio ? prev.width : newHeight * sourceAspectRatio,
    }));
  }, [sourceAspectRatio, setSize]);

  const isObjectsOn = uiState.tool.type === "mask" && uiState.tool.raisingObjects;

  return (
    <>
      <div
        style={{
          display: "flex",
          height: "100%",
          alignItems: "center",
          ...dynamicSizes.input.container,
        }}
      >
        <div
          title={"place the generated mask at an exact x/y position"}
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ textShadow: isPositionOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"position"}</span>
          <Toggle
            value={isPositionOn}
            onClick={() => {
              const newPositionValue = !isPositionOn;
              const newX = parseFloat(xInputRef.current?.value || "");
              const newY = parseFloat(yInputRef.current?.value || "");
              setPosition({
                value: newPositionValue,
                x: newPositionValue && !isNaN(newX) ? newX : undefined,
                y: newPositionValue && !isNaN(newY) ? newY : undefined,
              });
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: isPositionOn ? "inherit" : "rgb(67,67,67)",
            ...dynamicSizes.input.label,
          }}
        >
          {"x"}
        </div>
        <input
          className={styles["numberInput"]}
          id={`${img.media_key}|input|x`}
          disabled={!isPositionOn}
          ref={xInputRef}
          onChange={updateToolPosition}
          type="text"
          value={xValue}
          autoComplete="off"
          style={positionInputStyle}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: isPositionOn ? "inherit" : "rgb(67,67,67)",
            ...dynamicSizes.input.label,
          }}
        >
          {"y"}
        </div>
        <input
          className={styles["numberInput"]}
          id={`${img.media_key}|input|y`}
          disabled={!isPositionOn}
          ref={yInputRef}
          onChange={updateToolPosition}
          type="text"
          value={yValue}
          autoComplete="off"
          style={positionInputStyle}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.input.container,
        }}
      >
        <div
          title={"size the generated mask to an exact width/height"}
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ textShadow: isSizeOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"size"}</span>
          <Toggle
            value={isSizeOn}
            onClick={() => {
              const newSizeValue = !isSizeOn;
              setSize(
                newSizeValue
                  ? { value: true, width: img.width, height: img.height }
                  : { value: false, width: undefined, height: undefined },
              );
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: isSizeOn ? "inherit" : "rgb(67,67,67)",
            ...dynamicSizes.input.label,
          }}
        >
          {"width"}
        </div>
        <input
          className={styles["numberInput"]}
          id={`${img.media_key}|input|w`}
          disabled={!isSizeOn}
          ref={wInputRef}
          onChange={updateToolWidth}
          type="text"
          value={widthValue}
          autoComplete="off"
          style={sizeInputStyle}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: isSizeOn ? "inherit" : "rgb(67,67,67)",
            ...dynamicSizes.input.label,
          }}
        >
          {"height"}
        </div>
        <input
          className={styles["numberInput"]}
          id={`${img.media_key}|input|h`}
          disabled={!isSizeOn}
          ref={hInputRef}
          onChange={updateToolHeight}
          type="text"
          value={heightValue}
          autoComplete="off"
          style={sizeInputStyle}
        />
      </div>
      <div
        title={"how finely the generated mask is triangulated"}
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span>{"resolution"}</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            letterSpacing: 2,
          }}
        >
          {([1, 2, 3] as const).map((factor) => {
            const isSelected = resolution === factor;
            return (
              <span
                key={factor}
                onClick={() => setResolution(factor)}
                style={{
                  cursor: "pointer",
                  color: isSelected ? "inherit" : "rgb(67,67,67)",
                  textShadow: isSelected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                  padding: "4px 8px",
                  ...dynamicSizes.input.label,
                }}
              >
                {`${factor}x`}
              </span>
            );
          })}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <Gridlines value={textureMix} onChange={setTextureMix} dynamicSizes={dynamicSizes} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isObjectsOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>
          {"generate objects"}
        </span>
        <Toggle
          value={isObjectsOn}
          onClick={() => {
            if (uiState.tool.type !== "mask") return;
            uiDispatch({
              type: UIActionType.SetTool,
              value: { ...uiState.tool, raisingObjects: !isObjectsOn, lightingMeshSection: false },
            });
            notifyMaskToolChanged("mask");
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      <div />
    </>
  );
}

interface MaskMeshControls {
  maskKey: string;
}

function MaskMeshControls({ maskKey }: MaskMeshControls) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreState, dispatch } = useContext(CoreContext);
  const { notifyMaskToolChanged, notifyMaskAppearanceChanged } = useContext(MaskContext);
  const [dynamicSizes] = useState(() => maskbarSizes(uiState.resolution));

  const maskMeta = coreState.project.masks.get(maskKey);
  const isGuest = !coreState.accessToken;
  const isLightOn = uiState.tool.type === "mask" && uiState.tool.lightingMeshSection;
  const isObjectsOn = uiState.tool.type === "mask" && uiState.tool.raisingObjects;

  const pendingGridlinesSaveRef = useRef<LaurusProjectResult | null>(null);
  const isPersistingGridlinesRef = useRef(false);
  const persistGridlinesQueue = useCallback(async () => {
    if (isPersistingGridlinesRef.current) return;
    isPersistingGridlinesRef.current = true;
    try {
      while (pendingGridlinesSaveRef.current) {
        const projectToSave = pendingGridlinesSaveRef.current;
        pendingGridlinesSaveRef.current = null;
        const saved = await updateProject(coreState.apiOrigin, coreState.accessToken, projectToSave.project_id, {
          ...projectToSave,
        });
        if (!saved) {
          console.error("failed to save gridlines change", { project_id: projectToSave.project_id });
        }
      }
    } finally {
      isPersistingGridlinesRef.current = false;
    }
  }, [coreState.apiOrigin, coreState.accessToken]);

  const saveGridlinesField = useCallback(
    (value: number) => {
      if (!maskMeta) return;
      if (isGuest) {
        alert(UNAUTHORIZED_EDIT);
        return;
      }
      const newMasks = new Map(coreState.project.masks);
      const newMaskMeta: LaurusProjectMask = { ...maskMeta, texture: value };
      newMasks.set(maskKey, newMaskMeta);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      notifyMaskAppearanceChanged(maskKey, { textureMix: value });
      pendingGridlinesSaveRef.current = newProject;
      void persistGridlinesQueue();
    },
    [isGuest, maskKey, maskMeta, coreState.project, dispatch, notifyMaskAppearanceChanged, persistGridlinesQueue],
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          ...dynamicSizes.toggle.div,
        }}
      >
        <Gridlines
          value={maskMeta?.texture ?? TEXTURE_MIX_DEFAULT}
          onChange={saveGridlinesField}
          dynamicSizes={dynamicSizes}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isLightOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"add light"}</span>
        <Toggle
          value={isLightOn}
          onClick={() => {
            if (uiState.tool.type !== "mask") return;
            uiDispatch({
              type: UIActionType.SetTool,
              value: { ...uiState.tool, lightingMeshSection: !isLightOn, raisingObjects: false },
            });
            notifyMaskToolChanged("mask");
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isObjectsOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"add object"}</span>
        <Toggle
          value={isObjectsOn}
          onClick={() => {
            if (uiState.tool.type !== "mask") return;
            uiDispatch({
              type: UIActionType.SetTool,
              value: { ...uiState.tool, raisingObjects: !isObjectsOn, lightingMeshSection: false },
            });
            notifyMaskToolChanged("mask");
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      <div />
    </>
  );
}

interface Gridlines {
  value: number;
  onChange: (value: number) => void;
  dynamicSizes: MaskbarSizes;
}

function Gridlines({ value, onChange, dynamicSizes }: Gridlines) {
  const selected = useMemo(
    () =>
      GRIDLINES_OPTIONS.reduce((closest, option) =>
        Math.abs(option.value - value) < Math.abs(closest.value - value) ? option : closest,
      ).value,
    [value],
  );

  return (
    <>
      <span>{"gridlines"}</span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          letterSpacing: 2,
        }}
      >
        {GRIDLINES_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <span
              key={option.label}
              onClick={() => onChange(option.value)}
              style={{
                cursor: "pointer",
                color: isSelected ? "inherit" : "rgb(67,67,67)",
                textShadow: isSelected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                padding: "4px 8px",
                ...dynamicSizes.input.label,
              }}
            >
              {option.label}
            </span>
          );
        })}
      </div>
    </>
  );
}
