import { dellaRespira } from "./fonts";
import styles from "./app.module.css";
import { useEffect, useRef, useState } from "react";
import { SvgRepo, visibility, visibilityOff } from "./svg-repo";
import { LaurusResolution } from "./landing.boot";
import {
    login,
    registerUser,
    Register_V1_0,
    resetPassword,
    resetPasswordConfirm,
    EMAIL_ERROR,
    USERNAME_ERROR,
    UNAUTHORIZED_ERROR,
    LANDING_ERROR,
    LaurusUserResult,
    refreshAccessToken
} from "./landing.server";
import { useRouter } from 'next/navigation'
import { MeDependencies } from "./page";

export enum LandingFormType {
    login,
    loggedIn,
    registration,
    passwordReset,
    passwordConfirmation,
    none
}

enum ButtonBorderColor {
    purple,
    red,
    white,
}

const buttonBorderRecord: Record<ButtonBorderColor, { p: string, s: string, t: string }> = {
    [ButtonBorderColor.purple]: { p: 'rgb(140, 121, 179)', s: 'rgb(21, 21, 21)', t: 'rgb(40, 40, 40)' },
    [ButtonBorderColor.red]: { p: 'rgb(255, 95, 109)', s: 'rgb(21, 21, 21)', t: 'rgb(40, 40, 40)' },
    [ButtonBorderColor.white]: { p: 'rgb(227, 227, 227)', s: 'rgb(21, 21, 21)', t: 'rgb(40, 40, 40)' },
}

interface Landing {
    laurusApi: string | undefined,
    resolution: LaurusResolution,
    resetPasswordToken: string | undefined,
    formInit: LandingFormType,
    me: MeDependencies,
}
export default function Landing({ laurusApi, resolution, resetPasswordToken, formInit, me }: Landing) {
    const router = useRouter();
    const [formType, setFormType] = useState<LandingFormType>(formInit);
    const [newUsername, setNewUsername] = useState("");

    return <>
        <div
            className={styles["noisy-background-20-3"] + ' ' + dellaRespira.className}
            style={{
                display: 'grid',
                height: '100vh',
                width: '100vw',
                gridTemplateRows: `${resolution.type == 'low' ? 0 : formType == LandingFormType.loggedIn || formType == LandingFormType.passwordConfirmation ? 35 : 30}vh auto min-content`,
                color: 'rgb(227,227,227)'
            }} >
            <div />
            {resolution.type == 'low' ? <LowResBody /> : (() => {
                switch (formType) {
                    case LandingFormType.login: return <>
                        <LoginBody
                            laurusApi={laurusApi}
                            resolution={resolution}
                            onNewFormType={(form) => { setNewUsername(""); setFormType(form); }}
                            newUsername={newUsername} />
                    </>
                    case LandingFormType.loggedIn: return <>
                        {me.me ?
                            <LoggedInBody
                                me={me.me}
                                laurusApi={laurusApi}
                                resolution={resolution}
                                onNewFormType={setFormType} /> :
                            <LoginBody
                                laurusApi={laurusApi}
                                resolution={resolution}
                                onNewFormType={(form) => { setNewUsername(""); setFormType(form); }}
                                newUsername={newUsername} />}
                    </>
                    case LandingFormType.registration: return <>
                        <RegistrationBody
                            laurusApi={laurusApi}
                            resolution={resolution}
                            onNewUsername={(v) => {
                                alert("We received your request to become a creator! Keep an eye out for an email from us.");
                                setNewUsername(v);
                            }}
                            onNewFormType={setFormType}
                        />
                    </>
                    case LandingFormType.passwordReset: return <>
                        <PasswordResetBody
                            laurusApi={laurusApi}
                            resolution={resolution}
                            onNewFormType={(form) => { setNewUsername(""); setFormType(form); }} />
                    </>
                    case LandingFormType.passwordConfirmation: return <>
                        <PasswordConfirmationBody
                            resetPasswordToken={resetPasswordToken}
                            laurusApi={laurusApi}
                            resolution={resolution}
                            onNewFormType={(form) => { setNewUsername(""); setFormType(form); }} />
                    </>
                    case LandingFormType.none:
                        return <></>
                }
            })()}
            <div
                style={{
                    height: 'min-content',
                    padding: 20,
                    width: '100%',
                    display: 'grid',
                    placeContent: 'center',
                }}>
                {resolution.type == 'low' ?
                    <div
                        onClick={async () => {
                            router.push('/screens');
                        }}
                        style={{
                            cursor: 'pointer',
                            fontSize: 12,
                            letterSpacing: "3px",
                            textDecoration: 'underline',
                            textUnderlineOffset: 2,
                            textDecorationColor: 'rgba(255,255,255,0.4)',
                        }}>
                        {'tap here to enter'}
                    </div> :
                    formType == LandingFormType.login ?
                        <div
                            onClick={async () => {
                                setFormType(LandingFormType.passwordReset);
                            }}
                            style={{
                                cursor: 'pointer',
                                fontSize: 12,
                                letterSpacing: "3px",
                                textDecoration: 'underline',
                                textUnderlineOffset: 2,
                                textDecorationColor: 'rgba(255,255,255,0.4)',
                            }}>
                            {'reset your password'}
                        </div> :
                        <></>
                }
            </div >
        </div>

    </>
}

interface LaurusText {
    scale: number,
    color: { a: string, b: string, c: string, d: string, e: string, f: string }
}
function LaurusText({ scale, color }: LaurusText) {
    const svgA1Ref = useRef<SVGSVGElement>(null);
    const [l1Ids] = useState({ linearGradient: "l1lg", filter: "l1f", strokeLinearGradient: "l1slg" });
    const [a1Ids] = useState({ linearGradient: "a1lg", filter: "a1f", strokeLinearGradient: "a1slg" });
    const [u1Ids] = useState({ linearGradient: "u1lg", filter: "u1f", strokeLinearGradient: "u1slg" });
    const [r1Ids] = useState({ linearGradient: "r1lg", filter: "r1f", strokeLinearGradient: "r1slg" });
    const [u2Ids] = useState({ linearGradient: "u2lg", filter: "u2f", strokeLinearGradient: "u2slg" });
    const [s1Ids] = useState({ linearGradient: "s1lg", filter: "s1f", strokeLinearGradient: "s1slg" });
    const [strokeWidth] = useState(0.175);
    const [strokeOpacity] = useState(1);
    const [fillOpacity] = useState(1);

    return <>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'center', gap: 4 }}>
            <div style={{ display: 'grid', placeContent: 'center' }}>
                <svg
                    style={{ overflow: 'visible' }}
                    width={`${scale * 7.7717109}mm`}
                    height={`${scale * 14.093503}mm`}
                    viewBox="0 0 7.7717109 14.093503"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg" >
                    <LaurusSvgDef
                        ids={l1Ids}
                        color={color}
                        durations={{
                            linearGradient: "4s",
                            filter: "0.1s"
                        }} />
                    <path
                        transform="translate(-93.096801,-104.74799)"
                        stroke={`url(#${l1Ids.strokeLinearGradient})`}
                        fill={`url(#${l1Ids.linearGradient})`}
                        filter={`url(#${l1Ids.filter})`}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        fillOpacity={fillOpacity}
                        d="M 100.73622,118.7092 H 93.229092 V 104.88028 H 94.868807 V 118.51164 H 100.73622 Z"
                        aria-label="L" />
                </svg>
            </div>
            <div className="race-track-path" aria-label="L-shaped animated gradient" />
            <div style={{ display: 'grid', placeContent: 'center', overflow: 'visible' }}>
                <svg
                    style={{ overflow: 'visible' }}
                    ref={svgA1Ref}
                    width={`${scale * 9.1348467}mm`}
                    height={`${scale * 10.300423}mm`}
                    viewBox="0 0 9.1348467 10.300423"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg" >
                    <LaurusSvgDef
                        ids={a1Ids}
                        color={color}
                        durations={{
                            linearGradient: "4.1s",
                            filter: "0.1s"
                        }} />
                    <path
                        transform="translate(-92.020125,-116.40941)"
                        stroke={`url(#${a1Ids.strokeLinearGradient})`}
                        fill={`url(#${a1Ids.linearGradient})`}
                        filter={`url(#${a1Ids.filter})`}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        fillOpacity={fillOpacity}
                        d="M 100.41026,126.49852 Q 99.066876,126.49852 98.572986,125.98487 98.118608,125.55025 98.118608,125.23416 V 124.81929 Q 97.150583,126.57754 95.016978,126.57754 92.527773,126.57754 92.191928,124.3254 92.152416,124.08834 92.152416,123.85127 92.152416,123.59445 92.231439,123.29811 92.310461,123.00178 92.685818,122.64618 93.43653,121.93498 95.985003,121.77693 96.617182,121.71766 97.150583,121.71766 97.683984,121.71766 98.118608,121.75718 V 118.47775 Q 98.079096,118.45799 98.118608,118.29995 98.158119,118.12215 98.039585,117.86532 97.940807,117.58874 97.763007,117.33192 97.585206,117.0751 97.130828,116.8973 96.676449,116.69974 95.945492,116.69974 95.214534,116.69974 94.226754,116.97632 93.25873,117.23314 92.804351,117.48997 L 92.725329,117.35168 Q 94.483577,116.5417 96.301092,116.5417 98.335919,116.5417 98.987854,117.27265 99.5015,117.84557 99.5015,118.47775 V 125.09587 Q 99.5015,125.66878 99.718811,125.98487 99.955878,126.28121 100.19295,126.30096 L 100.41026,126.34048 H 101.02268 V 126.49852 Z M 95.333068,126.4195 Q 96.380115,126.4195 97.20985,125.7083 98.059341,124.97734 98.118608,124.30565 V 121.91522 Q 97.585206,121.87571 97.03205,121.87571 96.498648,121.87571 95.965247,121.93498 94.463822,122.11278 94.009443,122.60667 93.555064,123.10056 93.555064,123.9698 93.555064,124.12785 93.57482,124.3254 93.75262,126.4195 95.333068,126.4195 Z"
                        aria-label="a" />
                </svg>
            </div>
            <div style={{ display: 'grid', placeContent: 'center' }}>
                <svg
                    style={{ overflow: 'visible' }}
                    width={`${scale * 9.6682501}mm`}
                    height={`${scale * 10.221413}mm`}
                    viewBox="0 0 9.6682501 10.221413"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg" >
                    <LaurusSvgDef
                        ids={u1Ids}
                        color={color}
                        durations={{
                            linearGradient: "4.2s",
                            filter: "0.1s"
                        }} />
                    <path
                        transform="translate(-96.100212,-121.16201)"
                        stroke={`url(#${u1Ids.strokeLinearGradient})`}
                        fill={`url(#${u1Ids.linearGradient})`}
                        filter={`url(#${u1Ids.filter})`}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        fillOpacity={fillOpacity}
                        d="M 97.615395,128.90021 Q 97.615395,130.4609 98.44513,130.89553 98.840242,131.09308 99.452666,131.09308 100.69727,131.09308 101.66529,130.14481 102.65307,129.19654 102.7321,128.38656 V 121.2943 H 104.11499 V 129.76946 Q 104.11499,130.34237 104.3323,130.65846 104.56937,130.95479 104.80643,130.97455 L 105.02375,131.01406 H 105.63617 V 131.1721 H 104.43108 Q 103.6211,131.1721 103.18647,130.8165 102.77161,130.4609 102.75185,130.1053 L 102.7321,129.76946 V 128.91997 Q 102.37649,129.76946 101.46774,130.52017 100.55898,131.25113 99.472422,131.25113 98.405619,131.25113 97.714173,131.05357 97.042483,130.83626 96.746149,130.4609 96.232503,129.84848 96.232503,128.88045 V 121.2943 H 97.615395 Z"
                        aria-label="u" />
                </svg>
            </div>
            <div style={{ display: 'grid', placeContent: 'center' }}>
                <svg
                    style={{ overflow: 'visible' }}
                    width={`${scale * 5.8751731}mm`}
                    height={`${scale * 10.221413}mm`}
                    viewBox="0 0 5.8751731 10.221413"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg" >
                    <LaurusSvgDef
                        ids={r1Ids}
                        color={color}
                        durations={{
                            linearGradient: "4.3s",
                            filter: "0.1s"
                        }} />
                    <path
                        transform="translate(-102.42338,-115.47468)"
                        stroke={`url(#${r1Ids.strokeLinearGradient})`}
                        fill={`url(#${r1Ids.linearGradient})`}
                        filter={`url(#${r1Ids.filter})`}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        fillOpacity={fillOpacity}
                        d="M 106.32899,116.53549 V 116.12062 Q 105.43999,116.47622 104.70903,117.56278 103.97807,118.62958 103.93856,119.57785 V 125.5638 H 102.55567 V 115.686 H 103.93856 V 118.82714 Q 104.25465,117.68131 105.14365,116.67378 106.03266,115.64649 107.15873,115.60697 H 107.23775 Q 107.63286,115.60697 107.88968,115.88355 108.16626,116.14038 108.16626,116.53549 108.16626,116.9306 107.88968,117.18742 107.63286,117.44425 107.23775,117.44425 106.84264,117.44425 106.58581,117.18742 106.32899,116.9306 106.32899,116.53549 Z"
                        aria-label="r" />
                </svg>
            </div>
            <div style={{ display: 'grid', placeContent: 'center' }}>
                <svg
                    style={{ overflow: 'visible' }}
                    width={`${scale * 9.6682501}mm`}
                    height={`${scale * 10.221413}mm`}
                    viewBox="0 0 9.6682501 10.221413"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg" >
                    <LaurusSvgDef
                        ids={u2Ids}
                        color={color}
                        durations={{
                            linearGradient: "4.4s",
                            filter: "0.1s"
                        }} />
                    <path
                        transform="translate(-96.100212,-121.16201)"
                        stroke={`url(#${u2Ids.strokeLinearGradient})`}
                        fill={`url(#${u2Ids.linearGradient})`}
                        filter={`url(#${u2Ids.filter})`}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        fillOpacity={fillOpacity}
                        d="M 97.615395,128.90021 Q 97.615395,130.4609 98.44513,130.89553 98.840242,131.09308 99.452666,131.09308 100.69727,131.09308 101.66529,130.14481 102.65307,129.19654 102.7321,128.38656 V 121.2943 H 104.11499 V 129.76946 Q 104.11499,130.34237 104.3323,130.65846 104.56937,130.95479 104.80643,130.97455 L 105.02375,131.01406 H 105.63617 V 131.1721 H 104.43108 Q 103.6211,131.1721 103.18647,130.8165 102.77161,130.4609 102.75185,130.1053 L 102.7321,129.76946 V 128.91997 Q 102.37649,129.76946 101.46774,130.52017 100.55898,131.25113 99.472422,131.25113 98.405619,131.25113 97.714173,131.05357 97.042483,130.83626 96.746149,130.4609 96.232503,129.84848 96.232503,128.88045 V 121.2943 H 97.615395 Z"
                        aria-label="u" />
                </svg>
            </div>
            <div style={{ display: 'grid', placeContent: 'center' }}>
                <svg
                    style={{ overflow: 'visible' }}
                    width={`${scale * 7.2185531}mm`}
                    height={`${scale * 10.300423}mm`}
                    viewBox="0 0 7.2185531 10.300423"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg">
                    <LaurusSvgDef
                        ids={s1Ids}
                        color={color}
                        durations={{
                            linearGradient: "4.5s",
                            filter: "0.1s"
                        }} />
                    <path
                        transform="translate(-103.26017,-112.98211)"
                        stroke={`url(#${s1Ids.strokeLinearGradient})`}
                        fill={`url(#${s1Ids.linearGradient})`}
                        filter={`url(#${s1Ids.filter})`}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        fillOpacity={fillOpacity}
                        d="M 109.25988,113.88487 Q 108.94379,113.62804 108.23258,113.45024 107.54114,113.27244 107.18554,113.27244 106.82994,113.27244 106.77067,113.27244 105.70387,113.2922 105.22973,113.8256 104.7556,114.33925 104.7556,114.99118 104.7556,115.64311 105.17047,116.09749 105.58533,116.53212 106.19776,116.78894 106.82994,117.02601 107.54114,117.3421 108.2721,117.65819 108.88452,117.99403 109.5167,118.31012 109.93157,118.9423 110.34643,119.55472 110.34643,120.48324 110.34643,121.41175 109.6945,122.06368 109.04256,122.71562 108.23258,122.93293 107.44236,123.15024 106.51385,123.15024 104.49878,123.15024 103.49124,122.26124 L 103.60977,122.14271 Q 104.00489,122.51806 104.77535,122.75513 105.56558,122.9922 106.29654,122.9922 107.46212,122.9922 108.21283,122.36002 108.9833,121.70808 108.9833,120.75982 108.9833,119.79179 108.41039,119.21888 107.83747,118.62621 107.00774,118.31012 106.19776,117.97428 105.36802,117.65819 104.53829,117.32234 103.96538,116.74943 103.39246,116.15676 103.39246,115.38629 103.39246,114.61582 103.74806,114.14169 104.10366,113.6478 104.69633,113.45024 105.70387,113.1144 106.7114,113.1144 108.41039,113.1144 109.35865,113.74658 Z"
                        aria-label="s" />
                </svg>
            </div>
        </div>
    </>
}

interface LaurusSvgDef {
    ids: { linearGradient: string, filter: string, strokeLinearGradient: string }
    color: { a: string, b: string, c: string, d: string, e: string, f: string }
    durations: { linearGradient: string, filter: string }
}
function LaurusSvgDef({ ids, color, durations }: LaurusSvgDef) {
    return <>
        <defs>
            <linearGradient id={ids.linearGradient} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color.a} />
                <stop offset="50%" stopColor={color.b} />
                <stop offset="100%" stopColor={color.c} />
                <animateTransform
                    attributeName="gradientTransform"
                    type="rotate"
                    from="0 0.5 0.5"
                    to="360 0.5 0.5"
                    dur={durations.linearGradient}
                    repeatCount="indefinite" />
            </linearGradient>
            <linearGradient id={ids.strokeLinearGradient} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color.d} />
                <stop offset="50%" stopColor={color.e} />
                <stop offset="100%" stopColor={color.f} />
                <animateTransform
                    attributeName="gradientTransform"
                    type="rotate"
                    from="0 0.5 0.5"
                    to="360 0.5 0.5"
                    dur={durations.linearGradient}
                    repeatCount="indefinite" />
            </linearGradient>

            <filter id={ids.filter} x="-250%" y="-250%" width="600%" height="600%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" result="core" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="halo">
                    <animate
                        attributeName="stdDeviation"
                        values="0.5; 1.0; 0.5"
                        dur="3s"
                        calcMode="spline"
                        keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
                        repeatCount="indefinite" />
                </feGaussianBlur>
                <feComponentTransfer in="halo" result="gentleHalo">
                    <feFuncA type="linear" slope="1.1" />
                </feComponentTransfer>
                <feMerge>
                    <feMergeNode in="gentleHalo" />
                    <feMergeNode in="core" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    </>
}

function LowResBody() {
    return <>
        <div
            style={{
                display: 'grid',
                placeContent: 'center',
                position: 'relative',
                letterSpacing: '2px',
                gap: 10,
            }}>
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div style={{ padding: "10px 0px" }}>
                    <LaurusText
                        scale={1}
                        color={{
                            a: "rgb(255, 255, 255)",
                            b: "rgb(190, 190, 190)",
                            c: "rgb(163, 163, 163)",
                            d: "rgb(255, 255, 255)",
                            e: "rgb(255, 255, 255)",
                            f: "rgb(155, 114, 215)",
                        }} />
                </div>
                <div className={styles["animated-font"]} style={{ fontSize: 20, justifySelf: 'center', padding: 4 }}>
                    <div >{'beta version'}</div>
                </div>
            </div>
        </div>
    </>
}

interface LoginBody {
    laurusApi: string | undefined,
    resolution: LaurusResolution,
    onNewFormType: (newFormType: LandingFormType) => void,
    newUsername: string
}
function LoginBody({ laurusApi, resolution, onNewFormType, newUsername }: LoginBody) {
    const router = useRouter();
    const [username, setUsername] = useState<string>(newUsername ? newUsername : "");
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [msg, setMsg] = useState<string>("");
    const buttonBorderRef = useRef<ButtonBorderColor>(ButtonBorderColor.purple);
    const [buttonBorder, setButtonBorder] = useState<ButtonBorderColor>(ButtonBorderColor.purple);
    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                input: { height: 50, fontSize: 14, padding: "8px 35px 8px 12px", },
            }
            case "midhigh": return {
                input: { height: 50, fontSize: 12, padding: "8px 35px 8px 12px", },
            }
            case "midlow":
            case "low": return {
                input: { height: 50, fontSize: 12, padding: "8px 35px 8px 12px", },
            }
        }
    });
    return <>
        <div
            style={{
                display: 'grid',
                alignContent: 'start',
                justifyContent: 'center',
                position: 'relative',
                letterSpacing: '2px',
                gap: 10,
            }}>
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div style={{ padding: "10px 0px" }}>
                    <LaurusText
                        scale={1}
                        color={{
                            a: "rgb(255, 255, 255)",
                            b: "rgb(190, 190, 190)",
                            c: "rgb(163, 163, 163)",
                            d: "rgb(255, 255, 255)",
                            e: "rgb(255, 255, 255)",
                            f: "rgb(155, 114, 215)",
                        }} />
                </div>
                <div className={styles["animated-font"]} style={{ fontSize: 20, justifySelf: 'center', padding: 4 }}>
                    <div >{'beta version'}</div>
                </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
                <input
                    className={dellaRespira.className}
                    id="username"
                    placeholder="username"
                    autoComplete="username"
                    value={username}
                    onChange={(v) => {
                        buttonBorderRef.current = ButtonBorderColor.purple;
                        setUsername(v.currentTarget.value);
                        setMsg("");
                        setButtonBorder(ButtonBorderColor.purple);
                    }}
                    style={{
                        ...dynamicSizes.input,
                        width: '100%',
                        borderRadius: 10,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        background: 'rgb(25, 25, 25)',
                        boxSizing: "border-box",
                        outline: "none",
                    }}
                    required
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            className={dellaRespira.className}
                            id="password-input"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                                buttonBorderRef.current = ButtonBorderColor.purple;
                                setPassword(e.target.value);
                                setMsg("");
                                setButtonBorder(ButtonBorderColor.purple);
                            }}
                            placeholder="password"
                            style={{
                                ...dynamicSizes.input,
                                borderRadius: 10,
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                background: 'rgb(25, 25, 25)',
                                boxSizing: "border-box",
                                outline: "none",
                                width: '100%'
                            }}
                            autoComplete="current-password"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setShowPassword(!showPassword);
                            }}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {showPassword ? <SvgRepo
                                svg={visibility('rgba(67,67,67,1)')}
                                containerSize={{
                                    width: 20,
                                    height: 20
                                }}
                                scale={1} /> : <SvgRepo
                                svg={visibilityOff('rgba(67,67,67,1)')}
                                containerSize={{
                                    width: 20,
                                    height: 20
                                }}
                                scale={1} />}
                        </button>
                    </div>
                </div>
                <div
                    className={dellaRespira.className + ' ' + styles['glowing-border'] + ' ' + styles['animated-button-dark']}
                    onClick={async () => {
                        if (!username) {
                            setMsg("provide a username");
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        if (!password) {
                            setMsg("provide a password");
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        const loginResult = await login(laurusApi, username, password);
                        if (!loginResult.success) {
                            setMsg(loginResult.message == UNAUTHORIZED_ERROR ? "try different credentials" : LANDING_ERROR);
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        else {
                            if (resolution.type == 'low') {
                                router.push('/screens');
                            }
                            else {
                                router.push('/workspace');
                            }
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                        cursor: 'pointer',
                        '--color-primary': buttonBorderRecord[buttonBorder].p,
                        '--color-secondary': buttonBorderRecord[buttonBorder].s,
                        '--color-tertiary': buttonBorderRecord[buttonBorder].t,
                    } as React.CSSProperties}>
                    {msg ? msg : 'login'}
                </div>
                <div style={{
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ padding: '0 8px', display: 'grid', placeContent: 'center' }}>{'or'}</div>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div
                    className={`${styles['animated-button-dark']} ${dellaRespira.className}`}
                    onClick={() => {
                        setMsg("");
                        buttonBorderRef.current = ButtonBorderColor.purple;
                        setButtonBorder(ButtonBorderColor.purple);
                        onNewFormType(LandingFormType.registration);
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                    }}>
                    {'become a creator'}
                </div>
                <div style={{
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ padding: '0 8px', display: 'grid', placeContent: 'center' }}>{'or'}</div>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div
                    className={`${styles['animated-button-dark']} ${dellaRespira.className}`}
                    onClick={async () => {
                        if (resolution.type == 'low') {
                            router.push('/screens?guest=true');
                        }
                        else {
                            router.push('/workspace?guest=true');
                        }
                    }}
                    style={{
                        display: 'grid',

                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                    }}>
                    {'continue as a guest'}
                </div>
            </div>
        </div>
    </>
}

interface LoggedInBody {
    me: LaurusUserResult,
    laurusApi: string | undefined,
    resolution: LaurusResolution,
    onNewFormType: (newFormType: LandingFormType) => void,
}
function LoggedInBody({ me, laurusApi, resolution, onNewFormType }: LoggedInBody) {
    const router = useRouter();
    const [msg] = useState<string>("");
    const [buttonBorder] = useState<ButtonBorderColor>(ButtonBorderColor.purple);

    return <>
        <div
            style={{
                display: 'grid',
                alignContent: 'start',
                justifyContent: 'center',
                position: 'relative',
                letterSpacing: '2px',
                gap: 10,
            }}>
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div style={{ padding: "10px 0px" }}>
                    <LaurusText
                        scale={1}
                        color={{
                            a: "rgb(255, 255, 255)",
                            b: "rgb(190, 190, 190)",
                            c: "rgb(163, 163, 163)",
                            d: "rgb(255, 255, 255)",
                            e: "rgb(255, 255, 255)",
                            f: "rgb(155, 114, 215)",
                        }} />
                </div>
                <div className={styles["animated-font"]} style={{ fontSize: 20, justifySelf: 'center', padding: 4 }}>
                    <div >{'beta version'}</div>
                </div>
            </div>
            <div style={{ display: 'grid', gap: 12, }}>
                <div
                    className={dellaRespira.className + ' ' + styles['glowing-border'] + ' ' + styles['animated-button-dark']}
                    onClick={async () => {
                        const refreshResult = await refreshAccessToken(laurusApi);
                        if (refreshResult.success) {
                            if (resolution.type == 'low') {
                                router.push('/screens');
                            }
                            else {
                                router.push('/workspace');
                            }
                        }
                        else {
                            onNewFormType(LandingFormType.login);
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                        cursor: 'pointer',
                        '--color-primary': buttonBorderRecord[buttonBorder].p,
                        '--color-secondary': buttonBorderRecord[buttonBorder].s,
                        '--color-tertiary': buttonBorderRecord[buttonBorder].t,
                    } as React.CSSProperties}>
                    {msg ? msg : `continue as ${me.username}`}
                </div>
                <div style={{
                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ padding: '0 8px', display: 'grid', placeContent: 'center' }}>{'or'}</div>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div
                    className={`${styles['animated-button-dark']} ${dellaRespira.className}`}
                    onClick={() => {
                        onNewFormType(LandingFormType.login);
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                    }}>
                    {'switch accounts'}
                </div>
            </div>
        </div>
    </>
}

interface RegistrationBody {
    laurusApi: string | undefined,
    resolution: LaurusResolution,
    onNewFormType: (newFormType: LandingFormType) => void,
    onNewUsername: (newUsername: string) => void,
}
function RegistrationBody({ laurusApi, resolution, onNewFormType, onNewUsername }: RegistrationBody) {
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [email, setEmail] = useState<string>("");
    const [msg, setMsg] = useState<string>("");
    const buttonBorderRef = useRef<ButtonBorderColor>(ButtonBorderColor.purple);
    const [buttonBorder, setButtonBorder] = useState<ButtonBorderColor>(ButtonBorderColor.purple);
    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                input: { height: 50, fontSize: 14, padding: "8px 35px 8px 12px", },
            }
            case "midhigh": return {
                input: { height: 50, fontSize: 12, padding: "8px 35px 8px 12px", },
            }
            case "midlow":
            case "low": return {
                input: { height: 50, fontSize: 11, padding: "8px 35px 8px 12px", },
            }
        }
    });
    return <>
        <div
            style={{
                display: 'grid',
                alignContent: 'start',
                justifyContent: 'center',
                position: 'relative',
                letterSpacing: '2px',
                gap: 10,
            }}>
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div style={{ padding: "10px 0px" }}>
                    <LaurusText
                        scale={1}
                        color={{
                            a: "rgb(255, 255, 255)",
                            b: "rgb(190, 190, 190)",
                            c: "rgb(163, 163, 163)",
                            d: "rgb(255, 255, 255)",
                            e: "rgb(255, 255, 255)",
                            f: "rgb(155, 114, 215)",
                        }} />
                </div>
                <div className={styles["animated-font"]} style={{ fontSize: 20, justifySelf: 'center', padding: 4 }}>
                    <div >{'beta version'}</div>
                </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
                <input
                    className={dellaRespira.className}
                    id="register-username"
                    placeholder="new username"
                    autoComplete="username"
                    type='text'
                    value={username}
                    onChange={(v) => {
                        setUsername(v.currentTarget.value);
                        setMsg("");
                        buttonBorderRef.current = ButtonBorderColor.purple;
                        setButtonBorder(ButtonBorderColor.purple);
                    }}
                    style={{
                        ...dynamicSizes.input,
                        width: '100%',
                        borderRadius: 10,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        background: 'rgb(25, 25, 25)',
                        boxSizing: "border-box",
                        outline: "none",
                    }}
                    required
                />
                <input
                    className={dellaRespira.className}
                    id="register-email"
                    placeholder="new email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(v) => {
                        setEmail(v.currentTarget.value);
                        setMsg("");
                        buttonBorderRef.current = ButtonBorderColor.purple;
                        setButtonBorder(ButtonBorderColor.purple);
                    }}
                    style={{
                        ...dynamicSizes.input,
                        width: '100%',
                        borderRadius: 10,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        background: 'rgb(25, 25, 25)',
                        boxSizing: "border-box",
                        outline: "none",
                    }}
                    required
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            className={dellaRespira.className}
                            id="register-password-input"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setMsg("");
                                buttonBorderRef.current = ButtonBorderColor.purple;
                                setButtonBorder(ButtonBorderColor.purple);
                            }}
                            placeholder="new password"
                            style={{
                                ...dynamicSizes.input,
                                borderRadius: 10,
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                background: 'rgb(25, 25, 25)',
                                boxSizing: "border-box",
                                outline: "none",
                                width: '100%'
                            }}
                            autoComplete="new-password"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setShowPassword(!showPassword);
                            }}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {showPassword ? <SvgRepo
                                svg={visibility('rgba(67,67,67,1)')}
                                containerSize={{
                                    width: 20,
                                    height: 20
                                }}
                                scale={1} /> : <SvgRepo
                                svg={visibilityOff('rgba(67,67,67,1)')}
                                containerSize={{
                                    width: 20,
                                    height: 20
                                }}
                                scale={1} />}
                        </button>
                    </div>
                </div>
                <div
                    className={dellaRespira.className + ' ' + styles['glowing-border'] + ' ' + (buttonBorder == ButtonBorderColor.white ? '' : styles['animated-button-dark'])}
                    onClick={async () => {
                        if (buttonBorder == ButtonBorderColor.white) return;
                        if (!username) {
                            setMsg("provide a username");
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        if (!email) {
                            setMsg("provide an email");
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        if (!password) {
                            setMsg("provide a password");
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        const confirmed = window.confirm('Becoming a creator this early in the project is subject to further approval. Are you sure you want to continue?');
                        if (confirmed) {
                            const register: Register_V1_0 = {
                                username,
                                email,
                                password
                            }
                            buttonBorderRef.current = ButtonBorderColor.white;
                            setButtonBorder(ButtonBorderColor.white);
                            setMsg("wait a sec");
                            const registerResult = await registerUser(laurusApi, register);
                            if (!registerResult.success) {
                                buttonBorderRef.current = ButtonBorderColor.red;
                                const newMsg = (registerResult.message == EMAIL_ERROR || registerResult.message == USERNAME_ERROR) ?
                                    registerResult.message :
                                    LANDING_ERROR;
                                setMsg(newMsg);
                                setButtonBorder(ButtonBorderColor.red);
                                return;
                            }
                            else {
                                if (registerResult.success) {
                                    setMsg("");
                                    buttonBorderRef.current = ButtonBorderColor.purple;
                                    setButtonBorder(ButtonBorderColor.purple);
                                    onNewUsername(username);
                                    onNewFormType(LandingFormType.login);
                                }
                                else {
                                    setMsg(registerResult.message);
                                    buttonBorderRef.current = ButtonBorderColor.red;
                                    setButtonBorder(ButtonBorderColor.red);
                                }
                            }
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                        cursor: buttonBorder == ButtonBorderColor.white ? 'progress' : 'pointer',
                        '--color-primary': buttonBorderRecord[buttonBorder].p,
                        '--color-secondary': buttonBorderRecord[buttonBorder].s,
                        '--color-tertiary': buttonBorderRecord[buttonBorder].t,
                    } as React.CSSProperties}>
                    {msg ? msg : 'become a creator'}
                </div>
                <div style={{
                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ padding: '0 8px', display: 'grid', placeContent: 'center' }}>{'or'}</div>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div
                    className={`${styles['animated-button-dark']} ${dellaRespira.className}`}
                    onClick={() => {
                        setMsg("");
                        buttonBorderRef.current = ButtonBorderColor.purple;
                        setButtonBorder(ButtonBorderColor.purple);
                        onNewFormType(LandingFormType.login);
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                    }}>
                    {'return to login'}
                </div>
            </div>
        </div>
    </>
}

interface PasswordResetBody {
    laurusApi: string | undefined,
    resolution: LaurusResolution,
    onNewFormType: (newFormType: LandingFormType) => void,
}
function PasswordResetBody({ laurusApi, resolution, onNewFormType }: PasswordResetBody) {

    const [email, setEmail] = useState<string>("");
    const [msg, setMsg] = useState<string>("");
    const buttonBorderRef = useRef<ButtonBorderColor>(ButtonBorderColor.purple);
    const [buttonBorder, setButtonBorder] = useState<ButtonBorderColor>(ButtonBorderColor.purple);
    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                input: { height: 50, fontSize: 14, padding: "8px 35px 8px 12px", },
            }
            case "midhigh": return {
                input: { height: 50, fontSize: 12, padding: "8px 35px 8px 12px", },
            }
            case "midlow":
            case "low": return {
                input: { height: 50, fontSize: 12, padding: "8px 35px 8px 12px", },
            }
        }
    });

    const [, setTimeLeft] = useState<number>(120);
    const [isRunning, setIsRunning] = useState<boolean>(false);

    useEffect(() => {
        if (!isRunning) return;

        const timerId = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerId);
                    setIsRunning(false);
                    if (buttonBorderRef.current == ButtonBorderColor.white) {
                        setMsg("");
                        setButtonBorder(ButtonBorderColor.purple);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerId);
    }, [isRunning]);

    const handleReset = () => {
        setTimeLeft(120);
        setIsRunning(true);
    };
    return <>
        <div
            style={{
                display: 'grid',
                alignContent: 'start',
                justifyContent: 'center',
                position: 'relative',
                letterSpacing: '2px',
                gap: 10,
            }}>
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div style={{ padding: "10px 0px" }}>
                    <LaurusText
                        scale={1}
                        color={{
                            a: "rgb(255, 255, 255)",
                            b: "rgb(190, 190, 190)",
                            c: "rgb(163, 163, 163)",
                            d: "rgb(255, 255, 255)",
                            e: "rgb(255, 255, 255)",
                            f: "rgb(155, 114, 215)",
                        }} />
                </div>
                <div className={styles["animated-font"]} style={{ fontSize: 20, justifySelf: 'center', padding: 4 }}>
                    <div >{'beta version'}</div>
                </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
                <input
                    className={dellaRespira.className}
                    id="reset-password-email"
                    placeholder="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(v) => {
                        buttonBorderRef.current = ButtonBorderColor.purple;
                        setEmail(v.currentTarget.value);
                        setMsg("");
                        setButtonBorder(ButtonBorderColor.purple);
                        setTimeLeft(0);
                        setIsRunning(false);
                    }}
                    style={{
                        ...dynamicSizes.input,
                        width: '100%',
                        borderRadius: 10,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        background: 'rgb(25, 25, 25)',
                        boxSizing: "border-box",
                        outline: "none",
                    }}
                    required
                />
                <div
                    className={dellaRespira.className + ' ' + styles['glowing-border'] + ' ' + (isRunning ? '' : styles['animated-button-dark'])}
                    onClick={async () => {
                        if (isRunning) return;
                        if (!email) {
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setMsg("provide an email");
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        const laurusUser: LaurusUserResult = {
                            username: "",
                            email
                        }
                        const response = await resetPassword(laurusApi, laurusUser);
                        if (!response) {
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setMsg(LANDING_ERROR);
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        if (response.success) {
                            buttonBorderRef.current = ButtonBorderColor.white;
                            handleReset();
                            setMsg("check your email");
                            setButtonBorder(ButtonBorderColor.white);
                        }
                        else {
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setMsg(response.message);
                            setButtonBorder(ButtonBorderColor.red);
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                        cursor: isRunning ? '' : 'pointer',
                        '--color-primary': buttonBorderRecord[buttonBorder].p,
                        '--color-secondary': buttonBorderRecord[buttonBorder].s,
                        '--color-tertiary': buttonBorderRecord[buttonBorder].t,
                    } as React.CSSProperties}>
                    {msg ? msg : 'reset password'}
                </div>
                <div style={{
                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ padding: '0 8px', display: 'grid', placeContent: 'center' }}>{'or'}</div>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div
                    className={`${styles['animated-button-dark']} ${dellaRespira.className}`}
                    onClick={() => {
                        setMsg("");
                        buttonBorderRef.current = ButtonBorderColor.purple;
                        setButtonBorder(ButtonBorderColor.purple);
                        onNewFormType(LandingFormType.login);
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                    }}>
                    {'return to login'}
                </div>
            </div>
        </div>
    </>
}

interface PasswordConfirmationBody {
    resetPasswordToken: string | undefined,
    laurusApi: string | undefined,
    resolution: LaurusResolution,
    onNewFormType: (newFormType: LandingFormType) => void,
}
function PasswordConfirmationBody({ resetPasswordToken, laurusApi, resolution, onNewFormType }: PasswordConfirmationBody) {
    const router = useRouter();
    const [password, setPassword] = useState<string>("");
    const [msg, setMsg] = useState<string>("");
    const buttonBorderRef = useRef<ButtonBorderColor>(ButtonBorderColor.purple);
    const [buttonBorder, setButtonBorder] = useState<ButtonBorderColor>(ButtonBorderColor.purple);
    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                input: { height: 50, fontSize: 14, padding: "8px 35px 8px 12px", },
            }
            case "midhigh": return {
                input: { height: 50, fontSize: 12, padding: "8px 35px 8px 12px", },
            }
            case "midlow":
            case "low": return {
                input: { height: 50, fontSize: 12, padding: "8px 35px 8px 12px", },
            }
        }
    });
    return <>
        <div
            style={{
                display: 'grid',
                alignContent: 'start',
                justifyContent: 'center',
                position: 'relative',
                letterSpacing: '2px',
                gap: 10,
            }}>
            <div style={{ display: 'grid', width: '100%', padding: 24 }}>
                <div style={{ padding: "10px 0px" }}>
                    <LaurusText
                        scale={1}
                        color={{
                            a: "rgb(255, 255, 255)",
                            b: "rgb(190, 190, 190)",
                            c: "rgb(163, 163, 163)",
                            d: "rgb(255, 255, 255)",
                            e: "rgb(255, 255, 255)",
                            f: "rgb(155, 114, 215)",
                        }} />
                </div>
                <div className={styles["animated-font"]} style={{ fontSize: 20, justifySelf: 'center', padding: 4 }}>
                    <div >{'beta version'}</div>
                </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
                <input
                    className={dellaRespira.className}
                    id="passwordConfirmation-password"
                    placeholder="new password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(v) => {
                        setPassword(v.currentTarget.value); setMsg(""); buttonBorderRef.current = ButtonBorderColor.purple;
                        setButtonBorder(ButtonBorderColor.purple);
                    }}
                    style={{
                        ...dynamicSizes.input,
                        width: '100%',
                        borderRadius: 10,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        background: 'rgb(25, 25, 25)',
                        boxSizing: "border-box",
                        outline: "none",
                    }}
                    required
                />
                <div
                    className={dellaRespira.className + ' ' + styles['glowing-border'] + ' ' + styles['animated-button-dark']}
                    onClick={async () => {
                        if (!resetPasswordToken) {
                            setMsg(LANDING_ERROR);
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }

                        if (!password) {
                            setMsg("provide a new password");
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                            return;
                        }
                        const newPassword = {
                            token: resetPasswordToken,
                            new_password: password
                        }
                        const response = await resetPasswordConfirm(laurusApi, newPassword);
                        if (response) {
                            setMsg("login with new password");
                            buttonBorderRef.current = ButtonBorderColor.purple;
                            setButtonBorder(ButtonBorderColor.purple);
                            onNewFormType(LandingFormType.login);
                        }
                        else {
                            setMsg(LANDING_ERROR);
                            buttonBorderRef.current = ButtonBorderColor.red;
                            setButtonBorder(ButtonBorderColor.red);
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                        cursor: 'pointer',
                        '--color-primary': buttonBorderRecord[buttonBorder].p,
                        '--color-secondary': buttonBorderRecord[buttonBorder].s,
                        '--color-tertiary': buttonBorderRecord[buttonBorder].t,
                    } as React.CSSProperties}>
                    {msg ? msg : 'save new password'}
                </div>
                <div style={{
                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ padding: '0 8px', display: 'grid', placeContent: 'center' }}>{'or'}</div>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div
                    className={`${styles['animated-button-dark']} ${dellaRespira.className}`}
                    onClick={async () => {
                        if (resolution.type == 'low') {
                            router.push('/screens?guest=true');
                        }
                        else {
                            router.push('/workspace?guest=true');
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                        height: 50,
                        padding: 10,
                        width: '100%',
                        fontSize: 13,
                        placeContent: 'center',
                    }}>
                    {'continue as a guest'}
                </div>
            </div>
        </div>
    </>
}