'use client'

export interface StatusbarProps {
    action: string,
    body: string[],
    counter: number,
}

export default function Statusbar({ action, body, counter }: StatusbarProps) {
    return (
        <>
            <div style={{
                height: `30px`,
                width: "100%",
                display: "flex",
                alignItems: "center",
                left: "0",
                bottom: "0",
                backgroundColor: "#121212ff",
                overflow: "hidden",
                whiteSpace: "nowrap",
                padding: "0px 12px",
            }}>
                <div style={{
                    fontFamily: "monospace",
                    fontWeight: "bolder",
                    fontSize: "9px",
                }}>{action}</div>
                {body.map((m, i) => {
                    if (i === 0) {
                        return (
                            <div key={i} style={{
                                fontFamily: "monospace",
                                fontWeight: "lighter",
                                fontSize: "9px",
                                marginLeft: "12px",
                            }}>
                                {`${m}`}
                            </div>
                        );
                    }
                    else {
                        return (
                            <div key={i} style={{
                                fontFamily: "monospace",
                                fontWeight: "lighter",
                                fontSize: "9px", marginLeft: "0px"
                            }}>
                                {`, ${m}`}
                            </div>
                        );
                    }
                })}
                <div style={{
                    marginLeft: "auto",
                    fontFamily: "monospace",
                    fontWeight: "normal",
                    fontSize: "9px",
                }}>{counter.toFixed(2)}</div>
            </div>
        </>
    );
}
