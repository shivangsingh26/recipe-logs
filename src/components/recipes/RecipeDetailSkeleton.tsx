import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";

export function RecipeDetailSkeleton() {
  return (
    <>
      <PageHeader size="compact" backHref="/" title={<span className="sr-only">Loading recipe</span>} />
      <main aria-busy="true" className="px-4 pb-nav pt-4">
        <Skeleton className="h-8 w-11/12" />
        <Skeleton className="mt-2 h-8 w-3/5" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-6 h-20 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-32 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-12 w-full" />
      </main>
    </>
  );
}
