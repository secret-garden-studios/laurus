import { useRef, useEffect, useState, RefObject } from "react";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
  }
}
interface YouTubePlayer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRefs: RefObject<Map<string, any>>;
  muted: boolean;
  autoplay: boolean;
  videoId: string;
  videoMediaId: string;
  width: number;
  height: number;
  start: number;
  end: number;
  filter: string;
  onVideoEnded: (videoId: string) => void;
  onReady: (newDuration: number) => void;
  onNewPlaying: (newPlaying: boolean) => void;
}
export default function YouTubePlayer({
  playerRefs,
  muted,
  autoplay,
  videoId,
  videoMediaId,
  width,
  height,
  start,
  end,
  filter,
  onVideoEnded,
  onReady,
  onNewPlaying,
}: YouTubePlayer) {
  const [src] = useState(() => {
    const autoplayStr = autoplay ? "1" : "0";
    const mutedStr = muted ? "1" : "0";
    const disableControls = "&controls=0&disablekb=1&modestbranding=1";
    let src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${autoplayStr}&mute=${mutedStr}${disableControls}`;
    if (start >= 0) {
      src += `&start=${Math.round(start)}`;
    }
    if (end >= 0) {
      src += `&end=${Math.round(end)}`;
    }
    if (typeof window !== "undefined") {
      src += `&origin=${window.location.origin}`;
    }
    return src;
  });
  const [allow] = useState("autoplay; encrypted-media; compute-pressure");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onYTPlayerStateChange(event: any) {
    const localPlayer = event.target;
    if (window.YT?.PlayerState && localPlayer?.playerInfo?.videoData) {
      switch (event.data) {
        case window.YT.PlayerState.PLAYING: {
          onNewPlaying(true);
          break;
        }
        case window.YT.PlayerState.PAUSED: {
          onNewPlaying(false);
          break;
        }
        case window.YT.PlayerState.BUFFERING:
        case window.YT.PlayerState.CUED:
        case window.YT.PlayerState.UNSTARTED: {
          break;
        }
        case window.YT.PlayerState.ENDED: {
          onVideoEnded(videoId);
          break;
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onYTPlayerReady(e: any) {
    playerRefs.current.set(videoMediaId, e.target);
    if (typeof e.target.getDuration === "function") {
      const newDuration: number = parseFloat(e.target.getDuration() || -1) || -1;
      onReady(newDuration);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onYTPlayerError(e: any) {
    console.log("youtube player error:", e.data);
  }

  useEffect(() => {
    if (!iframeRef.current) return;
    if (!playerRefs.current.has(videoMediaId)) {
      playerRefs.current.set(
        videoMediaId,
        new window.YT.Player(iframeRef.current, {
          events: {
            onReady: onYTPlayerReady,
            onStateChange: onYTPlayerStateChange,
            onError: onYTPlayerError,
          },
        }),
      );
    }
  });

  return (
    <iframe
      ref={iframeRef}
      style={{
        border: "none",
        borderRadius: 10,
        filter,
      }}
      width={width}
      height={height}
      src={src}
      allow={allow}
      allowFullScreen
    />
  );
}
