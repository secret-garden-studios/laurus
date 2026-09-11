import { dellaRespira } from "./fonts";
import styles from "./app.module.css";
import { Fragment, useEffect, useRef, useState } from "react";
import { SvgRepo, visibility, visibilityOff } from "./svg-repo";
import { LaurusResolution } from "./landing.boot";
import {
  login,
  logout,
  registerUser,
  Register_V1_0,
  resetPassword,
  resetPasswordConfirm,
  setPassword as saveNewPassword,
  EMAIL_ERROR,
  USERNAME_ERROR,
  UNAUTHORIZED_ERROR,
  AWAITING_APPROVAL_ERROR,
  LANDING_ERROR,
  TOO_MANY_ERROR,
  PASSWORD_LENGTH_ERROR,
  MIN_PASSWORD_LENGTH,
  LaurusResetPassword,
  LaurusContact,
  sendContact,
  MAX_CONTACT_LENGTH,
} from "./landing.server";
import {
  ACCOUNT_ACTIVATED,
  ACCOUNT_REQUEST,
  CONTACT_CLICK,
  CONTACT_MESSAGE,
  currentVisitorId,
  FULL_ACCESS_CLICK,
  track,
} from "./analytics/analytics.client";
import { useRouter } from "next/navigation";

export enum LandingFormType {
  login,
  registration,
  passwordReset,
  passwordConfirmation,
  passwordSetup,
  contact,
  none,
}

enum ButtonBorderColor {
  primary,
  red,
  white,
}

const buttonBorderRecord: Record<ButtonBorderColor, { p: string; s: string; t: string }> = {
  [ButtonBorderColor.primary]: {
    p: "rgb(227, 227, 227)",
    s: "rgb(21, 21, 21)",
    t: "rgb(40, 40, 40)",
  },
  [ButtonBorderColor.red]: {
    p: "rgb(255, 95, 109)",
    s: "rgb(21, 21, 21)",
    t: "rgb(40, 40, 40)",
  },
  [ButtonBorderColor.white]: {
    p: "rgb(227, 227, 227)",
    s: "rgb(21, 21, 21)",
    t: "rgb(40, 40, 40)",
  },
};

const laurusTextColor = {
  a: "rgb(255, 255, 255)",
  b: "rgb(190, 190, 190)",
  c: "rgb(163, 163, 163)",
  d: "rgb(255, 255, 255)",
  e: "rgb(255, 255, 255)",
  f: "rgb(199, 199, 199)",
};

function landingSizes(resolution: LaurusResolution) {
  switch (resolution.type) {
    case "high": {
      return {
        footer: { height: 60, gap: 32 },
        link: { fontSize: 12, letterSpacing: 3, textUnderlineOffset: 2 },
        notice: { fontSize: 12, letterSpacing: 3 },
        body: { gap: 10, letterSpacing: 2 },
        header: { padding: 24, laurusPadding: "10px 0px", laurusScale: 1, betaFontSize: 20, betaPadding: 4 },
        form: { gap: 12, width: 280 },
        input: { height: 50, fontSize: 14, padding: "8px 35px 8px 12px", borderRadius: 10 },
        tightField: { fontSize: 14, letterSpacing: 1 },
        textarea: { height: 140, fontSize: 14, padding: "12px", borderRadius: 10, letterSpacing: 1 },
        button: { height: 50, padding: 10, fontSize: 13, borderRadius: 10 },
        divider: { fontSize: 11, ruleHeight: 1, labelPadding: "0 8px" },
        passwordField: { gap: 8 },
        visibilityToggle: { right: 8, svgSize: { width: 20, height: 20 }, svgScale: 1 },
      };
    }
    case "midhigh": {
      return {
        footer: { height: 50, gap: 30 },
        link: { fontSize: 10, letterSpacing: 3, textUnderlineOffset: 2 },
        notice: { fontSize: 10, letterSpacing: 3 },
        body: { gap: 9, letterSpacing: 2 },
        header: { padding: 20, laurusPadding: "9px 0px", laurusScale: 0.85, betaFontSize: 17, betaPadding: 3 },
        form: { gap: 10, width: 260 },
        input: { height: 40, fontSize: 12, padding: "7px 30px 7px 10px", borderRadius: 9 },
        tightField: { fontSize: 11, letterSpacing: 1 },
        textarea: { height: 119, fontSize: 11, padding: "10px", borderRadius: 10, letterSpacing: 1 },
        button: { height: 40, padding: 9, fontSize: 11, borderRadius: 10 },
        divider: { fontSize: 10, ruleHeight: 1, labelPadding: "0 7px" },
        passwordField: { gap: 7 },
        visibilityToggle: { right: 7, svgSize: { width: 17, height: 17 }, svgScale: 0.85 },
      };
    }
    case "midlow": {
      return {
        footer: { height: 44, gap: 32 },
        link: { fontSize: 9, letterSpacing: 3, textUnderlineOffset: 2 },
        notice: { fontSize: 9, letterSpacing: 3 },
        body: { gap: 9, letterSpacing: 2 },
        header: { padding: 20, laurusPadding: "9px 0px", laurusScale: 0.75, betaFontSize: 16, betaPadding: 3 },
        form: { gap: 10, width: 220 },
        input: { height: 38, fontSize: 10, padding: "5px 30px 5px 10px", borderRadius: 9 },
        tightField: { fontSize: 9, letterSpacing: 1 },
        textarea: { height: 120, fontSize: 9, padding: "10px", borderRadius: 9, letterSpacing: 1 },
        button: { height: 38, padding: 9, fontSize: 9, borderRadius: 9 },
        divider: { fontSize: 8, ruleHeight: 1, labelPadding: "0 7px" },
        passwordField: { gap: 7 },
        visibilityToggle: { right: 7, svgSize: { width: 17, height: 17 }, svgScale: 0.85 },
      };
    }
    case "low": {
      return {
        footer: { height: 44, gap: 28 },
        link: { fontSize: 10, letterSpacing: 3, textUnderlineOffset: 2 },
        notice: { fontSize: 10, letterSpacing: 3 },
        body: { gap: 9, letterSpacing: 2 },
        header: { padding: 20, laurusPadding: "9px 0px", laurusScale: 0.85, betaFontSize: 17, betaPadding: 3 },
        form: { gap: 10, width: 292 },
        input: { height: 43, fontSize: 10, padding: "7px 30px 7px 10px", borderRadius: 9 },
        tightField: { fontSize: 9, letterSpacing: 1 },
        textarea: { height: 119, fontSize: 9, padding: "10px", borderRadius: 9, letterSpacing: 1 },
        button: { height: 43, padding: 9, fontSize: 11, borderRadius: 9 },
        divider: { fontSize: 9, ruleHeight: 1, labelPadding: "0 7px" },
        passwordField: { gap: 7 },
        visibilityToggle: { right: 7, svgSize: { width: 17, height: 17 }, svgScale: 0.85 },
      };
    }
  }
}

type LandingSizes = ReturnType<typeof landingSizes>;

type LandingFieldKey = "username" | "email" | "password" | "message";

interface LandingField {
  key: LandingFieldKey;
  id: string;
  placeholder: string;
  type: "text" | "email" | "password" | "textarea";
  autoComplete?: string;
  tight?: boolean;
}

interface LandingFormSpec {
  fields: LandingField[];
  primary: string;
  secondary: "guest" | "return" | "none";
}

function landingFormSpec(formType: LandingFormType): LandingFormSpec {
  switch (formType) {
    case LandingFormType.login:
      return {
        fields: [
          { key: "username", id: "username", placeholder: "username", type: "text", autoComplete: "username" },
          {
            key: "password",
            id: "password-input",
            placeholder: "password",
            type: "password",
            autoComplete: "current-password",
          },
        ],
        primary: "login",
        secondary: "guest",
      };
    case LandingFormType.registration:
      return {
        fields: [
          {
            key: "username",
            id: "register-username",
            placeholder: "your new username",
            type: "text",
            autoComplete: "username",
          },
          { key: "email", id: "register-email", placeholder: "email", type: "email", autoComplete: "email" },
        ],
        primary: "request account",
        secondary: "return",
      };
    case LandingFormType.passwordReset:
      return {
        fields: [
          {
            key: "username",
            id: "reset-password-username",
            placeholder: "username",
            type: "text",
            autoComplete: "username",
          },
          { key: "email", id: "reset-password-email", placeholder: "email", type: "email", autoComplete: "email" },
        ],
        primary: "reset password",
        secondary: "return",
      };
    case LandingFormType.passwordConfirmation:
    case LandingFormType.passwordSetup:
      return {
        fields: [
          {
            key: "password",
            id: "passwordConfirmation-password",
            placeholder: "new password",
            type: "password",
            autoComplete: "new-password",
          },
        ],
        primary: "save password",
        secondary: "guest",
      };
    case LandingFormType.contact:
      return {
        fields: [
          {
            key: "email",
            id: "contact-email",
            placeholder: "email",
            type: "email",
            autoComplete: "email",
            tight: true,
          },
          {
            key: "message",
            id: "contact-message",
            placeholder: "tell us what's on your mind...",
            type: "textarea",
          },
        ],
        primary: "send",
        secondary: "return",
      };
    case LandingFormType.none:
      return { fields: [], primary: "", secondary: "none" };
  }
}

interface Landing {
  laurusApi: string | undefined;
  resolution: LaurusResolution;
  resetPasswordToken: string | undefined;
  setPasswordToken: string | undefined;
  formInit: LandingFormType;
}
export default function Landing({ laurusApi, resolution, resetPasswordToken, setPasswordToken, formInit }: Landing) {
  const [formType, setFormType] = useState<LandingFormType>(formInit);
  const [newUsername, setNewUsername] = useState("");
  const [dynamicSizes] = useState(() => landingSizes(resolution));

  const form = (
    <LandingForm
      key={resolution.type == "low" ? "lowRes" : formType}
      formType={resolution.type == "low" ? LandingFormType.none : formType}
      dynamicSizes={dynamicSizes}
      laurusApi={laurusApi}
      resolution={resolution}
      token={formType == LandingFormType.passwordSetup ? setPasswordToken : resetPasswordToken}
      newUsername={newUsername}
      onNewFormType={(newFormType) => {
        if (formType != LandingFormType.registration) setNewUsername("");
        setFormType(newFormType);
      }}
      onNewUsername={(claimed) => {
        alert("We received your account request! Keep an eye out for an email from us.");
        setNewUsername(claimed);
      }}
    />
  );

  return (
    <>
      <div
        className={styles[`${resolution.type == "high" ? "noisy-background-20-3" : "noisy-background-20-3-low-res"}`]}
        style={{
          display: "grid",
          height: "100vh",
          width: "100vw",
          gridTemplateRows: `auto min-content`,
          color: "rgb(227,227,227)",
          overflow: "auto",
        }}
      >
        <div
          style={{
            alignSelf: "center",
          }}
        >
          {resolution.type != "low" && formType == LandingFormType.none ? <></> : form}
        </div>
        <div
          style={{
            height: dynamicSizes.footer.height,
            boxSizing: "border-box",
            width: "100%",
            display: "flex",
            gap: dynamicSizes.footer.gap,
            backgroundColor: resolution.type != "low" ? "rgb(23, 23, 23)" : undefined,
            borderTop: resolution.type != "low" ? "1px solid rgba(255, 255, 255, 0.1)" : undefined,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {resolution.type != "low" && formType == LandingFormType.login ? (
            <>
              {(
                [
                  { label: "full access", event: FULL_ACCESS_CLICK, form: LandingFormType.registration },
                  { label: "reset password", event: undefined, form: LandingFormType.passwordReset },
                  { label: "contact", event: CONTACT_CLICK, form: LandingFormType.contact },
                ] as const
              ).map((link) => (
                <div
                  key={link.label}
                  className={styles["underline-on-hover"]}
                  onClick={() => {
                    if (link.event) void track(laurusApi, link.event, window.location.pathname);
                    setNewUsername("");
                    setFormType(link.form);
                  }}
                  style={{
                    cursor: "pointer",
                    fontSize: dynamicSizes.link.fontSize,
                    letterSpacing: `${dynamicSizes.link.letterSpacing}px`,
                    textUnderlineOffset: dynamicSizes.link.textUnderlineOffset,
                    textDecorationColor: "rgba(255,255,255,0.4)",
                  }}
                >
                  {link.label}
                </div>
              ))}
            </>
          ) : resolution.type == "low" ? (
            <div
              style={{
                fontSize: dynamicSizes.link.fontSize,
                letterSpacing: `${dynamicSizes.link.letterSpacing}px`,
              }}
            >
              {"designed for desktop"}
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
    </>
  );
}

interface LandingForm {
  formType: LandingFormType;
  dynamicSizes: LandingSizes;
  laurusApi: string | undefined;
  resolution: LaurusResolution;
  token: string | undefined;
  newUsername: string;
  onNewFormType: (newFormType: LandingFormType) => void;
  onNewUsername: (newUsername: string) => void;
}
function LandingForm({
  formType,
  dynamicSizes,
  laurusApi,
  resolution,
  token,
  newUsername,
  onNewFormType,
  onNewUsername,
}: LandingForm) {
  const router = useRouter();
  const spec = landingFormSpec(formType);
  const [values, setValues] = useState<Record<LandingFieldKey, string>>({
    username: newUsername ? newUsername : "",
    email: "",
    password: "",
    message: "",
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  const buttonBorderRef = useRef<ButtonBorderColor>(ButtonBorderColor.primary);
  const [buttonBorder, setButtonBorder] = useState<ButtonBorderColor>(ButtonBorderColor.primary);
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
            setButtonBorder(ButtonBorderColor.primary);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [isRunning]);

  const busy = buttonBorder == ButtonBorderColor.white;
  const setBorder = (color: ButtonBorderColor) => {
    buttonBorderRef.current = color;
    setButtonBorder(color);
  };
  const reject = (reason: string) => {
    setMsg(reason);
    setBorder(ButtonBorderColor.red);
  };
  const toGuestWorkspace = async () => {
    await logout(laurusApi);
    router.push(resolution.type == "low" ? "/screens?guest=true" : "/workspace?guest=true");
  };

  const primaryState = (() => {
    switch (formType) {
      case LandingFormType.login:
        return { guard: false, dimmed: false, cursor: "pointer" };
      case LandingFormType.passwordReset:
        return { guard: isRunning, dimmed: isRunning, cursor: isRunning ? "" : "pointer" };
      case LandingFormType.passwordConfirmation:
      case LandingFormType.passwordSetup:
        return { guard: busy, dimmed: false, cursor: busy ? "progress" : "pointer" };
      case LandingFormType.contact:
        return { guard: busy, dimmed: busy, cursor: busy ? (sent ? "default" : "progress") : "pointer" };
      case LandingFormType.registration:
      case LandingFormType.none:
        return { guard: busy, dimmed: busy, cursor: busy ? "progress" : "pointer" };
    }
  })();

  const submit = async () => {
    switch (formType) {
      case LandingFormType.login: {
        if (!values.username) return reject("provide a username");
        if (!values.password) return reject("provide a password");
        const loginResult = await login(laurusApi, values.username, values.password);
        if (!loginResult.success) {
          return reject(
            loginResult.message == UNAUTHORIZED_ERROR
              ? "try different credentials"
              : loginResult.message == AWAITING_APPROVAL_ERROR || loginResult.message == TOO_MANY_ERROR
                ? loginResult.message
                : LANDING_ERROR,
          );
        }
        router.push(resolution.type == "low" ? "/screens" : "/workspace");
        return;
      }
      case LandingFormType.registration: {
        if (!values.username) return reject("provide a username");
        if (!values.email) return reject("provide an email");
        const confirmed = window.confirm(
          "Gaining full access to Laurus is subject to further approval. Your username will be claimed now, but you will not be able to make any animations until we approve you. Are you sure you want to continue?",
        );
        if (!confirmed) return;
        void track(laurusApi, ACCOUNT_REQUEST, window.location.pathname);
        const register: Register_V1_0 = {
          username: values.username,
          email: values.email,
          visitor_id: currentVisitorId(),
        };
        setBorder(ButtonBorderColor.white);
        setMsg("wait a sec");
        const registerResult = await registerUser(laurusApi, register);
        if (!registerResult.success) {
          return reject(
            registerResult.message == EMAIL_ERROR ||
              registerResult.message == USERNAME_ERROR ||
              registerResult.message == TOO_MANY_ERROR
              ? registerResult.message
              : LANDING_ERROR,
          );
        }
        setMsg("");
        setBorder(ButtonBorderColor.primary);
        onNewUsername(values.username);
        onNewFormType(LandingFormType.login);
        return;
      }
      case LandingFormType.passwordReset: {
        if (!values.username) return reject("provide a username");
        if (!values.email) return reject("provide an email");
        const laurusUser: LaurusResetPassword = {
          username: values.username,
          email: values.email,
          visitor_id: currentVisitorId(),
        };
        const response = await resetPassword(laurusApi, laurusUser);
        if (!response) return reject(LANDING_ERROR);
        if (!response.success) return reject(response.message);
        setBorder(ButtonBorderColor.white);
        setTimeLeft(120);
        setIsRunning(true);
        setMsg("check your email");
        return;
      }
      case LandingFormType.passwordConfirmation:
      case LandingFormType.passwordSetup: {
        if (!token) return reject(LANDING_ERROR);
        if (!values.password) return reject("provide a new password");
        if (values.password.length < MIN_PASSWORD_LENGTH) return reject(PASSWORD_LENGTH_ERROR);
        const newPassword = {
          token,
          new_password: values.password,
        };
        setBorder(ButtonBorderColor.white);
        setMsg("wait a sec");
        const setup = formType == LandingFormType.passwordSetup;
        const response = setup
          ? await saveNewPassword(laurusApi, newPassword)
          : await resetPasswordConfirm(laurusApi, newPassword);
        if (!response) return reject(LANDING_ERROR);
        if (setup) {
          void track(laurusApi, ACCOUNT_ACTIVATED, window.location.pathname);
        }
        setMsg("login with new password");
        setBorder(ButtonBorderColor.primary);
        onNewFormType(LandingFormType.login);
        return;
      }
      case LandingFormType.contact: {
        if (!values.email) return reject("provide an email");
        if (!values.message.trim()) return reject("write something first");
        const contact: LaurusContact = {
          email: values.email,
          message: values.message.trim(),
          visitor_id: currentVisitorId(),
        };
        setBorder(ButtonBorderColor.white);
        setMsg("wait a sec");
        const contactResult = await sendContact(laurusApi, contact);
        if (!contactResult.success) {
          return reject(contactResult.message ? contactResult.message : LANDING_ERROR);
        }
        void track(laurusApi, CONTACT_MESSAGE, window.location.pathname);
        setValues((previous) => ({ ...previous, message: "" }));
        setSent(true);
        setMsg("message sent");
        setBorder(ButtonBorderColor.white);
        return;
      }
      case LandingFormType.none:
        return;
    }
  };

  const onFieldChange = (key: LandingFieldKey, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setMsg("");
    setSent(false);
    setBorder(ButtonBorderColor.primary);
    setTimeLeft(0);
    setIsRunning(false);
  };

  const fieldStyle = (field: LandingField): React.CSSProperties => ({
    ...(field.type == "textarea" ? dynamicSizes.textarea : dynamicSizes.input),
    ...(field.tight ? dynamicSizes.tightField : {}),
    width: dynamicSizes.form.width,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background: "rgb(25, 25, 25)",
    boxSizing: "border-box",
    outline: "none",
  });

  return (
    <div
      style={{
        display: "grid",
        justifyContent: "center",
        letterSpacing: `${dynamicSizes.body.letterSpacing}px`,
        gap: dynamicSizes.body.gap,
      }}
    >
      <div
        style={{
          display: "grid",
          padding: dynamicSizes.header.padding,
          alignContent: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ padding: dynamicSizes.header.laurusPadding }}>
          <LaurusText scale={dynamicSizes.header.laurusScale} color={laurusTextColor} />
        </div>
        <div
          className={styles["animated-font"]}
          style={{
            fontSize: dynamicSizes.header.betaFontSize,
            justifySelf: "center",
            padding: dynamicSizes.header.betaPadding,
          }}
        >
          <div>{"beta version"}</div>
        </div>
      </div>
      {spec.fields.length == 0 ? null : (
        <div style={{ display: "grid", gap: dynamicSizes.form.gap, alignContent: "start", justifyContent: "center" }}>
          {spec.fields.map((field) =>
            field.type == "textarea" ? (
              <textarea
                key={field.key}
                className={dellaRespira.className}
                id={field.id}
                placeholder={field.placeholder}
                value={values[field.key]}
                maxLength={MAX_CONTACT_LENGTH}
                onChange={(v) => onFieldChange(field.key, v.currentTarget.value)}
                style={{ ...fieldStyle(field), color: "rgb(227, 227, 227)", resize: "none" }}
                required
              />
            ) : field.type == "password" ? (
              <div
                key={field.key}
                style={{ display: "flex", flexDirection: "column", gap: dynamicSizes.passwordField.gap }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    className={dellaRespira.className}
                    id={field.id}
                    placeholder={field.placeholder}
                    type={showPassword ? "text" : "password"}
                    autoComplete={field.autoComplete}
                    value={values[field.key]}
                    onChange={(v) => onFieldChange(field.key, v.currentTarget.value)}
                    style={fieldStyle(field)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword(!showPassword);
                    }}
                    style={{
                      position: "absolute",
                      right: dynamicSizes.visibilityToggle.right,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <SvgRepo
                      svg={(showPassword ? visibility : visibilityOff)("rgba(67,67,67,1)")}
                      containerStyle={dynamicSizes.visibilityToggle.svgSize}
                      scale={dynamicSizes.visibilityToggle.svgScale}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <input
                key={field.key}
                className={dellaRespira.className}
                id={field.id}
                placeholder={field.placeholder}
                type={field.type}
                autoComplete={field.autoComplete}
                value={values[field.key]}
                onChange={(v) => onFieldChange(field.key, v.currentTarget.value)}
                style={fieldStyle(field)}
                required
              />
            ),
          )}
          <div
            className={
              dellaRespira.className +
              " " +
              styles["glowing-border"] +
              " " +
              (primaryState.dimmed ? "" : styles["animated-button-dark"])
            }
            onClick={async () => {
              if (primaryState.guard) return;
              await submit();
            }}
            style={
              {
                display: "grid",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: dynamicSizes.button.borderRadius,
                height: dynamicSizes.button.height,
                padding: dynamicSizes.button.padding,
                width: dynamicSizes.form.width,
                fontSize: dynamicSizes.button.fontSize,
                placeContent: "center",
                cursor: primaryState.cursor,
                "--color-primary": buttonBorderRecord[buttonBorder].p,
                "--color-secondary": buttonBorderRecord[buttonBorder].s,
                "--color-tertiary": buttonBorderRecord[buttonBorder].t,
              } as React.CSSProperties
            }
          >
            {msg ? msg : spec.primary}
          </div>
          <div
            style={{
              fontSize: dynamicSizes.divider.fontSize,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                height: dynamicSizes.divider.ruleHeight,
                width: "100%",
                background: "rgba(255,255,255,0.05)",
              }}
            />
            <div
              style={{
                padding: dynamicSizes.divider.labelPadding,
                display: "grid",
                placeContent: "center",
              }}
            >
              {"or"}
            </div>
            <div
              style={{
                height: dynamicSizes.divider.ruleHeight,
                width: "100%",
                background: "rgba(255,255,255,0.05)",
              }}
            />
          </div>
          <div
            className={`${styles["animated-button-dark"]} ${dellaRespira.className}`}
            onClick={async () => {
              if (spec.secondary == "guest") {
                await toGuestWorkspace();
                return;
              }
              setMsg("");
              setBorder(ButtonBorderColor.primary);
              onNewFormType(LandingFormType.login);
            }}
            style={{
              display: "grid",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: dynamicSizes.button.borderRadius,
              height: dynamicSizes.button.height,
              padding: dynamicSizes.button.padding,
              width: dynamicSizes.form.width,
              fontSize: dynamicSizes.button.fontSize,
              placeContent: "center",
            }}
          >
            {spec.secondary == "guest" ? "continue as a guest" : "return to login"}
          </div>
        </div>
      )}
    </div>
  );
}

const laurusGlyphs = [
  {
    id: "l1",
    label: "L",
    duration: "4s",
    transform: "translate(-93.096801,-104.74799)",
    d: "M 100.73622,118.7092 H 93.229092 V 104.88028 H 94.868807 V 118.51164 H 100.73622 Z",
  },
  {
    id: "a1",
    label: "a",
    duration: "4.1s",
    transform: "translate(-92.020125,-116.40941)",
    d: "M 100.41026,126.49852 Q 99.066876,126.49852 98.572986,125.98487 98.118608,125.55025 98.118608,125.23416 V 124.81929 Q 97.150583,126.57754 95.016978,126.57754 92.527773,126.57754 92.191928,124.3254 92.152416,124.08834 92.152416,123.85127 92.152416,123.59445 92.231439,123.29811 92.310461,123.00178 92.685818,122.64618 93.43653,121.93498 95.985003,121.77693 96.617182,121.71766 97.150583,121.71766 97.683984,121.71766 98.118608,121.75718 V 118.47775 Q 98.079096,118.45799 98.118608,118.29995 98.158119,118.12215 98.039585,117.86532 97.940807,117.58874 97.763007,117.33192 97.585206,117.0751 97.130828,116.8973 96.676449,116.69974 95.945492,116.69974 95.214534,116.69974 94.226754,116.97632 93.25873,117.23314 92.804351,117.48997 L 92.725329,117.35168 Q 94.483577,116.5417 96.301092,116.5417 98.335919,116.5417 98.987854,117.27265 99.5015,117.84557 99.5015,118.47775 V 125.09587 Q 99.5015,125.66878 99.718811,125.98487 99.955878,126.28121 100.19295,126.30096 L 100.41026,126.34048 H 101.02268 V 126.49852 Z M 95.333068,126.4195 Q 96.380115,126.4195 97.20985,125.7083 98.059341,124.97734 98.118608,124.30565 V 121.91522 Q 97.585206,121.87571 97.03205,121.87571 96.498648,121.87571 95.965247,121.93498 94.463822,122.11278 94.009443,122.60667 93.555064,123.10056 93.555064,123.9698 93.555064,124.12785 93.57482,124.3254 93.75262,126.4195 95.333068,126.4195 Z",
  },
  {
    id: "u1",
    label: "u",
    duration: "4.2s",
    transform: "translate(-96.100212,-121.16201)",
    d: "M 97.615395,128.90021 Q 97.615395,130.4609 98.44513,130.89553 98.840242,131.09308 99.452666,131.09308 100.69727,131.09308 101.66529,130.14481 102.65307,129.19654 102.7321,128.38656 V 121.2943 H 104.11499 V 129.76946 Q 104.11499,130.34237 104.3323,130.65846 104.56937,130.95479 104.80643,130.97455 L 105.02375,131.01406 H 105.63617 V 131.1721 H 104.43108 Q 103.6211,131.1721 103.18647,130.8165 102.77161,130.4609 102.75185,130.1053 L 102.7321,129.76946 V 128.91997 Q 102.37649,129.76946 101.46774,130.52017 100.55898,131.25113 99.472422,131.25113 98.405619,131.25113 97.714173,131.05357 97.042483,130.83626 96.746149,130.4609 96.232503,129.84848 96.232503,128.88045 V 121.2943 H 97.615395 Z",
  },
  {
    id: "r1",
    label: "r",
    duration: "4.3s",
    transform: "translate(-102.42338,-115.47468)",
    d: "M 106.32899,116.53549 V 116.12062 Q 105.43999,116.47622 104.70903,117.56278 103.97807,118.62958 103.93856,119.57785 V 125.5638 H 102.55567 V 115.686 H 103.93856 V 118.82714 Q 104.25465,117.68131 105.14365,116.67378 106.03266,115.64649 107.15873,115.60697 H 107.23775 Q 107.63286,115.60697 107.88968,115.88355 108.16626,116.14038 108.16626,116.53549 108.16626,116.9306 107.88968,117.18742 107.63286,117.44425 107.23775,117.44425 106.84264,117.44425 106.58581,117.18742 106.32899,116.9306 106.32899,116.53549 Z",
  },
  {
    id: "u2",
    label: "u",
    duration: "4.4s",
    transform: "translate(-96.100212,-121.16201)",
    d: "M 97.615395,128.90021 Q 97.615395,130.4609 98.44513,130.89553 98.840242,131.09308 99.452666,131.09308 100.69727,131.09308 101.66529,130.14481 102.65307,129.19654 102.7321,128.38656 V 121.2943 H 104.11499 V 129.76946 Q 104.11499,130.34237 104.3323,130.65846 104.56937,130.95479 104.80643,130.97455 L 105.02375,131.01406 H 105.63617 V 131.1721 H 104.43108 Q 103.6211,131.1721 103.18647,130.8165 102.77161,130.4609 102.75185,130.1053 L 102.7321,129.76946 V 128.91997 Q 102.37649,129.76946 101.46774,130.52017 100.55898,131.25113 99.472422,131.25113 98.405619,131.25113 97.714173,131.05357 97.042483,130.83626 96.746149,130.4609 96.232503,129.84848 96.232503,128.88045 V 121.2943 H 97.615395 Z",
  },
  {
    id: "s1",
    label: "s",
    duration: "4.5s",
    transform: "translate(-103.26017,-112.98211)",
    d: "M 109.25988,113.88487 Q 108.94379,113.62804 108.23258,113.45024 107.54114,113.27244 107.18554,113.27244 106.82994,113.27244 106.77067,113.27244 105.70387,113.2922 105.22973,113.8256 104.7556,114.33925 104.7556,114.99118 104.7556,115.64311 105.17047,116.09749 105.58533,116.53212 106.19776,116.78894 106.82994,117.02601 107.54114,117.3421 108.2721,117.65819 108.88452,117.99403 109.5167,118.31012 109.93157,118.9423 110.34643,119.55472 110.34643,120.48324 110.34643,121.41175 109.6945,122.06368 109.04256,122.71562 108.23258,122.93293 107.44236,123.15024 106.51385,123.15024 104.49878,123.15024 103.49124,122.26124 L 103.60977,122.14271 Q 104.00489,122.51806 104.77535,122.75513 105.56558,122.9922 106.29654,122.9922 107.46212,122.9922 108.21283,122.36002 108.9833,121.70808 108.9833,120.75982 108.9833,119.79179 108.41039,119.21888 107.83747,118.62621 107.00774,118.31012 106.19776,117.97428 105.36802,117.65819 104.53829,117.32234 103.96538,116.74943 103.39246,116.15676 103.39246,115.38629 103.39246,114.61582 103.74806,114.14169 104.10366,113.6478 104.69633,113.45024 105.70387,113.1144 106.7114,113.1144 108.41039,113.1144 109.35865,113.74658 Z",
  },
] as const;

interface LaurusText {
  scale: number;
  color: { a: string; b: string; c: string; d: string; e: string; f: string };
}
function LaurusText({ scale, color }: LaurusText) {
  const [dynamicSizes] = useState(() => ({
    path: { strokeWidth: 0.175, strokeOpacity: 1, fillOpacity: 1 },
    filter: {
      region: { x: -250, y: -250, width: 600, height: 600 },
      coreBlur: 0.25,
      haloBlur: 0.6,
      haloBlurLow: 0.5,
      haloBlurHigh: 1,
      haloSlope: 1.1,
    },
    glyph: {
      l1: { width: 7.7717109, height: 14.093503, paddingLeft: 0 },
      a1: { width: 9.1348467, height: 10.300423, paddingLeft: 0 },
      u1: { width: 9.6682501, height: 10.221413, paddingLeft: "1mm" },
      r1: { width: 5.8751731, height: 10.221413, paddingLeft: "1mm" },
      u2: { width: 9.6682501, height: 10.221413, paddingLeft: "1mm" },
      s1: { width: 7.2185531, height: 10.300423, paddingLeft: "1mm" },
    },
  }));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "end",
        justifyContent: "center",
      }}
    >
      {laurusGlyphs.map((glyph, index) => {
        const { width, height, paddingLeft } = dynamicSizes.glyph[glyph.id];
        const gradientId = `${glyph.id}lg`;
        const strokeGradientId = `${glyph.id}slg`;
        const filterId = `${glyph.id}f`;
        return (
          <Fragment key={glyph.id}>
            {index == 1 ? <div className="race-track-path" aria-label="L-shaped animated gradient" /> : null}
            <div style={{ display: "grid", placeContent: "center", paddingLeft: paddingLeft }}>
              <svg
                style={{ overflow: "visible" }}
                width={`${scale * width}mm`}
                height={`${scale * height}mm`}
                viewBox={`0 0 ${width} ${height}`}
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={color.a} />
                    <stop offset="50%" stopColor={color.b} />
                    <stop offset="100%" stopColor={color.c} />
                    <animateTransform
                      attributeName="gradientTransform"
                      type="rotate"
                      from="0 0.5 0.5"
                      to="360 0.5 0.5"
                      dur={glyph.duration}
                      repeatCount="indefinite"
                    />
                  </linearGradient>
                  <linearGradient id={strokeGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={color.d} />
                    <stop offset="50%" stopColor={color.e} />
                    <stop offset="100%" stopColor={color.f} />
                    <animateTransform
                      attributeName="gradientTransform"
                      type="rotate"
                      from="0 0.5 0.5"
                      to="360 0.5 0.5"
                      dur={glyph.duration}
                      repeatCount="indefinite"
                    />
                  </linearGradient>

                  <filter
                    id={filterId}
                    x={`${dynamicSizes.filter.region.x}%`}
                    y={`${dynamicSizes.filter.region.y}%`}
                    width={`${dynamicSizes.filter.region.width}%`}
                    height={`${dynamicSizes.filter.region.height}%`}
                  >
                    <feGaussianBlur in="SourceGraphic" stdDeviation={dynamicSizes.filter.coreBlur} result="core" />
                    <feGaussianBlur in="SourceGraphic" stdDeviation={dynamicSizes.filter.haloBlur} result="halo">
                      <animate
                        attributeName="stdDeviation"
                        values={`${dynamicSizes.filter.haloBlurLow}; ${dynamicSizes.filter.haloBlurHigh}; ${dynamicSizes.filter.haloBlurLow}`}
                        dur="3s"
                        calcMode="spline"
                        keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
                        repeatCount="indefinite"
                      />
                    </feGaussianBlur>
                    <feComponentTransfer in="halo" result="gentleHalo">
                      <feFuncA type="linear" slope={dynamicSizes.filter.haloSlope} />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode in="gentleHalo" />
                      <feMergeNode in="core" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  transform={glyph.transform}
                  stroke={`url(#${strokeGradientId})`}
                  fill={`url(#${gradientId})`}
                  filter={`url(#${filterId})`}
                  strokeWidth={dynamicSizes.path.strokeWidth}
                  strokeOpacity={dynamicSizes.path.strokeOpacity}
                  fillOpacity={dynamicSizes.path.fillOpacity}
                  d={glyph.d}
                  aria-label={glyph.label}
                />
              </svg>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
