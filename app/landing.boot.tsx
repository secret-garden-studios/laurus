'use client'
import { useEffect, useState } from "react";
import Landing, { LandingFormType } from "./landing.client";
import styles from "./app.module.css";
import { getMe, refreshAccessToken, LaurusUserResult } from "./landing.server";

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
    accessTokenInit: string | undefined,
    resetPassword: string | undefined,
}
export default function LandingBoot({ laurusApi, accessTokenInit, resetPassword }: LandingBoot) {
    const [resolution, setResolution] = useState<LaurusResolution | undefined>(undefined);
    const [formType, setFormType] = useState<LandingFormType | undefined>(undefined);
    const [me, setMe] = useState<LaurusUserResult | undefined>(undefined);
    const [accessToken, setAccessToken] = useState<string | undefined>(undefined);

    useEffect(() => {
        (() => {
            if (!resolution) {
                setResolution(getScreenResolution())
            }
        })();
    }, [resolution]);

    useEffect(() => {
        const checkIfImLoggedIn = async (token: string) => {
            const me = await getMe(laurusApi, token);
            if (me) {
                setAccessToken(token);
                setMe(me);
                return true;
            }
            else {
                return false;
            }
        }

        (async () => {
            try {
                let loggedIn = false;
                if (accessTokenInit) {
                    loggedIn = await checkIfImLoggedIn(accessTokenInit);
                }
                else {
                    const refresh = await refreshAccessToken(laurusApi);
                    if (refresh.success) {
                        loggedIn = await checkIfImLoggedIn(refresh.access_token);
                    }
                }

                if (resetPassword) {
                    setFormType(LandingFormType.passwordConfirmation);
                }
                else if (loggedIn) {
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
    }, [accessTokenInit, laurusApi, resetPassword])

    return (resolution !== undefined && formType !== undefined) ?
        <Landing
            laurusApi={laurusApi}
            resolution={resolution}
            resetPasswordToken={resetPassword}
            formInit={formType}
            me={me}
            accessToken={accessToken} />
        : <Skeleton />
}

function Skeleton() {
    return (<>
        <div
            className={`${styles["noisy-background"]}`}
            style={{ cursor: 'progress', width: '100vw', height: '100vh' }} />
    </>)
}