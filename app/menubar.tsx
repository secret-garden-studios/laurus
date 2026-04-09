'use client'
import { dellaRespira } from "./fonts";
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LaurusResolution } from "./landing.boot";
import { CSSProperties, useState } from "react";
import { LaurusUserResult } from "./landing.server";

interface Menubar {
    resolution: LaurusResolution,
    me: LaurusUserResult | undefined,
    accessToken: string | undefined,
}
export default function Menubar({ resolution, me, accessToken }: Menubar) {
    const pathname = usePathname();
    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                height: 50,
                font: 20,
                paddingLeft: 12,
                paddingRight: 12,
                linkWidth: 100,
                linkFont: 12,
                linkPaddingTop: 4,
                me: { paddingRight: 12, fontSize: 10, letterSpacing: 2 }
            }
            case "midhigh": return {
                height: 44,
                font: 18,
                paddingLeft: 12,
                paddingRight: 12,
                linkWidth: 90,
                linkFont: 11,
                linkPaddingTop: 2,
                me: { paddingRight: 12, fontSize: 10, letterSpacing: 2 }
            }
            case "midlow": return {
                height: 40,
                font: 16,
                paddingLeft: 12,
                paddingRight: 16,
                linkWidth: 80,
                linkFont: 10,
                linkPaddingTop: 2,
                me: { paddingRight: 12, fontSize: 10, letterSpacing: 2 }
            }
            case "low": return {
                height: 48,
                font: 18,
                paddingLeft: 12,
                paddingRight: 16,
                linkWidth: 80,
                linkFont: 12,
                linkPaddingTop: 2,
                me: { paddingRight: 12, fontSize: 10, letterSpacing: 2 }
            }
        }
    });

    const linkStyle: CSSProperties = {
        textDecoration: 'none',
        color: 'inherit',
    };

    const linkGridStyle: CSSProperties = {
        ...linkStyle,
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto min-content',
        width: dynamicSizes.linkWidth,
        cursor: 'pointer',
    };

    return <>
        <div
            className={dellaRespira.className}
            style={{
                height: dynamicSizes.height,
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgb(18, 18, 18)",
                boxShadow: "rgba(255, 255, 255, 0.05) 0px 0px 30px 1px",
                paddingLeft: dynamicSizes.paddingLeft,
                fontSize: dynamicSizes.font,
                letterSpacing: '1px',
                color: 'rgb(227,227,227)',
                borderBottom: '1px solid rgb(20, 20, 20)',
            }}>
            <Link
                prefetch={true}
                href={`/${accessToken ? `?access=${accessToken}` : ""}`}
                style={linkStyle}>
                <div
                    style={{
                        paddingRight: dynamicSizes.paddingRight
                    }}>
                    {'Laurus'}
                </div>
            </Link>
            <Link
                prefetch={true}
                href={`/projects${accessToken ? `?access=${accessToken}` : ""}`}
                style={linkGridStyle}>
                <div
                    className={dellaRespira.className}
                    style={{
                        paddingTop: dynamicSizes.linkPaddingTop,
                        fontSize: dynamicSizes.linkFont,
                        letterSpacing: "1px",
                        display: 'grid',
                        placeContent: 'center',
                        color: 'rgb(227, 227, 227)',
                        textShadow: pathname == '/projects' ? "0 0 12px rgba(255, 255, 255, 0.3)" : 'none',
                    }}>
                    {'projects'}
                </div>
                <div style={{
                    height: 1,
                    borderRadius: 10,
                    background: pathname == '/projects' ? 'rgba(255, 255, 255, 0.64)' : 'rgba(0,0,0,0)',
                    boxShadow: pathname == '/projects' ? '0 0 5px rgba(255, 255, 255, 0.79)' : 'none'
                }} />
            </Link>
            <Link
                prefetch={true}
                href={`/workspace${accessToken ? `?access=${accessToken}` : ""}`}
                style={linkGridStyle}>
                <div
                    className={dellaRespira.className}
                    style={{
                        paddingTop: dynamicSizes.linkPaddingTop,
                        fontSize: dynamicSizes.linkFont,
                        letterSpacing: "1px",
                        display: 'grid',
                        placeContent: 'center',
                        color: 'rgb(227, 227, 227)',
                        textShadow: pathname == '/workspace' ? "0 0 12px rgba(255, 255, 255, 0.3)" : 'none',
                    }}>
                    {'workspace'}
                </div>
                <div style={{
                    height: 1,
                    borderRadius: 10,
                    background: pathname == '/workspace' ? 'rgba(255, 255, 255, 0.64)' : 'rgba(0,0,0,0)',
                    boxShadow: pathname == '/workspace' ? '0 0 5px rgba(255, 255, 255, 0.79)' : 'none'
                }} />
            </Link>
            <Link
                href={`/screens${accessToken ? `?access=${accessToken}` : ""}`}
                style={linkGridStyle}>
                <div
                    className={dellaRespira.className}
                    style={{
                        paddingTop: dynamicSizes.linkPaddingTop,
                        fontSize: dynamicSizes.linkFont,
                        letterSpacing: "1px",
                        display: 'grid',
                        placeContent: 'center',
                        color: 'rgb(227, 227, 227)',
                        textShadow: pathname == '/screens' ? "0 0 12px rgba(255, 255, 255, 0.3)" : 'none',
                    }}>
                    {'screens'}
                </div>
                <div style={{
                    height: 1,
                    borderRadius: 10,
                    background: pathname == '/screens' ? 'rgba(255, 255, 255, 0.64)' : 'rgba(0,0,0,0)',
                    boxShadow: pathname == '/screens' ? '0 0 5px rgba(255, 255, 255, 0.79)' : 'none'
                }} />
            </Link>
            {me && <Link
                prefetch={true}
                href={`/${accessToken ? `?access=${accessToken}` : ""}`}
                style={{ ...linkStyle, marginLeft: 'auto', ...dynamicSizes.me }}>
                {me.username}
            </Link>}
        </div>
    </>;
}
