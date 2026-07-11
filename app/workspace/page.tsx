import { fetchMe, fetchProject } from "../page";
import { getProjects } from "../projects/projects.server";
import WorkspaceBoot from "./workspace.boot";
import {
  ImgMediaResult_V1_0,
  SvgMediaResult_V1_0,
  getImgDiscoveryPage,
  getSvgDiscoveryPage,
  getEffects,
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
  const imgPageOne = await getImgDiscoveryPage(laurusApi, pageSize);
  if (imgPageOne && imgPageOne.length > 0) {
    for (let i = 0; i < imgPageOne.length; i++) {
      browserImgs.push({ ...imgPageOne[i] });
    }
  }
  const svgPageOne = await getSvgDiscoveryPage(laurusApi, pageSize);
  if (svgPageOne && svgPageOne.length > 0) {
    for (let i = 0; i < svgPageOne.length; i++) {
      browserSvgs.push({ ...svgPageOne[i] });
    }
  }
  return { browserImgs, browserSvgs };
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
  const projectDependencies = fetchProject(laurusApi, Boolean(guest), projects, project_id, true);
  const browserDependencies = fetchMediaFromServer(laurusApi, mediaPageSizeInit);

  return (
    <>
      <WorkspaceBoot
        laurusApi={laurusApi}
        mediaPageSizeInit={mediaPageSizeInit}
        effectsEnum={effectsEnum}
        projectDependencies={projectDependencies}
        browserDependencies={browserDependencies}
        mePromise={me}
      />
    </>
  );
}
