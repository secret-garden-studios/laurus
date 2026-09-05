import { CSSProperties, Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { SvgRepo, closeIcon, dragIndicator, link, linkOff } from "../svg-repo";
import { dellaRespira } from "../fonts";
import styles from "../app.module.css";
import Toggle from "../components/toggle";
import { FLOATINGBAR_DND_ID } from "./bars/floatingbar";
import { CoreContext, HoverContext, UIContext } from "./workspace.client";
import { CopySettings, UIActionType, defaultCopySettings, isDropImplied, marqueeArm, maskArm } from "./states/ui-state";
import { maskSpace, meshCircleToCanvas } from "./canvas-media/canvas-space";
import { lightOutline, objectOutline } from "./canvas-media/light-geometry";
import { LaurusProjectImg, LaurusProjectSvg } from "@/app/projects/projects.server";

export type CopySource =
  | {
      id: string;
      shape: "frame";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      shape: "circle";
      subject: "light" | "object";
      x: number;
      y: number;
      diameter: number;
    };

function copyPanelSizes(resolution: string) {
  switch (resolution) {
    case "high":
      return {
        container: { gap: 12, width: 320 },
        header: { gap: 10 },
        dragHandle: { width: 18, height: 18 },
        close: { width: 18, height: 18 },
        message: { fontSize: 12, letterSpacing: 2 },
        row: { gap: 10, fontSize: 13 },
        label: { fontSize: 12 },
        input: { fontSize: 12, padding: 4, letterSpacing: 1 },
        toggle: { track: { width: 26, height: 12, borderRadius: 10, padding: 1 }, button: { width: 8, height: 8 } },
        translateX: 14,
        lock: { width: 18, height: 18 },
      };
    case "midhigh":
    case "midlow":
      return {
        container: { gap: 12, width: 300 },
        header: { gap: 10 },
        dragHandle: { width: 16, height: 16 },
        close: { width: 16, height: 16 },
        message: { fontSize: 11, letterSpacing: 2 },
        row: { gap: 8, fontSize: 12 },
        label: { fontSize: 11 },
        input: { fontSize: 11, padding: 4, letterSpacing: 1 },
        toggle: { track: { width: 22, height: 10, borderRadius: 10, padding: 1 }, button: { width: 6, height: 6 } },
        translateX: 12,
        lock: { width: 16, height: 16 },
      };
    default:
      return {
        container: { gap: 12, width: 280 },
        header: { gap: 10 },
        dragHandle: { width: 14, height: 14 },
        close: { width: 14, height: 14 },
        message: { fontSize: 10, letterSpacing: 2 },
        row: { gap: 8, fontSize: 12 },
        label: { fontSize: 11 },
        input: { fontSize: 11, padding: 4, letterSpacing: 1 },
        toggle: { track: { width: 20, height: 9, borderRadius: 10, padding: 1 }, button: { width: 6, height: 6 } },
        translateX: 10,
        lock: { width: 14, height: 14 },
      };
  }
}

const round = (value: number) => Math.round(value * 10) / 10;

function boundingFrame(metas: (LaurusProjectImg | LaurusProjectSvg)[]) {
  const minX = Math.min(...metas.map((m) => m.left));
  const minY = Math.min(...metas.map((m) => m.top));
  const maxX = Math.max(...metas.map((m) => m.left + m.width * m.scale_x));
  const maxY = Math.max(...metas.map((m) => m.top + m.height * m.scale_y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function useCopySource(): CopySource | undefined {
  const { uiState } = useContext(UIContext);
  const { coreState } = useContext(CoreContext);
  const { selectedImgKeys, selectedSvgKeys, selectedMaskKeys } = useContext(HoverContext);

  const tool = uiState.tool;

  const browserSource = useMemo((): CopySource | undefined => {
    const element = uiState.browserElement;
    if (!element) return undefined;
    const { width, height } = element.value;
    if (!width || !height) return undefined;
    return {
      id: `browser|${element.value.media_key}`,
      shape: "frame",
      x: 0,
      y: 0,
      width: round(width),
      height: round(height),
    };
  }, [uiState.browserElement]);

  const selectionSource = useMemo((): CopySource | undefined => {
    const keys = [...selectedImgKeys, ...selectedSvgKeys].sort();
    const metas = [
      ...Array.from(selectedImgKeys)
        .map((key) => coreState.project.imgs.get(key))
        .filter((meta): meta is LaurusProjectImg => Boolean(meta)),
      ...Array.from(selectedSvgKeys)
        .map((key) => coreState.project.svgs.get(key))
        .filter((meta): meta is LaurusProjectSvg => Boolean(meta)),
    ];
    if (metas.length === 0) return undefined;
    const frame = boundingFrame(metas);
    return {
      id: `selection|${keys.join(",")}`,
      shape: "frame",
      x: round(frame.x),
      y: round(frame.y),
      width: round(frame.width),
      height: round(frame.height),
    };
  }, [selectedImgKeys, selectedSvgKeys, coreState.project.imgs, coreState.project.svgs]);

  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;

  const regionSource = useMemo((): CopySource | undefined => {
    const selected = uiState.selectedElement;
    if (selected?.type !== "light" && selected?.type !== "object") return undefined;
    const maskData = coreState.canvasMasks.get(selected.key);
    const space = maskSpace(coreState.project.masks.get(selected.key), maskData);
    if (!maskData || !space) return undefined;

    const region =
      selected.type === "light"
        ? (() => {
            const light = maskData.lights.find((l) => l.id === selected.lightId);
            return light ? { ...lightOutline(maskData, light) } : undefined;
          })()
        : (() => {
            const object = maskData.objects.find((o) => o.id === selected.objectId);
            return object ? { ...objectOutline(maskData, object) } : undefined;
          })();
    if (!region) return undefined;

    const onCanvas = meshCircleToCanvas(space, region);
    return {
      id: `region|${selected.key}|${selected.type}|${selected.type === "light" ? selected.lightId : selected.objectId}`,
      shape: "circle",
      subject: selected.type,
      x: round(onCanvas.cx),
      y: round(onCanvas.cy),
      diameter: round(onCanvas.radius * 2),
    };
  }, [uiState.selectedElement, coreState.canvasMasks, coreState.project.masks]);

  switch (tool.type) {
    case "marquee": {
      const arm = marqueeArm(uiState, selectedImgKeys, selectedSvgKeys);
      if (arm?.type === "selection") return selectionSource;
      if (arm?.type === "browser") return browserSource;
      return undefined;
    }
    case "mask": {
      const arm = maskArm(uiState, selectedMaskKey);
      return arm?.type === "img" ? browserSource : undefined;
    }
    case "light_source":
      return regionSource;
    default:
      return undefined;
  }
}

function sourceNumbers(source: CopySource | undefined) {
  if (!source) return { x: undefined, y: undefined, width: undefined, height: undefined };
  return source.shape === "frame"
    ? { x: source.x, y: source.y, width: source.width, height: source.height }
    : { x: source.x, y: source.y, width: source.diameter, height: undefined };
}

function seedFrom(source: CopySource | undefined, previous: CopySettings): CopySettings {
  const convert = source?.shape === "circle" ? previous.convert : false;
  const seed = sourceNumbers(source);
  if (!source) {
    return { position: { ...previous.position }, size: { ...previous.size }, convert };
  }
  return {
    position: { value: previous.position.value, x: seed.x, y: seed.y },
    size: { value: previous.size.value, width: seed.width, height: seed.height },
    convert,
  };
}

function withPreset(
  copy: CopySettings,
  source: CopySource | undefined,
  preset: "position" | "size",
  on: boolean,
): CopySettings {
  const exclusive = source?.shape === "circle" && !copy.convert && on;
  return {
    ...copy,
    position: { ...copy.position, value: preset === "position" ? on : exclusive ? false : copy.position.value },
    size: { ...copy.size, value: preset === "size" ? on : exclusive ? false : copy.size.value },
  };
}

export default function CopyPanel({ onClose }: { onClose: () => void }) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { selectedImgKeys, selectedSvgKeys, selectedMaskKeys } = useContext(HoverContext);
  const { listeners, isDragging } = useDraggable({ id: FLOATINGBAR_DND_ID });
  const [dynamicSizes] = useState(() => copyPanelSizes(uiState.resolution.type));

  const dropImplied = isDropImplied(
    uiState,
    selectedImgKeys,
    selectedSvgKeys,
    selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined,
  );
  const close = () => {
    if (dropImplied) uiDispatch({ type: UIActionType.SetBrowserElement, value: undefined });
    else onClose();
  };

  const source = useCopySource();
  const copy = uiState.copy;
  const isCircle = source?.shape === "circle";

  const xRef = useRef<HTMLInputElement | null>(null);
  const yRef = useRef<HTMLInputElement | null>(null);
  const wRef = useRef<HTMLInputElement | null>(null);
  const hRef = useRef<HTMLInputElement | null>(null);

  const [revision, setRevision] = useState(0);
  const [pristine, setPristine] = useState(true);

  const reseedFields = () => {
    setRevision((value) => value + 1);
    setPristine(true);
  };

  const [aspectLocked, setAspectLocked] = useState(true);
  const aspectRef = useRef<number | undefined>(undefined);

  const sourceKey = source?.id;
  const seededForRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (seededForRef.current === sourceKey) return;
    const opening = seededForRef.current === undefined;
    seededForRef.current = sourceKey;
    aspectRef.current = source?.shape === "frame" && source.height > 0 ? source.width / source.height : undefined;
    reseedFields();
    const clean = dropImplied || (opening && uiState.tool.type === "light_source");
    if (!uiState.copy.position.value && !uiState.copy.size.value && !(clean && uiState.copy.convert)) return;
    uiDispatch({
      type: UIActionType.SetCopy,
      value: seedFrom(source, clean ? defaultCopySettings : uiState.copy),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, uiDispatch]);

  const isPositionOn = copy.position.value;
  const isSizeOn = copy.size.value;
  const seed = sourceNumbers(source);
  const shownX = isPositionOn ? copy.position.x : seed.x;
  const shownY = isPositionOn ? copy.position.y : seed.y;
  const shownWidth = isSizeOn ? copy.size.width : seed.width;
  const shownHeight = isSizeOn ? copy.size.height : seed.height;
  const isConvertOn = isCircle && copy.convert;

  const inputStyle = (enabled: boolean): CSSProperties => ({
    textAlign: "center",
    background: "none",
    color: enabled ? "inherit" : "rgb(67,67,67)",
    border: "none",
    outline: "none",
    display: "inline-block",
    overflowX: "scroll",
    width: "8ch",
    ...dynamicSizes.input,
  });

  const readField = (ref: { current: HTMLInputElement | null }) => {
    const value = parseFloat(ref.current?.value ?? "");
    return isNaN(value) ? undefined : value;
  };

  const commitPosition = () => {
    const x = readField(xRef);
    const y = readField(yRef);
    if (x === copy.position.x && y === copy.position.y) return;
    uiDispatch({ type: UIActionType.SetCopy, value: { ...copy, position: { ...copy.position, x, y } } });
  };

  const commitSize = () => {
    const width = readField(wRef);
    const height = isCircle ? undefined : readField(hRef);
    if (width === copy.size.width && height === copy.size.height) return;
    uiDispatch({ type: UIActionType.SetCopy, value: { ...copy, size: { ...copy.size, width, height } } });
  };

  const fieldsMatchSource = () => {
    const matches = (ref: { current: HTMLInputElement | null }, seeded: number | undefined) =>
      !ref.current || readField(ref) === seeded;
    return (
      matches(xRef, seed.x) &&
      matches(yRef, seed.y) &&
      matches(wRef, seed.width) &&
      (isCircle || matches(hRef, seed.height))
    );
  };

  const readPristine = () => setPristine(fieldsMatchSource());

  const canReset = Boolean(source) && !pristine;

  const canLockAspect = source?.shape === "frame" && source.height > 0;
  const aspect = canLockAspect && aspectLocked ? aspectRef.current : undefined;

  const toggleAspectLock = () => {
    setAspectLocked((locked) => {
      if (locked) return false;
      const width = readField(wRef);
      const height = readField(hRef);
      if (width !== undefined && height !== undefined && width > 0 && height > 0) {
        aspectRef.current = width / height;
      }
      return true;
    });
  };

  const linkSize = (axis: "width" | "height") => {
    if (aspect === undefined || aspect === 0) return;
    const typed = readField(axis === "width" ? wRef : hRef);
    const other = axis === "width" ? hRef.current : wRef.current;
    if (typed === undefined || !other) return;
    other.value = String(axis === "width" ? round(typed / aspect) : round(typed * aspect));
  };

  const message = source
    ? `draw a circle to ${isConvertOn ? "convert" : dropImplied ? "drop" : "copy"} your selection`
    : "";

  const numberField = (
    id: string,
    label: string,
    ref: { current: HTMLInputElement | null },
    value: number | undefined,
    enabled: boolean,
    onInput: (() => void) | undefined,
    onCommit: () => void,
  ) => (
    <Fragment key={`${id}|${revision}`}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: enabled ? "inherit" : "rgb(67,67,67)",
          ...dynamicSizes.label,
        }}
      >
        {label}
      </div>
      <input
        className={styles["numberInput"]}
        id={`copypanel|input|${id}`}
        disabled={!enabled}
        ref={ref}
        onInput={onInput}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        type="text"
        defaultValue={value?.toString() ?? ""}
        autoComplete="off"
        style={inputStyle(enabled)}
      />
    </Fragment>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", ...dynamicSizes.container }}>
      <div style={{ display: "flex", ...dynamicSizes.header }}>
        <div
          {...listeners}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          <SvgRepo
            svg={dragIndicator("rgb(190, 190, 190)")}
            containerStyle={{ ...dynamicSizes.dragHandle }}
            scale={0.85}
          />
        </div>
        <SvgRepo
          svg={closeIcon()}
          onContainerClick={close}
          containerStyle={{ marginLeft: "auto", ...dynamicSizes.close }}
          scale={0.75}
        />
      </div>
      <div style={{ display: "grid", placeItems: "center", overflowX: "auto", paddingBottom: 4 }}>
        <div
          className={dellaRespira.className}
          style={{
            fontWeight: "bold",
            textAlign: "center",
            color: source ? "rgb(200, 200, 200)" : "rgb(150, 150, 150)",
            textWrap: "nowrap",
            ...dynamicSizes.message,
          }}
        >
          {message}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", ...dynamicSizes.row }}>
        <span style={{ textShadow: isPositionOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none", userSelect: "none" }}>
          {"position"}
        </span>
        <Toggle
          value={isPositionOn}
          disabled={!source}
          onClick={() => {
            const on = !isPositionOn;
            const next = withPreset(copy, source, "position", on);
            uiDispatch({
              type: UIActionType.SetCopy,
              value: on ? { ...next, position: { value: true, x: readField(xRef), y: readField(yRef) } } : next,
            });
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.translateX}
        />
        <div style={{ display: "flex", alignItems: "center", marginLeft: "auto" }}>
          {numberField("x", "x", xRef, shownX, isPositionOn, readPristine, commitPosition)}
          {numberField("y", "y", yRef, shownY, isPositionOn, readPristine, commitPosition)}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", ...dynamicSizes.row }}>
        <span style={{ textShadow: isSizeOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none", userSelect: "none" }}>
          {"size"}
        </span>
        <Toggle
          value={isSizeOn}
          disabled={!source}
          onClick={() => {
            const on = !isSizeOn;
            const next = withPreset(copy, source, "size", on);
            uiDispatch({
              type: UIActionType.SetCopy,
              value: on
                ? {
                    ...next,
                    size: { value: true, width: readField(wRef), height: isCircle ? undefined : readField(hRef) },
                  }
                : next,
            });
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.translateX}
        />
        <div style={{ display: "flex", alignItems: "center", marginLeft: "auto" }}>
          {isCircle ? (
            numberField("d", "d", wRef, shownWidth, isSizeOn, readPristine, commitSize)
          ) : (
            <>
              {numberField(
                "w",
                "width",
                wRef,
                shownWidth,
                isSizeOn,
                () => {
                  linkSize("width");
                  readPristine();
                },
                commitSize,
              )}
              {numberField(
                "h",
                "height",
                hRef,
                shownHeight,
                isSizeOn,
                () => {
                  linkSize("height");
                  readPristine();
                },
                commitSize,
              )}
              <div
                onDoubleClick={isSizeOn ? toggleAspectLock : undefined}
                style={{ display: "flex", flexShrink: 0, cursor: isSizeOn ? "pointer" : "default" }}
              >
                <SvgRepo
                  svg={
                    aspectLocked
                      ? link(isSizeOn ? "rgb(224, 224, 224)" : "rgb(67,67,67)")
                      : linkOff(isSizeOn ? "rgb(224, 224, 224)" : "rgb(67,67,67)")
                  }
                  containerStyle={{ ...dynamicSizes.lock }}
                  scale={0.7}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {!isCircle ? null : (
        <div style={{ display: "flex", alignItems: "center", ...dynamicSizes.row }}>
          <span style={{ textShadow: isConvertOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none", userSelect: "none" }}>
            {"convert"}
          </span>
          <Toggle
            value={isConvertOn}
            onClick={() => {
              const next = !isConvertOn;
              const keep = next || !(copy.position.value && copy.size.value);
              uiDispatch({
                type: UIActionType.SetCopy,
                value: {
                  position: { ...copy.position, value: keep && copy.position.value },
                  size: { ...copy.size, value: keep && copy.size.value },
                  convert: next,
                },
              });
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.translateX}
          />
        </div>
      )}

      <div style={{ display: "flex" }}>
        <button
          className={dellaRespira.className}
          type="button"
          disabled={!canReset}
          onClick={() => {
            uiDispatch({ type: UIActionType.SetCopy, value: seedFrom(source, defaultCopySettings) });
            reseedFields();
          }}
          style={{
            flex: 1,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgb(24, 24, 24)",
            color: "inherit",
            opacity: canReset ? 1 : 0.4,
            cursor: canReset ? "pointer" : "default",
            fontWeight: "bold",
            padding: "8px 0",
            borderRadius: 4,
            letterSpacing: 2,
            ...dynamicSizes.label,
          }}
        >
          {"reset"}
        </button>
      </div>
    </div>
  );
}
