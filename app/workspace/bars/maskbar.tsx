import { useContext, useMemo, useRef, useState, CSSProperties, useCallback, useEffect } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { SvgRepo, texture300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { ParameterSliderX } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import styles from "@/app/app.module.css";
import { CoreActionType } from "../states/core-state";
import { TopologyMode, UIActionType } from "../states/ui-state";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { ObjectShapeResult, buildObjectShapeFromMarkup, decodeSvgMarkup } from "../canvas-media/object-shape";

export default function Maskbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreState, dispatch } = useContext(CoreContext);
  const { selectedImgKeys, selectedMaskKeys } = useContext(HoverContext);
  const { notifyMaskToolChanged, notifyMaskAppearanceChanged, ...mask } = useContext(MaskContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
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
          paramSize: {
            containerHeight: 38,
            containerWidth: 190,
            capWidth: 17,
            capHeight: 17,
            capBorderOffset: 0,
            trackHeight: 1,
            tickHeight: 0,
            tickLeft: 2,
            svgSize: { width: 24, height: 24 },
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
          paramSize: {
            capWidth: 13,
            capHeight: 13,
            capBorderOffset: 0,
            containerWidth: 170,
            containerHeight: 36,
            trackHeight: 1,
            tickHeight: 20,
            tickLeft: 1,
            svgSize: { width: 20, height: 20 },
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
          paramSize: {
            capWidth: 13,
            capHeight: 13,
            capBorderOffset: 0,
            containerWidth: 170,
            containerHeight: 36,
            trackHeight: 1,
            tickHeight: 20,
            tickLeft: 1,
            svgSize: { width: 20, height: 20 },
          },
        };
    }
  });

  const xInputRef = useRef<HTMLInputElement | null>(null);
  const yInputRef = useRef<HTMLInputElement | null>(null);
  const wInputRef = useRef<HTMLInputElement | null>(null);
  const hInputRef = useRef<HTMLInputElement | null>(null);
  const { position, setPosition, size, setSize } = mask;

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

  const selectedImgKey = selectedImgKeys.size === 1 ? Array.from(selectedImgKeys)[0] : undefined;
  const imgMeta = selectedImgKey ? coreState.project.imgs.get(selectedImgKey) : undefined;
  const isArmedForMaskDrop = uiState.tool.type === "mask" && uiState.browserElement?.type === "img";
  const armedImg =
    isArmedForMaskDrop && uiState.browserElement?.type === "img" ? uiState.browserElement.value : undefined;
  const sourceWidth = imgMeta ? imgMeta.width * imgMeta.scale_x : armedImg?.width;
  const sourceHeight = imgMeta ? imgMeta.height * imgMeta.scale_y : armedImg?.height;
  const sourceAspectRatio = useMemo(() => {
    if (sourceWidth === undefined || !sourceHeight) return undefined;
    return sourceWidth / sourceHeight;
  }, [sourceWidth, sourceHeight]);

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

  const isPositionDisabled = !imgMeta && !isArmedForMaskDrop;
  const isSizeDisabled = !imgMeta && !isArmedForMaskDrop;
  const isResolutionDisabled = !imgMeta && !isArmedForMaskDrop;
  const hasMesh = mask.status === "streaming" || mask.status === "done";
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const hasSelectedMask = selectedMaskKey !== undefined;
  const isTextureDisabled = !(hasSelectedMask || hasMesh || isArmedForMaskDrop);
  const isCaptureDisabled = !hasSelectedMask;
  const isCaptureOn = uiState.tool.type === "mask" && uiState.tool.capturingMeshSection;
  const isTopologyDisabled = !hasSelectedMask;
  const topologyMode = uiState.tool.type === "mask" ? uiState.tool.editingTopology : false;
  const isShapeOn = topologyMode === "shape";
  const canSeedEdgeObjects = Boolean(imgMeta) || isArmedForMaskDrop;
  const isObjectsOn = topologyMode === "circle";
  const isObjectsDisabled = !hasSelectedMask && !canSeedEdgeObjects;

  const armedSvg = uiState.browserElement?.type === "svg" ? uiState.browserElement.value : undefined;
  const armedMarkup = armedSvg?.markup;
  const armedShape = useMemo<ObjectShapeResult | undefined>(() => {
    if (!armedMarkup) return undefined;
    const decoded = decodeSvgMarkup(armedMarkup);
    if (!decoded) return { ok: false, reason: "the svg's markup could not be read" };
    return buildObjectShapeFromMarkup(decoded);
  }, [armedMarkup]);
  const shapeError = armedShape && !armedShape.ok ? armedShape.reason : undefined;
  const isShapeDisabled = isTopologyDisabled || !armedShape?.ok;

  useEffect(() => {
    if (uiState.tool.type !== "mask" || uiState.tool.editingTopology !== "shape") return;
    if (armedShape?.ok) return;
    uiDispatch({ type: UIActionType.SetTool, value: { ...uiState.tool, editingTopology: false } });
    notifyMaskToolChanged("mask");
  }, [uiState.tool, armedShape, uiDispatch, notifyMaskToolChanged]);

  const selectedMaskMeta = selectedMaskKey !== undefined ? coreState.project.masks.get(selectedMaskKey) : undefined;
  const textureMixValue = selectedMaskMeta ? selectedMaskMeta.texture : mask.textureMix;
  const pendingTextureSaveRef = useRef<LaurusProjectResult | null>(null);
  const isPersistingTextureRef = useRef(false);
  const persistTextureQueue = useCallback(async () => {
    if (isPersistingTextureRef.current) return;
    isPersistingTextureRef.current = true;
    try {
      while (pendingTextureSaveRef.current) {
        const projectToSave = pendingTextureSaveRef.current;
        pendingTextureSaveRef.current = null;
        const saved = await updateProject(coreState.apiOrigin, coreState.accessToken, projectToSave.project_id, {
          ...projectToSave,
        });
        if (!saved) {
          console.error("failed to save texture change", { project_id: projectToSave.project_id });
        }
      }
    } finally {
      isPersistingTextureRef.current = false;
    }
  }, [coreState.apiOrigin, coreState.accessToken]);

  const saveTextureField = useCallback(
    (value: number) => {
      if (selectedMaskKey === undefined) return;
      const maskMeta = coreState.project.masks.get(selectedMaskKey);
      if (!maskMeta) return;

      const newMasks = new Map(coreState.project.masks);
      const newMaskMeta: LaurusProjectMask = { ...maskMeta, texture: value };
      newMasks.set(selectedMaskKey, newMaskMeta);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      notifyMaskAppearanceChanged(selectedMaskKey, { textureMix: value });
      pendingTextureSaveRef.current = newProject;
      void persistTextureQueue();
    },
    [selectedMaskKey, coreState.project, dispatch, notifyMaskAppearanceChanged, persistTextureQueue],
  );

  const handleTextureMixChange = useCallback(
    (value: number) => {
      if (selectedMaskMeta) {
        saveTextureField(value);
      } else {
        mask.setTextureMix(value);
      }
    },
    [selectedMaskMeta, saveTextureField, mask],
  );

  const previewTextureMixChange = useCallback(
    (value: number) => {
      if (selectedMaskKey !== undefined) {
        notifyMaskAppearanceChanged(selectedMaskKey, { textureMix: value });
      } else {
        mask.setTextureMix(value);
      }
    },
    [selectedMaskKey, mask, notifyMaskAppearanceChanged],
  );

  const textureTrackRef = useRef<HTMLDivElement | null>(null);
  const { getTrackValue: getTextureValue, getTrackCursor: getTextureCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );

  const textureCursor = { x: getTextureCursor(textureMixValue, dynamicSizes.paramSize.containerWidth), y: 0 };

  useEffect(() => {
    if (mask.status === "connecting" || mask.status === "streaming") return;
    mask.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImgKey]);

  useEffect(() => {
    if (uiState.tool.type !== "mask") return;
    const nextTopology: TopologyMode =
      uiState.tool.editingTopology === "circle"
        ? hasSelectedMask || canSeedEdgeObjects
          ? "circle"
          : false
        : uiState.tool.editingTopology === "shape" && hasSelectedMask
          ? "shape"
          : false;
    const nextCapture = hasSelectedMask && uiState.tool.capturingMeshSection;
    if (nextTopology === uiState.tool.editingTopology && nextCapture === uiState.tool.capturingMeshSection) return;
    uiDispatch({
      type: UIActionType.SetTool,
      value: { type: "mask", capturingMeshSection: nextCapture, editingTopology: nextTopology },
    });
    notifyMaskToolChanged("mask");
  }, [hasSelectedMask, canSeedEdgeObjects, uiState.tool, uiDispatch, notifyMaskToolChanged]);

  return (
    <>
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
          svg={texture300()}
          containerStyle={{
            width: dynamicSizes.svgSize.width,
            height: dynamicSizes.svgSize.height,
          }}
          scale={1}
          scaleToContaier={true}
        />
        <div
          style={{
            display: "flex",
            height: "100%",
            alignItems: "center",
            ...dynamicSizes.input.container,
          }}
        >
          <div
            title={
              isPositionDisabled
                ? "select an image to mask, or arm one from the browser, to set an exact position for the result"
                : "place the generated mask at an exact x/y position instead of overlaying the source image"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              style={{
                textShadow: isPositionOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
              }}
            >
              {"position"}
            </span>
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
              disabled={isPositionDisabled}
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
            id={`${selectedImgKey ?? "maskbar"}|input|x`}
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
            id={`${selectedImgKey ?? "maskbar"}|input|y`}
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
            title={
              isSizeDisabled
                ? "select an image to mask, or arm one from the browser, to set an exact size for the result"
                : "size the generated mask to an exact width/height instead of matching the source image"
            }
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span
              style={{
                textShadow: isSizeOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
              }}
            >
              {"size"}
            </span>
            <Toggle
              value={isSizeOn}
              onClick={() => {
                const newSizeValue = !isSizeOn;
                setSize(
                  newSizeValue && sourceWidth !== undefined && sourceHeight !== undefined
                    ? {
                        value: true,
                        width: sourceWidth,
                        height: sourceHeight,
                      }
                    : { value: newSizeValue, width: undefined, height: undefined },
                );
              }}
              trackStyles={{ ...dynamicSizes.toggle.track }}
              buttonStyles={{ ...dynamicSizes.toggle.button }}
              translateX={dynamicSizes.toggle.translateX}
              disabled={isSizeDisabled}
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
            id={`${selectedImgKey ?? "maskbar"}|input|w`}
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
            id={`${selectedImgKey ?? "maskbar"}|input|h`}
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
          title={
            isResolutionDisabled
              ? "select an image to mask, or arm one from the browser, to set the generated mesh's resolution"
              : "how finely the generated mesh is triangulated -- 2x/3x roughly double/triple the point density of the default"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ opacity: isResolutionDisabled ? 0.3 : 1 }}>{"resolution"}</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              letterSpacing: 2,
            }}
          >
            {([1, 2, 3] as const).map((factor) => {
              const isSelected = mask.resolution === factor;
              return (
                <span
                  key={factor}
                  onClick={isResolutionDisabled ? undefined : () => mask.setResolution(factor)}
                  style={{
                    cursor: isResolutionDisabled ? "default" : "pointer",
                    color: isSelected && !isResolutionDisabled ? "inherit" : "rgb(67,67,67)",
                    textShadow: isSelected && !isResolutionDisabled ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
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
          title={
            isTextureDisabled
              ? "select or generate a mesh to adjust its wireframe overlay"
              : "0% hides the mesh's triangle wireframe, 100% draws it fully in over the source image"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ opacity: isTextureDisabled ? 0.3 : 1 }}>{"texture"}</span>
          <ParameterSliderX
            resolution={{ ...uiState.resolution }}
            hash={`${selectedMaskKey ?? "maskbar"}|texture`}
            size={dynamicSizes.paramSize}
            containerRef={textureTrackRef}
            cursor={textureCursor}
            onCursorMove={(newCursor) => {
              if (!textureTrackRef.current) return;
              const newValue = getTextureValue(newCursor.x, textureTrackRef.current.clientWidth, 0);
              previewTextureMixChange(newValue);
            }}
            onNewCursor={(newCursor) => {
              if (!textureTrackRef.current) return;
              const newValue = getTextureValue(newCursor.x, textureTrackRef.current.clientWidth, 0);
              handleTextureMixChange(newValue);
            }}
            disabled={isTextureDisabled}
          />
        </div>
        <div
          title={
            isCaptureDisabled
              ? "select a mesh to capture a subsection of it"
              : "drag a circle over this mesh to capture a subsection of its triangles"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span
            style={{
              textShadow: isCaptureOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
            }}
          >
            {"capture"}
          </span>
          <Toggle
            value={isCaptureOn}
            onClick={() => {
              if (uiState.tool.type !== "mask") return;
              const newCaptureValue = !uiState.tool.capturingMeshSection;
              uiDispatch({
                type: UIActionType.SetTool,
                value: {
                  ...uiState.tool,
                  capturingMeshSection: newCaptureValue,
                  editingTopology: newCaptureValue ? false : uiState.tool.editingTopology,
                },
              });
              notifyMaskToolChanged("mask");
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
            disabled={isCaptureDisabled}
          />
        </div>
        <div
          title={
            isObjectsDisabled
              ? "select a mesh to raise objects onto it, or arm an image from the browser to raise objects from its edges"
              : hasSelectedMask
                ? 'drag a circle over this mesh to raise that area\'s elevation, warping the surrounding triangles like a topographic map -- see "shape" for objects shaped like an svg instead'
                : "with no mesh selected, detect the image's edges while generating, fill the areas they enclose " +
                  "with polygons, and raise an object over each of the largest to review one by one"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span
            style={{
              opacity: isObjectsDisabled ? 0.3 : 1,
              textShadow: isObjectsOn && !isObjectsDisabled ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
            }}
          >
            {"objects"}
          </span>
          <Toggle
            value={isObjectsOn}
            onClick={() => {
              if (uiState.tool.type !== "mask") return;
              const newTopologyMode = isObjectsOn ? false : "circle";
              uiDispatch({
                type: UIActionType.SetTool,
                value: {
                  ...uiState.tool,
                  editingTopology: newTopologyMode,
                  capturingMeshSection: newTopologyMode ? false : uiState.tool.capturingMeshSection,
                },
              });
              notifyMaskToolChanged("mask");
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
            disabled={isObjectsDisabled}
          />
        </div>
        <div
          title={
            isTopologyDisabled
              ? "select a mesh to give its objects a custom shape"
              : shapeError
                ? `${armedSvg?.media_key ?? "this svg"} can't shape an object: ${shapeError}`
                : armedShape?.ok
                  ? `drag a circle over this mesh to raise an object shaped like ${armedSvg?.media_key}'s outline instead of a round one`
                  : "pick an svg in the browser to shape new objects like its outline"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ textShadow: isShapeOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"shape"}</span>
          <Toggle
            value={isShapeOn}
            onClick={() => {
              if (uiState.tool.type !== "mask") return;
              const newTopologyMode = isShapeOn ? false : "shape";
              uiDispatch({
                type: UIActionType.SetTool,
                value: {
                  ...uiState.tool,
                  editingTopology: newTopologyMode,
                  capturingMeshSection: newTopologyMode ? false : uiState.tool.capturingMeshSection,
                },
              });
              notifyMaskToolChanged("mask");
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
            disabled={isShapeDisabled}
          />
        </div>
        <div />
      </div>
    </>
  );
}
