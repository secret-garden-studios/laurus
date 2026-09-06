import { cookies } from "next/headers";
import LandingBoot from "./landing.boot";
import { exchangeRefreshCookie, getMe, UserResult_V1_0 } from "./landing.server";
import { ProjectResult_V1_0 } from "./projects/projects.server";
import {
  ScaleResult_V1_0,
  MoveResult_V1_0,
  RotateResult_V1_0,
  SkewResult_V1_0,
  LightSourceResult_V1_0,
  EffectGroupResult_V1_0,
  ImgMediaResult_V1_0,
  SvgMediaResult_V1_0,
  MaskMediaResult_V1_0,
  ObjectReviewState_V1_0,
  getScales,
  getMoves,
  getRotates,
  getSkews,
  getLightSources,
  getEffectGroups,
  getSvg,
  getImg,
  getMasksByIds,
  getObjectReview,
} from "./workspace/workspace.server";
export const dynamic = "force-dynamic";

export interface MeDependencies {
  me: UserResult_V1_0 | undefined;
  accessToken: string | undefined;
}
export async function fetchMe(laurusApi: string | undefined, guest: boolean): Promise<MeDependencies> {
  if (guest) {
    return { me: undefined, accessToken: undefined };
  }
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;
  if (!refreshToken) {
    return { me: undefined, accessToken: undefined };
  }
  const accessToken = await exchangeRefreshCookie(laurusApi, refreshToken);
  if (!accessToken) {
    return { me: undefined, accessToken: undefined };
  }
  const me = await getMe(laurusApi, accessToken);
  return me ? { me, accessToken } : { me: undefined, accessToken: undefined };
}

export interface ProjectDependencies {
  project: ProjectResult_V1_0;
  scales: ScaleResult_V1_0[];
  moves: MoveResult_V1_0[];
  rotates: RotateResult_V1_0[];
  skews: SkewResult_V1_0[];
  lightSources: LightSourceResult_V1_0[];
  effectGroups: EffectGroupResult_V1_0[];
  canvasImgs: ImgMediaResult_V1_0[];
  canvasSvgs: SvgMediaResult_V1_0[];
  canvasMasks: MaskMediaResult_V1_0[];
  objectReviews: ObjectReviewState_V1_0[];
}
export async function fetchProject(
  laurusApi: string | undefined,
  mePromise: Promise<MeDependencies>,
  projects: Promise<ProjectResult_V1_0[] | undefined>,
  requested_project_id: string | undefined,
): Promise<ProjectDependencies | undefined> {
  const p = await projects;
  if (p && p.length > 0) {
    const { me, accessToken } = await mePromise;

    const requestedProject = requested_project_id ? p.find((p) => p.project_id == requested_project_id) : undefined;
    const myUsername: string = me?.username ?? "";
    let newProject: ProjectResult_V1_0 | undefined = undefined;
    if (requestedProject) {
      newProject = requestedProject;
    } else if (myUsername) {
      const myLatestEdits = p
        .filter((n) => n.last_editor == myUsername)
        .sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
      if (myLatestEdits.length > 0) {
        newProject = myLatestEdits[0];
      }
    } else {
      const thePublicsLatestEdits = [...p].sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
      if (thePublicsLatestEdits.length > 0) {
        newProject = thePublicsLatestEdits[0];
      }
    }
    if (!newProject) return undefined;
    const svgsArray = Array.from(newProject.svgs.values());
    const imgsArray = Array.from(newProject.imgs.values());
    const masksArray = Array.from(newProject.masks.values());

    const [scales, moves, rotates, skews, lightSources, effectGroups, canvasSvgs, canvasImgs, canvasMasks] =
      await Promise.all([
        getScales(laurusApi, newProject.project_id),
        getMoves(laurusApi, newProject.project_id),
        getRotates(laurusApi, newProject.project_id),
        getSkews(laurusApi, newProject.project_id),
        getLightSources(laurusApi, newProject.project_id),
        getEffectGroups(laurusApi, newProject.project_id),
        Promise.all(svgsArray.map((s) => getSvg(laurusApi, s.svg_media_id))).then((r) =>
          r.filter((x) => x !== undefined).map((x) => ({ ...x })),
        ),
        Promise.all(imgsArray.map((i) => getImg(laurusApi, i.img_media_id))).then((r) =>
          r.filter((x) => x !== undefined).map((x) => ({ ...x })),
        ),
        getMasksByIds(
          laurusApi,
          masksArray.map((m) => m.media_id),
        ).then((r) => r ?? []),
      ]);

    const placedImgIds = new Set(imgsArray.map((i) => i.img_media_id));
    const fetchedImgIds = new Set(canvasImgs.map((i) => i.img_media_id));
    const missingSourceImgIds = new Set(
      canvasMasks.map((m) => m.source_img_media_id).filter((id) => !placedImgIds.has(id) && !fetchedImgIds.has(id)),
    );

    const [objectReviews, missingSourceImgs] = await Promise.all([
      accessToken
        ? Promise.all(
            canvasMasks
              .filter((m) => m.has_object_review)
              .map((m) => getObjectReview(laurusApi, accessToken, m.mask_media_id)),
          ).then((r) => r.filter((x) => x !== undefined))
        : Promise.resolve<ObjectReviewState_V1_0[]>([]),
      Promise.all(Array.from(missingSourceImgIds).map((id) => getImg(laurusApi, id))).then((r) =>
        r.filter((x) => x !== undefined).map((x) => ({ ...x })),
      ),
    ]);
    canvasImgs.push(...missingSourceImgs);
    return {
      project: newProject,
      scales: scales ?? [],
      moves: moves ?? [],
      rotates: rotates ?? [],
      skews: skews ?? [],
      lightSources: lightSources ?? [],
      effectGroups: effectGroups ?? [],
      canvasImgs,
      canvasSvgs,
      canvasMasks,
      objectReviews,
    };
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ reset_password?: string }> }) {
  const { reset_password } = await searchParams;
  const laurusApi = process.env.LAURUS_API;
  return (
    <>
      <LandingBoot laurusApi={laurusApi} resetPassword={reset_password} />
    </>
  );
}
