import { readPublicFile } from "@/lib/read-public-file";

/** Site-wide default Open Graph PNG — replace `public/og-image.png` (1200×630) with your design. */
export async function readOgDefaultPng(): Promise<Buffer> {
  return readPublicFile("og-image.png");
}
