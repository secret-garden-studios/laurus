import { useContext, useState } from "react";
import { UIContext } from "../workspace.client";
import { keyboardCommandKey, SvgRepo } from "@/app/svg-repo";

export default function ContextMenubar() {
    const { uiState } = useContext(UIContext);
    const [dynamicSizes] = useState(() => {
        switch (uiState.resolution.type) {
            case "high": return {
                svgSize: {
                    width: 20,
                    height: 20
                }
            }
            case "midhigh": return {
                svgSize: {
                    width: 18,
                    height: 18
                }
            }
            case "midlow":
            case "low": return {
                svgSize: {
                    width: 20,
                    height: 20
                }
            }
        }
    });

    return (
        <div style={
            {
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                width: '100%',
                overflowX: 'auto',
            }}>
            <SvgRepo
                svg={keyboardCommandKey()}
                containerStyle={{
                    ...dynamicSizes.svgSize
                }}
                scale={1}
                scaleToContaier={true} />
        </div>
    );
}
