import { readFile } from "node:fs/promises";
import path from "node:path";

/** Read a file from `public/` (avoids same-origin `fetch` deadlocks inside Next OG routes). */
export async function readPublicFile(fileName: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "public", fileName));
}
