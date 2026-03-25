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
    return <>
        <div
            className={dellaRespira.className}
            style={{
                display: 'grid',
                height: '100vh',
                width: '100vw',
                gridTemplateRows: 'auto min-content',
                color: 'rgb(227,227,227)'
            }} >
            <div style={{ position: 'relative', }} >
                <div
                    className={styles["animated-noisy-background"]}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        zIndex: -1,
                        width: '100vw',
                        height: '100%',
                        display: 'grid',
                        placeContent: 'center',
                        background: 'rgb(10, 10, 10)',
                    }} >
                </div>
                <div
                    className={styles["animated-font"]}
                    style={{
                        width: '100vw',
                        height: '100%',
                        display: 'grid',
                        placeContent: 'center',
                        position: 'relative',
                        letterSpacing: '2px',
                    }}>
                    <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                        <div className={`${italiana.className}`}
                            style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', padding: "10px 0px" }}>
                            <p style={{ fontSize: 56 }}>{"Laurus"}</p>
                        </div>
                        <div style={{ fontSize: 20, justifySelf: 'center', padding: 4 }}>
                            <div >{'beta version'}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style={{
                height: 'min-content',
                padding: 20,
                width: '100%',
                display: 'grid',
                placeContent: 'center',
                fontSize: 10,
                letterSpacing: "3px"
            }}>
                <div >{`click anywhere to start`}</div>
            </div>
        </div>
    </>
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