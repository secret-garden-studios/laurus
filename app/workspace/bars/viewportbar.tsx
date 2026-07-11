import { LaurusClientSvg, SvgRepo, browse } from "@/app/svg-repo";
import { useContext, useState, useRef, useEffect } from "react";
import { UIContext } from "../workspace.client";

interface Viewportbar {
  icon?: LaurusClientSvg;
}
export default function Viewportbar({ icon }: Viewportbar) {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          flex: {
            gap: 20,
          },
          progress: {
            flex: {
              gap: 10,
            },
            label: {
              width: "12ch",
              fontSize: 10,
            },
            bar: {
              borderRadius: 10,
              height: 2,
            },
            units: {
              width: "4ch",
              fontSize: 10,
            },
          },
          playbackTime: {
            width: "11ch",
            fontSize: 13,
            letterSpacing: 2,
          },
          icon: {
            width: 20,
            height: 20,
          },
        };
      case "midhigh":
        return {
          flex: {
            gap: 14,
          },
          progress: {
            flex: {
              gap: 10,
            },
            label: {
              width: "12ch",
              fontSize: 10,
            },
            bar: {
              borderRadius: 10,
              height: 2,
            },
            units: {
              width: "4ch",
              fontSize: 10,
            },
          },
          playbackTime: {
            width: "11ch",
            fontSize: 10,
            letterSpacing: 2,
          },
          icon: {
            width: 18,
            height: 18,
          },
        };
      case "midlow":
      case "low":
        return {
          flex: {
            gap: 16,
          },
          progress: {
            flex: {
              gap: 10,
            },
            label: {
              width: "12ch",
              fontSize: 10,
            },
            bar: {
              borderRadius: 10,
              height: 2,
            },
            units: {
              width: "4ch",
              fontSize: 10,
            },
          },
          playbackTime: {
            width: "11ch",
            fontSize: 10,
            letterSpacing: 2,
          },
          icon: {
            width: 20,
            height: 20,
          },
        };
    }
  });
  const timeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackTimeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (uiState.playbackMode.type === "stopped" || uiState.playbackMode.type === "waiting") {
      timeRef.current = 0;
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    const intervalMs = 30;
    const formatTime = (totalMilliseconds: number) => {
      const hours = Math.floor(totalMilliseconds / 3600000);
      const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
      const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
      const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);
      const pad = (num: number) => String(num).padStart(2, "0");
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds)}`;
    };
    timerRef.current = setInterval(() => {
      const newTime = timeRef.current + intervalMs;
      timeRef.current = newTime;
      if (playbackTimeRef.current) {
        playbackTimeRef.current.textContent = formatTime(newTime);
      }
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [uiState.playbackMode.type]);

  switch (uiState.playbackMode.type) {
    case "playing": {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            width: "100%",
            overflowX: "auto",
            ...dynamicSizes.flex,
          }}
        >
          {icon && (
            <SvgRepo
              svg={browse()}
              containerStyle={{
                ...dynamicSizes.icon,
              }}
              scale={1}
              scaleToContaier={true}
            />
          )}
          <div
            ref={playbackTimeRef}
            style={{
              fontWeight: "bold",
              color: "rgb(200, 200, 200)",
              ...dynamicSizes.playbackTime,
            }}
          ></div>
        </div>
      );
    }
    default: {
      if (uiState.animationDownloadProgress !== undefined) {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              width: "100%",
              overflowX: "auto",
              ...dynamicSizes.flex,
            }}
          >
            {icon && (
              <SvgRepo
                svg={browse()}
                containerStyle={{
                  ...dynamicSizes.icon,
                }}
                scale={1}
                scaleToContaier={true}
              />
            )}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                ...dynamicSizes.progress.flex,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "rgba(255, 255, 255, 0.1)",
                  overflow: "hidden",
                  ...dynamicSizes.progress.bar,
                }}
              >
                <div
                  style={{
                    width: `${uiState.animationDownloadProgress}%`,
                    height: "100%",
                    background: "linear-gradient(1deg, rgb(187, 187, 187), rgb(227, 227, 227))",
                    borderRadius: dynamicSizes.progress.bar.borderRadius,
                    transition: "width 0.1s ease-out",
                  }}
                />
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              width: "100%",
              overflowX: "auto",
              ...dynamicSizes.flex,
            }}
          >
            {icon && (
              <SvgRepo
                svg={browse()}
                containerStyle={{
                  ...dynamicSizes.icon,
                }}
                scale={1}
                scaleToContaier={true}
              />
            )}
            <div
              style={{
                fontWeight: "bold",
                color: "rgb(200, 200, 200)",
                ...dynamicSizes.playbackTime,
              }}
            >
              {"00:00:00.00"}
            </div>
          </div>
        );
      }
    }
  }
}
