import type { Metadata } from "next";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" size="large" />
      <SettingsScreen />
    </>
  );
}
