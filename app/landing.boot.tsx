'use client'
import { use, useEffect, useState } from "react";
import Landing, { LandingFormType } from "./landing.client";
import styles from "./app.module.css";
import { MeDependencies } from "./page";

export type LaurusResolution =
    | { type: 'high' }
    | { type: 'midhigh' }
    | { type: 'midlow' }
    | { type: 'low' }
function getScreenResolution(): LaurusResolution {
    if (typeof screen === 'undefined') return { type: 'midhigh' };

    if (screen.width > 2560) {
        return { type: 'high' };
    }
    else if (screen.width > 1920) {
        return { type: 'midhigh' };
    }
    else if (screen.width > 1280) {
        return { type: 'midlow' };
    }
    else {
        return { type: 'low' };
    }
}

interface LandingBoot {
    laurusApi: string | undefined,
    mePromise: Promise<MeDependencies>
    resetPassword: string | undefined,
}
export default function LandingBoot({ laurusApi, mePromise, resetPassword }: LandingBoot) {
    const me = use(mePromise);
    const [resolution, setResolution] = useState<LaurusResolution | undefined>(undefined);
    const [formType, setFormType] = useState<LandingFormType | undefined>(undefined);

    useEffect(() => {
        (async () => {
            if (!resolution) {
                setResolution(getScreenResolution());
            }
            try {
                if (resetPassword) {
                    setFormType(LandingFormType.passwordConfirmation);
                }
                else if (me.me) {
                    setFormType(LandingFormType.loggedIn);
                }
                else {
                    setFormType(LandingFormType.login);
                }
            }
            catch {
                setFormType(LandingFormType.login);
            }
        })();
    }, [me.me, resetPassword, resolution])

    return (resolution !== undefined && formType !== undefined) ?
        <Landing
            laurusApi={laurusApi}
            resolution={resolution}
            resetPasswordToken={resetPassword}
            formInit={formType}
            me={me} />
        : <Skeleton />
}

function Skeleton() {
    return (<>
        <div
            className={`${styles["noisy-background"]}`}
            style={{ cursor: 'progress', width: '100vw', height: '100vh' }} />
    </>)
}