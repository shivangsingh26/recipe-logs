"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** `if (await confirm({ title: "Delete recipe?", tone: "danger" })) …` */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

interface Pending extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((previous) => {
          previous?.resolve(false);
          return { ...options, resolve };
        });
      }),
    [],
  );

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => settle(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={pending?.tone === "danger" ? "danger" : "primary"} fullWidth onClick={() => settle(true)}>
              {pending?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        }
      >
        {pending?.body ? <div className="text-[15px] leading-relaxed text-muted">{pending.body}</div> : null}
      </Sheet>
    </ConfirmContext.Provider>
  );
}
