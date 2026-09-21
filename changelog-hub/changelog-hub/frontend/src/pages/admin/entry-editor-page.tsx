import {
  ArrowLeftIcon,
  BoldIcon,
  CodeIcon,
  EllipsisIcon,
  EyeIcon,
  HeadingIcon,
  ImageIcon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  QuoteIcon,
  Trash2Icon,
  UndoIcon,
} from "lucide-react";
import { type ClipboardEvent, type DragEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router";
import { DeleteEntryDialog } from "@/components/app/delete-entry-dialog";
import { EntryArticle } from "@/components/app/entry-article";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { entryState, uploadImage, useAdminEntry, useSaveEntry, useSetPublished } from "@/features/admin";
import { ApiError, assetUrl } from "@/lib/api";
import { CATEGORIES, CATEGORY_META } from "@/lib/content";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/format";
import { type FormatKind, applyFormat, insertAt } from "@/lib/markdown-edit";
import type { Category, Entry, EntryInput, EntryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormState {
  title: string;
  slug: string;
  contentMarkdown: string;
  category: Category;
  coverImage: string | null;
  publishedAt: string | null;
}

const EMPTY: FormState = {
  title: "",
  slug: "",
  contentMarkdown: "",
  category: "new",
  coverImage: null,
  publishedAt: null,
};

const STARTER = `Describe what changed and why it matters to the reader.

- What can people do now?
- Where do they find it?
`;

function fromEntry(e: Entry): FormState {
  return {
    title: e.title,
    slug: e.slug,
    contentMarkdown: e.contentMarkdown,
    category: e.category,
    coverImage: e.coverImage,
    publishedAt: e.publishedAt,
  };
}

const TOOLBAR: { kind: FormatKind; label: string; icon: typeof BoldIcon; keys?: string }[] = [
  { kind: "heading", label: "Heading", icon: HeadingIcon },
  { kind: "bold", label: "Bold", icon: BoldIcon, keys: "⌘B" },
  { kind: "italic", label: "Italic", icon: ItalicIcon, keys: "⌘I" },
  { kind: "link", label: "Link", icon: LinkIcon, keys: "⌘K" },
  { kind: "code", label: "Code", icon: CodeIcon },
  { kind: "list", label: "Bulleted list", icon: ListIcon },
  { kind: "quote", label: "Quote", icon: QuoteIcon },
];

export function EntryEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const loaded = useAdminEntry(id);
  const save = useSaveEntry();
  const setPublished = useSetPublished();

  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, contentMarkdown: STARTER }));
  const [saved, setSaved] = useState<FormState>(() => ({ ...EMPTY, contentMarkdown: STARTER }));
  const [status, setStatus] = useState<EntryStatus>("draft");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [view, setView] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragging, setDragging] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const bodyFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const initializedFor = useRef<string | null>(null);
  const allowNav = useRef(false); // set right before intentional navigations (create → edit, delete)

  // React Router keeps this instance when /admin/new becomes /admin/:id/edit, so re-arm the guard.
  useEffect(() => {
    allowNav.current = false;
  }, [id]);

  // Load the entry into the form once per id.
  useEffect(() => {
    if (loaded.data && initializedFor.current !== loaded.data.id) {
      initializedFor.current = loaded.data.id;
      const state = fromEntry(loaded.data);
      setForm(state);
      setSaved(state);
      setStatus(loaded.data.status);
    }
  }, [loaded.data]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const busy = save.isPending || setPublished.isPending;

  // Warn before losing work: browser tab close and in-app navigation.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowNav.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  // ---------------------------------------------------------------- persistence
  const persist = useCallback(
    async (nextStatus: EntryStatus) => {
      if (!form.title.trim()) {
        setErrors({ title: "Give the update a title." });
        return;
      }
      const payload: Partial<EntryInput> = {
        title: form.title.trim(),
        contentMarkdown: form.contentMarkdown,
        category: form.category,
        coverImage: form.coverImage,
        publishedAt: form.publishedAt,
        status: nextStatus,
      };
      // Empty slug = derive from title. Unchanged slug isn't sent.
      if (isNew) payload.slug = form.slug.trim() || null;
      else if (form.slug !== saved.slug) payload.slug = form.slug.trim() || null;

      try {
        const entry = await save.mutateAsync({ id, data: payload });
        const state = fromEntry(entry);
        setForm(state);
        setSaved(state);
        setStatus(entry.status);
        setErrors({});
        const publishedNow = nextStatus === "published" && status === "draft";
        const scheduled = entryState(entry) === "scheduled";
        toastManager.add({
          title: publishedNow ? (scheduled ? "Scheduled" : "Published") : isNew ? "Draft saved" : "Changes saved",
          description: publishedNow && !scheduled ? "It's live on the timeline now." : undefined,
          type: "success",
        });
        if (isNew) {
          initializedFor.current = entry.id;
          allowNav.current = true;
          navigate(`/admin/${entry.id}/edit`, { replace: true });
        }
      } catch (err) {
        if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
        else if (err instanceof ApiError && err.code === "slug_taken") setErrors({ slug: err.message });
        toastManager.add({ title: "Not saved", description: (err as Error).message, type: "error" });
      }
    },
    [form, saved.slug, isNew, id, save, navigate, status],
  );

  const unpublish = () => {
    if (!id) return;
    setPublished.mutate(
      { id, publish: false },
      {
        onSuccess: (entry) => {
          setStatus(entry.status);
          toastManager.add({ title: "Moved to drafts", description: "It's no longer on the timeline.", type: "success" });
        },
        onError: (err) => toastManager.add({ title: "Couldn't unpublish", description: err.message, type: "error" }),
      },
    );
  };

  // ---------------------------------------------------------------- editor helpers
  const applyEdit = (next: { value: string; selectionStart: number; selectionEnd: number }) => {
    update("contentMarkdown", next.value);
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  };

  const format = (kind: FormatKind) => {
    const el = editorRef.current;
    if (!el) return;
    applyEdit(applyFormat(form.contentMarkdown, el.selectionStart, el.selectionEnd, kind));
  };

  const uploadIntoBody = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    const el = editorRef.current;
    let caret = el?.selectionEnd ?? form.contentMarkdown.length;
    setUploading((n) => n + images.length);
    for (const file of images) {
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
      try {
        const url = await uploadImage(file);
        const snippet = `\n\n![${alt}](${url})\n\n`;
        setForm((f) => {
          const next = insertAt(f.contentMarkdown, caret, caret, snippet);
          caret = next.selectionEnd;
          return { ...f, contentMarkdown: next.value };
        });
      } catch (err) {
        toastManager.add({ title: `Couldn't upload ${file.name}`, description: (err as Error).message, type: "error" });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading((n) => n + 1);
    try {
      update("coverImage", await uploadImage(file));
    } catch (err) {
      toastManager.add({ title: "Cover not uploaded", description: (err as Error).message, type: "error" });
    } finally {
      setUploading((n) => n - 1);
    }
  };

  const onEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const map: Record<string, FormatKind> = { b: "bold", i: "italic", k: "link" };
    const kind = map[e.key.toLowerCase()];
    if (kind) {
      e.preventDefault();
      format(kind);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void uploadIntoBody(files);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    setDragging(false);
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      void uploadIntoBody(Array.from(e.dataTransfer.files));
    }
  };

  // ⌘S / Ctrl+S saves without changing status.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!busy) void persist(status);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist, status, busy]);

  // ---------------------------------------------------------------- render
  if (!isNew && loaded.isPending) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }
  if (!isNew && loaded.isError) {
    return (
      <Empty className="py-24">
        <EmptyHeader>
          <EmptyTitle>Update not found</EmptyTitle>
          <EmptyDescription>{loaded.error.message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/admin" />} size="sm" variant="outline">
            Back to the studio
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const state = entryState({ status, publishedAt: form.publishedAt });
  const isFuture = Boolean(form.publishedAt && new Date(form.publishedAt).getTime() > Date.now());
  const previewEntry: Entry = {
    id: id ?? "preview",
    title: form.title || "Untitled update",
    slug: form.slug || "preview",
    contentMarkdown: form.contentMarkdown,
    category: form.category,
    coverImage: form.coverImage,
    status,
    publishedAt: form.publishedAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: null,
    reactions: { heart: 0, tada: 0, rocket: 0 },
    viewerReactions: [],
  };

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {/* Action bar */}
      <div className="sticky top-14 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:px-6">
          <Button aria-label="Back to the studio" render={<Link to="/admin" />} size="icon-sm" variant="ghost">
            <ArrowLeftIcon />
          </Button>
          <span className="truncate font-medium text-sm">{isNew ? "New update" : saved.title || "Untitled"}</span>
          <Badge className="shrink-0" variant={state === "live" ? "success" : state === "scheduled" ? "info" : "outline"}>
            {state === "live" ? "Live" : state === "scheduled" ? "Scheduled" : "Draft"}
          </Badge>
          <span aria-live="polite" className="ms-1 hidden shrink-0 text-muted-foreground text-xs sm:inline">
            {uploading > 0 ? "Uploading image…" : dirty ? "Unsaved changes" : isNew ? "" : "All changes saved"}
          </span>

          <div className="ms-auto flex items-center gap-2">
            {status === "draft" ? (
              <>
                <Button disabled={busy} onClick={() => persist("draft")} size="sm" variant="outline">
                  Save draft
                </Button>
                <Button loading={save.isPending} onClick={() => persist("published")} size="sm">
                  {isFuture ? "Schedule" : "Publish"}
                </Button>
              </>
            ) : (
              <Button disabled={!dirty} loading={save.isPending} onClick={() => persist("published")} size="sm">
                Update
              </Button>
            )}
            {!isNew && (
              <Menu>
                <MenuTrigger render={<Button aria-label="More actions" size="icon-sm" variant="ghost" />}>
                  <EllipsisIcon />
                </MenuTrigger>
                <MenuPopup align="end">
                  {state === "live" && (
                    <MenuItem onClick={() => window.open(`/updates/${saved.slug}`, "_blank", "noopener")}>
                      <EyeIcon />
                      View on timeline
                    </MenuItem>
                  )}
                  {status === "published" && (
                    <MenuItem onClick={unpublish}>
                      <UndoIcon />
                      Move to drafts
                    </MenuItem>
                  )}
                  <MenuSeparator />
                  <MenuItem onClick={() => setConfirmDelete(true)} variant="destructive">
                    <Trash2Icon />
                    Delete
                  </MenuItem>
                </MenuPopup>
              </Menu>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        {/* Metadata */}
        <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Field invalid={Boolean(errors.title)} name="title">
              <FieldLabel className="sr-only">Title</FieldLabel>
              <Input
                aria-label="Title"
                className="font-heading text-xl sm:text-xl"
                maxLength={160}
                onChange={(e) => update("title", e.target.value)}
                placeholder="What changed?"
                size="lg"
                value={form.title}
              />
              {errors.title && <FieldError match>{errors.title}</FieldError>}
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-sm" id="tag-label">
                Tag
              </span>
              <ToggleGroup
                aria-labelledby="tag-label"
                onValueChange={(v) => v[0] && update("category", v[0] as Category)}
                size="sm"
                value={[form.category]}
                variant="outline"
              >
                {CATEGORIES.map((c) => (
                  <ToggleGroupItem className="gap-1.5 rounded-full px-3" key={c} value={c}>
                    <span aria-hidden="true" className={cn("size-2 rounded-full", CATEGORY_META[c].dot)} />
                    {CATEGORY_META[c].tag}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field invalid={Boolean(errors.slug)} name="slug">
              <FieldLabel>Slug</FieldLabel>
              <Input
                className="font-mono"
                maxLength={180}
                onChange={(e) =>
                  update(
                    "slug",
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-{2,}/g, "-"),
                  )
                }
                placeholder="generated-from-title"
                value={form.slug}
              />
              {errors.slug ? (
                <FieldError match>{errors.slug}</FieldError>
              ) : (
                <FieldDescription>Leave empty to generate it from the title.</FieldDescription>
              )}
            </Field>
            <Field invalid={Boolean(errors.publishedAt)} name="publishedAt">
              <FieldLabel>Publish date</FieldLabel>
              <Input
                onChange={(e) => update("publishedAt", fromLocalInputValue(e.target.value))}
                type="datetime-local"
                value={toLocalInputValue(form.publishedAt)}
              />
              <FieldDescription>
                {errors.publishedAt ?? "Empty publishes immediately. A future date schedules it."}
              </FieldDescription>
            </Field>

            <div className="sm:col-span-2">
              <span className="mb-2 block font-medium text-sm">Cover image</span>
              <input
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  void uploadCover(e.target.files?.[0]);
                  e.target.value = "";
                }}
                ref={coverFileRef}
                type="file"
              />
              {form.coverImage ? (
                <div className="flex items-center gap-3">
                  <img alt="" className="h-14 w-24 rounded-md border object-cover" src={assetUrl(form.coverImage)} />
                  <Button onClick={() => coverFileRef.current?.click()} size="sm" variant="outline">
                    Replace
                  </Button>
                  <Button onClick={() => update("coverImage", null)} size="sm" variant="ghost">
                    Remove
                  </Button>
                </div>
              ) : (
                <Button onClick={() => coverFileRef.current?.click()} size="sm" variant="outline">
                  <ImagePlusIcon />
                  Add cover image
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: switch between writing and preview. Desktop shows both side by side. */}
        <Tabs className="mb-3 lg:hidden" onValueChange={(v) => setView(v as "write" | "preview")} value={view}>
          <TabsList>
            <TabsTab value="write">Write</TabsTab>
            <TabsTab value="preview">Preview</TabsTab>
          </TabsList>
        </Tabs>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <section aria-label="Markdown editor" className={cn("min-w-0", view !== "write" && "max-lg:hidden")}>
            <div className="mb-2 flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/50 p-1">
              {TOOLBAR.map(({ kind, label, icon: Icon, keys }) => (
                <Tooltip key={kind}>
                  <TooltipTrigger
                    render={<Button aria-label={label} onClick={() => format(kind)} size="icon-sm" variant="ghost" />}
                  >
                    <Icon />
                  </TooltipTrigger>
                  <TooltipPopup>
                    {label} {keys && <Kbd className="ms-1">{keys}</Kbd>}
                  </TooltipPopup>
                </Tooltip>
              ))}
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
              <input
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                multiple
                onChange={(e) => {
                  void uploadIntoBody(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
                ref={bodyFileRef}
                type="file"
              />
              <Button loading={uploading > 0} onClick={() => bodyFileRef.current?.click()} size="sm" variant="ghost">
                <ImageIcon />
                Image
              </Button>
            </div>
            <div
              className={cn("relative rounded-lg transition-shadow", dragging && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
              onDragLeave={() => setDragging(false)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files")) {
                  e.preventDefault();
                  setDragging(true);
                }
              }}
              onDrop={onDrop}
            >
              <Textarea
                aria-label="Update content in Markdown"
                className="font-mono"
                onChange={(e) => update("contentMarkdown", e.target.value)}
                onKeyDown={onEditorKeyDown}
                onPaste={onPaste}
                placeholder="Write in Markdown…"
                ref={editorRef}
                spellCheck
                style={{ minHeight: "28rem", lineHeight: 1.65 }}
                value={form.contentMarkdown}
              />
            </div>
            <p className="mt-2 text-muted-foreground text-xs">
              Markdown with tables and code blocks. Paste or drop images to upload them. <Kbd>⌘S</Kbd> saves.
            </p>
          </section>

          {/* Live preview */}
          <section
            aria-label="Live preview"
            className={cn("min-w-0 rounded-xl border bg-card p-5 sm:p-8", view !== "preview" && "max-lg:hidden")}
          >
            <p className="mb-6 font-medium text-muted-foreground text-xs">Preview</p>
            <EntryArticle entry={previewEntry} layout="stacked" linkTitle={false} preview />
          </section>
        </div>
      </div>

      {id && (
        <DeleteEntryDialog
          entry={confirmDelete ? { id, title: saved.title } : null}
          onDeleted={() => {
            allowNav.current = true; // nothing left to lose; skip the unsaved-changes prompt
            navigate("/admin", { replace: true });
          }}
          onOpenChange={setConfirmDelete}
        />
      )}

      <AlertDialog onOpenChange={(open) => !open && blocker.state === "blocked" && blocker.reset()} open={blocker.state === "blocked"}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your unsaved changes to this update will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Keep editing</AlertDialogClose>
            <Button onClick={() => blocker.state === "blocked" && blocker.proceed()} variant="destructive">
              Discard changes
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
