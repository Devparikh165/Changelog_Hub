export type FormatKind = "bold" | "italic" | "heading" | "link" | "code" | "list" | "quote";

export interface EditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Applies a Markdown format to the current selection and returns the new text + selection. */
export function applyFormat(value: string, start: number, end: number, kind: FormatKind): EditResult {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const wrap = (left: string, right: string, placeholder: string): EditResult => {
    const inner = selected || placeholder;
    return {
      value: `${before}${left}${inner}${right}${after}`,
      selectionStart: start + left.length,
      selectionEnd: start + left.length + inner.length,
    };
  };

  const prefixLines = (prefix: string): EditResult => {
    const lineStart = before.lastIndexOf("\n") + 1;
    const block = value.slice(lineStart, end) || "";
    const prefixed = block
      .split("\n")
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : `${prefix}${l}`))
      .join("\n");
    const next = value.slice(0, lineStart) + prefixed + after;
    return { value: next, selectionStart: lineStart, selectionEnd: lineStart + prefixed.length };
  };

  switch (kind) {
    case "bold":
      return wrap("**", "**", "bold text");
    case "italic":
      return wrap("_", "_", "italic text");
    case "link": {
      const label = selected || "link text";
      const text = `[${label}](https://)`;
      const urlStart = start + label.length + 3;
      return { value: before + text + after, selectionStart: urlStart, selectionEnd: urlStart + 8 };
    }
    case "code":
      return selected.includes("\n") || !selected
        ? wrap("\n```ts\n", "\n```\n", "// code")
        : wrap("`", "`", "code");
    case "heading":
      return prefixLines("## ");
    case "list":
      return prefixLines("- ");
    case "quote":
      return prefixLines("> ");
  }
}

export function insertAt(value: string, start: number, end: number, text: string): EditResult {
  const next = value.slice(0, start) + text + value.slice(end);
  const caret = start + text.length;
  return { value: next, selectionStart: caret, selectionEnd: caret };
}
