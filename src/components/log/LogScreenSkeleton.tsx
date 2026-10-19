import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder for the Cook Log while the client takes over (prerender / Suspense fallback). */
export function LogScreenSkeleton() {
  return (
    <>
      <PageHeader title="Cook Log" subtitle={" "}>
        <Skeleton className="h-11 w-full" />
      </PageHeader>
      <main className="flex-1 px-4 pb-nav pt-4" aria-busy="true">
        <Skeleton className="h-[372px] rounded-2xl" />
        <Skeleton className="mt-7 h-7 w-32" />
        <Skeleton className="mt-3 h-28 rounded-2xl" />
      </main>
    </>
  );
}
