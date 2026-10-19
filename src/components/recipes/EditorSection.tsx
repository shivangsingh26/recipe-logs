import { useId, type ReactNode } from "react";
import { Card, SectionLabel } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export interface EditorSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/** A labelled card group in the recipe editor (iOS grouped-form style). */
export function EditorSection({ title, children, className }: EditorSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <SectionLabel id={id} className="mb-2">
        {title}
      </SectionLabel>
      <Card className={cn("space-y-4 p-4", className)}>{children}</Card>
    </section>
  );
}
