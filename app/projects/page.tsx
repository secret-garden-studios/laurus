import { fetchMe, MeDependencies } from "../page";
import ProjectsBoot from "./projects.boot";
import { getEffectCounts, getPins, getProjects } from "./projects.server";
export const dynamic = "force-dynamic";

async function getMyPins(laurusApi: string | undefined, mePromise: Promise<MeDependencies>, guest: boolean) {
  if (guest) return [];
  const me = await mePromise;
  return getPins(laurusApi, me.accessToken, undefined);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ guest?: string }> }) {
  const { guest } = await searchParams;
  const laurusApi = process.env.LAURUS_API;
  const projects = getProjects(laurusApi);
  const effectCounts = getEffectCounts(laurusApi);
  const mePromise = fetchMe(laurusApi, Boolean(guest));
  const pinsPromise = getMyPins(laurusApi, mePromise, Boolean(guest));
  return (
    <ProjectsBoot
      laurusApi={laurusApi}
      projectsPromise={projects}
      effectCountsPromise={effectCounts}
      mePromise={mePromise}
      pinsPromise={pinsPromise}
    />
  );
}
