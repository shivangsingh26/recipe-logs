import { Button, type ButtonProps } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Skeleton";

export interface BusyButtonProps extends Omit<ButtonProps, "loading"> {
  busy: boolean;
}

/**
 * Button with a spinner while its action runs. Unlike Button's `loading`, it stays enabled
 * (callers ignore repeat taps), because disabling the focused button drops keyboard and
 * screen-reader focus to the page.
 */
export function BusyButton({ busy, icon, ...rest }: BusyButtonProps) {
  return <Button {...rest} icon={busy ? <Spinner /> : icon} aria-busy={busy || undefined} />;
}
