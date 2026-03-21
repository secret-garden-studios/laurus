'use client'
import { dellaRespira } from "./fonts";
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LaurusResolution } from "./landing";
import { useState } from "react";

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
                paddingRight: 24,
                linkWidth: 100,
                linkFont: 12,
                linkPaddingTop: 4
            }
            case "midhigh": return {
                height: 44,
                font: 18,
                paddingLeft: 12,
                paddingRight: 20,
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
                height: 40,
                font: 16,
                paddingLeft: 12,
                paddingRight: 16,
                linkWidth: 80,
                linkFont: 10,
                linkPaddingTop: 2
            }
        }
    })
    return (
        <>
            <div
                className={dellaRespira.className}
                style={{
                    height: menubarSize.height,
                    display: "flex",
                    alignItems: "center",
                    background: "linear-gradient(360deg, rgba(8, 8, 8, 1), rgba(27, 27, 27, 1))",
                    boxShadow: "rgba(255, 255, 255, 0.05) 0px 0px 30px 1px",
                    paddingLeft: menubarSize.paddingLeft,
                    fontSize: menubarSize.font,
                    letterSpacing: '1px',
                    color: 'rgb(227,227,227)',
                    borderBottom: '1px solid rgb(20, 20, 20)',
                }}>
                <div style={{ paddingRight: menubarSize.paddingRight }}>
                    {'Laurus'}
                </div>
                <Link
                    prefetch={true}
                    href={"/workspace"}
                    style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'grid',
                        width: menubarSize.linkWidth,
                        height: '100%',
                        gridTemplateRows: 'auto min-content',
                    }}>
                    <div
                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                        onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
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
                <Link href={"/screens"} style={{
                    textDecoration: 'none', color: 'inherit',
                    display: 'grid',
                    width: menubarSize.linkWidth,
                    height: '100%',
                    gridTemplateRows: 'auto min-content'
                }}>
                    <div
                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                        onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
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
        </>
    );
}
