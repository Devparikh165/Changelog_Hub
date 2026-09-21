import { type HydratedDocument, type InferSchemaType, Schema, model } from "mongoose";
import { CATEGORIES, ENTRY_STATUSES, REACTION_KEYS } from "../config/constants.js";

const entrySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, maxlength: 180 },
    /** Markdown source. The web app renders it without raw HTML; the feed sanitizes it. */
    contentMarkdown: { type: String, default: "", maxlength: 100_000 },
    category: { type: String, enum: CATEGORIES, default: "new", required: true },
    coverImage: { type: String, default: null, maxlength: 500 },
    status: { type: String, enum: ENTRY_STATUSES, default: "draft", required: true },
    /** A future date schedules the release: it stays hidden until that moment. */
    publishedAt: { type: Date, default: null },
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Public timeline, unread counts and the feed all filter on status + publishedAt.
entrySchema.index({ status: 1, publishedAt: -1 });
entrySchema.index({ category: 1, status: 1, publishedAt: -1 });

export type EntryAttrs = InferSchemaType<typeof entrySchema>;
export type EntryDocument = HydratedDocument<EntryAttrs>;
export const Entry = model("ChangelogEntry", entrySchema);

const reactionSchema = new Schema(
  {
    entry: { type: Schema.Types.ObjectId, ref: "ChangelogEntry", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, enum: REACTION_KEYS, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
// One reaction of each kind per person per entry, enforced by the database itself.
reactionSchema.index({ entry: 1, user: 1, emoji: 1 }, { unique: true });
reactionSchema.index({ entry: 1, emoji: 1 });

export const Reaction = model("Reaction", reactionSchema);
