import LandingBoot from './landing.boot';

export default async function Home({ searchParams }: { searchParams: Promise<{ access?: string, reset_password?: string }> }) {
  const { access, reset_password } = await searchParams;
  const laurusApi = process.env.LAURUS_API;
  return <LandingBoot
    laurusApi={laurusApi}
    accessTokenInit={access}
    resetPassword={reset_password}
  />
};