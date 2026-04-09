import { CSSProperties, use, useEffect, useMemo, useRef, useState } from "react";
import { ProjectsResolution } from "./projects-resolution"
import { createProject, deleteProject, Project_V1_0, ProjectImg_V1_0, ProjectResult_V1_0, ProjectSvg_V1_0 } from "./projects.server"
import { addCircle, arrowDropDown, arrowDropUp, fileCopy, outbound, search, SvgRepo, cancelCircle } from "../svg-repo";
import Menubar from "../menubar";
import { dellaRespira, italiana } from "../fonts";
import styles from "../app.module.css";
import { FRAME_HEIGHT_5_7, FRAME_WIDTH_5_7, NEW_PROJECT_CANVAS_SIZE } from "../workspace/workspace-resolution";
import Statusbar from "./statusbar";
import { useRouter } from 'next/navigation'
import useDebounce from "../hooks/useDebounce";
import { LaurusUserResult } from "../landing.server";

type LaurusProjectImg = ProjectImg_V1_0;
type LaurusProjectSvg = ProjectSvg_V1_0;
interface LaurusProjectResult extends ProjectResult_V1_0 {
    imgs: Map<string, LaurusProjectImg>
    svgs: Map<string, LaurusProjectSvg>
}
interface LaurusProject extends Project_V1_0 {
    imgs: Map<string, LaurusProjectImg>
    svgs: Map<string, LaurusProjectSvg>
}
type SortStrategy = 'name_az' | 'name_za' | 'timestamp_123' | 'timestamp_321' | 'last_active_123' | 'last_active_321' | 'frame_123' | 'frame_321' | 'canvas_123' | 'canvas_321' | 'none';

function sortByNameAz(a: LaurusProjectResult, b: LaurusProjectResult) {
    return a.name.localeCompare(b.name);
}

function sortByNameZa(a: LaurusProjectResult, b: LaurusProjectResult) {
    return b.name.localeCompare(a.name);
}

function sortByTimestamp321(a: LaurusProjectResult, b: LaurusProjectResult) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function sortByTimestamp123(a: LaurusProjectResult, b: LaurusProjectResult) {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function sortByLastActive321(a: LaurusProjectResult, b: LaurusProjectResult) {
    return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
}

function sortByLastActive123(a: LaurusProjectResult, b: LaurusProjectResult) {
    return new Date(a.last_active).getTime() - new Date(b.last_active).getTime();
}

function sortByFrame123(a: LaurusProjectResult, b: LaurusProjectResult) {
    return (a.frame_width + a.frame_height) - (b.frame_width + b.frame_height);
}

function sortByFrame321(a: LaurusProjectResult, b: LaurusProjectResult) {
    return (b.frame_width + b.frame_height) - (a.frame_width + a.frame_height);
}

function sortByCanvas123(a: LaurusProjectResult, b: LaurusProjectResult) {
    return (a.canvas_width + a.canvas_height) - (b.canvas_width + b.canvas_height);
}

function sortByCanvas321(a: LaurusProjectResult, b: LaurusProjectResult) {
    return (b.canvas_width + b.canvas_height) - (a.canvas_width + a.canvas_height);
}

function projectsDeepSearch(
    query: string,
    projects: ProjectResult_V1_0[]
): ProjectResult_V1_0[] {
    const term = query.toLowerCase().trim();
    if (!term) return projects;
    const deepMatch = (val: unknown): boolean => {
        if (val === null || val === undefined) return false;
        if (val instanceof Map) {
            return Array.from(val.values()).some(deepMatch);
        }
        if (typeof val === 'object') {
            return Object.values(val).some(deepMatch);
        }
        return String(val).toLowerCase().includes(term);
    };
    return projects.filter(deepMatch);
}

interface Projects {
    apiOriginInit: string | undefined,
    accessTokenInit: string | undefined,
    projectsPromise: Promise<ProjectResult_V1_0[] | undefined>,
    resolutionInit: ProjectsResolution,
    mePromise: Promise<LaurusUserResult | undefined> | undefined
}
export default function Projects({ apiOriginInit, accessTokenInit, projectsPromise, resolutionInit, mePromise }: Projects) {
    const router = useRouter();
    const p = use(projectsPromise);
    const me = mePromise ? use(mePromise) : undefined;
    const [projects, setProjects] = useState<LaurusProjectResult[]>(() => {
        if (p) {
            return p.map(x => {
                const newImgs: Map<string, LaurusProjectImg> =
                    new Map(x.imgs.entries().map(e => [e[0], { ...e[1] }]));
                const newSvgs: Map<string, LaurusProjectSvg> =
                    new Map(x.svgs.entries().map(e => [e[0], { ...e[1] }]));
                return { ...x, imgs: newImgs, svgs: newSvgs, layers: new Map(x.layers) }
            })
        }
        else {
            return [];
        }
    });
    const [selectedProject, setSelectedProject] = useState<LaurusProjectResult | undefined>(undefined);
    const [dynamicSizes] = useState(() => {
        switch (resolutionInit.type) {
            case "high": return {
                gridMargins: { top: 110, bottom: 90, leftRight: 140 },
                searchBar: { width: 500, height: 50, fontSize: 14 },
                searchBarSvg: { size: 20, right: 10, scale: 1 },
                contentsWrapper: { height: 90, fontSize: 12 },
                footerParent: { padding: '30px 40px', gap: 12 },
                footerSvg: { size: 24, padding: 10 }
            }
            case "midhigh": return {
                gridMargins: { top: 90, bottom: 74, leftRight: 120 },
                searchBar: { width: 400, height: 40, fontSize: 11 },
                searchBarSvg: { size: 20, right: 10, scale: 0.8 },
                contentsWrapper: { height: 78, fontSize: 11 },
                footerParent: { padding: '30px 40px', gap: 8 },
                footerSvg: { size: 18, padding: 8 }
            }
            case "midlow":
            case "low": return {
                gridMargins: { top: 90, bottom: 74, leftRight: 120 },
                searchBar: { width: 400, height: 40, fontSize: 11 },
                searchBarSvg: { size: 20, right: 10, scale: 0.8 },
                contentsWrapper: { height: 78, fontSize: 11 },
                footerParent: { padding: '30px 40px', gap: 8 },
                footerSvg: { size: 18, padding: 8 }
            }
        }
    });
    const [sortStrategy, setSortStrategy] = useState<SortStrategy>('last_active_321');
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 300);
    const filteredResults = useMemo(() => {
        return projectsDeepSearch(debouncedQuery, projects);
    }, [debouncedQuery, projects]);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = scrollRef.current;
        if (element) {
            const hasOverflow = element.scrollHeight > element.clientHeight;
            setIsOverflowing(hasOverflow);
        }
    }, [projects]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedProject(undefined);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const contentCellWrapperStyle: CSSProperties = {
        ...dynamicSizes.contentsWrapper,
        display: 'grid',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    };

    const contentCellStyle: CSSProperties = {
        textAlign: 'center',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
    };

    return <>
        <div
            className={`${dellaRespira.className} ${styles['noisy-background']}`}
            style={{
                width: "100vw",
                height: '100vh',
                display: 'grid',
                gridTemplateRows: `min-content ${dynamicSizes.gridMargins.top}px min-content auto ${dynamicSizes.gridMargins.bottom}px min-content min-content`,
                gridTemplateColumns: `${dynamicSizes.gridMargins.leftRight}px auto ${dynamicSizes.gridMargins.leftRight}px`,
            }}>
            <div
                style={{ gridColumn: '1 / -1' }}>
                <Menubar resolution={resolutionInit} me={me} accessToken={accessTokenInit} />
            </div>
            {/* top panel */}
            <div
                style={{
                    gridColumn: '1 / span 2',
                    gridRow: 2,
                    padding: 0
                }}
            >
                {projects.length > 0 && <div style={{
                    position: "relative",
                    display: "grid",
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'end'
                }}>
                    <input
                        className={dellaRespira.className}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={'search projects'}
                        style={{
                            ...dynamicSizes.searchBar,
                            padding: "8px 35px 8px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            background: 'rgb(25, 25, 25)',
                            boxSizing: "border-box",
                            outline: "none",
                        }} />
                    <div
                        style={{
                            position: "absolute",
                            right: dynamicSizes.searchBarSvg.right,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: 'rgba(227,227,227,1)',
                            pointerEvents: "none",
                        }}>
                        <SvgRepo
                            svg={search()}
                            containerSize={{
                                width: dynamicSizes.searchBarSvg.size,
                                height: dynamicSizes.searchBarSvg.size
                            }}
                            scale={dynamicSizes.searchBarSvg.scale} />
                    </div>
                </div>}
            </div>
            {/* left panel */}
            <div
                style={{
                    gridColumn: 1,
                    gridRow: '3 / -1',
                }}
            />
            {projects.length > 0 ? <>
                <div
                    style={{
                        gridColumn: 2,
                        gridRow: 3,
                        display: 'grid',
                        gridTemplateColumns: '7fr 3fr 3fr 3fr 3fr 2fr 2fr',
                        fontWeight: 'bolder',
                        letterSpacing: "1px",
                        borderTopLeftRadius: 10,
                        borderTopRightRadius: 10,
                        border: '1px solid rgba(255,255,255,0.05)',
                        background: "linear-gradient(34deg, rgba(20, 20, 20, 1) 34%, rgba(16, 16, 16, 1))",
                        color: 'rgb(227,227,227)',
                        zIndex: 1,
                    }}>
                    <HeaderCell
                        label={"Name"}
                        row={1}
                        column={1}
                        sortStrategy={sortStrategy}
                        sortStrategyKeys={{ startsWith: "name", ascending: "name_az", descending: "name_za" }}
                        onCellClick={() => setSortStrategy("name_az")}
                        onSortAscendingClick={() => setSortStrategy("name_az")}
                        onSortDescedingClick={() => setSortStrategy("name_za")}
                        resolution={resolutionInit} />
                    <HeaderCell
                        label={"Created"}
                        row={1}
                        column={2}
                        sortStrategy={sortStrategy}
                        sortStrategyKeys={{ startsWith: "timestamp", ascending: "timestamp_123", descending: "timestamp_321" }}
                        onCellClick={() => setSortStrategy("timestamp_321")}
                        onSortAscendingClick={() => setSortStrategy("timestamp_123")}
                        onSortDescedingClick={() => setSortStrategy("timestamp_321")}
                        resolution={resolutionInit} />
                    <HeaderCell
                        label={"Last Edit"}
                        row={1}
                        column={3}
                        sortStrategy={sortStrategy}
                        sortStrategyKeys={{ startsWith: "last_active", ascending: "last_active_123", descending: "last_active_321" }}
                        onCellClick={() => setSortStrategy("last_active_321")}
                        onSortAscendingClick={() => setSortStrategy("last_active_123")}
                        onSortDescedingClick={() => setSortStrategy("last_active_321")}
                        resolution={resolutionInit} />
                    <HeaderCell
                        label={"Frame"}
                        row={1}
                        column={4}
                        sortStrategy={sortStrategy}
                        sortStrategyKeys={{ startsWith: "frame", ascending: "frame_123", descending: "frame_321" }}
                        onCellClick={() => setSortStrategy("frame_321")}
                        onSortAscendingClick={() => setSortStrategy("frame_123")}
                        onSortDescedingClick={() => setSortStrategy("frame_321")}
                        resolution={resolutionInit} />
                    <HeaderCell
                        label={"Canvas"}
                        row={1}
                        column={5}
                        sortStrategy={sortStrategy}
                        sortStrategyKeys={{ startsWith: "canvas", ascending: "canvas_123", descending: "canvas_321" }}
                        onCellClick={() => setSortStrategy("canvas_321")}
                        onSortAscendingClick={() => setSortStrategy("canvas_123")}
                        onSortDescedingClick={() => setSortStrategy("canvas_321")}
                        resolution={resolutionInit} />
                    <HeaderCell
                        label={"Images"}
                        row={1}
                        column={6}
                        resolution={resolutionInit} />
                    <HeaderCell
                        label={"Svgs"}
                        row={1}
                        column={7}
                        resolution={resolutionInit} />
                </div>
                <div
                    className={`${styles['noisy-background']} ${dellaRespira}`}
                    style={{
                        gridColumn: 2,
                        gridRow: 4,
                        overflowY: 'hidden',
                        position: 'relative',
                        height: '100%',
                        boxShadow: !isOverflowing ? 'none' : "rgba(255, 255, 255, 0.04) 0px 0px 30px 1px",
                    }}>
                    <div
                        ref={scrollRef}
                        style={{
                            position: 'absolute',
                            overflowY: 'auto',
                            width: '100%',
                            height: '100%',
                        }}>
                        {filteredResults
                            .sort((a, b) => {
                                switch (sortStrategy) {
                                    case "name_az": return sortByNameAz(a, b);
                                    case "name_za": return sortByNameZa(a, b);
                                    case "timestamp_123": return sortByTimestamp123(a, b);
                                    case "timestamp_321": return sortByTimestamp321(a, b);
                                    case "last_active_321": return sortByLastActive321(a, b);
                                    case "last_active_123": return sortByLastActive123(a, b);
                                    case "frame_123": return sortByFrame123(a, b);
                                    case "frame_321": return sortByFrame321(a, b);
                                    case "canvas_123": return sortByCanvas123(a, b);
                                    case "canvas_321": return sortByCanvas321(a, b);
                                    case "none": return 0;
                                }
                            })
                            .map((project, i) => {
                                return (
                                    <div
                                        onClick={() => {
                                            setSelectedProject(project);
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedProject?.project_id == project.project_id) e.currentTarget.style.cursor = '';
                                            else e.currentTarget.style.cursor = 'pointer';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedProject?.project_id == project.project_id) return;
                                            e.currentTarget.style.cursor = '';
                                        }}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '7fr 3fr 3fr 3fr 3fr 2fr 2fr',
                                            alignItems: 'center',
                                            textWrap: 'nowrap',
                                            background: selectedProject?.project_id == project.project_id ? "rgba(255,255,255,0.15)" : i % 2 != 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
                                            borderRadius: selectedProject?.project_id == project.project_id ? 4 : 0,
                                            border: selectedProject?.project_id == project.project_id ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0)",
                                            boxShadow: selectedProject?.project_id == project.project_id ? "rgba(255, 255, 255, 0.1) 0px 0px 30px 1px" : "none",
                                        }}
                                        key={project.project_id}>
                                        <div
                                            style={{
                                                ...contentCellWrapperStyle,
                                                gridColumn: 1,
                                            }}>
                                            <div style={{
                                                ...contentCellStyle,
                                            }}>{project.name}</div>
                                        </div>
                                        <div
                                            style={{
                                                ...contentCellWrapperStyle,
                                                gridColumn: 2,
                                            }}>
                                            <div style={{ ...contentCellStyle }}>{new Date(project.timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
                                        </div>
                                        <div
                                            style={{
                                                ...contentCellWrapperStyle,
                                                gridColumn: 3,
                                            }}>
                                            <div style={{ ...contentCellStyle }}>{new Date(project.last_active).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
                                        </div>
                                        <div
                                            style={{
                                                ...contentCellWrapperStyle,
                                                gridColumn: 4,
                                            }}>
                                            <div style={{ ...contentCellStyle }}>{project.frame_width}x{project.frame_height}</div>
                                        </div>
                                        <div
                                            style={{
                                                ...contentCellWrapperStyle,
                                                gridColumn: 5,
                                            }}>
                                            <div style={{ ...contentCellStyle }}>{project.canvas_width}x{project.canvas_height}</div>
                                        </div>
                                        <div
                                            style={{
                                                ...contentCellWrapperStyle,
                                                gridColumn: 6,
                                            }}>
                                            <div style={{ ...contentCellStyle }}>{project.imgs.size}</div>
                                        </div>
                                        <div
                                            style={{
                                                ...contentCellWrapperStyle,
                                                gridColumn: 7,
                                            }}>
                                            <div style={{ ...contentCellStyle }}>{project.svgs.size}</div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                    <div
                        style={{
                            borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            height: isOverflowing ? '100%' : (projects.length) * (dynamicSizes.contentsWrapper.height + 2),
                            width: '100%',
                            position: 'absolute',
                            pointerEvents: 'none'
                        }} />
                </div>
            </> : <>
                <div
                    style={{
                        gridColumn: 2,
                        gridRow: 4,
                        display: 'grid',
                    }}>
                    <TablePlaceholder resolution={resolutionInit} />
                </div>
            </>}
            {/* right panel */}
            <div
                style={{
                    gridColumn: 3,
                    gridRow: '2 / -1',
                }}
            />
            {/* bottom panel */}
            <div
                style={{
                    gridColumn: '2',
                    gridRow: 5,
                }}
            />
            <div
                className={dellaRespira.className}
                style={{
                    ...dynamicSizes.footerParent,
                    gridColumn: '1 / -1',
                    gridRow: 6,
                    width: '100%',
                    border: '1px solid rgb(10, 10, 10)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: "linear-gradient(34deg, rgba(29, 29, 29, 1) 34%, rgba(25, 25, 25, 1))",
                }}>
                <div
                    className={`${styles['hoverable-button']} ${styles['is-active']}`}
                    title="create new project"
                    onClick={async () => {
                        const newProject: LaurusProject = {
                            name: "untitled",
                            canvas_width: NEW_PROJECT_CANVAS_SIZE,
                            canvas_height: NEW_PROJECT_CANVAS_SIZE,
                            frame_top: -1,
                            frame_left: -1,
                            frame_width: Math.round(FRAME_WIDTH_5_7 * resolutionInit.factor),
                            frame_height: Math.round(FRAME_HEIGHT_5_7 * resolutionInit.factor),
                            imgs: new Map(),
                            svgs: new Map(),
                            layers: new Map()
                        }
                        const response = await createProject(apiOriginInit, newProject);
                        if (response) {
                            setProjects(v => [...v, { ...response }]);
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                        borderRadius: 10,
                        padding: dynamicSizes.footerSvg.padding,
                        placeContent: 'center'
                    }}>
                    <SvgRepo
                        title="create new project"
                        svg={addCircle()}
                        containerSize={{
                            width: dynamicSizes.footerSvg.size,
                            height: dynamicSizes.footerSvg.size
                        }}
                        scale={1} />
                </div>
                <div
                    className={`${styles['hoverable-button']} ${styles[`${selectedProject ? 'is-active' : ''}`]}`}
                    title="open selected project"
                    onClick={async () => {
                        if (selectedProject) {
                            router.push(`/workspace?project_id=${selectedProject.project_id}`)
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: selectedProject ? 'linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))' : 'none',
                        borderRadius: 10,
                        padding: dynamicSizes.footerSvg.padding,
                        placeContent: 'center'
                    }}>
                    <SvgRepo
                        title="open selected project"
                        svg={selectedProject ? outbound() : outbound('rgba(255, 255, 255, 0.25)')}
                        containerSize={{
                            width: dynamicSizes.footerSvg.size,
                            height: dynamicSizes.footerSvg.size
                        }}
                        scale={1} />
                </div>
                <div
                    className={`${styles['hoverable-button']} ${styles[`${selectedProject ? 'is-active' : ''}`]}`}
                    title="duplicate selected project"
                    onClick={async () => {
                        if (!selectedProject) return
                        const newImgs: Map<string, LaurusProjectImg> =
                            new Map(selectedProject.imgs.entries().map(e => [e[0], { ...e[1] }]));

                        const newSvgs: Map<string, LaurusProjectSvg> =
                            new Map(selectedProject.svgs.entries().map(e => [e[0], { ...e[1] }]));
                        const newProject: LaurusProject = {
                            ...selectedProject,
                            name: `${selectedProject.name} (copy)`,
                            imgs: newImgs,
                            svgs: newSvgs,
                            layers: new Map(selectedProject.layers)
                        }
                        const response = await createProject(apiOriginInit, newProject);
                        if (response) {
                            setProjects(v => [...v, { ...response }]);
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: selectedProject ? 'linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))' : 'none',
                        borderRadius: 10,
                        padding: dynamicSizes.footerSvg.padding,
                        placeContent: 'center'
                    }}>
                    <SvgRepo
                        title="duplicate selected project"
                        svg={selectedProject ? fileCopy() : fileCopy('rgba(255, 255, 255, 0.25)')}
                        containerSize={{
                            width: dynamicSizes.footerSvg.size,
                            height: dynamicSizes.footerSvg.size
                        }}
                        scale={0.8} />
                </div>
                <div
                    className={`${styles['hoverable-button']} ${styles[`${selectedProject ? 'is-active' : ''}`]}`}
                    title="delete selected project"
                    onClick={() => {
                        if (selectedProject) {
                            const confirmed = window.confirm(`Are you sure you want to delete "${selectedProject.name}"?`);
                            if (confirmed) {
                                const selectedProjectId = selectedProject.project_id;

                                setProjects(v => v.filter(p => p.project_id != selectedProjectId));
                                setSelectedProject(undefined);
                                deleteProject(apiOriginInit, selectedProjectId);
                            }
                        }
                    }}
                    style={{
                        display: 'grid',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: selectedProject ? 'linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))' : 'none',
                        borderRadius: 10,
                        padding: dynamicSizes.footerSvg.padding,
                        placeContent: 'center',
                    }}>
                    <SvgRepo
                        title="delete selected project"
                        svg={selectedProject ? cancelCircle() : cancelCircle('rgba(255, 255, 255, 0.25)')}
                        containerSize={{
                            width: dynamicSizes.footerSvg.size,
                            height: dynamicSizes.footerSvg.size
                        }}
                        scale={1} />
                </div>
            </div>
            <div style={{ gridRow: 7, gridColumn: '1 / -1', }}>
                <Statusbar action={"laurus projects"} body={[]} resolution={resolutionInit} />
            </div>
        </div>
    </>
}

interface HeaderCell {
    label: string,
    row: number,
    column: number,
    resolution: ProjectsResolution,
    sortStrategy?: SortStrategy
    sortStrategyKeys?: { startsWith: string, ascending: string, descending: string },
    onCellClick?: () => void,
    onSortAscendingClick?: () => void,
    onSortDescedingClick?: () => void,
}
function HeaderCell({
    label,
    row,
    column,
    resolution,
    sortStrategy,
    sortStrategyKeys,
    onCellClick,
    onSortAscendingClick,
    onSortDescedingClick,
}: HeaderCell) {
    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                fontSize: 15,
                headerCellHeight: 64,
                svgSize: 24,
                svgScale: 0.9,
            }
            case "midhigh": return {
                fontSize: 13,
                headerCellHeight: 54,
                svgSize: 20,
                svgScale: 0.8,
            }
            case "midlow":
            case "low": return {
                fontSize: 13,
                headerCellHeight: 54,
                svgSize: 20,
                svgScale: 0.8,
            }
        }
    })
    const headerCellStyle: CSSProperties = {
        fontSize: dynamicSizes.fontSize,
        height: dynamicSizes.headerCellHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    return <>
        <div
            onMouseEnter={(e) => {
                if (!sortStrategy) return;
                if (!sortStrategyKeys) return;
                if (sortStrategy.startsWith(sortStrategyKeys.startsWith)) return;
                e.currentTarget.style.cursor = 'pointer'
            }}
            onMouseLeave={(e) => { e.currentTarget.style.cursor = '' }}
            onClick={() => {
                if (!sortStrategy) return;
                if (!sortStrategyKeys) return;
                if (sortStrategy.startsWith(sortStrategyKeys.startsWith)) return;
                if (onCellClick) onCellClick();
            }}
            style={{
                ...headerCellStyle,
                gridRow: row,
                gridColumn: column,
            }}>
            <div style={{
                width: dynamicSizes.svgSize,
                height: '100%'
            }} />
            {label}
            {(() => {
                if (!sortStrategyKeys) return <div style={{
                    width: dynamicSizes.svgSize,
                    height: '100%'
                }} />;
                switch (sortStrategy) {
                    case sortStrategyKeys.ascending: return <SvgRepo
                        svg={arrowDropDown()}
                        containerSize={{
                            width: dynamicSizes.svgSize,
                            height: dynamicSizes.svgSize
                        }}
                        scale={dynamicSizes.svgScale}
                        onContainerClick={() => {
                            if (onSortDescedingClick) onSortDescedingClick();
                        }} />
                    case sortStrategyKeys.descending: return <SvgRepo
                        svg={arrowDropUp()}
                        containerSize={{
                            width: dynamicSizes.svgSize,
                            height: dynamicSizes.svgSize
                        }}
                        scale={dynamicSizes.svgScale}
                        onContainerClick={() => {
                            if (onSortAscendingClick) onSortAscendingClick();
                        }} />
                    default: return <SvgRepo
                        svg={arrowDropUp("rgba(0,0,0,0)")}
                        containerSize={{
                            width: dynamicSizes.svgSize,
                            height: dynamicSizes.svgSize
                        }}
                        scale={dynamicSizes.svgScale} />
                }
            })()}
        </div>
    </>
}

interface TablePlaceholder {
    resolution: ProjectsResolution
}
function TablePlaceholder({ resolution }: TablePlaceholder) {

    const [dynamicSizes] = useState(() => {
        switch (resolution.type) {
            case "high": return {
                h1: { padding: "10px 0px" },
                title: { fontSize: 54 },
                sadFace: { fontSize: 32, padding: '0px 16px' },
                h2: { fontSize: 18, padding: 4, marginTop: 20, },
                svg: { padding: '0px 6px', size: 20 },
                h3: { fontSize: 12, padding: 4, marginTop: 20, }
            }
            case "midhigh": return {
                h1: { padding: "10px 0px" },
                title: { fontSize: 44 },
                sadFace: { fontSize: 22, padding: '0px 16px' },
                h2: { fontSize: 16, padding: 4, marginTop: 12, },
                svg: { padding: '0px 6px', size: 18 },
                h3: { fontSize: 11, padding: 4, marginTop: 8, }
            }
            case "midlow":
            case "low": return {
                h1: { padding: "10px 0px" },
                title: { fontSize: 44 },
                sadFace: { fontSize: 22, padding: '0px 16px' },
                h2: { fontSize: 16, padding: 4, marginTop: 12, },
                svg: { padding: '0px 6px', size: 18 },
                h3: { fontSize: 11, padding: 4, marginTop: 8, }
            }
        }
    })
    return (<>
        <div
            className={`${dellaRespira.className}`}
            style={{
                width: '100%',
                display: 'grid',
                placeContent: 'center',
                letterSpacing: '1px',
            }} >
            <div
                style={{
                    display: 'grid',
                    width: '100%',
                }}>
                <div
                    className={`${italiana.className}`}
                    style={{
                        ...dynamicSizes.h1,
                        justifySelf: 'center',
                        display: 'flex',
                        alignItems: 'center',
                    }}>
                    <p style={{ ...dynamicSizes.title }}>{'no projects'}</p>
                    <p style={{ ...dynamicSizes.sadFace }}>{':('}</p>
                </div>
                <div
                    style={{
                        ...dynamicSizes.h2,
                        justifySelf: 'center',
                    }}>
                    <div style={{ display: 'flex', alignItems: "center" }}>
                        <p>Click</p>
                        <div style={{ padding: dynamicSizes.svg.padding }}>
                            <SvgRepo
                                svg={addCircle()}
                                containerSize={{
                                    width: dynamicSizes.svg.size,
                                    height: dynamicSizes.svg.size
                                }}
                                scale={0.9} />
                        </div>
                        <p>to create a new project.</p></div>
                </div>
                <div
                    style={{
                        ...dynamicSizes.h3,
                        justifySelf: 'center',
                    }}>
                    <div >{`Alternatively, go to the workspace and start editing to create a new project automatically.`}</div>
                </div>
            </div>
        </div>
    </>)
}
