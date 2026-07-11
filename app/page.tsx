import { cookies } from "next/headers";
import LandingBoot from "./landing.boot";
import { logout, getMe, UserResult_V1_0 } from "./landing.server";
import { ProjectResult_V1_0 } from "./projects/projects.server";
import {
  ScaleResult_V1_0,
  MoveResult_V1_0,
  RotateResult_V1_0,
  EffectGroupResult_V1_0,
  ImgMediaResult_V1_0,
  SvgMediaResult_V1_0,
  getScales,
  getMoves,
  getRotates,
  getEffectGroups,
  getSvg,
  getImg,
} from "./workspace/workspace.server";
export const dynamic = "force-dynamic";

export interface MeDependencies {
  me: UserResult_V1_0 | undefined;
  accessToken: string | undefined;
}
export async function fetchMe(laurusApi: string | undefined, logoutFlag: boolean): Promise<MeDependencies> {
  const cookieStore = await cookies();
  const token = cookieStore.get("refresh_token")?.value;
  if (token) {
    if (logoutFlag) {
      await logout(laurusApi, token);
      return { me: undefined, accessToken: undefined };
    } else {
      const me = await getMe(laurusApi, token);
      return { me, accessToken: token };
    }
  } else {
    return { me: undefined, accessToken: undefined };
  }
}

export interface ProjectDependencies {
  project: ProjectResult_V1_0;
  scales: ScaleResult_V1_0[];
  moves: MoveResult_V1_0[];
  rotates: RotateResult_V1_0[];
  effectGroups: EffectGroupResult_V1_0[];
  canvasImgs: ImgMediaResult_V1_0[];
  canvasSvgs: SvgMediaResult_V1_0[];
}
export async function fetchProject(
  laurusApi: string | undefined,
  logoutFlag: boolean,
  projects: Promise<ProjectResult_V1_0[] | undefined>,
  requested_project_id: string | undefined,
  fetchMedia: boolean,
): Promise<ProjectDependencies | undefined> {
  const p = await projects;
  if (p && p.length > 0) {
    const cookieStore = await cookies();
    const token = cookieStore.get("refresh_token")?.value;
    if (token && logoutFlag) {
      await logout(laurusApi, token);
    }

    const requestedProject = requested_project_id ? p.find((p) => p.project_id == requested_project_id) : undefined;
    const myUsername: string = token && !logoutFlag ? ((await getMe(laurusApi, token))?.username ?? "") : "";
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
      const thePublicsLatestEdits = p.sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
      if (thePublicsLatestEdits.length > 0) {
        newProject = thePublicsLatestEdits[0];
      }
    }
    if (!newProject) return undefined;
    const scales = await getScales(laurusApi, newProject.project_id);
    const moves = await getMoves(laurusApi, newProject.project_id);
    const rotates = await getRotates(laurusApi, newProject.project_id);
    const effectGroups = await getEffectGroups(laurusApi, newProject.project_id);
    const svgsArray = Array.from(newProject.svgs.values());
    const canvasSvgs: SvgMediaResult_V1_0[] = [];
    if (fetchMedia) {
      for (let i = 0; i < svgsArray.length; i++) {
        const svgMediaResult = await getSvg(laurusApi, svgsArray[i].svg_media_id, svgsArray[i].media_key);
        if (svgMediaResult) {
          canvasSvgs.push({ ...svgMediaResult });
        }
      }
    }
    const imgsArray = Array.from(newProject.imgs.values());
    const canvasImgs: ImgMediaResult_V1_0[] = [];
    if (fetchMedia) {
      for (let i = 0; i < imgsArray.length; i++) {
        const imgMediaResult = await getImg(laurusApi, imgsArray[i].img_media_id, imgsArray[i].media_key);
        if (imgMediaResult) {
          canvasImgs.push({ ...imgMediaResult });
        }
      }
    }
    return {
      project: newProject,
      scales: scales ?? [],
      moves: moves ?? [],
      rotates: rotates ?? [],
      effectGroups: effectGroups ?? [],
      canvasImgs,
      canvasSvgs,
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
