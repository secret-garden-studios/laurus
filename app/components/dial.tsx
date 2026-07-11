import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSSProperties, RefObject, useEffect, useRef, useState } from "react";
import { LaurusResolution } from "../landing.boot";

interface DialProps {
  resolution: LaurusResolution;
  ids: { contextId: string; draggableId: string };
  value: number;
  onNewValue: (v: number) => void;
  size: {
    container: number;
    gauge: number;
    gaugeTick: number;
    dial: number;
    dialTick: number;
  };
  onMove?: (v: number) => void;
  disabled?: boolean;
  title?: string;
  liveTitleRef?: RefObject<HTMLDivElement | null>;
}

export default function Dial({
  resolution,
  ids,
  value,
  size,
  onMove,
  onNewValue,
  disabled,
  title,
  liveTitleRef,
}: DialProps) {
  const rotationRef = useRef(value);
  const [rotation, setRotation] = useState(value);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    rotationRef.current = value;
    (async () => {
      setRotation(value);
    })();
  }, [value]);

  return (
    <>
      <DndContext
        id={ids.contextId}
        sensors={sensors}
        autoScroll={false}
        onDragStart={() => {
          document.body.style.cursor = "grabbing";
          rotationRef.current = rotation;
        }}
        onDragMove={(event) => {
          const { delta } = event;
          const dragDistanceY = delta.y;
          const degreesPerPixel = -0.75;
          const newRotation = rotationRef.current + dragDistanceY * degreesPerPixel;
          setRotation(newRotation);
          if (onMove) {
            onMove(newRotation);
          }
        }}
        onDragEnd={(event) => {
          document.body.style.cursor = "";
          const { delta } = event;
          const dragDistanceY = delta.y;
          const degreesPerPixel = -0.75;
          const newRotation = rotationRef.current + dragDistanceY * degreesPerPixel;
          rotationRef.current = newRotation;
          setRotation(newRotation);
          onNewValue(newRotation);
        }}
        modifiers={[restrictToVerticalAxis]}
      >
        <BlurryCap
          resolution={resolution}
          id={ids.draggableId}
          size={size}
          rotation={rotation}
          disabled={disabled}
          title={title}
          liveTitleRef={liveTitleRef}
        />
      </DndContext>
    </>
  );
}

interface BlurryCapProps {
  resolution: LaurusResolution;
  id: string;
  rotation: number;
  size: {
    container: number;
    gauge: number;
    gaugeTick: number;
    dial: number;
    dialTick: number;
  };
  disabled?: boolean;
  title?: string;
  liveTitleRef?: RefObject<HTMLDivElement | null>;
}

function BlurryCap({ resolution, id, rotation, size, disabled, title, liveTitleRef }: BlurryCapProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled,
  });
  const [isHovered, setIsHovered] = useState(false);
  const dndCss = { touchAction: "none" };
  const [dynamicSizes] = useState(() => {
    switch (resolution.type) {
      case "high":
        return {
          containerSize: size.container,
          gaugeSize: size.gauge,
          gaugeTickLength: size.gaugeTick,
          dialSize: size.dial,
          dialTickLength: size.dialTick,
        };
      case "midhigh":
        return {
          containerSize: size.container * 0.7,
          gaugeSize: size.gauge * 0.7,
          gaugeTickLength: size.gaugeTick * 0.7,
          dialSize: size.dial * 0.7,
          dialTickLength: size.dialTick * 0.7,
        };
      case "midlow":
      case "low":
        return {
          containerSize: size.container * 0.5,
          gaugeSize: size.gauge * 0.5,
          gaugeTickLength: size.gaugeTick * 0.5,
          dialSize: size.dial * 0.5,
          dialTickLength: size.dialTick * 0.5,
        };
    }
  });

  const [dialTickLeftPercentage] = useState(73);
  const [gaugeFactor] = useState(45);
  const [gaugeTickCount] = useState(360 / gaugeFactor);
  const [gaugeTicks] = useState(Array.from({ length: gaugeTickCount }, (_, i) => i));

  const tooltipStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "calc(100% + 10px)",
    transform: "translateY(-50%)",
    color: "rgb(227,227,227)",
    fontWeight: "bold",
    textAlign: "center",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 1000,
    letterSpacing: 1,
    fontSize: 11,
  };

  return (
    <div
      title={liveTitleRef ? undefined : title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${dynamicSizes.containerSize}px`,
        height: `${dynamicSizes.containerSize}px`,
        position: "relative",
      }}
    >
      {/* gauge */}
      <div
        style={{
          zIndex: 1,
          position: "absolute",
          width: `${dynamicSizes.gaugeSize}px`,
          height: `${dynamicSizes.gaugeSize}px`,
        }}
      >
        {gaugeTicks.map((_, index) => {
          const r = index * gaugeFactor;
          return (
            <div
              key={index}
              style={{
                zIndex: 1,
                position: "absolute",
                left: "50%",
                top: "0%",
                width: `${1}px`,
                height: `${dynamicSizes.gaugeTickLength}px`,
                transformOrigin: `center ${dynamicSizes.gaugeSize / 2}px`,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                transform: `translateX(-50%) rotate(${r}deg)`,
              }}
            />
          );
        })}
      </div>
      {/* dial */}
      <div
        style={{
          zIndex: 1,
          position: "absolute",
          width: `${dynamicSizes.dialSize}px`,
          height: `${dynamicSizes.dialSize}px`,
          background: "rgba(255,255,255,0.01)",
          border: `1px solid rgb(70, 70, 70)`,
          backdropFilter: "blur(3px)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          zIndex: 1,
          transform: `rotate(${rotation}deg)`,
          position: "absolute",
          width: `${dynamicSizes.containerSize}px`,
          height: `${dynamicSizes.containerSize}px`,
        }}
      >
        {/* tick */}
        <div
          style={{
            zIndex: 2,
            top: "50%",
            left: `${dialTickLeftPercentage}%`,
            position: "absolute",
            borderRadius: 2,
            width: dynamicSizes.dialTickLength,
            height: `${2}px`,
            backgroundImage: "linear-gradient(to right, rgb(189, 189, 189) 15%,rgb(228, 228, 228))",
          }}
        />
      </div>
      {liveTitleRef ? (
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            zIndex: 3,
            ...dndCss,
            position: "absolute",
            width: `${dynamicSizes.dialSize}px`,
            height: `${dynamicSizes.dialSize}px`,
            cursor: isDragging ? "grabbing" : disabled ? "" : "grab",
            borderRadius: "50%",
          }}
        >
          {isDragging && (title || liveTitleRef) && (
            <div ref={liveTitleRef} style={tooltipStyle}>
              {title}
            </div>
          )}
          {!isDragging && isHovered && title && <div style={tooltipStyle}>{title}</div>}
        </div>
      ) : (
        <div
          ref={setNodeRef}
          title={title}
          {...listeners}
          {...attributes}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            zIndex: 3,
            ...dndCss,
            position: "absolute",
            width: `${dynamicSizes.dialSize}px`,
            height: `${dynamicSizes.dialSize}px`,
            cursor: isDragging ? "grabbing" : disabled ? "" : "grab",
            borderRadius: "50%",
          }}
        ></div>
      )}
    </div>
  );
}
