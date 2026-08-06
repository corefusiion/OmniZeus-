/**
 * Render a DOM node to PNG and either share via Web Share API
 * (mobile → opens Instagram / WhatsApp story picker) or fall back to download.
 */
export async function renderAndShare({
  node,
  filename,
  title,
  text,
}: {
  node: HTMLElement;
  filename: string;
  title?: string;
  text?: string;
}): Promise<{ shared: boolean }> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#0a0a0a",
  });
  if (!blob) throw new Error("Falha ao gerar imagem.");

  const file = new File([blob], filename, { type: "image/png" });

  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (data: ShareData) => boolean }) : null;
  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text });
      return { shared: true };
    } catch {
      // user canceled — fall through to download
    }
  }

  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { shared: false };
}
