import { fetchMe } from "../page";
import ProjectsBoot from "./projects.boot";
import { getProjects } from "./projects.server";

export default async function Page({ searchParams }: { searchParams: Promise<{ logout?: string }> }) {
    const { logout } = await searchParams;
    const laurusApi = process.env.LAURUS_API;
    const projects = getProjects(laurusApi);
    const mePromise = fetchMe(laurusApi, Boolean(logout));
    return <ProjectsBoot
        laurusApi={laurusApi}
        projectsPromise={projects}
        mePromise={mePromise} />
}