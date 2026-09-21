import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Runs before any test file imports the app, so src/config/env.ts sees these values.
Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-for-hs256",
  JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-for-hs256",
  CORS_ORIGINS: "http://localhost:5173",
  PUBLIC_API_URL: "http://localhost:8000",
  FRONTEND_URL: "http://localhost:5173",
  UPLOAD_DIR: path.join(mkdtempSync(path.join(tmpdir(), "changelog-test-")), "uploads"),
  RATE_LIMIT_ENABLED: "false",
  EMAIL_SIMULATION: "true",
  BCRYPT_ROUNDS: "4",
  ADMIN_EMAIL: "admin@test.dev",
  ADMIN_PASSWORD: "Admin@12345",
});
