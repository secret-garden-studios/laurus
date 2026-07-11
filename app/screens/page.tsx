import { fetchMe } from "../page";
import ScreensBoot from "./screens.boot";
import { getVideoDiscoveryPage, VideoMediaResult_V1_0 } from "./screens.server";
export const dynamic = "force-dynamic";

async function fetchMedia(pageSize: number) {
  const videoPageOne = await getVideoDiscoveryPage(process.env.LAURUS_API, pageSize);
  const videoMedia: VideoMediaResult_V1_0[] = [];
  if (videoPageOne && videoPageOne.length > 0) {
    for (let i = 0; i < videoPageOne.length; i++) {
      videoMedia.push({ ...videoPageOne[i] });
    }
  }
  return videoMedia;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ guest?: string }> }) {
  const { guest } = await searchParams;
  const laurusApi = process.env.LAURUS_API;
  const pageSize = process.env.VIDEO_MEDIA_PAGE_SIZE ? parseInt(process.env.VIDEO_MEDIA_PAGE_SIZE) || 5 : 5;
  const mePromise = fetchMe(laurusApi, Boolean(guest));
  const videoMedia = fetchMedia(pageSize);
  return (
    <ScreensBoot
      apiOriginInit={laurusApi}
      videoMediaPromise={videoMedia}
      videoMediaPageSize={pageSize}
      mePromise={mePromise}
    />
  );
}
