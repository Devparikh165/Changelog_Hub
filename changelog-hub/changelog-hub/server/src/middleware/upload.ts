import multer from "multer";
import { env } from "../config/env.js";

/**
 * Image uploads are held in memory (at most MAX_UPLOAD_MB), sniffed by their magic bytes,
 * and only then written to disk. The client's Content-Type header is never trusted.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
}).single("file");

const SIGNATURES: [number[], string, string][] = [
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png", ".png"],
  [[0xff, 0xd8, 0xff], "image/jpeg", ".jpg"],
  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], "image/gif", ".gif"],
  [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "image/gif", ".gif"],
];

/** Identifies PNG, JPEG, GIF and WebP from the file's first bytes. SVG is refused on purpose (it can carry scripts). */
export function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
  for (const [signature, mime, ext] of SIGNATURES) {
    if (signature.every((byte, i) => buffer[i] === byte)) return { mime, ext };
  }
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") {
    return { mime: "image/webp", ext: ".webp" };
  }
  return null;
}
