import mongoose from "mongoose";
import { logger } from "./lib/logger.js";
import "./models/index.js";

/** Connects and makes sure every index (unique slug, one-reaction-per-user…) exists before serving. */
export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8_000 });
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  logger.info(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** Hides credentials when printing a connection string. */
export const redactUri = (uri: string) => uri.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:****@");
