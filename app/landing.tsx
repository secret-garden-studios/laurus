'use client'
import { dellaRespira, italiana } from "./fonts";
import styles from "./app.module.css";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";

export type LaurusResolution =
    | { type: 'high' }
    | { type: 'midhigh' }
    | { type: 'midlow' }
    | { type: 'low' }
function getScreenResolution(): LaurusResolution {
    if (screen.width > 2560) {
        return { type: 'high' };
    }
    else if (screen.width > 1920) {
        return { type: 'midhigh' };
    }
    else if (screen.width > 1280) {
        return { type: 'midlow' };
    }
    else {
        return { type: 'low' };
    }
}

function LandingBody() {
    return (<>
        <div
            className={`${styles["animated-grainy-background"]} ${dellaRespira.className}`}
            style={{
                width: '100vw', height: '100vh',
                display: 'grid',
                placeContent: 'center',
                letterSpacing: '2px',
                color: 'rgb(227, 227, 227)'
            }} >
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div className={`${italiana.className}`}
                    style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', padding: "10px 0px" }}>
                    <p style={{ fontSize: 54 }}>{"Laurus"}</p>
                </div>
                <div style={{ fontSize: 18, justifySelf: 'center', padding: 4 }}>
                    <div >{'beta version'}</div>
                </div>
            </div>
        </div>
    </>)
}
export default function Landing() {
    const [resolution, setResolution] = useState<LaurusResolution | undefined>(undefined)
    useLayoutEffect(() => {
        (() => {
            if (!resolution)
                setResolution(getScreenResolution())
        })();
    });
    return resolution ?
        <Link
            href={resolution.type == 'low' ? "/screens" : "/workspace"}
            style={{ textDecoration: 'none' }}>
            <LandingBody />
        </Link>
        : <LandingBody />
}