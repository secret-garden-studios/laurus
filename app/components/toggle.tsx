import { CSSProperties } from "react";

interface Toggle {
    value: boolean,
    onClick: () => void,
    trackStyles?: CSSProperties,
    buttonStyles?: CSSProperties,
    translateX?: number,
}
export default function Toggle({ value, onClick, trackStyles, buttonStyles, translateX = 15 }: Toggle) {
    return <>
        <div onClick={onClick}
            style={{
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
                background: value ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: value ? '1px solid rgba(255,255,255, 0.5)' : '1px solid rgba(255,255,255,0.2)',
                boxShadow: value ? '0 0 10px 0px rgba(255, 255, 255, 0.25)' : 'none',
                ...trackStyles
            }}>
            <div style={{
                background: value ?
                    'radial-gradient(circle at 30% 30%, rgb(255, 255, 255) 0%, rgb(200, 200, 200) 45%, rgb(150, 150, 150) 100%)' :
                    'radial-gradient(circle at 30% 30%, rgb(255, 255, 255) 0%, rgb(200, 200, 200) 45%, rgb(150, 150, 150) 100%)',
                borderRadius: '50%',
                transition: 'transform 0.3s',
                transform: value ? `translateX(${translateX}px)` : 'translateX(0px)',
                ...buttonStyles
            }} />
        </div>
    </>
}
