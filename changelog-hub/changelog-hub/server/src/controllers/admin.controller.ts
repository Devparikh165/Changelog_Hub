import type { Request, Response } from "express";
import { parse } from "../middleware/validate.js";
import * as entries from "../services/entry.service.js";
import { adminListQuery, entryCreateSchema, entryUpdateSchema } from "../validation/schemas.js";

// Mounted behind requireAdmin, so `req.user` is always an admin here.

export async function list(req: Request, res: Response) {
  res.json(await entries.listAll(parse(adminListQuery, req.query, "query"), req.user!));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await entries.createEntry(parse(entryCreateSchema, req.body, "body"), req.user!));
}

export async function get(req: Request, res: Response) {
  res.json(await entries.getEntry(String(req.params.id), req.user!));
}

export async function update(req: Request, res: Response) {
  const body = parse(entryUpdateSchema, req.body, "body");
  // Only keys the client actually sent count as changes (so omitted ≠ null).
  const sent = new Set(Object.keys((req.body ?? {}) as object));
  const changes = Object.fromEntries(Object.entries(body).filter(([key]) => sent.has(key)));
  res.json(await entries.updateEntry(String(req.params.id), changes, req.user!));
}

export async function publish(req: Request, res: Response) {
  res.json(await entries.setPublished(String(req.params.id), true, req.user!));
}

export async function unpublish(req: Request, res: Response) {
  res.json(await entries.setPublished(String(req.params.id), false, req.user!));
}

export async function remove(req: Request, res: Response) {
  await entries.deleteEntry(String(req.params.id));
  res.status(204).end();
}

export async function upload(req: Request, res: Response) {
  res.status(201).json(await entries.saveUpload(req.file));
}
