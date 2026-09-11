import {
  forgetAccessToken,
  freshAccessToken,
  LaurusToken,
  rememberAccessToken,
  renewRefusedAccessToken,
  Token_V1_0,
} from "./auth-session";

export type { LaurusToken, Token_V1_0 } from "./auth-session";
export { exchangeRefreshCookie } from "./auth-session";

export const LANDING_ERROR = "try again later";
export const EMAIL_ERROR = "try another email";
export const USERNAME_ERROR = "try another username";
export const UNAUTHORIZED_ERROR = "Unauthorized";
export const AWAITING_APPROVAL_ERROR = "awaiting approval";
export const TOO_MANY_ERROR = "too many requests";
export const PASSWORD_LENGTH_ERROR = "8 characters or more";
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_CONTACT_LENGTH = 4000;
export const UNAUTHORIZED_EDIT = "You need to be logged in to do that!";
export const FORBIDDEN_ACTION = "You don't have permission to do that!";
export const FORBIDDEN_NAV = "You shouldn't be on this page!";

export interface AuthResponse {
  response: Response;
  newToken: string | undefined;
}
export async function authFetch(
  baseUrl: string | undefined,
  accessToken: string | undefined,
  body: BodyInit | null | undefined,
  url: string,
  method: string,
): Promise<AuthResponse> {
  const token = await freshAccessToken(baseUrl, accessToken);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });
  if (response.status != 401) {
    return { response, newToken: undefined };
  }
  return { response, newToken: await renewRefusedAccessToken(baseUrl, token) };
}
export interface Register_V1_0 {
  username: string;
  email: string;
  visitor_id: string | null;
}
export interface RegisterResult_V1_0 {
  success: boolean;
  message: string;
  detail: string;
  username: string;
  email: string;
}
export type LaurusUserResult = UserResult_V1_0;
export interface UserResult_V1_0 {
  username: string;
  email: string;
  role: string;
}
export type LaurusResetPassword = ResetPassword_V1_0;
export interface ResetPassword_V1_0 {
  username: string;
  email: string;
  visitor_id: string | null;
}
export interface ResetPasswordResult_V1_0 {
  success: boolean;
  message: string;
  detail: string;
  username: string;
  email: string;
}
export interface ValidationError_V1_0 {
  field: string;
  message: string;
}
export async function registerUser(baseUrl: string | undefined, register: Register_V1_0): Promise<RegisterResult_V1_0> {
  try {
    const url = `${baseUrl}/register`;
    const body = JSON.stringify(register);
    const raw_response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!raw_response.ok) {
      if (raw_response.status == 422) {
        const errorData = await raw_response.json();
        const emailError = errorData.errors?.find((e: ValidationError_V1_0) => e.field === "email");
        if (emailError) {
          const newResponse: RegisterResult_V1_0 = {
            success: false,
            message: EMAIL_ERROR,
            detail: "",
            username: register.username,
            email: register.email,
          };
          return newResponse;
        }
      }
      return {
        success: false,
        message: raw_response.statusText,
        detail: "",
        username: register.username,
        email: register.email,
      };
    }

    const response: RegisterResult_V1_0 = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return {
      success: false,
      message: "unknown error",
      detail: "",
      username: register.username,
      email: register.email,
    };
  }
}
function loginError(status: number): string {
  switch (status) {
    case 401:
      return UNAUTHORIZED_ERROR;
    case 403:
      return AWAITING_APPROVAL_ERROR;
    case 429:
      return TOO_MANY_ERROR;
    default:
      return LANDING_ERROR;
  }
}

export async function login(baseUrl: string | undefined, username: string, password: string): Promise<LaurusToken> {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);
  formData.append("grant_type", "password");
  const url = `${baseUrl}/login`;
  try {
    const raw_response = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!raw_response.ok) {
      return {
        success: false,
        message: loginError(raw_response.status),
        access_token: "",
        token_type: "",
      };
    }
    const response: Token_V1_0 = await raw_response.json();
    rememberAccessToken(response.access_token);
    return { ...response, success: true, message: "" };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      message: "unknown error",
      access_token: "",
      token_type: "",
    };
  }
}

export async function logout(baseUrl: string | undefined): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      credentials: "include",
    });
    forgetAccessToken();
    return response.ok;
  } catch (error) {
    console.log({ error });
    forgetAccessToken();
    return false;
  }
}
export async function getMe(baseUrl: string | undefined, accessToken: string): Promise<UserResult_V1_0 | undefined> {
  try {
    const url = `${baseUrl}/users/me`;
    let response: Response | undefined = undefined;
    const authResponse = await authFetch(baseUrl, accessToken, undefined, url, "GET");
    if (authResponse.newToken) {
      const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, "GET");
      response = authResponse2.response;
    } else {
      response = authResponse.response;
    }
    if (!response.ok) {
      return undefined;
    }
    const result: UserResult_V1_0 = await response.json();
    return result;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}
export async function resetPassword(
  baseUrl: string | undefined,
  resetPassword: ResetPassword_V1_0,
): Promise<ResetPasswordResult_V1_0 | undefined> {
  try {
    const url = `${baseUrl}/reset-password`;
    const body = JSON.stringify(resetPassword);
    const raw_response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!raw_response.ok) {
      if (raw_response.status == 422) {
        const errorData = await raw_response.json();
        const emailError: ValidationError_V1_0 = errorData.errors?.find(
          (e: ValidationError_V1_0) => e.field === "email",
        );
        if (emailError) {
          const newResponse: ResetPasswordResult_V1_0 = {
            success: false,
            message: EMAIL_ERROR,
            detail: "",
            username: resetPassword.username,
            email: resetPassword.email,
          };
          return newResponse;
        }
      }
      return undefined;
    }
    const response: ResetPasswordResult_V1_0 = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return undefined;
  }
}

export async function resetPasswordConfirm(
  baseUrl: string | undefined,
  newPassword: { token: string; new_password: string },
) {
  try {
    const url = `${baseUrl}/reset-password-confirm`;
    const body = JSON.stringify(newPassword);
    const raw_response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    return raw_response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export async function setPassword(
  baseUrl: string | undefined,
  newPassword: { token: string; new_password: string },
): Promise<boolean> {
  try {
    const url = `${baseUrl}/set-password`;
    const raw_response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newPassword),
    });
    return raw_response.ok;
  } catch (error) {
    console.log({ error });
    return false;
  }
}

export type LaurusContact = Contact_V1_0;
export interface Contact_V1_0 {
  email: string;
  message: string;
  visitor_id: string | null;
}
export interface ContactResult_V1_0 {
  success: boolean;
  message: string;
}
export async function sendContact(baseUrl: string | undefined, contact: Contact_V1_0): Promise<ContactResult_V1_0> {
  try {
    const url = `${baseUrl}/contact`;
    const raw_response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contact),
    });

    if (!raw_response.ok) {
      if (raw_response.status == 429) {
        return { success: false, message: TOO_MANY_ERROR };
      }
      if (raw_response.status == 422) {
        const errorData = await raw_response.json();
        const emailError = errorData.errors?.find((e: ValidationError_V1_0) => e.field === "email");
        if (emailError) {
          return { success: false, message: EMAIL_ERROR };
        }
      }
      return { success: false, message: LANDING_ERROR };
    }

    const response: ContactResult_V1_0 = await raw_response.json();
    return response;
  } catch (error) {
    console.log({ error });
    return { success: false, message: LANDING_ERROR };
  }
}
