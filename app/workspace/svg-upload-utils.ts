import { Dispatch } from "react";
import { createSvg, LaurusSvgResult } from "./workspace.server";
import { LaurusTool, UIAction, UIActionType, UIState, defaultMarqueeTool } from "./states/ui-state";

// Lives in its own module (rather than browsers/media-browser.tsx, its original home) so
// workspace.client.tsx can import createAndRegisterSvg too without a circular import --
// media-browser.tsx already imports CoreContext/UIContext from workspace.client.tsx, so the
// reverse import would cycle.

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

export async function rasterizeSvg(svgXml: string, width: number = 1120, height: number = 1120): Promise<string> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const pngDataUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(url);
      resolve(pngDataUrl);
    };

    img.onerror = (err) => {
      console.log({ err });
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Turns a to-be-uploaded svg into a saved, browsable LaurusSvgResult and switches the tool to
 * marquee so it's ready to drop -- the shared tail of handleUpload's svg branch (rasterize ->
 * createSvg -> register in the browser -> arm the marquee tool), factored out so the
 * light-source-capture tool (canvas.tsx/workspace.client.tsx) can reuse it for a programmatically-generated
 * svg instead of a real dropped .svg file. `svgFile` is sent to the server as-is (a real dropped
 * File for uploads, or a synthetic `new File([markup], ...)` for generated markup); `svgString`
 * is only used client-side to rasterize the PNG preview, and must be a complete `<svg>...</svg>`
 * document -- the server strips the root tag and derives viewbox/fill/stroke on the way back.
 */
export async function createAndRegisterSvg(
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  uiState: Pick<UIState, "browserSvgs" | "tool">,
  uiDispatch: Dispatch<UIAction>,
  // Called immediately after any SetTool dispatch so every mounted mask can react to the tool
  // change imperatively (see project-mask-item.tsx) -- media-browser.tsx passes its
  // CoreContext.notifyMaskToolChanged through here.
  notifyMaskToolChanged: (toolType: string) => void,
  svgFile: File,
  svgString: string,
  width: number,
  height: number,
  filenameBase: string,
  // Uploads want the marquee tool armed afterward, ready for the user to drop the new svg --
  // captures (canvas.tsx's light-source-capture tool) place their result directly with no manual drop
  // step, so they pass false and drive their own post-creation tool state instead.
  switchToMarquee: boolean = true,
): Promise<LaurusSvgResult | undefined> {
  try {
    const pngDataUrl = await rasterizeSvg(svgString, width, height);
    const rasterFile = dataUrlToFile(pngDataUrl, `${filenameBase}.png`);
    const created = await createSvg(apiOrigin, accessToken, { svg: svgFile, raster: rasterFile });
    if (!created) return undefined;
    const existingSvg = uiState.browserSvgs.find((v) => v.media_key === created.media_key);
    if (existingSvg && existingSvg.svg_media_id !== created.svg_media_id) {
      uiDispatch({ type: UIActionType.DeleteBrowserSvg, value: existingSvg.svg_media_id });
    }
    uiDispatch({ type: UIActionType.AddBrowserSvg, value: created, first: false });
    uiDispatch({ type: UIActionType.SetBrowserElement, value: { type: "svg", value: { ...created } } });
    if (switchToMarquee) {
      const currentTool = { ...uiState.tool };
      const newTool: LaurusTool = currentTool.type == "marquee" ? currentTool : defaultMarqueeTool;
      uiDispatch({ type: UIActionType.SetTool, value: newTool });
      notifyMaskToolChanged(newTool.type);
    }
    return created;
  } catch (err) {
    console.error("svg creation error", err);
    return undefined;
  }
}
