import { Suspense } from "react";
import { LogScreen } from "@/components/log/LogScreen";
import { LogScreenSkeleton } from "@/components/log/LogScreenSkeleton";

export const metadata = { title: "Cook Log" };

export default function LogPage() {
  return (
    <Suspense fallback={<LogScreenSkeleton />}>
      <LogScreen />
    </Suspense>
  );
}
