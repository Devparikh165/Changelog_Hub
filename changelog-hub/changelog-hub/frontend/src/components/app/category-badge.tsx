import { Badge } from "@/components/ui/badge";
import { CATEGORY_META } from "@/lib/content";
import type { Category } from "@/lib/types";

export function CategoryBadge({ category, size }: { category: Category; size?: "sm" | "default" | "lg" }) {
  const meta = CATEGORY_META[category];
  return (
    <Badge size={size} variant={meta.badge}>
      {meta.tag}
    </Badge>
  );
}
