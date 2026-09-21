import type { BadgeProps } from "@/components/ui/badge";
import type { Category, ReactionKey } from "@/lib/types";

export const PRODUCT_NAME: string = import.meta.env.VITE_PRODUCT_NAME || "Tempo";

export const CATEGORIES: Category[] = ["new", "improved", "fixed"];

export const CATEGORY_META: Record<
  Category,
  { tag: string; label: string; badge: NonNullable<BadgeProps["variant"]>; dot: string; description: string }
> = {
  new: { tag: "#New", label: "New", badge: "success", dot: "bg-cat-new", description: "Features you didn't have before" },
  improved: {
    tag: "#Improved",
    label: "Improved",
    badge: "info",
    dot: "bg-cat-improved",
    description: "Existing features that got better",
  },
  fixed: { tag: "#Fixed", label: "Fixed", badge: "warning", dot: "bg-cat-fixed", description: "Bugs we squashed" },
};

export const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: "heart", emoji: "❤️", label: "Love it" },
  { key: "tada", emoji: "🎉", label: "Celebrate" },
  { key: "rocket", emoji: "🚀", label: "Ship it" },
];

export function isCategory(value: string | null): value is Category {
  return value === "new" || value === "improved" || value === "fixed";
}
