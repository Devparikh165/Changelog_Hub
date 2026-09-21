import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { noStore, originGuard } from "./middleware/security.js";
import { apiRouter } from "./routes/index.js";

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."); // server/ from src/ or dist/

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  // Interactive API docs (Swagger UI), registered before helmet's strict CSP.
  const specFile = path.join(serverRoot, "openapi.yaml");
  if (existsSync(specFile)) {
    const spec = YAML.parse(readFileSync(specFile, "utf8")) as object;
    app.get("/openapi.json", (_req, res) => res.json(spec));
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: `${env.APP_NAME} API` }));
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (env.NODE_ENV === "development") app.use(morgan("dev"));

  // Uploaded images. Cross-origin readable so feed readers and the embedded widget can show them.
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  mkdirSync(uploadDir, { recursive: true });
  app.use(
    "/uploads",
    helmet.crossOriginResourcePolicy({ policy: "cross-origin" }),
    express.static(uploadDir, { fallthrough: false, maxAge: "7d", index: false }),
  );

  // A bare GET / would otherwise answer "Cannot GET /", which looks like a broken server to
  // anyone opening the API in a browser. Point them at the web app and the docs instead.
  app.get("/", (_req, res) => {
    res.json({
      name: `${env.APP_NAME} API`,
      status: "ok",
      message: "This is the API. The web app runs separately (npm run dev) — see webApp below.",
      webApp: env.CORS_ORIGINS[0] ?? "http://localhost:5173",
      docs: `${env.PUBLIC_API_URL}/docs`,
      health: `${env.PUBLIC_API_URL}/api/v1/health`,
      endpoints: {
        timeline: "/api/v1/changelog",
        feed: "/api/v1/changelog/feed",
        auth: "/api/v1/auth/*",
        admin: "/api/v1/admin/* (admin role required)",
      },
    });
  });

  app.use("/api/v1", noStore, originGuard, apiRouter);
  app.use("/api", notFoundHandler);
  app.use(errorHandler);
  return app;
}
