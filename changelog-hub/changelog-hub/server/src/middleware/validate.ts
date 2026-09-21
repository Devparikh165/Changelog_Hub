import { type ZodType, z } from "zod";

export interface FieldIssue {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/** 422 with one entry per invalid field: `{ detail: [{ loc: ["body", "title"], msg, type }] }`. */
export class ValidationError extends Error {
  readonly issues: FieldIssue[];
  constructor(issues: FieldIssue[]) {
    super(issues[0]?.msg ?? "Invalid input");
    this.issues = issues;
  }
}

/**
 * Parses request input with a Zod schema. `where` becomes the first element of each issue's
 * `loc`, so the client can tell body fields from query parameters and highlight the right one.
 */
export function parse<S extends ZodType>(schema: S, data: unknown, where: "body" | "query" | "path"): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  throw new ValidationError(
    result.error.issues.map((issue) => ({
      loc: [where, ...issue.path.map((p) => (typeof p === "number" ? p : String(p)))],
      msg: issue.message,
      type: issue.code,
    })),
  );
}
