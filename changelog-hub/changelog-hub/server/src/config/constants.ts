export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORIES = ["new", "improved", "fixed"] as const;
export type Category = (typeof CATEGORIES)[number];

/** How categories are shown as tags (#New, #Improved, #Fixed), e.g. in the JSON feed. */
export const CATEGORY_TAGS: Record<Category, string> = { new: "#New", improved: "#Improved", fixed: "#Fixed" };

export const ENTRY_STATUSES = ["draft", "published"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** Stored as stable keys; the UI maps them to ❤️ 🎉 🚀. */
export const REACTION_KEYS = ["heart", "tada", "rocket"] as const;
export type ReactionKey = (typeof REACTION_KEYS)[number];

export const TOKEN_PURPOSES = ["verify_email", "reset_password"] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];
