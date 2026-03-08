'use client'
import { dellaRespira } from "./fonts";

export default function Menubar() {
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
                    color: 'rgb(227,227,227)'
                }}>
                {'Laurus'}
            </div>
        </>
    );
}
