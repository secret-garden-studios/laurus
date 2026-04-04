'use client'
import { dellaRespira } from "./fonts";
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LaurusResolution } from "./landing";
import { CSSProperties, useState } from "react";

interface Menubar {
    resolution: LaurusResolution
}
export default function Menubar({ resolution }: Menubar) {
    const pathname = usePathname();
    const [menubarSize] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                height: 50,
                font: 20,
                paddingLeft: 12,
                paddingRight: 12,
                linkWidth: 100,
                linkFont: 12,
                linkPaddingTop: 4
            }
            case "midhigh": return {
                height: 44,
                font: 18,
                paddingLeft: 12,
                paddingRight: 12,
                linkWidth: 90,
                linkFont: 11,
                linkPaddingTop: 2
            }
            case "midlow": return {
                height: 40,
                font: 16,
                paddingLeft: 12,
                paddingRight: 16,
                linkWidth: 80,
                linkFont: 10,
                linkPaddingTop: 2
            }
            case "low": return {
                height: 48,
                font: 18,
                paddingLeft: 12,
                paddingRight: 16,
                linkWidth: 80,
                linkFont: 12,
                linkPaddingTop: 2
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
        width: menubarSize.linkWidth,
    };

    return <>
        <div
            className={dellaRespira.className}
            style={{
                height: menubarSize.height,
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgb(18, 18, 18)",
                boxShadow: "rgba(255, 255, 255, 0.05) 0px 0px 30px 1px",
                paddingLeft: menubarSize.paddingLeft,
                fontSize: menubarSize.font,
                letterSpacing: '1px',
                color: 'rgb(227,227,227)',
                borderBottom: '1px solid rgb(20, 20, 20)',
            }}>
            <Link
                prefetch={true}
                href={"/"}
                style={linkStyle}>
                <div
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    style={{
                        paddingRight: menubarSize.paddingRight
                    }}>
                    {'Laurus'}
                </div>
            </Link>
            <Link
                prefetch={true}
                href={"/projects"}
                style={linkGridStyle}>
                <div
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    className={dellaRespira.className}
                    style={{
                        paddingTop: menubarSize.linkPaddingTop,
                        fontSize: menubarSize.linkFont,
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
                href={"/workspace"}
                style={linkGridStyle}>
                <div
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    className={dellaRespira.className}
                    style={{
                        paddingTop: menubarSize.linkPaddingTop,
                        fontSize: menubarSize.linkFont,
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
                href={"/screens"}
                style={linkGridStyle}>
                <div
                    onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                    onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
                    className={dellaRespira.className}
                    style={{
                        paddingTop: menubarSize.linkPaddingTop,
                        fontSize: menubarSize.linkFont,
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
        </div>
    </>;
}
