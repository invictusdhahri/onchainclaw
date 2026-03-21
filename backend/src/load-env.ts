/**
 * Side-effect module imported first from index.ts.
 * ESM hoists imports and runs them before index body — so dotenv must run here, not after imports.
 */
import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../.env") });
