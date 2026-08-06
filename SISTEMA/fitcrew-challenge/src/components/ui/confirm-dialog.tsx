import { AlertTriangle, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
};

type State = {
  open: boolean;
  opts: ConfirmOptions;
  resolve?: (value: boolean) => void;
};

export function useConfirm() {
  const [state, setState] = useState<State>({ open: false, opts: {} });

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    state.resolve?.(value);
    setState((s) => ({ ...s, open: false }));
  };

  const {
    title = "Tem certeza?",
    description = "Essa ação não poderá ser desfeita.",
    confirmLabel = "Excluir",
    cancelLabel = "Cancelar",
    tone = "danger",
  } = state.opts;

  const Icon = tone === "danger" ? Trash2 : AlertTriangle;
  const iconColor =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : "bg-amber-500/10 text-amber-600";
  const btnClass =
    tone === "danger"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : "";

  const dialog: ReactNode = (
    <AlertDialog
      open={state.open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={`grid size-10 shrink-0 place-items-center rounded-full ${iconColor}`}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-left font-display text-lg">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-left text-sm">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel onClick={() => close(false)} className="rounded-full">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => close(true)} className={`rounded-full ${btnClass}`}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
