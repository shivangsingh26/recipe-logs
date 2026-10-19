import { CookingPot } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-nav pt-safe">
      <EmptyState
        icon={<CookingPot />}
        title="Nothing cooking here"
        action={<ButtonLink href="/">Back to recipes</ButtonLink>}
      >
        This page doesn’t exist. Your recipes and logs are safe.
      </EmptyState>
    </main>
  );
}
