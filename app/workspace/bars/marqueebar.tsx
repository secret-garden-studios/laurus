import { useContext, useEffect, useState } from "react";
import { HoverContext, MaskContext, UIContext } from "../workspace.client";
import { lassoSelect, SvgRepo } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { MarqueeArm, UIActionType, marqueeArm } from "../states/ui-state";
import { WorkspaceResolution } from "../workspace.config";

function marqueebarSizes(resolution: WorkspaceResolution) {
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
      };
  }
}

type MarqueebarSizes = ReturnType<typeof marqueebarSizes>;

export default function Marqueebar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyMaskToolChanged } = useContext(MaskContext);
  const { selectedImgKeys, selectedSvgKeys } = useContext(HoverContext);
  const [dynamicSizes] = useState(() => marqueebarSizes(uiState.resolution));

  const arm = marqueeArm(uiState, selectedImgKeys, selectedSvgKeys);
  const armType = arm?.type;

  useEffect(() => {
    if (uiState.tool.type !== "marquee") return;
    const nextStack = armType === "browser" && uiState.tool.stack;
    const nextCopy = armType === "selection" && uiState.tool.copy;
    if (nextStack === uiState.tool.stack && nextCopy === uiState.tool.copy) return;
    uiDispatch({
      type: UIActionType.SetTool,
      value: { ...uiState.tool, stack: nextStack, copy: nextCopy },
    });
    notifyMaskToolChanged("marquee");
  }, [armType, uiState.tool, uiDispatch, notifyMaskToolChanged]);

  return (
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
        svg={lassoSelect()}
        containerStyle={{
          width: dynamicSizes.svgSize.width,
          height: dynamicSizes.svgSize.height,
        }}
        scale={1}
        scaleToContaier={true}
      />
      {arm === undefined ? (
        <Greeting dynamicSizes={dynamicSizes} />
      ) : (
        <DropControls dynamicSizes={dynamicSizes} arm={arm} />
      )}
    </div>
  );
}

interface MarqueebarControls {
  dynamicSizes: MarqueebarSizes;
}

interface DropControls extends MarqueebarControls {
  arm: MarqueeArm;
}

function Greeting({ dynamicSizes }: MarqueebarControls) {
  return (
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
        {"choose media from the browser, or circle media on the canvas"}
      </div>
    </div>
  );
}

function DropControls({ dynamicSizes, arm }: DropControls) {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { notifyMaskToolChanged } = useContext(MaskContext);
  const { setSelectedImgKeys, setSelectedSvgKeys } = useContext(HoverContext);
  const isStackOn = uiState.tool.type === "marquee" && uiState.tool.stack;
  const isCopyOn =
    uiState.tool.type === "marquee" && (arm.type === "browser" ? !uiState.tool.stack : uiState.tool.copy);
  const isDropDerived = arm.type === "browser" && isCopyOn;
  const verb = arm.type === "browser" ? "drop" : "copy";

  return (
    <>
      {arm.type !== "browser" ? null : (
        <div
          title="click existing canvas media to stack the browser item on top of it"
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            ...dynamicSizes.toggle.div,
          }}
        >
          <span
            style={{
              textShadow: isStackOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
            }}
          >
            {"stack"}
          </span>
          <Toggle
            value={isStackOn}
            onClick={() => {
              if (uiState.tool.type !== "marquee") return;
              const newStack = !isStackOn;
              const newValue = newStack
                ? { ...uiState.tool, stack: newStack, copy: false }
                : { ...uiState.tool, stack: newStack };
              uiDispatch({ type: UIActionType.SetTool, value: newValue });
              notifyMaskToolChanged(newValue.type);
              if (newStack) {
                setSelectedImgKeys(new Set());
                setSelectedSvgKeys(new Set());
              }
            }}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
          />
        </div>
      )}
      <div
        title={
          arm.type === "browser"
            ? "an armed browser item can always be dropped freeform -- turn on stack, or de-select the item, to stop"
            : "open the copy panel to preset where and how big the copy lands"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          ...(arm.type === "browser" ? { borderLeft: "1px solid rgba(255, 255, 255, 0.1)" } : {}),
          ...dynamicSizes.toggle.div,
        }}
      >
        <span
          style={{
            textShadow: isCopyOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
          }}
        >
          {verb}
        </span>
        <Toggle
          value={isCopyOn}
          onClick={() => {
            if (uiState.tool.type !== "marquee") return;
            const newValue =
              arm.type === "browser"
                ? { ...uiState.tool, stack: false }
                : { ...uiState.tool, copy: !isCopyOn, stack: false };
            uiDispatch({ type: UIActionType.SetTool, value: newValue });
            notifyMaskToolChanged(newValue.type);
          }}
          trackStyles={{ ...dynamicSizes.toggle.track, ...(isDropDerived ? { cursor: "default" } : {}) }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      <div />
    </>
  );
}
