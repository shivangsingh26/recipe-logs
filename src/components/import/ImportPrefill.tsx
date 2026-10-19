"use client";

// Reads share-target / deep-link params (?title=&text=&url=) into the importer, then drops
// them from the URL so a reload does not overwrite later edits. Render inside <Suspense>.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { buildPrefillText, hasPrefill } from "@/lib/parser/prefill";

export function ImportPrefill({ onPrefill }: { onPrefill: (text: string) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const title = params.get("title");
  const text = params.get("text");
  const url = params.get("url");

  useEffect(() => {
    const prefill = { title, text, url };
    if (!hasPrefill(prefill)) return;
    onPrefill(buildPrefillText(prefill));
    router.replace("/import/", { scroll: false });
  }, [title, text, url, onPrefill, router]);

  return null;
}
