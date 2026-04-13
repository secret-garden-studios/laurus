import { fetchMe } from "../page";
import ProjectsBoot from "./projects.boot";
import { getProjects } from "./projects.server";
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ guest?: string }> }) {
    const { guest } = await searchParams;
    const laurusApi = process.env.LAURUS_API;
    const projects = getProjects(laurusApi);
    const mePromise = fetchMe(laurusApi, Boolean(guest));
    return <ProjectsBoot
        laurusApi={laurusApi}
        projectsPromise={projects}
        mePromise={mePromise} />
}