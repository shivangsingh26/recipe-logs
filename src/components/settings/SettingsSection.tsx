import { useId, type ReactNode, type Ref } from "react";
import { Card, SectionLabel } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export interface SettingsSectionProps {
  /** Anchor for deep links, e.g. "/settings/#gemini". */
  id?: string;
  title: string;
  children: ReactNode;
  /** Small print under the card. */
  footnote?: ReactNode;
  /** Classes for the card, e.g. "divide-y divide-line" for a list of rows. */
  className?: string;
}

/** A labelled group of settings: uppercase label, then one card. */
export function SettingsSection({ id: anchor, title, children, footnote, className }: SettingsSectionProps) {
  const id = useId();
  return (
    <section id={anchor} aria-labelledby={id} className="flex scroll-mt-24 flex-col gap-2">
      <SectionLabel id={id}>{title}</SectionLabel>
      <Card className={cn("px-4", className)}>{children}</Card>
      {footnote && <p className="px-1 text-[13px] leading-snug text-muted">{footnote}</p>}
    </section>
  );
}

export interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** Trailing control or value. */
  children?: ReactNode;
  className?: string;
  /**
   * Lets the row take focus programmatically, for rows whose button disappears after it
   * did its job (e.g. "Enable" → "On"), so focus isn't dropped to the page.
   */
  ref?: Ref<HTMLDivElement>;
}

/** One row inside a settings card: label + description on the left, a control on the right. */
export function SettingsRow({ label, description, children, className, ref }: SettingsRowProps) {
  return (
    <div
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      className={cn("flex min-h-14 items-center gap-4 py-3 outline-none", className)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug text-ink">{label}</p>
        {description && <p className="mt-0.5 text-sm leading-snug text-muted">{description}</p>}
      </div>
      {children !== undefined && children !== null && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
