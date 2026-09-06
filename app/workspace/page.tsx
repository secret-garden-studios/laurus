import { fetchMe, fetchProject, ProjectDependencies } from "../page";
import { getProjects } from "../projects/projects.server";
import WorkspaceBoot from "./workspace.boot";
import {
  ImgMediaResult_V1_0,
  SvgMediaResult_V1_0,
  LaurusMediaGroupResult,
  getEffects,
  getMediaGroups,
} from "./workspace.server";
export const dynamic = "force-dynamic";

export interface BrowserDependencies {
  browserImgs: ImgMediaResult_V1_0[];
  browserSvgs: SvgMediaResult_V1_0[];
}

async function fetchMediaGroupsFromServer(
  laurusApi: string | undefined,
  projectDependencies: Promise<ProjectDependencies | undefined>,
): Promise<LaurusMediaGroupResult[]> {
  const project = await projectDependencies;
  if (!project) {
    return [];
  }
  const mediaGroups = await getMediaGroups(laurusApi, project.project.project_id);
  return mediaGroups ?? [];
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string; project_id?: string }>;
}) {
  const { guest, project_id } = await searchParams;
  const mediaPageSize = process.env.MEDIA_PAGE_SIZE;
  const laurusApi = process.env.LAURUS_API;
  const me = fetchMe(laurusApi, Boolean(guest));
  const projects = getProjects(laurusApi);
  const effectsEnum = getEffects(laurusApi);
  const mediaPageSizeInit = mediaPageSize ? parseInt(mediaPageSize) || 0 : 0;
  const projectDependencies = fetchProject(laurusApi, me, projects, project_id);
  const mediaGroupsDependencies = fetchMediaGroupsFromServer(laurusApi, projectDependencies);

  return (
    <WorkspaceBoot
      laurusApi={laurusApi}
      mediaPageSizeInit={mediaPageSizeInit}
      effectsEnum={effectsEnum}
      projectDependencies={projectDependencies}
      mediaGroupsDependencies={mediaGroupsDependencies}
      mePromise={me}
    />
  );
}
