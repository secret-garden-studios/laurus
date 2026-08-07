import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { SvgRepo, asterisk300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";
import { ParameterSliderX } from "@/app/components/parameter-slider";
import { useTrackpadState } from "@/app/hooks/useTrackpadState";

// Fixed baseline dial ranges (independent of any wired "light_source" effect's own math, which
// has its own separate max constants -- see LIGHT_SOURCE_SIZE_MAX etc. in workspace.config.ts).
const LIGHT_SOURCE_SIZE_MIN = 10;
const LIGHT_SOURCE_SIZE_MAX = 300;
const LIGHT_SOURCE_FALLOFF_MIN = 20;
const LIGHT_SOURCE_FALLOFF_MAX = 1000;

// Houses the four dials (size/intensity/falloff/darkness) that used to live in Maskbar -- moved
// out into their own tool/subtitlebar so they're reachable without the mask tool's
// position/size/capture controls crowding the same bar.
//
// These edit ProjectMask_V1_0.light_source_* directly and persist via updateProject, exactly the
// way Scalebar edits an img/svg's own scale_x/scale_y -- the mask's starting light source
// appearance, independent of any "light_source" effect. A wired effect's equation (edited
// separately, in LightSourceUnit) ramps FROM this starting point over time the same way a "scale"
// effect ramps from scale_x/scale_y; this bar never touches that equation.
//
// When no mask is selected yet (still mid-masking, nothing placed to persist to), this falls back
// to the live in-flight MaskContext preview instead -- unsaved, but lets the look be dialed in
// before there's a project mask entry to seed from (see Maskbar's persistMask).
export default function LightSourcebar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const { coreState, dispatch, notifyMaskAppearanceChanged, notifyMaskLightSourcePreviewToggled } =
    useContext(CoreContext);
  const { selectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
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

  // There's only something to tune once geometry is actually on screen -- same rule Maskbar's
  // texture slider used.
  const hasMesh = mask.status === "streaming" || mask.status === "done";
  // A selected placed mask takes priority over the live in-flight preview -- picking a specific
  // result to adjust should always win over whatever's still streaming in.
  const selectedMaskKey = selectedMaskKeys.size === 1 ? Array.from(selectedMaskKeys)[0] : undefined;
  const selectedMaskMeta = selectedMaskKey !== undefined ? coreState.project.masks.get(selectedMaskKey) : undefined;
  const isLightSourceControlsDisabled = !(selectedMaskKey !== undefined || hasMesh);

  // The latest not-yet-sent project state, plus whether a save is currently in flight -- refs, not
  // state, so a burst of drag events can coalesce onto the newest value without waiting on a
  // render. Persisting used to gate new edits behind `isSaving` and drop whatever slider events
  // arrived while a save was in flight; a fast drag fires far more onNewCursor events than the
  // network round-trip can keep up with, so most of a drag's updates -- including its final,
  // released-mouse value -- got silently discarded, leaving the preview parked on an earlier
  // value. Now every edit always applies locally (see saveLightSourceField below) and only the
  // network persistence coalesces: whichever value is newest when a save completes goes out next.
  const pendingLightSourceSaveRef = useRef<LaurusProjectResult | null>(null);
  const isPersistingLightSourceRef = useRef(false);
  const persistLightSourceQueue = useCallback(async () => {
    if (isPersistingLightSourceRef.current) return;
    isPersistingLightSourceRef.current = true;
    try {
      while (pendingLightSourceSaveRef.current) {
        const projectToSave = pendingLightSourceSaveRef.current;
        pendingLightSourceSaveRef.current = null;
        const saved = await updateProject(coreState.apiOrigin, coreState.accessToken, projectToSave.project_id, {
          ...projectToSave,
        });
        if (!saved) {
          console.error("failed to save light source change", { project_id: projectToSave.project_id });
        }
      }
    } finally {
      isPersistingLightSourceRef.current = false;
    }
  }, [coreState.apiOrigin, coreState.accessToken]);

  const saveLightSourceField = useCallback(
    (
      field: "light_source_size" | "light_source_intensity" | "light_source_falloff" | "light_source_darkness",
      value: number,
    ) => {
      if (selectedMaskKey === undefined) return;
      const maskMeta = coreState.project.masks.get(selectedMaskKey);
      if (!maskMeta) return;

      const newMasks = new Map(coreState.project.masks);
      const newMaskMeta: LaurusProjectMask = { ...maskMeta, [field]: value };
      newMasks.set(selectedMaskKey, newMaskMeta);
      const newProject: LaurusProjectResult = { ...coreState.project, masks: newMasks };
      dispatch({ type: CoreActionType.SetProject, value: newProject });
      // Passed directly rather than left for the mesh to re-read off coreState: this fires
      // synchronously, before React has re-rendered ProjectMaskItem with the just-dispatched
      // project, so a re-read here would still see the previous value (see
      // MaskAppearanceOverride's own comment in project-mask-item.tsx).
      notifyMaskAppearanceChanged(selectedMaskKey, {
        lightSource: {
          size: newMaskMeta.light_source_size,
          intensity: newMaskMeta.light_source_intensity,
          falloff: newMaskMeta.light_source_falloff,
          darkness: newMaskMeta.light_source_darkness,
        },
      });

      pendingLightSourceSaveRef.current = newProject;
      void persistLightSourceQueue();
    },
    [selectedMaskKey, coreState.project, dispatch, notifyMaskAppearanceChanged, persistLightSourceQueue],
  );

  const lightSourceSizeValue = selectedMaskMeta ? selectedMaskMeta.light_source_size : mask.lightSourceSize;
  const handleLightSourceSizeChange = useCallback(
    (value: number) => {
      if (selectedMaskMeta) {
        saveLightSourceField("light_source_size", value);
      } else {
        mask.setLightSourceSize(value);
      }
    },
    [selectedMaskMeta, saveLightSourceField, mask],
  );
  const lightSourceIntensityValue = selectedMaskMeta
    ? selectedMaskMeta.light_source_intensity
    : mask.lightSourceIntensity;
  const handleLightSourceIntensityChange = useCallback(
    (value: number) => {
      if (selectedMaskMeta) {
        saveLightSourceField("light_source_intensity", value);
      } else {
        mask.setLightSourceIntensity(value);
      }
    },
    [selectedMaskMeta, saveLightSourceField, mask],
  );
  const lightSourceFalloffValue = selectedMaskMeta ? selectedMaskMeta.light_source_falloff : mask.lightSourceFalloff;
  const handleLightSourceFalloffChange = useCallback(
    (value: number) => {
      if (selectedMaskMeta) {
        saveLightSourceField("light_source_falloff", value);
      } else {
        mask.setLightSourceFalloff(value);
      }
    },
    [selectedMaskMeta, saveLightSourceField, mask],
  );
  const lightSourceDarknessValue = selectedMaskMeta ? selectedMaskMeta.light_source_darkness : mask.lightSourceDarkness;
  const handleLightSourceDarknessChange = useCallback(
    (value: number) => {
      if (selectedMaskMeta) {
        saveLightSourceField("light_source_darkness", value);
      } else {
        mask.setLightSourceDarkness(value);
      }
    },
    [selectedMaskMeta, saveLightSourceField, mask],
  );

  const sizeTrackRef = useRef<HTMLDivElement | null>(null);
  const [sizeCursor, setSizeCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getSizeValue, getTrackCursor: getSizeCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_SOURCE_SIZE_MAX - LIGHT_SOURCE_SIZE_MIN,
  );
  useEffect(() => {
    if (!sizeTrackRef.current) return;
    const newCursor = getSizeCursor(lightSourceSizeValue - LIGHT_SOURCE_SIZE_MIN, sizeTrackRef.current.clientWidth);
    setSizeCursor({ x: newCursor, y: 0 });
  }, [lightSourceSizeValue, getSizeCursor]);

  const intensityTrackRef = useRef<HTMLDivElement | null>(null);
  const [intensityCursor, setIntensityCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getIntensityValue, getTrackCursor: getIntensityCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  useEffect(() => {
    if (!intensityTrackRef.current) return;
    const newCursor = getIntensityCursor(lightSourceIntensityValue, intensityTrackRef.current.clientWidth);
    setIntensityCursor({ x: newCursor, y: 0 });
  }, [lightSourceIntensityValue, getIntensityCursor]);

  const falloffTrackRef = useRef<HTMLDivElement | null>(null);
  const [falloffCursor, setFalloffCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getFalloffValue, getTrackCursor: getFalloffCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    LIGHT_SOURCE_FALLOFF_MAX - LIGHT_SOURCE_FALLOFF_MIN,
  );
  useEffect(() => {
    if (!falloffTrackRef.current) return;
    const newCursor = getFalloffCursor(
      lightSourceFalloffValue - LIGHT_SOURCE_FALLOFF_MIN,
      falloffTrackRef.current.clientWidth,
    );
    setFalloffCursor({ x: newCursor, y: 0 });
  }, [lightSourceFalloffValue, getFalloffCursor]);

  const darknessTrackRef = useRef<HTMLDivElement | null>(null);
  const [darknessCursor, setDarknessCursor] = useState({ x: 0, y: 0 });
  const { getTrackValue: getDarknessValue, getTrackCursor: getDarknessCursor } = useTrackpadState(
    dynamicSizes.paramSize.capWidth - dynamicSizes.paramSize.capBorderOffset,
    1,
  );
  useEffect(() => {
    if (!darknessTrackRef.current) return;
    const newCursor = getDarknessCursor(lightSourceDarknessValue, darknessTrackRef.current.clientWidth);
    setDarknessCursor({ x: newCursor, y: 0 });
  }, [lightSourceDarknessValue, getDarknessCursor]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        height: "100%",
        overflowX: "auto",
      }}
    >
      <SvgRepo
        svg={asterisk300()}
        containerStyle={{
          width: dynamicSizes.svgSize.width,
          height: dynamicSizes.svgSize.height,
        }}
        scale={1}
        scaleToContaier={true}
      />
      <div
        title={
          uiState.lightSourcePreview
            ? "mousing over a mesh drives its light source epicenter"
            : "mousing over a mesh no longer drives its light source epicenter"
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
            textShadow: uiState.lightSourcePreview ? "0 0 1px rgba(255, 255, 255, 1)" : "none",
          }}
        >
          {"preview"}
        </span>
        <Toggle
          value={uiState.lightSourcePreview}
          onClick={() => {
            uiDispatch({ type: UIActionType.SetLightSourcePreview, value: !uiState.lightSourcePreview });
            notifyMaskLightSourcePreviewToggled(!uiState.lightSourcePreview);
          }}
          trackStyles={{ ...dynamicSizes.toggle.track }}
          buttonStyles={{ ...dynamicSizes.toggle.button }}
          translateX={dynamicSizes.toggle.translateX}
        />
      </div>
      <div
        title={
          isLightSourceControlsDisabled
            ? "select or generate a mesh to set the size of its epicenter's bright core"
            : "size of the epicenter's bright core, in on-screen pixels"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7 }}>{"size"}</span>
        <ParameterSliderX
          resolution={{ ...uiState.resolution }}
          hash={`${selectedMaskKey ?? "lightsourcebar"}|size`}
          size={dynamicSizes.paramSize}
          containerRef={sizeTrackRef}
          cursor={sizeCursor}
          onNewCursor={(newCursor) => {
            setSizeCursor({ ...newCursor, y: 0 });
            if (!sizeTrackRef.current) return;
            const newValue = getSizeValue(newCursor.x, sizeTrackRef.current.clientWidth, 0) + LIGHT_SOURCE_SIZE_MIN;
            handleLightSourceSizeChange(newValue);
          }}
          disabled={isLightSourceControlsDisabled}
        />
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7, width: "4ch" }}>
          {Math.round(lightSourceSizeValue)}
        </span>
      </div>
      <div
        title={
          isLightSourceControlsDisabled
            ? "select or generate a mesh to set the brightness of its epicenter's core"
            : "brightness of the epicenter's core -- 100% is pure white"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7 }}>{"intensity"}</span>
        <ParameterSliderX
          resolution={{ ...uiState.resolution }}
          hash={`${selectedMaskKey ?? "lightsourcebar"}|intensity`}
          size={dynamicSizes.paramSize}
          containerRef={intensityTrackRef}
          cursor={intensityCursor}
          onNewCursor={(newCursor) => {
            setIntensityCursor({ ...newCursor, y: 0 });
            if (!intensityTrackRef.current) return;
            const newValue = getIntensityValue(newCursor.x, intensityTrackRef.current.clientWidth, 0);
            handleLightSourceIntensityChange(newValue);
          }}
          disabled={isLightSourceControlsDisabled}
        />
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7, width: "4ch" }}>{`${Math.round(
          lightSourceIntensityValue * 100,
        )}%`}</span>
      </div>
      <div
        title={
          isLightSourceControlsDisabled
            ? "select or generate a mesh to set how far its darkening falloffs out beyond the core"
            : "distance the darkening takes to falloff out beyond the core, in on-screen pixels -- independent of canvas size"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7 }}>{"falloff"}</span>
        <ParameterSliderX
          resolution={{ ...uiState.resolution }}
          hash={`${selectedMaskKey ?? "lightsourcebar"}|falloff`}
          size={dynamicSizes.paramSize}
          containerRef={falloffTrackRef}
          cursor={falloffCursor}
          onNewCursor={(newCursor) => {
            setFalloffCursor({ ...newCursor, y: 0 });
            if (!falloffTrackRef.current) return;
            const newValue =
              getFalloffValue(newCursor.x, falloffTrackRef.current.clientWidth, 0) + LIGHT_SOURCE_FALLOFF_MIN;
            handleLightSourceFalloffChange(newValue);
          }}
          disabled={isLightSourceControlsDisabled}
        />
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7, width: "4ch" }}>
          {Math.round(lightSourceFalloffValue)}
        </span>
      </div>
      <div
        title={
          isLightSourceControlsDisabled
            ? "select or generate a mesh to set the strength of its darkening at the far edge of the falloff"
            : "strength of the darkening at the far edge of the falloff -- 100% drives it fully to black"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7 }}>{"darkness"}</span>
        <ParameterSliderX
          resolution={{ ...uiState.resolution }}
          hash={`${selectedMaskKey ?? "lightsourcebar"}|darkness`}
          size={dynamicSizes.paramSize}
          containerRef={darknessTrackRef}
          cursor={darknessCursor}
          onNewCursor={(newCursor) => {
            setDarknessCursor({ ...newCursor, y: 0 });
            if (!darknessTrackRef.current) return;
            const newValue = getDarknessValue(newCursor.x, darknessTrackRef.current.clientWidth, 0);
            handleLightSourceDarknessChange(newValue);
          }}
          disabled={isLightSourceControlsDisabled}
        />
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7, width: "4ch" }}>{`${Math.round(
          lightSourceDarknessValue * 100,
        )}%`}</span>
      </div>
    </div>
  );
}
