import { fetchMe, fetchProject, ProjectDependencies } from "../page";
import { getProjects } from "../projects/projects.server";
import WorkspaceBoot from "./workspace.boot";
import {
  ImgMediaResult_V1_0,
  SvgMediaResult_V1_0,
  LaurusMediaGroupResult,
  downloadImgs,
  downloadSvgs,
  getEffects,
  getMediaGroups,
} from "./workspace.server";
export const dynamic = "force-dynamic";

export interface BrowserDependencies {
  browserImgs: ImgMediaResult_V1_0[];
  browserSvgs: SvgMediaResult_V1_0[];
}
async function fetchMediaFromServer(laurusApi: string | undefined, pageSize: number): Promise<BrowserDependencies> {
  const browserImgs: ImgMediaResult_V1_0[] = [];
  const browserSvgs: SvgMediaResult_V1_0[] = [];
  if (pageSize <= 0) {
    return { browserImgs, browserSvgs };
  }
  const imgPageOne = await downloadImgs(laurusApi, pageSize);
  if (imgPageOne && imgPageOne.length > 0) {
    for (let i = 0; i < imgPageOne.length; i++) {
      browserImgs.push({ ...imgPageOne[i] });
    }
  }
  const svgPageOne = await downloadSvgs(laurusApi, pageSize);
  if (svgPageOne && svgPageOne.length > 0) {
    for (let i = 0; i < svgPageOne.length; i++) {
      browserSvgs.push({ ...svgPageOne[i] });
    }
  }
  return { browserImgs, browserSvgs };
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
  const projectDependencies = fetchProject(laurusApi, me, projects, project_id, true);
  const browserDependencies = fetchMediaFromServer(laurusApi, mediaPageSizeInit);
  const mediaGroupsDependencies = fetchMediaGroupsFromServer(laurusApi, projectDependencies);

  return (
    <WorkspaceBoot
      laurusApi={laurusApi}
      mediaPageSizeInit={mediaPageSizeInit}
      effectsEnum={effectsEnum}
      projectDependencies={projectDependencies}
      browserDependencies={browserDependencies}
      mediaGroupsDependencies={mediaGroupsDependencies}
      mePromise={me}
    />
  );
}
