import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { env } from "../config/env.js";

/** "Dark mode!" → "dark-mode". Accents are folded, everything else becomes single hyphens. */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 150)
    .replace(/-+$/g, "");
  return slug || "update";
}

/** Escapes user input for use inside a RegExp (search terms). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Turns server-relative upload paths into absolute URLs for feed consumers. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${env.PUBLIC_API_URL}${url}` : url;
}

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "pre",
  "code",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/**
 * Markdown → HTML for the JSON feed. A feed consumer receives HTML, so it must be clean:
 * sanitize-html drops scripts, event handlers and javascript: URLs after rendering.
 */
export function renderMarkdownHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true });
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { img: ["src", "alt", "title"], a: ["href", "title"], code: ["class"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, ...(attribs.src ? { src: absoluteUrl(attribs.src) ?? attribs.src } : {}) },
      }),
    },
  });
}

/** Plain-text summary (no Markdown syntax) for feed readers and previews. */
export function plainSummary(markdown: string, limit = 200): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}
