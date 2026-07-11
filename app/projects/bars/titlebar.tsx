import { useContext, useState } from "react";
import { CoreContext, UIContext } from "../projects.client";

export default function Titlebar() {
  const { coreState } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          container: { height: 50 },
          input: {
            fontSize: 13,
            padding: 10,
            letterSpacing: 3,
          },
          stats: {
            container: { fontSize: 11 },
            svg: {
              svg: { width: 24, height: 24 },
              container: {
                paddingRight: 10,
              },
            },
            left: {
              paddingLeft: 5,
            },
            center: {
              padding: "0 0px 0px 15px",
            },
            right: {
              padding: "0 15px 0px 15px",
            },
          },
        };
      case "midhigh":
        return {
          container: { height: 45 },
          input: {
            fontSize: 11,
            padding: 4,
            letterSpacing: 3,
          },
          stats: {
            container: {
              fontSize: 10,
            },
            svg: {
              svg: { width: 20, height: 20 },
              container: {
                paddingRight: 5,
              },
            },
            left: {
              paddingLeft: 5,
            },
            center: {
              padding: "0 0px 0px 10px",
            },
            right: {
              padding: "0 10px 0px 10px",
            },
          },
        };
      case "low":
      case "midlow":
        return {
          container: { height: 40 },
          input: {
            fontSize: 11,
            padding: 4,
            letterSpacing: 3,
          },
          stats: {
            container: {
              fontSize: 10,
            },
            svg: {
              svg: { width: 20, height: 20 },
              container: {
                paddingRight: 5,
              },
            },
            left: {
              paddingLeft: 5,
            },
            center: {
              padding: "0 0px 0px 10px",
            },
            right: {
              padding: "0 10px 0px 10px",
            },
          },
        };
    }
  });

  return (
    <>
      <div
        style={{
          background: "rgba(28, 28, 28, 1)",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "auto min-content",
          alignContent: "center",
          justifyContent: "end",
          overflowX: "auto",
          overflowY: "hidden",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          ...dynamicSizes.container,
        }}
      >
        {/* content stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            ...dynamicSizes.stats.container,
          }}
        >
          <div style={{ display: "flex", gap: "1ch", ...dynamicSizes.stats.right }}>
            <div
              style={{
                fontWeight: "bold",
                textShadow: "0 0 1px rgba(255, 255, 255, 1)",
              }}
            >
              {
                coreState.projects.filter((p) => {
                  return coreState.filteredProjectIds.length > 0
                    ? coreState.filteredProjectIds.includes(p.project_id)
                    : p;
                }).length
              }
            </div>
            <div>{coreState.projects.length == 1 ? "project" : "projects"}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function Subtitlebar() {
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          container: {
            height: 30,
            fontSize: 14,
            padding: "0px 18px",
            letterSpacing: 0,
          },
        };
      case "midhigh":
        return {
          container: {
            height: 24,
            fontSize: 11,
            padding: "0px 13px 0px 10px",
            letterSpacing: 0,
          },
        };
      case "low":
      case "midlow":
        return {
          container: {
            height: 20,
            fontSize: 11,
            padding: "0px 13px 0px 10px",
            letterSpacing: 0,
          },
        };
    }
  });
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: "rgb(227, 227, 227)",
          backgroundColor: "rgb(23, 23, 23)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          ...dynamicSizes.container,
        }}
      >
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          {(() => {
            switch (uiState.tool.type) {
              case "create":
                return <></>;
              case "pin":
                return <></>;
              case "sort":
                return <></>;
              case "none":
                return <></>;
            }
          })()}
        </div>
      </div>
    </>
  );
}
