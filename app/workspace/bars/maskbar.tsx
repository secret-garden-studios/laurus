import { useContext, useMemo, useRef, useState, CSSProperties, useCallback, useEffect } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { SvgRepo, texture300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { ParameterSliderX } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";
import styles from "@/app/app.module.css";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";

export default function Maskbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  // Aliased locally -- Maskbar itself has no notion of what a captured mesh subsection becomes
  // (a light source, or something else down the line); it just hands the drag off to whoever
  // does via these two callbacks.
  const { coreState, dispatch, notifyMaskToolChanged, notifyMaskAppearanceChanged } = useContext(CoreContext);
  const { selectedImgKeys, selectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
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

  // Where/how big the generated mask should land, overriding the default of overlaying it
  // directly on top of the source image at the image's own frame. Lives in the shared
  // useMaskPreview instance (not local state) so the live preview in canvas.tsx can read the
  // same values and match, instead of only jumping to the override once persisted.
  const { position, setPosition, size, setSize } = mask;

  const isPositionOn = position.value;
  const isSizeOn = size.value;
  const xValue = position.x?.toString() ?? "0";
  const yValue = position.y?.toString() ?? "0";
  const widthValue = size.width?.toString() ?? "0";
  const heightValue = size.height?.toString() ?? "0";
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
  // Armed for a browser-drop (an img-browser thumbnail clicked while the mask tool is active, see
  // img-browser's onImgClick) -- the source image isn't placed in the project yet, so there's no
  // imgMeta to read a frame off of, only the still-unplaced thumbnail itself.
  const isArmedForMaskDrop = uiState.tool.type === "mask" && uiState.browserElement?.type === "img";
  const armedImg =
    isArmedForMaskDrop && uiState.browserElement?.type === "img" ? uiState.browserElement.value : undefined;
  // The source image's own on-canvas aspect ratio -- width/height stay locked to it so resizing
  // the mask output can't distort it relative to the image it was traced from. Falls back to the
  // armed browser thumbnail's natural size (unplaced, so no on-canvas scale to apply) when there's
  // no placed image selected.
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
  // There's only something to blend once geometry is actually on screen.
  const hasMesh = mask.status === "streaming" || mask.status === "done";
  // A selected placed mask takes priority over the live in-flight preview -- picking a specific
  // result to adjust should always win over whatever's still streaming in, and the two only
  // overlap in the rare case both happen to be true at once.
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const isTextureDisabled = !(selectedMaskKey !== undefined || hasMesh || isArmedForMaskDrop);
  const isCaptureDisabled = selectedMaskKey === undefined;
  const isCaptureOn = uiState.tool.type === "mask" && uiState.tool.capturingMeshSection;
  const isTopologyDisabled = selectedMaskKey === undefined;
  const isTopologyOn = uiState.tool.type === "mask" && uiState.tool.editingTopology;
  const selectedMaskMeta = selectedMaskKey !== undefined ? coreState.project.masks.get(selectedMaskKey) : undefined;
  const textureMixValue = selectedMaskMeta ? selectedMaskMeta.texture : mask.textureMix;
  // Same coalescing-queue persistence as LightSourcebar's own saveLightSourceField -- every edit
  // applies locally right away (see saveTextureField below), and only the network PUT coalesces:
  // whichever value is newest when a save completes goes out next, rather than a debounce timer
  // dropping mid-drag ticks or racing an in-flight request.
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
      // Passed directly rather than left for the mesh to re-read off coreState: this fires
      // synchronously, before React has re-rendered ProjectMaskItem with the just-dispatched
      // project (see MaskAppearanceOverride's own comment in project-mask-item.tsx).
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

  // Trackpad (see ParameterSliderX/trackpad.tsx) only calls onNewCursor once, on drag *end* --
  // onCursorMove is the one that fires continuously while the thumb is actually moving. Mirrors
  // Scalebar's own split: the WebGL canvas updates live on every tick via the same direct-notify
  // path saveTextureField uses (see its own comment), but skips that function's dispatch/persist
  // -- committing coreState.project and queuing the network PUT on every mid-drag pixel would
  // fight the render for the same frame budget for no benefit, since onNewCursor already commits
  // the settled value the instant the drag ends.
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
  const [textureCursor, setTextureCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getTextureValue, getTrackCursor: getTextureCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );

  useEffect(() => {
    if (!textureTrackRef.current) return;
    const newCursor = getTextureCursor(textureMixValue, textureTrackRef.current.clientWidth);
    setTextureCursor({ x: newCursor, y: 0 });
  }, [textureMixValue, getTextureCursor]);

  // Starting fresh whenever the selected image changes, rather than leaving a stale mesh/status
  // or position/size override from whatever was last masked (mask.reset() clears both). Skipped
  // while a mask is actively connecting/streaming -- the img context menu's "mask" cell selects
  // the image and triggers masking in the same click (see its handleMaskClick), so this effect
  // would otherwise fire right after and mask.reset()'s socketRef.current?.close() would abort
  // the job it just started.
  useEffect(() => {
    if (mask.status === "connecting" || mask.status === "streaming") return;
    mask.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImgKey]);

  // The toggle is disabled with no mask selected, but its underlying tool state can still be
  // left on from before the deselect -- turn it off so the toggle doesn't render as on while
  // disabled, and canvas.tsx stops treating drags as mesh-section captures or topology edits.
  useEffect(() => {
    if (selectedMaskKey !== undefined) return;
    if (uiState.tool.type !== "mask" || (!uiState.tool.capturingMeshSection && !uiState.tool.editingTopology)) return;
    uiDispatch({
      type: UIActionType.SetTool,
      value: { type: "mask", capturingMeshSection: false, editingTopology: false },
    });
    notifyMaskToolChanged("mask");
  }, [selectedMaskKey, uiState.tool, uiDispatch, notifyMaskToolChanged]);

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
                        // Seeded from the source's current size (the placed image's on-canvas size,
                        // or the armed browser thumbnail's natural size), so turning the toggle on
                        // doesn't jump to some other size -- from here, editing either field scales
                        // the other to keep this same ratio.
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
              setTextureCursor({ ...newCursor, y: 0 });
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
              uiDispatch({
                type: UIActionType.SetTool,
                value: { ...uiState.tool, capturingMeshSection: !uiState.tool.capturingMeshSection },
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
            isTopologyDisabled
              ? "select a mesh to adjust its topology"
              : "drag a circle over this mesh to raise that area's elevation, warping the surrounding triangles like a topographic map"
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
              textShadow: isTopologyOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
            }}
          >
            {"peak"}
          </span>
          <Toggle
            value={isTopologyOn}
            onClick={() => {
              if (uiState.tool.type !== "mask") return;
              uiDispatch({
                type: UIActionType.SetTool,
                value: { ...uiState.tool, editingTopology: !uiState.tool.editingTopology },
              });
              notifyMaskToolChanged("mask");
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
            disabled={isTopologyDisabled}
          />
        </div>
        <div />
      </div>
    </>
  );
}
