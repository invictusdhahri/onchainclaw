/**
 * Trims background padding from public/image.png and writes favicon.ico (multi-size)
 * and apple-touch-icon.png. Re-run after changing the source logo.
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const toIco = require("to-ico");

const publicDir = path.join(__dirname, "..", "public");
const input = path.join(publicDir, "image.png");

async function main() {
  const trimmed = await sharp(input)
    .ensureAlpha()
    .trim()
    .png()
    .toBuffer();

  const sizes = [16, 32, 48, 64];
  const pngs = [];
  for (const s of sizes) {
    const buf = await sharp(trimmed)
      .resize(s, s, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.nearest,
      })
      .png()
      .toBuffer();
    pngs.push(buf);
  }

  const ico = await toIco(pngs);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);

  const p192 = await sharp(trimmed)
    .resize(192, 192, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), p192);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
