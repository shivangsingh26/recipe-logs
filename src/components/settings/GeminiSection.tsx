"use client";

// Settings → Gemini: connect this device to the relay (paste the connection code once), then
// set up the iPhone Shortcut, check for recipes, make a new secret or disconnect.

import { Link2, RefreshCw } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { Field, TextInput } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { createInboxClient, InboxError, type InboxErrorKind } from "@/lib/inbox/client";
import {
  generateInboxToken,
  getConnection,
  parseConnectionCode,
  setConnection,
  useConnection,
  type RelayConnection,
} from "@/lib/inbox/connection";
import { inboxRunner } from "@/lib/inbox/runner";
import { describeConnection, inboxErrorMessage, relayHost } from "@/lib/inbox/status";
import { BusyButton } from "./BusyButton";
import { SettingsRow, SettingsSection } from "./SettingsSection";
import { ShortcutSetupSheet } from "./ShortcutSetupSheet";
import { useHydrated } from "./useDeviceSupport";

const PRIVACY =
  "Recipes you send from Gemini pass through your relay and are deleted once this device collects them (or after 7 days). Nothing else leaves this device.";

const TONE_CLASSES = { muted: "text-muted", warning: "text-warning", danger: "text-danger" } as const;

function errorKind(error: unknown): InboxErrorKind {
  return error instanceof InboxError ? error.kind : "server";
}

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const toast = useToast();
  const inputId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = parseConnectionCode(code);
    if (!parsed) {
      setError("That isn't a connection code. It looks like https://…/#pair=…");
      return;
    }
    setBusy(true);
    setError(null);
    const token = generateInboxToken();
    try {
      await createInboxClient(parsed.relayUrl, token).pair(parsed.pairingCode);
    } catch (e) {
      setBusy(false);
      setError(inboxErrorMessage(errorKind(e)));
      return;
    }
    setConnection({ ...parsed, token, pairedAt: Date.now(), lastSyncAt: null, lastError: null });
    toast.show({ title: "Connected", description: "Now set up the Shortcut.", tone: "success" });
    onConnected();
  };

  return (
    <form onSubmit={(e) => void connect(e)} className="flex flex-col gap-3 py-4">
      <div>
        <p className="text-[15px] font-medium leading-snug text-ink">Save from Gemini automatically</p>
        <p className="mt-0.5 text-sm leading-snug text-muted">
          Copy a recipe in the Gemini app and an iPhone Shortcut sends it here. Start with your relay&apos;s connection
          code.
        </p>
      </div>
      <Field label="Connection code" htmlFor={inputId} error={error}>
        <TextInput
          id={inputId}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="https://…/#pair=…"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <BusyButton type="submit" busy={busy} fullWidth icon={<Link2 />}>
        Connect
      </BusyButton>
    </form>
  );
}

function ConnectedRows({ connection, onSetup }: { connection: RelayConnection; onSetup: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<"check" | "rotate" | "disconnect" | null>(null);
  const status = describeConnection(connection);

  const check = async () => {
    if (busy) return;
    setBusy("check");
    const result = await inboxRunner.run({ force: true });
    setBusy(null);
    if (result.status === "failed") toast.show({ title: inboxErrorMessage(result.error), tone: "danger" });
    else if (result.status === "synced" && result.outcomes.length === 0) toast.show({ title: "No new recipes" });
    else if (result.status === "skipped" && !navigator.onLine) toast.show({ title: "You're offline" });
  };

  const rotate = async () => {
    if (busy) return;
    if (!connection.pairingCode) {
      toast.show({ title: "Disconnect, then connect again to get a new secret." });
      return;
    }
    const ok = await confirm({
      title: "Make a new secret?",
      body: "Your Shortcut stops working until you paste the new secret into it.",
      confirmLabel: "New secret",
    });
    if (!ok) return;
    setBusy("rotate");
    await inboxRunner.run({ force: true }); // collect anything still waiting under the old secret
    const token = generateInboxToken();
    try {
      await createInboxClient(connection.relayUrl, token).pair(connection.pairingCode);
    } catch (e) {
      setBusy(null);
      toast.show({ title: inboxErrorMessage(errorKind(e)), tone: "danger" });
      return;
    }
    await createInboxClient(connection.relayUrl, connection.token)
      .unpair()
      .catch(() => {});
    setConnection({ ...(getConnection() ?? connection), token, lastError: null });
    setBusy(null);
    toast.show({ title: "New secret made", description: "Copy it into your Shortcut.", tone: "success" });
    onSetup();
  };

  const disconnect = async () => {
    if (busy) return;
    const ok = await confirm({
      title: "Disconnect Gemini?",
      body: "The Shortcut stops working and anything still waiting on the relay is deleted. Paste & save keeps working.",
      confirmLabel: "Disconnect",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("disconnect");
    await inboxRunner.run({ force: true }); // collect anything still waiting first
    await createInboxClient(connection.relayUrl, connection.token)
      .unpair()
      .catch(() => {});
    setConnection(null);
    toast.show({ title: "Disconnected from Gemini" });
  };

  return (
    <>
      <SettingsRow
        label="Connected"
        description={
          <>
            <span className="break-all">{relayHost(connection.relayUrl)}</span>
            <span className={cn("block", TONE_CLASSES[status.tone])}>{status.text}</span>
          </>
        }
      >
        <BusyButton variant="soft" size="sm" icon={<RefreshCw />} busy={busy === "check"} onClick={() => void check()}>
          Check
        </BusyButton>
      </SettingsRow>
      <SettingsRow label="iPhone Shortcut" description="Sends what you copy in Gemini to this device.">
        <Button variant="secondary" size="sm" onClick={onSetup}>
          Set up
        </Button>
      </SettingsRow>
      <div className="flex gap-3 py-3">
        <BusyButton variant="secondary" fullWidth busy={busy === "rotate"} onClick={() => void rotate()}>
          New secret
        </BusyButton>
        <BusyButton variant="ghost" fullWidth busy={busy === "disconnect"} onClick={() => void disconnect()}>
          Disconnect
        </BusyButton>
      </div>
    </>
  );
}

export function GeminiSection() {
  const hydrated = useHydrated();
  const connection = useConnection();
  const [setupOpen, setSetupOpen] = useState(false);

  return (
    <SettingsSection id="gemini" title="Gemini" footnote={PRIVACY} className="divide-y divide-line">
      {!hydrated ? (
        <div className="py-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-12 w-full" />
        </div>
      ) : connection ? (
        <>
          <ConnectedRows connection={connection} onSetup={() => setSetupOpen(true)} />
          <ShortcutSetupSheet
            open={setupOpen}
            onClose={() => setSetupOpen(false)}
            relayUrl={connection.relayUrl}
            token={connection.token}
          />
        </>
      ) : (
        <ConnectForm onConnected={() => setSetupOpen(true)} />
      )}
    </SettingsSection>
  );
}
