import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export function RecipeEditorSkeleton() {
  return (
    <>
      <PageHeader size="compact" backHref="/" title={<span className="sr-only">Loading editor</span>} />
      <main aria-busy="true" className="space-y-6 px-4 pb-nav pt-4">
        {["h-40", "h-24", "h-28"].map((height) => (
          <div key={height}>
            <Skeleton className="mb-2 h-3 w-24" />
            <div className={cn("space-y-3 rounded-2xl border border-line bg-surface p-4", height)}>
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
