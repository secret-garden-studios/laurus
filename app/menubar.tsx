'use client'
import Image from "next/image";

export default function Menubar() {
    return (
        <>
            <div style={{
                height: 50,
                display: "flex",
                alignItems: "center",
                background: "linear-gradient(360deg, rgba(8, 8, 8, 1), rgba(27, 27, 27, 1))",
                boxShadow: "rgba(255, 255, 255, 0.05) 0px 0px 30px 1px",
                padding: 8
            }}>
                <Image
                    style={{ borderRadius: 5, border: '1px solid rgba(255, 255, 255, 0.08)' }}
                    src={"/laurus-logo-dark-theme.png"}
                    alt={"logo"}
                    width={32}
                    height={32} />
            </div>
        </>
    );
}
