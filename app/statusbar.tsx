'use client'
import { CSSProperties } from "react";

function clipper(
    strings: string[],
    maxTotalCharacters: number
): string[] {
    let currentTotalCharacters = 0;
    const result: string[] = [];

    for (const str of strings) {
        if (currentTotalCharacters + str.length <= maxTotalCharacters) {
            result.push(str);
            currentTotalCharacters += str.length;
        } else {
            const remainingCharacters = maxTotalCharacters - currentTotalCharacters;
            if (remainingCharacters > 0) {
                result.push(str.substring(0, remainingCharacters));
                currentTotalCharacters += remainingCharacters;
            }
            break;
        }
    }
    return result;
}

export interface StatusbarProps {
    zIndex: number,
    action: string,
    body: string[],
    counter: number,
}

export default function Statusbar({ action, body, zIndex, counter }: StatusbarProps) {

    const statusbar: CSSProperties =
    {
        height: `30px`,
        width: "100%",
        display: "flex",
        alignItems: "center",
        left: "0",
        bottom: "0",
        zIndex: zIndex,
        backgroundColor: "#121212ff",
        overflow: "hidden",
        whiteSpace: "nowrap",
        padding: "0px 12px",
    };

    const header: CSSProperties = {
        fontFamily: "monospace",
        fontWeight: "bolder",
        fontSize: "9px",
    }

    const listItem: CSSProperties = {
        fontFamily: "monospace",
        fontWeight: "lighter",
        fontSize: "9px",
        marginLeft: "12px",
    };

    const clock: CSSProperties = {
        // push the clock to the end of the flexbox
        marginLeft: "auto",
        fontFamily: "monospace",
        fontWeight: "normal",
        fontSize: "9px",
    }

    /* JSX */
    return (
        <>
            <div style={statusbar}>
                <div style={header}>{action}</div>
                {clipper(body, 200).map((m, i) => {
                    if (i === 0) {
                        return (
                            <div key={i} style={listItem}>
                                {`${m}`}
                            </div>
                        );
                    }
                    else {
                        return (
                            <div key={i} style={{ ...listItem, marginLeft: "0px" }}>
                                {`, ${m}`}
                            </div>
                        );
                    }
                })}
                <div style={clock}>{counter}</div>
            </div>
        </>
    );
}
