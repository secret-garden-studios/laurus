import { cookies } from 'next/headers';
import LandingBoot from './landing.boot';
import { logout, getMe, UserResult_V1_0 } from './landing.server';
export const dynamic = 'force-dynamic';

export interface MeDependencies {
  me: UserResult_V1_0 | undefined,
  accessToken: string | undefined,
}
export async function fetchMe(
  laurusApi: string | undefined,
  logoutFlag: boolean): Promise<MeDependencies> {
  const cookieStore = await cookies();
  const token = cookieStore.get('refresh_token')?.value;
  if (token) {
    if (logoutFlag) {
      await logout(laurusApi, token);
      return { me: undefined, accessToken: undefined };
    }
    else {
      const me = await getMe(laurusApi, token);
      return { me, accessToken: token };
    }
  }
  else {
    return { me: undefined, accessToken: undefined };
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ reset_password?: string }> }) {
  const { reset_password } = await searchParams;
  const laurusApi = process.env.LAURUS_API;
  return <>
    <LandingBoot
      laurusApi={laurusApi}
      resetPassword={reset_password}
    />
  </>
}
