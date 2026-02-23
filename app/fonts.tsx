import { Della_Respira, Michroma, Notable, Italiana, DM_Sans, Ubuntu_Mono, Red_Hat_Display } from 'next/font/google'
import { Geist, Geist_Mono, } from "next/font/google";

export const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

export const geistSansLite = Geist({
    weight: '100',
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

export const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const dellaRespira = Della_Respira({
    weight: '400',
    subsets: ['latin'],
});

export const dmSans = DM_Sans({
    weight: '200',
    subsets: ['latin'],
});

export const michroma = Michroma({
    weight: '400',
    subsets: ['latin'],
});

export const notable = Notable({
    weight: '400',
    subsets: ['latin'],
});

export const italiana = Italiana({
    weight: '400',
    subsets: ['latin'],
});

export const ubuntuMono = Ubuntu_Mono({
    weight: "400",
});

export const redHatDisplay = Red_Hat_Display({
    weight: "400",
});