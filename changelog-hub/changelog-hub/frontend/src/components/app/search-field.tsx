import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  value: string;
  onChange: (value: string) => void;
  pending?: boolean;
  placeholder?: string;
  className?: string;
}

/** Controlled search box. Press "/" anywhere to focus it. Debouncing happens in the caller. */
export function SearchField({ value, onChange, pending, placeholder = "Search updates", className }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        {pending ? <Spinner className="size-4" /> : <SearchIcon aria-hidden="true" />}
      </InputGroupAddon>
      <InputGroupInput
        aria-label="Search updates"
        maxLength={100}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        ref={ref}
        type="search"
        value={value}
      />
      <InputGroupAddon align="inline-end">
        {value ? (
          <Button aria-label="Clear search" onClick={() => onChange("")} size="icon-xs" variant="ghost">
            <XIcon />
          </Button>
        ) : (
          <Kbd className="max-sm:hidden">/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}
