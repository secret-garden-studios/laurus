import { useContext, useState } from "react";
import { UIContext } from "../workspace.client";
import { inkPen300, SvgRepo } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { UIActionType } from "../states/ui-state";
import { useObjectReview } from "../hooks/useObjectReview";

const GRIDLINES_OPTIONS = [
  { label: "dim", value: false },
  { label: "bright", value: true },
] as const;

export default function Penbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { session, isLocked, setEditingShape } = useObjectReview();
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
          segment: { fontSize: 12 },
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
          segment: { fontSize: 11 },
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
          segment: { fontSize: 11 },
        };
    }
  });

  const isStitchOn = uiState.tool.type === "pen" && uiState.tool.stitch;
  const isAddAnchorOn = uiState.tool.type === "pen" && uiState.tool.addAnchor;
  const showAnchors = uiState.tool.type !== "pen" || uiState.tool.showAnchors;
  const handlesUp = session !== undefined && session.editingShape;

  if (!session) {
    return (
      <div style={{ display: "flex", alignItems: "center", height: "100%", width: "100%", overflowX: "auto" }}>
        <SvgRepo
          title="pen"
          svg={inkPen300()}
          containerStyle={{ ...dynamicSizes.svgSize }}
          scale={1}
          scaleToContaier={true}
        />
        <span
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            userSelect: "none",
            ...dynamicSizes.toggle.div,
          }}
        >
          {"click a light or an object on a mask to edit its outline"}
        </span>
      </div>
    );
  }

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
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          opacity: isLocked ? 0.4 : 1,
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: handlesUp ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"edit shape"}</span>
        <Toggle
          value={handlesUp}
          disabled={isLocked}
          onClick={() => {
            if (!session) return;
            setEditingShape(!session.editingShape);
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
          opacity: handlesUp ? 1 : 0.4,
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: showAnchors && handlesUp ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>
          {"show anchors"}
        </span>
        <Toggle
          value={showAnchors}
          disabled={!handlesUp}
          onClick={() => {
            if (uiState.tool.type !== "pen") return;
            const next = !uiState.tool.showAnchors;
            uiDispatch({
              type: UIActionType.SetTool,
              value: {
                ...uiState.tool,
                showAnchors: next,
                stitch: next && uiState.tool.stitch,
                addAnchor: next && uiState.tool.addAnchor,
              },
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
          height: "100%",
          opacity: showAnchors && handlesUp ? 1 : 0.4,
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isStitchOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"stitch"}</span>
        <Toggle
          value={isStitchOn}
          disabled={!showAnchors || !handlesUp}
          onClick={() => {
            if (uiState.tool.type !== "pen") return;
            const next = !uiState.tool.stitch;
            uiDispatch({
              type: UIActionType.SetTool,
              value: { ...uiState.tool, stitch: next, addAnchor: next ? false : uiState.tool.addAnchor },
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
          height: "100%",
          opacity: showAnchors && handlesUp ? 1 : 0.4,
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isAddAnchorOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"add anchor"}</span>
        <Toggle
          value={isAddAnchorOn}
          disabled={!showAnchors || !handlesUp}
          onClick={() => {
            if (uiState.tool.type !== "pen") return;
            const next = !uiState.tool.addAnchor;
            uiDispatch({
              type: UIActionType.SetTool,
              value: { ...uiState.tool, addAnchor: next, stitch: next ? false : uiState.tool.stitch },
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
          height: "100%",
          opacity: handlesUp ? 1 : 0.4,
          ...dynamicSizes.toggle.div,
        }}
      >
        <span>{"gridlines"}</span>
        <div style={{ display: "flex", alignItems: "center", letterSpacing: 2 }}>
          {GRIDLINES_OPTIONS.map((option) => {
            const isSelected = uiState.gridlinesBright === option.value;
            return (
              <span
                key={option.label}
                onClick={() => {
                  if (!handlesUp) return;
                  uiDispatch({ type: UIActionType.SetGridlinesBright, value: option.value });
                }}
                style={{
                  cursor: !handlesUp ? "" : "pointer",
                  color: !handlesUp ? "rgb(67,67,67)" : isSelected ? "inherit" : "rgb(67,67,67)",
                  textShadow: isSelected ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
                  padding: "4px 8px",
                  ...dynamicSizes.segment,
                }}
              >
                {option.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
