/**
 * An error that maps directly to an HTTP response. The body shape is the API contract the
 * React app relies on: `{ "detail": { "code": "snake_case", "message": "Human readable" } }`.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const apiError = (status: number, code: string, message: string) => new HttpError(status, code, message);
export const notFound = (message = "Update not found") => new HttpError(404, "not_found", message);
