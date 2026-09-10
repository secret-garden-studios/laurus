import { useContext, useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { SvgRepo, closeIcon, dragIndicator } from "../svg-repo";
import { dellaRespira } from "../fonts";
import { FLOATINGBAR_DND_ID } from "./bars/floatingbar";
import { CoreContext, MaskContext, UIContext } from "./workspace.client";
import { UIActionType } from "./states/ui-state";
import { CoreActionType } from "./states/core-state";
import { MIN_LIMIT_FACTOR } from "./workspace.config";
import { writeLightSourceKeyframe } from "./keyframe-writer";
import type { KeyframeMode } from "./keyframes";
import { toKeyframePreview } from "./keyframe-preview";
import { createEffectGroup, createLightSource, updateLightSource, type LaurusEffect } from "./workspace.server";

function keyframePanelSizes(resolution: string) {
  switch (resolution) {
    case "high":
      return { container: { gap: 12 }, dragHandle: { width: 18, height: 18 }, label: { fontSize: 12 }, save: 12 };
    case "midhigh":
    case "midlow":
      return { container: { gap: 10 }, dragHandle: { width: 16, height: 16 }, label: { fontSize: 11 }, save: 11 };
    default:
      return { container: { gap: 8 }, dragHandle: { width: 14, height: 14 }, label: { fontSize: 10 }, save: 10 };
  }
}

export default function KeyframePanel() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreState, dispatch } = useContext(CoreContext);
  const { notifyMaskKeyframePreview } = useContext(MaskContext);
  const { listeners, isDragging } = useDraggable({ id: FLOATINGBAR_DND_ID });
  const [dynamicSizes] = useState(() => keyframePanelSizes(uiState.resolution.type));
  const [saving, setSaving] = useState(false);
  const [awaitingRevision, setAwaitingRevision] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<KeyframeMode>("hold");

  const committedRef = useRef(false);

  const draft = uiState.keyframeDraft;

  useEffect(() => {
    if (!draft || draft.timeSeconds !== uiState.playheadSeconds) {
      notifyMaskKeyframePreview(undefined, undefined);
      return;
    }
    notifyMaskKeyframePreview(
      draft.maskKey,
      toKeyframePreview(draft.subject, draft.subjectId, draft.resting, draft.targets),
    );
  }, [draft, uiState.playheadSeconds, notifyMaskKeyframePreview]);

  useEffect(() => {
    return () => {
      notifyMaskKeyframePreview(undefined, undefined);
      if (committedRef.current) uiDispatch({ type: UIActionType.ClearKeyframeDraft });
    };
  }, [notifyMaskKeyframePreview, uiDispatch]);

  useEffect(() => {
    if (awaitingRevision === undefined || uiState.scrubRevision === awaitingRevision) return;
    setAwaitingRevision(undefined);
    committedRef.current = false;
    notifyMaskKeyframePreview(undefined, undefined);
    uiDispatch({ type: UIActionType.ClearKeyframeDraft });
  }, [awaitingRevision, uiState.scrubRevision, notifyMaskKeyframePreview, uiDispatch]);

  const cancel = () => {
    setAwaitingRevision(undefined);
    committedRef.current = false;
    notifyMaskKeyframePreview(undefined, undefined);
    uiDispatch({ type: UIActionType.ClearKeyframeDraft });
  };
  const stale = draft !== undefined && draft.timeSeconds !== uiState.playheadSeconds;
  const canSave = draft !== undefined && !stale && !saving && awaitingRevision === undefined;

  const save = async () => {
    if (!draft || stale || saving) return;
    const chainUnit = coreState.effects.find(
      (effect) => effect.type === "light_source" && effect.value.math.has(draft.inputId),
    );
    const anyEffect = coreState.effects[0];
    let effectGroupId =
      chainUnit?.value.effect_group_id ??
      anyEffect?.value.effect_group_id ??
      coreState.effectGroups.keys().next().value;

    setSaving(true);
    if (!effectGroupId) {
      const group = await createEffectGroup(coreState.apiOrigin, coreState.accessToken, {
        description: "",
        order: 0,
        project_id: coreState.project.project_id,
        disabled: false,
      });
      if (!group) {
        console.error("failed to create an effect group for the keyframe");
        setSaving(false);
        return;
      }
      dispatch({ type: CoreActionType.SetEffectGroup, value: { ...group } });
      effectGroupId = group.effect_group_id;
    }

    try {
      const result = await writeLightSourceKeyframe({
        apiOrigin: coreState.apiOrigin,
        accessToken: coreState.accessToken,
        projectId: coreState.project.project_id,
        effectGroupId,
        inputId: draft.inputId,
        timeSeconds: draft.timeSeconds,
        resting: draft.resting,
        patch: draft.targets,
        defaultLimitFactor: MIN_LIMIT_FACTOR,
        mode,
        timelineEnd: Math.max(0, ...coreState.effects.map((effect) => effect.value.end)),
        effects: coreState.effects,
        io: { create: createLightSource, update: updateLightSource },
      });
      if (result.outcome === "failed") {
        console.error("failed to save keyframe", { input_id: draft.inputId });
        return;
      }
      const written = new Map(result.units.map((unit) => [unit.light_source_id, unit]));
      const merged: LaurusEffect[] = coreState.effects.map((effect) => {
        const unit = written.get(effect.key);
        if (!unit) return effect;
        written.delete(effect.key);
        return { type: "light_source", key: unit.light_source_id, value: { ...unit } };
      });
      written.forEach((unit) => {
        merged.push({ type: "light_source", key: unit.light_source_id, value: { ...unit } });
      });
      setAwaitingRevision(uiState.scrubRevision);
      committedRef.current = true;
      dispatch({ type: CoreActionType.SetEffects, value: merged, preserveCache: true });
      dispatch({ type: CoreActionType.SetInputsToRender, value: new Set([draft.inputId]) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", ...dynamicSizes.container }}>
      <div
        {...listeners}
        style={{
          display: "flex",
          alignItems: "center",
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
        title={`keyframing at ${uiState.playheadSeconds.toFixed(2)}s -- rewind the playhead to edit the resting state`}
        className={dellaRespira.className}
        style={{
          whiteSpace: "nowrap",
          letterSpacing: 1,
          userSelect: "none",
          ...dynamicSizes.label,
        }}
      >
        {`${uiState.playheadSeconds.toFixed(2)}s`}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {(["hold", "ramp"] as const).map((option) => (
          <div
            key={option}
            title={
              option === "hold"
                ? "snap to this value at the playhead and hold it to the end"
                : "ramp into this value from the previous keyframe, then hold it"
            }
            onClick={() => setMode(option)}
            className={dellaRespira.className}
            style={{
              cursor: "pointer",
              letterSpacing: 1,
              fontSize: dynamicSizes.save,
              opacity: mode === option ? 1 : 0.35,
              textShadow: mode === option ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
              userSelect: "none",
            }}
          >
            {option === "hold" ? "from" : "into"}
          </div>
        ))}
      </div>
      <div
        title={draft === undefined ? "nothing staged to discard" : "discard this staged keyframe"}
        onClick={cancel}
        style={{
          display: "flex",
          alignItems: "center",
          cursor: draft === undefined ? "default" : "pointer",
          opacity: draft === undefined ? 0.35 : 1,
        }}
      >
        <SvgRepo svg={closeIcon()} containerStyle={{ ...dynamicSizes.dragHandle }} scale={0.75} />
      </div>
      <div
        title={
          draft === undefined
            ? "adjust the light source to stage a keyframe"
            : stale
              ? "this draft belongs to another moment -- move the playhead back to save it"
              : "write this keyframe to the light source units"
        }
        onClick={save}
        className={dellaRespira.className}
        style={{
          marginLeft: "auto",
          padding: "4px 10px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: 4,
          letterSpacing: 1,
          fontSize: dynamicSizes.save,
          cursor: canSave ? "pointer" : "default",
          opacity: canSave ? 1 : 0.35,
          userSelect: "none",
        }}
      >
        {saving || awaitingRevision !== undefined ? "saving" : "save"}
      </div>
    </div>
  );
}
