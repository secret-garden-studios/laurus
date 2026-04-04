import ProjectsBoot from "./projects.boot";
import { getProjects } from "./projects.server";

export default function Page() {
    const laurusApi = process.env.LAURUS_API;
    const projects = getProjects(laurusApi);

    return <ProjectsBoot
        laurusApi={laurusApi}
        projectsPromise={projects} />
}