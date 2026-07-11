"use client";
import { useEffect, useState } from "react";
import Landing, { LandingFormType } from "./landing.client";
import styles from "./app.module.css";

export type LaurusResolution = { type: "high" } | { type: "midhigh" } | { type: "midlow" } | { type: "low" };
function getScreenResolution(): LaurusResolution {
  if (typeof screen === "undefined") return { type: "midhigh" };

  if (screen.width > 2560) {
    return { type: "high" };
  } else if (screen.width > 1920) {
    return { type: "midhigh" };
  } else if (screen.width > 1280) {
    return { type: "midlow" };
  } else {
    return { type: "low" };
  }
}

interface LandingBoot {
  laurusApi: string | undefined;
  resetPassword: string | undefined;
}
export default function LandingBoot({ laurusApi, resetPassword }: LandingBoot) {
  const [resolution, setResolution] = useState<LaurusResolution | undefined>(undefined);
  const [formType, setFormType] = useState<LandingFormType | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (!resolution) {
        setResolution(getScreenResolution());
      }
      try {
        if (resetPassword) {
          setFormType(LandingFormType.passwordConfirmation);
        } else {
          setFormType(LandingFormType.login);
        }
      } catch {
        setFormType(LandingFormType.login);
      }
    })();
  }, [resetPassword, resolution]);

  return resolution !== undefined && formType !== undefined ? (
    <Landing laurusApi={laurusApi} resolution={resolution} resetPasswordToken={resetPassword} formInit={formType} />
  ) : (
    <Skeleton />
  );
}

function Skeleton() {
  return (
    <>
      <div
        className={`${styles["noisy-background-16-2-low-res"]}`}
        style={{ cursor: "progress", width: "100vw", height: "100vh" }}
      />
    </>
  );
}
