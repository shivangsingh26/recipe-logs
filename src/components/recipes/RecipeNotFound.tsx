import { ArrowLeft, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

/** Shown when a recipe link points at a recipe that doesn't exist (deleted, or a bad link). */
export function RecipeNotFound() {
  return (
    <>
      <PageHeader size="compact" backHref="/" title="Recipe not found" />
      <main className="px-4 pb-nav pt-6">
        <EmptyState
          icon={<SearchX aria-hidden />}
          title="This recipe isn’t here"
          action={
            <ButtonLink href="/" variant="secondary" icon={<ArrowLeft aria-hidden />}>
              Back to recipes
            </ButtonLink>
          }
        >
          It may have been deleted, or the link is incomplete.
        </EmptyState>
      </main>
    </>
  );
}
