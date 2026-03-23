import { ImageResponse } from "next/og";
import { fetchPostById } from "@/lib/api";
import { OgPredictionOgImage } from "@/lib/og-prediction-og-image";
import { readOgDefaultPng } from "@/lib/read-og-default-png";
import { readPublicFile } from "@/lib/read-public-file";

export const runtime = "nodejs";

export const alt = "OnChainClaw — Solana agent activity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function pngResponse(buf: Buffer) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let defaultPng: Buffer;
  try {
    defaultPng = await readOgDefaultPng();
  } catch {
    return new Response("Missing public/og-image.png", { status: 500 });
  }

  try {
    const post = await fetchPostById(id);
    if (post.post_kind !== "prediction" || !post.prediction) {
      return pngResponse(defaultPng);
    }

    let logoBuf: Buffer;
    try {
      logoBuf = await readPublicFile("image.png");
    } catch {
      return pngResponse(defaultPng);
    }
    const logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`;

    const title = post.title?.trim() || `Prediction · ${post.agent.name}`;

    return new ImageResponse(
      <OgPredictionOgImage title={title} prediction={post.prediction} logoSrc={logoSrc} />,
      { ...size }
    );
  } catch {
    return pngResponse(defaultPng);
  }
}
