

export const LANDING_ERROR = "try again later";
export const EMAIL_ERROR = "try another email";
export const USERNAME_ERROR = "try another username";
export const UNAUTHORIZED_ERROR = "unauthorized";
export const UNAUTHORIZED_EDIT = "You need to be logged in to do that!";
export const FORBIDDEN_ACTION = "You don't have permission to do that!";

export interface AuthResponse {
    response: Response,
    newToken: string | undefined,
}
export async function authFetch(
    baseUrl: string | undefined,
    accessToken: string | undefined,
    body: string | undefined,
    url: string,
    method: string): Promise<AuthResponse> {
    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body,
    });
    if (response.status == 401) {
        const newToken = await refreshAccessToken(baseUrl);
        if (newToken.success) {
            return {
                response,
                newToken: newToken.access_token,
            }
        }
        else {
            return {
                response,
                newToken: undefined,
            };
        }
    }
    else {
        return {
            response,
            newToken: undefined,
        };
    }
}
export interface Register_V1_0 {
    username: string
    email: string
    password: string
}
export interface RegisterResult_V1_0 {
    success: boolean
    message: string
    detail: string
    username: string
    email: string
}
export type LaurusUserResult = UserResult_V1_0;
export interface UserResult_V1_0 {
    username: string
    email: string
}
export interface ResetPassword_V1_0 {
    username: string
    email: string
}
export interface ResetPasswordResult_V1_0 {
    success: boolean
    message: string
    detail: string
    username: string
    email: string
}
export interface Token_V1_0 {
    access_token: string
    token_type: string
}
export interface LaurusToken extends Token_V1_0 {
    success: boolean,
    message: string,
}
export interface ValidationError_V1_0 {
    field: string,
    message: string,
}
export async function registerUser(
    baseUrl: string | undefined,
    register: Register_V1_0): Promise<RegisterResult_V1_0> {
    try {
        const url = `${baseUrl}/register`;
        const body = JSON.stringify(register);
        const raw_response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!raw_response.ok) {
            if (raw_response.status == 422) {
                const errorData = await raw_response.json();
                const emailError = errorData.errors?.find((e: ValidationError_V1_0) => e.field === 'email');
                if (emailError) {
                    const newResponse: RegisterResult_V1_0 = {
                        success: false,
                        message: EMAIL_ERROR,
                        detail: "",
                        username: register.username,
                        email: register.email,
                    }
                    return newResponse;
                }
            }
            return {
                success: false,
                message: raw_response.statusText,
                detail: "",
                username: register.username,
                email: register.email,
            }
        }

        const response: RegisterResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
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
export async function login(
    baseUrl: string | undefined,
    username: string,
    password: string): Promise<LaurusToken> {
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
                message: raw_response.statusText,
                access_token: "",
                token_type: ""
            }
        }
        const response: Token_V1_0 = await raw_response.json();
        return { ...response, success: true, message: "" };
    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "unknown error",
            access_token: "",
            token_type: ""
        }
    }
}
export async function refreshAccessToken(baseUrl: string | undefined): Promise<LaurusToken> {
    const url = `${baseUrl}/refresh`;
    try {
        const raw_response = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!raw_response.ok) {
            return {
                success: false,
                message: raw_response.statusText,
                access_token: "",
                token_type: ""
            }
        }

        const response: LaurusToken = await raw_response.json();
        return { ...response, success: true, message: "" };

    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "unknown error",
            access_token: "",
            token_type: ""
        }
    }
}
export async function logout(
    baseUrl: string | undefined,
    accessToken: string): Promise<boolean> {
    try {
        const url = `${baseUrl}/logout`;
        let response: Response | undefined = undefined;
        const authResponse = await authFetch(baseUrl, accessToken, undefined, url, 'POST');
        if (authResponse.newToken) {
            const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, 'POST');
            response = authResponse2.response;
        }
        else {
            response = authResponse.response;
        }
        return response.ok;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}
export async function getMe(
    baseUrl: string | undefined,
    accessToken: string): Promise<UserResult_V1_0 | undefined> {
    try {
        const url = `${baseUrl}/users/me`;
        let response: Response | undefined = undefined;
        const authResponse = await authFetch(baseUrl, accessToken, undefined, url, 'GET');
        if (authResponse.newToken) {
            const authResponse2 = await authFetch(baseUrl, authResponse.newToken, undefined, url, 'GET');
            response = authResponse2.response;
        }
        else {
            response = authResponse.response;
        }
        if (!response.ok) {
            return undefined;
        }
        const result: UserResult_V1_0 = await response.json();
        return result;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}
export async function resetPassword(
    baseUrl: string | undefined,
    resetPassword: ResetPassword_V1_0): Promise<ResetPasswordResult_V1_0 | undefined> {
    try {
        const url = `${baseUrl}/reset-password`;
        const body = JSON.stringify(resetPassword);
        const raw_response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!raw_response.ok) {
            if (raw_response.status == 422) {
                const errorData = await raw_response.json();
                const emailError: ValidationError_V1_0 = errorData.errors?.find((e: ValidationError_V1_0) => e.field === 'email');
                if (emailError) {
                    const newResponse: ResetPasswordResult_V1_0 = {
                        success: false,
                        message: EMAIL_ERROR,
                        detail: "",
                        username: resetPassword.username,
                        email: resetPassword.email,
                    }
                    return newResponse;
                }
            }
            return undefined;
        }
        const response: ResetPasswordResult_V1_0 = await raw_response.json();
        return response;
    }
    catch (error) {
        console.log({ error });
        return undefined;
    }
}

export async function resetPasswordConfirm(
    baseUrl: string | undefined,
    newPassword: { token: string, new_password: string }) {
    try {
        const url = `${baseUrl}/reset-password-confirm`;
        const body = JSON.stringify(newPassword);
        const raw_response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
        });

        return raw_response.ok;
    }
    catch (error) {
        console.log({ error });
        return false;
    }
}