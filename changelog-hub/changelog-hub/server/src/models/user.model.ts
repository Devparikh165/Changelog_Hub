import { type HydratedDocument, type InferSchemaType, Schema, model } from "mongoose";
import { ROLES } from "../config/constants.js";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    /** bcrypt hash; excluded from queries unless selected with `+passwordHash`. */
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "user", required: true },
    isVerified: { type: Boolean, default: false, required: true },
    /** Core of the unread algorithm: anything published after this is unread. */
    lastViewedChangelogAt: { type: Date, default: null },
    /**
     * Embedded in every access token. A password reset bumps it, which invalidates every
     * access token already issued without waiting for the 15-minute expiry.
     */
    tokenVersion: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttrs>;
export const User = model("User", userSchema);
