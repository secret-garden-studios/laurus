import { useContext, useState } from "react";
import { UIContext } from "../projects.client";
import { SvgRepo, sort300 } from "@/app/svg-repo";
import { parseSortValue, sortOptions, SortValue, UIActionType } from "../states/ui-state";
import { dellaRespira } from "@/app/fonts";

export default function Sortbar() {
  const { uiState, uiDispatch } = useContext(UIContext);
  const [dynamicSizes] = useState(() => {
    switch (uiState.resolution.type) {
      case "high":
        return {
          input: {
            container: { width: 500, height: 50, padding: "8px 10px" },
            input: {
              letterSpacing: 2,
              fontSize: 13,
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
              fontSize: 11,
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
            container: { width: 360, height: 40, padding: "0px 8px" },
            input: {
              letterSpacing: 2,
              fontSize: 10,
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
        <SvgRepo
          svg={uiState.sort != "none" ? sort300("rgb(220, 220, 220)") : sort300("rgba(255,255,255,0.2)")}
          containerStyle={{
            cursor: "pointer",
            width: dynamicSizes.brand.svg.width,
            height: "100%",
          }}
          scale={1}
          scaleToContaier={true}
        />

        <select
          id={"media-browser-sort-select-input"}
          className={dellaRespira.className}
          style={{
            width: "100%",
            height: "100%",
            color: "rgba(227,227,227,1)",
            border: "none",
            outline: "none",
            background: "none",
            textAlign: "center",
            cursor: "pointer",
            ...dynamicSizes.input.input,
          }}
          value={uiState.sort}
          autoComplete="off"
          onChange={(e) => {
            const newSortValue: SortValue = parseSortValue(e.target.value);
            uiDispatch({ type: UIActionType.SetSort, value: newSortValue });
          }}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
