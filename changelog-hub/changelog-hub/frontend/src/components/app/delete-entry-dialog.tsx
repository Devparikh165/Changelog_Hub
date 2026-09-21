import type { ReactElement } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { useDeleteEntry } from "@/features/admin";

interface Props {
  entry: { id: string; title: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteEntryDialog({ entry, onOpenChange, onDeleted }: Props): ReactElement {
  const del = useDeleteEntry();
  const confirm = () => {
    if (!entry) return;
    del.mutate(entry.id, {
      onSuccess: () => {
        toastManager.add({ title: "Update deleted", description: entry.title, type: "success" });
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (err) => toastManager.add({ title: "Couldn't delete", description: err.message, type: "error" }),
    });
  };
  return (
    <AlertDialog onOpenChange={onOpenChange} open={entry !== null}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this update?</AlertDialogTitle>
          <AlertDialogDescription>
            “{entry?.title}” and its reactions will be removed for good. If you only want to hide it, unpublish it
            instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
          <Button loading={del.isPending} onClick={confirm} variant="destructive">
            Delete update
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
