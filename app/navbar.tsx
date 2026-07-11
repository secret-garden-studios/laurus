"use client";
import { usePathname } from "next/navigation";
import { LaurusResolution } from "./landing.boot";
import { useRouter } from "next/navigation";
import { accountBox200, cardsStack200, desktopMac300 } from "./svg-repo";
import ToolbarButton from "./components/toolbar-button";
import { useRef } from "react";

interface Navbar {
  resolution: LaurusResolution;
  guest: boolean;
}
export default function Navbar({ resolution, guest }: Navbar) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={containerRef} style={{ cursor: "pointer" }}>
      <ToolbarButton
        selected={false}
        svg={{ svg: accountBox200(), scale: 0.6, cursor: "" }}
        onClick={() => {
          if (containerRef.current) {
            containerRef.current.style.cursor = "wait";
          }
          router.push(!guest ? "/" : "/?guest=true");
        }}
        resolution={resolution}
        title="landing page"
      />
      <ToolbarButton
        selected={pathname == "/projects"}
        svg={{ svg: cardsStack200(), scale: 0.6, cursor: "" }}
        onClick={() => {
          if (pathname == "/projects") return;
          if (containerRef.current) {
            containerRef.current.style.cursor = "wait";
          }
          router.push(!guest ? "/projects" : "/projects?guest=true");
        }}
        resolution={resolution}
        title="projects page"
      />
      <ToolbarButton
        selected={pathname == "/workspace"}
        svg={{ svg: desktopMac300(), scale: 0.55, cursor: "" }}
        onClick={() => {
          if (pathname == "/workspace") return;
          if (containerRef.current) {
            containerRef.current.style.cursor = "wait";
          }
          router.push(!guest ? "/workspace" : "/workspace?guest=true");
        }}
        resolution={resolution}
        title="workspace"
      />
    </div>
  );
}
