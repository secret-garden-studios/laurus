'use client'
import { dellaRespira } from "./fonts";
import { usePathname } from 'next/navigation';
import { LaurusResolution } from "./landing.boot";
import { CSSProperties, useState } from "react";
import { LaurusUserResult } from "./landing.server";
import { useRouter } from "next/navigation";
import styles from "./app.module.css";

interface Menubar {
    resolution: LaurusResolution,
    me: LaurusUserResult | undefined
}
export default function Menubar({ resolution, me }: Menubar) {
    const router = useRouter();
    const pathname = usePathname();
    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                container: { height: 50, fontSize: 20, paddingLeft: 12 },
                paddingRight: 12,
                linkWidth: 100,
                linkFont: 12,
                linkPaddingTop: 4,
                me: { paddingRight: 12, fontSize: 11, letterSpacing: 2 }
            }
            case "midhigh": return {
                container: { height: 44, fontSize: 18, paddingLeft: 12 },
                paddingRight: 12,
                linkWidth: 90,
                linkFont: 11,
                linkPaddingTop: 2,
                me: { paddingRight: 12, fontSize: 11, letterSpacing: 2 }
            }
            case "midlow": return {
                container: { height: 40, fontSize: 16, paddingLeft: 12 },
                paddingRight: 16,
                linkWidth: 80,
                linkFont: 10,
                linkPaddingTop: 2,
                me: { paddingRight: 12, fontSize: 11, letterSpacing: 2 }
            }
            case "low": return {
                container: { height: 48, fontSize: 18, padding: "0px 12px", justifyContent: 'space-between' },
                paddingRight: 12,
                linkWidth: 80,
                linkFont: 12,
                linkPaddingTop: 2,
                me: {}
            }
        }
    });

    const linkStyle: CSSProperties = {
        textDecoration: "underline",
        textUnderlineOffset: 2,
        textDecorationThickness: 1,
        textDecorationColor: 'rgba(255, 255, 255, 0.3)',
    };

    const linkGridStyle: CSSProperties = {
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto min-content',
        width: dynamicSizes.linkWidth,
    };

    return <>
        <div
            className={dellaRespira.className}
            style={{
                ...dynamicSizes.container,
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgb(18, 18, 18)",
                boxShadow: "rgba(255, 255, 255, 0.05) 0px 0px 30px 1px",
                letterSpacing: '1px',
                color: 'rgb(227,227,227)',
                borderBottom: '1px solid rgb(20, 20, 20)',
            }}>
            <div
                className={styles['animated-nav-dark']}
                onClick={async () => {
                    router.push(me ? '/' : '/?guest=true');
                }}
                style={{
                    cursor: 'pointer',
                    paddingRight: dynamicSizes.paddingRight
                }}>
                {'Laurus'}
            </div>
            <div
                className={styles['animated-nav-dark']}
                style={linkGridStyle}>
                <div
                    onClick={async () => {
                        router.push(me ? '/projects' : '/projects?guest=true');
                    }}
                    style={{
                        paddingTop: dynamicSizes.linkPaddingTop,
                        fontSize: dynamicSizes.linkFont,
                        letterSpacing: "1px",
                        display: 'grid',
                        placeContent: 'center',
                        color: 'rgb(227, 227, 227)',
                    }}>
                    {'projects'}
                </div>
                <div style={{
                    height: 1,
                    borderRadius: 10,
                    background: pathname == '/projects' ? 'rgba(255, 255, 255, 0.64)' : 'rgba(0,0,0,0)',
                    boxShadow: pathname == '/projects' ? '0 0 5px rgba(255, 255, 255, 0.79)' : 'none'
                }} />
            </div>
            <div
                className={styles['animated-nav-dark']}
                style={linkGridStyle}>
                <div
                    onClick={async () => {
                        router.push(me ? '/workspace' : '/workspace?guest=true');
                    }}
                    style={{
                        paddingTop: dynamicSizes.linkPaddingTop,
                        fontSize: dynamicSizes.linkFont,
                        letterSpacing: "1px",
                        display: 'grid',
                        placeContent: 'center',
                        color: 'rgb(227, 227, 227)',
                    }}>
                    {'workspace'}
                </div>
                <div style={{
                    height: 1,
                    borderRadius: 10,
                    background: pathname == '/workspace' ? 'rgba(255, 255, 255, 0.64)' : 'rgba(0,0,0,0)',
                    boxShadow: pathname == '/workspace' ? '0 0 5px rgba(255, 255, 255, 0.79)' : 'none'
                }} />
            </div>
            <div
                className={styles['animated-nav-dark']}
                style={linkGridStyle}>
                <div
                    onClick={async () => {
                        router.push(me ? '/screens' : '/screens?guest=true');
                    }}
                    style={{
                        paddingTop: dynamicSizes.linkPaddingTop,
                        fontSize: dynamicSizes.linkFont,
                        letterSpacing: "1px",
                        display: 'grid',
                        placeContent: 'center',
                        color: 'rgb(227, 227, 227)',
                    }}>
                    {'screens'}
                </div>
                <div style={{
                    height: 1,
                    borderRadius: 10,
                    background: pathname == '/screens' ? 'rgba(255, 255, 255, 0.64)' : 'rgba(0,0,0,0)',
                    boxShadow: pathname == '/screens' ? '0 0 5px rgba(255, 255, 255, 0.79)' : 'none'
                }} />
            </div>
            {resolution.type != 'low' ? me ?
                <div
                    className={styles['animated-nav-dark']}
                    onClick={async () => {
                        router.push('/');
                    }}
                    style={{ ...linkStyle, marginLeft: 'auto', ...dynamicSizes.me }}>
                    {me.username}
                </div> :
                <div
                    className={styles['animated-nav-dark']}
                    onClick={async () => {
                        router.push('/?guest=true');
                    }}
                    style={{ ...linkStyle, marginLeft: 'auto', ...dynamicSizes.me }}>
                    {'login'}
                </div> :
                <></>
            }
        </div>
    </>;
}
