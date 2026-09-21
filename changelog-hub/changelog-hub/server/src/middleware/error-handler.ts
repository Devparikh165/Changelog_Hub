import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { ValidationError } from "./validate.js";

function send(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ detail: { code, message } });
}

export function notFoundHandler(req: Request, res: Response): void {
  send(res, 404, "not_found", `No route for ${req.method} ${req.path}`);
}

/** Every error leaves the API in one of two shapes: `{detail: {code, message}}` or, for 422, `{detail: [issues]}`. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof HttpError) return send(res, err.status, err.code, err.message);
  if (err instanceof ValidationError) {
    res.status(422).json({ detail: err.issues });
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return send(res, 413, "file_too_large", `Images must be ${env.MAX_UPLOAD_MB} MB or smaller`);
    }
    return send(res, 400, "bad_upload", err.message);
  }
  if (err instanceof mongoose.Error.CastError) return send(res, 404, "not_found", "Not found");

  const e = err as { code?: number; type?: string; status?: number };
  if (e?.code === 11000) return send(res, 409, "duplicate", "That already exists");
  if (e?.type === "entity.parse.failed") return send(res, 400, "invalid_json", "Request body is not valid JSON");
  if (e?.type === "entity.too.large") return send(res, 413, "payload_too_large", "Request body is too large");
  // Client errors raised by Express itself (e.g. a missing file under /uploads).
  if (typeof e?.status === "number" && e.status >= 400 && e.status < 500) {
    return send(res, e.status, e.status === 404 ? "not_found" : "bad_request", e.status === 404 ? "Not found" : "Bad request");
  }

  logger.error(`${req.method} ${req.originalUrl}`, err);
  send(res, 500, "internal_error", "Something went wrong on our side. Please try again.");
}
