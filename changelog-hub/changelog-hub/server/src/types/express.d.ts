import type { Types } from "mongoose";
import type { Role } from "../config/constants.js";

export interface AuthUser {
  _id: Types.ObjectId;
  id: string;
  email: string;
  name: string;
  role: Role;
  isVerified: boolean;
  lastViewedChangelogAt: Date | null;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` when a valid access token is present. */
      user?: AuthUser;
    }
  }
}
