import { useContext, useState } from "react";
import { geistMono } from "@/app/fonts";
import { WorkspaceContext } from "../workspace.client";
import { browse, SvgRepo } from "@/app/svg-repo";

export default function Viewportbar() {
    const { appState } = useContext(WorkspaceContext);
    const [dynamicSizes] = useState(() => {
        switch (appState.resolution.type) {
            case "high": return {
                svgSize: {
                    width: 20,
                    height: 20
                },
                progress: {
                    flex: {
                        gap: 12,
                        padding: '0px 20px'
                    },
                    label: {
                        fontSize: 10,
                    },
                    bar: {
                        borderRadius: 10,
                        height: 2,
                    },
                    units: {
                        width: '4ch',
                        fontSize: 10,
                    }
                }
            }
            case "midhigh": return {
                svgSize: {
                    width: 18,
                    height: 18
                },
                progress: {
                    flex: {
                        gap: 12,
                        padding: '0px 20px'
                    },
                    label: {
                        fontSize: 10,
                    },
                    bar: {
                        borderRadius: 10,
                        height: 2,
                    },
                    units: {
                        width: '4ch',
                        fontSize: 10,
                    }
                }
            }
            case "midlow":
            case "low": return {
                svgSize: {
                    width: 20,
                    height: 20
                },
                progress: {
                    flex: {
                        gap: 12,
                        padding: '0px 20px'
                    },
                    label: {
                        fontSize: 10,
                    },
                    bar: {
                        borderRadius: 10,
                        height: 2,
                    },
                    units: {
                        width: '4ch',
                        fontSize: 10,
                    }
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
                svg={browse()}
                containerStyle={{
                    width: dynamicSizes.svgSize.width,
                    height: dynamicSizes.svgSize.height
                }}
                scale={1}
                scaleToContaier={true} />
            {appState.animationProgress !== undefined && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    ...dynamicSizes.progress.flex,
                }}>
                    <div className={geistMono.className}
                        style={{
                            width: 'min-content',
                            textAlign: 'left',
                            color: 'rgb(227, 227, 227)',
                            ...dynamicSizes.progress.label
                        }}>
                        {`rendering...`}
                    </div>
                    <div style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.1)',
                        overflow: 'hidden',
                        ...dynamicSizes.progress.bar
                    }}>
                        <div style={{
                            width: `${appState.animationProgress}%`,
                            height: '100%',
                            background: 'linear-gradient(1deg, rgb(187, 187, 187), rgb(227, 227, 227))',
                            borderRadius: dynamicSizes.progress.bar.borderRadius,
                            transition: 'width 0.1s ease-out'
                        }} />
                    </div>
                    <div className={geistMono.className}
                        style={{
                            textAlign: 'right',
                            color: 'rgb(227, 227, 227)',
                            ...dynamicSizes.progress.units
                        }}>
                        {`${appState.animationProgress}%`}
                    </div>
                </div>
            )}
        </div>
    );
}