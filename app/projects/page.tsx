import { getMe } from "../landing.server";
import ProjectsBoot from "./projects.boot";
import { getProjects } from "./projects.server";

export default async function Page({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
    const { access } = await searchParams;
    const laurusApi = process.env.LAURUS_API;
    const projects = getProjects(laurusApi);
    const me = access ? getMe(laurusApi, access) : undefined;
    return <ProjectsBoot
        laurusApi={laurusApi}
        accessToken={access}
        projectsPromise={projects}
        mePromise={me} />
}