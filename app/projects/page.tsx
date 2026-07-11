import { fetchMe, fetchProject, MeDependencies, ProjectDependencies } from "../page";
import ProjectsBoot from "./projects.boot";
import { getPins, getProjects, LaurusProjectResult } from "./projects.server";
export const dynamic = "force-dynamic";

async function getProjectDependencies(
  laurusApi: string | undefined,
  guest: boolean,
  projects: Promise<LaurusProjectResult[] | undefined>,
) {
  const projectDepArray: ProjectDependencies[] = [];
  const p = await projects;
  if (!p) return projectDepArray;
  for (let i = 0; i < p?.length; i++) {
    const project = p[i];
    const projectDep = await fetchProject(laurusApi, guest, projects, project.project_id, false);
    if (projectDep) {
      projectDepArray.push(projectDep);
    }
  }
  return projectDepArray;
}

async function getMyPins(laurusApi: string | undefined, mePromise: Promise<MeDependencies>, guest: boolean) {
  if (guest) return [];
  const me = await mePromise;
  return getPins(laurusApi, me.accessToken, undefined);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ guest?: string }> }) {
  const { guest } = await searchParams;
  const laurusApi = process.env.LAURUS_API;
  const projects = getProjects(laurusApi);
  const projectDependenciesPromise = getProjectDependencies(laurusApi, Boolean(guest), projects);
  const mePromise = fetchMe(laurusApi, Boolean(guest));
  const pinsPromise = getMyPins(laurusApi, mePromise, Boolean(guest));
  return (
    <ProjectsBoot
      laurusApi={laurusApi}
      projectDependenciesPromise={projectDependenciesPromise}
      mePromise={mePromise}
      pinsPromise={pinsPromise}
    />
  );
}
