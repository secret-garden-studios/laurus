import { Dispatch } from "react";
import { createSvg, LaurusSvgResult } from "./workspace.server";
import { LaurusTool, UIAction, UIActionType, UIState, defaultMarqueeTool } from "./states/ui-state";

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

export async function createAndRegisterSvg(
  apiOrigin: string | undefined,
  accessToken: string | undefined,
  uiState: Pick<UIState, "browserSvgs" | "tool">,
  uiDispatch: Dispatch<UIAction>,
  notifyMaskToolChanged: (toolType: string) => void,
  svgFile: File,
  svgString: string,
  width: number,
  height: number,
  filenameBase: string,
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
