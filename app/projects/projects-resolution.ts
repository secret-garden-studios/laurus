export type ProjectsResolution =
  | { type: "high"; value: { width: number; height: number } }
  | { type: "midhigh"; value: { width: number; height: number } }
  | { type: "midlow"; value: { width: number; height: number } }
  | { type: "low"; value: { width: number; height: number } };

export function getScreenResolution(): ProjectsResolution {
  if (typeof screen === "undefined") return { type: "midhigh", value: { width: 2560, height: 1440 } };
  if (screen.width > 2560) {
    return {
      type: "high",
      value: { width: screen.width, height: screen.height },
    };
  } else if (screen.width > 1920) {
    return {
      type: "midhigh",
      value: { width: screen.width, height: screen.height },
    };
  } else if (screen.width > 1280) {
    return {
      type: "midlow",
      value: { width: screen.width, height: screen.height },
    };
  } else {
    return {
      type: "low",
      value: { width: screen.width, height: screen.height },
    };
  }
}
