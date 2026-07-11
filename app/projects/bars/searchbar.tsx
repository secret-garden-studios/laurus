import { dellaRespira } from "@/app/fonts";
import { SvgRepo, search } from "@/app/svg-repo";
import { useCallback, useContext, useRef, useState } from "react";
import { LaurusProjectSearch, searchProjects } from "../projects.server";
import { CoreActionType } from "../states/core-state";
import { CoreContext, UIContext } from "../projects.client";

export default function Searchbar() {
  const { coreState, coreDispatch } = useContext(CoreContext);
  const { uiState } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          input: {
            container: { width: 500, height: 50, padding: "0px 10px" },
            input: {
              letterSpacing: 2,
              fontSize: 14,
            },
          },
          brand: {
            svg: {
              width: 22,
              height: 22,
            },
          },
        };
      case "midhigh":
        return {
          input: {
            container: { width: 400, height: 44, padding: "0px 8px" },
            input: {
              letterSpacing: 2,
              fontSize: 12,
            },
          },
          brand: {
            svg: {
              width: 18,
              height: 18,
            },
          },
        };
      case "low":
      case "midlow":
        return {
          input: {
            container: { width: 360, height: 40, padding: "0px 10px" },
            input: {
              letterSpacing: 2,
              fontSize: 12,
            },
          },
          brand: {
            svg: {
              width: 18,
              height: 18,
            },
          },
        };
    }
  });

  const searchQueryRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onSearchQueryChange = useCallback(
    (newValue: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const query: LaurusProjectSearch = { query: newValue.trim() };
        if (!query.query) {
          coreDispatch({
            type: CoreActionType.SetFilteredProjectIds,
            value: [],
          });
          return;
        }
        searchProjects(coreState.apiOrigin, query).then((results) => {
          if (!results) return;
          if (results.length == 0) {
            const newFileteredProjectIds = [""];
            coreDispatch({
              type: CoreActionType.SetFilteredProjectIds,
              value: newFileteredProjectIds,
            });
          } else {
            const newFileteredProjectIds = results.flatMap((p) => p.project_id);
            coreDispatch({
              type: CoreActionType.SetFilteredProjectIds,
              value: newFileteredProjectIds,
            });
          }
        });
      }, 500);
    },
    [coreDispatch, coreState.apiOrigin],
  );

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: "2px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 10,
          ...dynamicSizes.input.container,
        }}
      >
        <input
          className={dellaRespira.className}
          ref={searchQueryRef}
          type="text"
          id="projects-search-bar"
          autoComplete="off"
          onChange={(e) => onSearchQueryChange(e.target.value)}
          style={{
            width: "100%",
            height: "100%",
            color: "rgba(227,227,227,1)",
            border: "none",
            outline: "none",
            background: "none",
            textAlign: "center",
            ...dynamicSizes.input.input,
          }}
        />
        <SvgRepo
          svg={search()}
          containerStyle={{
            cursor: "pointer",
            width: dynamicSizes.brand.svg.width,
            height: "100%",
          }}
          scale={1}
          scaleToContaier={true}
        />
      </div>
    </div>
  );
}
