import { useContext, useRef, useState } from "react";
import { MaskContext, UIContext } from "../workspace.client";
import { inkPen300, SvgRepo } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { UIActionType, isObjectReviewLocked } from "../states/ui-state";

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
  const { notifyMaskRetouchRequested } = useContext(MaskContext);
  // `action.minWidth` holds the retouch button at the width of the longer of
  // its two labels, so swapping to the in-progress one does not shunt the rest
  // of the bar sideways just as the reviewer is watching it.
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
          action: { marginLeft: 20, marginRight: 20, fontSize: 13, padding: "4px 12px", minWidth: 108 },
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
          action: { marginLeft: 14, marginRight: 14, fontSize: 12, padding: "3px 10px", minWidth: 96 },
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
          action: { marginLeft: 12, marginRight: 12, fontSize: 11, padding: "3px 10px", minWidth: 88 },
        };
    }
  });

  const isStitchOn = uiState.tool.type === "pen" && uiState.tool.stitch;
  const isAddAnchorOn = uiState.tool.type === "pen" && uiState.tool.addAnchor;
  const showAnchors = uiState.tool.type !== "pen" || uiState.tool.showAnchors;

  // A lock rather than a debounce: the recut holds the main thread for a
  // couple of hundred milliseconds, and a second one queued behind the first
  // would recut the mesh the first one produced -- doing real work to no
  // effect and doubling the wait. The ref is the lock and the state is what
  // renders off it, because a click can land before React has committed the
  // disabled attribute. Same pairing the review panel uses for its own
  // in-flight decision.
  const retouchingRef = useRef(false);
  const [isRetouching, setIsRetouching] = useState(false);

  const review = uiState.objectReview;
  // A retouch recuts the mesh against the outline, so there has to be an
  // outline: a candidate detection found no shape for has nothing to cut to,
  // and a decided one is not the reviewer's to change until they unlock it.
  const outline = review?.editedShape?.path ?? review?.candidates[review.currentIndex]?.object.shape;
  const canRetouch = review !== undefined && !isObjectReviewLocked(review) && !!outline && !isRetouching;
  const isRetouched = review?.retouch !== undefined;

  const retouch = async () => {
    if (!review || retouchingRef.current) return;
    retouchingRef.current = true;
    setIsRetouching(true);
    try {
      await notifyMaskRetouchRequested(review.maskKey);
    } finally {
      retouchingRef.current = false;
      setIsRetouching(false);
    }
  };

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
          "keep the anchors on the outline. turn them off and the curve is fixed but no longer in the way -- " +
          "the small triangles it cuts near itself become clickable again, which is the other half of reviewing"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: showAnchors ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"show anchors"}</span>
        <Toggle
          value={showAnchors}
          onClick={() => {
            if (uiState.tool.type !== "pen") return;
            const next = !uiState.tool.showAnchors;
            uiDispatch({
              type: UIActionType.SetTool,
              // both of the other two are only worth anything with anchors on
              // screen -- stitching is done by clicking them, and an anchor
              // added where none can be seen is one nobody can then take hold
              // of. A toggle left on over a bare curve would be a mode the pen
              // was not really in
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
        title={
          showAnchors
            ? "click two anchors on the outline to draw the shortest curve between them. " +
              "whatever lay between them comes off: a run of two or more branches off as an island of its own, " +
              "a single anchor is deleted, and two neighbours just pull straight"
            : "stitching is done by clicking anchors -- turn 'show anchors' back on to reach them"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          opacity: showAnchors ? 1 : 0.4,
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isStitchOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"stitch"}</span>
        <Toggle
          value={isStitchOn}
          disabled={!showAnchors}
          onClick={() => {
            if (uiState.tool.type !== "pen") return;
            const next = !uiState.tool.stitch;
            uiDispatch({
              type: UIActionType.SetTool,
              // one click, two meanings, is no way to run a pen: stitching
              // reads a click on an anchor and adding reads one on the curve
              // between anchors, and those targets sit close enough together
              // that having both live at once would make every click a guess
              value: { ...uiState.tool, stitch: next, addAnchor: next ? false : uiState.tool.addAnchor },
            });
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      <div
        title={
          showAnchors
            ? "click anywhere on the outline and a new anchor is put down there. the curve does not move -- " +
              "the segment is split into the two halves it already traced -- so this only ever hands you " +
              "somewhere else to take hold of a run that had nothing to grab"
            : "an anchor added where none can be seen is one nobody can take hold of -- turn 'show anchors' back on"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          opacity: showAnchors ? 1 : 0.4,
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ textShadow: isAddAnchorOn ? "0 0 1px rgba(255, 255, 255, 1)" : "none" }}>{"add anchor"}</span>
        <Toggle
          value={isAddAnchorOn}
          disabled={!showAnchors}
          onClick={() => {
            if (uiState.tool.type !== "pen") return;
            const next = !uiState.tool.addAnchor;
            uiDispatch({
              type: UIActionType.SetTool,
              // see the stitch toggle: the two read clicks on the same outline
              value: { ...uiState.tool, addAnchor: next, stitch: next ? false : uiState.tool.stitch },
            });
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      <button
        type="button"
        disabled={!canRetouch}
        onClick={() => void retouch()}
        title={
          isRetouching
            ? "recutting the mesh..."
            : !canRetouch
              ? "there is no outline to recut the mesh against"
              : "recut the mesh along the outline, so the triangles near the curve follow it instead of straddling " +
                "it. worth doing after a stitch, which moves the curve across triangles that were never cut for it. " +
                "nothing is saved until this object is accepted"
        }
        style={{
          flexShrink: 0,
          borderRadius: 4,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: isRetouched && !isRetouching ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.05)",
          boxShadow: isRetouched && !isRetouching ? "0 0 10px 0px rgba(255, 255, 255, 0.25)" : "none",
          color: "inherit",
          fontFamily: "inherit",
          opacity: canRetouch ? 1 : 0.4,
          cursor: isRetouching ? "progress" : canRetouch ? "pointer" : "default",
          transition: "background 0.3s, box-shadow 0.3s",
          ...dynamicSizes.action,
        }}
      >
        {isRetouching ? "retouching..." : "retouch"}
      </button>
    </div>
  );
}
