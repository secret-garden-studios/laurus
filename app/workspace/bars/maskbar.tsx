import { useContext, useMemo, useRef, useState, CSSProperties, useCallback, useEffect } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { checkCircle, SvgRepo, texture300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import styles from "@/app/app.module.css";
import { LaurusProjectResult, LaurusProjectMask, createProject, updateProject } from "@/app/projects/projects.server";
import { CoreActionType } from "../states/core-state";
import { deleteSvg, LaurusMaskResult } from "../workspace.server";
import { v4 as newUUID } from "uuid";
import { UIActionType } from "../states/ui-state";
import { deleteEffects } from "../effects-utils";
import { TEXTURE_MIX_DEFAULT } from "../mask-gl";

export default function Maskbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  // Aliased locally -- Maskbar itself has no notion of what a captured mesh subsection becomes
  // (a light source, or something else down the line); it just hands the drag off to whoever
  // does via these two callbacks.
  const {
    coreState,
    dispatch,
    confirmLightSourceCapture: confirmCapture,
    cancelLightSourceCapture: cancelCapture,
  } = useContext(CoreContext);
  const { topology } = coreState;
  const { selectedImgKeys, selectedMaskKeys, setSelectedMaskKeys } = useContext(HoverContext);
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
  const imgData = selectedImgKey ? coreState.canvasImgs.get(selectedImgKey) : undefined;
  const imgMeta = selectedImgKey ? coreState.project.imgs.get(selectedImgKey) : undefined;
  // The source image's own on-canvas aspect ratio -- width/height stay locked to it so resizing
  // the mask output can't distort it relative to the image it was traced from.
  const sourceAspectRatio = useMemo(() => {
    if (!imgMeta || imgMeta.height * imgMeta.scale_y <= 0) return undefined;
    return (imgMeta.width * imgMeta.scale_x) / (imgMeta.height * imgMeta.scale_y);
  }, [imgMeta]);

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

  const isMaskBusy = mask.status === "connecting" || mask.status === "streaming";
  const isMaskDisabled = !imgData || isMaskBusy;
  const isPositionDisabled = !imgData;
  const isSizeDisabled = !imgData;
  // There's only something to blend once geometry is actually on screen.
  const hasMesh = mask.status === "streaming" || mask.status === "done";
  // A selected placed mask takes priority over the live in-flight preview -- picking a specific
  // result to adjust should always win over whatever's still streaming in, and the two only
  // overlap in the rare case both happen to be true at once.
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  // Media wired to this mask (see canvas.tsx's handleSvgDrop, project-mask-item.tsx) -- only the
  // first is ever actually consumed, but a manual way to clear them out is still needed since
  // they render nothing of their own and can't be selected/deleted through the normal canvas UI
  // otherwise. Maskbar doesn't need to know what this wired media actually represents.
  const capturesForSelectedMask = useMemo(() => {
    if (selectedMaskKey === undefined) return [];
    const found: { key: string; svg_media_id: string }[] = [];
    coreState.project.svgs.forEach((meta, key) => {
      if (meta.target_mask_key === selectedMaskKey) found.push({ key, svg_media_id: meta.svg_media_id });
    });
    return found;
  }, [selectedMaskKey, coreState.project.svgs]);
  const handleClearCaptures = useCallback(async () => {
    if (capturesForSelectedMask.length === 0) return;
    const confirmed = confirm(
      capturesForSelectedMask.length === 1
        ? "are you sure you want to clear the capture wired to this mesh?"
        : `are you sure you want to clear the ${capturesForSelectedMask.length} captures wired to this mesh?`,
    );
    if (!confirmed) return;
    const newSvgs = new Map(coreState.project.svgs);
    capturesForSelectedMask.forEach(({ key }) => newSvgs.delete(key));
    const newProject: LaurusProjectResult = { ...coreState.project, svgs: newSvgs };
    const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
      ...newProject,
    });
    if (!updated) return;
    dispatch({ type: CoreActionType.SetProject, value: newProject });
    for (const { key, svg_media_id } of capturesForSelectedMask) {
      dispatch({ type: CoreActionType.DeleteCanvasSvg, key });
      uiDispatch({ type: UIActionType.DeleteCarouselEntry, key });
      await deleteEffects(key, coreState.apiOrigin, coreState.accessToken, coreState.effects, dispatch);
      await deleteSvg(coreState.apiOrigin, coreState.accessToken, svg_media_id);
    }
  }, [
    capturesForSelectedMask,
    coreState.project,
    coreState.apiOrigin,
    coreState.accessToken,
    coreState.effects,
    dispatch,
    uiDispatch,
  ]);
  const pendingCaptureForSelectedMask =
    selectedMaskKey !== undefined && coreState.pendingLightSourceCapture?.maskKey === selectedMaskKey;
  const isTextureDisabled = !(selectedMaskKey !== undefined || hasMesh);
  const isCaptureDisabled = selectedMaskKey === undefined;
  const isCaptureOn = uiState.tool.type === "mask" && uiState.tool.capturingMeshSection;
  const textureMixValue =
    selectedMaskKey !== undefined
      ? (topology.get(selectedMaskKey)?.textureMix ?? TEXTURE_MIX_DEFAULT)
      : mask.textureMix;
  const handleTextureMixChange = useCallback(
    (value: number) => {
      if (selectedMaskKey !== undefined) {
        dispatch({ type: CoreActionType.SetTopology, key: selectedMaskKey, value: { textureMix: value } });
      } else {
        mask.setTextureMix(value);
      }
    },
    [selectedMaskKey, dispatch, mask],
  );

  const maskTitle = isMaskBusy
    ? "masking…"
    : selectedImgKeys.size === 0
      ? "select an image to mask"
      : selectedImgKeys.size > 1
        ? "select a single image to mask"
        : "mask the selected image";

  // Called directly off the websocket's one and only "complete" message (see
  // useMaskPreview's start()) rather than watched for via a useEffect on mask.status --
  // an effect would re-fire this every time Maskbar remounts (e.g. switching tools away and
  // back) and finds status still "done" from a prior run, with no reliable way to tell "already
  // saved" from "new" short of extra bookkeeping. Calling it once, tied to the one real event,
  // needs none.
  const persistMask = useCallback(
    (result: LaurusMaskResult) => {
      if (!imgMeta) return;
      const newKey = newUUID();
      const order =
        Math.max(
          -1,
          ...Array.from(coreState.project.imgs.values()).map((i) => i.order),
          ...Array.from(coreState.project.svgs.values()).map((s) => s.order),
          ...Array.from(coreState.project.masks.values()).map((v) => v.order),
        ) + 1;
      const projectMask: LaurusProjectMask = {
        media_id: result.mask_media_id,
        media_group_id: "",
        // Defaults to the source image's own frame, so the result lands exactly on top of the
        // image it came from -- overridden by the position/size toggles above when they're on.
        width: size.value && size.width !== undefined ? size.width : imgMeta.width,
        height: size.value && size.height !== undefined ? size.height : imgMeta.height,
        top: position.value && position.y !== undefined ? position.y : imgMeta.top,
        left: position.value && position.x !== undefined ? position.x : imgMeta.left,
        order,
        scale_x: imgMeta.scale_x,
        scale_y: imgMeta.scale_y,
        rotate_x: 0,
        rotate_y: 0,
        rotate_z: 0,
        rotate_angle: 0,
        // Seeded from whatever the live preview was dialed to while streaming, so persisting
        // doesn't reset the look back to some unrelated default.
        light_source_size: mask.lightSourceSize,
        light_source_intensity: mask.lightSourceIntensity,
        light_source_falloff: mask.lightSourceFalloff,
        light_source_darkness: mask.lightSourceDarkness,
        fill: result.fill,
        stroke: result.stroke,
        stroke_width: result.stroke_width,
        description: "",
      };

      const rollback: LaurusProjectResult = { ...coreState.project };
      const newMasks = new Map(coreState.project.masks);
      newMasks.set(newKey, projectMask);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };

      dispatch({ type: CoreActionType.SetCanvasMask, key: newKey, value: result });
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      // Selects the just-placed mask immediately -- otherwise selectedMaskKey stays whatever it
      // was before masking (usually nothing), and the capture toggle/texture slider above (both
      // gated on selectedMaskKey) stay disabled until the user manually alt-clicks the new mask
      // on canvas.
      setSelectedMaskKeys(new Set([newKey]));

      (async () => {
        if (newProject.project_id) {
          const updated = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
            ...newProject,
          });
          if (!updated) {
            dispatch({ type: CoreActionType.SetProject, value: rollback });
            dispatch({ type: CoreActionType.DeleteCanvasMask, key: newKey });
          }
        } else {
          const created = await createProject(coreState.apiOrigin, coreState.accessToken, { ...newProject });
          if (created) {
            dispatch({ type: CoreActionType.SetProject, value: { ...created } });
          } else {
            dispatch({ type: CoreActionType.SetProject, value: rollback });
            dispatch({ type: CoreActionType.DeleteCanvasMask, key: newKey });
          }
        }
      })();
    },
    [
      imgMeta,
      position,
      size,
      coreState.project,
      coreState.apiOrigin,
      coreState.accessToken,
      dispatch,
      setSelectedMaskKeys,
      mask.lightSourceSize,
      mask.lightSourceIntensity,
      mask.lightSourceFalloff,
      mask.lightSourceDarkness,
    ],
  );

  const handleMaskClick = useCallback(() => {
    if (isMaskDisabled || !imgData) return;
    mask.start(imgData, persistMask);
  }, [isMaskDisabled, imgData, mask, persistMask]);

  // Starting fresh whenever the selected image changes, rather than leaving a stale mesh/status
  // or position/size override from whatever was last masked (mask.reset() clears both).
  useEffect(() => {
    mask.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImgKey]);

  // The toggle is disabled with no mask selected, but its underlying tool state can still be
  // left on from before the deselect -- turn it off so the toggle doesn't render as on while
  // disabled, and canvas.tsx stops treating drags as mesh-section captures.
  useEffect(() => {
    if (selectedMaskKey !== undefined) return;
    if (uiState.tool.type !== "mask" || !uiState.tool.capturingMeshSection) return;
    uiDispatch({ type: UIActionType.SetTool, value: { type: "mask", capturingMeshSection: false } });
  }, [selectedMaskKey, uiState.tool, uiDispatch]);

  return (
    <>
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          height: "100%",
          overflowX: "auto",
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
                ? "select an image to mask to set an exact position for the result"
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
                ? "select an image to mask to set an exact size for the result"
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
                  newSizeValue && imgMeta
                    ? {
                        value: true,
                        // Seeded from the source image's current on-canvas size, so turning the
                        // toggle on doesn't jump to some other size -- from here, editing either
                        // field scales the other to keep this same ratio.
                        width: imgMeta.width * imgMeta.scale_x,
                        height: imgMeta.height * imgMeta.scale_y,
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
              color: isMaskDisabled ? "rgb(67,67,67)" : "inherit",
            }}
          >
            {"mask"}
          </span>
          <SvgRepo
            title={maskTitle}
            svg={isMaskDisabled ? checkCircle("rgb(67,67,67)") : checkCircle()}
            onContainerClick={isMaskDisabled ? undefined : handleMaskClick}
            containerStyle={{
              width: dynamicSizes.svgSize.width,
              height: dynamicSizes.svgSize.height,
            }}
            scale={0.7}
            scaleToContaier={true}
          />
        </div>
        <div
          title={
            isTextureDisabled
              ? "select or generate a mesh to blend between its flat color and the source image"
              : "blend between the flat masked color and the source image sampled through the mesh"
          }
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span style={{ opacity: isTextureDisabled ? 0.3 : 0.7 }}>{"texture"}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={textureMixValue}
            disabled={isTextureDisabled}
            onChange={(e) => handleTextureMixChange(parseFloat(e.target.value))}
          />
          <span style={{ opacity: isTextureDisabled ? 0.3 : 0.7, width: "4ch" }}>{textureMixValue.toFixed(2)}</span>
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
                value: { type: "mask", capturingMeshSection: !uiState.tool.capturingMeshSection },
              });
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
            disabled={isCaptureDisabled}
          />
        </div>
        {capturesForSelectedMask.length > 0 && (
          <div
            title="remove the capture(s) wired to this mesh"
            onClick={handleClearCaptures}
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              cursor: "pointer",
              ...dynamicSizes.toggle.div,
            }}
          >
            <span style={{ opacity: 0.7 }}>{`clear capture${capturesForSelectedMask.length > 1 ? "s" : ""}`}</span>
          </div>
        )}
        {pendingCaptureForSelectedMask && (
          <>
            <div
              title="drag another circle to redraw, or confirm to save this capture"
              onClick={confirmCapture}
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
                ...dynamicSizes.toggle.div,
              }}
            >
              <span style={{ opacity: 0.7 }}>{"confirm capture"}</span>
            </div>
            <div
              title="discard this capture without uploading anything"
              onClick={cancelCapture}
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
                ...dynamicSizes.toggle.div,
              }}
            >
              <span style={{ opacity: 0.7 }}>{"cancel"}</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
