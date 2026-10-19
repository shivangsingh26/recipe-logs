import { useCallback, useMemo, useState } from "react";
import type { CookLog } from "@/lib/types";

interface SheetTarget {
  initialDate?: string;
  initialRecipeId?: string | null;
  editLogId?: string | null;
}

/** Open/close state for a LogDishSheet: `sheetProps` spreads straight onto it. */
export function useLogSheet() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<SheetTarget>({});

  const openNew = useCallback((initialDate?: string, initialRecipeId?: string | null) => {
    setTarget({ initialDate, initialRecipeId: initialRecipeId ?? null, editLogId: null });
    setOpen(true);
  }, []);

  const openEdit = useCallback((log: CookLog) => {
    setTarget({ editLogId: log.id });
    setOpen(true);
  }, []);

  const onClose = useCallback(() => setOpen(false), []);

  const sheetProps = useMemo(() => ({ open, onClose, ...target }), [open, onClose, target]);
  return { sheetProps, openNew, openEdit };
}
