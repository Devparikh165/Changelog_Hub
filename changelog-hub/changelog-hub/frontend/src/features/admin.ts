import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdminEntryPage, Entry, EntryInput, EntryStatus } from "@/lib/types";

export const adminKeys = {
  all: ["admin"] as const,
  list: (f: { status: EntryStatus | null; q: string; page: number }) => ["admin", "list", f] as const,
  entry: (id: string) => ["admin", "entry", id] as const,
};

export function useAdminEntries(filters: { status: EntryStatus | null; q: string; page: number }) {
  return useQuery({
    queryKey: adminKeys.list(filters),
    queryFn: ({ signal }) =>
      api<AdminEntryPage>("/api/v1/admin/entries", {
        query: { status: filters.status, q: filters.q, page: filters.page, pageSize: 20 },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminEntry(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.entry(id ?? "new"),
    queryFn: ({ signal }) => api<Entry>(`/api/v1/admin/entries/${id}`, { signal }),
    enabled: Boolean(id),
    staleTime: Number.POSITIVE_INFINITY, // the editor owns this data while open
  });
}

/** Anything that changes content invalidates the public timeline and unread badges too. */
function useInvalidateContent() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: adminKeys.all }),
      qc.invalidateQueries({ queryKey: ["changelog"] }),
      qc.invalidateQueries({ queryKey: ["unread"] }),
    ]);
}

export function useSaveEntry() {
  const qc = useQueryClient();
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<EntryInput> }) =>
      id
        ? api<Entry>(`/api/v1/admin/entries/${id}`, { method: "PATCH", body: data })
        : api<Entry>("/api/v1/admin/entries", { method: "POST", body: data }),
    onSuccess: async (entry) => {
      qc.setQueryData(adminKeys.entry(entry.id), entry);
      await invalidate();
    },
  });
}

export function useSetPublished() {
  const qc = useQueryClient();
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      api<Entry>(`/api/v1/admin/entries/${id}/${publish ? "publish" : "unpublish"}`, { method: "POST" }),
    onSuccess: async (entry) => {
      qc.setQueryData(adminKeys.entry(entry.id), entry);
      await invalidate();
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/admin/entries/${id}`, { method: "DELETE" }),
    onSuccess: async (_r, id) => {
      qc.removeQueries({ queryKey: adminKeys.entry(id) });
      await invalidate();
    },
  });
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await api<{ url: string }>("/api/v1/admin/uploads", { method: "POST", formData: form });
  return res.url;
}

export function entryState(entry: Pick<Entry, "status" | "publishedAt">): "draft" | "scheduled" | "live" {
  if (entry.status === "draft") return "draft";
  if (entry.publishedAt && new Date(entry.publishedAt).getTime() > Date.now()) return "scheduled";
  return "live";
}
