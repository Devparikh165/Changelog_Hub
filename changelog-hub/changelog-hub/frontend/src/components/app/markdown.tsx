import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

// highlight.js core + a curated grammar set keeps the bundle small (the full build ships ~190).
const LANGUAGES = { bash, css, diff, javascript, json, kotlin, python, sql, typescript, xml, yaml };
for (const [name, grammar] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, grammar);
hljs.registerAliases(["sh", "shell", "zsh"], { languageName: "bash" });
hljs.registerAliases(["js", "jsx"], { languageName: "javascript" });
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
hljs.registerAliases(["html"], { languageName: "xml" });
hljs.registerAliases(["yml"], { languageName: "yaml" });
hljs.registerAliases(["py"], { languageName: "python" });

const components: Components = {
  code: ({ className, children, node: _node, ...props }) => {
    const lang = /language-([\w-]+)/.exec(className ?? "")?.[1];
    const source = String(children ?? "");
    if (lang && hljs.getLanguage(lang)) {
      // hljs escapes the source text, so its HTML output is safe to inject.
      const html = hljs.highlight(source.replace(/\n$/, ""), { language: lang, ignoreIllegals: true }).value;
      return <code {...props} className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return (
      <code {...props} className={className}>
        {children}
      </code>
    );
  },
  img: ({ src, alt, ...props }) => (
    <img {...props} alt={alt ?? ""} decoding="async" loading="lazy" src={assetUrl(typeof src === "string" ? src : undefined)} />
  ),
  a: ({ href, children, ...props }) => {
    const external = href?.startsWith("http");
    return (
      <a {...props} href={href} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
        {children}
      </a>
    );
  },
  table: ({ children, ...props }) => (
    <div className="table-scroll">
      <table {...props}>{children}</table>
    </div>
  ),
};

/** Renders untrusted Markdown safely: react-markdown never injects raw HTML. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-changelog", className)}>
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Strips Markdown for short previews (drawer, admin table). */
export function plainText(markdown: string, max = 140): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*$/gm, " ") // tables
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "") // list markers
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*~]/g, " ")
    .replace(/(^|\s)_+|_+(\s|$)/g, "$1$2") // emphasis underscores, not snake_case
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
