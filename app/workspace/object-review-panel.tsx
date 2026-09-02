import { useContext, useMemo, useRef, useState } from "react";
import { useObjectReview } from "./hooks/useObjectReview";
import { SvgRepo, asterisk200, checkCircle, chevronLeft, chevronRight, closeIcon, dragIndicator } from "../svg-repo";
import { MAX_MASK_OBJECTS } from "./mask-gl";
import { acceptedObjectCount, editedRegion, type EditableRegion, type MaskEditSession } from "./states/ui-state";
import { buildObjectShapeFromRings, cachedObjectShape, flattenPathData } from "./canvas-media/object-shape";
import { ringPieces } from "./canvas-media/object-path";
import { useDraggable } from "@dnd-kit/core";
import { FLOATINGBAR_DND_ID } from "./bars/floatingbar";
import { dellaRespira } from "../fonts";
import { MaskContext, UIContext } from "./workspace.client";
import Toggle from "../components/toggle";

const DECISION_COLOR = {
  none: "rgb(67, 67, 67)",
  accepted: "rgb(76, 175, 80)",
  rejected: "rgb(211, 71, 71)",
} as const;

function RetouchRevert({
  session,
  region,
  isLocked,
  revertShape,
}: {
  session: MaskEditSession;
  region: EditableRegion;
  isLocked: boolean;
  revertShape: () => void;
}) {
  const { notifyMaskRetouchRequested } = useContext(MaskContext);
  const { uiState } = useContext(UIContext);
  const retouchingRef = useRef(false);
  const [isRetouching, setIsRetouching] = useState(false);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
      case "midhigh":
      case "midlow":
      case "low":
        return {
          container: { gap: 8 },
          retouch: { borderRadius: 4, padding: "5px 0", letterSpacing: 1, fontSize: 12 },
          revert: { borderRadius: 4, padding: "5px 10px", letterSpacing: 1, fontSize: 12 },
        };
    }
  });

  const outline = session.editedShape?.path ?? region.shape;
  const hasOutline = !!outline || session.subject === "light";
  const canRetouch = !isLocked && hasOutline && !isRetouching;
  const isRetouched = session.retouch !== undefined;
  const canRevert = session.editedShape !== undefined || isRetouched;

  const retouch = async () => {
    if (retouchingRef.current) return;
    retouchingRef.current = true;
    setIsRetouching(true);
    try {
      await notifyMaskRetouchRequested(session.maskKey);
    } finally {
      retouchingRef.current = false;
      setIsRetouching(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...dynamicSizes.container }}>
      <button
        className={dellaRespira.className}
        type="button"
        disabled={!canRetouch}
        onClick={() => void retouch()}
        style={{
          flex: 1,
          border: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgb(24, 24, 24)",
          boxShadow: "none",
          color: "inherit",
          opacity: canRetouch ? 1 : 0.4,
          cursor: isRetouching ? "progress" : canRetouch ? "pointer" : "default",
          transition: "background 0.3s, box-shadow 0.3s",
          width: "50%",
          fontWeight: "bold",
          ...dynamicSizes.retouch,
        }}
      >
        {"retouch"}
      </button>
      <button
        className={dellaRespira.className}
        type="button"
        disabled={!canRevert}
        onClick={revertShape}
        style={{
          border: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgb(24, 24, 24)",
          color: "inherit",
          opacity: canRevert ? 1 : 0.4,
          cursor: canRevert ? "pointer" : "default",
          width: "50%",
          fontWeight: "bold",
          ...dynamicSizes.revert,
        }}
      >
        revert
      </button>
    </div>
  );
}

export function ReviewPanel() {
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const { listeners, isDragging } = useDraggable({ id: FLOATINGBAR_DND_ID });
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
      case "midhigh":
      case "midlow":
      case "low":
        return {
          container: { gap: 12, width: 320 },
          header: { gap: 10 },
          dragHandle: { width: 18, height: 18 },
          position: { gap: 10, fontSize: 12, letterSpacing: 2 },
          chevron: { width: 18, height: 18 },
          close: { width: 18, height: 18 },
          message: { fontSize: 12, letterSpacing: 2 },
          textarea: { padding: "6px 8px", borderRadius: 4, fontSize: 13 },
          actions: { gap: 8 },
          actionButton: { padding: "8px 0", borderRadius: 4, letterSpacing: 2, fontSize: 13 },
          footer: { gap: 6, paddingTop: 4 },
          decision: { width: 18, height: 18 },
        };
    }
  });

  const {
    session,
    review,
    isDeciding,
    currentDecision,
    currentDescription,
    isLocked,
    requestRedo,
    decideCurrentObject,
    saveEditedLight,
    revertShape,
    goToPreviousCandidate,
    goToNextCandidate,
    endReview,
  } = useObjectReview();

  const edited = session?.editedShape?.path;
  const { shapeRefusal } = useMemo((): {
    shapeRefusal: string | undefined;
  } => {
    if (!edited) return { shapeRefusal: undefined };
    const rings = flattenPathData(edited);
    const pieces = ringPieces(rings).pieces.length;
    if (pieces > 1) {
      return {
        shapeRefusal: `the outline is in ${pieces} pieces -- click the one to keep, and the rest are discarded`,
      };
    }
    if (cachedObjectShape(edited)) return { shapeRefusal: undefined };
    const built = buildObjectShapeFromRings(rings);
    return { shapeRefusal: built.ok ? undefined : built.reason };
  }, [edited]);

  if (!session) return null;

  const region = editedRegion(session);
  if (!region) return null;

  const position = review ? review.currentIndex + 1 : 1;
  const total = review?.candidates.length ?? 1;
  const accepted = review ? acceptedObjectCount(review.decisions) : 0;
  const hasDecision = currentDecision !== undefined;
  const redoRequested = hasDecision && !isLocked;

  const commit = () => {
    const description = descriptionRef.current?.value.trim() ?? "";
    if (!description) {
      descriptionRef.current?.focus();
      return;
    }
    if (shapeRefusal) return;
    if (session.subject === "light") void saveEditedLight(description);
    else void decideCurrentObject("accepted", description);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        ...dynamicSizes.container,
      }}
    >
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
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            fontWeight: "bold",
            color: "rgb(200, 200, 200)",
            ...dynamicSizes.position,
          }}
        >
          <SvgRepo
            title="previous candidate"
            svg={position <= 1 ? chevronLeft("rgb(67,67,67)") : chevronLeft()}
            containerStyle={{
              ...dynamicSizes.chevron,
              cursor: position <= 1 ? "default" : "pointer",
            }}
            scale={0.75}
            onContainerClick={position <= 1 ? undefined : goToPreviousCandidate}
          />
          {position} of {total}
          <SvgRepo
            title="next candidate"
            svg={position >= total ? chevronRight("rgb(67,67,67)") : chevronRight()}
            containerStyle={{
              ...dynamicSizes.chevron,
              cursor: position >= total ? "default" : "pointer",
            }}
            scale={0.85}
            onContainerClick={position >= total ? undefined : goToNextCandidate}
          />
        </div>

        <SvgRepo
          svg={closeIcon()}
          onContainerClick={endReview}
          containerStyle={{ marginLeft: "auto", ...dynamicSizes.close }}
          scale={0.75}
        />
      </div>
      <div
        style={{
          display: "grid",
          placeItems: "center",
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            textAlign: "center",
            color: shapeRefusal ? "rgb(211, 71, 71)" : "rgb(200, 200, 200)",
            textWrap: "nowrap",
            ...dynamicSizes.message,
          }}
        >
          {shapeRefusal
            ? shapeRefusal
            : session.editingShape
              ? `drag anchors to reshape this ${session.subject}`
              : `click polygons to reform this ${session.subject}`}
        </div>
      </div>
      <RetouchRevert session={session} region={region} isLocked={isLocked} revertShape={revertShape} />
      <textarea
        rows={3}
        className={dellaRespira.className}
        key={`${session.subject}|review|${region.id}`}
        ref={descriptionRef}
        placeholder={`describe me...`}
        defaultValue={currentDecision === "accepted" ? (currentDescription ?? "") : ""}
        autoComplete="off"
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgb(24, 24, 24)",
          color: "inherit",
          ...dynamicSizes.textarea,
        }}
      />
      <div style={{ display: "flex", ...dynamicSizes.actions }}>
        <button
          className={dellaRespira.className}
          type="button"
          disabled={isDeciding || isLocked}
          onClick={() => void decideCurrentObject("rejected")}
          style={{
            flex: 1,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgb(24, 24, 24)",
            color: "inherit",
            cursor: isDeciding ? "progress" : isLocked ? "not-allowed" : "pointer",
            opacity: isDeciding || isLocked ? 0.4 : 1,
            fontWeight: "bold",
            ...dynamicSizes.actionButton,
          }}
        >
          {"reject"}
        </button>
        <button
          className={dellaRespira.className}
          type="button"
          disabled={isDeciding || isLocked || shapeRefusal !== undefined}
          onClick={commit}
          style={{
            flex: 1,
            background: isDeciding || isLocked || shapeRefusal ? "rgba(67, 67, 67, 0.4)" : "rgb(67, 67, 67)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "inherit",
            cursor: isDeciding ? "progress" : isLocked || shapeRefusal ? "not-allowed" : "pointer",
            fontWeight: "bold",
            opacity: isDeciding || isLocked || shapeRefusal ? 0.4 : 1,
            ...dynamicSizes.actionButton,
          }}
        >
          {"accept"}
        </button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          ...dynamicSizes.footer,
        }}
      >
        <span>slots remaining: {MAX_MASK_OBJECTS - accepted}</span>
        <div onDoubleClick={requestRedo} style={{ display: "flex", flexShrink: 0 }}>
          <SvgRepo
            title={
              !hasDecision
                ? "no decision made yet"
                : redoRequested
                  ? `${currentDecision} -- edit the triangles, then accept or reject to record a new decision`
                  : `already ${currentDecision} -- double-click to unlock and decide again`
            }
            svg={checkCircle(DECISION_COLOR[currentDecision ?? "none"])}
            containerStyle={{
              ...dynamicSizes.decision,
              cursor: hasDecision ? "pointer" : "default",
              opacity: redoRequested ? 0.55 : 1,
            }}
            scale={0.75}
          />
        </div>
      </div>
    </div>
  );
}

export function EditPanel() {
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const { listeners, isDragging } = useDraggable({ id: FLOATINGBAR_DND_ID });
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          container: { gap: 12, width: 320 },
          header: { gap: 10 },
          dragHandle: { width: 18, height: 18 },
          close: { width: 18, height: 18 },
          message: { fontSize: 12, letterSpacing: 2 },
          textarea: { padding: "6px 8px", borderRadius: 4, fontSize: 13 },
          saveButton: { padding: "8px 0", borderRadius: 4, letterSpacing: 2, fontSize: 13 },
          lowpoly: { fontSize: 12, letterSpacing: 1, gap: 6 },
          toggle: {
            track: { width: 26, height: 12, borderRadius: 10, padding: 1 },
            button: { width: 8, height: 8 },
            translateX: 14,
          },
          subjectIcon: { width: 18, height: 18 },
        };
      case "midhigh":
      case "midlow":
        return {
          container: { gap: 12, width: 300 },
          header: { gap: 10 },
          dragHandle: { width: 16, height: 16 },
          close: { width: 16, height: 16 },
          message: { fontSize: 11, letterSpacing: 2 },
          textarea: { padding: "6px 8px", borderRadius: 4, fontSize: 12 },
          saveButton: { padding: "8px 0", borderRadius: 4, letterSpacing: 2, fontSize: 12 },
          lowpoly: { fontSize: 11, letterSpacing: 1, gap: 6 },
          toggle: {
            track: { width: 26, height: 12, borderRadius: 10, padding: 1 },
            button: { width: 8, height: 8 },
            translateX: 14,
          },
          subjectIcon: { width: 16, height: 16 },
        };
      case "low":
        return {
          container: { gap: 12, width: 280 },
          header: { gap: 10 },
          dragHandle: { width: 14, height: 14 },
          close: { width: 14, height: 14 },
          message: { fontSize: 10, letterSpacing: 2 },
          textarea: { padding: "6px 8px", borderRadius: 4, fontSize: 11 },
          saveButton: { padding: "8px 0", borderRadius: 4, letterSpacing: 2, fontSize: 11 },
          lowpoly: { fontSize: 10, letterSpacing: 1, gap: 6 },
          toggle: {
            track: { width: 26, height: 12, borderRadius: 10, padding: 1 },
            button: { width: 8, height: 8 },
            translateX: 14,
          },
          subjectIcon: { width: 14, height: 14 },
        };
    }
  });

  const { session, isDeciding, isLocked, saveEditedObject, saveEditedLight, setLowpoly, revertShape, endReview } =
    useObjectReview();

  const edited = session?.editedShape?.path;
  const { shapeRefusal } = useMemo((): {
    shapeRefusal: string | undefined;
  } => {
    if (!edited) return { shapeRefusal: undefined };
    const rings = flattenPathData(edited);
    const pieces = ringPieces(rings).pieces.length;
    if (pieces > 1) {
      return {
        shapeRefusal: `the outline is in ${pieces} pieces -- click the one to keep, and the rest are discarded`,
      };
    }
    if (cachedObjectShape(edited)) return { shapeRefusal: undefined };
    const built = buildObjectShapeFromRings(rings);
    return { shapeRefusal: built.ok ? undefined : built.reason };
  }, [edited]);

  if (!session) return null;

  const region = editedRegion(session);
  if (!region) return null;

  const commit = () => {
    const description = descriptionRef.current?.value.trim() ?? "";
    if (!description) {
      descriptionRef.current?.focus();
      return;
    }
    if (shapeRefusal) return;
    if (session.subject === "light") void saveEditedLight(description);
    else void saveEditedObject(description);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        ...dynamicSizes.container,
      }}
    >
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
          onContainerClick={endReview}
          containerStyle={{ marginLeft: "auto", ...dynamicSizes.close }}
          scale={0.75}
        />
      </div>
      <div
        style={{
          display: "grid",
          placeItems: "center",
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            textAlign: "center",
            color: shapeRefusal ? "rgb(211, 71, 71)" : "rgb(200, 200, 200)",
            textWrap: "nowrap",
            ...dynamicSizes.message,
          }}
        >
          {shapeRefusal
            ? shapeRefusal
            : session.editingShape
              ? `drag anchors to reshape this ${session.subject}`
              : `click polygons to reform this ${session.subject}`}
        </div>
      </div>
      {session.subject === "light" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...dynamicSizes.lowpoly,
          }}
        >
          <SvgRepo svg={asterisk200()} scale={1} containerStyle={{ ...dynamicSizes.subjectIcon }} />
          <span
            title={
              session.lowpoly
                ? "this light is read once per polygon, so its highlight and falloff step from triangle to triangle -- turn off to read it per pixel from its shape alone"
                : "this light is read per pixel from its shape alone, so it ignores the mesh underneath it -- turn on to go back to reading it once per polygon"
            }
            style={{
              textShadow: session.lowpoly ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
              userSelect: "none",
              textWrap: "nowrap",
            }}
          >
            {"low-poly"}
          </span>
          <Toggle
            value={session.lowpoly}
            disabled={isLocked}
            onClick={() => setLowpoly(!session.lowpoly)}
            trackStyles={{ ...dynamicSizes.toggle.track }}
            buttonStyles={{ ...dynamicSizes.toggle.button }}
            translateX={dynamicSizes.toggle.translateX}
          />
        </div>
      ) : null}
      <RetouchRevert session={session} region={region} isLocked={isLocked} revertShape={revertShape} />
      <textarea
        rows={3}
        className={dellaRespira.className}
        key={`${session.subject}|edit|${region.id}`}
        ref={descriptionRef}
        placeholder={`describe me...`}
        defaultValue={region.description}
        autoComplete="off"
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgb(24, 24, 24)",
          color: "inherit",
          ...dynamicSizes.textarea,
        }}
      />
      <div style={{ display: "flex" }}>
        <button
          className={dellaRespira.className}
          type="button"
          disabled={isDeciding || isLocked || shapeRefusal !== undefined}
          onClick={commit}
          style={{
            flex: 1,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: isDeciding || isLocked || shapeRefusal ? "rgba(67, 67, 67, 0.4)" : "rgb(67, 67, 67)",
            color: "inherit",
            opacity: isDeciding || isLocked || shapeRefusal ? 0.4 : 1,
            cursor: isDeciding ? "progress" : isLocked || shapeRefusal ? "not-allowed" : "pointer",
            fontWeight: "bold",
            ...dynamicSizes.saveButton,
          }}
        >
          {"save"}
        </button>
      </div>
    </div>
  );
}
