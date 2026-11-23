import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="80" y="90" width="864" height="864" rx="194" fill="#b8c9e7"/>
  <rect x="80" y="80" width="864" height="864" rx="194" fill="#f0f5ff"/>
  <path d="M176 622 512 425 848 622 512 819Z" fill="#dbe7fb"/>
  <path d="M176 566 512 369 848 566 512 763Z" fill="#629bff"/>
  <path d="M176 566 512 763 512 805 176 608Z" fill="#2f6fed"/>
  <path d="M512 763 848 566 848 608 512 805Z" fill="#1948a4"/>
  <path d="M252 385 512 233 772 385 512 537Z" fill="#2f6fed"/>
  <path d="M252 385 512 537 512 704 252 552Z" fill="#4b87f5"/>
  <path d="M512 537 772 385 772 552 512 704Z" fill="#1948a4"/>
  <path d="M354 385 512 293 670 385 512 477Z" fill="#fff"/>
  <path d="M417 385 512 330 607 385 512 440Z" fill="#2f6fed"/>
</svg>`;

const temp = await mkdtemp(join(tmpdir(), "cadence-icon-"));
const iconset = join(temp, "Cadence.iconset");
const output = join(import.meta.dir, "../build");

try {
  await mkdir(iconset);
  await mkdir(output, { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const suffix = scale === 2 ? "@2x" : "";
      await sharp(Buffer.from(svg)).resize(size * scale, size * scale).png().toFile(join(iconset, `icon_${size}x${size}${suffix}.png`));
    }
  }
  await Bun.$`iconutil -c icns ${iconset} -o ${join(output, "icon.icns")}`;
  await copyFile(join(iconset, "icon_512x512@2x.png"), join(output, "icon.png"));
} finally {
  await rm(temp, { recursive: true, force: true });
}
