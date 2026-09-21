import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase, redactUri } from "./db.js";
import { logger } from "./lib/logger.js";
import { ensureAdmin } from "./services/auth.service.js";

async function main(): Promise<void> {
  try {
    await connectDatabase(env.MONGODB_URI);
  } catch (err) {
    logger.error(
      `Could not connect to MongoDB at ${redactUri(env.MONGODB_URI)}.\n` +
        "  • Is MongoDB running? Start the MongoDB service, or `npm run db:up` if you use Docker.\n" +
        "  • Using Atlas? Check MONGODB_URI in server/.env and that your IP is allowed under Network Access.\n",
      (err as Error).message,
    );
    process.exit(1);
  }
  await ensureAdmin();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API ready on http://localhost:${env.PORT}  (docs: http://localhost:${env.PORT}/docs)`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    logger.error(
      err.code === "EADDRINUSE"
        ? `Port ${env.PORT} is already in use. Stop the other process or change PORT in server/.env.`
        : `HTTP server error: ${err.message}`,
    );
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down…`);
    server.close();
    server.closeAllConnections();
    await disconnectDatabase();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
