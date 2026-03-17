'use client'
import { dellaRespira } from "./fonts";
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Menubar() {
    const pathname = usePathname();
    return (
        <>
            <div
                className={dellaRespira.className}
                style={{
                    height: 50,
                    display: "flex",
                    alignItems: "center",
                    background: "linear-gradient(360deg, rgba(8, 8, 8, 1), rgba(27, 27, 27, 1))",
                    boxShadow: "rgba(255, 255, 255, 0.05) 0px 0px 30px 1px",
                    paddingLeft: 12,
                    fontSize: 20,
                    letterSpacing: '1px',
                    color: 'rgb(227,227,227)',
                    borderBottom: '1px solid rgb(20, 20, 20)',
                }}>
                <div style={{ paddingRight: 24 }}>
                    {'Laurus'}
                </div>
                <Link
                    prefetch={true}
                    href={"/workspace"} style={{
                        textDecoration: 'none', color: 'inherit',
                        display: 'grid',
                        width: 100,
                        height: '100%',
                        gridTemplateRows: 'auto min-content',
                    }}>
                    <div
                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                        onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                        className={dellaRespira.className}
                        style={{
                            paddingTop: 4,
                            fontSize: 12,
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
                    width: 100,
                    height: '100%',
                    gridTemplateRows: 'auto min-content'
                }}>
                    <div
                        onMouseEnter={(e) => { e.currentTarget.style.cursor = 'pointer' }}
                        onMouseLeave={(e) => { e.currentTarget.style.cursor = 'default' }}
                        className={dellaRespira.className}
                        style={{
                            paddingTop: 4,
                            fontSize: 12,
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
