#!/usr/bin/env node
// Creates server/.env and frontend/.env from their .env.example templates and fills in
// strong random JWT secrets. Existing .env files are never overwritten.
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const secret = () => randomBytes(48).toString("base64url");

function setup(dir, transform) {
  const target = join(root, dir, ".env");
  if (existsSync(target)) {
    console.log(`• ${dir}/.env already exists, left unchanged`);
    return;
  }
  copyFileSync(join(root, dir, ".env.example"), target);
  if (transform) writeFileSync(target, transform(readFileSync(target, "utf8")));
  console.log(`✔ Created ${dir}/.env`);
}

setup("server", (text) =>
  text
    .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret()}`)
    .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${secret()}`),
);
setup("frontend");

console.log("\nNext: make sure MongoDB is running, then `npm run seed` and `npm run dev`.");
