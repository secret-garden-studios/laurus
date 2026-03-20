import WorkspaceBoot from "./workspace.boot";
export const dynamic = 'force-dynamic';

export default function Page() {
    const mediaPageSize = process.env.MEDIA_PAGE_SIZE;
    const laurusApi = process.env.LAURUS_API;
    return <WorkspaceBoot
        laurusApi={laurusApi}
        mediaPageSize={mediaPageSize} />
}