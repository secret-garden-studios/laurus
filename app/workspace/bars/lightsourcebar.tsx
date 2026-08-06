import { useCallback, useContext, useState } from "react";
import { CoreContext, HoverContext, UIContext, MaskContext } from "../workspace.client";
import { LaurusProjectMask, LaurusProjectResult, updateProject } from "@/app/projects/projects.server";
import { CoreActionType } from "../states/core-state";
import { UIActionType } from "../states/ui-state";
import { SvgRepo, asterisk300 } from "@/app/svg-repo";
import Toggle from "@/app/components/toggle";

// Houses the four dials (size/intensity/spread/darkness) that used to live in Maskbar -- moved
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
  const { coreState, dispatch } = useContext(CoreContext);
  const { selectedMaskKeys } = useContext(HoverContext);
  const mask = useContext(MaskContext);
  const [isSaving, setIsSaving] = useState(false);
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

  const saveLightSourceField = useCallback(
    async (
      field: "light_source_size" | "light_source_intensity" | "light_source_falloff" | "light_source_darkness",
      value: number,
    ) => {
      if (isSaving || selectedMaskKey === undefined) return;
      const snapshot: LaurusProjectResult = { ...coreState.project };
      const maskMeta = snapshot.masks.get(selectedMaskKey);
      if (!maskMeta) return;
      setIsSaving(true);

      const newMasks = new Map(snapshot.masks);
      const newMaskMeta: LaurusProjectMask = { ...maskMeta, [field]: value };
      newMasks.set(selectedMaskKey, newMaskMeta);
      const newProject: LaurusProjectResult = { ...snapshot, masks: newMasks };
      dispatch({ type: CoreActionType.SetProject, value: newProject });

      try {
        const saved = await updateProject(coreState.apiOrigin, coreState.accessToken, newProject.project_id, {
          ...newProject,
        });
        if (!saved) {
          dispatch({ type: CoreActionType.SetProject, value: snapshot });
        }
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, selectedMaskKey, coreState.project, coreState.apiOrigin, coreState.accessToken, dispatch],
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
        <input
          type="range"
          min={10}
          max={300}
          step={1}
          value={lightSourceSizeValue}
          disabled={isLightSourceControlsDisabled}
          onChange={(e) => handleLightSourceSizeChange(parseFloat(e.target.value))}
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
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={lightSourceIntensityValue}
          disabled={isLightSourceControlsDisabled}
          onChange={(e) => handleLightSourceIntensityChange(parseFloat(e.target.value))}
        />
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7, width: "4ch" }}>{`${Math.round(
          lightSourceIntensityValue * 100,
        )}%`}</span>
      </div>
      <div
        title={
          isLightSourceControlsDisabled
            ? "select or generate a mesh to set how far its darkening spreads out beyond the core"
            : "distance the darkening takes to spread out beyond the core, in on-screen pixels -- independent of canvas size"
        }
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.toggle.div,
        }}
      >
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7 }}>{"spread"}</span>
        <input
          type="range"
          min={20}
          max={1000}
          step={5}
          value={lightSourceFalloffValue}
          disabled={isLightSourceControlsDisabled}
          onChange={(e) => handleLightSourceFalloffChange(parseFloat(e.target.value))}
        />
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7, width: "4ch" }}>
          {Math.round(lightSourceFalloffValue)}
        </span>
      </div>
      <div
        title={
          isLightSourceControlsDisabled
            ? "select or generate a mesh to set the strength of its darkening at the far edge of the spread"
            : "strength of the darkening at the far edge of the spread -- 100% drives it fully to black"
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
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={lightSourceDarknessValue}
          disabled={isLightSourceControlsDisabled}
          onChange={(e) => handleLightSourceDarknessChange(parseFloat(e.target.value))}
        />
        <span style={{ opacity: isLightSourceControlsDisabled ? 0.3 : 0.7, width: "4ch" }}>{`${Math.round(
          lightSourceDarknessValue * 100,
        )}%`}</span>
      </div>
    </div>
  );
}
