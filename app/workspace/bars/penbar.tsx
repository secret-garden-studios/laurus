import { useContext, useState } from "react";
import { UIContext } from "../workspace.client";
import { inkPen300, SvgRepo } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { UIActionType } from "../states/ui-state";

/**
 * The pen's controls.
 *
 * Shown while an object's outline is open for editing during a mask review --
 * the pen is entered and left through the review panel rather than picked from
 * the toolbar, so this bar appears and disappears with the overlay it belongs
 * to. See withShapeEditing in ui-state.
 */
export default function Penbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          svgSize: { width: 22, height: 22 },
          toggle: {
            div: { paddingLeft: 20, paddingRight: 20, gap: 12, fontSize: 13 },
            track: { width: 26, height: 12, borderRadius: 10, padding: 1 },
            button: { width: 8, height: 8 },
            translateX: 14,
          },
        };
      case "midhigh":
        return {
          svgSize: { width: 18, height: 18 },
          toggle: {
            div: { paddingLeft: 14, paddingRight: 14, gap: 8, fontSize: 12 },
            track: { width: 22, height: 10, borderRadius: 10, padding: 1 },
            button: { width: 6, height: 6 },
            translateX: 12,
          },
        };
      case "midlow":
      case "low":
        return {
          svgSize: { width: 16, height: 16 },
          toggle: {
            div: { paddingLeft: 12, paddingRight: 12, gap: 8, fontSize: 11 },
            track: { width: 20, height: 9, borderRadius: 10, padding: 1 },
            button: { width: 5, height: 5 },
            translateX: 11,
          },
        };
    }
  });

  const isStitchOn = uiState.tool.type === "pen" && uiState.tool.stitch;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        width: "100%",
        overflowX: "auto",
      }}
    >
      <SvgRepo
        title="pen"
        svg={inkPen300()}
        containerStyle={{ ...dynamicSizes.svgSize }}
        scale={1}
        scaleToContaier={true}
      />
      <div
        title={
          "click two anchors on the outline to draw the shortest curve between them. " +
          "whatever lay between them comes off: a run of two or more branches off as an island of its own, " +
          "a single anchor is deleted, and two neighbours just pull straight"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isStitchOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"stitch"}</span>
        <Toggle
          value={isStitchOn}
          onClick={() => {
            if (uiState.tool.type !== "pen") return;
            uiDispatch({
              type: UIActionType.SetTool,
              value: { ...uiState.tool, stitch: !uiState.tool.stitch },
            });
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
    </div>
  );
}
