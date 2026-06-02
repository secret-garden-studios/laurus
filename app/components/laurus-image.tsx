'use client'
import NextImage, { ImageProps } from "next/image";
import { Ref, useMemo } from "react";

export interface LaurusImageProps extends ImageProps {
    imgRef?: Ref<HTMLImageElement>;
}

export default function LaurusImage(props: LaurusImageProps) {
    const { src, alt, width, height, fill, style, className, imgRef, ...rest } = props;
    const isValidSrc = useMemo(() => { return !!src && (typeof src === 'string' ? src.trim() !== '' : true) }, [src]);

    if (!isValidSrc) {
        return (
            <div title={'img not found'}
                style={{
                    position: fill ? 'absolute' : 'relative',
                    width: fill ? '100%' : width,
                    height: fill ? '100%' : height,
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 0,
                    backdropFilter: 'blur(15px)',
                    backgroundImage: `
                        linear-gradient(to top right, transparent calc(50% - 0.5px), rgba(255,255,255,0.5) 50%, transparent calc(50% + 0.5px)),
                        linear-gradient(to top left, transparent calc(50% - 0.5px), rgba(255,255,255,0.5) 50%, transparent calc(50% + 0.5px))
                    `,
                }}
            />
        );
    }

    return (
        <NextImage
            {...rest}
            ref={imgRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            fill={fill}
            style={style}
            className={className}
        />
    );
}
